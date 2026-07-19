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
jest.mock("@/backend/jiraCloud", () => ({ validateJiraCloudCredentials: jest.fn() }));
jest.mock("@/database/prismaClient", () => ({
  prisma: { company: { findUnique: jest.fn(), update: jest.fn() } },
}));

import { PATCH } from "@/api/company-integrations/[slug]/configuration/route";
import { resolveOperationalContext } from "@/backend/context/operationalContext";
import { createQaseClient, QaseError } from "@/backend/qaseSdk";
import { validateJiraCloudCredentials } from "@/backend/jiraCloud";
import { prisma } from "@/database/prismaClient";

const mockedResolveOperationalContext = resolveOperationalContext as jest.MockedFunction<typeof resolveOperationalContext>;
const mockedCreateQaseClient = createQaseClient as jest.MockedFunction<typeof createQaseClient>;
const mockedValidateJiraCloudCredentials = validateJiraCloudCredentials as jest.MockedFunction<typeof validateJiraCloudCredentials>;

function mockPrisma() {
  return prisma as unknown as { company: { findUnique: jest.Mock; update: jest.Mock } };
}

function okContext() {
  return { ok: true, context: { access: { userId: "user-1" } } } as never;
}

function routeParams() {
  return { params: Promise.resolve({ slug: "empresa-1" }) };
}

function makeRequest(body: unknown) {
  return new Request("https://app.local/api/company-integrations/empresa-1/configuration", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

describe("app/api/company-integrations/[slug]/configuration/route.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna 400 quando o corpo não passa no schema (provider ausente)", async () => {
    const res = await PATCH(makeRequest({ token: "abc" }), routeParams());
    expect(res.status).toBe(400);
  });

  it("retorna 400 quando a url do Jira é inválida", async () => {
    const res = await PATCH(makeRequest({ provider: "jira", baseUrl: "nao-e-url", email: "a@b.com", token: "tok" }), routeParams());
    expect(res.status).toBe(400);
  });

  it("repassa a resposta quando o contexto operacional nega acesso", async () => {
    mockedResolveOperationalContext.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403 }) as never,
    } as never);
    const res = await PATCH(makeRequest({ provider: "qase", token: "tok" }), routeParams());
    expect(res.status).toBe(403);
  });

  it("retorna 404 quando a empresa não existe", async () => {
    mockedResolveOperationalContext.mockResolvedValue(okContext());
    mockPrisma().company.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ provider: "qase", token: "tok" }), routeParams());
    expect(res.status).toBe(404);
  });

  describe("provider qase", () => {
    it("retorna o status do QaseError quando o token é inválido", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      mockPrisma().company.findUnique.mockResolvedValue({ id: "company-1" });
      mockedCreateQaseClient.mockReturnValue({
        listProjects: jest.fn().mockRejectedValue(new QaseError("unauthorized", 401)),
      } as never);

      const res = await PATCH(makeRequest({ provider: "qase", token: "tok-invalido" }), routeParams());
      expect(res.status).toBe(401);
    });

    it("salva o token e ativa o modo qase com sucesso", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      const db = mockPrisma();
      db.company.findUnique.mockResolvedValue({ id: "company-1" });
      mockedCreateQaseClient.mockReturnValue({ listProjects: jest.fn().mockResolvedValue({ result: { entities: [] } }) } as never);

      const res = await PATCH(makeRequest({ provider: "qase", token: "tok-valido" }), routeParams());
      expect(res.status).toBe(200);
      expect(db.company.update).toHaveBeenCalledWith({
        where: { id: "company-1" },
        data: { qase_token: "tok-valido", integration_mode: "qase" },
      });
    });
  });

  describe("provider jira", () => {
    it("retorna o erro de validação quando as credenciais do Jira são inválidas", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      mockPrisma().company.findUnique.mockResolvedValue({ id: "company-1" });
      mockedValidateJiraCloudCredentials.mockResolvedValue({ valid: false, errorMessage: "Credenciais inválidas", status: 401 } as never);

      const res = await PATCH(
        makeRequest({ provider: "jira", baseUrl: "https://empresa.atlassian.net", email: "a@b.com", token: "tok" }),
        routeParams(),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Credenciais inválidas");
    });

    it("salva as credenciais e ativa o modo jira com sucesso", async () => {
      mockedResolveOperationalContext.mockResolvedValue(okContext());
      const db = mockPrisma();
      db.company.findUnique.mockResolvedValue({ id: "company-1" });
      mockedValidateJiraCloudCredentials.mockResolvedValue({
        valid: true,
        accountId: "acc-1",
        accountName: "Fulano",
        baseUrl: "https://empresa.atlassian.net",
      } as never);

      const res = await PATCH(
        makeRequest({ provider: "jira", baseUrl: "https://empresa.atlassian.net", email: "a@b.com", token: "tok" }),
        routeParams(),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true, provider: "jira", accountName: "Fulano" });
      expect(db.company.update).toHaveBeenCalledWith({
        where: { id: "company-1" },
        data: {
          jira_base_url: "https://empresa.atlassian.net",
          jira_email: "a@b.com",
          jira_api_token: "tok",
          integration_mode: "jira",
        },
      });
    });
  });
});
