import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { hashPasswordSha256 } from "@/lib/passwordHash";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAccessContext } from "@/lib/auth/session";
import { getAdminUserItem, listAdminUserItems } from "@/lib/adminUsers";
import {
  isGlobalPrivilegeProfileRole,
  resolveEditableProfileRole,
  toStoredEditableUserRole,
} from "@/lib/editableProfileRoles";
import { isUserScopeLockedError } from "@/lib/companyUserScope";
import {
  createLocalUser,
  findLocalCompanyById,
  listLocalLinksForUser,
  listLocalUsers,
  removeLocalLink,
  updateLocalUser,
  upsertLocalLink,
} from "@/lib/auth/localStore";

export const runtime = "nodejs";
export const revalidate = 0;

function hasOwn(obj: Record<string, unknown> | null, key: string) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeLogin(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function slugifyLoginSeed(value?: string | null) {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");

  return normalized || "usuario";
}

function buildUniqueLogin(
  existingUsers: Array<{ email: string; user?: string | null }>,
  preferredLogin: string,
  fallbackSeed: string,
) {
  const taken = new Set(existingUsers.map((user) => normalizeLogin(user.user ?? user.email)));
  const normalizedPreferred = normalizeLogin(preferredLogin);
  if (normalizedPreferred) return normalizedPreferred;

  const base = slugifyLoginSeed(fallbackSeed);
  if (!taken.has(base)) return base;

  let counter = 2;
  while (taken.has(`${base}.${counter}`)) {
    counter += 1;
  }
  return `${base}.${counter}`;
}

function roleNeedsCompany(role: string, wantsGlobalAdmin: boolean) {
  if (wantsGlobalAdmin) return false;
  return role === "viewer" || role === "leader_tc" || role === "technical_support";
}

function isGlobalDeveloperAccess(access: Awaited<ReturnType<typeof getAccessContext>> | null) {
  if (!access) return false;
  // global_admin users (is_global_admin flag) can manage all privileged profiles
  if (access.isGlobalAdmin === true) return true;
  const role = (access?.role ?? "").toLowerCase();
  const companyRole = (access?.companyRole ?? "").toLowerCase();
  return role === "it_dev" || companyRole === "it_dev" || role === "global_admin" || role === "admin";
}

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const isGlobalAdmin = access.isGlobalAdmin === true || (access.role ?? "").toLowerCase() === "admin";
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (!isGlobalAdmin) {
    if (!access.companyId) {
      return NextResponse.json({ error: "Sem empresa vinculada" }, { status: 403 });
    }
    const items = await listAdminUserItems({ companyId: access.companyId });
    return NextResponse.json({ items }, { status: 200 });
  }

  if (clientId) {
    const items = await listAdminUserItems({ companyId: clientId });
    return NextResponse.json({ items }, { status: 200 });
  }

  const items = await listAdminUserItems();

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }
  const access = await getAccessContext(req);
  const canManagePrivilegedProfiles = isGlobalDeveloperAccess(access);

  const body = await req.json().catch(() => null);
  const fullName =
    typeof body?.full_name === "string"
      ? body.full_name.trim() || null
      : typeof body?.fullName === "string"
        ? body.fullName.trim() || null
        : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const rawLogin = typeof body?.user === "string" ? body.user : "";
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const phone = typeof body?.phone === "string" ? body.phone.trim() || null : null;
  const password = typeof body?.password === "string" ? body.password : null;
  const jobTitle = typeof body?.job_title === "string" ? body.job_title.trim() || null : null;
  const linkedinUrl = typeof body?.linkedin_url === "string" ? body.linkedin_url.trim() || null : null;
  const avatarUrl = typeof body?.avatar_url === "string" ? body.avatar_url.trim() || null : null;
  const rawRole = typeof body?.role === "string" ? body.role : "";
  const profileRole = resolveEditableProfileRole(rawRole) ?? "user";
  const wantsGlobalAdmin = isGlobalPrivilegeProfileRole(profileRole);
  const role = toStoredEditableUserRole(profileRole);
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;

  console.debug(`[ADMIN-USERS][POST] admin=${admin?.email ?? "-"} name=${name} email=${email} clientId=${clientId} role=${rawRole}`);

  if (!name || !email) {
    console.error(`[ADMIN-USERS][POST] missing-fields admin=${admin?.email ?? "-"} name='${name}' email='${email}'`);
    return NextResponse.json({ error: "Nome e e-mail sao obrigatorios" }, { status: 400 });
  }
  if (wantsGlobalAdmin && !canManagePrivilegedProfiles) {
    return NextResponse.json({ error: "Somente Global pode criar perfis privilegiados" }, { status: 403 });
  }
  if (clientId) {
    const selectedCompany = await findLocalCompanyById(clientId);
    if (!selectedCompany) {
      return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
    }
  }
  if (roleNeedsCompany(role, wantsGlobalAdmin) && !clientId) {
    console.error(`[ADMIN-USERS][POST] missing-client admin=${admin?.email ?? "-"} clientId=${clientId}`);
    return NextResponse.json({ error: "Empresa obrigatoria para este perfil" }, { status: 400 });
  }
  if (wantsGlobalAdmin && (!password || password.trim().length < 8)) {
    return NextResponse.json({ error: "Senha obrigatoria com pelo menos 8 caracteres para criar Global" }, { status: 400 });
  }

  const users = await listLocalUsers();
  const login = buildUniqueLogin(
    users,
    rawLogin,
    fullName || name || email.split("@")[0] || "usuario",
  );

  if (users.some((user) => normalizeLogin(user.email) === email)) {
    console.error(`[ADMIN-USERS][POST] duplicate-email admin=${admin?.email ?? "-"} email=${email}`);
    return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
  }
  if (users.some((user) => normalizeLogin(user.user ?? user.email) === login)) {
    console.error(`[ADMIN-USERS][POST] duplicate-user admin=${admin?.email ?? "-"} login=${login}`);
    return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
  }

  const tempPassword = hashPasswordSha256(`${Date.now()}-${randomUUID()}`);
  const passwordHash = password && password.trim() ? hashPasswordSha256(password.trim()) : tempPassword;
  let user = null;
  try {
    user = await createLocalUser({
      full_name: fullName,
      name,
      email,
      user: login,
      password_hash: passwordHash,
      active: true,
      role: wantsGlobalAdmin && role !== "it_dev" ? "user" : role,
      globalRole: wantsGlobalAdmin ? "global_admin" : null,
      is_global_admin: wantsGlobalAdmin,
      job_title: jobTitle || null,
      linkedin_url: linkedinUrl || null,
      avatar_url: avatarUrl || null,
      phone,
    });
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    console.error(`[ADMIN-USERS][POST] createLocalUser error admin=${admin?.email ?? "-"} code=${code} err=${String(err)}`);
    if (code === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
    }
    if (code === "DUPLICATE_USER") {
      return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
    }
    throw err;
  }

  if (clientId && !wantsGlobalAdmin) {
    try {
      await upsertLocalLink({ userId: user.id, companyId: clientId, role, capabilities });
    } catch (error) {
      if (isUserScopeLockedError(error)) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email,
    metadata: { companyId: clientId, role },
  });

  console.error(`[ADMIN-USERS][POST] created admin=${admin?.email ?? "-"} user=${user?.email ?? user?.id}`);
  const item = user ? await getAdminUserItem(user.id) : null;
  return NextResponse.json({ ok: true, item }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }
  const access = await getAccessContext(req);
  const canManagePrivilegedProfiles = isGlobalDeveloperAccess(access);

  const body = await req.json().catch(() => null);
  const userId = typeof body?.id === "string" ? body.id : "";
  if (!userId) {
    return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const hasLogin = typeof body?.user === "string";
  const login = hasLogin ? normalizeLogin(body?.user) : null;
  const active = typeof body?.active === "boolean" ? body.active : null;
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const jobTitle = typeof body?.job_title === "string" ? body.job_title.trim() || null : null;
  const linkedinUrl = typeof body?.linkedin_url === "string" ? body.linkedin_url.trim() || null : null;
  const hasAvatarUrl = hasOwn(body as Record<string, unknown> | null, "avatar_url");
  const avatarUrl = hasAvatarUrl
    ? typeof body?.avatar_url === "string"
      ? body.avatar_url.trim() || null
      : null
    : undefined;
  const rawRole = typeof body?.role === "string" ? body.role : "";
  const profileRole = resolveEditableProfileRole(rawRole) ?? "user";
  const wantsGlobalAdmin = isGlobalPrivilegeProfileRole(profileRole);
  const role = toStoredEditableUserRole(profileRole);
  const fullName =
    typeof body?.full_name === "string"
      ? body.full_name.trim() || null
      : typeof body?.fullName === "string"
        ? body.fullName.trim() || null
        : undefined;
  const phone = typeof body?.phone === "string" ? body.phone.trim() || null : undefined;
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;
  const selectedCompany = clientId ? await findLocalCompanyById(clientId) : null;

  if (wantsGlobalAdmin && !canManagePrivilegedProfiles) {
    return NextResponse.json({ error: "Somente Global pode promover perfis privilegiados" }, { status: 403 });
  }
  if (clientId && !selectedCompany) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const existingLinks = rawRole ? await listLocalLinksForUser(userId) : [];
  if (rawRole && roleNeedsCompany(role, wantsGlobalAdmin) && !clientId && existingLinks.length === 0) {
    return NextResponse.json({ error: "Empresa obrigatoria para este perfil" }, { status: 400 });
  }

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
      ...(fullName !== undefined ? { full_name: fullName } : {}),
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(hasLogin ? { user: login ?? "" } : {}),
      ...(active !== null ? { active } : {}),
      ...(jobTitle !== null ? { job_title: jobTitle } : {}),
      ...(linkedinUrl !== null ? { linkedin_url: linkedinUrl } : {}),
      ...(hasAvatarUrl ? { avatar_url: avatarUrl ?? null } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(rawRole
        ? {
            role: wantsGlobalAdmin && role !== "it_dev" ? "user" : role,
            globalRole: wantsGlobalAdmin ? "global_admin" : null,
            is_global_admin: wantsGlobalAdmin,
            ...(wantsGlobalAdmin
              ? { default_company_slug: null }
              : selectedCompany
                ? { default_company_slug: selectedCompany.slug }
                : {}),
          }
        : {}),
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

  if (rawRole && !roleNeedsCompany(role, wantsGlobalAdmin) && existingLinks.length > 0) {
    for (const link of existingLinks) {
      await removeLocalLink(userId, link.companyId);
    }
  } else if (rawRole && roleNeedsCompany(role, wantsGlobalAdmin) && clientId) {
    try {
      await upsertLocalLink({ userId, companyId: clientId, role, capabilities });
    } catch (error) {
      if (isUserScopeLockedError(error)) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.updated",
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.email,
    metadata: { companyId: clientId, role, active },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
