/**
 * CIPHER BVG — wa.js
 * WhatsApp pairing & session management, ported from index.js.
 * Keeps the original connection lifecycle: createWAConnection,
 * connectToWhatsApp, initializeWhatsAppConnections, and the pairing
 * promise helpers used by the API routes.
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
  makeInMemoryStore,
  generateWAMessageFromContent,
  fetchLatestWAWebVersion,
  Browsers,
} = require("@whiskeysockets/baileys");

const db = require("./database");
const { escapeHtml } = require("./html");
const config = require("../config.json");

const ROOT = path.join(__dirname, "..");
const SESSIONS_DIR = path.join(ROOT, "auth");
const FILE_SESSION = path.join(ROOT, "sessions.json");

const sessions        = new Map();
const reconnectTimers = new Map();
const pendingCodes    = new Map();
const pendingSessions = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

const makeCode = (number, code) => ({
  text:
    `<blockquote>\n╔══════════════╗\n║  PAIR CODE   ║\n╠══════════════╣\n║ Number : ${escapeHtml(number)}\n║ Code   : ${escapeHtml(code)}\n╚══════════════╝\n</blockquote>`,
  parse_mode: "HTML",
});

const makeStatus = (number, status) =>
  `<blockquote>\n╔══════════════╗\n║    STATUS     ║\n╠══════════════╣\n║ Number : ${escapeHtml(number)}\n║ Status : ${escapeHtml(String(status).toUpperCase())}\n╚══════════════╝\n</blockquote>`;

const createWAConnection = async (BotNumber, ctx = null, statusMsg = null) => {
  const sessDir = sessionPath(BotNumber);
  const { state, saveCreds } = await useMultiFileAuthState(sessDir);

  const sessionStore = makeInMemoryStore({ logger: pino({ level: "silent" }) });

  let waVersion;
  try {
    const { version } = await fetchLatestWAWebVersion();
    waVersion = version;
  } catch {
    waVersion = [2, 3000, 1043890899];
  }

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
  }, sessionStore);

  let wasLinked = false;
  let pairCodeSent = false;
  const editStatus = async (text) => {
    if (!ctx || !statusMsg) return;
    try {
      await ctx.telegram.editMessageText(
        statusMsg.chat.id, statusMsg.message_id, null,
        text, { parse_mode: "HTML" }
      );
    } catch {}
  };

  sessionStore.bind(sock.ev);
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
    if (connection === "connecting" && !pairCodeSent && !state.creds.registered) {
      pairCodeSent = true;
      try {
        const clean = BotNumber.replace(/[^0-9]/g, "");
        const raw   = await sock.requestPairingCode(clean);
        const code  = (raw && raw.match && raw.match(/.{1,4}/g) && raw.match(/.{1,4}/g).join("-")) || raw;
        console.log(chalk.green("[+] [" + BotNumber + "] Code: " + code));

        if (pendingCodes.has(BotNumber)) {
          pendingCodes.get(BotNumber).resolve(code);
          pendingCodes.delete(BotNumber);
        }

        if (ctx) {
          const msg = makeCode(BotNumber, code);
          await editStatus(msg.text);
          try { await ctx.telegram.sendMessage(ctx.from.id, msg.text, { parse_mode: "HTML" }); } catch {}
        }
      } catch (e) {
        console.error(chalk.red("[x] [" + BotNumber + "] Pairing error: " + e.message));
        if (pendingCodes.has(BotNumber)) {
          pendingCodes.get(BotNumber).reject(new Error("Pairing code request failed: " + e.message));
          pendingCodes.delete(BotNumber);
        }
        if (ctx) {
          const errText = makeStatus(BotNumber, "Pairing failed. Run /addbot again.");
          await editStatus(errText);
          try { await ctx.telegram.sendMessage(ctx.from.id, errText, { parse_mode: "HTML" }); } catch {}
        }
      }
    }

    if (connection === "open") {
      wasLinked = true;
      if (reconnectTimers.has(BotNumber)) {
        clearTimeout(reconnectTimers.get(BotNumber));
        reconnectTimers.delete(BotNumber);
      }
      sessions.set(BotNumber, sock);
      db.saveActive(BotNumber);
      console.log(chalk.green("[+] [" + BotNumber + "] Connected"));

      try { await sock.sendPresenceUpdate("available"); } catch (_) {}

      if (pendingSessions.has(BotNumber)) {
        pendingSessions.get(BotNumber)(true);
        pendingSessions.delete(BotNumber);
      }

      if (pairCodeSent) return;

      const connText = makeStatus(BotNumber, "Connected and ready.");
      await editStatus(connText);
      try { await ctx.telegram.sendMessage(ctx.from.id, connText, { parse_mode: "HTML" }); } catch {}
    }

    if (connection === "close") {
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
          try { await createWAConnection(BotNumber); } catch {}
        }, 1000));
        return;
      }

      sessions.delete(BotNumber);

      if (!wasLinked && pendingSessions.has(BotNumber)) {
        pendingSessions.get(BotNumber)(false);
        pendingSessions.delete(BotNumber);
      }

      if (reason === 401 && !wasLinked) {
        console.log(chalk.red("[!] [" + BotNumber + "] 401 during pairing — wiping session."));
        db.delActive(BotNumber);
        wipeDir(BotNumber);
        const errText = makeStatus(BotNumber, "Pairing rejected (401). Delete session and run /addbot again.");
        await editStatus(errText);
        try { await ctx.telegram.sendMessage(ctx.from.id, errText, { parse_mode: "HTML" }); } catch {}
        return;
      }

      if (reason === DisconnectReason.loggedOut || reason === 401) {
        db.delActive(BotNumber);
        wipeDir(BotNumber);
        return;
      }

      if (reason === DisconnectReason.badSession) {
        db.delActive(BotNumber);
        wipeDir(BotNumber);
        console.log(chalk.red("[!] [" + BotNumber + "] Bad session — WA rejected pairing. Waiting 15min before retry."));
        const errText = makeStatus(BotNumber, "WhatsApp rejected the session. Wait 15 minutes then run /addbot again.");
        if (ctx) await editStatus(errText).catch(() => {});
        if (reconnectTimers.has(BotNumber)) clearTimeout(reconnectTimers.get(BotNumber));
        reconnectTimers.set(BotNumber, setTimeout(async () => {
          reconnectTimers.delete(BotNumber);
          try { await createWAConnection(BotNumber, ctx, statusMsg); } catch {}
        }, 15 * 60 * 1000));
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
};

const initializeWhatsAppConnections = async () => {
  if (!fs.existsSync(FILE_SESSION)) return;
  let nums;
  try { nums = JSON.parse(fs.readFileSync(FILE_SESSION, "utf8")); } catch { return; }
  if (!Array.isArray(nums) || !nums.length) return;
  for (const num of nums) {
    try { await createWAConnection(num); } catch (e) { console.error(chalk.red(`[x] Restore ${num}: ${e.message}`)); }
    await sleep(2000);
  }
};

const connectToWhatsApp = async (BotNumber, ctx) => {
  const clean = BotNumber.replace(/[^0-9]/g, "");
  if (!clean || clean.length < 7 || clean.length > 15)
    return ctx.reply("[x] Invalid number. Use international format: 234xxxxxxxxxx");
  if (sessions.has(clean))
    return ctx.reply(`[!] ${clean} already connected. Use /delbot first.`);

  db.delActive(clean);
  wipeDir(clean);

  const statusMsg = await ctx.reply(`⏳ Connecting <code>${clean}</code>...`, { parse_mode: "HTML" });
  try { await createWAConnection(clean, ctx, statusMsg); }
  catch (e) {
    try { await ctx.telegram.sendMessage(ctx.from.id, makeStatus(clean, `Error: ${e.message}`), { parse_mode: "HTML" }); } catch {}
  }
};

/** Fire-and-forget pairing request used by the web API. Returns a promise for the code. */
const requestPairCode = (number) => {
  if (sessions.has(number)) return Promise.reject(new Error(`${number} is already connected.`));

  if (pendingCodes.has(number)) {
    pendingCodes.get(number).reject(new Error("Superseded by new request."));
    pendingCodes.delete(number);
  }

  db.delActive(number);
  wipeDir(number);

  const codePromise = new Promise((resolve, reject) => {
    pendingCodes.set(number, { resolve, reject });
    setTimeout(() => {
      if (pendingCodes.has(number)) {
        pendingCodes.get(number).reject(new Error("Pairing timed out. Try again."));
        pendingCodes.delete(number);
      }
    }, config.panel.pairingTimeoutMs || 20000);
  });

  createWAConnection(number).catch(() => {});
  return codePromise;
};

/** Wait-for-connected used by /api/pair/wait/:number. Returns {ok, connected}. */
const waitForConnection = (number, timeoutMs, onResult) => {
  if (sessions.has(number)) return onResult(null, { ok: true, connected: true, number });

  const timeout = setTimeout(() => {
    if (pendingSessions.has(number)) {
      pendingSessions.delete(number);
      onResult(null, { ok: true, connected: false, number, reason: "timeout" });
    }
  }, timeoutMs);

  pendingSessions.set(number, (connected) => {
    clearTimeout(timeout);
    onResult(null, { ok: true, connected, number });
  });

  return () => {
    clearTimeout(timeout);
    pendingSessions.delete(number);
  };
};

function getActiveSock() {
  if (sessions.size === 0) throw new Error("No active WhatsApp sessions.");
  const keys = [...sessions.keys()];
  return sessions.get(keys[Math.floor(Math.random() * keys.length)]);
}

module.exports = {
  sessions,
  pendingCodes,
  reconnectTimers,
  createWAConnection,
  initializeWhatsAppConnections,
  connectToWhatsApp,
  requestPairCode,
  waitForConnection,
  getActiveSock,
  sessionPath,
  wipeDir,
  makeCode,
  makeStatus,
};
