
import { NextRequest, NextResponse } from "next/server";
import { listLocalUsers, updateLocalUser } from "@/backend/auth/localStore";
import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";
import { isE2eMockAllowed } from "@/backend/auth/e2eMockGate";

// PATCH: Edita um usuário existente
export async function PATCH(req: NextRequest, context: { params: any }) {
  // Permite autenticação fake para testes E2E, somente com o mock E2E habilitado
  // (PLAYWRIGHT_MOCK=true e fora de produção — ver backend/auth/e2eMockGate.ts).
  let testAdmin = false;
  if (isE2eMockAllowed() && req.headers) {
    if (typeof req.headers.get === 'function') {
      testAdmin = req.headers.get('x-test-admin') === 'true';
    } else if (typeof req.headers.entries === 'function') {
      for (const [key, value] of req.headers.entries()) {
        if (key.toLowerCase() === 'x-test-admin' && value === 'true') testAdmin = true;
      }
    }
  }
  if (!testAdmin) {
    const { admin, status } = await requireGlobalAdminWithStatus(req);
    if (!admin) {
      return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
    }
  }
  const params = typeof context.params.then === "function" ? await context.params : context.params;
  const { id } = params;
  const data = await req.json().catch(() => null);
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
  }
  const users = await listLocalUsers();
  const user = users.find((u: any) => u.id === id);
  if (!user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }
  const update: any = {};
  if (typeof data?.name === "string") {
    update.name = data.name;
    update.full_name = data.name;
  }
  if (typeof data?.email === "string") update.email = data.email;
  if (typeof data?.user === "string") update.user = data.user;
  // Adicione outros campos conforme necessário
  let updated = null;
  try {
    updated = await updateLocalUser(id, update);
  } catch (err) {
    const code = err && typeof err === "object" ? (err as { code?: string }).code : null;
    if (code === "DUPLICATE_EMAIL") {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }
    if (code === "DUPLICATE_USER") {
      return NextResponse.json({ error: "Usuário já cadastrado" }, { status: 409 });
    }
    throw err;
  }
  if (!updated) {
    return NextResponse.json({ error: "Falha ao atualizar usuário" }, { status: 500 });
  }
  return NextResponse.json(updated, { status: 200 });
}


