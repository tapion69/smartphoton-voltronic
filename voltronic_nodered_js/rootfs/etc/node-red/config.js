module.exports = {
  uiPort: 1880,

  userDir: "/data/node-red",
  flowFile: "flows-voltronic.json",

  // Important : désactive le chiffrement des credentials
  // (sinon Node-RED attend un fichier chiffré et affiche "Encrypted credentials not found")
  credentialSecret: "",

  adminAuth: null,

  logging: {
    console: { level: "info", metrics: false, audit: false },
  },

  editorTheme: {
    projects: { enabled: false },
  },
};
