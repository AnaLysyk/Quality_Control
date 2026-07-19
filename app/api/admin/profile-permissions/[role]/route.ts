import { NextRequest, NextResponse } from "next/server";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { normalizeLegacyRole, type SystemRole } from "@/backend/auth/roles";
import { getAccessContext } from "@/backend/auth/session";
import { getFixedProfileLabel } from "@/backend/fixedProfilePresentation";
import { prisma } from "@/database/prismaClient";
import {
  deleteProfilePermissionOverride,
  getProfilePermissionOverride,
  setProfilePermissionOverride,
} from "@/backend/store/profilePermissionsStore";
import { deleteUserPermissionOverridesForUserIds } from "@/backend/store/userPermissionsStore";
import { resolveUserProfileRole } from "@/backend/permissions/resolveUserProfileRole";
import { applyPermissionOverride, normalizePermissionMatrix, type PermissionMatrix } from "@/backend/permissionMatrix";
import { resolveRoleDefaults } from "@/backend/permissions/roleDefaults";
import { validarAcessoUsuariosNoServidor } from "@/backend/permissions/validarAcessoUsuariosNoServidor";
import { notifyProfilePermissionsChanged } from "@/backend/notificationService";
import { invalidateBrainCache } from "@/backend/brain/cache";
import { invalidatePermissionAccessCache } from "@/backend/serverPermissionAccess";

async function resolveUserIdsForProfile(role: SystemRole) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      role: true,
      globalRole: true,
      user_origin: true,
      user_scope: true,
      default_company_slug: true,
      home_company_id: true,
      created_by_company_id: true,
    },
  });

  return users.filter((user) => resolveUserProfileRole(user) === role).map((user) => user.id);
}

export const revalidate = 0;

function countPermissionActions(input: PermissionMatrix | null | undefined) {
  return Object.values(input ?? {}).reduce(
    (total, actions) => total + (Array.isArray(actions) ? actions.length : 0),
    0,
  );
}

function describeChangedSummary(allow: PermissionMatrix, deny: PermissionMatrix) {
  const allowCount = countPermissionActions(allow);
  const denyCount = countPermissionActions(deny);
  const parts = [
    allowCount ? `${allowCount} permissão(ões) liberada(s)` : null,
    denyCount ? `${denyCount} permissão(ões) restringida(s)` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" e ") : "perfil restaurado para o padrão do sistema";
}

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
        { error: "Você precisa estar autenticado para acessar a Gestão de Perfis." },
        { status: 401 },
      ),
    };
  }

  const access = await validarAcessoUsuariosNoServidor(accessContext);
  if (!access.canViewPermissions) {
    return {
      admin: accessContext,
      access,
      response: NextResponse.json({ error: "Você não tem permissão para visualizar a matriz de perfis." }, { status: 403 }),
    };
  }

  return { admin: accessContext, access, response: null };
}

function resolveSystemDefaults(role: SystemRole) {
  return normalizePermissionMatrix(resolveRoleDefaults(role));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;

    const role = await resolveRole(params);
    if (!role) return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });

    const systemDefaults = resolveSystemDefaults(role);
    const override = await getProfilePermissionOverride(role);
    const permissions = applyPermissionOverride(systemDefaults, override);

    return NextResponse.json({
      role,
      label: getFixedProfileLabel(role),
      systemDefaults,
      override,
      permissions,
      canEdit: guard.access?.canEditPermissions === true,
      counts: {
        system: countPermissionActions(systemDefaults),
        allow: countPermissionActions(override?.allow),
        deny: countPermissionActions(override?.deny),
        effective: countPermissionActions(permissions),
      },
    });
  } catch (error) {
    console.error("[admin.profile-permissions.get]", error);
    return NextResponse.json({ error: "Não foi possível carregar este perfil agora. Tente novamente." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;
    if (guard.access?.canEditPermissions !== true) {
      return NextResponse.json({ error: "Você pode visualizar, mas não pode editar esta matriz." }, { status: 403 });
    }

    const role = await resolveRole(params);
    if (!role) return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const allow = normalizePermissionMatrix(body?.allow);
    const deny = normalizePermissionMatrix(body?.deny);
    const reason = typeof body?.reason === "string" ? body.reason : null;
    const saved = await setProfilePermissionOverride(role, {
      allow,
      deny,
      reason,
      updatedBy: guard.admin?.email ?? null,
    });
    const permissions = applyPermissionOverride(resolveSystemDefaults(role), saved);
    const summary = describeChangedSummary(allow, deny);

    invalidatePermissionAccessCache();

    await addAuditLogSafe({
      actorUserId: guard.admin?.userId ?? null,
      actorEmail: guard.admin?.email ?? null,
      action: "profile.permissions.updated",
      entityType: "profile",
      entityId: role,
      entityLabel: getFixedProfileLabel(role),
      metadata: {
        role,
        allowCount: countPermissionActions(allow),
        denyCount: countPermissionActions(deny),
        effectiveCount: countPermissionActions(permissions),
        reason,
      },
    });

    await notifyProfilePermissionsChanged({
      profileRole: role,
      actorEmail: guard.admin?.email ?? null,
      changedSummary: summary,
      updatedAt: saved.updatedAt ?? null,
    });
    invalidateBrainCache("profile.permissions.updated");

    return NextResponse.json({ ok: true, saved, permissions });
  } catch (error) {
    console.error("[admin.profile-permissions.patch]", error);
    return NextResponse.json({ error: "Não foi possível salvar o perfil agora. Revise as permissões e tente novamente." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;
    if (guard.access?.canResetPermissions !== true) {
      return NextResponse.json({ error: "Você não tem permissão para restaurar o padrão deste perfil." }, { status: 403 });
    }

    const role = await resolveRole(params);
    if (!role) return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });

    const affectedUserIds = await resolveUserIdsForProfile(role);
    await deleteProfilePermissionOverride(role);
    const clearedUserOverrides = await deleteUserPermissionOverridesForUserIds(affectedUserIds);
    const permissions = resolveSystemDefaults(role);
    const updatedAt = new Date().toISOString();

    invalidatePermissionAccessCache();

    await addAuditLogSafe({
      actorUserId: guard.admin?.userId ?? null,
      actorEmail: guard.admin?.email ?? null,
      action: "profile.permissions.reset",
      entityType: "profile",
      entityId: role,
      entityLabel: getFixedProfileLabel(role),
      metadata: {
        role,
        effectiveCount: countPermissionActions(permissions),
        restored: true,
        affectedUsers: affectedUserIds.length,
        clearedUserOverrides,
      },
    });

    await notifyProfilePermissionsChanged({
      profileRole: role,
      actorEmail: guard.admin?.email ?? null,
      changedSummary: clearedUserOverrides
        ? `perfil restaurado para o padrão do sistema e ${clearedUserOverrides} override(s) individual(is) removido(s)`
        : "perfil restaurado para o padrão do sistema",
      updatedAt,
    });
    invalidateBrainCache("profile.permissions.reset");

    return NextResponse.json({ ok: true, permissions });
  } catch (error) {
    console.error("[admin.profile-permissions.delete]", error);
    return NextResponse.json({ error: "Não foi possível restaurar o perfil agora." }, { status: 500 });
  }
}
