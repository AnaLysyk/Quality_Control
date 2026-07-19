/**
 * Regressão de IDOR em app/api/projects/[id]/route.ts: GET e PATCH buscavam o
 * projeto só por id, sem checar se ele pertence à empresa do usuário autenticado.
 * Qualquer usuário com a permissão genérica test_plan:read/update conseguia ler
 * ou editar o projeto de qualquer outra empresa só sabendo (ou adivinhando) o id.
 * Este teste prova que, após a correção, acesso a projeto de outra empresa
 * retorna 404 (sem confirmar a existência do recurso) e nunca chama update.
 */

import type { AuthUser } from "@/backend/jwtAuth";

afterEach(() => {
  jest.resetModules();
  jest.restoreAllMocks();
});

function buildUser(companyId: string): AuthUser {
  return {
    id: "user-empresa-a",
    email: "user@empresa-a.test",
    isGlobalAdmin: false,
    role: "empresa",
    companyId,
    // Bypassa a resolução por perfil e injeta a matriz efetiva direto,
    // já que o alvo do teste é o escopo por empresa, não o catálogo de permissões.
    permissions: { test_plan: ["read", "update", "delete"] },
  };
}

async function loadRouteWithMocks(options: {
  requestingCompanyId: string;
  project: { id: string; companyId: string; name?: string } | null;
  updateMock?: jest.Mock;
}) {
  jest.resetModules();

  jest.doMock("@/backend/jwtAuth", () => ({
    authenticateRequest: jest.fn().mockResolvedValue(buildUser(options.requestingCompanyId)),
  }));

  const findUnique = jest.fn().mockResolvedValue(options.project);
  const update = options.updateMock ?? jest.fn();

  jest.doMock("@/database/prismaClient", () => ({
    prisma: {
      project: { findUnique, update },
      auditLog: { create: jest.fn().mockResolvedValue(undefined) },
    },
  }));

  // writeAuditLog() also fire-and-forgets a Brain ingest; stub it so PATCH tests
  // don't spam unrelated errors from an unmocked Brain Prisma delegate.
  jest.doMock("@/backend/brain/systemIngest", () => ({
    ingestAuditLogInputIntoBrain: jest.fn(),
  }));

  const route = await import("@/api/projects/[id]/route");
  return { route, findUnique, update };
}

describe("app/api/projects/[id] — escopo por empresa (regressão IDOR)", () => {
  it("GET retorna 404 (nao 200) para projeto de outra empresa, sem vazar os dados", async () => {
    const { route } = await loadRouteWithMocks({
      requestingCompanyId: "empresa-a",
      project: { id: "proj-empresa-b", companyId: "empresa-b", name: "Projeto sigiloso da empresa B" },
    });

    const response = await route.GET(new Request("http://test/api/projects/proj-empresa-b"), {
      params: Promise.resolve({ id: "proj-empresa-b" }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).not.toHaveProperty("name");
  });

  it("GET retorna o projeto normalmente quando pertence a propria empresa", async () => {
    const { route } = await loadRouteWithMocks({
      requestingCompanyId: "empresa-a",
      project: { id: "proj-empresa-a", companyId: "empresa-a", name: "Projeto da empresa A" },
    });

    const response = await route.GET(new Request("http://test/api/projects/proj-empresa-a"), {
      params: Promise.resolve({ id: "proj-empresa-a" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe("Projeto da empresa A");
  });

  it("PATCH nao atualiza projeto de outra empresa mesmo conhecendo o id", async () => {
    const update = jest.fn();
    const { route } = await loadRouteWithMocks({
      requestingCompanyId: "empresa-a",
      project: { id: "proj-empresa-b", companyId: "empresa-b" },
      updateMock: update,
    });

    const response = await route.PATCH(
      new Request("http://test/api/projects/proj-empresa-b", {
        method: "PATCH",
        body: JSON.stringify({ name: "Renomeado pelo atacante" }),
      }),
      { params: Promise.resolve({ id: "proj-empresa-b" }) },
    );

    expect(response.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("PATCH atualiza normalmente quando o projeto pertence a propria empresa", async () => {
    const update = jest.fn().mockResolvedValue({
      id: "proj-empresa-a",
      name: "Novo nome",
      companyId: "empresa-a",
      status: "active",
    });
    const { route } = await loadRouteWithMocks({
      requestingCompanyId: "empresa-a",
      project: { id: "proj-empresa-a", companyId: "empresa-a" },
      updateMock: update,
    });

    const response = await route.PATCH(
      new Request("http://test/api/projects/proj-empresa-a", {
        method: "PATCH",
        body: JSON.stringify({ name: "Novo nome" }),
      }),
      { params: Promise.resolve({ id: "proj-empresa-a" }) },
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ where: { id: "proj-empresa-a" }, data: { name: "Novo nome" } });
  });
});
