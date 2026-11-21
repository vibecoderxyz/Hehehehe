import { NextResponse } from "next/server";
import { getUserById } from "@/lib/db";
import { bearerFromRequest, publicUser, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/user/profile → current session user (or authenticated:false). */
export async function GET(req: Request) {
  const userId = verifyToken(bearerFromRequest(req));
  if (!userId) {
    return NextResponse.json({ success: true, authenticated: false, user: null });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ success: true, authenticated: false, user: null });
  }

  return NextResponse.json({
    success: true,
    authenticated: true,
    user: publicUser(user),
  });
}
