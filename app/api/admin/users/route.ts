import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { hashPassword } from "@/backend/passwordHash";
import { brainOnUserCreated } from "@/backend/brain/autoSync";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { type AccessContext } from "@/backend/auth/session";
import { getAdminUserItem, listAdminUserItems } from "@/backend/adminUsers";
import {
  editableProfileNeedsCompany,
  editableProfileUsesAutomaticCompany,
  isGlobalPrivilegeProfileRole,
  resolveEditableProfileUserState,
  resolveEditableProfileRole,
  toStoredEditableUserRole,
} from "@/backend/editableProfileRoles";
import { isUserScopeLockedError } from "@/backend/companyUserScope";
import {
  createLocalUser,
  findLocalCompanyById,
  findLocalCompanyBySlug,
  listLocalLinksForUser,
  listLocalMemberships,
  listLocalUsers,
  removeLocalLink,
  updateLocalUser,
  upsertLocalLink,
} from "@/backend/auth/localStore";
import { normalizeLegacyRole, SYSTEM_ROLES } from "@/backend/auth/roles";
import { resolveOperationalContext } from "@/backend/context/operationalContext";
import { validarAcessoUsuariosNoServidor } from "@/backend/permissions/validarAcessoUsuariosNoServidor";
import { readSyncedUserProfileFields, sanitizeUserProfileText } from "@/backend/userProfileData";
import { emailService } from "@/backend/email";

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

  return normalized || "usuário";
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

function canManageInstitutionalProfiles(
  access: AccessContext | null,
  userAccess?: { canManagePrivilegedProfiles?: boolean } | null,
) {
  if (userAccess?.canManagePrivilegedProfiles) return true;
  if (!access) return false;
  const role = normalizeLegacyRole(access.role);
  const companyRole = normalizeLegacyRole(access.companyRole);
  if (role === SYSTEM_ROLES.TECHNICAL_SUPPORT || companyRole === SYSTEM_ROLES.TECHNICAL_SUPPORT) return false;
  return access.isGlobalAdmin === true || role === SYSTEM_ROLES.LEADER_TC || companyRole === SYSTEM_ROLES.LEADER_TC;
}

function isCompanyScopedCreator(access: AccessContext | null) {
  if (!access) return false;
  const role = normalizeLegacyRole(access.role);
  const companyRole = normalizeLegacyRole(access.companyRole);
  return role === SYSTEM_ROLES.EMPRESA || companyRole === SYSTEM_ROLES.EMPRESA;
}

function wantsLoginSummary(searchParams: URLSearchParams) {
  const summary = (searchParams.get("summary") ?? searchParams.get("select") ?? "").trim().toLowerCase();
  return summary === "logins" || summary === "login" || summary === "identity";
}

async function listUserLoginSummary(options?: { companyId?: string | null }) {
  const users = await listLocalUsers();
  const companyId = options?.companyId ?? null;

  if (!companyId) {
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      user: user.user ?? null,
    }));
  }

  const memberships = await listLocalMemberships();
  const userIds = new Set(
    memberships
      .filter((membership) => membership.companyId === companyId)
      .map((membership) => membership.userId),
  );

  return users
    .filter((user) => userIds.has(user.id))
    .map((user) => ({
      id: user.id,
      email: user.email,
      user: user.user ?? null,
    }));
}

