import { NextResponse } from "next/server";
import { findLocalUserByEmailOrId } from "@/backend/auth/localStore";
import { isE2eMockAllowed } from "@/backend/auth/e2eMockGate";
import { rateLimit } from "@/backend/rateLimit";

export async function POST(req: Request) {
  // Endpoint auxiliar de automação; a recuperação real usa token descartável.
  if (!isE2eMockAllowed()) {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });
  }

  const limiter = await rateLimit(req, "e2e-password-reset-verify", 30, 60);
  if (limiter.limited) return limiter.response;

  const body = await req.json().catch(() => null);
  const login = typeof body?.user === "string" ? body.user.trim().toLowerCase() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!login || !email) {
    return NextResponse.json({ error: "Usuário e email obrigatorios." }, { status: 400 });
  }

  const user = await findLocalUserByEmailOrId(login);
  if (!user || (user.email ?? "").toLowerCase() !== email) {
    return NextResponse.json({ error: "Usuário e email não conferem." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
