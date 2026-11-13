/**
 * CIPHER BVG — commandAdmin.js
 * Telegram-side command tier management.
 *
 * Lets the owner flip any CMD between FREE and PREMIUM straight from the
 * bot, using inline buttons. The change is written to Database/commands.json
 * and picked up by the web panel on the very next request (no restart).
 *
 * Commands added here:
 *   /commands            – tap-to-toggle panel (FREE / PREMIUM sections)
 *   /cmdlist             – plain-text list of every command + tier
 *   /cmdset <name> <tier> – set a tier by name (free | premium | admin)
 *   /cmdfree             – show only the FREE commands
 *   /cmdpremium          – show only the PREMIUM commands
 */
const db = require("./database");

const TIERS = ["free", "premium", "admin"];

const { escapeHtml } = require("./html");

/** Normalise the stored level to one of the three tiers. */
function tierOf(cmd) {
  const lvl = String(cmd.level || "free").toLowerCase();
  if (lvl === "premium" || lvl === "admin") return lvl;
  return "free"; // public / registered / anything else counts as free
}

const tierIcon = (t) => (t === "premium" ? "💎" : t === "admin" ? "👑" : "🆓");
const tierLabel = (t) => (t === "premium" ? "PREMIUM" : t === "admin" ? "ADMIN" : "FREE");

function isManager(id) {
  return db.isOwner(id) || db.isModerator(id) || db.isAuthorized(id);
}

/** Build the inline keyboard: one button per command, grouped by tier. */
function buildKeyboard() {
  const commands = db.getCommands();
  const rows = [];

  const byTier = { free: [], premium: [], admin: [] };
  for (const c of commands) byTier[tierOf(c)].push(c);

  rows.push([{ text: "──── 🆓 FREE ────", callback_data: "noop" }]);
  for (const c of byTier.free) {
    // tapping a FREE command offers to make it PREMIUM
    rows.push([{ text: `🆓 /${c.name}  →  💎 premium`, callback_data: `lv:${c.name}:premium` }]);
  }
  if (!byTier.free.length) rows.push([{ text: "(none)", callback_data: "noop" }]);

  rows.push([{ text: "──── 💎 PREMIUM ────", callback_data: "noop" }]);
  for (const c of byTier.premium) {
    // tapping a PREMIUM command offers to make it FREE
    rows.push([{ text: `💎 /${c.name}  →  🆓 free`, callback_data: `lv:${c.name}:free` }]);
  }
  if (!byTier.premium.length) rows.push([{ text: "(none)", callback_data: "noop" }]);

  if (byTier.admin.length) {
    rows.push([{ text: "──── 👑 ADMIN ────", callback_data: "noop" }]);
    for (const c of byTier.admin) {
      rows.push([{ text: `👑 /${c.name}  →  🆓 free`, callback_data: `lv:${c.name}:free` }]);
    }
  }

  rows.push([{ text: "🔄 Refresh", callback_data: "refresh" }]);
  return { inline_keyboard: rows };
}

/** The panel text shown above the keyboard. */
function buildPanelText() {
  const commands = db.getCommands();
  const counts = { free: 0, premium: 0, admin: 0 };
  for (const c of commands) counts[tierOf(c)]++;

  return (
    `<b>⚙️ CMD Tier Manager — CIPHER BVG</b>\n\n` +
    `🆓 Free commands    : <b>${counts.free}</b>\n` +
    `💎 Premium commands : <b>${counts.premium}</b>\n` +
    `👑 Admin commands   : <b>${counts.admin}</b>\n\n` +
    `<blockquote>Tap a command below to toggle it between FREE and PREMIUM.\n` +
    `The website picks the change up immediately — no restart needed.</blockquote>\n\n` +
    `<i>Tip: /cmdset &lt;name&gt; &lt;free|premium|admin&gt;</i>`
  );
}

