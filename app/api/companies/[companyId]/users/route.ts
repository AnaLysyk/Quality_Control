import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { canDeleteUserByProfile } from "@/lib/adminUserDeleteAccess";
import { getAdminUserItem, listAdminUserItems } from "@/lib/adminUsers";
import {
  createLocalUser,
  listLocalCompanies,
  listLocalUsers,
  updateLocalUser,
  upsertLocalLink,
} from "@/lib/auth/localStore";
import { getAccessContext } from "@/lib/auth/session";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

function normalizeLogin(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeMembershipRole(input?: string | null) {
  const value = (input ?? "").trim().toLowerCase();
  if (
    value === "empresa" ||
    value === "company" ||
    value === "company_admin" ||
    value === "client_admin" ||
    value === "admin"
  ) {
    return "company_admin";
  }
  if (value === "dev" || value === "it_dev" || value === "developer") {
    return "it_dev";
  }
  if (value === "viewer" || value === "client_viewer") {
    return "viewer";
  }
  return "user";
}

function buildTempPasswordHash() {
  return hashPasswordSha256(`${Date.now()}-${randomUUID()}`);
}

async function parseCompanyId(
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> },
) {
  const params = context.params;
  return typeof (params as Promise<{ companyId: string }>).then === "function"
    ? (await (params as Promise<{ companyId: string }>)).companyId
    : (params as { companyId: string }).companyId;
}

export async function GET(
  _req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> },
) {
  const companyId = await parseCompanyId(context);
  const users = await listAdminUserItems({ companyId });
  return NextResponse.json(users);
}

export async function POST(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> },
) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const companyId = await parseCompanyId(context);
  const companies = await listLocalCompanies();
  if (!companies.some((company) => company.id === companyId)) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const login = normalizeLogin(
    typeof body?.user === "string" && body.user.trim() ? body.user : email.split("@")[0] ?? "",
  );
  const rawRole = typeof body?.role === "string" ? body.role : "user";
  const role = normalizeMembershipRole(rawRole);
  const passwordHash =
    typeof body?.password === "string" && body.password
      ? hashPasswordSha256(body.password)
      : buildTempPasswordHash();

  if (!name || !email || !login) {
    return NextResponse.json({ error: "Campos obrigatorios: name e email" }, { status: 400 });
  }

  const users = await listLocalUsers();
  if (users.some((user) => normalizeLogin(user.email) === email)) {
    return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
  }
  if (users.some((user) => normalizeLogin(user.user ?? user.email) === login)) {
    return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
  }

  let created = null;
  try {
    created = await createLocalUser({
      full_name: name,
      name,
      email,
      user: login,
      password_hash: passwordHash,
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

  await upsertLocalLink({ userId: created.id, companyId, role });

  const item = await getAdminUserItem(created.id);
  return NextResponse.json(item ?? created, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> },
) {
  const companyId = await parseCompanyId(context);
  const body = await req.json().catch(() => null);
  const userId = typeof body?.id === "string" ? body.id : "";
  const updates = body?.updates && typeof body.updates === "object" ? body.updates : null;

  if (!userId || !updates) {
    return NextResponse.json({ error: "Campos obrigatorios" }, { status: 400 });
  }

  const email = typeof updates.email === "string" ? updates.email.trim().toLowerCase() : null;
  const login = typeof updates.user === "string" ? normalizeLogin(updates.user) : null;

  if (email || login) {
    const users = await listLocalUsers();
    if (email && users.some((user) => user.id !== userId && normalizeLogin(user.email) === email)) {
      return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
    }
    if (login && users.some((user) => user.id !== userId && normalizeLogin(user.user ?? user.email) === login)) {
      return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
    }
  }

  let updated = null;
  try {
    updated = await updateLocalUser(userId, {
      ...(typeof updates.name === "string" ? { name: updates.name.trim(), full_name: updates.name.trim() } : {}),
      ...(email ? { email } : {}),
      ...(login ? { user: login } : {}),
      ...(typeof updates.active === "boolean" ? { active: updates.active } : {}),
      ...(typeof updates.status === "string" ? { status: updates.status } : {}),
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

  if (!updated) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (typeof updates.role === "string") {
    await upsertLocalLink({
      userId,
      companyId,
      role: normalizeMembershipRole(updates.role),
    });
  }

  const item = await getAdminUserItem(userId);
  return NextResponse.json(item ?? updated);
}

export async function DELETE(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> },
) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const access = await getAccessContext(req);
  await parseCompanyId(context);
  const body = await req.json().catch(() => null);
  const userId = typeof body?.id === "string" ? body.id : "";

  if (!userId) {
    return NextResponse.json({ error: "Campo 'id' obrigatorio para exclusao de usuario" }, { status: 400 });
  }

  const target = await getAdminUserItem(userId);
  if (!target) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (!canDeleteUserByProfile(access, target.permission_role)) {
    return NextResponse.json({ error: "Sem permissao para excluir este perfil" }, { status: 403 });
  }

  const updated = await updateLocalUser(userId, {
    active: false,
    status: "blocked",
  });

  if (!updated) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const item = await getAdminUserItem(userId);
  return NextResponse.json(item ?? updated);
}
