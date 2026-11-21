import { NextResponse } from "next/server";
import { getLinkByCode, listLogs } from "@/lib/db";
import { bearerFromRequest, verifyToken } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const urlId = url.searchParams.get("urlId");
  const shortCode = url.searchParams.get("shortCode");

  if (!urlId && !shortCode) {
    return NextResponse.json(
      { success: false, error: "urlId or shortCode is required." },
      { status: 400 },
    );
  }

  // Ownership guard for code-based reads.
  if (shortCode) {
    const link = await getLinkByCode(shortCode);
    if (!link) {
      return NextResponse.json({ success: false, error: "Link not found." }, { status: 404 });
    }
    const userId = verifyToken(bearerFromRequest(req));
    const deviceId = url.searchParams.get("deviceId");
    const phoneNumber = url.searchParams.get("phoneNumber");
    const owned =
      (userId && link.user_id === userId) ||
      (deviceId && link.device_id === deviceId) ||
      (phoneNumber && link.phone_number === phoneNumber) ||
      (!link.device_id && !link.user_id && !link.phone_number);
    if (!owned) {
      return NextResponse.json({ success: false, error: "Not authorised." }, { status: 403 });
    }
  }

  const data = await listLogs({ linkId: urlId, shortCode });
  return NextResponse.json({ success: true, data });
}
