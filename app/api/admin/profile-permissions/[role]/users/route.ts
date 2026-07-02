import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { getFixedProfileLabel } from "@/lib/fixedProfilePresentation";
import { prisma } from "@/lib/prismaClient";
import { applyPermissionOverride, normalizePermissionMatrix } from "@/lib/permissionMatrix";
import { resolverAcessoUsuarios } from "@/lib/permissions/validarAcessoUsuarios";
import { validarAcessoUsuariosNoServidor } from "@/lib/permissions/validarAcessoUsuariosNoServidor";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { resolveProfilePermissionDefaults } from "@/lib/store/profilePermissionsStore";
import { countPermissionActions } from "@/lib/store/userPermissionsStore";

export const revalidate = 0;

async function resolveRole(params: Promise<{ role: string }>) {
  const { role: rawRole } = await params;
  return normalizeLegacyRole(rawRole);
}

async function requirePermissionManager(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return {
      admin: null,
      access: null,
      response: NextResponse.json(
        { error: status === 401 ? "VocÃª precisa estar autenticado para acessar a GestÃ£o de Perfis." : "VocÃª nÃ£o tem permissÃ£o para acessar a GestÃ£o de Perfis." },
        { status },
      ),
    };
  }

  const accessContext = await getAccessContext(req);
  const access = accessContext
    ? await validarAcessoUsuariosNoServidor(accessContext)
    : resolverAcessoUsuarios({
        permissionRole: admin.role,
        role: admin.role,
        companyRole: admin.companyRole,
        globalRole: admin.globalRole,
        isGlobalAdmin: admin.isGlobalAdmin,
      });

  if (!access.canViewPermissions) {
    return {
      admin,
      access,
      response: NextResponse.json({ error: "VocÃª nÃ£o tem permissÃ£o para visualizar a matriz de perfis." }, { status: 403 }),
    };
  }

  return { admin, access, response: null };
}

function resolveUserRole(user: {
  role: unknown;
  globalRole: string | null;
  user_origin: string | null;
  user_scope: string | null;
  default_company_slug: string | null;
  home_company_id: string | null;
  created_by_company_id: string | null;
}): SystemRole | null {
  const globalRole = normalizeLegacyRole(user.globalRole ?? null);
  if (globalRole) return globalRole;

  const role = normalizeLegacyRole(typeof user.role === "string" ? user.role : String(user.role ?? ""));
  const looksCompanyUser =
    user.user_origin === "company" ||
    user.user_origin === "client" ||
    Boolean(user.home_company_id || user.created_by_company_id || user.default_company_slug);

  if (role === SYSTEM_ROLES.TESTING_COMPANY_USER && looksCompanyUser) {
    return SYSTEM_ROLES.COMPANY_USER;
  }

  return role ?? (looksCompanyUser ? SYSTEM_ROLES.COMPANY_USER : SYSTEM_ROLES.TESTING_COMPANY_USER);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;

    const role = await resolveRole(params);
    if (!role) return NextResponse.json({ error: "Perfil invÃ¡lido." }, { status: 400 });

    const profilePermissions = await resolveProfilePermissionDefaults(role);
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        full_name: true,
        email: true,
        role: true,
        globalRole: true,
        status: true,
        active: true,
        user_origin: true,
        user_scope: true,
        default_company_slug: true,
        home_company_id: true,
        created_by_company_id: true,
        permissionOverride: {
          select: {
            allow: true,
            deny: true,
            updatedAt: true,
            updatedBy: true,
          },
        },
      },
      orderBy: [{ active: "desc" }, { name: "asc" }, { email: "asc" }],
      take: 500,
    });

    const filtered = users
      .map((user) => {
        const userRole = resolveUserRole(user);
        const override = user.permissionOverride
          ? {
              allow: normalizePermissionMatrix(user.permissionOverride.allow),
              deny: normalizePermissionMatrix(user.permissionOverride.deny),
              updatedAt: user.permissionOverride.updatedAt.toISOString(),
              updatedBy: user.permissionOverride.updatedBy ?? null,
            }
          : null;
        const effective = applyPermissionOverride(profilePermissions, override);
        return {
          id: user.id,
          name: user.name,
          fullName: user.full_name,
          email: user.email,
          role: userRole,
          label: user.full_name || user.name || user.email,
          active: user.active && user.status !== "inactive",
          status: user.status,
          hasOverride: Boolean(override),
          overrideCount: countPermissionActions(override?.allow) + countPermissionActions(override?.deny),
          effectiveCount: countPermissionActions(effective),
          updatedAt: override?.updatedAt ?? null,
        };
      })
      .filter((user) => user.role === role);

    return NextResponse.json({
      role,
      label: getFixedProfileLabel(role),
      users: filtered,
      total: filtered.length,
    });
  } catch (error) {
    console.error("[admin.profile-permissions.users.get]", error);
    return NextResponse.json({ error: "NÃ£o foi possÃ­vel carregar usuÃ¡rios do perfil agora." }, { status: 500 });
  }
}

