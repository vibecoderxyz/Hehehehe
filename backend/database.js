/**
 * CIPHER BVG — database.js
 * Storage helpers, account registry, unique 6-digit UID generation,
 * pairing registry, audit log and premium helpers.
 *
 * Ported from the original index.js helpers (saveUsers/getUsers/loadAkses/
 * saveAkses) and extended for the account system.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const configuredOwnerId = String(process.env.OWNER_ID || require("../Database/config.js").owner || "");

const ROOT = path.join(__dirname, "..");
const FILE_AKSES  = path.join(ROOT, "Database", "akses.json");
const FILE_USERS  = path.join(ROOT, "Database", "user.json");
const FILE_AUDIT  = path.join(ROOT, "Database", "audit.json");
const FILE_COMMANDS = path.join(ROOT, "Database", "commands.json");
const FILE_SESSION = path.join(ROOT, "Database", "whatsapp-sessions.json");

/* ── generic JSON helpers ─────────────────────────────────────────── */
function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

/**
 * Atomic write: serialise to a temp file in the same directory, then rename.
 * A crash mid-write can therefore never truncate user.json / sessions.json.
 */
function writeJson(file, data) {
  const payload = JSON.stringify(data, null, 2);
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, payload, "utf8");
    fs.renameSync(tmp, file);
  } catch (err) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

/* ── access registry (ported from loadAkses/saveAkses) ────────────── */
let _aksesCache = null;

function loadAkses() {
  if (_aksesCache) return _aksesCache;
  let data = readJson(FILE_AKSES, {});
  if (!Array.isArray(data.owners))     data.owners     = [];
  if (!Array.isArray(data.akses))      data.akses      = [];
  if (!Array.isArray(data.resellers))  data.resellers  = [];
  if (!Array.isArray(data.pts))        data.pts        = [];
  if (!Array.isArray(data.moderators)) data.moderators = [];
  if (!Array.isArray(data.pairOnly))   data.pairOnly   = [];
  _aksesCache = data;
  return data;
}

function saveAkses(data) {
  writeJson(FILE_AKSES, data);
  _aksesCache = data;
}

const isOwner      = id => String(id) === configuredOwnerId || loadAkses().owners.includes(String(id));
const isReseller   = id => loadAkses().resellers.includes(String(id));
const isPT         = id => loadAkses().pts.includes(String(id));
const isModerator  = id => loadAkses().moderators.includes(String(id));
const isPairOnly   = id => loadAkses().pairOnly.includes(String(id));

function isAuthorized(id) {
  const d = loadAkses();
  return (
    d.owners.includes(String(id))    ||
    d.akses.includes(String(id))     ||
    d.resellers.includes(String(id)) ||
    d.pts.includes(String(id))       ||
    d.moderators.includes(String(id))
  );
}

/* ── account registry (ported from getUsers/saveUsers) ────────────── */
function getUsers() {
  return readJson(FILE_USERS, []);
}

function saveUsers(users) {
  writeJson(FILE_USERS, users);
}

function findUserBy(field, value) {
  return getUsers().find(u => String(u[field]) === String(value));
}

/* ── unique 6-digit UID generation ────────────────────────────────── */
function generateUID() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const uid = String(crypto.randomInt(100000, 1000000)); // 100000..999999
    if (!findUserBy("uid", uid)) return uid;
  }
  return null; // practically unreachable; caller rethrows
}

/* ── command registry (managed from the Telegram bot) ─────────────── */
// No module-level cache: the bot writes commands.json at runtime and the
// web routes must see the new level on the very next request.
function getCommands() {
  const data = readJson(FILE_COMMANDS, { commands: [] });
  if (!Array.isArray(data.commands)) data.commands = [];
  return data.commands;
}

function saveCommands(commands) {
  writeJson(FILE_COMMANDS, { commands });
  return commands;
}

function findCommand(name) {
  return getCommands().find(c => c.name === String(name).toLowerCase()) || null;
}

