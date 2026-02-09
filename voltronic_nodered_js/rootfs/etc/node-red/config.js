module.exports = {
  uiPort: 1880,
  userDir: "/data/node-red",
  flowFile: "flows-voltronic.json",
  credentialSecret: "voltronic-nodered-addon",
  adminAuth: null,
  logging: { console: { level: "info", metrics: false, audit: false } },
  editorTheme: { projects: { enabled: false } },
};
