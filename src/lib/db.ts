import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  Branding,
  CouponRecord,
  LinkRecord,
  UserRecord,
  VisitorLog,
} from "@/lib/types";

/**
 * Minimal JSON-file persistence layer.
 *
 * This keeps the recreation fully functional with zero external services.
 * For production / serverless deployments, swap the read()/write() helpers for
 * a real database client (the rest of the app only depends on this module).
 * See README "Production database" for the drop-in guidance.
 */

const DATA_DIR = path.resolve(process.env.SUPASHORT_DATA_DIR || ".data");

interface Shape {
  links: LinkRecord[];
  logs: VisitorLog[];
  users: UserRecord[];
  coupons: CouponRecord[];
  settings: Branding;
}

const DEFAULTS: Shape = {
  links: [],
  logs: [],
  users: [],
  coupons: defaultCoupons(),
  settings: defaultBranding(),
};

export function defaultBranding(): Branding {
  return {
    displayName: process.env.NEXT_PUBLIC_DEVELOPER_NAME || "Muhammad Saqib",
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME || "Saqib Visuals",
    avatarUrl:
      process.env.NEXT_PUBLIC_AVATAR_URL ||
      "https://ik.imagekit.io/mrsaqib/mrsaqib242-img25_7oG52NZUY.png",
  };
}

function defaultCoupons(): CouponRecord[] {
  return [
    { code: "VIP-2026", plan: "premium", days: 3650, max_uses: 100, uses: 0, active: true, note: "Lifetime VIP" },
    { code: "PRO-30D", plan: "premium", days: 30, max_uses: 500, uses: 0, active: true, note: "30 day Pro" },
    { code: "PRO-7D", plan: "premium", days: 7, max_uses: 500, uses: 0, active: true, note: "7 day Pro" },
  ];
}

let cache: Shape | null = null;
let writeChain: Promise<unknown> = Promise.resolve();

async function load(): Promise<Shape> {
  if (cache) return cache;
  await fs.mkdir(DATA_DIR, { recursive: true });
  const merged: Shape = { ...structuredClone(DEFAULTS) };
  for (const key of Object.keys(DEFAULTS) as (keyof Shape)[]) {
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, `${key}.json`), "utf8");
      const parsed = JSON.parse(raw);
      Object.assign(merged, { [key]: parsed ?? DEFAULTS[key] });
    } catch {
      Object.assign(merged, { [key]: structuredClone(DEFAULTS[key]) });
    }
  }
  cache = merged;
  return cache;
}

async function persist<K extends keyof Shape>(key: K): Promise<void> {
  const db = await load();
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${key}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db[key], null, 2), "utf8");
  await fs.rename(tmp, file);
}

/** Serialise writes so concurrent requests cannot interleave file writes. */
function mutate<K>(fn: (db: Shape) => K): Promise<K> {
  const run = writeChain.then(async () => {
    const db = await load();
    return fn(db);
  });
  writeChain = run.catch(() => undefined);
  return run;
}

export function newId(): string {
  return crypto.randomUUID();
}

function randomCode(len = 7): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/* ----------------------------- Links ----------------------------- */

export async function listLinks(filter: {
  deviceId?: string | null;
  phoneNumber?: string | null;
  userId?: string | null;
}): Promise<LinkRecord[]> {
  const db = await load();
  const rows = db.links.filter((l) => {
    if (filter.userId && l.user_id === filter.userId) return true;
    if (filter.deviceId && l.device_id === filter.deviceId) return true;
    if (filter.phoneNumber && l.phone_number === filter.phoneNumber) return true;
    return false;
  });
  if (!filter.userId && !filter.deviceId && !filter.phoneNumber) return [];
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getLinkByCode(code: string): Promise<LinkRecord | null> {
  const db = await load();
  return db.links.find((l) => l.short_code === code) ?? null;
}

export async function createLink(
  input: Omit<LinkRecord, "id" | "created_at" | "short_code"> & { short_code?: string },
): Promise<LinkRecord> {
  return mutate((db) => {
    let code = input.short_code || randomCode();
    if (db.links.some((l) => l.short_code === code)) {
      code = randomCode(9);
    }
    const record: LinkRecord = {
      ...input,
      id: newId(),
      short_code: code,
      created_at: new Date().toISOString(),
    };
    db.links.push(record);
    return record;
  }).then(async (record) => {
    await persist("links");
    return record as LinkRecord;
  });
}

export async function updateLink(
  code: string,
  patch: Partial<LinkRecord>,
): Promise<LinkRecord | null> {
  const updated = await mutate((db) => {
    const idx = db.links.findIndex((l) => l.short_code === code);
    if (idx === -1) return null;
    const previousId = db.links[idx].id;
    // Preserve the rename: spread the patch last so an alias change survives.
    db.links[idx] = {
      ...db.links[idx],
      ...patch,
      id: previousId,
      short_code: patch.short_code || code,
    };
    // A rename must cascade to the visitor logs, otherwise historical analytics
    // lookups by short code would silently lose rows.
    const renamed = db.links[idx].short_code;
    if (renamed !== code) {
      db.logs = db.logs.map((log) =>
        log.link_id === previousId ? { ...log, short_code: renamed } : log,
      );
    }
    return db.links[idx];
  });
  if (updated) await Promise.all([persist("links"), persist("logs")]);
  return updated as LinkRecord | null;
}

export async function deleteLink(code: string): Promise<boolean> {
  const removed = await mutate((db) => {
    const before = db.links.length;
    db.links = db.links.filter((l) => l.short_code !== code);
    db.logs = db.logs.filter((l) => l.short_code !== code);
    return db.links.length < before;
  });
  await Promise.all([persist("links"), persist("logs")]);
  return removed as boolean;
}

export async function codeExists(code: string): Promise<boolean> {
  const db = await load();
  return db.links.some((l) => l.short_code === code);
}

/* --------------------------- Visitor logs -------------------------- */

export async function listLogs(filter: {
  linkId?: string | null;
  shortCode?: string | null;
}): Promise<VisitorLog[]> {
  const db = await load();
  const rows = db.logs.filter((l) => {
    if (filter.linkId && l.link_id === filter.linkId) return true;
    if (filter.shortCode && l.short_code === filter.shortCode) return true;
    return false;
  });
  if (!filter.linkId && !filter.shortCode) return [];
  return rows
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 200);
}

