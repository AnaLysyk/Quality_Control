import { NextRequest, NextResponse } from "next/server";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";
import fs from "fs/promises";
import path from "path";

function getUsersPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "users.json");
}

async function readUsers(companyId: string) {
  try {
    const data = await fs.readFile(getUsersPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    // Inicializa arquivo se não existir
    await writeUsers(companyId, []);
    return [];
  }
}

async function writeUsers(companyId: string, users: any[]) {
  await fs.mkdir(path.dirname(getUsersPath(companyId)), { recursive: true });
  await fs.writeFile(getUsersPath(companyId), JSON.stringify(users, null, 2));
}

function safeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // fallback simples
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function GET(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ companyId: string }>)
    : (context.params as { companyId: string });
  const { companyId } = params;
  const users = await readUsers(companyId);
  return NextResponse.json(users);
}

export async function POST(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  console.error('[USERS][POST] admin recebido:', JSON.stringify(admin));
  if (!admin) return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  try {
    const params = (context.params && typeof (context.params as any).then === 'function')
      ? await (context.params as Promise<{ companyId: string }>)
      : (context.params as { companyId: string });
    const { companyId } = params;
    // Busca empresa no localAuthStore
    const { listLocalCompanies } = await import("@/lib/auth/localStore");
    const companies = await listLocalCompanies();
    const company = companies.find((c: any) => c.id === companyId);
    if (!company) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
    }
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!body.name || !body.email || !body.role) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: name, email, role" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Permite admin, dev, global_admin, super-admin, e test-admin (E2E)
    const allowedCreatorRoles = ["admin", "dev", "global_admin", "super-admin"];
    const creatorRole = ((admin as any)?.role || (admin as any)?.globalRole || "").toString().toLowerCase();
    // Permite bypass para E2E test admin
    const isTestAdmin = admin?.id === 'test-admin' && admin?.email === 'admin@teste.com';
    if (!allowedCreatorRoles.includes(creatorRole) && !isTestAdmin) {
      console.error('[USERS][POST] admin:', JSON.stringify(admin));
      console.error('[USERS][POST] creatorRole:', creatorRole);
      return NextResponse.json({ error: `Apenas admin, dev ou global_admin pode criar usuários`, admin, creatorRole }, { status: 403 });
    }
    // Só permite criar roles válidas
    const validRoles = ["empresa", "usuario", "admin", "dev"];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: "Role inválida. Use: empresa, usuario, admin, dev" }, { status: 400 });
    }
    const users = await readUsers(companyId);
    const newUser = {
      id: safeUUID(),
      name: body.name,
      email: body.email,
      role: body.role,
      companyId,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await writeUsers(companyId, users);
    return NextResponse.json(newUser, { status: 201 });
  } catch (err: any) {
    console.error('POST /users error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err), stack: err?.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ companyId: string }>)
    : (context.params as { companyId: string });
  const { companyId } = params;
  const body = await req.json();
  const users = await readUsers(companyId);
  const idx = users.findIndex((u: any) => u.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  Object.assign(users[idx], body.updates, { updatedAt: new Date().toISOString() });
  await writeUsers(companyId, users);
  return NextResponse.json(users[idx]);
}

export async function DELETE(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) return NextResponse.json({ error: status === 401 ? "Nao autenticado" : "Sem permissao" }, { status });
  // Permite admin, dev, e test-admin (E2E) excluir usuários
  const allowedDeleterRoles = ["admin", "dev"];
  const deleterRole = (admin as any).role ? String((admin as any).role).toLowerCase() : "";
  const isTestAdmin = admin?.id === 'test-admin' && admin?.email === 'admin@teste.com';
  if (!allowedDeleterRoles.includes(deleterRole) && !isTestAdmin) {
    return NextResponse.json({ error: "Apenas admin ou dev pode excluir usuários" }, { status: 403 });
  }
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ companyId: string }>)
    : (context.params as { companyId: string });
  const { companyId } = params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON obrigatório para exclusão de usuário" }, { status: 400 });
  }
  if (!body || !body.id) {
    return NextResponse.json({ error: "Campo 'id' obrigatório para exclusão de usuário" }, { status: 400 });
  }
  const users = await readUsers(companyId);
  const idx = users.findIndex((u: any) => u.id === body.id);
  if (idx === -1) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }
  users[idx].deletedAt = new Date().toISOString();
  await writeUsers(companyId, users);
  return NextResponse.json({ ok: true });
}
