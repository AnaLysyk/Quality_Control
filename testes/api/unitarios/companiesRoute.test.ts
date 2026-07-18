jest.mock("@/backend/auth/session", () => ({ getAccessContext: jest.fn() }));
jest.mock("@/backend/serverPermissionAccess", () => ({ resolvePermissionAccessForUser: jest.fn() }));
jest.mock("@/backend/rbac/requireGlobalAdmin", () => ({ requireGlobalAdminWithStatus: jest.fn() }));
jest.mock("@/backend/brain-sync", () => ({ syncCompanyToBrain: jest.fn(async () => {}) }));
jest.mock("@/data/auditLogRepository", () => ({ addAuditLogSafe: jest.fn(async () => {}) }));
jest.mock("@/backend/auth/localStore", () => ({
  listLocalCompanies: jest.fn(),
  createLocalCompany: jest.fn(),
  deleteLocalCompany: jest.fn(async () => true),
}));

import { GET, POST, PATCH, DELETE } from "@/api/companies/route";
import { getAccessContext } from "@/backend/auth/session";
import { resolvePermissionAccessForUser } from "@/backend/serverPermissionAccess";
import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";
import { addAuditLogSafe } from "@/data/auditLogRepository";
import { listLocalCompanies, createLocalCompany, deleteLocalCompany } from "@/backend/auth/localStore";

const mockedGetAccessContext = getAccessContext as jest.MockedFunction<typeof getAccessContext>;
const mockedResolvePermissionAccessForUser = resolvePermissionAccessForUser as jest.MockedFunction<
  typeof resolvePermissionAccessForUser
>;
const mockedRequireGlobalAdminWithStatus = requireGlobalAdminWithStatus as jest.MockedFunction<
  typeof requireGlobalAdminWithStatus
>;
const mockedListLocalCompanies = listLocalCompanies as jest.MockedFunction<typeof listLocalCompanies>;
const mockedCreateLocalCompany = createLocalCompany as jest.MockedFunction<typeof createLocalCompany>;
const mockedDeleteLocalCompany = deleteLocalCompany as jest.MockedFunction<typeof deleteLocalCompany>;
const mockedAddAuditLogSafe = addAuditLogSafe as jest.MockedFunction<typeof addAuditLogSafe>;

const COMPANY_A = {
  id: "cmp-a",
  name: "Empresa A",
  slug: "empresa-a",
  active: true,
  qase_token: "segredo-qase-A",
  jira_api_token: "segredo-jira-A",
  integrations: [
    { type: "QASE", config: { token: "segredo-integracao-qase-A", projects: ["QA1"] } },
    { type: "JIRA", config: { apiToken: "segredo-integracao-jira-A", baseUrl: "https://jira.local" } },
  ],
};
const COMPANY_B = { id: "cmp-b", name: "Empresa B", slug: "empresa-b", active: true, qase_token: "segredo-qase-B" };
const COMPANY_C = { id: "cmp-c", name: "Empresa C", slug: "empresa-c", active: true };

function allCompanies() {
  return [COMPANY_A, COMPANY_B, COMPANY_C] as any;
}

function makeRequest(opts: { url?: string; method?: string; headers?: Record<string, string>; body?: any } = {}) {
  return new Request(opts.url ?? "https://app.local/api/companies", {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }) as any;
}

function mockSession(access: Partial<any> | null) {
  mockedGetAccessContext.mockResolvedValue(access as any);
}

function mockPermissions(permissions: Record<string, string[]>, roleKey = "leader_tc") {
  mockedResolvePermissionAccessForUser.mockResolvedValue({
    userId: "user-1",
    roleKey,
    roleDefaults: {},
    override: null,
    permissions,
  } as any);
}

// Perfis "globais por papel" (não são admin global verdadeiro) usados para
// provar a Correção 2: eles têm applications:create por default, mas não
// podem criar empresa.
function nonAdminSessionWithCreate(role: string, extra: Record<string, any> = {}) {
  mockSession({ userId: "u-1", email: "u@x.com", isGlobalAdmin: false, role, ...extra });
  mockPermissions({ applications: ["view", "create"] }, role);
}

