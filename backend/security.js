/**
 * CIPHER BVG — security.js
 * Password hashing, secure session tokens and cookie helpers.
 *
 * No plaintext passwords are ever stored. Sessions are signed random
 * tokens kept in httpOnly cookies (never localStorage).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/**
 * The pepper must never be the value shipped in config.json. If it is still
 * the placeholder (or empty), generate a random one on first boot and persist
 * it to Database/.pepper so hashes stay stable across restarts.
 */
const PEPPER_FILE = path.join(__dirname, "..", "Database", ".pepper");
const PLACEHOLDER_PEPPERS = new Set(["", "cipher-bvg-pepper-change-me", "cipher-bvg-pepper"]);

function resolvePepper() {
  let configured = "";
  try {
    configured = require("../config.json").security?.pepper || "";
  } catch { /* fall through to generated */ }

  if (!PLACEHOLDER_PEPPERS.has(String(configured))) return String(configured);

  // reuse a previously generated pepper if one exists
  try {
    const saved = fs.readFileSync(PEPPER_FILE, "utf8").trim();
    if (saved) return saved;
  } catch { /* not created yet */ }

  const generated = crypto.randomBytes(32).toString("hex");
  try {
    fs.writeFileSync(PEPPER_FILE, generated, { encoding: "utf8", mode: 0o600 });
    console.warn("[!] config.json security.pepper was a placeholder.");
    console.warn("[!] A random pepper was generated and saved to Database/.pepper — keep this file.");
  } catch (err) {
    console.warn(`[!] Could not persist pepper (${err.message}); sessions will not survive a restart.`);
  }
  return generated;
}

const PEPPER = resolvePepper();

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Hash a password with a per-user salt + global pepper.
 * Format: sha256(sha256(password):salt:pepper)
 */
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(12).toString("hex");
  const digest = sha256(`${sha256(String(password))}:${s}:${PEPPER}`);
  return { salt: s, hash: digest };
}

function verifyPassword(password, salt, expectedHash) {
  const digest = sha256(`${sha256(String(password))}:${salt}:${PEPPER}`);
  return safeEqual(digest, expectedHash);
}

/** True when the premium flag is set and has not expired. */
function premiumIsActive(user) {
  const p = user && user.premium;
  if (!p || !p.active) return false;
  if (p.expiresAt && Date.now() > p.expiresAt) return false;
  return true;
}

/** Random 48-hex session token. */
function createSessionToken() {
  return crypto.randomBytes(24).toString("hex");
}

/** Constant-time compare of two strings. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function toPublicUser(user) {
  return {
    uid: user.uid,
    username: user.username,
    email: user.email,
    avatar: user.avatar || null,
    createdAt: user.createdAt || null,
    status: user.status || "active",
    premium: user.premium || { active: false },
    // expiry-aware so the UI badge matches what /api/cmd/execute enforces
    premiumActive: premiumIsActive(user),
    pairedNumber: user.pairedNumber || null,
    paired: !!user.pairedNumber,
    role: user.role || "Member",
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  safeEqual,
  premiumIsActive,
  toPublicUser,
};