function registerCommandAdmin(bot, { ownerId }) {
  const guard = (ctx) => {
    const id = ctx.from.id.toString();
    if (!isManager(id)) {
      ctx.reply("[!] Access denied.");
      return false;
    }
    return true;
  };

  /* ── /commands — interactive panel ─────────────────────────────── */
  bot.command("commands", async (ctx) => {
    if (!guard(ctx)) return;
    await ctx.reply(buildPanelText(), {
      parse_mode: "HTML",
      reply_markup: buildKeyboard(),
    });
  });

  /* ── button presses ────────────────────────────────────────────── */
  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery && ctx.callbackQuery.data;
    if (!data) return;
    if (!data.startsWith("lv:") && data !== "refresh" && data !== "noop") return;

    if (!isManager(ctx.from.id.toString())) {
      return ctx.answerCbQuery("Access denied.", { show_alert: true }).catch(() => {});
    }

    if (data === "noop") return ctx.answerCbQuery().catch(() => {});

    if (data === "refresh") {
      await ctx.answerCbQuery("Refreshed").catch(() => {});
      return ctx
        .editMessageText(buildPanelText(), {
          parse_mode: "HTML",
          reply_markup: buildKeyboard(),
        })
        .catch(() => {});
    }

    // lv:<name>:<tier>
    const [, name, tier] = data.split(":");
    if (!name || !TIERS.includes(tier)) return ctx.answerCbQuery("Bad request").catch(() => {});

    const before = db.findCommand(name);
    if (!before) return ctx.answerCbQuery("Command not found").catch(() => {});

    const updated = db.setCommandLevel(name, tier);
    db.logAudit({
      event: "command.level_change",
      command: name,
      from: tierOf(before),
      to: tier,
      admin: ctx.from.id.toString(),
    });

    await ctx
      .answerCbQuery(`/${name} is now ${tierLabel(tier)}`)
      .catch(() => {});
    await ctx
      .editMessageText(buildPanelText(), {
        parse_mode: "HTML",
        reply_markup: buildKeyboard(),
      })
      .catch(() => {});

    console.log(
      `[cmd] ${ctx.from.id} set /${name}: ${tierOf(before)} -> ${tier}` +
        (updated ? "" : " (not saved)")
    );
  });

  /* ── /cmdlist — plain text ─────────────────────────────────────── */
  bot.command("cmdlist", async (ctx) => {
    if (!guard(ctx)) return;
    const commands = db.getCommands();
    if (!commands.length) return ctx.reply("No commands registered.");

    const lines = commands.map(
      (c) => `${tierIcon(tierOf(c))} /${escapeHtml(c.name)} — ${escapeHtml(c.description || "")}`
    );
    await ctx.reply(
      `<b>📋 All Commands (${commands.length})</b>\n\n` + lines.join("\n"),
      { parse_mode: "HTML" }
    );
  });

  /* ── /cmdfree — free only ──────────────────────────────────────── */
  bot.command("cmdfree", async (ctx) => {
    if (!guard(ctx)) return;
    const free = db.getCommands().filter((c) => tierOf(c) === "free");
    await ctx.reply(
      `<b>🆓 Free Commands (${free.length})</b>\n\n` +
        (free.map((c) => `• /${escapeHtml(c.name)}`).join("\n") || "(none)"),
      { parse_mode: "HTML" }
    );
  });

  /* ── /cmdpremium — premium only ────────────────────────────────── */
  bot.command("cmdpremium", async (ctx) => {
    if (!guard(ctx)) return;
    const prem = db.getCommands().filter((c) => tierOf(c) === "premium");
    await ctx.reply(
      `<b>💎 Premium Commands (${prem.length})</b>\n\n` +
        (prem.map((c) => `• /${escapeHtml(c.name)}`).join("\n") || "(none)"),
      { parse_mode: "HTML" }
    );
  });

  /* ── /cmdset <name> <tier> ─────────────────────────────────────── */
  bot.command("cmdset", async (ctx) => {
    if (!guard(ctx)) return;
    const parts = ctx.message.text.trim().split(/\s+/);
    const rawName = (parts[1] || "").replace(/^\//, "").toLowerCase();
    const tier = (parts[2] || "").toLowerCase();

    if (!rawName || !TIERS.includes(tier)) {
      return ctx.reply(
        "Usage: /cmdset <command> <free|premium|admin>\n" +
          "Example: /cmdset delay free"
      );
    }

    const before = db.findCommand(rawName);
    if (!before) return ctx.reply(`[x] No such command: /${rawName}`);

    db.setCommandLevel(rawName, tier);
    db.logAudit({
      event: "command.level_change",
      command: rawName,
      from: tierOf(before),
      to: tier,
      admin: ctx.from.id.toString(),
    });

    await ctx.reply(
      `[+] <b>/${escapeHtml(rawName)}</b> is now ${tierIcon(tier)} <b>${tierLabel(tier)}</b>.`,
      { parse_mode: "HTML" }
    );
  });
}

module.exports = { registerCommandAdmin, tierOf };
