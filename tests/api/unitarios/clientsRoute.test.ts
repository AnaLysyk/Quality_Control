jest.mock("@/backend/rbac/requireGlobalAdmin", () => ({ requireGlobalAdminWithStatus: jest.fn() }));
jest.mock("@/backend/auth/localStore", () => ({
  createLocalCompany: jest.fn(),
  listLocalCompanies: jest.fn(),
  updateLocalCompany: jest.fn(),
  deleteLocalCompany: jest.fn(),
}));
jest.mock("@/data/auditLogRepository", () => ({ addAuditLogSafe: jest.fn(async () => {}) }));
jest.mock("@/backend/applicationsStore", () => ({ syncCompanyApplications: jest.fn(async () => {}) }));

import { GET, POST } from "@/api/clients/route";
import { GET as GET_BY_ID, PATCH as PATCH_BY_ID } from "@/api/clients/[id]/route";
import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";
import { createLocalCompany, listLocalCompanies, updateLocalCompany } from "@/backend/auth/localStore";

const mockedRequireGlobalAdminWithStatus = requireGlobalAdminWithStatus as jest.MockedFunction<
  typeof requireGlobalAdminWithStatus
>;
const mockedCreateLocalCompany = createLocalCompany as jest.MockedFunction<typeof createLocalCompany>;
const mockedListLocalCompanies = listLocalCompanies as jest.MockedFunction<typeof listLocalCompanies>;
const mockedUpdateLocalCompany = updateLocalCompany as jest.MockedFunction<typeof updateLocalCompany>;

const COMPANY_WITH_SECRETS = {
  id: "cmp-a",
  name: "Empresa A",
  slug: "empresa-a",
  active: true,
  qase_token: "segredo-qase-cru",
  jira_api_token: "segredo-jira-cru",
};

function mockAuthorized() {
  mockedRequireGlobalAdminWithStatus.mockResolvedValue({
    admin: { id: "admin-1", email: "admin@x.com", token: "" } as any,
    status: 200,
  });
}

function makeRequest(opts: { url?: string; method?: string; body?: any } = {}) {
  return new Request(opts.url ?? "https://app.local/api/clients", {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }) as any;
}

describe("app/api/clients - nenhum segredo cru (qase_token/jira_api_token) vaza na resposta", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("GET /api/clients não devolve qase_token/jira_api_token crus", async () => {
    mockAuthorized();
    mockedListLocalCompanies.mockResolvedValue([COMPANY_WITH_SECRETS] as any);

    const res = await GET(makeRequest());
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("segredo-qase-cru");
    expect(serialized).not.toContain("segredo-jira-cru");
    expect(body.items[0].has_qase_token).toBe(true);
    expect(body.items[0].has_jira_api_token).toBe(true);
  });

  it("POST /api/clients não devolve os tokens recebidos no corpo nem loga segredo no console", async () => {
    mockAuthorized();
    mockedCreateLocalCompany.mockResolvedValue({
      id: "cmp-nova",
      name: "Nova",
      slug: "nova",
      active: true,
      qase_token: "segredo-enviado-no-post",
      jira_api_token: "segredo-jira-enviado-no-post",
    } as any);

    const res = await POST(
      makeRequest({
        method: "POST",
        body: { name: "Nova", qase_token: "segredo-enviado-no-post", jira_api_token: "segredo-jira-enviado-no-post" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(JSON.stringify(body)).not.toContain("segredo-enviado-no-post");
    expect(JSON.stringify(body)).not.toContain("segredo-jira-enviado-no-post");
    expect(body.has_qase_token).toBe(true);
    expect(body.has_jira_api_token).toBe(true);

    const allLoggedText = consoleErrorSpy.mock.calls
      .flat()
      .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      .join(" ");
    expect(allLoggedText).not.toContain("segredo-enviado-no-post");
    expect(allLoggedText).not.toContain("segredo-jira-enviado-no-post");
  });

  it("GET /api/clients/[id] não devolve qase_token/jira_api_token crus", async () => {
    mockAuthorized();
    mockedListLocalCompanies.mockResolvedValue([COMPANY_WITH_SECRETS] as any);

    const res = await GET_BY_ID(makeRequest({ url: "https://app.local/api/clients/cmp-a" }), {
      params: Promise.resolve({ id: "cmp-a" }),
    });
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain("segredo-qase-cru");
    expect(JSON.stringify(body)).not.toContain("segredo-jira-cru");
    expect(body.has_qase_token).toBe(true);
    expect(body.has_jira_api_token).toBe(true);
  });

  it("PATCH /api/clients/[id] não devolve qase_token/jira_api_token crus", async () => {
    mockAuthorized();
    mockedListLocalCompanies.mockResolvedValue([COMPANY_WITH_SECRETS] as any);
    mockedUpdateLocalCompany.mockResolvedValue({
      ...COMPANY_WITH_SECRETS,
      name: "Empresa A Atualizada",
    } as any);

    const res = await PATCH_BY_ID(
      makeRequest({ method: "PATCH", url: "https://app.local/api/clients/cmp-a", body: { name: "Empresa A Atualizada" } }),
      { params: Promise.resolve({ id: "cmp-a" }) },
    );
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain("segredo-qase-cru");
    expect(JSON.stringify(body)).not.toContain("segredo-jira-cru");
    expect(body.has_qase_token).toBe(true);
    expect(body.has_jira_api_token).toBe(true);
  });
});
