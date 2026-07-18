import { NextResponse } from "next/server";

import { hasPasswordResetToken } from "@/backend/auth/passwordResetToken";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string | null } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ valid: false, message: "Token ausente" }, { status: 400 });
  }

  const valid = await hasPasswordResetToken(token);
  return NextResponse.json({ valid }, { status: 200 });
}

