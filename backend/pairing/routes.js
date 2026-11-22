"use strict";

function rejectCrossSitePairingMutation(req, res, next) {
  const fetchSite = String(req.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site")
    return res.status(403).json({ ok: false, error: "Cross-site pairing requests are not allowed." });

  const source = req.get("origin") || req.get("referer");
  if (source) {
    try {
      const sourceOrigin = new URL(source).origin;
      const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
      const protocol = (req.secure || forwardedProto === "https") ? "https" : "http";
      if (sourceOrigin !== `${protocol}://${req.get("host")}`)
        return res.status(403).json({ ok: false, error: "Cross-site pairing requests are not allowed." });
    } catch {
      return res.status(403).json({ ok: false, error: "Invalid request origin." });
    }
  }
  return next();
}

function isAdminUser(user, db) {
  return ["Owner", "Admin"].includes(user.role || "") || db.isOwner(user.uid) || db.isOwner(user.username);
}

function ownsPairingRequest(user, number, db) {
  if (!user) return false;
  try {
    const registry = db.getPairingRegistry();
    return (registry.requests || []).some(r => r.userId === user.username && r.number === number);
  } catch { return false; }
}

function linkPairingNumber(user, number, db) {
  if (!user) return;
  const users = db.getUsers();
  const idx = users.findIndex(u => u.username === user.username);
  if (idx === -1) return;
  if (users[idx].pairedNumber === number) return;
  users[idx].pairedNumber = number;
  users[idx].pairedAt = Date.now();
  db.saveUsers(users);
}

function attachPairingRoutes(app, { wa, db, currentUser, pairingAvailable, engineError }) {
  app.get("/api/pair/code", rejectCrossSitePairingMutation, async (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const number = wa.normalizePhoneNumber(req.query.number);
    if (!number || number.length < 7 || number.length > 15)
      return res.status(400).json({ ok: false, error: "Invalid number. Use +92 300 1234567 or a full international number." });
    if (!pairingAvailable)
      return res.status(503).json({ ok: false, error: engineError || "WhatsApp engine unavailable.", code: "NO_ENGINE" });

    const isAdmin = isAdminUser(user, db);
    if (!isAdmin && db.getUsers().some(u => u.pairedNumber === number && u.username !== user.username))
      return res.status(409).json({ ok: false, error: "This number is already linked to another account." });
    if (wa.isPairingStarting && wa.isPairingStarting(number))
      return res.status(409).json({ ok: false, error: "Pairing is already starting for this number. Wait for the code or try again shortly." });

    db.registerPairingRequest(user.username, number);
    try {
      const code = await wa.requestPairCode(number);
      db.updatePairingStatus(number, "code-sent");
      const request = (db.getPairingRegistry().requests || []).find(r => r.number === number && r.userId === user.username);
      return res.json({ ok: true, code, number, requestId: request && request.requestId });
    } catch (err) {
      db.updatePairingStatus(number, "failed");
      const conflict = /already connected|already in progress|already being started/i.test(err.message);
      return res.status(conflict ? 409 : 500).json({ ok: false, error: err.message });
    }
  });

  app.get("/api/pair/status/:number", rejectCrossSitePairingMutation, (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const number = wa.normalizePhoneNumber(req.params.number);
    if (!number) return res.status(400).json({ ok: false, error: "Missing number" });
    if (!pairingAvailable)
      return res.status(503).json({ ok: false, error: engineError || "WhatsApp engine unavailable.", code: "NO_ENGINE" });

    const isAdmin = isAdminUser(user, db);
    if (!isAdmin && user.pairedNumber !== number && !ownsPairingRequest(user, number, db))
      return res.status(403).json({ ok: false, error: "Forbidden" });

    const connected = wa.sessions.has(number);
    if (connected) {
      db.updatePairingStatus(number, "connected");
      linkPairingNumber(user, number, db);
    }
    const status = connected ? "connected" : (db.getPairingStatus(number) || "pending");
    const error = connected ? null : (wa.getPairingFailure ? wa.getPairingFailure(number) : null);
    return res.json({ ok: true, connected, number, status, error });
  });
}

module.exports = { attachPairingRoutes };