/** Flip one command between "free" and "premium". Returns the updated entry. */
function setCommandLevel(name, level) {
  const commands = getCommands();
  const cmd = commands.find(c => c.name === String(name).toLowerCase());
  if (!cmd) return null;
  cmd.level = level;
  saveCommands(commands);
  return cmd;
}

/** true when the command is reachable without a premium membership. */
function isCommandFree(name) {
  const cmd = findCommand(name);
  return !!cmd && cmd.level !== "premium" && cmd.level !== "admin";
}

/* ── pairing registry ─────────────────────────────────────────────── */
function getPairingRegistry() {
  const data = readJson(path.join(ROOT, "Database", "pairing.json"), {
    requests: [],
    statuses: {},
  });
  if (!Array.isArray(data.requests)) data.requests = [];
  if (!data.statuses) data.statuses = {};
  return data;
}

function savePairingRegistry(data) {
  writeJson(path.join(ROOT, "Database", "pairing.json"), data);
}

function registerPairingRequest(userId, number) {
  const data = getPairingRegistry();
  const existing = data.requests.find(r => r.userId === userId);
  const request = {
    requestId: crypto.randomUUID().slice(0, 13),
    userId,
    number,
    createdAt: Date.now(),
    status: "pending",
  };
  if (existing) Object.assign(existing, request);
  else data.requests.push(request);
  data.statuses[number] = "pending";
  savePairingRegistry(data);
  return request;
}

function updatePairingStatus(number, status) {
  const data = getPairingRegistry();
  data.statuses[number] = status;
  const req = data.requests.find(r => r.number === number);
  if (req) {
    req.status = status;
    if (status === "connected") req.connectedAt = Date.now();
  }
  savePairingRegistry(data);
  return status;
}

function getPairingStatus(number) {
  return getPairingRegistry().statuses[number] || null;
}

/* ── premium helpers ──────────────────────────────────────────────── */
function setPremium(target, { active, admin, type, expiresAt }) {
  const users = getUsers();
  const idx = users.findIndex(u => String(u.uid) === String(target.uid));
  if (idx === -1) return null;
  users[idx].premium = {
    active: !!active,
    activatedAt: Date.now(),
    expiresAt: expiresAt || null,
    type: type || "lifetime",
    activatedBy: admin || null,
  };
  saveUsers(users);
  return users[idx].premium;
}

function isPremium(user) {
  if (!user || !user.premium || !user.premium.active) return false;
  if (user.premium.expiresAt && Date.now() > user.premium.expiresAt) return false;
  return true;
}

/* ── audit log ────────────────────────────────────────────────────── */
function logAudit(entry) {
  const audit = readJson(FILE_AUDIT, []);
  audit.push(Object.assign({
    at: Date.now(),
  }, entry));
  writeJson(FILE_AUDIT, audit.slice(-500));
}

/* ── active sessions file (ported from saveActive/delActive) ──────── */
function getActiveNumbers() {
  return readJson(FILE_SESSION, []);
}

function saveActive(num) {
  const list = getActiveNumbers();
  if (!list.includes(num)) writeJson(FILE_SESSION, [...list, num]);
}

function delActive(num) {
  const list = getActiveNumbers();
  writeJson(FILE_SESSION, list.filter(n => n !== num));
}

module.exports = {
  readJson,
  writeJson,
  loadAkses,
  saveAkses,
  isOwner,
  isReseller,
  isPT,
  isModerator,
  isPairOnly,
  isAuthorized,
  getUsers,
  saveUsers,
  findUserBy,
  generateUID,
  getCommands,
  saveCommands,
  findCommand,
  setCommandLevel,
  isCommandFree,
  getPairingRegistry,
  savePairingRegistry,
  registerPairingRequest,
  updatePairingStatus,
  getPairingStatus,
  setPremium,
  isPremium,
  logAudit,
  getActiveNumbers,
  saveActive,
  delActive,
};
