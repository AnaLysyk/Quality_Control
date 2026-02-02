import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getRedis } from "@/lib/redis";
import { emailService } from "@/lib/email";
import { findLocalUserByEmailOrId } from "@/lib/auth/localStore";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Email obrigatorio" }, { status: 400 });
  }

  const user = await findLocalUserByEmailOrId(email);
  if (!user) {
    return NextResponse.json({ ok: true });
  }

  const token = randomUUID();
  const redis = getRedis();
  await redis.set(`reset:${token}`, user.id, { ex: 15 * 60 });

  const emailSent = await emailService.sendPasswordResetEmail(email, token);
  if (!emailSent) {
    console.error("Failed to send reset email to:", email);
  }

  return NextResponse.json({ ok: true });
}
