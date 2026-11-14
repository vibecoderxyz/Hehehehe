/**
 * CIPHER BVG — routes.js
 * Express API layer: auth (persistent sessions), accounts/UIDs, profile &
 * avatar uploads, pairing, CMD execution, owner info and admin endpoints.
 * Serves the static frontend pages (public/*.html) and uploads.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const db = require("./database");
const sec = require("./security");
const { wa, bugs, available: ENGINE_AVAILABLE, pairingAvailable: PAIRING_AVAILABLE,
  bugsAvailable: BUGS_AVAILABLE, loadError: ENGINE_ERROR } = require("./engine");

const config = require("../config.json");
const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const SESSIONS_FILE = path.join(ROOT, "Database", "sessions.json");

const SESSION_MAX_AGE = (config.security && config.security.sessionMaxAgeMs) || 2592000000;
const MAX_AVATAR_BYTES = (config.panel && config.panel.maxAvatarBytes) || 2097152;

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAGIC = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png":  [[0x89, 0x50, 0x4e, 0x47]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // "RIFF"
};

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
ensureDir(UPLOADS_DIR);

/**
 * Owner links are rendered straight into `href`. Only http(s) is allowed so a
 * hand-edited owner.json entry such as "javascript:..." cannot run script in
 * the panel's origin, where the session cookie lives.
 */
function safeUrl(value) {
  const s = String(value == null ? "" : value).trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) return "";
  return s;
}

