import { NextResponse, NextRequest } from 'next/server';
import { addAuditLogSafe } from '@/data/auditLogRepository';
import { getAdminUserItem } from '@/lib/adminUsers';
import { notifyUserAccessUpdated } from '@/lib/notificationService';
import { invalidatePermissionAccessCache, resolvePermissionAccessForUser } from '@/lib/serverPermissionAccess';
import { invalidateBrainCache } from '@/lib/brain/cache';
import { requirePermission } from '@/lib/rbac/requirePermission';
import {
  deleteUserPermissionOverride,
  setUserPermissionOverride,
} from '@/lib/store/userPermissionsStore';

export const revalidate = 0;

function countPermissionActions(input: Record<string, string[] | undefined> | null | undefined) {
  return Object.values(input ?? {}).reduce((total, actions) => total + (Array.isArray(actions) ? actions.length : 0), 0);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(req, "permissions", "view");
    if (!guard.ok) return guard.response;
    const p = await params;
    const userId = p.id;
    const resolved = await resolvePermissionAccessForUser(userId);
    return NextResponse.json({
      userId,
      role: resolved.roleKey,
      roleDefaults: resolved.roleDefaults,
      override: resolved.override,
      permissions: resolved.permissions,
    });
  } catch (e: any) {
    console.error("[admin.users.permissions.get]", e);
    return NextResponse.json({ error: "Não foi possível carregar permissões agora." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(req, "permissions", "edit");
    if (!guard.ok) return guard.response;
    const p = await params;
    const userId = p.id;
    const body = await req.json();
    const allowed = body.allow ?? undefined;
    const deny = body.deny ?? undefined;
    const saved = await setUserPermissionOverride(userId, {
      allow: allowed,
      deny,
      updatedBy: guard.access.email ?? null,
    });
    invalidatePermissionAccessCache(userId);
    const resolved = await resolvePermissionAccessForUser(userId);
    const targetUser = await getAdminUserItem(userId);
    const effectiveCount = countPermissionActions(resolved.permissions);
    const allowCount = countPermissionActions(saved.allow);
    const denyCount = countPermissionActions(saved.deny);

    await addAuditLogSafe({
      actorUserId: guard.access.userId,
      actorEmail: guard.access.email,
      action: "user.permissions.updated",
      entityType: "user",
      entityId: userId,
      entityLabel: targetUser?.user ?? targetUser?.email ?? targetUser?.name ?? userId,
      metadata: {
        role: resolved.roleKey,
        allowCount,
        denyCount,
        effectiveCount,
        companyId: targetUser?.client_id ?? null,
        companyLabel: targetUser?.company_name ?? null,
      },
    });

    await notifyUserAccessUpdated({
      targetUserId: userId,
      actorEmail: guard.access.email,
      nextRole: resolved.roleKey,
      companyLabel: targetUser?.company_name ?? null,
      permissionsCount: effectiveCount,
    });
    invalidateBrainCache("admin.users.permissions.updated");

    return NextResponse.json({ ok: true, saved, permissions: resolved.permissions });
  } catch (e: any) {
    console.error("[admin.users.permissions.patch]", e);
    return NextResponse.json({ error: "Não foi possível salvar permissões agora." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission(req, "permissions", "reset");
    if (!guard.ok) return guard.response;
    const body = await req.json().catch(() => null);
    const restored = body?.reason === "restored";
    const p = await params;
    const userId = p.id;
    await deleteUserPermissionOverride(userId);
    invalidatePermissionAccessCache(userId);
    const resolved = await resolvePermissionAccessForUser(userId);
    const targetUser = await getAdminUserItem(userId);
    const effectiveCount = countPermissionActions(resolved.permissions);

    await addAuditLogSafe({
      actorUserId: guard.access.userId,
      actorEmail: guard.access.email,
      action: restored ? "user.permissions.reset" : "user.permissions.updated",
      entityType: "user",
      entityId: userId,
      entityLabel: targetUser?.user ?? targetUser?.email ?? targetUser?.name ?? userId,
      metadata: {
        role: resolved.roleKey,
        effectiveCount,
        restored,
        companyId: targetUser?.client_id ?? null,
        companyLabel: targetUser?.company_name ?? null,
      },
    });

    await notifyUserAccessUpdated({
      targetUserId: userId,
      actorEmail: guard.access.email,
      nextRole: resolved.roleKey,
      companyLabel: targetUser?.company_name ?? null,
      permissionsCount: effectiveCount,
      restored,
    });
    invalidateBrainCache("admin.users.permissions.reset");

    return NextResponse.json({ ok: true, permissions: resolved.permissions });
  } catch (e: any) {
    console.error("[admin.users.permissions.delete]", e);
    return NextResponse.json({ error: "Não foi possível restaurar permissões agora." }, { status: 500 });
  }
}
