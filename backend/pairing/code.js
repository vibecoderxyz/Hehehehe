"use strict";
const crypto = require("crypto");

// WhatsApp/Baileys custom pairing codes must be exactly eight characters.
// Crockford's alphabet avoids ambiguous I, L, O and U characters, making the
// code easier to read and type on a phone. A fresh code is generated per
// pairing request; codes are never shared between two numbers.
const PAIRING_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PAIRING_CODE_LENGTH = 8;

function generateWebsitePairingCode() {
  const bytes = crypto.randomBytes(PAIRING_CODE_LENGTH);
  let code = "";
  for (const byte of bytes) code += PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length];
  return code;
}

/** Ask Baileys for a website-only linked-device code. */
async function requestWebsitePairingCode(sock, phoneNumber) {
  const requestedCode = generateWebsitePairingCode();
  const raw = await sock.requestPairingCode(phoneNumber, requestedCode);
  const compact = String(raw || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (compact.length !== PAIRING_CODE_LENGTH)
    throw new Error("WhatsApp returned an invalid pairing code. Please request a new code.");
  return compact;
}

module.exports = {
  PAIRING_ALPHABET,
  PAIRING_CODE_LENGTH,
  generateWebsitePairingCode,
  requestWebsitePairingCode,
};
