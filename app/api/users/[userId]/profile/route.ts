import { NextResponse } from "next/server";

import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAdminUserItem } from "@/lib/adminUsers";
import { getAccessContext } from "@/lib/auth/session";
import { getLocalUserById, listLocalLinksForUser, updateLocalUser } from "@/lib/auth/localStore";
import { authenticateRequest } from "@/lib/jwtAuth";
import { resolveUserProfilePermissions, buildProfileContext } from "@/lib/profile/profilePermissions";

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pickEditableUserPatch(body: Record<string, unknown>, canEditPrivileged: boolean) {
  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") patch.name = readText(body.name);
  if (typeof body.full_name === "string") patch.full_name = readText(body.full_name);
  if (typeof body.phone === "string" || body.phone === null) patch.phone = typeof body.phone === "string" ? readText(body.phone) || null : null;
  if (typeof body.job_title === "string" || body.job_title === null) patch.job_title = typeof body.job_title === "string" ? readText(body.job_title) || null : null;
  if (typeof body.linkedin_url === "string" || body.linkedin_url === null) patch.linkedin_url = typeof body.linkedin_url === "string" ? readText(body.linkedin_url) || null : null;
  if (typeof body.avatar_url === "string" || body.avatar_url === null) patch.avatar_url = typeof body.avatar_url === "string" ? readText(body.avatar_url) || null : null;

  if (canEditPrivileged) {
    if (typeof body.email === "string") patch.email = readText(body.email).toLowerCase();
    if (typeof body.user === "string") patch.user = readText(body.user).toLowerCase();
    if (typeof body.role === "string") patch.role = readText(body.role);
    if (typeof body.active === "boolean") patch.active = body.active;
    if (typeof body.status === "string") patch.status = readText(body.status);
    if (typeof body.client_id === "string") patch.created_by_company_id = readText(body.client_id);
    if (typeof body.default_company_slug === "string") patch.default_company_slug = readText(body.default_company_slug);
  }

  return patch;
}

export async function GET(req: Request, context: { params: Promise<{ userId: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });

  const { userId } = await context.params;
  const target = await getLocalUserById(userId);
  if (!target) return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });

  const targetItem = await getAdminUserItem(userId);
  const targetCompanyIds = Array.isArray(targetItem?.companyIds) ? targetItem.companyIds : [];
  const permissions = resolveUserProfilePermissions(authUser, target, targetCompanyIds, authUser.id === userId ? "self" : "view");
  if (!permissions.canEdit && authUser.id !== userId && !permissions.canChangeRole && !permissions.canManageCompanyLinks && !permissions.canDeactivate) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const links = await listLocalLinksForUser(userId);
  const profileContext = buildProfileContext({
    profileType: "user",
    targetId: userId,
    mode: authUser.id === userId ? "self" : "view",
    viewer: authUser,
    permissions,
  });

  return NextResponse.json({ item: targetItem ?? target, links, profileContext }, { status: 200 });
}

export async function PATCH(req: Request, context: { params: Promise<{ userId: string }> }) {
  const authUser = await authenticateRequest(req);
  if (!authUser) return NextResponse.json({ message: "Não autenticado" }, { status: 401 });

  const access = await getAccessContext(req);
  const { userId } = await context.params;
  const target = await getLocalUserById(userId);
  if (!target) return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });

  const targetItem = await getAdminUserItem(userId);
  const targetCompanyIds = Array.isArray(targetItem?.companyIds) ? targetItem.companyIds : [];
  const permissions = resolveUserProfilePermissions(authUser, target, targetCompanyIds, authUser.id === userId ? "self" : "edit");
  if (!permissions.canEdit) return NextResponse.json({ message: "Sem permissão" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ message: "Payload inválido" }, { status: 400 });

  const privileged = Boolean(access && (access.role === "leader_tc" || access.companyRole === "leader_tc" || access.isGlobalAdmin));
  const patch = pickEditableUserPatch(body, privileged);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ message: "Nenhum campo editável informado" }, { status: 400 });
  }

  if (!privileged && "role" in patch) {
    return NextResponse.json({ message: "Sem permissão para alterar perfil de acesso" }, { status: 403 });
  }

  const updated = await updateLocalUser(userId, patch as never);
  if (!updated) return NextResponse.json({ message: "Usuário não encontrado" }, { status: 404 });

  addAuditLogSafe({
    actorUserId: authUser.id,
    actorEmail: authUser.email,
    action: "user.profile.updated",
    entityType: "user",
    entityId: userId,
    entityLabel: updated.user ?? updated.email,
    metadata: {
      targetUserId: userId,
      mode: authUser.id === userId ? "self" : "admin",
      fields: Object.keys(patch),
    },
  });

  const item = await getAdminUserItem(userId);
  const links = await listLocalLinksForUser(userId);
  const profileContext = buildProfileContext({
    profileType: "user",
    targetId: userId,
    mode: authUser.id === userId ? "self" : "edit",
    viewer: authUser,
    permissions,
  });

  return NextResponse.json({ item: item ?? updated, links, profileContext }, { status: 200 });
}
