import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { hashPassword } from "@/lib/passwordHash";
import { getLocalUserById, updateLocalUser } from "@/lib/auth/localStore";

const MAX_REQUEST_BYTES = 16 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type invalido" }, { status: 415 });
    }

    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader) {
      const parsedLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(parsedLength) && parsedLength > MAX_REQUEST_BYTES) {
        return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
      }
    }

    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
    }

    const body = parsed as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token e nova senha obrigatorios" }, { status: 400 });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres` },
        { status: 400 },
      );
    }

    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `A nova senha deve ter no maximo ${MAX_PASSWORD_LENGTH} caracteres` },
        { status: 400 },
      );
    }

    const redis = getRedis();
    const resetKey = `reset:${hashResetToken(token)}`;
    const userId = await redis.get<string>(resetKey);
    if (!userId) {
      return NextResponse.json({ error: "Token invalido ou expirado" }, { status: 400 });
    }

    const user = await getLocalUserById(userId);
    if (!user || user.active === false || user.status === "blocked") {
      await redis.del(resetKey);
      return NextResponse.json({ error: "Token invalido ou expirado" }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);
    await updateLocalUser(user.id, { password_hash: hashedPassword });
    await redis.del(resetKey);

    const res = NextResponse.json({ ok: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("[RESET PASSWORD ERROR]", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