/* ── session store (persisted → survives browser reopen & restart) ── */
function loadSessions() {
  try { return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8")); } catch { return {}; }
}
function saveSessions(sessions) {
  ensureDir(path.dirname(SESSIONS_FILE));
  // atomic write — a truncated sessions.json logs every user out
  const tmp = `${SESSIONS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2), "utf8");
  fs.renameSync(tmp, SESSIONS_FILE);
}

/* ── session entries: { username, expiresAt } ─────────────────────── */
// Older installs stored a bare username string; normalise both shapes so an
// upgrade does not log everyone out.
function normalizeSession(entry) {
  if (typeof entry === "string") return { username: entry, expiresAt: null };
  if (entry && typeof entry === "object" && entry.username)
    return { username: entry.username, expiresAt: entry.expiresAt || null };
  return null;
}

// prune expired session tokens hourly so the store cannot grow forever
const sessionSweep = setInterval(() => {
  try {
    const sessions = loadSessions();
    const now = Date.now();
    let changed = false;
    for (const [token, raw] of Object.entries(sessions)) {
      const e = normalizeSession(raw);
      if (!e || (e.expiresAt && now > e.expiresAt)) { delete sessions[token]; changed = true; }
    }
    if (changed) saveSessions(sessions);
  } catch { /* never let the sweeper crash the server */ }
}, 3600000);
if (sessionSweep.unref) sessionSweep.unref();

function currentUser(req) {
  const token = req.cookies && req.cookies.cipher_session;
  if (!token) return null;
  const sessions = loadSessions();
  const entry = normalizeSession(sessions[token]);
  if (!entry) return null;
  // enforce expiry server-side; the cookie is only a hint
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    delete sessions[token];
    saveSessions(sessions);
    return null;
  }
  const user = db.findUserBy("username", entry.username);
  if (!user) return null;
  if (user.banned) { delete sessions[token]; saveSessions(sessions); return null; }
  if (user.expired && user.expired !== true && Date.now() > user.expired) return null;
  return user;
}

/* ── pairing ownership helper ─────────────────────────────────────── */
// registerPairingRequest() keys requests by username, so a user owns a
// number only if their own request for it exists in the registry.
function ownsPairingRequest(user, number) {
  if (!user) return false;
  try {
    const reg = db.getPairingRegistry();
    return (reg.requests || []).some(r =>
      r.userId === user.username && r.number === number);
  } catch { return false; }
}
function linkPairingNumber(user, number) {
  if (!user) return;
  const users = db.getUsers();
  const idx = users.findIndex(u => u.username === user.username);
  if (idx === -1) return;
  users[idx].pairedNumber = number;
  users[idx].pairedAt = Date.now();
  db.saveUsers(users);
}

/* ── cookie options ───────────────────────────────────────────────── */
function cookieOptions(req, maxAge) {
  const https = req.secure || req.headers["x-forwarded-proto"] === "https";
  return {
    maxAge,
    httpOnly: true,
    sameSite: "lax",
    secure: !!https,          // HTTPS-only when served over TLS
    path: "/",
  };
}

/* ── login helper (password OR legacy ckey key) ───────────────────── */
function verifyLogin(user, password) {
  if (user.passwordHash && user.salt) {
    return sec.verifyPassword(password, user.salt, user.passwordHash);
  }
  // Legacy account created via /ckey — the stored `key` is the password.
  return user.key ? sec.safeEqual(String(user.key), String(password)) : false;
}

/* ── rate limiting (simple in-memory token bucket per IP) ─────────── */
const hits = new Map();

// prune expired buckets so the map cannot grow without bound
const pruneTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of hits) if (now > rec.reset) hits.delete(ip);
}, 300000);
if (pruneTimer.unref) pruneTimer.unref();

function makeLimiter(windowMs, max) {
  const buckets = new Map();
  return function limiter(req, res, next) {
    const ip = req.ip || "0";
    const now = Date.now();
    const rec = buckets.get(ip) || { count: 0, reset: now + windowMs };
    if (now > rec.reset) { rec.count = 0; rec.reset = now + windowMs; }
    rec.count++;
    buckets.set(ip, rec);
    if (rec.count > max) {
      res.set("Retry-After", String(Math.ceil((rec.reset - now) / 1000)));
      return res.status(429).json({ ok: false, error: "Too many requests. Slow down." });
    }
    next();
  };
}

function rateLimit(req, res, next) {
  const ip = req.ip || "0";
  const now = Date.now();
  const lim = (config.security && config.security.rateLimit) || { windowMs: 60000, max: 120 };
  const rec = hits.get(ip) || { count: 0, reset: now + lim.windowMs };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + lim.windowMs; }
  rec.count++;
  hits.set(ip, rec);
  if (rec.count > lim.max) return res.status(429).json({ ok: false, error: "Too many requests. Slow down." });
  next();
}

// credential endpoints get a much tighter budget: 10 attempts / 10 minutes
const authLimit = makeLimiter(600000, 10);

function attachRoutes(app, { bot } = {}) {
  const botRef = bot || null;

  app.use(rateLimit);

  /* ── static pages ───────────────────────────────────────────────── */
  // "/" always serves the splash; it resolves the destination itself
  // from the session cookie, so every visitor sees the intro animation.
  app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  const servePage = (file) => (req, res) => res.sendFile(path.join(PUBLIC_DIR, file));

  app.get("/login.html",    servePage("login.html"));
  app.get("/register.html", servePage("register.html"));
  app.get("/pair.html",     servePage("pair.html"));
  app.get("/cmd.html",      servePage("cmd.html"));
  app.get("/owner.html",    servePage("owner.html"));
  app.get("/profile.html",  servePage("profile.html"));
  app.get("/favicon.ico",   (req, res) => res.status(204).end());

  /* ── auth ───────────────────────────────────────────────────────── */
  app.get("/api/session", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.json({ ok: false, loggedIn: false });
    res.json({ ok: true, loggedIn: true, user: sec.toPublicUser(user) });
  });

  app.post("/api/register", authLimit, (req, res) => {
    const { username, email, password } = req.body || {};
    const uname = String(username || "").trim();
    const mail  = String(email || "").trim().toLowerCase();
    const pass  = String(password || "");

    if (!uname || uname.length < 3 || uname.length > 24)
      return res.status(400).json({ ok: false, error: "Username must be 3-24 characters." });
    if (!/^[a-zA-Z0-9_.-]+$/.test(uname))
      return res.status(400).json({ ok: false, error: "Username: letters, numbers, _ and . only." });
    // email is optional at signup; validate only when provided
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))
      return res.status(400).json({ ok: false, error: "Enter a valid email address." });
    if (!pass || pass.length < 6)
      return res.status(400).json({ ok: false, error: "Password must be at least 6 characters." });

    const users = db.getUsers();
    if (users.some(u => u.username.toLowerCase() === uname.toLowerCase()))
      return res.status(409).json({ ok: false, error: "Username already taken." });
    if (mail && users.some(u => u.email && u.email.toLowerCase() === mail))
      return res.status(409).json({ ok: false, error: "Email already registered." });

    const uid = db.generateUID();
    if (!uid) return res.status(500).json({ ok: false, error: "Could not allocate a UID. Try again." });

    const { salt, hash } = sec.hashPassword(pass);
    const user = {
      uid,
      username: uname,
      email: mail,
      salt,
      passwordHash: hash,
      avatar: null,
      createdAt: Date.now(),
      status: "active",
      banned: false,
      premium: { active: false, activatedAt: null, expiresAt: null, type: null, activatedBy: null },
      pairedNumber: null,
      pairedAt: null,
      role: "Member",
    };
    users.push(user);
    db.saveUsers(users);
    db.logAudit({ event: "account.register", uid, username: uname });

    const token = sec.createSessionToken();
    const sessions = loadSessions();
    sessions[token] = { username: uname, expiresAt: Date.now() + SESSION_MAX_AGE };
    saveSessions(sessions);
    res.cookie("cipher_session", token, cookieOptions(req, SESSION_MAX_AGE));
    res.json({ ok: true, uid, username: uname, user: sec.toPublicUser(user) });
  });

  app.post("/api/login", authLimit, (req, res) => {
    const { username, password, remember } = req.body || {};
    const uname = String(username || "").trim();
    const pass  = String(password || "");
    if (!uname || !pass) return res.status(400).json({ ok: false, error: "Fill in all fields." });

    const user = db.findUserBy("username", uname) ||
      db.getUsers().find(u => u.email && u.email.toLowerCase() === uname.toLowerCase());
    if (!user) return res.status(401).json({ ok: false, error: "Invalid username or password." });
    if (!verifyLogin(user, pass)) return res.status(401).json({ ok: false, error: "Invalid username or password." });

    if (user.banned) return res.status(403).json({ ok: false, error: "This account has been suspended." });
    if (user.expired && user.expired !== true && Date.now() > user.expired)
      return res.status(403).json({ ok: false, error: "Your key has expired. Contact admin." });

    const token = sec.createSessionToken();
    const maxAge = remember ? SESSION_MAX_AGE : 7 * 24 * 3600000;
    const sessions = loadSessions();
    sessions[token] = { username: user.username, expiresAt: Date.now() + maxAge };
    saveSessions(sessions);
    res.cookie("cipher_session", token, cookieOptions(req, maxAge));
    res.json({ ok: true, user: sec.toPublicUser(user) });
  });

  app.post("/api/logout", (req, res) => {
    const token = req.cookies && req.cookies.cipher_session;
    if (token) {
      const sessions = loadSessions();
      delete sessions[token];
      saveSessions(sessions);
    }
    // path must match the one used when setting the cookie, or some
    // browsers keep the old cookie in place
    res.clearCookie("cipher_session", { path: "/", httpOnly: true, sameSite: "lax" });
    res.json({ ok: true });
  });

  /* ── profile ────────────────────────────────────────────────────── */
  app.get("/api/profile", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const publicUser = sec.toPublicUser(user);
    publicUser.email = user.email;
    publicUser.premium = user.premium || { active: false };
    publicUser.pairedNumber = user.pairedNumber || null;
    publicUser.paired = !!user.pairedNumber;
    publicUser.role = user.role || "Member";
    publicUser.createdAt = user.createdAt || null;
    res.json({ ok: true, user: publicUser });
  });

  app.post("/api/profile/update", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const { username, email } = req.body || {};
    const uname = String(username || "").trim();
    if (!uname || uname.length < 3 || uname.length > 24)
      return res.status(400).json({ ok: false, error: "Username must be 3-24 characters." });
    if (!/^[a-zA-Z0-9_.-]+$/.test(uname))
      return res.status(400).json({ ok: false, error: "Username: letters, numbers, _ and . only." });

    const mail = email == null ? null : String(email).trim().toLowerCase();
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))
      return res.status(400).json({ ok: false, error: "Enter a valid email address." });

    const users = db.getUsers();
    if (users.some(u => u.username.toLowerCase() === uname.toLowerCase() && u.username !== user.username))
      return res.status(409).json({ ok: false, error: "Username already taken." });
    if (mail && users.some(u => u.email && u.email.toLowerCase() === mail && u.username !== user.username))
      return res.status(409).json({ ok: false, error: "Email already registered." });

    const idx = users.findIndex(u => u.username === user.username);
    users[idx].username = uname;
    if (mail !== null) users[idx].email = mail;
    db.saveUsers(users);

    // refresh session key (username changed)
    const token = req.cookies.cipher_session;
    const sessions = loadSessions();
    const entry = normalizeSession(sessions[token]);
    if (entry && entry.username === user.username) {
      sessions[token] = { username: uname, expiresAt: entry.expiresAt };
    }
    saveSessions(sessions);

    res.json({ ok: true, user: sec.toPublicUser(users[idx]) });
  });

  app.post("/api/profile/password", authLimit, (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword)
      return res.status(400).json({ ok: false, error: "Missing old or new password." });
    if (newPassword.length < 6)
      return res.status(400).json({ ok: false, error: "New password must be at least 6 characters." });
    if (!verifyLogin(user, oldPassword))
      return res.status(403).json({ ok: false, error: "Old password is incorrect." });

    const users = db.getUsers();
    const idx = users.findIndex(u => u.username === user.username);
    const { salt, hash } = sec.hashPassword(newPassword);
    users[idx].salt = salt;
    users[idx].passwordHash = hash;
    users[idx].key = undefined; // migrate away from legacy plaintext key
    db.saveUsers(users);
    db.logAudit({ event: "account.password_change", uid: user.uid, username: user.username });
    res.json({ ok: true, message: "Password changed successfully." });
  });

  /* ── avatar upload (base64 JSON body, validated) ────────────────── */
  app.post("/api/profile/avatar", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { data, mime } = req.body || {};
    if (!data || !mime) return res.status(400).json({ ok: false, error: "Missing image data." });
    if (!ALLOWED_AVATAR_TYPES.includes(mime))
      return res.status(400).json({ ok: false, error: "Only JPG, PNG or WebP images are allowed." });

    let buf;
    try { buf = Buffer.from(data, "base64"); } catch { return res.status(400).json({ ok: false, error: "Invalid image data." }); }
    if (buf.length === 0 || buf.length > MAX_AVATAR_BYTES)
      return res.status(400).json({ ok: false, error: `Image must be 1 byte..${Math.floor(MAX_AVATAR_BYTES / 1024)} KB.` });

    // magic bytes check — prevents renamed executables
    const magicMatch = (MAGIC[mime] || []).some(sig =>
      sig.every((b, i) => buf[i] === b)
    );
    if (!magicMatch) return res.status(400).json({ ok: false, error: "File does not look like an image." });

    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mime];
    const filename = `avatar-${user.uid}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
    // delete old avatars for this user
    try {
      fs.readdirSync(UPLOADS_DIR).filter(f => f.startsWith(`avatar-${user.uid}-`)).forEach(f => {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, f)); } catch {}
      });
    } catch {}
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);

    const users = db.getUsers();
    const idx = users.findIndex(u => u.username === user.username);
    users[idx].avatar = filename;
    db.saveUsers(users);
    res.json({ ok: true, avatar: filename });
  });

  app.get("/api/profile/avatar/:file", (req, res) => {
    const file = String(req.params.file || "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!file || !/^avatar-\d+-[a-f0-9]+\.(jpg|png|webp)$/.test(file))
      return res.status(400).json({ ok: false, error: "Invalid avatar file." });
    const fp = path.join(UPLOADS_DIR, file);
    if (!fs.existsSync(fp)) return res.status(404).json({ ok: false, error: "Not found." });
    const type = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
    res.set("Cache-Control", "public, max-age=3600");
    res.type(type);
    res.sendFile(fp);
  });

  /* ── engine health (shown in the UI when pairing is unavailable) ── */
  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      engine: ENGINE_AVAILABLE ? "ready" : "unavailable",
      pairing: PAIRING_AVAILABLE ? "ready" : "unavailable",
      cmd: BUGS_AVAILABLE ? "ready" : "unavailable",
      engineError: ENGINE_AVAILABLE ? null : ENGINE_ERROR,
      bot: botRef ? "running" : "offline",
      sessions: ENGINE_AVAILABLE ? wa.sessions.size : 0,
      uptime: Math.floor(process.uptime()),
    });
  });

  /* ── pairing (ported API surface) ───────────────────────────────── */
  app.get("/api/pair/code", async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const number = wa.normalizePhoneNumber(req.query.number);
    if (!number || number.length < 7 || number.length > 15)
      return res.status(400).json({ ok: false, error: "Invalid number. Use +92 300 1234567 or a full international number." });
    // pairing depends on the WhatsApp session layer only
    if (!PAIRING_AVAILABLE)
      return res.status(503).json({ ok: false, error: ENGINE_ERROR || "WhatsApp engine unavailable.", code: "NO_ENGINE" });

    // a number already linked to a *different* account can't be re-claimed
    const isAdminUser = ["Owner", "Admin"].includes(user.role || "") ||
      db.isOwner(user.uid) || db.isOwner(user.username);
    if (!isAdminUser) {
      const taken = db.getUsers().find(u =>
        u.pairedNumber === number && u.username !== user.username);
      if (taken)
        return res.status(409).json({ ok: false, error: "This number is already linked to another account." });
    }

    if (wa.isPairingStarting && wa.isPairingStarting(number))
      return res.status(409).json({ ok: false, error: "Pairing is already starting for this number. Wait for the code or try again shortly." });
    db.registerPairingRequest(user.username, number);

    try {
      const code = await wa.requestPairCode(number);
      db.updatePairingStatus(number, "code-sent");
      return res.json({ ok: true, code, number, requestId: db.getPairingRegistry().requests.find(r => r.number === number)?.requestId });
    } catch (err) {
      db.updatePairingStatus(number, "failed");
      const conflict = /already connected|already in progress|already being started/i.test(err.message);
      return res.status(conflict ? 409 : 500).json({ ok: false, error: err.message });
    }
  });

  app.get("/api/pair/wait/:number", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const number = wa.normalizePhoneNumber(req.params.number);
    if (!number) return res.status(400).json({ ok: false, error: "Missing number" });
    if (!PAIRING_AVAILABLE)
      return res.status(503).json({ ok: false, error: ENGINE_ERROR || "WhatsApp engine unavailable.", code: "NO_ENGINE" });
    // only the account that requested this number may wait on it
    const isAdminWait = ["Owner", "Admin"].includes(user.role || "") ||
      db.isOwner(user.uid) || db.isOwner(user.username);
    if (!isAdminWait && !ownsPairingRequest(user, number))
      return res.status(403).json({ ok: false, error: "No pairing request for this number." });

    const timeoutMs = (config.panel && config.panel.pairingWaitMs) || 90000;
    const cancel = wa.waitForConnection(number, timeoutMs, (err, result) => {
      if (result && result.connected) {
        db.updatePairingStatus(number, "connected");
        linkPairingNumber(user, number);
      } else if (result && result.error) {
        db.updatePairingStatus(number, "failed");
      }
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json(result);
    });
    res.on("close", cancel);
  });

  app.get("/api/pair/status/:number", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const number = wa.normalizePhoneNumber(req.params.number);
    if (!number) return res.status(400).json({ ok: false, error: "Missing number" });
    const isAdmin = ["Owner", "Admin"].includes(user.role || "") ||
      db.isOwner(user.uid) || db.isOwner(user.username);
    // a user may only poll the number they requested or already own
    if (!isAdmin && user.pairedNumber !== number && !ownsPairingRequest(user, number))
      return res.status(403).json({ ok: false, error: "Forbidden" });
    const connected = wa.sessions.has(number);
    if (connected) {
      db.updatePairingStatus(number, "connected");
      linkPairingNumber(user, number);
    }
    const status = connected ? "connected" : (db.getPairingStatus(number) || "pending");
    const error = connected ? null : (wa.getPairingFailure ? wa.getPairingFailure(number) : null);
    res.json({ ok: true, connected, number, total: wa.sessions.size, status, error });
  });

  app.get("/api/pair/list", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const isAdmin = ["Owner", "Admin"].includes(user.role || "") ||
      db.isOwner(user.uid) || db.isOwner(user.username);
    // regular users only see their own linked device
    const list = isAdmin
      ? [...wa.sessions.keys()].map(num => ({ number: num, status: "connected", connected: true }))
      : (user.pairedNumber && wa.sessions.has(user.pairedNumber)
          ? [{ number: user.pairedNumber, status: "connected", connected: true }]
          : []);
    res.json({ ok: true, sessions: list, total: list.length });
  });

  app.delete("/api/pair/delete", async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const number = wa.normalizePhoneNumber(req.query.number);
    if (!number) return res.status(400).json({ ok: false, error: "Missing number" });

    const isAdmin = ["Owner", "Admin"].includes(user.role || "") ||
      db.isOwner(user.uid) || db.isOwner(user.username);
    if (!isAdmin && user.pairedNumber !== number)
      return res.status(403).json({ ok: false, error: "You can only remove your own paired device." });

    try {
      if (wa.cancelPairing) wa.cancelPairing(number, "Pairing cancelled because the session was removed.");
      if (wa.reconnectTimers.has(number)) {
        clearTimeout(wa.reconnectTimers.get(number));
        wa.reconnectTimers.delete(number);
      }
      if (wa.sessions.has(number)) {
        try { wa.sessions.get(number).end(); } catch {}
        wa.sessions.delete(number);
      }
      db.delActive(number);
      wa.wipeDir(number);
      db.updatePairingStatus(number, "cancelled");

      // clear the link from the account that owned it
      const users = db.getUsers();
      let changed = false;
      users.forEach(u => {
        if (u.pairedNumber === number) { u.pairedNumber = null; u.pairedAt = null; changed = true; }
      });
      if (changed) db.saveUsers(users);

      res.json({ ok: true, message: `Session ${number} removed.` });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  /* ── CMD terminal ───────────────────────────────────────────────── */
  app.get("/api/cmd/list", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const all = db.getCommands();
    const isAdmin = ["Owner", "Admin"].includes(user.role || "") ||
      db.isOwner(user.uid) || db.isOwner(user.username);
    // admin-only commands are hidden from non-admins so the UI matches
    // what the server will actually allow
    const list = all.filter(c => c.level !== "admin" || isAdmin);
    res.json({ ok: true, commands: list });
  });

  app.post("/api/cmd/execute", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    if (user.banned) return res.status(403).json({ ok: false, error: "Account suspended." });

    const { command } = req.body || {};
    const raw = String(command || "").trim();
    if (!raw.startsWith("/")) return res.status(400).json({ ok: false, error: "Commands start with /" });
    const [name, ...rest] = raw.slice(1).split(/\s+/);
    const target = rest.join("").trim();

    // read fresh on every request so a Telegram level change applies at once
    const registry = db.getCommands();
    const def = registry.find(c => c.name === name);
    if (!def) return res.status(404).json({ ok: false, error: `Unknown command: /${name}` });

    // admin status = role flag on the account, or the caller's Telegram ID
    // being listed in Database/akses.json owners
    const isAdmin = ["Owner", "Admin"].includes(user.role || "") ||
      db.isOwner(user.uid) || db.isOwner(user.username);

    if (def.level === "admin" && !isAdmin)
      return res.status(403).json({ ok: false, error: "This command requires administrator access." });

    if (def.level === "premium" && !db.isPremium(user))
      return res.status(403).json({ ok: false, error: "This command requires an active premium membership." });

    if (["delay", "invis", "blank", "blank-ios", "fc", "group-delay", "group-blank", "group-invis", "group-ban"].includes(name)) {
      if (!BUGS_AVAILABLE)
        return res.status(503).json({ ok: false, error: ENGINE_ERROR || "WhatsApp engine unavailable.", code: "NO_ENGINE" });
      if (!user.pairedNumber)
        return res.status(403).json({ ok: false, error: "Your account is not connected yet. Please pair your phone number first to access CMD features." });
      if (!target) return res.status(400).json({ ok: false, error: `Usage: /${name} <target>` });
      if (wa.sessions.size === 0)
        return res.status(503).json({ ok: false, error: "No active WhatsApp session. Contact admin.", code: "NO_SESSION" });

      const targetJid = def.level === "admin" || name.startsWith("group-")
        ? (/^\d+$/.test(target) ? `${target}@g.us` : target)
        : (/^\d+$/.test(target) ? `${target}@s.whatsapp.net` : target);

      // fireBug now returns a promise, so failures surface as real errors
      bugs.fireBug(name, targetJid)
        .then(() => {
          db.logAudit({ event: "cmd.execute", username: user.username, uid: user.uid, command: raw, target });
          if (!res.headersSent)
            res.json({ ok: true, command: raw, message: `Mode: ${name.toUpperCase()} launched.` });
        })
        .catch(err => {
          if (!res.headersSent)
            res.status(500).json({ ok: false, error: err.message || "Payload failed to launch." });
        });
      return;
    }

    // informational commands
    if (name === "help" || name === "cmdlist") {
      return res.json({ ok: true, command: raw, message: registry.map(c =>
        `${c.name} — ${c.description} [${c.level}]`).join("\n") });
    }
    if (name === "pair") {
      return res.json({ ok: true, command: raw, message: user.pairedNumber
        ? `Paired: ${user.pairedNumber}` : "Not paired. Visit the PAIR section to connect your number." });
    }
    if (name === "status") {
      return res.json({ ok: true, command: raw, message: `Sessions: ${wa.sessions.size} | Premium: ${db.isPremium(user) ? "ACTIVE" : "INACTIVE"} | Paired: ${user.pairedNumber ? "YES" : "NO"}` });
    }
    if (name === "profile") {
      return res.json({ ok: true, command: raw, message: `UID: ${user.uid} | User: ${user.username} | Role: ${user.role || "Member"}` });
    }

    return res.status(404).json({ ok: false, error: `Unknown command: /${name}` });
  });

  /* ── owner info ─────────────────────────────────────────────────── */
  app.get("/api/owner", (req, res) => {
    try {
      const data = require(path.join(ROOT, "Database", "owner.json"));
      const raw = data.owner || null;

      // Only forward the fields the page renders, with http(s)-only links.
      const owner = raw ? {
        name: raw.name || null,
        description: raw.description || null,
        avatar: raw.avatar || null,
        telegram: safeUrl(raw.telegram),
        channel: safeUrl(raw.channel),
        whatsapp: safeUrl(raw.whatsapp),
        github: safeUrl(raw.github),
        youtube: safeUrl(raw.youtube),
        website: safeUrl(raw.website),
        other: Array.isArray(raw.other)
          ? raw.other
              .filter((o) => o && safeUrl(o.url))
              .map((o) => ({ label: o.label || "Link", url: safeUrl(o.url) }))
          : [],
      } : null;

      const pc = data.premiumChannel || null;

      res.json({
        ok: true,
        owner,
        premiumChannel: pc && safeUrl(pc.url) ? { url: safeUrl(pc.url), label: pc.label || null } : null,
      });
    } catch {
      res.json({ ok: true, owner: null, premiumChannel: null });
    }
  });

  /* ── stats (used by CMD & dashboard bits) ───────────────────────── */
  app.get("/api/stats", (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    res.json({
      ok: true,
      activeSenders: wa.sessions.size,
      totalUsers: db.getUsers().length,
      botOnline: !!(botRef) && wa.sessions.size > 0,
      sessions: wa.sessions.size,
      engine: ENGINE_AVAILABLE ? "ready" : "unavailable",
      pairing: PAIRING_AVAILABLE ? "ready" : "unavailable",
      cmd: BUGS_AVAILABLE ? "ready" : "unavailable",
    });
  });

  /* ── JSON 404 for unmatched routes (must precede the error handler) ─ */
  app.use((req, res) => {
    if (req.path.startsWith("/api/"))
      return res.status(404).json({ ok: false, error: "Unknown endpoint." });
    res.status(404).send("Not found");
  });

  /* ── error handler ──────────────────────────────────────────────── */
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("[routes]", err);
    if (res.headersSent) return;
    // body-parser failures must not return HTML to a fetch() caller
    if (err.type === "entity.too.large")
      return res.status(413).json({ ok: false, error: "Upload too large. Maximum is 2 MB." });
    if (err.type === "entity.parse.failed" || err instanceof SyntaxError)
      return res.status(400).json({ ok: false, error: "Malformed request body." });
    res.status(500).json({ ok: false, error: "Internal server error." });
  });
}

module.exports = { attachRoutes, currentUser };
