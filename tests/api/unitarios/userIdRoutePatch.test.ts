jest.mock("@/backend/auth/localStore", () => ({
  listLocalUsers: jest.fn(async () => [{ id: "user-1", email: "user1@empresa.com" }]),
  updateLocalUser: jest.fn(async (id: string, data: any) => ({ id, ...data })),
}));

jest.mock("@/backend/rbac/requireGlobalAdmin", () => ({
  requireGlobalAdminWithStatus: jest.fn(),
}));

import { PATCH } from "@/api/user/[id]/route";
import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";

const mockedRequireGlobalAdminWithStatus = requireGlobalAdminWithStatus as jest.MockedFunction<
  typeof requireGlobalAdminWithStatus
>;

function makeRequest(headers: Record<string, string> = {}, body: any = { name: "Novo Nome" }) {
  return new Request("https://app.local/api/user/user-1", {
    method: "PATCH",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as any;
}

describe("PATCH /api/user/[id] - gate do x-test-admin e não vazamento de headers em log", () => {
  const originalPlaywrightMock = process.env.PLAYWRIGHT_MOCK;
  const originalNodeEnv = process.env.NODE_ENV;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PLAYWRIGHT_MOCK;
    (process.env as any).NODE_ENV = "test";
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  afterAll(() => {
    if (originalPlaywrightMock === undefined) {
      delete process.env.PLAYWRIGHT_MOCK;
    } else {
      process.env.PLAYWRIGHT_MOCK = originalPlaywrightMock;
    }
    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  it("um admin global real (via sessão) consegue editar normalmente", async () => {
    mockedRequireGlobalAdminWithStatus.mockResolvedValue({
      admin: { id: "admin-1", email: "admin@testingcompany.local", token: "" } as any,
      status: 200,
    });

    const req = makeRequest({ authorization: "Bearer token-valido-de-verdade" });
    const res = await PATCH(req, { params: { id: "user-1" } });

    expect(res.status).toBe(200);
    expect(mockedRequireGlobalAdminWithStatus).toHaveBeenCalled();
  });

  it("x-test-admin sozinho NÃO substitui/derruba a checagem real quando o mock E2E está desligado", async () => {
    mockedRequireGlobalAdminWithStatus.mockResolvedValue({ admin: null, status: 401 });

    const req = makeRequest({ "x-test-admin": "true" });
    const res = await PATCH(req, { params: { id: "user-1" } });

    expect(res.status).toBe(401);
    expect(mockedRequireGlobalAdminWithStatus).toHaveBeenCalled();
  });

  it("x-test-admin é ignorado em produção mesmo com PLAYWRIGHT_MOCK=true (usuário real não é substituído por mock)", async () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "production";
    mockedRequireGlobalAdminWithStatus.mockResolvedValue({ admin: null, status: 403 });

    const req = makeRequest({ "x-test-admin": "true" });
    const res = await PATCH(req, { params: { id: "user-1" } });

    expect(res.status).toBe(403);
    expect(mockedRequireGlobalAdminWithStatus).toHaveBeenCalled();
  });

  it("x-test-admin funciona somente com PLAYWRIGHT_MOCK=true fora de produção, sem chamar a checagem real", async () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "test";

    const req = makeRequest({ "x-test-admin": "true" });
    const res = await PATCH(req, { params: { id: "user-1" } });

    expect(res.status).toBe(200);
    expect(mockedRequireGlobalAdminWithStatus).not.toHaveBeenCalled();
  });

  it("não loga Authorization nem Cookie crus no console em nenhum dos fluxos acima", async () => {
    mockedRequireGlobalAdminWithStatus.mockResolvedValue({
      admin: { id: "admin-1", email: "admin@testingcompany.local", token: "segredo-nao-pode-vazar" } as any,
      status: 200,
    });

    const req = makeRequest({
      authorization: "Bearer segredo-authorization-nao-pode-vazar",
      cookie: "session_id=segredo-cookie-nao-pode-vazar",
    });
    await PATCH(req, { params: { id: "user-1" } });

    const allLoggedText = [...consoleErrorSpy.mock.calls, ...consoleLogSpy.mock.calls]
      .flat()
      .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      .join(" ");

    expect(allLoggedText).not.toContain("segredo-authorization-nao-pode-vazar");
    expect(allLoggedText).not.toContain("segredo-cookie-nao-pode-vazar");
    expect(allLoggedText).not.toContain("segredo-nao-pode-vazar");
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
