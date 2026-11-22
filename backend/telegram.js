/**
 * CIPHER BVG — telegram.js
 * Telegram admin bot, ported from index.js. Owner/admin commands remain;
 * WhatsApp pairing, session import, and Telegram-side session management are
 * disabled. New numbers are paired only through the website.
 */
const db = require("./database");
const { registerCommandAdmin } = require("./commandAdmin");
const { bugs } = require("./engine");
const { escapeHtml } = require("./html");

// Banners are env-overridable, so they come from Database/config.js
// (which reads BANNER_TELEGRAM / BANNER_DASHBOARD / BANNER_LOGIN).
const runtimeConfig = require("../Database/config.js");
const BOT_NAME    = "CIPHER BVG";

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

/* ── register commands on the given Telegraf bot ──────────────────── */
function registerBot(bot, { ownerId }) {
  const tgNotify = async (text) => {
    try { await bot.telegram.sendMessage(ownerId, text, { parse_mode: "HTML" }); } catch {}
  };

  const isConfiguredOwnerPrivateChat = (ctx) =>
    !!ctx.from && !!ctx.chat &&
    String(ctx.from.id) === String(ownerId) &&
    String(ctx.chat.id) === String(ownerId) &&
    ctx.chat.type === "private";

  bot.use(async (ctx, next) => {
    // Stay completely silent outside the configured owner's private chat.
    if (!isConfiguredOwnerPrivateChat(ctx)) return;
    const text = String(ctx.message && ctx.message.text || "").trim();
    const data = String(ctx.callbackQuery && ctx.callbackQuery.data || "");
    // Pairing and session import/removal are website-only. This also blocks
    // stale inline keyboards and old Telegram commands after deployment.
    if (/^\/(?:addbot|listbot|delbot|delsesi|addsender|adp)(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.test(text))
      return ctx.reply("WhatsApp number ko sirf website par login karke Pair page se link karein. Telegram pairing aur session import/management band hai.");
    if (data.startsWith("wa:")) {
      await ctx.answerCbQuery("WhatsApp pairing ab sirf website se hoti hai.", { show_alert: true }).catch(() => {});
      return;
    }
    return next();
  });

  /* /start — preserved from source */
  bot.command("start", async (ctx) => {
    const username = escapeHtml(ctx.from.username || ctx.from.first_name || "User");
    const teks = `<b>${BOT_NAME}</b>\nSalam, <b>${username}</b>.\n\nYeh private bot sirf configured owner ke liye hai. WhatsApp number pair karne ke liye website par login karke <b>Pair</b> page kholein. Bot commands ki guide ke liye <code>/help</code> bhejein.`;
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
              [{ text: "📢 Channel", url: channel }],
              // The bot is private to the configured owner; avoid advertising
              // a manager shortcut to chats that the global guard blocks.
              ...(db.isOwner(ctx.from.id.toString())
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
            [{ text: "📢 Channel", url: channel }],
          ],
        },
      });
    }
  });

  bot.command("help", async (ctx) => {
    const help =
      `<b>📘 ${BOT_NAME} — Asaan Madad</b>\n\n` +
      `<b>Owner-only:</b> Bot sirf configured <code>OWNER_ID</code> wale private Telegram account ko jawab deta hai. Doosre users aur groups ko jawab nahi milega.\n\n` +
      `<b>WhatsApp pairing:</b> Sirf website par account bana/login karein → Pair page kholein → country code ke saath number enter karein → Generate code dabayein → WhatsApp → Settings → Linked Devices → Link with phone number par code enter karein. Yeh SMS OTP nahi hai. Telegram se number pairing ya session import supported nahi.\n\n` +
      `<b>CMD settings:</b> <code>/commands</code> kholein. FREE button dabane se PREMIUM hota hai; PREMIUM dabane se FREE. ADMIN command ko panel mein FREE kiya ja sakta hai. Website par change foran lagu hota hai.\n` +
      `<code>/cmdlist</code> tamam commands, <code>/cmdfree</code> free list, <code>/cmdpremium</code> premium list.\n\n` +
      `<b>Owner tools:</b> <code>/ckey username,30d,,Member</code> key banaye; <code>/mykeys</code> apni keys; <code>/listkey</code> sab keys; <code>/delkey username</code> delete. Access ke liye <code>/addacces ID</code>. <code>/premium UID monthly 30</code> premium activate. <code>/backup</code> database backup.`;
    await ctx.reply(help, { parse_mode: "HTML" });
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
      "  /addacces <id>       — full access"
    );

    const data = db.loadAkses();

    if (flag === "pair")
      return ctx.reply("Telegram pairing band hai. WhatsApp number sirf website ke Pair page se link karein.");

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

  return { tgNotify, generateKey, parseDuration };
}

module.exports = { registerBot };
