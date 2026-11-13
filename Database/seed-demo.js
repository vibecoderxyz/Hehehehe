/**
 * CIPHER BVG — seed-demo.js
 *
 * Creates (or refreshes) a single demo account so the panel can be browsed
 * without hosting anything, e.g. on localhost while developing the UI.
 *
 * The account is a normal "Member" with no premium, so it can never touch
 * premium-only commands. It is created ONLY when explicitly asked for:
 *
 *   node Database/seed-demo.js            → create / reset the demo account
 *   node Database/seed-demo.js --remove   → delete it again
 *
 * It is never created automatically at boot, so a production deployment does
 * not get a well-known password unless the operator runs this on purpose.
 */
// Loading config.js first runs its .env reader, so DEMO_* set in .env are
// visible to this script exactly like they are to the server. Without this
// require, `npm run demo` would ignore .env and always use the defaults.
require("./config.js");
const db = require("../backend/database");
const sec = require("../backend/security");

const DEMO_USERNAME = process.env.DEMO_USERNAME || "demo";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo1234";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@cipher.local";

function removeDemo() {
  const users = db.getUsers();
  const idx = users.findIndex(
    (u) => String(u.username).toLowerCase() === DEMO_USERNAME.toLowerCase()
  );
  if (idx === -1) {
    console.log(`[seed] no "${DEMO_USERNAME}" account to remove.`);
    return false;
  }
  const [gone] = users.splice(idx, 1);
  db.saveUsers(users);
  db.logAudit({ event: "account.demo_remove", uid: gone.uid, username: gone.username });
  console.log(`[seed] removed "${DEMO_USERNAME}" (uid ${gone.uid}).`);
  return true;
}

function seedDemo() {
  const users = db.getUsers();
  const idx = users.findIndex(
    (u) => String(u.username).toLowerCase() === DEMO_USERNAME.toLowerCase()
  );

  const { salt, hash } = sec.hashPassword(DEMO_PASSWORD);
  const base = {
    username: DEMO_USERNAME,
    email: DEMO_EMAIL,
    salt,
    passwordHash: hash,
    status: "active",
    banned: false,
    role: "Member",
    premium: {
      active: false,
      activatedAt: null,
      expiresAt: null,
      type: null,
      activatedBy: null,
    },
  };

  if (idx !== -1) {
    // Keep the UID stable so anything that referenced it keeps working.
    const existing = users[idx];
    users[idx] = { ...existing, ...base, uid: existing.uid };
    db.saveUsers(users);
    db.logAudit({ event: "account.demo_reset", uid: existing.uid, username: DEMO_USERNAME });
    console.log(`[seed] reset "${DEMO_USERNAME}" (uid ${existing.uid}).`);
    return existing.uid;
  }

  const uid = db.generateUID();
  if (!uid) {
    console.error("[seed] could not allocate a UID — is Database/user.json writable?");
    process.exitCode = 1;
    return null;
  }

  users.push({
    ...base,
    uid,
    avatar: null,
    createdAt: Date.now(),
    pairedNumber: null,
    pairedAt: null,
  });
  db.saveUsers(users);
  db.logAudit({ event: "account.demo_create", uid, username: DEMO_USERNAME });
  console.log(`[seed] created "${DEMO_USERNAME}" (uid ${uid}).`);
  return uid;
}

function main() {
  const remove = process.argv.includes("--remove");
  if (remove) {
    removeDemo();
    console.log("");
    console.log("Demo account removed.");
    return;
  }

  const uid = seedDemo();
  if (!uid) return;

  console.log("");
  console.log("  ── Demo login ────────────────────────────");
  console.log(`   Username : ${DEMO_USERNAME}`);
  console.log(`   Password : ${DEMO_PASSWORD}`);
  console.log(`   UID      : ${uid}`);
  console.log("  ──────────────────────────────────────────");
  console.log("   Role     : Member (no premium, no admin)");
  console.log("");
  console.log("   Remove it later with:");
  console.log("   node Database/seed-demo.js --remove");
  console.log("");
}

main();
