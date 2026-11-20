import { NextResponse } from "next/server";
import { createUser, getUserByEmail, getUserById, updateUser, verifyPassword } from "@/lib/db";
import { bearerFromRequest, createToken, publicUser, verifyToken } from "@/lib/auth";
import { asString, isValidEmail, rateLimit } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
}

/** POST /api/user/auth → { action: "register" | "login", email, password, name? } */
export async function POST(req: Request) {
  if (!rateLimit(`auth:${clientIp(req)}`, 20, 60000)) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = asString(body.action, 20) || "login";
  const email = (asString(body.email, 160) || "").toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ success: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { success: false, error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  if (action === "register") {
    if (await getUserByEmail(email)) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists. Sign in instead." },
        { status: 409 },
      );
    }
    const user = await createUser(email, password, asString(body.name, 80));
    const token = createToken(user.id);
    await updateUser(user.id, { tokens: [token] });
    return NextResponse.json(
      { success: true, token, user: publicUser(user) },
      { status: 201 },
    );
  }

  if (action !== "login") {
    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  }

  const existing = await getUserByEmail(email);
  if (!existing || !verifyPassword(password, existing.password_hash)) {
    return NextResponse.json({ success: false, error: "Invalid email or password." }, { status: 401 });
  }

  const token = createToken(existing.id);
  // Keep a bounded list of live sessions so DELETE can revoke just this one.
  const tokens = [...existing.tokens.filter((t) => t !== token), token].slice(-10);
  await updateUser(existing.id, { tokens });

  return NextResponse.json({
    success: true,
    token,
    user: publicUser(existing),
  });
}

/** DELETE /api/user/auth → revoke the caller's session token. */
export async function DELETE(req: Request) {
  const token = bearerFromRequest(req);
  const userId = verifyToken(token);
  if (!userId) return NextResponse.json({ success: true });

  const user = await getUserById(userId);
  if (user && token) {
    await updateUser(userId, {
      tokens: user.tokens.filter((t) => t !== token),
    });
  }
  return NextResponse.json({ success: true });
}
