"use strict";

/**
 * Safe compatibility layer.
 *
 * The old implementation contained crash/spam payloads that could be used to
 * disrupt other WhatsApp accounts and groups. Production deployments must not
 * expose those operations. This module fails closed for older imports.
 */
const DISABLED_ERROR = "Destructive WhatsApp payload commands are disabled in this build.";
const BUG_MODES = Object.freeze({});
const fireBug = async () => { throw new Error(DISABLED_ERROR); };
const disabled = async () => { throw new Error(DISABLED_ERROR); };

module.exports = {
  available: false,
  BUG_MODES,
  fireBug,
  GetSuDelay: disabled,
  GetSuInvis: disabled,
  GetSuBlankAndro: disabled,
  GetSuBlankIOS: disabled,
  GetSuFC: disabled,
  GetSuGroupDelay: disabled,
  GetSuGroupBlank: disabled,
  GetSuGroupCrash: disabled,
  groupBanz: disabled,
};
