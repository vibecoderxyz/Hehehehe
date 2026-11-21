import { NextResponse } from "next/server";
import { getBranding, setBranding } from "@/lib/db";
import { sessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const b = await getBranding();
  return NextResponse.json({ success: true, ...b });
}

export async function POST(req: Request) {
  // Branding is global to the deployment, so writing it requires a signed-in
  // account. Reads stay public because the shell renders before login.
  const user = await sessionUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Sign in to change site branding." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const patch: Record<string, string> = {};
  if (typeof body.displayName === "string" && body.displayName.trim())
    patch.displayName = body.displayName.trim().slice(0, 60);
  if (typeof body.brandName === "string" && body.brandName.trim())
    patch.brandName = body.brandName.trim().slice(0, 60);
  if (typeof body.avatarUrl === "string" && body.avatarUrl.trim())
    patch.avatarUrl = body.avatarUrl.trim().slice(0, 500);
  const next = await setBranding(patch);
  return NextResponse.json({ success: true, ...next });
}
