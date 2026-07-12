import { authenticateRequest } from "@/lib/jwtAuth";
import { getAccessContext } from "@/lib/auth/session";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";

jest.mock("@/lib/auth/session", () => ({
  getAccessContext: jest.fn(),
}));

jest.mock("@/lib/serverPermissionAccess", () => ({
  resolvePermissionAccessForUser: jest.fn(),
}));

const mockedGetAccessContext = getAccessContext as jest.MockedFunction<typeof getAccessContext>;
const mockedResolvePermissionAccessForUser = resolvePermissionAccessForUser as jest.MockedFunction<
  typeof resolvePermissionAccessForUser
>;

function makeRequest(input: { url?: string; headers?: Record<string, string> } = {}) {
  const url = input.url ?? "https://app.local/api/qualquer";
  return new Request(url, { headers: input.headers ?? {} });
}

describe("authenticateRequest - Bloco 2 (fechamento do bypass de auth)", () => {
  const originalPlaywrightMock = process.env.PLAYWRIGHT_MOCK;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PLAYWRIGHT_MOCK;
    mockedGetAccessContext.mockResolvedValue(null);
  });

  afterAll(() => {
    if (originalPlaywrightMock === undefined) {
      delete process.env.PLAYWRIGHT_MOCK;
    } else {
      process.env.PLAYWRIGHT_MOCK = originalPlaywrightMock;
    }
  });

  it("retorna null (401 a montante) sem sessão e sem token válido, mesmo sem nenhum header", async () => {
    const req = makeRequest();
    const result = await authenticateRequest(req);
    expect(result).toBeNull();
  });

  it("NÃO autentica mais via ?user=<email> na query string (bypass fechado)", async () => {
    const req = makeRequest({ url: "https://app.local/api/qualquer?user=admin@testingcompany.local" });
    const result = await authenticateRequest(req);
    expect(result).toBeNull();
    expect(mockedGetAccessContext).toHaveBeenCalledWith(req);
  });

  it("NÃO autentica mais via ?user=<id-local-de-usuário>", async () => {
    const req = makeRequest({ url: "https://app.local/api/qualquer?user=00000000-0000-0000-0000-000000000001" });
    const result = await authenticateRequest(req);
    expect(result).toBeNull();
  });

  it("NÃO aceita um Bearer arbitrário (não-JWT/identificador cru) como identidade", async () => {
    const req = makeRequest({ headers: { authorization: "Bearer admin@testingcompany.local" } });
    const result = await authenticateRequest(req);
    expect(result).toBeNull();
  });

  it("autentica normalmente quando existe uma sessão real válida (getAccessContext)", async () => {
    mockedGetAccessContext.mockResolvedValue({
      userId: "user-1",
      email: "user1@empresa.com",
      isGlobalAdmin: false,
      role: "empresa",
      permissionRole: "empresa",
      companyId: "company-1",
      companySlug: "empresa-1",
      companySlugs: ["empresa-1"],
      allowedProjectIds: null,
    } as any);
    mockedResolvePermissionAccessForUser.mockResolvedValue({
      userId: "user-1",
      roleKey: "empresa",
      roleDefaults: {},
      override: null,
      permissions: {},
    } as any);

    const req = makeRequest();
    const result = await authenticateRequest(req);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("user-1");
    expect(result?.email).toBe("user1@empresa.com");
  });

  it("não usa o mock do Playwright fora de PLAYWRIGHT_MOCK=true, mesmo com o cookie e2e_auth presente", async () => {
    delete process.env.PLAYWRIGHT_MOCK;
    const encoded = Buffer.from(
      JSON.stringify({ id: "e2e-user", email: "e2e@testingcompany.local", isGlobalAdmin: true }),
    ).toString("base64url");

    const req = makeRequest({ headers: { cookie: `e2e_auth=${encoded}` } });
    const result = await authenticateRequest(req);

    expect(result).toBeNull();
  });

  it("usa o mock do Playwright somente quando PLAYWRIGHT_MOCK=true e o cookie e2e_auth é válido", async () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    const encoded = Buffer.from(
      JSON.stringify({ id: "e2e-user", email: "e2e@testingcompany.local", isGlobalAdmin: true }),
    ).toString("base64url");

    const req = makeRequest({ headers: { cookie: `e2e_auth=${encoded}` } });
    const result = await authenticateRequest(req);

    expect(result?.id).toBe("e2e-user");
    expect(result?.isGlobalAdmin).toBe(true);
    expect(mockedGetAccessContext).not.toHaveBeenCalled();
  });
});
