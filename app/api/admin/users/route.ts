import { NextRequest, NextResponse } from "next/server";

import { generateTempPassword, hashPassword } from "@/lib/passwordHash";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { getAccessContext } from "@/lib/auth/session";
import {
  createLocalUser,
  listLocalLinksForCompany,
  listLocalLinksForUser,
  listLocalUsers,
  normalizeLocalRole,
  pruneOrphanMemberships,
  updateLocalUser,
  upsertLocalLink,
} from "@/lib/auth/localStore";

export const runtime = "nodejs";

type UserItem = {
  id: string;
  name: string;
  email: string;
  user?: string;
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
    user?: string;
    active?: boolean;
    job_title?: string | null;
    linkedin_url?: string | null;
    avatar_url?: string | null;
    globalRole?: string | null;
    is_global_admin?: boolean;
  },
  link?: { role?: string | null; companyId?: string | null },
) {
  const role = normalizeLocalRole(link?.role ?? "user");
  const isGlobalAdmin = user.globalRole === "global_admin" || user.is_global_admin === true;
  const mappedRole = isGlobalAdmin
    ? "global_admin"
    : role === "company_admin"
      ? "client_admin"
      : role === "it_dev"
        ? "it_dev"
        : "client_user";
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email,
    user: user.user ?? user.email ?? "",
    role: mappedRole,
    client_id: link?.companyId ?? null,
    active: user.active !== false,
    job_title: user.job_title ?? null,
    linkedin_url: user.linkedin_url ?? null,
    avatar_url: user.avatar_url ?? null,
  };
}

function normalizeRole(input?: string | null) {
  const value = (input ?? "").toLowerCase();
  if (value === "client_admin" || value === "admin" || value === "global_admin" || value === "company_admin") return "company_admin";
  if (value === "it_dev" || value === "itdev" || value === "developer" || value === "dev") return "it_dev";
  if (value === "viewer" || value === "client_viewer") return "viewer";
  return "user";
}

