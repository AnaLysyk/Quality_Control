jest.mock("@/backend/context/operationalContext", () => ({ resolveOperationalContext: jest.fn() }));
jest.mock("@/backend/qaseSdk", () => ({
  QaseError: class QaseError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  createQaseClient: jest.fn(),
}));
jest.mock("@/backend/jiraCloud", () => ({ validateJiraCloudCredentials: jest.fn() }));
jest.mock("@/database/prismaClient", () => ({
  prisma: {
    company: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

import { PATCH } from "@/api/company-integrations/[slug]/configuration/route";
import { resolveOperationalContext } from "@/backend/context/operationalContext";
import { createQaseClient, QaseError } from "@/backend/qaseSdk";
import { validateJiraCloudCredentials } from "@/backend/jiraCloud";
import { prisma } from "@/database/prismaClient";

const mockedResolveContext = resolveOperationalContext as jest.MockedFunction<typeof resolveOperationalContext>;
const mockedCreateQaseClient = createQaseClient as jest.MockedFunction<typeof createQaseClient>;
const mockedValidateJira = validateJiraCloudCredentials as jest.MockedFunction<typeof validateJiraCloudCredentials>;
const mockedCompany = prisma.company as unknown as { findUnique: jest.Mock; update: jest.Mock };

function request(body: unknown) {
  return new Request("https://app.local/api/company-integrations/empresa/configuration", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ slug: "empresa" }) };

describe("company integrations configuration route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedResolveContext.mockResolvedValue({ ok: true } as never);
    mockedCompany.findUnique.mockResolvedValue({ id: "company-1" });
    mockedCompany.update.mockResolvedValue({ id: "company-1" });
  });

  it("retorna 400 para payload inválido, URL inválida e e-mail inválido", async () => {
    expect((await PATCH(request({}), context)).status).toBe(400);
    expect((await PATCH(request({ provider: "jira", baseUrl: "x", email: "invalido", token: "t" }), context)).status).toBe(400);
  });

  it("respeita bloqueio do contexto operacional", async () => {
    mockedResolveContext.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) } as never);
    expect((await PATCH(request({ provider: "qase", token: "token" }), context)).status).toBe(403);
  });

  it("retorna 404 quando a empresa não existe", async () => {
    mockedCompany.findUnique.mockResolvedValue(null);
    expect((await PATCH(request({ provider: "qase", token: "token" }), context)).status).toBe(404);
  });

  it("valida e salva configuração do Qase", async () => {
    const listProjects = jest.fn().mockResolvedValue({ entities: [] });
    mockedCreateQaseClient.mockReturnValue({ listProjects } as never);

    const response = await PATCH(request({ provider: "qase", token: " token-qase " }), context);
    expect(response.status).toBe(200);
    expect(listProjects).toHaveBeenCalledWith({ limit: 1, offset: 0 });
    expect(mockedCompany.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { qase_token: "token-qase", integration_mode: "qase" },
    }));
  });

  it("mapeia erro de autenticação do Qase", async () => {
    mockedCreateQaseClient.mockReturnValue({
      listProjects: jest.fn().mockRejectedValue(new QaseError("inválido", 401)),
    } as never);
    expect((await PATCH(request({ provider: "qase", token: "token" }), context)).status).toBe(401);
  });

  it("retorna erro de validação do Jira", async () => {
    mockedValidateJira.mockResolvedValue({ valid: false, errorMessage: "Credenciais inválidas", status: 401 } as never);
    const response = await PATCH(request({
      provider: "jira",
      baseUrl: "https://empresa.atlassian.net",
      email: "qa@empresa.com",
      token: "token",
    }), context);
    expect(response.status).toBe(401);
  });

  it("normaliza, valida e salva configuração do Jira", async () => {
    mockedValidateJira.mockResolvedValue({
      valid: true,
      baseUrl: "https://empresa.atlassian.net",
      accountName: "Ana",
    } as never);

    const response = await PATCH(request({
      provider: "jira",
      baseUrl: " https://empresa.atlassian.net ",
      email: " qa@empresa.com ",
      token: " token-jira ",
    }), context);

    expect(response.status).toBe(200);
    expect(mockedCompany.update).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        jira_base_url: "https://empresa.atlassian.net",
        jira_email: "qa@empresa.com",
        jira_api_token: "token-jira",
        integration_mode: "jira",
      },
    }));
  });
});
