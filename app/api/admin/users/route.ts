import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { hashPasswordSha256 } from "@/lib/passwordHash";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAccessContext } from "@/lib/auth/session";
import {
  createLocalUser,
  listLocalLinksForCompany,
  listLocalLinksForUser,
  listLocalUsers,
  normalizeLocalRole,
  updateLocalUser,
  upsertLocalLink,
} from "@/lib/auth/localStore";

export const runtime = "nodejs";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role?: string;
  client_id?: string | null;
  active?: boolean;
  job_title?: string | null;
  linkedin_url?: string | null;
  avatar_url?: string | null;
};

function mapUser(
  user: {
    id: string;
    name: string;
    email: string;
    active?: boolean;
    globalRole?: string | null;
    is_global_admin?: boolean;
    job_title?: string | null;
    linkedin_url?: string | null;
    avatar_url?: string | null;
  },
  link?: { role?: string | null; companyId?: string | null },
) {
  const isGlobalAdmin = user.globalRole === "global_admin" || user.is_global_admin === true;
  if (isGlobalAdmin) {
    return {
      id: user.id,
      name: user.name ?? "",
      email: user.email,
      role: "global_admin",
      client_id: null,
      active: user.active !== false,
      job_title: user.job_title ?? null,
      linkedin_url: user.linkedin_url ?? null,
      avatar_url: user.avatar_url ?? null,
    };
  }

  const role = normalizeLocalRole(link?.role ?? "user");
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email,
    role: role === "company_admin" ? "client_admin" : "client_user",
    client_id: link?.companyId ?? null,
    active: user.active !== false,
    job_title: user.job_title ?? null,
    linkedin_url: user.linkedin_url ?? null,
    avatar_url: user.avatar_url ?? null,
  };
}

function normalizeRole(input?: string | null): {
  globalRole: "global_admin" | null;
  membershipRole: "company_admin" | "user" | "viewer";
} {
  const value = (input ?? "").toLowerCase();
  if (value === "global_admin" || value === "system_admin" || value === "super-admin") {
    return { globalRole: "global_admin", membershipRole: "company_admin" };
  }
  if (value === "client_admin" || value === "admin" || value === "company_admin" || value === "company") {
    return { globalRole: null, membershipRole: "company_admin" };
  }
  if (value === "viewer" || value === "client_viewer" || value === "read_only") {
    return { globalRole: null, membershipRole: "viewer" };
  }
  return { globalRole: null, membershipRole: "user" };
}

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const isGlobalAdmin = access.isGlobalAdmin === true || (access.role ?? "").toLowerCase() === "admin";
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (!isGlobalAdmin) {
    if (!access.companyId) {
      return NextResponse.json({ error: "Sem empresa vinculada" }, { status: 403 });
    }
    const links = await listLocalLinksForCompany(access.companyId);
    const users = await listLocalUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    const items: UserItem[] = links.map((link) => mapUser(byId.get(link.userId) ?? { id: link.userId, name: "", email: "", active: true }, { role: link.role, companyId: link.companyId }));
    return NextResponse.json({ items }, { status: 200 });
  }

  if (clientId) {
    const links = await listLocalLinksForCompany(clientId);
    const users = await listLocalUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    const items: UserItem[] = links.map((link) => mapUser(byId.get(link.userId) ?? { id: link.userId, name: "", email: "", active: true }, { role: link.role, companyId: link.companyId }));
    return NextResponse.json({ items }, { status: 200 });
  }

  const users = await listLocalUsers();
  const items: UserItem[] = [];
  for (const user of users) {
    const link = (await listLocalLinksForUser(user.id))[0];
    items.push(mapUser(user, link ? { role: link.role, companyId: link.companyId } : undefined));
  }

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const normalizedRole = normalizeRole(body?.role);
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;
  const jobTitle = typeof body?.job_title === "string" ? body.job_title.trim() : null;
  const linkedinUrl = typeof body?.linkedin_url === "string" ? body.linkedin_url.trim() : null;
  const avatarUrl = typeof body?.avatar_url === "string" ? body.avatar_url.trim() : null;
  const rawPassword = typeof body?.password === "string" ? body.password : "";

  if (!name || !email) {
    return NextResponse.json({ error: "Nome e email sao obrigatorios" }, { status: 400 });
  }

  const isGlobalAdmin = normalizedRole.globalRole === "global_admin";
  if (!isGlobalAdmin && !clientId) {
    return NextResponse.json({ error: "Empresa obrigatoria para este perfil" }, { status: 400 });
  }

  const tempPassword = rawPassword.trim() || `qc-${randomUUID().slice(0, 8)}`;
  const passwordHash = hashPasswordSha256(tempPassword);

  let user = await createLocalUser({
    name,
    email,
    password_hash: passwordHash,
    active: true,
    role: "user",
    globalRole: isGlobalAdmin ? "global_admin" : null,
    is_global_admin: isGlobalAdmin,
    job_title: jobTitle,
    linkedin_url: linkedinUrl,
    avatar_url: avatarUrl,
  });

  if (isGlobalAdmin && (user.globalRole ?? null) !== "global_admin") {
    // createLocalUser retorna existente quando email ja existe: garante globalRole neste caso.
    const updated = await updateLocalUser(user.id, { globalRole: "global_admin", is_global_admin: true });
    if (updated) user = updated;
  }

  if (clientId) {
    await upsertLocalLink({ userId: user.id, companyId: clientId, role: normalizedRole.membershipRole, capabilities });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email,
    metadata: { companyId: clientId, role: body?.role ?? null, globalRole: normalizedRole.globalRole },
  });

  return NextResponse.json(
    { ok: true, temp_password: rawPassword.trim() ? null : tempPassword },
    { status: 201 },
  );
}

export async function PATCH(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.id === "string" ? body.id : "";
  if (!userId) {
    return NextResponse.json({ error: "id obrigatorio" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : null;
  const active = typeof body?.active === "boolean" ? body.active : null;
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const normalizedRole = normalizeRole(body?.role);
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;
  const jobTitle = typeof body?.job_title === "string" ? body.job_title.trim() : undefined;
  const linkedinUrl = typeof body?.linkedin_url === "string" ? body.linkedin_url.trim() : undefined;
  const avatarUrl = typeof body?.avatar_url === "string" ? body.avatar_url.trim() : undefined;

  const isGlobalAdmin = normalizedRole.globalRole === "global_admin";
  if (!isGlobalAdmin && !clientId) {
    return NextResponse.json({ error: "Empresa obrigatoria para este perfil" }, { status: 400 });
  }

  const updated = await updateLocalUser(userId, {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(active !== null ? { active } : {}),
    ...(jobTitle !== undefined ? { job_title: jobTitle || null } : {}),
    ...(linkedinUrl !== undefined ? { linkedin_url: linkedinUrl || null } : {}),
    ...(avatarUrl !== undefined ? { avatar_url: avatarUrl || null } : {}),
    ...(isGlobalAdmin ? { globalRole: "global_admin", is_global_admin: true } : { globalRole: null, is_global_admin: false }),
  });

  if (!updated) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (clientId) {
    await upsertLocalLink({ userId, companyId: clientId, role: normalizedRole.membershipRole, capabilities });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.updated",
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.email,
    metadata: { companyId: clientId, role: body?.role ?? null, globalRole: normalizedRole.globalRole, active },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
