import { NextResponse } from "next/server";
import { getUserById, redeemCoupon } from "@/lib/db";
import { publicUser, sessionUser } from "@/lib/auth";
import { asString, rateLimit } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/user/redeem-coupon → { code } → unlocks / extends the Pro plan. */
export async function POST(req: Request) {
  const user = await sessionUser(req);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "Please sign in or create a free account first." },
      { status: 401 },
    );
  }

  if (!rateLimit(`coupon:${user.id}`, 12, 60000)) {
    return NextResponse.json(
      { success: false, error: "Too many coupon attempts. Please wait a minute." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const code = asString(body.code, 40);
  if (!code) {
    return NextResponse.json({ success: false, error: "Enter a coupon code." }, { status: 400 });
  }

  const result = await redeemCoupon(user.id, code);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.message }, { status: 400 });
  }

  const refreshed = await getUserById(user.id);
  return NextResponse.json({
    success: true,
    message: result.message,
    user: refreshed ? publicUser(refreshed) : publicUser(user),
  });
}
