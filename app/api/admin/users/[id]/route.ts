import { NextRequest, NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { canDeleteUserByProfile, canManageInstitutionalProfiles } from "@/lib/adminUserDeleteAccess";
import { getAdminUserItem } from "@/lib/adminUsers";
import {
  editableProfileNeedsCompany,
  isGlobalPrivilegeProfileRole,
  resolveEditableProfileUserState,
  resolveEditableProfileRole,
  toStoredEditableUserRole,
  type EditableProfileRole,
} from "@/lib/editableProfileRoles";
import { isUserScopeLockedError } from "@/lib/companyUserScope";
import {
  findLocalCompanyById,
  listLocalLinksForUser,
  listLocalUsers,
  removeLocalLink,
  updateLocalUser,
  upsertLocalLink,
} from "@/lib/auth/localStore";
import { getAccessContext } from "@/lib/auth/session";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

export const revalidate = 0;

type PermissionRole = EditableProfileRole;

function hasOwn(obj: Record<string, unknown> | null, key: string) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeRole(input?: string | null) {
  const normalized = resolveEditableProfileRole(input);
  return normalized ? toStoredEditableUserRole(normalized) : "user";
}

function normalizeLogin(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePermissionRole(input?: string | null): PermissionRole | null {
  return resolveEditableProfileRole(input);
}

function membershipRoleFromPermissionRole(role: PermissionRole) {
  return toStoredEditableUserRole(role);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(_req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const { id } = await params;
  const item = await getAdminUserItem(id);
  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }
  const access = await getAccessContext(req);
  const canManageProfiles = canManageInstitutionalProfiles(access);

  const { id } = await params;
  const body = await req.json().catch(() => null);

  // Snapshot before state for audit diff
  const beforeSnapshot = await getAdminUserItem(id);
  if (!beforeSnapshot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const fullName =
    typeof body?.full_name === "string"
      ? body.full_name.trim() || null
      : typeof body?.fullName === "string"
        ? body.fullName.trim() || null
        : name;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const hasLogin = typeof body?.user === "string";
  const login = hasLogin ? normalizeLogin(body?.user) : null;
  const active = typeof body?.active === "boolean" ? body.active : null;
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const permissionRole =
    normalizePermissionRole(typeof body?.permission_role === "string" ? body.permission_role : null) ??
    normalizePermissionRole(typeof body?.profile_role === "string" ? body.profile_role : null);
  const jobTitle = typeof body?.job_title === "string" ? body.job_title.trim() || null : null;
  const linkedinUrl = typeof body?.linkedin_url === "string" ? body.linkedin_url.trim() || null : null;
  const hasAvatarUrl = hasOwn(body as Record<string, unknown> | null, "avatar_url");
  const avatarUrl = hasAvatarUrl
    ? typeof body?.avatar_url === "string"
      ? body.avatar_url.trim() || null
      : null
    : undefined;
  const rawRole = typeof body?.role === "string" ? body.role : "";
  const rawProfileRole = resolveEditableProfileRole(rawRole);
  const effectiveProfileRole = permissionRole ?? rawProfileRole;
  const wantsGlobalAdmin = effectiveProfileRole ? isGlobalPrivilegeProfileRole(effectiveProfileRole) : false;
  const role = effectiveProfileRole ? membershipRoleFromPermissionRole(effectiveProfileRole) : normalizeRole(rawRole);
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;

  if (wantsGlobalAdmin && !canManageProfiles) {
    return NextResponse.json({ error: "Somente Lider TC pode atribuir perfis privilegiados" }, { status: 403 });
  }

  const selectedCompany = clientId ? await findLocalCompanyById(clientId) : null;
  if (clientId && !selectedCompany) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }

  const existingLinks = effectiveProfileRole ? await listLocalLinksForUser(id) : [];
  const targetCompanyIds = effectiveProfileRole
    ? editableProfileNeedsCompany(effectiveProfileRole)
      ? Array.from(
          new Set(
            [...existingLinks.map((link) => link.companyId).filter(Boolean), ...(clientId ? [clientId] : [])].filter(Boolean),
          ),
        )
    : []
    : [];

  if (effectiveProfileRole && editableProfileNeedsCompany(effectiveProfileRole) && targetCompanyIds.length === 0) {
    return NextResponse.json(
      { error: "Esse perfil precisa de pelo menos uma empresa vinculada" },
      { status: 400 },
    );
  }

  if (email || login) {
    const users = await listLocalUsers();
    if (email && users.some((user) => user.id !== id && normalizeLogin(user.email) === email)) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }
    if (login && users.some((user) => user.id !== id && normalizeLogin(user.user ?? user.email) === login)) {
      return NextResponse.json({ error: "Usuário já cadastrado" }, { status: 409 });
    }
  }

  let updated = null;
  try {
    updated = await updateLocalUser(id, {
      ...(name ? { name } : {}),
      ...(fullName !== null ? { full_name: fullName } : {}),
      ...(email ? { email } : {}),
      ...(hasLogin ? { user: login ?? "" } : {}),
      ...(active !== null ? { active } : {}),
      ...(jobTitle !== null ? { job_title: jobTitle } : {}),
      ...(linkedinUrl !== null ? { linkedin_url: linkedinUrl } : {}),
      ...(hasAvatarUrl ? { avatar_url: avatarUrl ?? null } : {}),
      ...(rawRole || permissionRole
        ? { globalRole: wantsGlobalAdmin ? "global_admin" : null, is_global_admin: wantsGlobalAdmin }
        : {}),
      ...(rawRole || permissionRole ? { role } : {}),
      ...(effectiveProfileRole ? resolveEditableProfileUserState(effectiveProfileRole, clientId) : {}),
      ...(effectiveProfileRole && !editableProfileNeedsCompany(effectiveProfileRole)
        ? { default_company_slug: null }
        : selectedCompany
          ? { default_company_slug: selectedCompany.slug }
          : { default_company_slug: null }),
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
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (effectiveProfileRole && !editableProfileNeedsCompany(effectiveProfileRole) && existingLinks.length > 0) {
    for (const link of existingLinks) {
      await removeLocalLink(id, link.companyId);
    }
  } else if (effectiveProfileRole && editableProfileNeedsCompany(effectiveProfileRole) && targetCompanyIds.length > 0) {
    const nextCapabilities = capabilities ?? [];
    try {
      for (const companyId of targetCompanyIds) {
        await upsertLocalLink({
          userId: id,
          companyId,
          role,
          capabilities: nextCapabilities,
        });
      }
    } catch (error) {
      if (isUserScopeLockedError(error)) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  } else if (clientId) {
    try {
      await upsertLocalLink({ userId: id, companyId: clientId, role, capabilities });
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
    entityLabel: updated.user ?? updated.email,
    metadata: {
      companyId: clientId,
      role,
      permissionRole,
      active,
      _before: {
        active: beforeSnapshot.active ?? null,
        role: beforeSnapshot.role ?? null,
        permissionRole: beforeSnapshot.permission_role ?? null,
        email: beforeSnapshot.email ?? null,
        name: beforeSnapshot.name ?? null,
      },
      _payload: body,
    },
  });

  const item = await getAdminUserItem(id);
  return NextResponse.json({ item: item ?? null }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const access = await getAccessContext(req);
  const { id } = await params;
  const target = await getAdminUserItem(id);

  if (!target) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  if (!canDeleteUserByProfile(access, target.permission_role)) {
    return NextResponse.json({ error: "Sem permissão para excluir este perfil" }, { status: 403 });
  }

  const updated = await updateLocalUser(id, {
    active: false,
    status: "blocked",
  });

  if (!updated) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.deleted",
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.user ?? updated.email,
    metadata: {
      targetPermissionRole: target.permission_role ?? null,
      actorRole: access?.role ?? null,
    },
  });

  const item = await getAdminUserItem(id);
  return NextResponse.json({ ok: true, item: item ?? null }, { status: 200 });
}
