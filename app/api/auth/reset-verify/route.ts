import { NextResponse } from "next/server";
import { findLocalUserByEmailOrId } from "@/lib/auth/localStore";

const MAX_REQUEST_BYTES = 16 * 1024;

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type invalido" }, { status: 415 });
  }

  const contentLengthHeader = req.headers.get("content-length");
  const parsedLength = contentLengthHeader ? Number(contentLengthHeader) : null;
  if (Number.isFinite(parsedLength) && (parsedLength as number) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  const body = await req.json().catch(() => null);
  const login = typeof body?.user === "string" ? body.user.trim().toLowerCase() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!login || !email) {
    return NextResponse.json({ error: "Usuario e email obrigatorios." }, { status: 400 });
  }

  try {
    const user = await findLocalUserByEmailOrId(login);
    if (user && (user.email ?? "").toLowerCase() === email) {
      const success = NextResponse.json({ ok: true });
      success.headers.set("Cache-Control", "no-store");
      return success;
    }
  } catch (error) {
    console.error("[AUTH][RESET-VERIFY] lookup failed", error);
  }

  const neutral = NextResponse.json({ ok: true });
  neutral.headers.set("Cache-Control", "no-store");
  return neutral;
}
