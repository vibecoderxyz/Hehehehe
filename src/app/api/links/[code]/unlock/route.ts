import { NextResponse } from "next/server";
import { getLinkByCode, verifyPassword } from "@/lib/db";
import { asString, rateLimit } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ code: string }>;
}

/**
 * POST /api/links/[code]/unlock — validates the password of a protected short
 * link. Deliberately returns only a boolean: the destination URL is never sent
 * to a caller that has not proven knowledge of the password.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";

  if (!rateLimit(`unlock:${ip}:${code}`, 12, 60000)) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Wait a minute and retry." },
      { status: 429 },
    );
  }

  const link = await getLinkByCode(code);
  if (!link) {
    return NextResponse.json({ success: false, error: "Link not found." }, { status: 404 });
  }

  if (!link.password_hash) {
    return NextResponse.json({ success: true });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const password = asString(body.password, 200) || "";
  if (!password || !verifyPassword(password, link.password_hash)) {
    return NextResponse.json({ success: false, error: "Incorrect password." }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