async function includeLoggedUserInList<T extends { id: string }>(
  items: T[],
  access: AccessContext,
) {
  if (!access?.userId) return items;
  if (items.some((item) => item.id === access.userId)) return items;

  const currentUserItem = await getAdminUserItem(access.userId);
  if (!currentUserItem) return items;

  return [...items, currentUserItem as unknown as T];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");
  const loginSummary = wantsLoginSummary(searchParams);
  const contextResult = await resolveOperationalContext(req, {
    moduleId: "users",
    action: "view",
    companyId: clientId,
  });
  if (!contextResult.ok) return contextResult.response;

  const { context } = contextResult;
  const access = context.access;
  const isGlobalScope = context.scope === "global";

  if (!isGlobalScope) {
    if (!context.companyId) {
      return NextResponse.json({ error: "Sem empresa vinculada" }, { status: 403 });
    }
    if (loginSummary) {
      const items = await listUserLoginSummary({ companyId: context.companyId });
      return NextResponse.json({ items }, { status: 200, headers: { "x-qc-mode": "logins" } });
    }
    const items = await includeLoggedUserInList(await listAdminUserItems({ companyId: context.companyId }), access);
    return NextResponse.json({ items }, { status: 200 });
  }

  if (loginSummary) {
    const items = await listUserLoginSummary({ companyId: clientId });
    return NextResponse.json({ items }, { status: 200, headers: { "x-qc-mode": "logins" } });
  }

  if (clientId) {
    const items = await listAdminUserItems({ companyId: clientId });
    return NextResponse.json({ items }, { status: 200 });
  }

  const items = await includeLoggedUserInList(await listAdminUserItems(), access);
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const rawClientId = typeof body?.client_id === "string" ? body.client_id.trim() : "";
  const rawClientSlug =
    (typeof body?.clientSlug === "string" ? body.clientSlug.trim() : "") ||
    (typeof body?.companySlug === "string" ? body.companySlug.trim() : "");
  let clientId = rawClientId || null;
  if (!clientId && rawClientSlug) {
    const companyBySlug = await findLocalCompanyBySlug(rawClientSlug);
    clientId = companyBySlug?.id ?? null;
  }

  const contextResult = await resolveOperationalContext(req, {
    moduleId: "users",
    action: "create",
    companyId: clientId,
    companySlug: rawClientSlug || null,
  });
  if (!contextResult.ok) return contextResult.response;

  const access = contextResult.context.access;
  const userAccess = await validarAcessoUsuariosNoServidor(access);
  if (!userAccess.canCreateUsers) {
    return NextResponse.json({ error: "Sem permissão para criar usuários" }, { status: 403 });
  }
  const canManageProfiles = canManageInstitutionalProfiles(access, userAccess);
  const companyScopedCreator = isCompanyScopedCreator(access);

  const profileFields = readSyncedUserProfileFields(body);
  const fullName = profileFields.fullName;
  const name = profileFields.name;
  const email = profileFields.email;
  const rawLogin = profileFields.login ?? "";
  const phone = profileFields.phone;
  const jobTitle = profileFields.jobTitle;
  const linkedinUrl = profileFields.linkedinUrl;
  const avatarUrl = profileFields.avatarUrl;
  const rawRole = typeof body?.role === "string" ? body.role : "";
  const profileRole = resolveEditableProfileRole(rawRole) ?? (companyScopedCreator ? "company_user" : "testing_company_user");
  const wantsGlobalAdmin = isGlobalPrivilegeProfileRole(profileRole);
  const role = toStoredEditableUserRole(profileRole);
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;

  if (companyScopedCreator) {
    if (profileRole !== SYSTEM_ROLES.COMPANY_USER) {
      return NextResponse.json({ error: "Empresa só pode criar usuário empresarial" }, { status: 403 });
    }
    if (!access.companyId) {
      return NextResponse.json({ error: "Empresa sem contexto ativo" }, { status: 403 });
    }
    if (clientId && clientId !== access.companyId) {
      return NextResponse.json({ error: "Empresa só pode criar usuário na própria empresa" }, { status: 403 });
    }
    clientId = access.companyId;
  }

  if (editableProfileUsesAutomaticCompany(profileRole) && !clientId) {
    const testingCompany =
      (await findLocalCompanyBySlug("testing-company")) ??
      (await findLocalCompanyBySlug("testing-company-e2e"));
    clientId = testingCompany?.id ?? null;
    if (!clientId) {
      return NextResponse.json(
        { error: "Testing Company não encontrada para vínculo automático" },
        { status: 409 },
      );
    }
  }

  if (!name || !email) {
    return NextResponse.json({ error: "Nome e e-mail sao obrigatorios" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
  }
  if (wantsGlobalAdmin && !canManageProfiles) {
    return NextResponse.json({ error: "Somente Lider TC pode criar perfis privilegiados" }, { status: 403 });
  }
  if (clientId) {
    const selectedCompany = await findLocalCompanyById(clientId);
    if (!selectedCompany) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }
  }
  if (editableProfileNeedsCompany(profileRole) && !clientId) {
    return NextResponse.json({ error: "Empresa obrigatória para este perfil" }, { status: 400 });
  }

  const users = await listLocalUsers();
  const login = buildUniqueLogin(
    users,
    rawLogin,
    fullName || name || email.split("@")[0] || "usuário",
  );

  if (users.some((user) => normalizeLogin(user.email) === email)) {
    return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
  }
  if (users.some((user) => normalizeLogin(user.user ?? user.email) === login)) {
    return NextResponse.json({ error: "Usuário já cadastrado" }, { status: 409 });
  }

  const rawTemp = randomUUID().replace(/-/g, "");
  const plainTempPassword = rawTemp.charAt(0).toUpperCase() + rawTemp.slice(1, 9) + "!";
  const passwordHash = hashPassword(plainTempPassword);
  let user = null;
  try {
    user = await createLocalUser({
      full_name: fullName ?? name,
      name,
      email,
      user: login,
      password_hash: passwordHash,
      active: true,
      role,
      globalRole: wantsGlobalAdmin ? "global_admin" : null,
      is_global_admin: wantsGlobalAdmin,
      ...resolveEditableProfileUserState(profileRole, clientId),
      job_title: jobTitle || null,
      linkedin_url: linkedinUrl || null,
      avatar_url: avatarUrl || null,
      phone,
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

  if (clientId && editableProfileNeedsCompany(profileRole)) {
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
    actorUserId: access.userId,
    actorEmail: access.email,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.user ?? user.email,
    metadata: { companyId: clientId, role, profileRole },
  });

  brainOnUserCreated({
    id: user.id,
    name: user.user ?? user.email,
    email: user.email ?? undefined,
    role: user.role ?? undefined,
  }).catch(() => {});

  if (user.email) {
    emailService
      .sendWelcomeEmail(user.email, login, plainTempPassword, fullName ?? name)
      .catch((err) => console.error("[ADMIN-USERS][POST] welcome-email-error", err));
  }

  const item = user ? await getAdminUserItem(user.id) : null;
  return NextResponse.json({ ok: true, id: user?.id ?? null, user, item }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const userId = typeof body?.id === "string" ? body.id : "";
  if (!userId) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const contextResult = await resolveOperationalContext(req, {
    moduleId: "users",
    action: "edit",
    companyId: clientId,
  });
  if (!contextResult.ok) return contextResult.response;

  const access = contextResult.context.access;
  const userAccess = await validarAcessoUsuariosNoServidor(access);
  if (!userAccess.canEditUsers) {
    return NextResponse.json({ error: "Sem permissão para editar usuários" }, { status: 403 });
  }
  const canManageProfiles = canManageInstitutionalProfiles(access, userAccess);

  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const hasLogin = typeof body?.user === "string";
  const login = hasLogin ? normalizeLogin(body?.user) : null;
  const active = typeof body?.active === "boolean" ? body.active : null;
  const hasJobTitle = hasOwn(body as Record<string, unknown> | null, "job_title") || hasOwn(body as Record<string, unknown> | null, "jobTitle");
  const jobTitle = hasJobTitle ? sanitizeUserProfileText(body?.job_title ?? body?.jobTitle, 120) : undefined;
  const hasLinkedinUrl = hasOwn(body as Record<string, unknown> | null, "linkedin_url") || hasOwn(body as Record<string, unknown> | null, "linkedinUrl");
  const linkedinUrl = hasLinkedinUrl ? sanitizeUserProfileText(body?.linkedin_url ?? body?.linkedinUrl, 255) : undefined;
  const hasAvatarUrl = hasOwn(body as Record<string, unknown> | null, "avatar_url");
  const avatarUrl = hasAvatarUrl
    ? typeof body?.avatar_url === "string"
      ? body.avatar_url.trim() || null
      : null
    : undefined;
  const rawRole = typeof body?.role === "string" ? body.role : "";
  const profileRole = resolveEditableProfileRole(rawRole) ?? "testing_company_user";
  const wantsGlobalAdmin = isGlobalPrivilegeProfileRole(profileRole);
  const role = toStoredEditableUserRole(profileRole);
  const fullName =
    typeof body?.full_name === "string"
      ? body.full_name.trim() || null
      : typeof body?.fullName === "string"
        ? body.fullName.trim() || null
        : name ?? undefined;
  const hasPhone = hasOwn(body as Record<string, unknown> | null, "phone");
  const phone = hasPhone ? sanitizeUserProfileText(body?.phone, 80) : undefined;
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;
  const selectedCompany = clientId ? await findLocalCompanyById(clientId) : null;

  if (wantsGlobalAdmin && !canManageProfiles) {
    return NextResponse.json({ error: "Somente Lider TC pode promover perfis privilegiados" }, { status: 403 });
  }
  if (clientId && !selectedCompany) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const existingLinks = rawRole ? await listLocalLinksForUser(userId) : [];
  if (rawRole && editableProfileNeedsCompany(profileRole) && !clientId && existingLinks.length === 0) {
    return NextResponse.json({ error: "Empresa obrigatória para este perfil" }, { status: 400 });
  }

  if (email || login) {
    const users = await listLocalUsers();
    if (email && users.some((user) => user.id !== userId && normalizeLogin(user.email) === email)) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }
    if (login && users.some((user) => user.id !== userId && normalizeLogin(user.user ?? user.email) === login)) {
      return NextResponse.json({ error: "Usuário já cadastrado" }, { status: 409 });
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
      ...(hasJobTitle ? { job_title: jobTitle ?? null } : {}),
      ...(hasLinkedinUrl ? { linkedin_url: linkedinUrl ?? null } : {}),
      ...(hasAvatarUrl ? { avatar_url: avatarUrl ?? null } : {}),
      ...(hasPhone ? { phone: phone ?? null } : {}),
      ...(rawRole
        ? {
            role,
            globalRole: wantsGlobalAdmin ? "global_admin" : null,
            is_global_admin: wantsGlobalAdmin,
            ...resolveEditableProfileUserState(profileRole, clientId),
            ...(editableProfileNeedsCompany(profileRole) && selectedCompany
              ? { default_company_slug: selectedCompany.slug }
              : { default_company_slug: null }),
          }
        : {}),
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

  if (!updated) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  if (rawRole && !editableProfileNeedsCompany(profileRole) && existingLinks.length > 0) {
    for (const link of existingLinks) {
      await removeLocalLink(userId, link.companyId);
    }
  } else if (rawRole && editableProfileNeedsCompany(profileRole) && clientId) {
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
    actorUserId: access.userId,
    actorEmail: access.email,
    action: "user.updated",
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.user ?? updated.email,
    metadata: { companyId: clientId, role, active, _payload: body },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
