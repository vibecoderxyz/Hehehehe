/**
 * CIPHER BVG — wa.js
 * WhatsApp pairing & session management, ported from index.js.
 * Keeps the WhatsApp connection lifecycle and exposes pairing only to the
 * website pairing module/API.
 */
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const chalk = require("chalk");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  generateWAMessageFromContent,
  fetchLatestBaileysVersion,
  Browsers,
} = require("@whiskeysockets/baileys");

const db = require("./database");
const config = require("../config.json");
const pairingState = require("./pairing/state");
const { requestWebsitePairingCode } = require("./pairing/code");

const ROOT = path.join(__dirname, "..");
const SESSIONS_DIR = path.join(ROOT, "Database", "whatsapp-auth");
const LEGACY_SESSIONS_DIR = path.join(ROOT, "auth");
const FILE_SESSION = path.join(ROOT, "Database", "whatsapp-sessions.json");
const LEGACY_FILE_SESSION = path.join(ROOT, "sessions.json");

const sessions          = new Map();
const reconnectTimers   = new Map();
const { pendingCodes, webPairingNumbers, pairingSockets,
  cancelledSockets, connectionStarts, pairingFailures } = pairingState;

function makeSessionMessageStore() {
  const messages = new Map();
  return {
    loadMessage: async (jid, id) => messages.get(`${jid}:${id}`) || null,
    bind: (ev) => ev.on("messages.upsert", ({ messages: batch }) => {
      for (const message of batch || []) {
        const key = message && message.key;
        if (!key || !key.remoteJid || !key.id) continue;
        messages.set(`${key.remoteJid}:${key.id}`, message);
      }
      while (messages.size > 5000) messages.delete(messages.keys().next().value);
    }),
  };
}

