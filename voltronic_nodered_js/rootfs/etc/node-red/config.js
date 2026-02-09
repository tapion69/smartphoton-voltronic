module.exports = {
  uiPort: 1880,

  // Dossier persistant
  userDir: "/data/node-red",

  // Flow utilisé par défaut
  flowFile: "flows-voltronic.json",

  // IMPORTANT: clé stable -> évite les warnings et pertes de credentials
  credentialSecret: "voltronic-nodered-addon",

  // Ingress gère l'accès, on laisse ouvert en interne
  adminAuth: null,

  logging: {
    console: { level: "info", metrics: false, audit: false },
  },

  editorTheme: {
    projects: { enabled: false },
  },
};
