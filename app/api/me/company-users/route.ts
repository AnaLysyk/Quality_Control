import { NextRequest, NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { listAdminUserItems } from "@/lib/adminUsers";
import { createLocalUser, upsertLocalLink } from "@/lib/auth/localStore";
import { getAccessContext } from "@/lib/auth/session";
import {
  buildCompanyScopedUserState,
  isUserScopeLockedError,
} from "@/lib/companyUserScope";
import {
  canManageInstitutionalCompanyAccess,
  resolveCurrentCompanyFromAccess,
} from "@/lib/companyProfileAccess";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";
import {
  canCreateCompanyUsersByScope,
  canViewCompanyUsersByScope,
  resolveUserScopePolicy,
} from "@/lib/userScopePolicy";

export const runtime = "nodejs";
export const revalidate = 0;

function normalizeMembershipRole(input?: string | null) {
  const value = (input ?? "").trim().toLowerCase();
  if (
    value === "company" ||
    value === "company_admin" ||
    value === "client_admin" ||
    value === "admin" ||
    value === "empresa"
  ) {
    return "empresa" as const;
  }
  if (value === "viewer" || value === "client_viewer" || value === "testing_company_user") {
    return "testing_company_user" as const;
  }
  return "company_user" as const;
}

function canManageCompanyUsers(
  access: Awaited<ReturnType<typeof getAccessContext>>,
) {
  return canManageInstitutionalCompanyAccess(access);
}

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  const { company, status } = await resolveCurrentCompanyFromAccess(access);
  if (!access) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!company) {
    const message = status === 403 ? "Sem empresa vinculada" : "Empresa não encontrada";
    return NextResponse.json({ error: message }, { status });
  }

  const permissionAccess = await resolvePermissionAccessForUser(access.userId);
  const scopePolicy = resolveUserScopePolicy(permissionAccess.roleKey);
  const institutionalManager = canManageCompanyUsers(access);
  const canViewUsers =
    hasPermissionAccess(permissionAccess.permissions, "users", "view") ||
    hasPermissionAccess(permissionAccess.permissions, "users", "view_company") ||
    hasPermissionAccess(permissionAccess.permissions, "users", "view_all") ||
    hasPermissionAccess(permissionAccess.permissions, "users", "create");
  if ((!canViewUsers || !canViewCompanyUsersByScope(scopePolicy)) && !institutionalManager) {
    return NextResponse.json({ error: "Sem permissão para visualizar usuários da empresa" }, { status: 403 });
  }

  const items = await listAdminUserItems({ companyId: company.id });

  return NextResponse.json(
    {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        user: item.user ?? "",
        permission_role: item.permission_role ?? "company_user",
        active: item.active !== false,
        status: item.status ?? (item.active === false ? "inactive" : "active"),
        avatar_url: item.avatar_url ?? null,
        user_origin: item.user_origin ?? "testing_company",
        user_scope: item.user_scope ?? "shared",
        allow_multi_company_link: item.allow_multi_company_link !== false,
        origin_label: item.origin_label ?? "Interno TC",
      })),
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const access = await getAccessContext(req);
  const { company, status } = await resolveCurrentCompanyFromAccess(access);
  if (!access) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!company || !access.companySlug) {
    const message = status === 403 ? "Sem empresa ativa" : "Empresa não encontrada";
    return NextResponse.json({ error: message }, { status });
  }
  if (!canManageCompanyUsers(access)) {
    return NextResponse.json({ error: "Sem permissão para criar usuários da empresa" }, { status: 403 });
  }

  const permissionAccess = await resolvePermissionAccessForUser(access.userId);
  const scopePolicy = resolveUserScopePolicy(permissionAccess.roleKey);
  const institutionalManager = canManageCompanyUsers(access);
  if (
    (
      !hasPermissionAccess(permissionAccess.permissions, "users", "create") ||
      !canCreateCompanyUsersByScope(scopePolicy)
    ) &&
    !institutionalManager
  ) {
    return NextResponse.json({ error: "Sem permissão para criar usuários da empresa" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const login =
    typeof body?.username === "string" && body.username.trim()
      ? body.username.trim().toLowerCase()
      : typeof body?.user === "string" && body.user.trim()
        ? body.user.trim().toLowerCase()
        : "";
  const password = typeof body?.password === "string" ? body.password.trim() : "";
  const permissionRole =
    typeof body?.permission_role === "string"
      ? body.permission_role
      : typeof body?.role === "string"
        ? body.role
        : "company_user";
  const membershipRole = normalizeMembershipRole(permissionRole);

  if (!name || !email) {
    return NextResponse.json({ error: "Nome e e-mail sao obrigatorios" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Senha obrigatória com pelo menos 8 caracteres" }, { status: 400 });
  }

  try {
    const user = await createLocalUser({
      full_name: name,
      name,
      email,
      ...(login ? { user: login } : {}),
      password_hash: hashPasswordSha256(password),
      active: true,
      role: "company_user",
      globalRole: null,
      is_global_admin: false,
      default_company_slug: access.companySlug,
      ...buildCompanyScopedUserState(company.id),
    });

    await upsertLocalLink({
      userId: user.id,
      companyId: company.id,
      role: membershipRole,
      capabilities: [],
    });

    await addAuditLogSafe({
      actorUserId: access.userId,
      actorEmail: access.email,
      action: "user.created",
      entityType: "user",
      entityId: user.id,
      entityLabel: user.user ?? user.email,
      metadata: {
        companyId: company.id,
        companySlug: access.companySlug,
        membershipRole,
        user_origin: "client_company",
        user_scope: "company_only",
      },
    });

    const items = await listAdminUserItems({ companyId: company.id });
    const created = items.find((item) => item.id === user.id) ?? null;

    return NextResponse.json(
      {
        ok: true,
        item:
          created
            ? {
                id: created.id,
                name: created.name,
                email: created.email,
                user: created.user ?? "",
                permission_role: created.permission_role ?? "user",
                active: created.active !== false,
                status: created.status ?? (created.active === false ? "inactive" : "active"),
                avatar_url: created.avatar_url ?? null,
                user_origin: created.user_origin ?? "client_company",
                user_scope: created.user_scope ?? "company_only",
                allow_multi_company_link: created.allow_multi_company_link !== false,
                origin_label: created.origin_label ?? "Da empresa",
              }
            : null,
      },
      { status: 201 },
    );
  } catch (error) {
    const code = error && typeof error === "object" ? (error as { code?: string }).code : null;
    if (code === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }
    if (code === "DUPLICATE_USER") {
      return NextResponse.json({ error: "Usuário já cadastrado" }, { status: 409 });
    }
    if (isUserScopeLockedError(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "Não foi possível criar o usuário da empresa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
