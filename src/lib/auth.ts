import crypto from "node:crypto";
import { getUserById } from "@/lib/db";
import type { UserRecord } from "@/lib/types";

/**
 * Stateless session tokens.
 * Format: <base64url(userId|expiry)>.<hmacSignature>
 * Signed with SESSION_SECRET (or SUPASHORT_SESSION_SECRET).
 */

/**
 * Never fall back to a constant: a published signing key would let anyone mint
 * a token. Without an explicit secret we generate a random one per boot, which
 * only costs the user their sessions on restart — and sessionUser() still
 * requires the token to be present in the account's revocation list.
 */
const SECRET =
  process.env.SESSION_SECRET ||
  process.env.SUPASHORT_SESSION_SECRET ||
  crypto.randomBytes(32).toString("hex");

if (!process.env.SESSION_SECRET && !process.env.SUPASHORT_SESSION_SECRET) {
  console.warn(
    "[supashort] SESSION_SECRET is not set — using a random per-process signing key. " +
      "Sessions will not survive a server restart. Set SESSION_SECRET in production.",
  );
}

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(payload: string): string {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createToken(userId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = Buffer.from(`${userId}|${exp}`).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string | null | undefined): string | null {
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  try {
    const expected = sign(payload);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const [userId, exp] = Buffer.from(payload, "base64url").toString("utf8").split("|");
    if (Date.now() > Number(exp)) return null;
    return userId;
  } catch {
    return null;
  }
}

export function bearerFromRequest(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

/**
 * Resolve the signed-in user for a request.
 * The token must be (a) correctly signed and unexpired and (b) still present in
 * the user's revocation list, so "Logout" genuinely invalidates the session.
 */
export async function sessionUser(req: Request): Promise<UserRecord | null> {
  const token = bearerFromRequest(req);
  const userId = verifyToken(token);
  if (!userId || !token) return null;
  const user = await getUserById(userId);
  if (!user || !user.tokens.includes(token)) return null;
  return user;
}

export function isPremium(user: UserRecord | null | undefined): boolean {
  if (!user || user.plan !== "premium") return false;
  if (!user.plan_expires_at) return true;
  return new Date(user.plan_expires_at).getTime() > Date.now();
}

export function dailyLimitFor(user: UserRecord | null | undefined): number {
  return isPremium(user) ? 1000 : 5;
}

/** Usage for the current UTC day (limits reset at 00:00 UTC). */
export function usageToday(user: UserRecord | null | undefined): number {
  if (!user) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return user.daily_date === today ? user.daily_count || 0 : 0;
}

export function publicUser(user: UserRecord) {
  const plan = isPremium(user) ? "premium" : "free";
  const dailyLimit = dailyLimitFor(user);
  const usedToday = usageToday(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan,
    planExpiresAt: user.plan_expires_at,
    remainingToday: Math.max(0, dailyLimit - usedToday),
    dailyLimit,
    totalUsed: user.total_links_used,
    lastCouponUsed: user.last_coupon_used,
  };
}
