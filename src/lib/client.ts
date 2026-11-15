"use client";

import type { PublicUser, VisitorLog, LinkRecord } from "@/lib/types";

/* ------------------------- localStorage keys ------------------------- */
const K = {
  deviceId: "supashort_device_id",
  phone: "supashort_phone",
  history: "supashort_history",
  guestTries: "supashort_guest_tries",
  userToken: "supashort_user_token",
  userCache: "supashort_user_cache",
  branding: "supashort_site_branding",
  sound: "supashort_sound",
};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable (private mode) */
  }
}
function safeDel(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getDeviceId(): string | null {
  let id = safeGet(K.deviceId);
  if (!id) {
    id =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    safeSet(K.deviceId, id);
  }
  return id;
}

export function getPhone(): string {
  return safeGet(K.phone) || "";
}
export function setPhone(v: string): void {
  safeSet(K.phone, v);
}

export function getHistory(): LinkRecord[] {
  try {
    const raw = safeGet(K.history);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
export function setHistory(rows: LinkRecord[]): void {
  safeSet(K.history, JSON.stringify(rows));
}

export function getGuestTries(): number {
  return parseInt(safeGet(K.guestTries) || "0", 10) || 0;
}
export function setGuestTries(n: number): void {
  safeSet(K.guestTries, String(n));
}

export function getUserToken(): string | null {
  return safeGet(K.userToken);
}
export function setUserToken(token: string): void {
  safeSet(K.userToken, token);
}
export function clearUserToken(): void {
  safeDel(K.userToken);
  safeDel(K.userCache);
}
export function getUserCache(): PublicUser | null {
  try {
    const raw = safeGet(K.userCache);
    return raw ? (JSON.parse(raw) as PublicUser) : null;
  } catch {
    return null;
  }
}
export function setUserCache(u: PublicUser | null): void {
  if (!u) safeDel(K.userCache);
  else safeSet(K.userCache, JSON.stringify(u));
}

export function getSoundPref(): boolean {
  return safeGet(K.sound) !== "off";
}
export function setSoundPref(on: boolean): void {
  safeSet(K.sound, on ? "on" : "off");
}

/* ----------------------------- API client ---------------------------- */

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getUserToken();
  const headers: Record<string, string> = {
    ...(init?.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) || {}),
  };
  const res = await fetch(url, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Request failed");
  }
  return data;
}

export const api = {
  listLinks: (deviceId: string | null, phone: string) => {
    const p = new URLSearchParams();
    if (deviceId) p.set("deviceId", deviceId);
    if (phone) p.set("phoneNumber", phone);
    return jsonFetch<{ success: boolean; links: LinkRecord[] }>(
      `/api/links?${p.toString()}`,
    );
  },
  getLink: (code: string) =>
    jsonFetch<{ success: boolean; data: LinkRecord }>(
      `/api/links/${encodeURIComponent(code)}`,
    ),
  /**
   * The PATCH/DELETE ownership guards on /api/links/[code] require proof that
   * the caller created the link, so the deviceId / phoneNumber query params are
   * appended here (the bearer token, when signed in, is added by jsonFetch).
   */
  updateLink: (
    code: string,
    deviceId: string | null,
    phone: string | null,
    patch: Partial<LinkRecord>,
  ) => {
    const p = new URLSearchParams();
    if (deviceId) p.set("deviceId", deviceId);
    if (phone) p.set("phoneNumber", phone);
    const qs = p.toString();
    return jsonFetch<{ success: boolean; data: LinkRecord }>(
      `/api/links/${encodeURIComponent(code)}${qs ? `?${qs}` : ""}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
  },
  deleteLink: (code: string, deviceId: string | null, phone: string | null) => {
    const p = new URLSearchParams();
    if (deviceId) p.set("deviceId", deviceId);
    if (phone) p.set("phoneNumber", phone);
    const qs = p.toString();
    return jsonFetch<{ success: boolean }>(
      `/api/links/${encodeURIComponent(code)}${qs ? `?${qs}` : ""}`,
      { method: "DELETE" },
    );
  },
  shorten: (body: Record<string, unknown>) =>
    jsonFetch<{
      success: boolean;
      shortUrl: string;
      message?: string;
      data: LinkRecord;
    }>("/api/shorten", { method: "POST", body: JSON.stringify(body) }),
  analytics: (params: { urlId?: string; shortCode?: string; deviceId?: string | null; phone?: string | null }) => {
    const p = new URLSearchParams();
    if (params.urlId) p.set("urlId", params.urlId);
    if (params.shortCode) p.set("shortCode", params.shortCode);
    // The ownership guard runs whenever shortCode is present, so the caller's
    // deviceId / phoneNumber must accompany it (signed-in users also send the
    // bearer token via jsonFetch).
    if (params.deviceId) p.set("deviceId", params.deviceId);
    if (params.phone) p.set("phoneNumber", params.phone);
    return jsonFetch<{ success: boolean; data: VisitorLog[] }>(
      `/api/analytics?${p.toString()}`,
    );
  },
  settings: () =>
    jsonFetch<{
      success: boolean;
      displayName: string;
      brandName: string;
      avatarUrl: string;
    }>("/api/settings"),
  profile: () =>
    jsonFetch<{ success: boolean; authenticated: boolean; user: PublicUser | null }>(
      "/api/user/profile",
    ),
  login: (email: string, password: string) =>
    jsonFetch<{ success: boolean; token: string; user: PublicUser }>(
      "/api/user/auth",
      { method: "POST", body: JSON.stringify({ action: "login", email, password }) },
    ),
  register: (email: string, password: string, name?: string) =>
    jsonFetch<{ success: boolean; token: string; user: PublicUser }>(
      "/api/user/auth",
      {
        method: "POST",
        body: JSON.stringify({ action: "register", email, password, name }),
      },
    ),
  logout: () =>
    jsonFetch<{ success: boolean }>("/api/user/auth", { method: "DELETE" }),
  redeemCoupon: (code: string) =>
    jsonFetch<{
      success: boolean;
      message: string;
      user: PublicUser;
      error?: string;
    }>("/api/user/redeem-coupon", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  track: (body: Record<string, unknown>) =>
    jsonFetch<{ success: boolean }>("/api/track", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export function shortUrlFor(code: string, origin: string): string {
  const base = (origin || "").replace(/\/+$/, "");
  return `${base}/${code}`;
}

/** Clipboard write with a legacy fallback for non-secure contexts. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea trick */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
