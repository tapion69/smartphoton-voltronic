module.exports = {
  uiPort: 1880,

  userDir: "/data/node-red",
  flowFile: "flows-voltronic.json",

  adminAuth: null,

  // (optionnel) éviter le warning de credentials
  credentialSecret: process.env.CREDENTIAL_SECRET || "voltronic-default-change-me",

  logging: {
    console: { level: "info", metrics: false, audit: false },
  },

  editorTheme: {
    projects: { enabled: false },
  },
};
