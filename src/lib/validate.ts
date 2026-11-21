import crypto from "node:crypto";

/**
 * Small validation helpers shared by every API route.
 * Keeps request handling predictable and returns friendly messages.
 */

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function sanitizeAlias(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (!/^[a-zA-Z0-9_-]{3,25}$/.test(v)) return null;
  if (RESERVED_PATHS.has(v.toLowerCase())) return null;
  return v;
}

/** Top-level application paths that a short code must never shadow. */
const RESERVED_PATHS = new Set([
  "api",
  "admin",
  "login",
  "logout",
  "register",
  "signin",
  "signup",
  "dashboard",
  "settings",
  "analytics",
  "media",
  "recent",
  "static",
  "public",
  "assets",
  "favicon",
  "icon",
  "manifest",
  "robots",
  "sitemap",
  "_next",
  "well-known",
  "health",
  "null",
  "undefined",
]);

export function asString(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().slice(0, max);
  return v || undefined;
}

export function asBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

/**
 * Normalise an expiry value to an ISO timestamp that survives the whole day.
 *
 * `<input type="date">` submits `YYYY-MM-DD`, which `new Date()` reads as UTC
 * midnight — so a link set to expire "today" would already be dead at 00:00.
 * Date-only input is therefore pushed to the end of that day (UTC). Anything
 * that already carries a time is parsed and stored as-is.
 *
 * Returns `null` for empty input and `undefined` for unparseable input so the
 * caller can distinguish "clear the field" from "reject the request".
 */
export function normalizeExpiry(value: unknown): string | null | undefined {
  const raw = asString(value, 40);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T23:59:59.999Z`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Very small in-memory rate limiter (per process). */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function randomId(): string {
  return crypto.randomUUID();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
