#!/usr/bin/env node
import fs from "node:fs";

import mqtt from "mqtt";
import { SerialPort } from "serialport";

/**
 * Home Assistant add-on options are in /data/options.json
 */
const CONFIG_PATH = "/data/options.json";

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config file not found: ${CONFIG_PATH}`);
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

/**
 * CRC16/XMODEM implementation
 * poly 0x1021, init 0x0000
 */
function crc16Xmodem(buf) {
  let crc = 0x0000;
  for (const b of buf) {
    crc ^= (b << 8);
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) crc = ((crc << 1) & 0xffff) ^ 0x1021;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function buildCommand(cmd) {
  const payload = Buffer.from(cmd, "ascii");
  const crc = crc16Xmodem(payload);
  const crcBuf = Buffer.alloc(2);
  crcBuf.writeUInt16BE(crc, 0);
  return Buffer.concat([payload, crcBuf, Buffer.from("\r", "ascii")]);
}

function parseResponse(buf) {
  // Typical: "(....)\r"
  let s = buf.toString("ascii").trim();
  if (s.startsWith("(")) s = s.slice(1);
  s = s.replace(/\r/g, "").trim();
  return s;
}

function tryFloat(s) {
  const v = Number.parseFloat(s);
  return Number.isFinite(v) ? v : null;
}
function tryInt(s) {
  const v = Number.parseInt(String(s), 10);
  return Number.isFinite(v) ? v : null;
}

function parseQPIGS(fields) {
  const data = { raw_fields: fields };

  if (fields.length > 0) data.grid_v = tryFloat(fields[0]);
  if (fields.length > 1) data.grid_hz = tryFloat(fields[1]);
  if (fields.length > 2) data.ac_out_v = tryFloat(fields[2]);
  if (fields.length > 3) data.ac_out_hz = tryFloat(fields[3]);
  if (fields.length > 4) data.apparent_power_va = tryInt(fields[4]);
  if (fields.length > 5) data.active_power_w = tryInt(fields[5]);
  if (fields.length > 6) data.load_pct = tryInt(fields[6]);
  if (fields.length > 7) data.bus_v = tryInt(fields[7]);
  if (fields.length > 8) data.battery_v = tryFloat(fields[8]);
  if (fields.length > 9) data.battery_charge_a = tryInt(fields[9]);
  if (fields.length > 10) data.battery_capacity_pct = tryInt(fields[10]);
  if (fields.length > 11) data.heatsink_c = tryInt(fields[11]);
  if (fields.length > 12) data.pv_input_a = tryInt(fields[12]);
  if (fields.length > 13) data.pv_input_v = tryFloat(fields[13]);

  const pvV = data.pv_input_v;
  const pvA = data.pv_input_a;
  if (typeof pvV === "number" && typeof pvA === "number") {
    data.pv_w_est = Math.round(pvV * pvA * 10) / 10;
  }
  return data;
}

function parseQMOD(s) {
  const code = (s || "").trim().slice(0, 1);
  const map = { P: "PowerOn", S: "Standby", L: "Line", B: "Battery", F: "Fault", H: "PowerSaving" };
  return { mode_code: code || "?", mode: map[code] || (code || "Unknown") };
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function topic(prefix, invName, suffix) {
  return `${prefix}/${invName}/${suffix}`;
}

async function openSerial(cfg) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({
      path: cfg.port,
      baudRate: cfg.baudrate ?? 2400,
      dataBits: 8,
      parity: "none",
      stopBits: 1,
      autoOpen: false,
    });
    port.open((err) => (err ? reject(err) : resolve(port)));
  });
}

async function query(port, cmd, timeoutMs) {
  return new Promise((resolve) => {
    const frame = buildCommand(cmd);
    let chunks = [];
    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      resolve({ ok: false, value: "" });
    }, timeoutMs);

    const onData = (data) => {
      chunks.push(data);
      const buf = Buffer.concat(chunks);
      if (buf.includes(0x0d)) { // '\r'
        if (done) return;
        done = true;
        cleanup();
        const cut = buf.slice(0, buf.indexOf(0x0d) + 1);
        resolve({ ok: true, value: parseResponse(cut) });
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      port.off("data", onData);
    };

    port.on("data", onData);
    try {
      port.flush(() => {
        port.write(frame, () => {
          port.drain(() => {});
        });
      });
    } catch {
      if (!done) {
        done = true;
        cleanup();
        resolve({ ok: false, value: "" });
      }
    }
  });
}

async function runInverter(invCfg, globalCfg, mqttClient) {
  const prefix = (globalCfg.mqtt_topic_prefix || "voltronic").replace(/\/+$/, "");
  const pollS = Math.max(1, Number(globalCfg.poll_interval_s ?? 5));
  const timeoutS = Math.max(1, Number(globalCfg.connect_timeout_s ?? 3));
  const timeoutMs = timeoutS * 1000;

  while (true) {
    let port;
    try {
      port = await openSerial(invCfg);
      mqttClient.publish(topic(prefix, invCfg.name, "availability"), "online", { retain: true, qos: 0 });

      while (true) {
        const ts = new Date().toISOString();
        const base = { timestamp: ts, inverter: invCfg.name, port: invCfg.port };

        const qpigs = await query(port, "QPIGS", timeoutMs);
        const qmod = await query(port, "QMOD", timeoutMs);

        const payload = {
          ...base,
          ok: Boolean(qpigs.ok && qmod.ok),
          raw: { QPIGS: qpigs.ok ? qpigs.value : null, QMOD: qmod.ok ? qmod.value : null },
        };

        if (qpigs.ok && qpigs.value) {
          const fields = qpigs.value.split(/\s+/).filter(Boolean);
          Object.assign(payload, parseQPIGS(fields));
        }
        if (qmod.ok && qmod.value) {
          Object.assign(payload, parseQMOD(qmod.value));
        }

        mqttClient.publish(topic(prefix, invCfg.name, "state"), JSON.stringify(payload), { retain: false, qos: 0 });
        await sleep(pollS * 1000);
      }
    } catch (e) {
      try {
        mqttClient.publish(topic(prefix, invCfg.name, "availability"), "offline", { retain: true, qos: 0 });
        mqttClient.publish(
          topic(prefix, invCfg.name, "last_error"),
          JSON.stringify({ error: String(e), ts: Date.now() }),
          { retain: true, qos: 0 }
        );
      } catch {}
      await sleep(3000);
    } finally {
      try { port?.close?.(); } catch {}
    }
  }
}

async function main() {
  const cfg = loadConfig();

  const host = cfg.mqtt_host || "core-mosquitto";
  const mqttPort = Number(cfg.mqtt_port ?? 1883);
  const prefix = (cfg.mqtt_topic_prefix || "voltronic").replace(/\/+$/, "");

  const url = `mqtt://${host}:${mqttPort}`;

  const mqttOpts = {
    clientId: "voltronic-nodered-js-addon",
    keepalive: 60,
    reconnectPeriod: 2000,
  };
  if (cfg.mqtt_username) {
    mqttOpts.username = cfg.mqtt_username;
    mqttOpts.password = cfg.mqtt_password || "";
  }

  const client = mqtt.connect(url, mqttOpts);

  client.on("connect", () => {
    client.publish(`${prefix}/availability`, "online", { retain: true, qos: 0 });
  });
  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[mqtt] error", err?.message || err);
  });

  const invs = Array.isArray(cfg.inverters) ? cfg.inverters.slice(0, 3) : [];
  for (const inv of invs) {
    if (!inv?.enabled || !inv?.port) continue;
    const invCfg = {
      name: String(inv.name || "inv"),
      port: String(inv.port),
      baudrate: Number(inv.baudrate ?? 2400),
    };
    runInverter(invCfg, cfg, client); // fire and forget
  }

  // Keep alive forever
  while (true) await sleep(60_000);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("Fatal:", e);
  process.exit(1);
});
