import { NextRequest, NextResponse } from "next/server";
import { getAccessContext } from "@/lib/auth/session";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { getFixedProfileLabel } from "@/lib/fixedProfilePresentation";
import { prisma } from "@/lib/prismaClient";
import { applyPermissionOverride, normalizePermissionMatrix } from "@/lib/permissionMatrix";
import { validarAcessoUsuariosNoServidor } from "@/lib/permissions/validarAcessoUsuariosNoServidor";
import { resolveProfilePermissionDefaults } from "@/lib/store/profilePermissionsStore";
import { countPermissionActions } from "@/lib/store/userPermissionsStore";

export const revalidate = 0;

async function resolveRole(params: Promise<{ role: string }>) {
  const { role: rawRole } = await params;
  return normalizeLegacyRole(rawRole);
}

async function requirePermissionManager(req: NextRequest) {
  const accessContext = await getAccessContext(req);
  if (!accessContext) {
    return {
      admin: null,
      access: null,
      response: NextResponse.json(
        { error: "Voce precisa estar autenticado para acessar a Gestao de Perfis." },
        { status: 401 },
      ),
    };
  }

  const access = await validarAcessoUsuariosNoServidor(accessContext);
  if (!access.canViewPermissions) {
    return {
      admin: accessContext,
      access,
      response: NextResponse.json({ error: "Voce nao tem permissao para visualizar a matriz de perfis." }, { status: 403 }),
    };
  }

  return { admin: accessContext, access, response: null };
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
    if (!role) return NextResponse.json({ error: "Perfil invalido." }, { status: 400 });

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
        links: {
          select: {
            companyId: true,
            status: true,
            active: true,
            company: {
              select: {
                id: true,
                name: true,
                company_name: true,
                slug: true,
                active: true,
                status: true,
              },
            },
          },
        },
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
        const activeCompanyLinks = user.links.filter(
          (link) =>
            link.active !== false &&
            link.status !== "inactive" &&
            link.company?.active !== false &&
            link.company?.status !== "inactive",
        );
        const companies = activeCompanyLinks.map((link) => ({
          id: link.company?.id ?? link.companyId,
          slug: link.company?.slug ?? null,
          name: link.company?.company_name || link.company?.name || null,
        }));
        const companySlugs = Array.from(
          new Set([user.default_company_slug, ...companies.map((company) => company.slug)].filter(Boolean)),
        ) as string[];
        const companyIds = Array.from(
          new Set([user.home_company_id, user.created_by_company_id, ...companies.map((company) => company.id)].filter(Boolean)),
        ) as string[];
        const primaryCompanySlug = user.default_company_slug ?? companySlugs[0] ?? null;
        const primaryCompany = companies.find((company) => company.slug === primaryCompanySlug) ?? companies[0] ?? null;

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
          companyId: primaryCompany?.id ?? user.home_company_id ?? user.created_by_company_id ?? null,
          companySlug: primaryCompanySlug,
          companyName: primaryCompany?.name ?? null,
          clientId: primaryCompany?.id ?? null,
          clientSlug: primaryCompanySlug,
          primaryCompanySlug,
          companyIds,
          companySlugs,
          companies,
          company: primaryCompany,
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
    return NextResponse.json({ error: "Nao foi possivel carregar usuarios do perfil agora." }, { status: 500 });
  }
}
