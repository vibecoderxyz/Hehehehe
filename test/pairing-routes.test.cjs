"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { attachPairingRoutes } = require("../backend/pairing/routes");

const number = "923001234567";
const user = { username: "alice", uid: "UID001", role: "Member", pairedNumber: null };
const routes = new Map();
const app = { get(path, ...handlers) { routes.set(path, handlers); } };
let requested = null;
let linkedUsers = [user];
let pairingStatus = "pending";
const db = {
  isOwner: () => false,
  getUsers: () => linkedUsers,
  saveUsers: users => { linkedUsers = users; },
  registerPairingRequest: (username, phone) => {
    db.request = { userId: username, number: phone, requestId: "REQ1" };
  },
  getPairingRegistry: () => ({ requests: db.request ? [db.request] : [] }),
  updatePairingStatus: (_phone, status) => { pairingStatus = status; },
  getPairingStatus: () => pairingStatus,
};
const sessions = new Map();
const wa = {
  normalizePhoneNumber: value => String(value || "").replace(/\D/g, "").replace(/^0/, "92"),
  isPairingStarting: () => false,
  requestPairCode: async phone => { requested = phone; return "CIPHER12"; },
  sessions,
  getPairingFailure: () => null,
};
attachPairingRoutes(app, {
  wa, db, currentUser: () => user, pairingAvailable: true, engineError: null,
});

function request(path, { query = {}, params = {}, origin = "https://site.test", site = "same-origin" } = {}) {
  const handlers = routes.get(path);
  assert.ok(handlers, `route is registered: ${path}`);
  const req = {
    query, params, secure: true,
    get(name) {
      return ({ "sec-fetch-site": site, origin, referer: "", "x-forwarded-proto": "https", host: "site.test" })[name.toLowerCase()] || "";
    },
  };
  const res = {
    code: 200, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let index = 0;
  const next = () => {
    index += 1;
    if (index < handlers.length) return handlers[index](req, res, next);
  };
  return Promise.resolve(handlers[0](req, res, next)).then(() => res);
}

test("only website pairing code and per-account status routes are registered", async () => {
  assert.deepEqual([...routes.keys()].sort(), ["/api/pair/code", "/api/pair/status/:number"]);
  const response = await request("/api/pair/code", { query: { number: "+92 300 1234567" } });
  assert.equal(response.code, 200);
  assert.equal(requested, number);
  assert.deepEqual(response.body, { ok: true, code: "CIPHER12", number, requestId: "REQ1" });
  assert.equal(pairingStatus, "code-sent");
});

test("cross-site code requests are rejected and a linked account receives connected status", async () => {
  const blocked = await request("/api/pair/code", { query: { number }, origin: "https://attacker.test", site: "cross-site" });
  assert.equal(blocked.code, 403);

  sessions.set(number, {});
  const status = await request("/api/pair/status/:number", { params: { number } });
  assert.equal(status.code, 200);
  assert.equal(status.body.connected, true);
  assert.equal(status.body.status, "connected");
  assert.equal(linkedUsers[0].pairedNumber, number);
});
