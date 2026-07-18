import { NextResponse } from "next/server";

import { hasPasswordResetToken } from "@/backend/auth/passwordResetToken";
import { rateLimit } from "@/backend/rateLimit";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string | null } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 256) {
    return NextResponse.json({ valid: false, message: "Token ausente" }, { status: 400 });
  }

  const limiter = await rateLimit(req, `password-reset-validate:${token}`, 20, 60);
  if (limiter.limited) return limiter.response;

  const valid = await hasPasswordResetToken(token);
  return NextResponse.json({ valid }, { status: 200 });
}
