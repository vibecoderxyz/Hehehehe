/**
 * CIPHER BVG — backup.js
 *
 * Builds a single .zip of the whole database layer and hands it to Telegram.
 *
 *   • Automatic: every 10 hours the archive is sent to the owner chat.
 *   • Manual:    the /backup command, or the "Backup now" button, sends one
 *                on demand (the button answer is a file, not a message).
 *
 * Only selected state files are bundled. Live WhatsApp credentials under
 * Database/whatsapp-auth/ are deliberately excluded because they are secrets;
 * the active-number registry is included, but it cannot restore credentials.
 *
 * Nothing here invents data. If a file does not exist it is skipped.
 */
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const ROOT = path.join(__dirname, "..");
const BACKUP_DIR = path.join(ROOT, "backups");

/** 10 hours, in milliseconds. */
const AUTO_INTERVAL_MS = 10 * 60 * 60 * 1000;

/** How many archives to keep on disk (Telegram keeps its own copies). */
const KEEP_ON_DISK = 5;

/**
 * Files bundled into every archive, relative to the project root.
 * Missing entries are skipped silently — a fresh install has no user.json
 * entries and no audit trail yet.
 */
const INCLUDED = [
  "Database/config.js",
  "Database/owner.json",
  "Database/commands.json",
  "Database/akses.json",
  "Database/user.json",
  "Database/audit.json",
  "Database/pairing.json",
  "Database/sessions.json",
  "Database/whatsapp-sessions.json",
  "sessions.json",
  "config.json",
  "package.json",
];

/**
 * The pepper is the key that makes stored password hashes verifiable.
 * It IS included, because a backup you cannot restore from is worthless —
 * but it is called out in the caption so it is never forwarded casually.
 */
const SECRET_INCLUDED = ["Database/.pepper"];

/* ── helpers ──────────────────────────────────────────────────────── */

function twoDigit(n) {
  return String(n).padStart(2, "0");
}

/** 2026-11-12_0430_17 — sortable, no colons (Telegram-safe filename). */
function stamp(date = new Date()) {
  return (
    `${date.getFullYear()}-${twoDigit(date.getMonth() + 1)}-${twoDigit(date.getDate())}` +
    `_${twoDigit(date.getHours())}${twoDigit(date.getMinutes())}` +
    `_${twoDigit(date.getSeconds())}`
  );
}

function humanBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/** Delete all but the newest KEEP_ON_DISK archives. */
function pruneOldBackups() {
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("cipher-backup-") && f.endsWith(".zip"))
      .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const old of files.slice(KEEP_ON_DISK)) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, old.f)); } catch {}
    }
  } catch {
    /* pruning is cosmetic — never let it break a backup */
  }
}

/* ── archive builder ──────────────────────────────────────────────── */

/**
 * Build a .zip of the database layer.
 * @param {"auto"|"manual"} reason — recorded in a README inside the zip.
 * @returns {{ file: string, name: string, bytes: number, files: string[] }}
 */
function buildBackup(reason = "manual", date = new Date()) {
  ensureBackupDir();

  const zip = new AdmZip();
  const added = [];

  const add = (rel) => {
    const abs = path.join(ROOT, rel);
    try {
      if (!fs.existsSync(abs)) return;
      const stat = fs.statSync(abs);
      if (!stat.isFile()) return;
      // Store with the exact forward-slash path so the archive unzips
      // straight back over the project root.
      const entry = rel.split(path.sep).join("/");
      zip.addFile(entry, fs.readFileSync(abs));
      added.push(rel);
    } catch {
      /* a locked or unreadable file must not abort the whole backup */
    }
  };

  INCLUDED.forEach(add);
  SECRET_INCLUDED.forEach(add);

  // A manifest makes the archive self-describing when it is opened months later.
  const manifest = [
    "CIPHER BVG — database backup",
    `created : ${date.toISOString()}`,
    `trigger : ${reason}`,
    "",
    "Included files:",
    ...added.map((f) => `  - ${f}`),
    "",
    "Restore: stop the server, unzip over the project root, start again.",
    "IMPORTANT: Database/.pepper is inside this archive. Without it every",
    "stored password hash becomes unverifiable. Keep the archive private.",
  ].join("\n");

  zip.addFile("BACKUP-README.txt", Buffer.from(manifest, "utf8"));

  const name = `cipher-backup-${stamp(date)}-${reason}.zip`;
  const file = path.join(BACKUP_DIR, name);
  zip.writeZip(file);

  pruneOldBackups();

  return { file, name, bytes: fs.statSync(file).size, files: added };
}

/* ── Telegram delivery ────────────────────────────────────────────── */

