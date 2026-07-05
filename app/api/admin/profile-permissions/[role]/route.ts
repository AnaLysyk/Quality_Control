import { NextRequest, NextResponse } from "next/server";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { normalizeLegacyRole, SYSTEM_ROLES, type SystemRole } from "@/lib/auth/roles";
import { getAccessContext } from "@/lib/auth/session";
import { getFixedProfileLabel } from "@/lib/fixedProfilePresentation";
import {
  deleteProfilePermissionOverride,
  getProfilePermissionOverride,
  setProfilePermissionOverride,
} from "@/lib/store/profilePermissionsStore";
import { applyPermissionOverride, normalizePermissionMatrix, type PermissionMatrix } from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";
import { validarAcessoUsuariosNoServidor } from "@/lib/permissions/validarAcessoUsuariosNoServidor";
import { notifyProfilePermissionsChanged } from "@/lib/notificationService";
import { invalidateBrainCache } from "@/lib/brain/cache";

export const revalidate = 0;

const OPERATION_PROFILE_ACTIONS = ["view", "dashboard", "metrics", "search"];

function expandSystemDefaults(role: SystemRole, matrix: PermissionMatrix) {
  if (role !== SYSTEM_ROLES.LEADER_TC && role !== SYSTEM_ROLES.TECHNICAL_SUPPORT) return matrix;
  return {
    ...matrix,
    operations: Array.from(new Set([...(matrix.operations ?? []), ...OPERATION_PROFILE_ACTIONS])),
  };
}

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
  return expandSystemDefaults(role, normalizePermissionMatrix(resolveRoleDefaults(role)));
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

    await deleteProfilePermissionOverride(role);
    const permissions = resolveSystemDefaults(role);
    const updatedAt = new Date().toISOString();

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
      },
    });

    await notifyProfilePermissionsChanged({
      profileRole: role,
      actorEmail: guard.admin?.email ?? null,
      changedSummary: "perfil restaurado para o padrão do sistema",
      updatedAt,
    });
    invalidateBrainCache("profile.permissions.reset");

    return NextResponse.json({ ok: true, permissions });
  } catch (error) {
    console.error("[admin.profile-permissions.delete]", error);
    return NextResponse.json({ error: "Não foi possível restaurar o perfil agora." }, { status: 500 });
  }
}
