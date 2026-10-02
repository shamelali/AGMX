/* ============================================================
   AGMX — Config (per-deployment)
   ------------------------------------------------------------
   Copy to config.local.js for dev, or set these on Vercel.
   DO NOT commit real values.
   ============================================================ */

window.AGMX_CONFIG = {
  // PocketBase instance
  url: "http://127.0.0.1:8090",

  // Google OAuth2 client ID (see GOOGLE_AUTH_SETUP.md)
  googleClientId: "",

  appName: "AGMX",

  // When true and PocketBase is unreachable, fall back to data.js mock data
  // so the demo still runs. Set false in production.
  demoMode: true,
};
