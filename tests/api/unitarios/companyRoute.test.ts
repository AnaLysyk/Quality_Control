jest.mock("@/backend/auth/session", () => ({ getAccessContext: jest.fn() }));
jest.mock("@/backend/rbac/requireGlobalAdmin", () => ({ requireGlobalAdminWithStatus: jest.fn() }));
jest.mock("@/backend/auth/localStore", () => ({
  createLocalCompany: jest.fn(),
  findLocalCompanyById: jest.fn(),
  listLocalCompanies: jest.fn(),
}));

import { GET, POST } from "@/api/company/route";
import { getAccessContext } from "@/backend/auth/session";
import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";
import { createLocalCompany, findLocalCompanyById, listLocalCompanies } from "@/backend/auth/localStore";

const mockedGetAccessContext = getAccessContext as jest.MockedFunction<typeof getAccessContext>;
const mockedRequireGlobalAdminWithStatus = requireGlobalAdminWithStatus as jest.MockedFunction<
  typeof requireGlobalAdminWithStatus
>;
const mockedCreateLocalCompany = createLocalCompany as jest.MockedFunction<typeof createLocalCompany>;
const mockedFindLocalCompanyById = findLocalCompanyById as jest.MockedFunction<typeof findLocalCompanyById>;
const mockedListLocalCompanies = listLocalCompanies as jest.MockedFunction<typeof listLocalCompanies>;

const COMPANY_WITH_SECRETS = {
  id: "cmp-a",
  name: "Empresa A",
  slug: "empresa-a",
  active: true,
  qase_token: "segredo-qase-cru",
  jira_api_token: "segredo-jira-cru",
};

function makeRequest(opts: { method?: string; body?: any } = {}) {
  return new Request("https://app.local/api/company", {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }) as any;
}

describe("app/api/company - nenhum segredo cru (qase_token/jira_api_token) vaza na resposta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET como admin global não devolve qase_token/jira_api_token crus da lista de empresas", async () => {
    mockedGetAccessContext.mockResolvedValue({ isGlobalAdmin: true } as any);
    mockedListLocalCompanies.mockResolvedValue([COMPANY_WITH_SECRETS] as any);

    const res = await GET(makeRequest());
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("segredo-qase-cru");
    expect(serialized).not.toContain("segredo-jira-cru");
    expect(body.items[0].has_qase_token).toBe(true);
    expect(body.items[0].has_jira_api_token).toBe(true);
  });

  it("GET de usuário comum (própria empresa) não devolve qase_token/jira_api_token crus", async () => {
    mockedGetAccessContext.mockResolvedValue({ isGlobalAdmin: false, role: "empresa", companyId: "cmp-a" } as any);
    mockedFindLocalCompanyById.mockResolvedValue(COMPANY_WITH_SECRETS as any);

    const res = await GET(makeRequest());
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("segredo-qase-cru");
    expect(serialized).not.toContain("segredo-jira-cru");
    expect(body.items[0].has_qase_token).toBe(true);
  });

  it("POST autorizado não devolve tokens crus na resposta", async () => {
    mockedRequireGlobalAdminWithStatus.mockResolvedValue({
      admin: { id: "admin-1", email: "admin@x.com", token: "" } as any,
      status: 200,
    });
    mockedCreateLocalCompany.mockResolvedValue(COMPANY_WITH_SECRETS as any);

    const res = await POST(makeRequest({ method: "POST", body: { name: "Empresa A" } }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(JSON.stringify(body)).not.toContain("segredo-qase-cru");
    expect(JSON.stringify(body)).not.toContain("segredo-jira-cru");
  });
});
