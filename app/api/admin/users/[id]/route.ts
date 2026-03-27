import { NextRequest, NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { canDeleteUserByProfile, isGlobalDeveloperAccess } from "@/lib/adminUserDeleteAccess";
import { getAdminUserItem } from "@/lib/adminUsers";
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

type PermissionRole = "admin" | "dev" | "company" | "user";

function hasOwn(obj: Record<string, unknown> | null, key: string) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeRole(input?: string | null) {
  const value = (input ?? "").toLowerCase();
  if (value === "client_admin" || value === "admin" || value === "global_admin" || value === "company_admin") return "company_admin";
  if (value === "it_dev" || value === "itdev" || value === "developer" || value === "dev") return "it_dev";
  if (value === "viewer" || value === "client_viewer") return "viewer";
  return "user";
}

function normalizeLogin(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePermissionRole(input?: string | null): PermissionRole | null {
  const value = (input ?? "").toLowerCase().trim();
  if (value === "admin" || value === "global_admin") return "admin";
  if (value === "dev" || value === "it_dev" || value === "itdev" || value === "developer") return "dev";
  if (value === "company" || value === "company_admin" || value === "client_admin") return "company";
  if (value === "user" || value === "viewer" || value === "client_user") return "user";
  return null;
}

function membershipRoleFromPermissionRole(role: PermissionRole) {
  if (role === "dev") return "it_dev";
  if (role === "company") return "company_admin";
  return "user";
}

function permissionRoleNeedsCompany(role: PermissionRole) {
  return role === "user";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(_req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
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
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }
  const access = await getAccessContext(req);
  const canManagePrivilegedProfiles = isGlobalDeveloperAccess(access);

  const { id } = await params;
  const body = await req.json().catch(() => null);

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
  const wantsGlobalAdmin = permissionRole
    ? permissionRole === "admin" || permissionRole === "dev"
    : ["global_admin", "it_dev", "itdev", "developer", "dev"].includes(rawRole.trim().toLowerCase());
  const role = permissionRole ? membershipRoleFromPermissionRole(permissionRole) : normalizeRole(rawRole);
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;

  if ((permissionRole === "admin" || permissionRole === "dev" || wantsGlobalAdmin) && !canManagePrivilegedProfiles) {
    return NextResponse.json({ error: "Somente Global pode atribuir perfis privilegiados" }, { status: 403 });
  }

  const selectedCompany = clientId ? await findLocalCompanyById(clientId) : null;
  if (clientId && !selectedCompany) {
    return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404 });
  }

  const existingLinks = permissionRole ? await listLocalLinksForUser(id) : [];
  const targetCompanyIds = permissionRole
    ? permissionRoleNeedsCompany(permissionRole)
      ? Array.from(
          new Set(
            [...existingLinks.map((link) => link.companyId).filter(Boolean), ...(clientId ? [clientId] : [])].filter(Boolean),
          ),
        )
      : []
    : [];

  if (permissionRole && permissionRoleNeedsCompany(permissionRole) && targetCompanyIds.length === 0) {
    return NextResponse.json(
      { error: "Esse perfil precisa de pelo menos uma empresa vinculada" },
      { status: 400 },
    );
  }

  if (email || login) {
    const users = await listLocalUsers();
    if (email && users.some((user) => user.id !== id && normalizeLogin(user.email) === email)) {
      return NextResponse.json({ error: "E-mail ja cadastrado" }, { status: 409 });
    }
    if (login && users.some((user) => user.id !== id && normalizeLogin(user.user ?? user.email) === login)) {
      return NextResponse.json({ error: "Usuario ja cadastrado" }, { status: 409 });
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
      ...(permissionRole ? { role: permissionRole === "admin" ? "user" : role } : {}),
      ...(permissionRole && !permissionRoleNeedsCompany(permissionRole)
        ? { default_company_slug: null }
        : selectedCompany
          ? { default_company_slug: selectedCompany.slug }
          : { default_company_slug: null }),
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
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (permissionRole && !permissionRoleNeedsCompany(permissionRole) && existingLinks.length > 0) {
    for (const link of existingLinks) {
      await removeLocalLink(id, link.companyId);
    }
  } else if (permissionRole && permissionRoleNeedsCompany(permissionRole) && targetCompanyIds.length > 0) {
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
    entityLabel: updated.email,
    metadata: { companyId: clientId, role, permissionRole, active },
  });

  const item = await getAdminUserItem(id);
  return NextResponse.json({ item: item ?? null }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const access = await getAccessContext(req);
  const { id } = await params;
  const target = await getAdminUserItem(id);

  if (!target) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (!canDeleteUserByProfile(access, target.permission_role)) {
    return NextResponse.json({ error: "Sem permissao para excluir este perfil" }, { status: 403 });
  }

  const updated = await updateLocalUser(id, {
    active: false,
    status: "blocked",
  });

  if (!updated) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.deleted",
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.email,
    metadata: {
      targetPermissionRole: target.permission_role ?? null,
      actorRole: access?.role ?? null,
    },
  });

  const item = await getAdminUserItem(id);
  return NextResponse.json({ ok: true, item: item ?? null }, { status: 200 });
}
