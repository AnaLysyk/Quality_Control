jest.mock("@/backend/context/operationalContext", () => ({ resolveOperationalContext: jest.fn() }));
jest.mock("@/backend/qaseSdk", () => {
  class QaseError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return { createQaseClient: jest.fn(), QaseError };
});
jest.mock("@/database/prismaClient", () => ({
  prisma: {
    company: { findUnique: jest.fn() },
    project: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

import { GET, POST } from "@/api/company-integrations/[slug]/route";
import { resolveOperationalContext } from "@/backend/context/operationalContext";
import { createQaseClient } from "@/backend/qaseSdk";
import { prisma } from "@/database/prismaClient";

const mockedResolveOperationalContext = resolveOperationalContext as jest.MockedFunction<typeof resolveOperationalContext>;
const mockedCreateQaseClient = createQaseClient as jest.MockedFunction<typeof createQaseClient>;

function mockPrisma() {
  return prisma as unknown as {
    company: { findUnique: jest.Mock };
    project: { findMany: jest.Mock; findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
}

function okContext(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    context: { access: { userId: "user-1" }, ...overrides },
  } as never;
}

function routeParams() {
  return { params: Promise.resolve({ slug: "empresa-1" }) };
}

function makeRequest(method: string, url: string, opts: { body?: unknown } = {}) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }) as unknown as Request;
}

describe("app/api/company-integrations/[slug]/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("retorna 400 para provider inválido", async () => {
      const res = await GET(makeRequest("GET", "https://app.local/api/company-integrations/empresa-1?provider=bogus"), routeParams());
      expect(res.status).toBe(400);
    });

    it("repassa a resposta quando o contexto operacional nega acesso", async () => {
      mockedResolveOperationalContext.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403 }) as never,
      } as never);
      const res = await GET(makeRequest("GET", "https://app.local/api/company-integrations/empresa-1?provider=qase"), routeParams());
      expect(res.status).toBe(403);
    });

    it("retorna 404 quando a empresa não existe", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      mockPrisma().company.findUnique.mockResolvedValue(null);
      const res = await GET(makeRequest("GET", "https://app.local/api/company-integrations/empresa-1?provider=qase"), routeParams());
      expect(res.status).toBe(404);
    });

    it("retorna os projetos Qase disponíveis e marca o projeto interno já vinculado", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      const db = mockPrisma();
      db.company.findUnique.mockResolvedValue({ id: "company-1", name: "Empresa", qase_token: "token-123", jira_base_url: null, jira_email: null, jira_api_token: null });
      db.project.findMany.mockResolvedValue([{ id: "project-1", name: "Projeto", slug: "projeto-1", qaseProjectCode: "QC-1", jiraProjectKey: null, manualCreationDisabled: false }]);
      mockedCreateQaseClient.mockReturnValue({
        listProjects: jest.fn().mockResolvedValue({ result: { entities: [{ code: "qc-1", title: "Quality Control" }] } }),
      } as never);

      const res = await GET(makeRequest("GET", "https://app.local/api/company-integrations/empresa-1?provider=qase"), routeParams());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.company.configured).toBe(true);
      expect(body.externalProjects).toEqual([
        { key: "QC-1", name: "Quality Control", linkedProject: expect.objectContaining({ id: "project-1" }) },
      ]);
    });

    it("retorna erro 502 quando a consulta ao Qase falha", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      const db = mockPrisma();
      db.company.findUnique.mockResolvedValue({ id: "company-1", name: "Empresa", qase_token: "token-123", jira_base_url: null, jira_email: null, jira_api_token: null });
      db.project.findMany.mockResolvedValue([]);
      mockedCreateQaseClient.mockReturnValue({
        listProjects: jest.fn().mockRejectedValue(new Error("timeout")),
      } as never);

      const res = await GET(makeRequest("GET", "https://app.local/api/company-integrations/empresa-1?provider=qase"), routeParams());
      expect(res.status).toBe(502);
    });
  });

  describe("POST", () => {
    const validQaseBody = {
      provider: "qase",
      externalKey: "qc-2",
      externalName: "Novo Projeto",
      projectId: "project-1",
      confirmIntegratedRepository: true,
    };

    it("retorna 400 quando o corpo não passa no schema", async () => {
      const res = await POST(makeRequest("POST", "https://app.local/api/company-integrations/empresa-1", { body: { provider: "qase" } }), routeParams());
      expect(res.status).toBe(400);
    });

    it("repassa a resposta quando o contexto operacional nega acesso", async () => {
      mockedResolveOperationalContext.mockResolvedValue({
        ok: false,
        response: new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403 }) as never,
      } as never);
      const res = await POST(makeRequest("POST", "https://app.local/api/company-integrations/empresa-1", { body: validQaseBody }), routeParams());
      expect(res.status).toBe(403);
    });

    it("exige confirmIntegratedRepository para provider qase", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      const res = await POST(
        makeRequest("POST", "https://app.local/api/company-integrations/empresa-1", { body: { ...validQaseBody, confirmIntegratedRepository: false } }),
        routeParams(),
      );
      expect(res.status).toBe(400);
    });

    it("retorna 409 quando a chave externa já está vinculada a outro projeto", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      const db = mockPrisma();
      db.company.findUnique.mockResolvedValue({ id: "company-1" });
      db.project.findFirst.mockResolvedValueOnce({ id: "outro-projeto", name: "Outro Projeto" });

      const res = await POST(makeRequest("POST", "https://app.local/api/company-integrations/empresa-1", { body: validQaseBody }), routeParams());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/já vinculada ao projeto Outro Projeto/);
    });

    it("bloqueia substituir o vínculo existente sem forceReplace (409 com o código de confirmação)", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      const db = mockPrisma();
      db.company.findUnique.mockResolvedValue({ id: "company-1" });
      db.project.findFirst
        .mockResolvedValueOnce(null) // sem duplicado com essa chave
        .mockResolvedValueOnce({ id: "project-1", name: "Projeto", qaseProjectCode: "QC-ANTIGO", jiraProjectKey: null });

      const res = await POST(makeRequest("POST", "https://app.local/api/company-integrations/empresa-1", { body: validQaseBody }), routeParams());
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.code).toBe("EXTERNAL_LINK_REPLACEMENT_REQUIRES_CONFIRMATION");
      expect(body.currentExternalKey).toBe("QC-ANTIGO");
    });

    it("substitui o vínculo com sucesso quando forceReplace=true", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      const db = mockPrisma();
      db.company.findUnique.mockResolvedValue({ id: "company-1" });
      db.project.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "project-1", name: "Projeto", qaseProjectCode: "QC-ANTIGO", jiraProjectKey: null });
      db.project.update.mockResolvedValue({ id: "project-1" });

      const res = await POST(
        makeRequest("POST", "https://app.local/api/company-integrations/empresa-1", { body: { ...validQaseBody, forceReplace: true } }),
        routeParams(),
      );
      expect(res.status).toBe(200);
      expect(db.project.update).toHaveBeenCalledWith({
        where: { id: "project-1" },
        data: { qaseProjectCode: "QC-2", manualCreationDisabled: false },
      });
    });

    it("cria um novo projeto integrado quando createProject=true", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      const db = mockPrisma();
      db.company.findUnique.mockResolvedValue({ id: "company-1" });
      db.project.findFirst.mockResolvedValueOnce(null);
      db.project.findUnique.mockResolvedValue(null);
      db.project.create.mockResolvedValue({ id: "project-novo" });

      const res = await POST(
        makeRequest("POST", "https://app.local/api/company-integrations/empresa-1", {
          body: { provider: "qase", externalKey: "qc-3", externalName: "Projeto Novo", createProject: true, confirmIntegratedRepository: true },
        }),
        routeParams(),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true, projectId: "project-novo", provider: "qase", externalKey: "QC-3" });
    });
  });
});
