import { NextResponse } from "next/server";
import { listLinks } from "@/lib/db";
import { bearerFromRequest, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const deviceId = url.searchParams.get("deviceId");
  const phoneNumber = url.searchParams.get("phoneNumber");
  const userId = verifyToken(bearerFromRequest(req));

  if (!deviceId && !phoneNumber && !userId) {
    return NextResponse.json({
      success: true,
      links: [],
      message: "Provide deviceId or phoneNumber to load your links.",
    });
  }

  const links = await listLinks({ deviceId, phoneNumber, userId });
  return NextResponse.json({ success: true, links });
}
