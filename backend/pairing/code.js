"use strict";

// The reference project's custom-code request flow, with the code explicitly
// requested for this website.
const WEBSITE_PAIRING_CODE = "CIPHER12";

/**
 * Ask WhatsApp/Baileys for a linked-device code. Website code uses the
 * reference project's exact custom value; Telegram is deliberately not an
 * allowed entry point for creating a number pairing.
 */
async function requestWebsitePairingCode(sock, phoneNumber) {
  const raw = await sock.requestPairingCode(phoneNumber, WEBSITE_PAIRING_CODE);
  const compact = String(raw || "").replace(/[^a-z0-9]/gi, "");
  return compact;
}

module.exports = { WEBSITE_PAIRING_CODE, requestWebsitePairingCode };