describe("app/api/companies/route.ts - Etapa 2.2 + correções", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedListLocalCompanies.mockResolvedValue(allCompanies());
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // ===================== AUTENTICAÇÃO =====================
  describe("autenticação", () => {
    it("1. GET sem sessão -> 401", async () => {
      mockSession(null);
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
    });

    it("2. POST sem sessão -> 401", async () => {
      mockSession(null);
      const res = await POST(makeRequest({ method: "POST", body: { name: "Nova" } }));
      expect(res.status).toBe(401);
    });

    it("3. DELETE sem sessão -> 401", async () => {
      mockSession(null);
      const res = await DELETE(makeRequest({ method: "DELETE", url: "https://app.local/api/companies?id=cmp-a" }));
      expect(res.status).toBe(401);
    });

    it("4. ?user=vítima não autentica (a rota não lê query param de identidade)", async () => {
      mockSession(null);
      const res = await GET(makeRequest({ url: "https://app.local/api/companies?user=admin@testingcompany.local" }));
      expect(res.status).toBe(401);
      expect(mockedGetAccessContext).toHaveBeenCalled();
    });

    it("5. Bearer inválido não autentica (getAccessContext real decide, aqui simulado como null)", async () => {
      mockSession(null);
      const res = await GET(makeRequest({ headers: { authorization: "Bearer token-invalido-cru" } }));
      expect(res.status).toBe(401);
    });
  });

  // ===================== PERMISSÃO (GET/DELETE) =====================
  describe("permissão efetiva e deny individual (GET/DELETE)", () => {
    it("6. GET autenticado sem view -> 403", async () => {
      mockSession({ userId: "user-1", email: "u@x.com", isGlobalAdmin: false, role: "empresa", companySlugs: ["empresa-a"] });
      mockPermissions({ applications: [] }, "empresa");
      const res = await GET(makeRequest());
      expect(res.status).toBe(403);
    });

    it("8. DELETE autenticado sem delete -> 403", async () => {
      mockSession({ userId: "user-1", email: "u@x.com", isGlobalAdmin: false, role: "empresa" });
      mockPermissions({ applications: ["view", "create"] }, "empresa");
      const res = await DELETE(makeRequest({ method: "DELETE", url: "https://app.local/api/companies?id=cmp-a" }));
      expect(res.status).toBe(403);
      expect(mockedRequireGlobalAdminWithStatus).not.toHaveBeenCalled();
    });

    it("9. deny individual de view -> 403 (mesmo com defaults de role dando view)", async () => {
      mockSession({ userId: "user-1", email: "u@x.com", isGlobalAdmin: false, role: "leader_tc" });
      mockPermissions({ applications: ["create", "delete", "export"] }, "leader_tc");
      const res = await GET(makeRequest());
      expect(res.status).toBe(403);
    });

    it("11. deny individual de delete -> 403", async () => {
      mockSession({ userId: "user-1", email: "u@x.com", isGlobalAdmin: true, role: "leader_tc" });
      mockPermissions({ applications: ["view", "create"] }, "leader_tc");
      const res = await DELETE(makeRequest({ method: "DELETE", url: "https://app.local/api/companies?id=cmp-a" }));
      expect(res.status).toBe(403);
      expect(mockedRequireGlobalAdminWithStatus).not.toHaveBeenCalled();
    });
  });

  // ===================== CORREÇÃO 2: POST exige admin global verdadeiro =====================
  describe("POST exige admin global verdadeiro, applications:create sozinho não basta", () => {
    it("7. POST autenticado sem create -> 403", async () => {
      mockSession({ userId: "user-1", email: "u@x.com", isGlobalAdmin: true, role: "leader_tc" });
      mockPermissions({ applications: ["view"] }, "leader_tc");
      const res = await POST(makeRequest({ method: "POST", body: { name: "Nova" } }));
      expect(res.status).toBe(403);
    });

    it("10. deny individual de create -> 403 mesmo sendo admin global", async () => {
      mockSession({ userId: "user-1", email: "u@x.com", isGlobalAdmin: true, role: "leader_tc" });
      mockPermissions({ applications: ["view", "delete"] }, "leader_tc");
      const res = await POST(makeRequest({ method: "POST", body: { name: "Nova" } }));
      expect(res.status).toBe(403);
    });

    it("perfil Empresa com applications:create -> 403 (não é admin global)", async () => {
      nonAdminSessionWithCreate("empresa");
      const res = await POST(makeRequest({ method: "POST", body: { name: "Nova" } }));
      expect(res.status).toBe(403);
      expect(mockedCreateLocalCompany).not.toHaveBeenCalled();
    });

    it("Líder TC com applications:create -> 403 (Líder TC não é admin global)", async () => {
      nonAdminSessionWithCreate("leader_tc");
      const res = await POST(makeRequest({ method: "POST", body: { name: "Nova" } }));
      expect(res.status).toBe(403);
      expect(mockedCreateLocalCompany).not.toHaveBeenCalled();
    });

    it("Suporte Técnico não-global com applications:create -> 403", async () => {
      nonAdminSessionWithCreate("technical_support");
      const res = await POST(makeRequest({ method: "POST", body: { name: "Nova" } }));
      expect(res.status).toBe(403);
      expect(mockedCreateLocalCompany).not.toHaveBeenCalled();
    });

    it("admin global sem applications:create efetivo -> 403", async () => {
      mockSession({ userId: "admin-1", email: "admin@x.com", isGlobalAdmin: true, role: "leader_tc" });
      mockPermissions({ applications: ["view"] }, "leader_tc");
      const res = await POST(makeRequest({ method: "POST", body: { name: "Nova" } }));
      expect(res.status).toBe(403);
    });

    it("admin global com applications:create -> 201", async () => {
      mockSession({ userId: "admin-1", email: "admin@x.com", isGlobalAdmin: true, role: "leader_tc" });
      mockPermissions({ applications: ["view", "create"] }, "leader_tc");
      mockedCreateLocalCompany.mockResolvedValue({ id: "cmp-nova", name: "Nova", slug: "nova", active: true } as any);

      const res = await POST(makeRequest({ method: "POST", body: { name: "Nova" } }));
      expect(res.status).toBe(201);
    });
  });

  // ===================== ESCOPO (CORREÇÃO 3) =====================
  describe("escopo de empresas por perfil (confia em access.companySlugs/companyId, já derivado de ProjectTeamAssignment para Líder TC/Usuário TC em session.store.ts)", () => {
    it("1. Líder TC com assignment na Empresa A recebe A", async () => {
      mockSession({ userId: "leader-1", email: "leader@x.com", isGlobalAdmin: false, role: "leader_tc", companySlugs: ["empresa-a"] });
      mockPermissions({ applications: ["view"] }, "leader_tc");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.map((c: any) => c.id)).toEqual(["cmp-a"]);
    });

    it("2. Líder TC com assignments em A, B e C recebe A, B e C", async () => {
      mockSession({
        userId: "leader-1",
        email: "leader@x.com",
        isGlobalAdmin: false,
        role: "leader_tc",
        companySlugs: ["empresa-a", "empresa-b", "empresa-c"],
      });
      mockPermissions({ applications: ["view"] }, "leader_tc");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.map((c: any) => c.id).sort()).toEqual(["cmp-a", "cmp-b", "cmp-c"]);
    });

    it("3. Líder TC com link antigo em D, mas sem assignment ativo em D, não recebe D (companySlugs já vem sem D vindo de session.store.ts)", async () => {
      // Empresa D nem está em allCompanies() aqui — simula que o link antigo
      // nunca chega a companySlugs porque getAccessContext já filtra por
      // ProjectTeamAssignment ativo, não por Membership/link.
      mockSession({ userId: "leader-1", email: "leader@x.com", isGlobalAdmin: false, role: "leader_tc", companySlugs: ["empresa-a"] });
      mockPermissions({ applications: ["view"] }, "leader_tc");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.map((c: any) => c.id)).toEqual(["cmp-a"]);
      expect(body.map((c: any) => c.id)).not.toContain("cmp-d");
    });

    it("4. Assignment removido não continua aparecendo por causa de link antigo (companySlugs vazio -> lista vazia)", async () => {
      mockSession({ userId: "leader-1", email: "leader@x.com", isGlobalAdmin: false, role: "leader_tc", companySlugs: [] });
      mockPermissions({ applications: ["view"] }, "leader_tc");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("5. Usuário TC multiempresa recebe empresas dos assignments qa_tc (via companySlugs)", async () => {
      mockSession({
        userId: "tc-1",
        email: "tc@x.com",
        isGlobalAdmin: false,
        role: "testing_company_user",
        companySlugs: ["empresa-a", "empresa-b"],
      });
      mockPermissions({ applications: ["view"] }, "testing_company_user");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.map((c: any) => c.id).sort()).toEqual(["cmp-a", "cmp-b"]);
    });

    it("6a. Líder TC sem nenhum assignment (companySlugs vazio) não recebe todas só pelo papel", async () => {
      mockSession({ userId: "leader-2", email: "leader2@x.com", isGlobalAdmin: false, role: "leader_tc", companySlugs: [] });
      mockPermissions({ applications: ["view"] }, "leader_tc");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("6b. Usuário TC sem nenhum assignment (companySlugs vazio) não recebe todas só pelo papel", async () => {
      mockSession({ userId: "tc-2", email: "tc2@x.com", isGlobalAdmin: false, role: "testing_company_user", companySlugs: [] });
      mockPermissions({ applications: ["view"] }, "testing_company_user");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("Empresa C não vinculada não aparece", async () => {
      mockSession({
        userId: "tc-1",
        email: "tc@x.com",
        isGlobalAdmin: false,
        role: "testing_company_user",
        companySlugs: ["empresa-a"],
      });
      mockPermissions({ applications: ["view"] }, "testing_company_user");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.map((c: any) => c.id)).not.toContain("cmp-c");
    });

    it("Usuário empresarial recebe somente a própria empresa permitida", async () => {
      mockSession({
        userId: "empresa-1",
        email: "empresa@x.com",
        isGlobalAdmin: false,
        role: "empresa",
        companyId: "cmp-a",
        companySlugs: ["empresa-a"],
      });
      mockPermissions({ applications: ["view"] }, "empresa");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.map((c: any) => c.id)).toEqual(["cmp-a"]);
    });

    it("Usuário com permissão, mas sem vínculo, recebe lista vazia (sem fallback para todas)", async () => {
      mockSession({
        userId: "empresa-2",
        email: "semvinculo@x.com",
        isGlobalAdmin: false,
        role: "empresa",
        companyId: null,
        companySlugs: [],
      });
      mockPermissions({ applications: ["view"] }, "empresa");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual([]);
    });

    it("Suporte autorizado recebe todas", async () => {
      mockSession({ userId: "sup-1", email: "sup@x.com", isGlobalAdmin: false, role: "technical_support" });
      mockPermissions({ applications: ["view"] }, "technical_support");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.map((c: any) => c.id).sort()).toEqual(["cmp-a", "cmp-b", "cmp-c"]);
    });

    it("Administrador global autorizado recebe todas", async () => {
      mockSession({ userId: "admin-1", email: "admin@x.com", isGlobalAdmin: true, role: "leader_tc" });
      mockPermissions({ applications: ["view"] }, "leader_tc");

      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.map((c: any) => c.id).sort()).toEqual(["cmp-a", "cmp-b", "cmp-c"]);
    });
  });

  // ===================== SEGREDOS (CORREÇÃO 4) =====================
  describe("nenhum segredo vaza no GET/POST; booleanos só informam existência", () => {
    function mockGlobalAdminSession() {
      mockSession({ userId: "admin-1", email: "admin@x.com", isGlobalAdmin: true, role: "leader_tc" });
      mockPermissions({ applications: ["view", "create", "delete"] }, "leader_tc");
    }

    it("21-25. GET não contém qase_token, jira_api_token, apiToken/token aninhados, clientSecret, accessToken/refreshToken", async () => {
      mockGlobalAdminSession();
      const res = await GET(makeRequest());
      const body = await res.json();
      const serialized = JSON.stringify(body);

      expect(serialized).not.toContain("segredo-qase-A");
      expect(serialized).not.toContain("segredo-jira-A");
      expect(serialized).not.toContain("segredo-integracao-qase-A");
      expect(serialized).not.toContain("segredo-integracao-jira-A");
      expect(serialized).not.toContain("segredo-qase-B");

      for (const item of body) {
        const keys = JSON.stringify(Object.keys(item)).toLowerCase();
        expect(keys).not.toMatch(/qase_token|jira_api_token|apitoken|accesstoken|refreshtoken|clientsecret|secret|senha|privatekey|credentials|cookie|header/);
      }
    });

    it("hasQaseToken/hasJiraToken são booleanos puros (não revelam valor, tamanho, prefixo/sufixo)", async () => {
      mockGlobalAdminSession();
      const res = await GET(makeRequest());
      const body = await res.json();
      const companyA = body.find((c: any) => c.id === "cmp-a");

      expect(typeof companyA.hasQaseToken).toBe("boolean");
      expect(typeof companyA.hasJiraToken).toBe("boolean");
      expect(companyA.hasQaseToken).toBe(true);
      expect(companyA.hasJiraToken).toBe(true);
      // nada no objeto deve conter fragmentos do segredo original
      expect(JSON.stringify(companyA)).not.toMatch(/segredo/);
    });

    it("26. POST 201 não devolve os tokens recebidos no corpo", async () => {
      mockGlobalAdminSession();
      mockedCreateLocalCompany.mockResolvedValue({
        id: "cmp-nova",
        name: "Nova",
        slug: "nova",
        active: true,
        qase_token: "segredo-enviado-no-post",
        integrations: [{ type: "QASE", config: { token: "segredo-enviado-no-post", projects: [] } }],
      } as any);

      const res = await POST(
        makeRequest({ method: "POST", body: { name: "Nova", qase_token: "segredo-enviado-no-post" } }),
      );
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(JSON.stringify(body)).not.toContain("segredo-enviado-no-post");
      expect(body.hasQaseToken).toBe(true);
    });

    it("27. auditoria (client.created) não contém secrets no metadata", async () => {
      mockGlobalAdminSession();
      mockedCreateLocalCompany.mockResolvedValue({
        id: "cmp-nova",
        name: "Nova",
        slug: "nova",
        active: true,
        qase_token: "segredo-auditoria",
      } as any);

      await POST(makeRequest({ method: "POST", body: { name: "Nova", qase_token: "segredo-auditoria" } }));

      expect(mockedAddAuditLogSafe).toHaveBeenCalledTimes(1);
      const call = mockedAddAuditLogSafe.mock.calls[0][0] as any;
      expect(JSON.stringify(call)).not.toContain("segredo-auditoria");
      expect(call.action).toBe("client.created");
    });

    it("28. nenhum console.log/console.error é chamado com tokens (nenhum log de segredo)", async () => {
      mockGlobalAdminSession();
      mockedCreateLocalCompany.mockResolvedValue({
        id: "cmp-nova",
        name: "Nova",
        slug: "nova",
        active: true,
        qase_token: "segredo-de-log",
      } as any);

      await GET(makeRequest());
      await POST(makeRequest({ method: "POST", body: { name: "Nova", qase_token: "segredo-de-log" } }));

      const allLoggedText = [...consoleErrorSpy.mock.calls, ...consoleLogSpy.mock.calls]
        .flat()
        .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
        .join(" ");
      expect(allLoggedText).not.toContain("segredo-de-log");
    });
  });

  // ===================== FUNCIONALIDADE =====================
  describe("funcionalidade", () => {
    function mockGlobalAdminSession() {
      mockSession({ userId: "admin-1", email: "admin@x.com", isGlobalAdmin: true, role: "leader_tc" });
      mockPermissions({ applications: ["view", "create", "delete"] }, "leader_tc");
    }

    it("29. POST autorizado cria empresa e retorna 201", async () => {
      mockGlobalAdminSession();
      mockedCreateLocalCompany.mockResolvedValue({ id: "cmp-nova", name: "Nova", slug: "nova", active: true } as any);

      const res = await POST(makeRequest({ method: "POST", body: { name: "Nova" } }));
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBe("cmp-nova");
    });

    it("30. POST sem name retorna 400", async () => {
      mockGlobalAdminSession();
      const res = await POST(makeRequest({ method: "POST", body: {} }));
      expect(res.status).toBe(400);
      expect(mockedCreateLocalCompany).not.toHaveBeenCalled();
    });

    it("31. DELETE autorizado remove e preserva auditoria", async () => {
      mockGlobalAdminSession();
      mockedRequireGlobalAdminWithStatus.mockResolvedValue({
        admin: { id: "admin-1", email: "admin@x.com", token: "" } as any,
        status: 200,
      });
      mockedListLocalCompanies.mockResolvedValue(allCompanies());
      mockedDeleteLocalCompany.mockResolvedValue(true as any);

      const res = await DELETE(makeRequest({ method: "DELETE", url: "https://app.local/api/companies?id=cmp-a" }));
      expect(res.status).toBe(200);
      expect(mockedDeleteLocalCompany).toHaveBeenCalledWith("cmp-a");
      expect(mockedAddAuditLogSafe).toHaveBeenCalledTimes(1);
      const call = mockedAddAuditLogSafe.mock.calls[0][0] as any;
      expect(call.action).toBe("client.deleted");
    });

    it("32. PATCH continua retornando 501", async () => {
      const res = await PATCH(makeRequest({ method: "PATCH" }));
      expect(res.status).toBe(501);
    });

    it("33. formato retornado no GET continua compatível com as telas consumidoras (campos essenciais presentes, snake_case)", async () => {
      mockGlobalAdminSession();
      const res = await GET(makeRequest());
      const body = await res.json();
      const first = body[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("slug");
      expect(first).toHaveProperty("active");
      expect(first).toHaveProperty("tax_id");
      expect(first).toHaveProperty("logo_url");
      expect(first).toHaveProperty("integration_mode");
      expect(first).toHaveProperty("qase_project_code");
      expect(first).toHaveProperty("qase_project_codes");
      expect(first).toHaveProperty("hasQaseToken");
      expect(first).toHaveProperty("hasJiraToken");
    });
  });
});
