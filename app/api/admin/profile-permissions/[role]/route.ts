import { NextRequest, NextResponse } from "next/server";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { normalizeLegacyRole } from "@/lib/auth/roles";
import { getAccessContext } from "@/lib/auth/session";
import { getFixedProfileLabel } from "@/lib/fixedProfilePresentation";
import {
  deleteProfilePermissionOverride,
  getProfilePermissionOverride,
  resolveProfilePermissionDefaults,
  setProfilePermissionOverride,
} from "@/lib/store/profilePermissionsStore";
import { normalizePermissionMatrix, type PermissionMatrix } from "@/lib/permissionMatrix";
import { resolveRoleDefaults } from "@/lib/permissions/roleDefaults";
import { resolverAcessoUsuarios } from "@/lib/permissions/validarAcessoUsuarios";
import { validarAcessoUsuariosNoServidor } from "@/lib/permissions/validarAcessoUsuariosNoServidor";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { notifyProfilePermissionsChanged } from "@/lib/notificationService";
import { invalidateBrainCache } from "@/lib/brain/cache";

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
    allowCount ? `${allowCount} permissÃ£o(Ãµes) liberada(s)` : null,
    denyCount ? `${denyCount} permissÃ£o(Ãµes) bloqueada(s)` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" e ") : "perfil restaurado para o padrÃ£o do sistema";
}

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;

    const role = await resolveRole(params);
    if (!role) return NextResponse.json({ error: "Perfil invÃ¡lido." }, { status: 400 });

    const systemDefaults = normalizePermissionMatrix(resolveRoleDefaults(role));
    const override = await getProfilePermissionOverride(role);
    const permissions = await resolveProfilePermissionDefaults(role);

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
    return NextResponse.json({ error: "NÃ£o foi possÃ­vel carregar este perfil agora. Tente novamente." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;
    if (guard.access?.canEditPermissions !== true) {
      return NextResponse.json({ error: "VocÃª pode visualizar, mas nÃ£o pode editar esta matriz." }, { status: 403 });
    }

    const role = await resolveRole(params);
    if (!role) return NextResponse.json({ error: "Perfil invÃ¡lido." }, { status: 400 });

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
    const permissions = await resolveProfilePermissionDefaults(role);
    const summary = describeChangedSummary(allow, deny);

    await addAuditLogSafe({
      actorUserId: guard.admin?.id ?? null,
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
    return NextResponse.json({ error: "NÃ£o foi possÃ­vel salvar o perfil agora. Revise as permissÃµes e tente novamente." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ role: string }> }) {
  try {
    const guard = await requirePermissionManager(req);
    if (guard.response) return guard.response;
    if (guard.access?.canResetPermissions !== true) {
      return NextResponse.json({ error: "VocÃª nÃ£o tem permissÃ£o para restaurar o padrÃ£o deste perfil." }, { status: 403 });
    }

    const role = await resolveRole(params);
    if (!role) return NextResponse.json({ error: "Perfil invÃ¡lido." }, { status: 400 });

    await deleteProfilePermissionOverride(role);
    const permissions = await resolveProfilePermissionDefaults(role);
    const updatedAt = new Date().toISOString();

    await addAuditLogSafe({
      actorUserId: guard.admin?.id ?? null,
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
      changedSummary: "perfil restaurado para o padrÃ£o do sistema",
      updatedAt,
    });
    invalidateBrainCache("profile.permissions.reset");

    return NextResponse.json({ ok: true, permissions });
  } catch (error) {
    console.error("[admin.profile-permissions.delete]", error);
    return NextResponse.json({ error: "NÃ£o foi possÃ­vel restaurar o perfil agora." }, { status: 500 });
  }
}

