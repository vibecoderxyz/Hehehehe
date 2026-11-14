"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const EventEmitter = require("node:events");
const Module = require("node:module");

const testNumber = "9990000000000";
const authDir = path.join(__dirname, "..", "Database", "whatsapp-auth", `device${testNumber}`);
let requestArgs = [];

const databaseStub = {
  updatePairingStatus() {}, saveActive() {}, delActive() {},
  getUsers() { return []; }, saveUsers() {},
  registerPairingRequest() {}, getPairingRegistry() { return { requests: [] }; },
};
const baileysStub = {
  default() {
    const ev = new EventEmitter();
    // Simulate Baileys emitting before wa.js subscribes to connection.update.
    ev.emit("connection.update", { connection: "connecting" });
    return {
      ev,
      requestPairingCode: async (...args) => { requestArgs.push(args); return args[1] || "RANDOM12"; },
      end() {},
      sendPresenceUpdate: async () => {},
    };
  },
  useMultiFileAuthState: async () => ({
    state: { creds: { registered: false }, keys: {} },
    saveCreds() {},
  }),
  DisconnectReason: {
    restartRequired: 515, connectionClosed: 428, connectionLost: 408,
    timedOut: 408, loggedOut: 401, badSession: 500, connectionReplaced: 440,
  },
  makeCacheableSignalKeyStore: null,
  generateWAMessageFromContent() {},
  fetchLatestBaileysVersion: async () => ({ version: [2, 3000, 1] }),
  Browsers: { ubuntu: () => ["Ubuntu", "Chrome", ""] },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "@whiskeysockets/baileys") return baileysStub;
  if (request === "./database" && parent && parent.filename.endsWith(`${path.sep}backend${path.sep}wa.js`)) return databaseStub;
  return originalLoad.call(this, request, parent, isMain);
};
let wa;
try {
  wa = require("../backend/wa");
} finally {
  Module._load = originalLoad;
}

test("normalizes Pakistani local/international phone inputs", () => {
  assert.equal(wa.normalizePhoneNumber("0300 1234567"), "923001234567");
  assert.equal(wa.normalizePhoneNumber("+92 300 1234567"), "923001234567");
  assert.equal(wa.normalizePhoneNumber("0092-300-1234567"), "923001234567");
});

test("requests the custom CIPHER12 code if the initial connecting event was missed", async () => {
  assert.equal(fs.existsSync(authDir), false, "reserved test auth folder must not already exist");
  requestArgs = [];
  try {
    const code = await wa.requestPairCode(testNumber);
    assert.equal(code, "CIPHER12");
    assert.deepEqual(requestArgs, [[testNumber, "CIPHER12"]]);
  } finally {
    wa.cancelPairing(testNumber, "Regression test cleanup.");
    fs.rmSync(authDir, { recursive: true, force: true });
  }
});