/**
 * Send the archive as a document.
 * @param {object} telegram — bot.telegram (Telegraf) or a raw API client
 * @param {string|number} chatId
 * @param {"auto"|"manual"} reason
 */
async function sendBackup(telegram, chatId, reason = "manual") {
  const built = buildBackup(reason);

  const caption =
    `<b>🗄 CIPHER BVG — Backup</b>\n\n` +
    `<b>File    :</b> <code>${built.name}</code>\n` +
    `<b>Size    :</b> ${humanBytes(built.bytes)}\n` +
    `<b>Files   :</b> ${built.files.length}\n` +
    `<b>Trigger :</b> ${reason === "auto" ? "automatic (every 10 h)" : "manual"}\n` +
    `<b>Time    :</b> <i>${new Date().toUTCString()}</i>\n\n` +
    `<blockquote>Contains <b>Database/.pepper</b> — keep this archive private. ` +
    `Without that file, every stored password stops verifying.</blockquote>`;

  // A database bundle is a few KB of JSON, so a buffer is simpler and more
  // reliable than a stream (no dangling file handle if the send fails).
  await telegram.sendDocument(
    chatId,
    { source: fs.readFileSync(built.file), filename: built.name },
    { caption, parse_mode: "HTML" }
  );

  return built;
}

/* ── scheduler ────────────────────────────────────────────────────── */

let _timer = null;
let _startedAt = null;
let _lastRun = null;
let _lastError = null;
let _runs = 0;

/**
 * Timestamp of the last successful auto backup, persisted so that a restart
 * does not silently restart the 10-hour window (a crash loop would otherwise
 * never produce a backup).
 */
const LAST_RUN_FILE = path.join(BACKUP_DIR, ".last-auto-backup");

function readLastRun() {
  try {
    const n = Number(fs.readFileSync(LAST_RUN_FILE, "utf8").trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeLastRun(ms) {
  try {
    ensureBackupDir();
    fs.writeFileSync(LAST_RUN_FILE, String(ms), "utf8");
  } catch {
    /* losing this only costs an extra early backup after a restart */
  }
}

/**
 * Start the 10-hour auto backup loop.
 *
 * If the previous backup is already overdue (process was down for a while),
 * one is sent straight away instead of waiting another full 10 hours.
 *
 * @param {object} deps
 * @param {object} deps.bot      Telegraf bot instance (may be null)
 * @param {string} deps.ownerId  owner chat id
 * @param {(msg: string) => void} [deps.log]
 */
function startAutoBackup({ bot, ownerId, log = () => {} }) {
  if (_timer) return { started: false, reason: "already running" };
  if (!bot || !ownerId) return { started: false, reason: "bot or owner id missing" };

  _startedAt = Date.now();

  const run = async (label) => {
    try {
      await sendBackup(bot.telegram, ownerId, "auto");
      _lastRun = Date.now();
      _lastError = null;
      _runs += 1;
      writeLastRun(_lastRun);
      log(`[backup] auto backup sent to owner (run #${_runs})${label ? ` — ${label}` : ""}`);
    } catch (err) {
      _lastError = err.message || String(err);
      log(`[backup] auto backup failed: ${_lastError}`);
    }
  };

  // Catch up if the last backup is already overdue.
  const previous = readLastRun();
  const overdue = !previous || Date.now() - previous >= AUTO_INTERVAL_MS;
  if (overdue) {
    run(previous ? "overdue" : "first run").catch(() => {});
  }

  _timer = setInterval(() => run("scheduled").catch(() => {}), AUTO_INTERVAL_MS);
  if (_timer.unref) _timer.unref(); // never hold the process open

  log(`[backup] auto backup armed — every ${AUTO_INTERVAL_MS / 3600000} h`);

  return { started: true, intervalMs: AUTO_INTERVAL_MS };
}

function stopAutoBackup() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    return true;
  }
  return false;
}

/** Snapshot for the status line in Telegram. */
function backupStatus() {
  return {
    running: !!(_timer),
    intervalHours: AUTO_INTERVAL_MS / 3600000,
    startedAt: _startedAt,
    lastRun: _lastRun,
    lastError: _lastError,
    runs: _runs,
    onDisk: (() => {
      try {
        return fs
          .readdirSync(BACKUP_DIR)
          .filter((f) => f.startsWith("cipher-backup-") && f.endsWith(".zip")).length;
      } catch {
        return 0;
      }
    })(),
  };
}

module.exports = {
  buildBackup,
  sendBackup,
  startAutoBackup,
  stopAutoBackup,
  backupStatus,
  AUTO_INTERVAL_MS,
  BACKUP_DIR,
};
