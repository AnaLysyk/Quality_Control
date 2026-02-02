import { NextRequest, NextResponse } from "next/server";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { createLocalUser, findLocalUserByEmailOrId, upsertLocalLink } from "@/lib/auth/localStore";

// POST: Cria um novo usuario e vincula a uma empresa
export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => null);
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  const password = typeof data?.password === "string" ? data.password : "";
  const companyId = typeof data?.companyId === "string" ? data.companyId : "";

  if (!email || !name || !password || !companyId) {
    return NextResponse.json({ error: "Campos obrigatorios ausentes" }, { status: 400 });
  }

  const existing = await findLocalUserByEmailOrId(email);
  if (existing) {
    return NextResponse.json({ error: "E-mail ja existe" }, { status: 409 });
  }

  const hash = hashPasswordSha256(password);
  const user = await createLocalUser({
    email,
    name,
    password_hash: hash,
    active: true,
    role: "user",
  });
  await upsertLocalLink({ userId: user.id, companyId, role: "user" });
  return NextResponse.json(user, { status: 201 });
}
