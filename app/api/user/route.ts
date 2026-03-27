import { NextRequest, NextResponse } from "next/server";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { createLocalUser, listLocalUsers, upsertLocalLink } from "@/lib/auth/localStore";
import { isUserScopeLockedError } from "@/lib/companyUserScope";

// POST: Cria um novo usuario e vincula a uma empresa
export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => null);
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
  const login = typeof data?.user === "string" ? data.user.trim().toLowerCase() : "";
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  const password = typeof data?.password === "string" ? data.password : "";
  const companyId = typeof data?.companyId === "string" ? data.companyId : "";

  if (!email || !login || !name || !password || !companyId) {
    return NextResponse.json({ error: "Campos obrigatorios ausentes" }, { status: 400 });
  }

  const users = await listLocalUsers();
  if (users.some((user) => user.email.toLowerCase() === email)) {
    return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
  }
  if (users.some((user) => (user.user ?? user.email).toLowerCase() === login)) {
    return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
  }

  const hash = hashPasswordSha256(password);
  let user = null;
  try {
    user = await createLocalUser({
      full_name: name,
      email,
      user: login,
      name,
      password_hash: hash,
      active: true,
      role: "user",
    });
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    if (code === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
    }
    if (code === "DUPLICATE_USER") {
      return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
    }
    throw err;
  }
  try {
    await upsertLocalLink({ userId: user.id, companyId, role: "user" });
  } catch (error) {
    if (isUserScopeLockedError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json(user, { status: 201 });
}
