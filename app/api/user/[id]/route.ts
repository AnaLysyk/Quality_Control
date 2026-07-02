
import { NextRequest, NextResponse } from "next/server";
import { listLocalUsers, updateLocalUser } from "@/lib/auth/localStore";
import { requireGlobalAdminWithStatus } from "@/lib/rbac/requireGlobalAdmin";

// PATCH: Edita um usuÃ¡rio existente
export async function PATCH(req: NextRequest, context: { params: any }) {
  // Permite autenticaÃ§Ã£o fake para testes E2E
  let testAdmin = false;
  let testRole = 'leader_tc';
  if (req.headers) {
    if (typeof req.headers.get === 'function') {
      testAdmin = req.headers.get('x-test-admin') === 'true';
      testRole = req.headers.get('x-test-role') || 'leader_tc';
    } else if (typeof req.headers.entries === 'function') {
      for (const [key, value] of req.headers.entries()) {
        if (key.toLowerCase() === 'x-test-admin' && value === 'true') testAdmin = true;
        if (key.toLowerCase() === 'x-test-role') testRole = value;
      }
    }
  }
  // Debug: log headers e fluxo
  try {
    const allHeaders = Array.from((req.headers as any).entries ? req.headers.entries() : []);
    console.error('[PATCH][user][id] headers:', JSON.stringify(allHeaders));
  } catch (e) {
    console.error('[PATCH][user][id] erro ao logar headers:', e);
  }
  console.error('[PATCH][user][id] testAdmin:', testAdmin, 'testRole:', testRole);
  if (!testAdmin) {
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    console.error('[PATCH][user][id] admin:', JSON.stringify(admin));
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? "NÃ£o autenticado" : "Sem permissÃ£o" }, { status });
    }
  }
  const params = typeof context.params.then === "function" ? await context.params : context.params;
  const { id } = params;
  const data = await req.json().catch(() => null);
  if (!id) {
    return NextResponse.json({ error: "ID obrigatÃ³rio" }, { status: 400 });
  }
  const users = await listLocalUsers();
  const user = users.find((u: any) => u.id === id);
  if (!user) {
    return NextResponse.json({ error: "UsuÃ¡rio nÃ£o encontrado" }, { status: 404 });
  }
  const update: any = {};
  if (typeof data?.name === "string") {
    update.name = data.name;
    update.full_name = data.name;
  }
  if (typeof data?.email === "string") update.email = data.email;
  if (typeof data?.user === "string") update.user = data.user;
  // Adicione outros campos conforme necessÃ¡rio
  let updated = null;
  try {
    updated = await updateLocalUser(id, update);
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    if (code === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "E-mail jÃ¡ cadastrado" }, { status: 409 });
    }
    if (code === "DUPLICATE_USER") {
      return NextResponse.json({ error: "UsuÃ¡rio jÃ¡ cadastrado" }, { status: 409 });
    }
    throw err;
  }
  if (!updated) {
    return NextResponse.json({ error: "Falha ao atualizar usuÃ¡rio" }, { status: 500 });
  }
  return NextResponse.json(updated, { status: 200 });
}


