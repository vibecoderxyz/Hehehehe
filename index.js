/**
 * CIPHER BVG — index.js
 * Entry point: Express panel + Telegram admin bot + WhatsApp session boot.
 * Ported from the original monolithic index.js, now split into backend/.
 */
const path = require("path");
const chalk = require("chalk");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { Telegraf } = require("telegraf");

const config = require("./Database/config.js");
const { wa, available: ENGINE_AVAILABLE, loadError: ENGINE_ERROR } = require("./backend/engine");
const { registerBot } = require("./backend/telegram");
const { attachRoutes } = require("./backend/routes");
const backup = require("./backend/backup");
const { escapeHtml } = require("./backend/html");

const BOT_NAME    = "CIPHER BVG";
const BOT_VERSION = "7.0.0";
const CREATOR     = "Arman";

// Railway / Pterodactyl inject PORT as a string — Express needs a number
const PORT   = Number(config.port) || 2024;
const TOKENS = config.tokens;
const OWNER  = config.owner;

/* ── Express setup ─────────────────────────────────────────────────── */
const app = express();
// Only trust proxy headers when actually deployed behind a reverse proxy,
// otherwise X-Forwarded-For could be spoofed to evade the rate limiter.
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", true);
app.disable("x-powered-by");
/* ── CORS ──────────────────────────────────────────────────────────────
 * The panel is same-origin, so cross-origin access is not needed. Reflecting
 * an arbitrary origin while allowing credentials would let any website read
 * authenticated /api/* responses with the visitor's session cookie.
 * Set PANEL_ORIGIN (e.g. https://panel.example.com) only if you split the
 * frontend onto a different host.
 */
const PANEL_ORIGIN = process.env.PANEL_ORIGIN || null;
app.use(cors({
  origin: PANEL_ORIGIN || false,
  credentials: !!PANEL_ORIGIN,
}));
app.use(bodyParser.json({ limit: "4mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// static assets kept separate from the single-file HTML pages
app.use("/assets", express.static(path.join(__dirname, "Assets"), { maxAge: "1d" }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), { maxAge: "1h" }));

/* ── Telegram bot ──────────────────────────────────────────────────── */
let bot = null;

if (TOKENS) {
  try {
    bot = new Telegraf(TOKENS);
    registerBot(bot, { ownerId: OWNER });

    bot.catch((err, ctx) => {
      console.error(chalk.red(`[bot] ${ctx.updateType} error: ${err.message}`));
    });

    bot.launch()
      .then(() => {
        console.log(chalk.green("[+] Telegram bot launched"));
        // Arm the 10-hour backup loop only once the bot can actually send.
        const started = backup.startAutoBackup({
          bot,
          ownerId: OWNER,
          log: (m) => console.log(chalk.hex("#E8A33D")(m)),
        });
        if (!started.started) {
          console.log(chalk.yellow(`[!] Auto backup not armed: ${started.reason}`));
        }
      })
      .catch(err => console.error(chalk.red(`[x] Bot launch failed: ${err.message}`)));
  } catch (err) {
    console.error(chalk.red(`[x] Bot init failed: ${err.message}`));
  }
} else {
  console.log(chalk.yellow("[!] BOT_TOKEN is not set — running the web panel only."));
  console.log(chalk.yellow("[!] Auto backup requires the Telegram bot — skipped."));
}

/* ── Web routes ────────────────────────────────────────────────────── */
attachRoutes(app, { bot });

/* ── Boot ──────────────────────────────────────────────────────────── */
console.clear();
console.log(chalk.hex("#E8A33D")(`
╔══════════════════════════════════╗
║         CIPHER BVG ONLINE        ║
╠══════════════════════════════════╣
║  Creator : ${CREATOR.padEnd(20)}║
║  Version : ${BOT_VERSION.padEnd(20)}║
║  Port    : ${String(PORT).padEnd(20)}║
╚══════════════════════════════════╝`));

wa.initializeWhatsAppConnections().catch(err =>
  console.error(chalk.red(`[x] WhatsApp restore failed: ${err.message}`))
);

if (!ENGINE_AVAILABLE) {
  console.log(chalk.yellow(`[!] Engine unavailable: ${ENGINE_ERROR}`));
  console.log(chalk.yellow("[!] Website runs normally; pairing and CMD execution are disabled."));
}

const server = app.listen(PORT, () => {
  console.log(chalk.green(`[+] Web server running on port ${PORT}`));
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(chalk.red(`[x] Port ${PORT} is already in use. Set a different PORT.`));
    process.exit(1);
  }
  console.error(chalk.red(`[x] Server error: ${err.message}`));
});

/* ── graceful shutdown ─────────────────────────────────────────────── */
process.once("SIGINT",  () => { try { backup.stopAutoBackup(); bot && bot.stop("SIGINT"); } catch {} process.exit(0); });
process.once("SIGTERM", () => { try { backup.stopAutoBackup(); bot && bot.stop("SIGTERM"); } catch {} process.exit(0); });

/* ── error reporting (ported _notifyError cooldown) ───────────────── */
const _notifyError = (() => {
  const COOLDOWN_MS = 15000;
  const _seen = new Map();

  return async (label, err, { force = false } = {}) => {
    const errObj  = err instanceof Error ? err : new Error(String(err));
    const message = errObj.message || String(errObj);
    const fingerprint = `${label}::${message}`;
    const now = Date.now();

    const prior = _seen.get(label);
    if (!force && prior && prior.fingerprint === fingerprint && now - prior.ts < COOLDOWN_MS) return;
    _seen.set(label, { fingerprint, ts: now });

    const stack = errObj.stack ? errObj.stack.split("\n").slice(1, 4).join("\n").trim() : "";
    console.error(chalk.red(`[x] ${label}: ${message}`));
    if (stack) console.error(chalk.gray(stack));

    if (!bot) return;
    // Error text routinely contains "<", ">" and "&" (paths, generics, HTML
    // in stack traces). Telegram rejects malformed HTML with 400, which would
    // silently swallow the very crash alert we are trying to deliver.
    const stackLine = stack ? `\n\n<b>Stack:</b>\n<pre>${escapeHtml(stack.slice(0, 400))}</pre>` : "";
    try {
      await bot.telegram.sendMessage(OWNER,
        `<b>⚠️ ${BOT_NAME} — Error</b>\n` +
        `<b>Label:</b> <code>${escapeHtml(label)}</code>\n` +
        `<b>Message:</b> <pre>${escapeHtml(message.slice(0, 600))}</pre>` + stackLine,
        { parse_mode: "HTML" });
    } catch {}
  };
})();

process.on("uncaughtException",  (err) => _notifyError("uncaughtException", err, { force: true }));
process.on("unhandledRejection", (reason) => _notifyError("unhandledRejection", reason instanceof Error ? reason : new Error(String(reason))));

module.exports = { app, bot };
