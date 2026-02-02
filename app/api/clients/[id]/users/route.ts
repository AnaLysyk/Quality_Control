import { NextRequest, NextResponse } from "next/server";

import { hashPasswordSha256 } from "@/lib/passwordHash";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import { getAccessContext } from "@/lib/auth/session";
import {
  createLocalUser,
  listLocalLinksForCompany,
  listLocalLinksForUser,
  listLocalUsers,
  normalizeLocalRole,
  removeLocalLink,
  upsertLocalLink,
} from "@/lib/auth/localStore";

type UserItem = {
  id: string;
  role: "ADMIN" | "USER";
  active: boolean;
  name: string;
  email: string;
};

function isAdminAccess(access: Awaited<ReturnType<typeof getAccessContext>> | null) {
  if (!access) return false;
  if (access.isGlobalAdmin) return true;
  return (access.role ?? "").toLowerCase() === "admin";
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ message: "Nao autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestAll = searchParams.get("all") === "true";
  if (requestAll && !isAdminAccess(access)) {
    return NextResponse.json({ message: "Sem permissao" }, { status: 403 });
  }

  const { id: companyId } = await context.params;
  const links = requestAll
    ? await listLocalLinksForCompany(companyId)
    : (await listLocalLinksForUser(access.userId)).filter((link) => link.companyId === companyId);

  const users = await listLocalUsers();
  const userById = new Map(users.map((user) => [user.id, user]));

  const items: UserItem[] = links.map((link) => {
    const user = userById.get(link.userId);
    const role = normalizeLocalRole(link.role ?? null) === "company_admin" ? "ADMIN" : "USER";
    return {
      id: link.userId,
      role,
      active: user?.active !== false,
      name: user?.name ?? "",
      email: user?.email ?? "",
    };
  });

  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ message: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = (() => {
    const raw = typeof body?.role === "string" ? body.role.toUpperCase() : "";
    if (raw === "ADMIN") return "company_admin";
    if (raw === "VIEWER") return "viewer";
    return "user";
  })();
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;
  if (!email) {
    return NextResponse.json({ message: "Email obrigatorio" }, { status: 400 });
  }

  const { id: companyId } = await context.params;
  const tempPassword = hashPasswordSha256(`${Date.now()}-${email}`);
  const user = await createLocalUser({ name: email, email, password_hash: tempPassword, active: true });
  await upsertLocalLink({ userId: user.id, companyId, role, capabilities });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ message: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ message: "userId obrigatorio" }, { status: 400 });
  }

  const { id: companyId } = await context.params;
  const role = typeof body?.role === "string" ? body.role.toUpperCase() : null;
  const capabilities = Array.isArray(body?.capabilities)
    ? body.capabilities.filter((item: unknown) => typeof item === "string")
    : null;
  const active = typeof body?.active === "boolean" ? body.active : null;

  if (active === false) {
    await removeLocalLink(userId, companyId);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const normalizedRole = role === "ADMIN" ? "company_admin" : role === "VIEWER" ? "viewer" : "user";
  const updatedRole = await upsertLocalLink({ userId, companyId, role: normalizedRole, capabilities });

  return NextResponse.json({ ok: true, role: updatedRole }, { status: 200 });
}
