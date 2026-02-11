import { NextResponse } from "next/server";
import { findLocalUserByEmailOrId } from "@/lib/auth/localStore";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const login = typeof body?.user === "string" ? body.user.trim().toLowerCase() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!login || !email) {
    return NextResponse.json({ error: "Usuario e email obrigatorios." }, { status: 400 });
  }

  const user = await findLocalUserByEmailOrId(login);
  if (!user || (user.email ?? "").toLowerCase() !== email) {
    return NextResponse.json({ error: "Usuario e email nao conferem." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
