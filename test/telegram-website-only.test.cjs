"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const ownerId = "123456789";
const dbStub = {
  isOwner: id => String(id) === ownerId,
  isAuthorized: () => false,
  isPairOnly: () => false,
  isModerator: () => false,
  isPT: () => false,
  isReseller: () => false,
  loadAkses: () => ({ owners: [], pairOnly: [], akses: [] }),
};
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === "./database" && parent && parent.filename.endsWith(`${require("node:path").sep}backend${require("node:path").sep}telegram.js`)) return dbStub;
  if (request === "./commandAdmin" && parent && parent.filename.endsWith(`${require("node:path").sep}backend${require("node:path").sep}telegram.js`)) return { registerCommandAdmin() {} };
  if (request === "./engine" && parent && parent.filename.endsWith(`${require("node:path").sep}backend${require("node:path").sep}telegram.js`)) return { wa: {}, bugs: {}, available: false, loadError: "test" };
  return originalLoad.call(this, request, parent, isMain);
};
let registerBot;
try {
  ({ registerBot } = require("../backend/telegram"));
} finally {
  Module._load = originalLoad;
}

class FakeBot {
  constructor() { this.middleware = []; }
  use(fn) { this.middleware.push(fn); }
  command() {}
  on() {}
}

test("Telegram number pairing commands and stale connector buttons are blocked", async () => {
  const bot = new FakeBot();
  registerBot(bot, { ownerId });
  assert.equal(bot.middleware.length, 1);
  const gate = bot.middleware[0];

  let commandNext = false;
  const replies = [];
  await gate({
    from: { id: Number(ownerId) },
    chat: { id: Number(ownerId), type: "private" },
    message: { text: "/addbot +923001234567" },
    reply: async text => replies.push(text),
  }, async () => { commandNext = true; });
  assert.equal(commandNext, false);
  assert.match(replies[0], /sirf website/i);

  let callbackNext = false;
  const alerts = [];
  await gate({
    from: { id: Number(ownerId) },
    chat: { id: Number(ownerId), type: "private" },
    callbackQuery: { data: "wa:add" },
    answerCbQuery: async text => alerts.push(text),
  }, async () => { callbackNext = true; });
  assert.equal(callbackNext, false);
  assert.match(alerts[0], /website/i);
});
