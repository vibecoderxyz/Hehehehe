/**
 * CIPHER BVG — runtime configuration
 *
 * Every sensitive value can come from an environment variable, so the same
 * code deploys to Katabump / Railway / Pterodactyl / a plain VPS without
 * editing files. Env vars always win over the literals below.
 *
 *   BOT_TOKEN     Telegram bot token from @BotFather
 *   OWNER_ID      your numeric Telegram user id
 *   PORT          http(s) port to listen on (Railway/Pterodactyl inject this)
 *   BANNER_TELEGRAM  optional photo for the bot's /start command
 *
 * A local .env file (see .env.example) is read on boot for convenience.
 * Real environment variables always take precedence over .env values, so a
 * platform that injects vars (Railway, Pterodactyl) is never overridden.
 */
const fs = require("fs");
const path = require("path");

/* Minimal .env reader — avoids a dependency for one small task.
 * Supports KEY=value, optional quotes, # comments and blank lines. */
(function loadDotEnv() {
  try {
    const file = path.join(__dirname, "..", ".env");
    if (!fs.existsSync(file)) return;
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // never clobber a value the process already has
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* a broken .env must never stop the server from booting */
  }
})();

const env = process.env;

module.exports = {
  // ← Your Telegram Bot Token (from @BotFather) or BOT_TOKEN env var
  tokens: env.BOT_TOKEN || "",

  // Telegram bot must fail closed unless the deployer configures its owner.
  owner: env.OWNER_ID || "",

  // Panel port. Railway/Pterodactyl set PORT automatically.
  port: env.PORT || "2024",

  // BANNER IMAGES
  // bannerTelegram is used by the bot's /start command and is the only
  // banner wired to an environment variable.
  bannerTelegram:  env.BANNER_TELEGRAM  || "https://files.catbox.moe/kei4t3.jpg", // /start photo in Telegram
  // Reserved: the web pages ship their own local Assets/ images instead,
  // so these two are currently not read anywhere. Kept for compatibility.
  bannerDashboard: env.BANNER_DASHBOARD || "https://files.catbox.moe/byhuj8.png", // unused
  bannerLogin:     env.BANNER_LOGIN     || "https://files.catbox.moe/8rl11w.jpeg", // unused
};