export async function addLog(
  log: Omit<VisitorLog, "id" | "created_at">,
): Promise<VisitorLog> {
  const record = await mutate((db) => {
    const r: VisitorLog = {
      ...log,
      id: newId(),
      created_at: new Date().toISOString(),
    };
    db.logs.push(r);
    // keep the store bounded
    if (db.logs.length > 5000) db.logs.splice(0, db.logs.length - 5000);
    return r;
  });
  await persist("logs");
  return record as VisitorLog;
}

/* ------------------------------ Users ----------------------------- */

export function hashPassword(password: string, salt?: string): string {
  const useSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, useSalt, 32).toString("hex");
  return `${useSalt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 32).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(candidate, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const db = await load();
  return db.users.find((u) => u.id === id) ?? null;
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const db = await load();
  const e = email.trim().toLowerCase();
  return db.users.find((u) => u.email === e) ?? null;
}

export async function createUser(email: string, password: string, name?: string): Promise<UserRecord> {
  const user = await mutate((db) => {
    const record: UserRecord = {
      id: newId(),
      email: email.trim().toLowerCase(),
      password_hash: hashPassword(password),
      name: (name || email.split("@")[0]).trim(),
      plan: "free",
      plan_expires_at: null,
      tokens: [],
      total_links_used: 0,
      daily_date: null,
      daily_count: 0,
      last_coupon_used: null,
      coupons_redeemed: [],
      created_at: new Date().toISOString(),
    };
    db.users.push(record);
    return record;
  });
  await persist("users");
  return user as UserRecord;
}

export async function updateUser(id: string, patch: Partial<UserRecord>): Promise<UserRecord | null> {
  const updated = await mutate((db) => {
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    db.users[idx] = { ...db.users[idx], ...patch, id };
    return db.users[idx];
  });
  if (updated) await persist("users");
  return updated as UserRecord | null;
}

/* ----------------------------- Coupons ---------------------------- */

export async function listCoupons(): Promise<CouponRecord[]> {
  const db = await load();
  return db.coupons;
}

export async function redeemCoupon(
  userId: string,
  code: string,
): Promise<{ ok: boolean; message: string; plan?: string; expiresAt?: string }> {
  const upper = code.trim().toUpperCase();

  // Validate the user and duplication *before* consuming one of the coupon uses.
  const user = await getUserById(userId);
  if (!user) return { ok: false, message: "User not found" };
  if (user.coupons_redeemed.includes(upper)) {
    return { ok: false, message: "You have already redeemed this coupon" };
  }

  const coupon = await mutate((db) => {
    const c = db.coupons.find((x) => x.code.toUpperCase() === upper);
    if (!c || !c.active) return null;
    if (c.uses >= c.max_uses) return null;
    c.uses += 1;
    return { ...c };
  });
  if (!coupon) return { ok: false, message: "Invalid or expired coupon code" };
  await persist("coupons");

  const base =
    user.plan === "premium" && user.plan_expires_at
      ? new Date(user.plan_expires_at)
      : new Date();
  const expires = new Date(
    Math.max(base.getTime(), Date.now()) + coupon.days * 86400000,
  );

  await updateUser(userId, {
    plan: coupon.plan,
    plan_expires_at: expires.toISOString(),
    last_coupon_used: coupon.code,
    coupons_redeemed: [...user.coupons_redeemed, upper],
  });

  return {
    ok: true,
    message: `🎉 ${coupon.plan === "premium" ? "Pro/VIP" : "Free"} unlocked for ${coupon.days} days!`,
    plan: coupon.plan,
    expiresAt: expires.toISOString(),
  };
}

/* ----------------------------- Settings --------------------------- */

export async function getBranding(): Promise<Branding> {
  const db = await load();
  return db.settings || defaultBranding();
}

export async function setBranding(patch: Partial<Branding>): Promise<Branding> {
  const next = await mutate((db) => {
    db.settings = { ...db.settings, ...patch };
    return db.settings;
  });
  await persist("settings");
  return next as Branding;
}
