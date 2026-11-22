/**
 * CIPHER BVG — html.js
 *
 * Telegram's Bot API rejects a message with HTTP 400 when `parse_mode: "HTML"`
 * receives malformed markup, and it sends nothing. Any dynamic value that is
 * interpolated into a message — an OS error string, a username, a file path, a
 * command name typed by an admin — can contain `<`, `>` or `&` and break the
 * whole message.
 *
 * These failures are silent: the reply simply never arrives, and crash alerts
 * disappear into a `catch {}`. So every interpolated value is escaped here
 * first, in one place, instead of three slightly different copies.
 */

/** Replace the three characters that break Telegram's HTML parser. */
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = { escapeHtml };