function setPairingFailure(number, message) {
  pairingFailures.set(number, String(message));
  try { db.updatePairingStatus(number, "failed"); } catch {}
}
function rejectPendingCode(number, message) {
  const pending = pendingCodes.get(number);
  if (!pending) return;
  pendingCodes.delete(number);
  pending.reject(new Error(message));
}
function stopPairingSocket(number) {
  const sock = pairingSockets.get(number);
  pairingSockets.delete(number);
  if (!sock) return;
  cancelledSockets.add(sock);
  try { sock.end(); } catch {}
}
function cancelPairing(rawNumber, message = "Pairing cancelled.") {
  const number = normalizePhoneNumber(rawNumber);
  if (!number) return false;
  rejectPendingCode(number, message);
  pairingFailures.set(number, String(message));
  webPairingNumbers.delete(number);
  if (reconnectTimers.has(number)) {
    clearTimeout(reconnectTimers.get(number));
    reconnectTimers.delete(number);
  }
  stopPairingSocket(number);
  const activeSock = sessions.get(number);
  if (activeSock) {
    sessions.delete(number);
    cancelledSockets.add(activeSock);
    try { activeSock.end(); } catch {}
  }
  return true;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Normalize local Pakistani mobile numbers to international digits for Baileys. */
function normalizePhoneNumber(value) {
  const raw = String(value == null ? "" : value).trim();
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return "";
  if (digits.startsWith("92")) return digits;
  if (digits.startsWith("0")) return "92" + digits.replace(/^0+/, "");
  if (digits.length === 10 && digits.startsWith("3")) return "92" + digits;
  return digits; // full international numbers for other countries stay unchanged
}

function moveSessionDirectory(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    fs.renameSync(source, destination);
  } catch (err) {
    // Railway mounts Database as a separate filesystem; rename then returns EXDEV.
    if (err.code !== "EXDEV") throw err;
    fs.cpSync(source, destination, { recursive: true, errorOnExist: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
}

function sessionPath(num) {
  const dir = path.join(SESSIONS_DIR, `device${num}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function wipeDir(BotNumber) {
  try {
    const sd = path.join(SESSIONS_DIR, `device${BotNumber}`);
    if (fs.existsSync(sd)) fs.rmSync(sd, { recursive: true, force: true });
  } catch {}
}

const createWAConnectionImpl = async (BotNumber, webPairingStart = false) => {
  BotNumber = normalizePhoneNumber(BotNumber);
  if (!BotNumber || BotNumber.length < 7 || BotNumber.length > 15) throw new Error("Invalid international phone number.");
  const sessDir = sessionPath(BotNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessDir);

  const sessionStore = makeSessionMessageStore();

  let waVersion;
  let versionTimer;
  try {
    const { version } = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, reject) => { versionTimer = setTimeout(() => reject(new Error("WhatsApp version lookup timed out.")), 12000); }),
    ]);
    waVersion = version;
  } catch {
    waVersion = [2, 3000, 1043890899];
  } finally {
    clearTimeout(versionTimer);
  }

  if (webPairingStart && (!webPairingNumbers.has(BotNumber) || !pendingCodes.has(BotNumber)))
    throw new Error("Pairing request was cancelled before the WhatsApp connection started.");

  const sock = makeWASocket({
    version:                        waVersion,
    logger:                         pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore
        ? makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        : state.keys,
    },
    browser:                        Browsers ? Browsers.ubuntu("Chrome") : ["Ubuntu", "Chrome", ""],
    markOnlineOnConnect:            true,
    emitOwnEvents:                  true,
    ignoreOfflineMessages:          false,
    syncFullHistory:                false,
    generateHighQualityLinkPreview: false,
    keepAliveIntervalMs:            25000,
    connectTimeoutMs:               60000,
    retryRequestDelayMs:            2000,
    cachedGroupMetadata:            async () => undefined,
    shouldIgnoreJid:                jid => jid && jid.includes("@newsletter"),
    shouldSyncHistoryMessage:       msg => !!msg.syncType,
    getMessage: async (key) => {
      const msg = await sessionStore.loadMessage(key.remoteJid, key.id);
      return (msg && (msg.message || msg)) || { conversation: "hello" };
    },
    patchMessageBeforeSending: (msg) => {
      const im = msg && (msg.interactiveMessage
        || (msg.message && msg.message.interactiveMessage)
        || (Object.values(msg).find(v => v && v.message && v.message.interactiveMessage) || {}).message && (Object.values(msg).find(v => v && v.message && v.message.interactiveMessage)).message.interactiveMessage);
      const c = !!(im && im.carouselMessage && im.carouselMessage.cards && im.carouselMessage.cards.every(i => i && i.nativeFlowMessage && i.nativeFlowMessage.buttons));
      if (im && (im.nativeFlowMessage && im.nativeFlowMessage.buttons || c)) {
        const obj    = { name: "cta_url", buttonParamsJson: "" };
        const ctaify = but => Array.isArray(but)
          ? but.flatMap(b => !b || !b.buttonParamsJson ? [] : b.name && b.name.toLowerCase && b.name.toLowerCase().includes("cta_url") ? [b] : [obj, b])
          : but;
        if (im.nativeFlowMessage && im.nativeFlowMessage.buttons) im.nativeFlowMessage.buttons = ctaify(im.nativeFlowMessage.buttons);
        if (c) im.carouselMessage.cards.forEach(card => { if (Array.isArray(card.nativeFlowMessage && card.nativeFlowMessage.buttons)) card.nativeFlowMessage.buttons = ctaify(card.nativeFlowMessage.buttons); });
      }
      const requiresVO = !!(msg.buttonsMessage || msg.templateMessage || msg.listMessage);
      if (requiresVO) msg = { viewOnceMessage: { message: Object.assign({}, msg) } };
      const p = m => {
        const r = (m.botForwardedMessage && m.botForwardedMessage.message && m.botForwardedMessage.message.richResponseMessage) || m.richResponseMessage;
        if (!r) return m;
        r.contextInfo = Object.assign({}, r.contextInfo, { isForwarded: true, forwardOrigin: 4 });
        return m.botForwardedMessage ? m : { botForwardedMessage: { message: m } };
      };
      if (msg.deviceSentMessage && msg.deviceSentMessage.message) msg.deviceSentMessage.message = p(msg.deviceSentMessage.message);
      else msg = p(msg);
      return msg;
    },
  });
  if (!state.creds.registered) pairingSockets.set(BotNumber, sock);

  let wasLinked = false;
  let pairCodeSent = false;
  const issuePairingCode = async () => {
    if (pairCodeSent || state.creds.registered || !webPairingStart) return;
    pairCodeSent = true;
    try {
      if (!webPairingNumbers.has(BotNumber) || !pendingCodes.has(BotNumber))
        throw new Error("Pairing request was cancelled before the WhatsApp code request.");
      const code = await requestWebsitePairingCode(sock, normalizePhoneNumber(BotNumber));
      if (!code) throw new Error("WhatsApp returned an empty pairing code. Please request a new code.");
      console.log(chalk.green("[+] [" + BotNumber + "] Pairing code issued."));
      if (pendingCodes.has(BotNumber)) {
        pendingCodes.get(BotNumber).resolve(code);
        pendingCodes.delete(BotNumber);
      }
    } catch (e) {
      console.error(chalk.red("[x] [" + BotNumber + "] Pairing error: " + e.message));
      setPairingFailure(BotNumber, "Pairing code request failed: " + e.message);
      rejectPendingCode(BotNumber, "Pairing code request failed: " + e.message);
      webPairingNumbers.delete(BotNumber);
      if (pairingSockets.get(BotNumber) === sock) stopPairingSocket(BotNumber);
    }
  };

  sessionStore.bind(sock.ev);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (cancelledSockets.has(sock) && connection !== "close") return;
    if (connection === "connecting") void issuePairingCode();

    if (connection === "open") {
      wasLinked = true;
      webPairingNumbers.delete(BotNumber);
      pairingFailures.delete(BotNumber);
      if (pairingSockets.get(BotNumber) === sock) pairingSockets.delete(BotNumber);
      if (reconnectTimers.has(BotNumber)) {
        clearTimeout(reconnectTimers.get(BotNumber));
        reconnectTimers.delete(BotNumber);
      }
      sessions.set(BotNumber, sock);
      db.saveActive(BotNumber);
      console.log(chalk.green("[+] [" + BotNumber + "] Connected"));

      try { await sock.sendPresenceUpdate("available"); } catch (_) {}

      if (pairCodeSent) return;

    }

    if (connection === "close") {
      if (cancelledSockets.has(sock)) {
        cancelledSockets.delete(sock);
        if (pairingSockets.get(BotNumber) === sock) pairingSockets.delete(BotNumber);
        return;
      }
      if (pairingSockets.get(BotNumber) === sock) pairingSockets.delete(BotNumber);
      let reason;
      try {
        const errObj = lastDisconnect && lastDisconnect.error;
        if (errObj) reason = (errObj.output && errObj.output.statusCode) || errObj.statusCode || errObj.status;
      } catch {
        reason = null;
      }
      if (!reason || reason === 500) {
        const msg = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.message) || "";
        const isTransient = msg.toLowerCase().includes("connection closed")
          || msg.toLowerCase().includes("connection lost")
          || msg.toLowerCase().includes("timed out")
          || msg.toLowerCase().includes("stream ended")
          || msg === "";
        reason = isTransient ? DisconnectReason.restartRequired : (reason || DisconnectReason.restartRequired);
      }
      const reasonLabel = Object.entries(DisconnectReason).find(([, v]) => v === reason)?.[0] || reason;
      console.log(chalk.yellow("[!] [" + BotNumber + "] Closed (" + reasonLabel + ")"));

      if (reason === 515) {
        if (reconnectTimers.has(BotNumber)) clearTimeout(reconnectTimers.get(BotNumber));
        reconnectTimers.set(BotNumber, setTimeout(async () => {
          reconnectTimers.delete(BotNumber);
          // Keep code-request mode only while the web request is still waiting
          // for a code. Once issued, restart with the saved pairing credentials
          // without requesting a second code.
          const resumeWebPairing = webPairingNumbers.has(BotNumber) && pendingCodes.has(BotNumber);
          try { await createWAConnection(BotNumber, resumeWebPairing); } catch (e) {
            if (resumeWebPairing) {
              const failure = `Unable to resume WhatsApp pairing: ${e.message}`;
              setPairingFailure(BotNumber, failure);
              rejectPendingCode(BotNumber, failure);
              webPairingNumbers.delete(BotNumber);
            }
          }
        }, 1000));
        return;
      }

      sessions.delete(BotNumber);

      if (reason === 401 && !wasLinked) {
        const failure = "WhatsApp rejected the pairing. Request a new code and try again.";
        webPairingNumbers.delete(BotNumber);
        setPairingFailure(BotNumber, failure);
        rejectPendingCode(BotNumber, failure);
        console.log(chalk.red("[!] [" + BotNumber + "] 401 during pairing — wiping session."));
        db.delActive(BotNumber);
        wipeDir(BotNumber);
        return;
      }

      if (!wasLinked && reason === DisconnectReason.connectionReplaced) {
        const failure = "WhatsApp replaced the pairing connection. Request a new code.";
        webPairingNumbers.delete(BotNumber);
        setPairingFailure(BotNumber, failure);
        rejectPendingCode(BotNumber, failure);
      }

      if (reason === DisconnectReason.loggedOut || reason === 401) {
        const failure = "WhatsApp logged out this session. Pair the number again.";
        webPairingNumbers.delete(BotNumber);
        setPairingFailure(BotNumber, failure);
        rejectPendingCode(BotNumber, failure);
        db.delActive(BotNumber);
        wipeDir(BotNumber);
        return;
      }

      if (reason === DisconnectReason.badSession) {
        const failure = "WhatsApp rejected the session. Request a new code and try again.";
        webPairingNumbers.delete(BotNumber);
        setPairingFailure(BotNumber, failure);
        rejectPendingCode(BotNumber, failure);
        db.delActive(BotNumber);
        wipeDir(BotNumber);
        console.log(chalk.red("[!] [" + BotNumber + "] Bad session — WhatsApp rejected the session."));
        if (reconnectTimers.has(BotNumber)) {
          clearTimeout(reconnectTimers.get(BotNumber));
          reconnectTimers.delete(BotNumber);
        }
        return;
      }

      if (reason === DisconnectReason.connectionReplaced) return;

      const shouldReconnect =
        reason === DisconnectReason.connectionClosed ||
        reason === DisconnectReason.connectionLost   ||
        reason === DisconnectReason.restartRequired  ||
        reason === DisconnectReason.timedOut;

      const delay = shouldReconnect ? 3000 : 5000;
      if (reconnectTimers.has(BotNumber)) clearTimeout(reconnectTimers.get(BotNumber));
      reconnectTimers.set(BotNumber, setTimeout(async () => {
        reconnectTimers.delete(BotNumber);
        try { await createWAConnection(BotNumber); } catch {}
      }, delay));
    }
  });
  // The initial `connecting` event may fire before its listener is attached.
  // This guarded fallback covers that race without requesting a second code.
  if (!state.creds.registered && webPairingStart) {
    setTimeout(() => void issuePairingCode(), 800);
  }
};
const createWAConnection = (rawNumber, webPairingStart = false) => {
  const number = normalizePhoneNumber(rawNumber);
  if (!number || number.length < 7 || number.length > 15)
    return Promise.reject(new Error("Invalid international phone number."));
  if (connectionStarts.has(number))
    return Promise.reject(new Error(`A WhatsApp connection for ${number} is already starting.`));
  const start = createWAConnectionImpl(number, webPairingStart);
  connectionStarts.set(number, start);
  return start.finally(() => {
    if (connectionStarts.get(number) === start) connectionStarts.delete(number);
  });
};

const initializeWhatsAppConnections = async () => {
  let nums, fromLegacyRegistry = false;
  try {
    if (fs.existsSync(FILE_SESSION)) nums = JSON.parse(fs.readFileSync(FILE_SESSION, "utf8"));
    else if (fs.existsSync(LEGACY_FILE_SESSION)) {
      nums = JSON.parse(fs.readFileSync(LEGACY_FILE_SESSION, "utf8"));
      fromLegacyRegistry = true;
    } else return;
  } catch { return; }
  if (!Array.isArray(nums) || !nums.length) return;
  const restored = [];
  for (const rawNum of nums) {
    const original = String(rawNum || "").trim();
    const num = normalizePhoneNumber(original);
    if (!num || num.length < 7 || num.length > 15) continue;
    const currentOldDir = path.join(SESSIONS_DIR, `device${original}`);
    const legacyOldDir = path.join(LEGACY_SESSIONS_DIR, `device${original}`);
    const newDir = path.join(SESSIONS_DIR, `device${num}`);
    try {
      if (!fs.existsSync(newDir)) {
        if (fs.existsSync(legacyOldDir)) {
          moveSessionDirectory(legacyOldDir, newDir);
        } else if (original !== num && fs.existsSync(currentOldDir)) {
          moveSessionDirectory(currentOldDir, newDir);
        }
      }
    } catch (e) { console.error(chalk.yellow(`[!] Could not migrate old session ${original}: ${e.message}`)); }
    if (!fs.existsSync(path.join(newDir, "creds.json"))) {
      // Backups intentionally omit secret auth files. Never create an empty
      // Baileys auth directory for a registry-only session; it must be paired again.
      try { db.delActive(original); if (original !== num) db.delActive(num); } catch {}
      console.log(chalk.yellow(`[!] Skipping ${num}: WhatsApp credentials are missing; pair it again.`));
      continue;
    }
    if (original !== num || fromLegacyRegistry) {
      try {
        db.delActive(original);
        db.saveActive(num);
        const users = db.getUsers();
        let changed = false;
        users.forEach(user => {
          if (user.pairedNumber === original) { user.pairedNumber = num; changed = true; }
        });
        if (changed) db.saveUsers(users);
      } catch (e) { console.error(chalk.yellow(`[!] Could not migrate registry for ${original}: ${e.message}`)); }
    }
    if (!restored.includes(num)) restored.push(num);
  }
  for (const num of restored) {
    try { await createWAConnection(num); } catch (e) { console.error(chalk.red(`[x] Restore ${num}: ${e.message}`)); }
    await sleep(2000);
  }
};

/** Fire-and-forget pairing request used by the web API. Returns a promise for the code. */
const requestPairCode = (rawNumber) => {
  const number = normalizePhoneNumber(rawNumber);
  if (!number || number.length < 7 || number.length > 15) return Promise.reject(new Error("Invalid international phone number."));
  if (sessions.has(number)) return Promise.reject(new Error(`${number} is already connected.`));
  if (pendingCodes.has(number)) return Promise.reject(new Error("A pairing-code request is already in progress for this number."));
  if (connectionStarts.has(number) && !webPairingNumbers.has(number))
    return Promise.reject(new Error("A WhatsApp connection for this number is already being started."));
  if (pairingSockets.has(number) && !webPairingNumbers.has(number))
    return Promise.reject(new Error("A WhatsApp connection for this number is already being started."));
  if (webPairingNumbers.has(number)) cancelPairing(number, "Previous pairing attempt replaced by a new request.");
  pairingFailures.delete(number);
  if (reconnectTimers.has(number)) {
    clearTimeout(reconnectTimers.get(number));
    reconnectTimers.delete(number);
  }

  db.delActive(number);
  wipeDir(number);
  webPairingNumbers.add(number);
  const codePromise = new Promise((resolve, reject) => {
    const timeoutMs = (config.panel && config.panel.pairingTimeoutMs) || 60000;
    const timer = setTimeout(() => {
      if (!pendingCodes.has(number)) return;
      setPairingFailure(number, "Pairing timed out before WhatsApp issued a code. Try again.");
      rejectPendingCode(number, "Pairing timed out before WhatsApp issued a code. Try again.");
      cancelPairing(number, "Pairing code request timed out.");
    }, timeoutMs);
    pendingCodes.set(number, {
      resolve: code => { clearTimeout(timer); resolve(code); },
      reject: err => { clearTimeout(timer); reject(err); },
    });
  });
  createWAConnection(number, true).catch((err) => {
    setPairingFailure(number, `Unable to start WhatsApp pairing: ${err.message}`);
    rejectPendingCode(number, `Unable to start WhatsApp pairing: ${err.message}`);
    webPairingNumbers.delete(number);
    stopPairingSocket(number);
  });
  return codePromise;
};

function getActiveSock() {
  if (sessions.size === 0) throw new Error("No active WhatsApp sessions.");
  const keys = [...sessions.keys()];
  return sessions.get(keys[Math.floor(Math.random() * keys.length)]);
}

module.exports = {
  sessions,
  isPairingStarting: (rawNumber) => {
    const number = normalizePhoneNumber(rawNumber);
    return !!number && (pendingCodes.has(number) || connectionStarts.has(number));
  },
  getPairingFailure: (rawNumber) => pairingFailures.get(normalizePhoneNumber(rawNumber)) || null,
  normalizePhoneNumber,
  initializeWhatsAppConnections,
  requestPairCode,
  cancelPairing,
  getActiveSock,
};
