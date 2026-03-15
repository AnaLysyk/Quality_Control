import { NextResponse, NextRequest } from 'next/server';
import { deleteUserOverride, setUserOverride } from '../../../../../../src/lib/store/permissionsStore';
import { addAuditLogSafe } from '@/data/auditLogRepository';
import { getAdminUserItem } from '@/lib/adminUsers';
import { notifyUserAccessUpdated } from '@/lib/notificationService';
import { requireGlobalAdminWithStatus } from '@/lib/rbac/requireGlobalAdmin';
import { resolvePermissionAccessForUser } from '@/lib/serverPermissionAccess';

export const revalidate = 0;

function countPermissionActions(input: Record<string, string[] | undefined> | null | undefined) {
  return Object.values(input ?? {}).reduce((total, actions) => total + (Array.isArray(actions) ? actions.length : 0), 0);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? 'Nao autenticado' : 'Sem permissao' }, { status });
    }
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
    return NextResponse.json({ error: "Nao foi possivel carregar permissoes agora." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? 'Nao autenticado' : 'Sem permissao' }, { status });
    }
    const p = await params;
    const userId = p.id;
    const body = await req.json();
    const allowed = body.allow ?? undefined;
    const deny = body.deny ?? undefined;
    const saved = await setUserOverride(userId, { allow: allowed, deny });
    const resolved = await resolvePermissionAccessForUser(userId);
    const targetUser = await getAdminUserItem(userId);
    const effectiveCount = countPermissionActions(resolved.permissions);
    const allowCount = countPermissionActions(saved.allow);
    const denyCount = countPermissionActions(saved.deny);

    await addAuditLogSafe({
      actorUserId: admin.id,
      actorEmail: admin.email,
      action: "user.permissions.updated",
      entityType: "user",
      entityId: userId,
      entityLabel: targetUser?.email ?? targetUser?.name ?? userId,
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
      actorEmail: admin.email,
      nextRole: resolved.roleKey,
      companyLabel: targetUser?.company_name ?? null,
      permissionsCount: effectiveCount,
    });

    return NextResponse.json({ ok: true, saved, permissions: resolved.permissions });
  } catch (e: any) {
    console.error("[admin.users.permissions.patch]", e);
    return NextResponse.json({ error: "Nao foi possivel salvar permissoes agora." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? 'Nao autenticado' : 'Sem permissao' }, { status });
    }
    const body = await req.json().catch(() => null);
    const restored = body?.reason === "restored";
    const p = await params;
    const userId = p.id;
    await deleteUserOverride(userId);
    const resolved = await resolvePermissionAccessForUser(userId);
    const targetUser = await getAdminUserItem(userId);
    const effectiveCount = countPermissionActions(resolved.permissions);

    await addAuditLogSafe({
      actorUserId: admin.id,
      actorEmail: admin.email,
      action: restored ? "user.permissions.reset" : "user.permissions.updated",
      entityType: "user",
      entityId: userId,
      entityLabel: targetUser?.email ?? targetUser?.name ?? userId,
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
      actorEmail: admin.email,
      nextRole: resolved.roleKey,
      companyLabel: targetUser?.company_name ?? null,
      permissionsCount: effectiveCount,
      restored,
    });

    return NextResponse.json({ ok: true, permissions: resolved.permissions });
  } catch (e: any) {
    console.error("[admin.users.permissions.delete]", e);
    return NextResponse.json({ error: "Nao foi possivel restaurar permissoes agora." }, { status: 500 });
  }
}

