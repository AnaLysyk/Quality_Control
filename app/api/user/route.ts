import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/backend/passwordHash";
import { createLocalUser, listLocalUsers, upsertLocalLink } from "@/backend/auth/localStore";
import { isUserScopeLockedError } from "@/backend/companyUserScope";
import { readSyncedUserProfileFields } from "@/backend/userProfileData";
import { requirePermission } from "@/backend/rbac/requirePermission";

// POST: Cria um novo usuário e vincula a uma empresa
export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, "users", "create");
  if (!guard.ok) return guard.response;

  const data = await req.json().catch(() => null);
  const profileFields = readSyncedUserProfileFields(data);
  const email = profileFields.email;
  const login = profileFields.login ?? "";
  const name = profileFields.name;
  const password = typeof data?.password === "string" ? data.password : "";
  const companyId = typeof data?.companyId === "string" ? data.companyId : "";

  if (!email || !login || !name || !password || !companyId) {
    return NextResponse.json({ error: "Campos obrigatorios ausentes" }, { status: 400 });
  }

  const users = await listLocalUsers();
  if (users.some((user) => user.email.toLowerCase() === email)) {
    return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
  }
  if (users.some((user) => (user.user ?? user.email).toLowerCase() === login)) {
    return NextResponse.json({ error: "Usuário já cadastrado" }, { status: 409 });
  }

  const hash = hashPassword(password);
  let user = null;
  try {
    user = await createLocalUser({
      full_name: profileFields.fullName ?? name,
      email,
      user: login,
      name,
      password_hash: hash,
      phone: profileFields.phone,
      job_title: profileFields.jobTitle,
      linkedin_url: profileFields.linkedinUrl,
      avatar_url: profileFields.avatarUrl,
      active: true,
      role: "company_user",
    });
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    if (code === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }
    if (code === "DUPLICATE_USER") {
      return NextResponse.json({ error: "Usuário já cadastrado" }, { status: 409 });
    }
    throw err;
  }
  try {
    await upsertLocalLink({ userId: user.id, companyId, role: "company_user" });
  } catch (error) {
    if (isUserScopeLockedError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json(user, { status: 201 });
}
