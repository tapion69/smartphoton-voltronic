module.exports = {
  uiPort: 1880,

  // Dossiers persistants
  userDir: "/data/node-red",
  flowFile: "flows.json",

  // Pas d'auth Node-RED (Ingress/NGINX s'en charge côté HA)
  adminAuth: null,

  // Logs
  logging: {
    console: {
      level: "info",
      metrics: false,
      audit: false,
    },
  },

  // Désactive les projets Git dans l’éditeur (plus simple plug&play)
  editorTheme: {
    projects: { enabled: false },
  },
};
