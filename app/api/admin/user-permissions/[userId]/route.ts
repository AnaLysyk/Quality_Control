import { NextRequest, NextResponse } from "next/server";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAccessContext } from "@/lib/auth/session";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { getFixedProfileLabel } from "@/lib/fixedProfilePresentation";
import {
  applyPermissionOverride,
  normalizePermissionMatrix,
  type PermissionMatrix,
} from "@/lib/permissionMatrix";
import { prisma } from "@/lib/prismaClient";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";
import { resolverAcessoUsuarios } from "@/lib/permissions/validarAcessoUsuarios";
import { validarAcessoUsuariosNoServidor } from "@/lib/permissions/validarAcessoUsuariosNoServidor";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { resolveProfilePermissionDefaults } from "@/lib/store/profilePermissionsStore";
import { invalidateBrainCache } from "@/lib/brain/cache";
import {
  countPermissionActions,
  deleteUserPermissionOverride,
  getUserPermissionOverride,
  setUserPermissionOverride,
} from "@/lib/store/userPermissionsStore";

export const revalidate = 0;

async function resolveUserId(params: Promise<{ userId: string }>) {
  const { userId } = await params;
  return typeof userId === "string" ? userId.trim() : "";
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
      response: NextResponse.json({ error: "VocÃª nÃ£o tem permissÃ£o para visualizar a matriz de usuÃ¡rios." }, { status: 403 }),
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

async function getUserWithRole(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
    },
  });

  if (!user) return null;
  const role = resolveUserRole(user);
  return { user, role };
}

function responseForUser(input: {
  user: NonNullable<Awaited<ReturnType<typeof getUserWithRole>>>["user"];
  role: SystemRole;
  systemDefaults: PermissionMatrix;
  profilePermissions: PermissionMatrix;
  override: Awaited<ReturnType<typeof getUserPermissionOverride>>;
  permissions: PermissionMatrix;
  canEdit: boolean;
}) {
  return {
    role: input.role,
    label: getFixedProfileLabel(input.role),
    user: {
      id: input.user.id,
      name: input.user.name,
      fullName: input.user.full_name,
      email: input.user.email,
      active: input.user.active && input.user.status !== "inactive",
      status: input.user.status,
    },
    systemDefaults: input.profilePermissions,
    profileDefaults: input.systemDefaults,
    override: input.override,
    permissions: input.permissions,
    canEdit: input.canEdit,
    counts: {
      system: countPermissionActions(input.systemDefaults),
      profile: countPermissionActions(input.profilePermissions),
      allow: countPermissionActions(input.override?.allow),
      deny: countPermissionActions(input.override?.deny),
      effective: countPermissionActions(input.permissions),
    },
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;

    const userId = await resolveUserId(params);
    if (!userId) return NextResponse.json({ error: "UsuÃ¡rio invÃ¡lido." }, { status: 400 });

    const resolved = await getUserWithRole(userId);
    if (!resolved?.role) return NextResponse.json({ error: "UsuÃ¡rio nÃ£o encontrado ou sem perfil vÃ¡lido." }, { status: 404 });

    const systemDefaults = normalizePermissionMatrix(resolveRoleDefaults(resolved.role));
    const profilePermissions = await resolveProfilePermissionDefaults(resolved.role);
    const override = await getUserPermissionOverride(userId);
    const permissions = applyPermissionOverride(profilePermissions, override);

    return NextResponse.json(
      responseForUser({
        user: resolved.user,
        role: resolved.role,
        systemDefaults,
        profilePermissions,
        override,
        permissions,
        canEdit: guard.access?.canEditPermissions === true,
      }),
    );
  } catch (error) {
    console.error("[admin.user-permissions.get]", error);
    return NextResponse.json({ error: "NÃ£o foi possÃ­vel carregar permissÃµes do usuÃ¡rio agora." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;
    if (guard.access?.canEditPermissions !== true) {
      return NextResponse.json({ error: "VocÃª pode visualizar, mas nÃ£o pode editar permissÃµes por usuÃ¡rio." }, { status: 403 });
    }

    const userId = await resolveUserId(params);
    if (!userId) return NextResponse.json({ error: "UsuÃ¡rio invÃ¡lido." }, { status: 400 });

    const resolved = await getUserWithRole(userId);
    if (!resolved?.role) return NextResponse.json({ error: "UsuÃ¡rio nÃ£o encontrado ou sem perfil vÃ¡lido." }, { status: 404 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const allow = normalizePermissionMatrix(body?.allow);
    const deny = normalizePermissionMatrix(body?.deny);
    const saved = await setUserPermissionOverride(userId, {
      allow,
      deny,
      updatedBy: guard.admin?.email ?? null,
    });

    const systemDefaults = normalizePermissionMatrix(resolveRoleDefaults(resolved.role));
    const profilePermissions = await resolveProfilePermissionDefaults(resolved.role);
    const permissions = applyPermissionOverride(profilePermissions, saved);

    await addAuditLogSafe({
      actorUserId: guard.admin?.id ?? null,
      actorEmail: guard.admin?.email ?? null,
      action: "user.permissions.updated",
      entityType: "user",
      entityId: userId,
      entityLabel: resolved.user.full_name || resolved.user.name || resolved.user.email,
      metadata: {
        userId,
        role: resolved.role,
        allowCount: countPermissionActions(allow),
        denyCount: countPermissionActions(deny),
        effectiveCount: countPermissionActions(permissions),
      },
    });
    invalidateBrainCache("user.permissions.updated");

    return NextResponse.json({
      ok: true,
      saved,
      permissions,
      user: responseForUser({
        user: resolved.user,
        role: resolved.role,
        systemDefaults,
        profilePermissions,
        override: saved,
        permissions,
        canEdit: true,
      }).user,
    });
  } catch (error) {
    console.error("[admin.user-permissions.patch]", error);
    return NextResponse.json({ error: "NÃ£o foi possÃ­vel salvar permissÃµes do usuÃ¡rio agora." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;
    if (guard.access?.canResetPermissions !== true) {
      return NextResponse.json({ error: "VocÃª nÃ£o tem permissÃ£o para restaurar permissÃµes deste usuÃ¡rio." }, { status: 403 });
    }

    const userId = await resolveUserId(params);
    if (!userId) return NextResponse.json({ error: "UsuÃ¡rio invÃ¡lido." }, { status: 400 });

    const resolved = await getUserWithRole(userId);
    if (!resolved?.role) return NextResponse.json({ error: "UsuÃ¡rio nÃ£o encontrado ou sem perfil vÃ¡lido." }, { status: 404 });

    await deleteUserPermissionOverride(userId);

    const systemDefaults = normalizePermissionMatrix(resolveRoleDefaults(resolved.role));
    const profilePermissions = await resolveProfilePermissionDefaults(resolved.role);
    const permissions = profilePermissions;

    await addAuditLogSafe({
      actorUserId: guard.admin?.id ?? null,
      actorEmail: guard.admin?.email ?? null,
      action: "user.permissions.reset",
      entityType: "user",
      entityId: userId,
      entityLabel: resolved.user.full_name || resolved.user.name || resolved.user.email,
      metadata: {
        userId,
        role: resolved.role,
        restoredToProfile: true,
        effectiveCount: countPermissionActions(permissions),
      },
    });
    invalidateBrainCache("user.permissions.reset");

    return NextResponse.json({ ok: true, permissions });
  } catch (error) {
    console.error("[admin.user-permissions.delete]", error);
    return NextResponse.json({ error: "NÃ£o foi possÃ­vel restaurar permissÃµes do usuÃ¡rio agora." }, { status: 500 });
  }
}

