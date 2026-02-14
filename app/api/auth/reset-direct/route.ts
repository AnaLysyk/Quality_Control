import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/passwordHash";
import { findLocalUserByEmailOrId, updateLocalUser } from "@/lib/auth/localStore";

const MAX_REQUEST_BYTES = 16 * 1024;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type invalido." }, { status: 415 });
    }

    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader) {
      const parsedLength = Number.parseInt(contentLengthHeader, 10);
      if (Number.isFinite(parsedLength) && parsedLength > MAX_REQUEST_BYTES) {
        return NextResponse.json({ error: "Payload muito grande." }, { status: 413 });
      }
    }

    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      return NextResponse.json({ error: "JSON invalido." }, { status: 400 });
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const body = parsed as Record<string, unknown>;

    const loginRaw = typeof body.user === "string" ? body.user.trim() : "";
    const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    const login = loginRaw.includes("@") ? loginRaw.toLowerCase() : loginRaw;
    const email = emailRaw.toLowerCase();

    if (!login || !email || !newPassword) {
      return NextResponse.json(
        { error: "Usuario, email e nova senha obrigatorios." },
        { status: 400 },
      );
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` },
        { status: 400 },
      );
    }

    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `A nova senha deve ter no maximo ${MAX_PASSWORD_LENGTH} caracteres.` },
        { status: 400 },
      );
    }

    const user = await findLocalUserByEmailOrId(login);
    if (
      !user ||
      user.active === false ||
      user.status === "blocked" ||
      (user.email ?? "").toLowerCase() !== email
    ) {
      return NextResponse.json({ error: "Dados invalidos." }, { status: 400 });
    }

    const hashedPassword = await hashPassword(newPassword);
    await updateLocalUser(user.id, { password_hash: hashedPassword });

    const res = NextResponse.json({ ok: true });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (error) {
    console.error("[RESET DIRECT ERROR]", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
