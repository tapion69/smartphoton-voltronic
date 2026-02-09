# Voltronic + Node-RED (JS, Plug&Play)

- Node-RED intégré (Ingress)
- Service Node.js qui interroge Voltronic (QPIGS/QMOD) via ports série
- Publication MQTT : `voltronic/<name>/state`

## Plug & Play
Le `flows.json` est copié automatiquement dans `/data/node-red/flows.json` au premier démarrage.
