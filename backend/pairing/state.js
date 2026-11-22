"use strict";

// Ephemeral pairing state shared by the WhatsApp socket lifecycle and the
// website pairing routes. Durable WhatsApp credentials remain in the private
// Database/whatsapp-auth directory because Baileys needs them to stay linked.
module.exports = {
  pendingCodes: new Map(),
  webPairingNumbers: new Set(),
  pairingSockets: new Map(),
  cancelledSockets: new WeakSet(),
  connectionStarts: new Map(),
  pairingFailures: new Map(),
};
