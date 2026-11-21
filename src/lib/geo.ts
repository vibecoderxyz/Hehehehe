import type { TelemetryPayload } from "@/lib/types";

/**
 * Best-effort IP geolocation using free, no-key public endpoints.
 * Falls back gracefully (Direct Visit / unknown) when offline or rate-limited.
 * No private data is collected; only the values needed for the "Location" chip
 * and GPS pin the reference dashboard shows.
 */

export interface GeoResult {
  ipAddress: string;
  locationName: string;
}

function clientIp(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-vercel-forwarded-for") ||
    "127.0.0.1"
  );
}

export async function lookupGeo(req: Request): Promise<GeoResult> {
  const ip = clientIp(req);
  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.")
  ) {
    return { ipAddress: ip || "127.0.0.1", locationName: "Local Network" };
  }
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,query`,
      { signal: controller.signal, cache: "no-store" },
    );
    clearTimeout(t);
    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        city?: string;
        regionName?: string;
        country?: string;
        query?: string;
      };
      if (data.status === "success") {
        const parts = [data.city, data.country].filter(Boolean);
        return {
          ipAddress: data.query || ip,
          locationName: parts.join(", ") || data.country || "Unknown",
        };
      }
    }
  } catch {
    /* offline / blocked - keep the raw IP */
  }
  return { ipAddress: ip, locationName: "Direct Visit" };
}

/** Client location is authoritative when the visitor grants GPS permission. */
export function mergeLocation(
  base: GeoResult,
  payload: TelemetryPayload,
): GeoResult {
  return {
    ipAddress: payload.ipAddress || base.ipAddress,
    locationName: payload.locationName || base.locationName,
  };
}
