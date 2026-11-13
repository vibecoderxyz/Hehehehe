/**
 * CIPHER BVG — engine.js
 * Safe loader for the WhatsApp layer (wa.js + bugs.js).
 *
 * The web panel must always boot, even if the heaviest dependency
 * (@whiskeysockets/baileys) failed to install on the host. When the engine
 * is unavailable we expose inert stubs so every route still answers with a
 * clear message instead of crashing the server at require-time.
 */
let wa = null, bugs = null, available = true, loadError = null;

// load each layer separately: a broken bugs.js must not take down wa.js
try {
  wa = require("./wa");
} catch (err) {
  loadError = `wa.js: ${err.message}`;
  console.warn(`[!] WhatsApp session layer unavailable: ${err.message}`);
}

try {
  bugs = require("./bugs");
} catch (err) {
  loadError = loadError ? `${loadError}; bugs.js: ${err.message}` : `bugs.js: ${err.message}`;
  console.warn(`[!] Bug payload layer unavailable: ${err.message}`);
}

// pairing needs only the session layer; CMD execution needs both
const pairingAvailable = !!wa;
const bugsAvailable = !!bugs;
available = pairingAvailable && bugsAvailable;

if (!available) {
  console.warn(`[!] Web panel degraded — pairing: ${pairingAvailable ? "on" : "off"}, cmd payloads: ${bugsAvailable ? "on" : "off"}`);
}

/* ── inert fallbacks ──────────────────────────────────────────────── */
const ENGINE_OFF = "WhatsApp engine is not installed on this server. Run `npm install` and restart.";

if (!wa) {
  wa = {
    sessions: new Map(),
    reconnectTimers: new Map(),
    pendingCodes: new Map(),
    createWAConnection: async () => { throw new Error(ENGINE_OFF); },
    initializeWhatsAppConnections: async () => {},
    connectToWhatsApp: async (number, ctx) => {
      try { await ctx.reply(ENGINE_OFF); } catch { /* ignore */ }
    },
    requestPairCode: async () => { throw new Error(ENGINE_OFF); },
    waitForConnection: (number, timeoutMs, onResult) => {
      onResult(null, { ok: true, connected: false, number, reason: "engine-unavailable" });
      return () => {};
    },
    getActiveSock: () => { throw new Error(ENGINE_OFF); },
    sessionPath: () => "",
    wipeDir: () => {},
    makeCode: () => ({ text: "", parse_mode: "HTML" }),
    makeStatus: () => "",
  };
}

if (!bugs) {
  bugs = {
    BUG_MODES: {},
    fireBug: () => Promise.reject(new Error(ENGINE_OFF)),
    GetSuDelay: async () => {},
    GetSuInvis: async () => {},
    GetSuBlankAndro: async () => {},
    GetSuBlankIOS: async () => {},
    GetSuFC: async () => {},
    GetSuGroupDelay: async () => {},
    GetSuGroupBlank: async () => {},
    GetSuGroupCrash: async () => {},
    groupBanz: async () => {},
  };
}

module.exports = { wa, bugs, available, pairingAvailable, bugsAvailable, loadError };