function normalizeLogin(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const isGlobalAdmin = access.isGlobalAdmin === true || (access.role ?? "").toLowerCase() === "admin";
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get("client_id");

  if (isGlobalAdmin) {
    const pruned = await pruneOrphanMemberships().catch(() => 0);
    if (pruned > 0) {
      console.warn(`[ADMIN-USERS][GET] pruned ${pruned} orphan membership(s)`);
    }
  }

  if (!isGlobalAdmin) {
    if (!access.companyId) {
      return NextResponse.json({ error: "Sem empresa vinculada" }, { status: 403 });
    }
    const links = await listLocalLinksForCompany(access.companyId);
    const users = await listLocalUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    const items: UserItem[] = [];
    for (const link of links) {
      const target = byId.get(link.userId);
      if (!target) continue;
      items.push(mapUser(target, { role: link.role, companyId: link.companyId }));
    }
    return NextResponse.json({ items }, { status: 200 });
  }

  if (clientId) {
    const links = await listLocalLinksForCompany(clientId);
    const users = await listLocalUsers();
    const byId = new Map(users.map((user) => [user.id, user]));
    const items: UserItem[] = [];
    for (const link of links) {
      const target = byId.get(link.userId);
      if (!target) continue;
      items.push(mapUser(target, { role: link.role, companyId: link.companyId }));
    }
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
  const rawLogin = typeof body?.user === "string" ? body.user : "";
  const inferredLogin = !rawLogin && typeof body?.email === "string" ? String(body.email).split("@")[0] : rawLogin;
  const login = normalizeLogin(inferredLogin);
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const jobTitle = typeof body?.job_title === "string" ? body.job_title.trim() || null : null;
  const linkedinUrl = typeof body?.linkedin_url === "string" ? body.linkedin_url.trim() || null : null;
  const avatarUrl = typeof body?.avatar_url === "string" ? body.avatar_url.trim() || null : null;
  const rawRole = typeof body?.role === "string" ? body.role : "";
  const wantsGlobalAdmin = rawRole.trim().toLowerCase() === "global_admin";
  const role = normalizeRole(rawRole);
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;
  const requiresCompanyLink = !wantsGlobalAdmin;

  console.debug(`[ADMIN-USERS][POST] admin=${admin?.email ?? "-"} name=${name} email=${email} clientId=${clientId} role=${rawRole}`);

  if (!name || !email || !login) {
    console.error(`[ADMIN-USERS][POST] missing-fields admin=${admin?.email ?? "-"} name='${name}' email='${email}' login='${login}'`);
    return NextResponse.json({ error: "Nome, usuario e email sao obrigatorios" }, { status: 400 });
  }
  if (requiresCompanyLink && !clientId) {
    console.error(`[ADMIN-USERS][POST] missing-client admin=${admin?.email ?? "-"} clientId=${clientId}`);
    return NextResponse.json({ error: "Empresa obrigatoria para este perfil" }, { status: 400 });
  }

  const users = await listLocalUsers();
  if (users.some((user) => normalizeLogin(user.email) === email)) {
    console.error(`[ADMIN-USERS][POST] duplicate-email admin=${admin?.email ?? "-"} email=${email}`);
    return NextResponse.json({ error: "E-mail ja existe" }, { status: 409 });
  }
  if (users.some((user) => normalizeLogin(user.user ?? user.email) === login)) {
    console.error(`[ADMIN-USERS][POST] duplicate-user admin=${admin?.email ?? "-"} login=${login}`);
    return NextResponse.json({ error: "Usuario ja existe" }, { status: 409 });
  }

  const tempPasswordPlain = generateTempPassword();
  const tempPasswordHash = await hashPassword(tempPasswordPlain);
  let user = null;
  try {
    user = await createLocalUser({
      name,
      email,
      user: login,
      password_hash: tempPasswordHash,
      active: true,
      role: "user",
      globalRole: wantsGlobalAdmin ? "global_admin" : null,
      is_global_admin: wantsGlobalAdmin,
      job_title: jobTitle || null,
      linkedin_url: linkedinUrl || null,
      avatar_url: avatarUrl || null,
    });
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    console.error(`[ADMIN-USERS][POST] createLocalUser error admin=${admin?.email ?? "-"} code=${code} err=${String(err)}`);
    if (code === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "E-mail ja existe" }, { status: 409 });
    }
    if (code === "DUPLICATE_USER") {
      return NextResponse.json({ error: "Usuario ja existe" }, { status: 409 });
    }
    throw err;
  }

  if (clientId) {
    await upsertLocalLink({ userId: user.id, companyId: clientId, role, capabilities });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    entityLabel: user.email,
    metadata: { companyId: clientId, role, globalAdmin: wantsGlobalAdmin },
  });

  console.info(`[ADMIN-USERS][POST] created admin=${admin?.email ?? "-"} user=${user?.email ?? user?.id} globalAdmin=${wantsGlobalAdmin}`);
  return NextResponse.json({ ok: true, temp_password: tempPasswordPlain }, { status: 201 });
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
  const login = typeof body?.user === "string" ? normalizeLogin(body.user) : null;
  const active = typeof body?.active === "boolean" ? body.active : null;
  const clientId = typeof body?.client_id === "string" ? body.client_id : null;
  const jobTitle = typeof body?.job_title === "string" ? body.job_title.trim() || null : null;
  const linkedinUrl = typeof body?.linkedin_url === "string" ? body.linkedin_url.trim() || null : null;
  const avatarUrl = typeof body?.avatar_url === "string" ? body.avatar_url.trim() || null : null;
  const rawRole = typeof body?.role === "string" ? body.role : "";
  const wantsGlobalAdmin = rawRole.trim().toLowerCase() === "global_admin";
  const role = normalizeRole(rawRole);
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;

  if (email || login) {
    const users = await listLocalUsers();
    if (email && users.some((user) => user.id !== userId && normalizeLogin(user.email) === email)) {
      return NextResponse.json({ error: "E-mail ja existe" }, { status: 409 });
    }
    if (login && users.some((user) => user.id !== userId && normalizeLogin(user.user ?? user.email) === login)) {
      return NextResponse.json({ error: "Usuario ja existe" }, { status: 409 });
    }
  }

  const updated = await updateLocalUser(userId, {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(login ? { user: login } : {}),
    ...(active !== null ? { active } : {}),
    ...(jobTitle !== null ? { job_title: jobTitle } : {}),
    ...(linkedinUrl !== null ? { linkedin_url: linkedinUrl } : {}),
    ...(avatarUrl !== null ? { avatar_url: avatarUrl } : {}),
    ...(rawRole ? { globalRole: wantsGlobalAdmin ? "global_admin" : null, is_global_admin: wantsGlobalAdmin } : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  if (clientId) {
    await upsertLocalLink({ userId, companyId: clientId, role, capabilities });
  }

  await addAuditLogSafe({
    actorUserId: admin.id,
    actorEmail: admin.email,
    action: "user.updated",
    entityType: "user",
    entityId: updated.id,
    entityLabel: updated.email,
    metadata: { companyId: clientId, role, active },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
