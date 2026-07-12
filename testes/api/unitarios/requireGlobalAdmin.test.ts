jest.mock("next/headers", () => ({ cookies: jest.fn(async () => ({ get: () => undefined })) }));
jest.mock("@/lib/redis", () => ({ getRedis: jest.fn() }));
jest.mock("@/lib/auth/jwtSecret", () => ({ getJwtSecret: jest.fn(() => null) }));
jest.mock("@/lib/auth/session", () => ({ getAccessContext: jest.fn() }));

import { requireGlobalAdmin } from "@/lib/rbac/requireGlobalAdmin";

function makeRequest(headers: Record<string, string> = {}) {
  return new Request("https://app.local/api/user/123", { method: "PATCH", headers });
}

describe("requireGlobalAdmin - gate do x-test-admin", () => {
  const originalPlaywrightMock = process.env.PLAYWRIGHT_MOCK;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    delete process.env.PLAYWRIGHT_MOCK;
    (process.env as any).NODE_ENV = "test";
  });

  afterAll(() => {
    if (originalPlaywrightMock === undefined) {
      delete process.env.PLAYWRIGHT_MOCK;
    } else {
      process.env.PLAYWRIGHT_MOCK = originalPlaywrightMock;
    }
    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  it("ignora x-test-admin quando PLAYWRIGHT_MOCK não está habilitado (sem sessão real -> null)", async () => {
    const req = makeRequest({ "x-test-admin": "true" });
    const result = await requireGlobalAdmin(req);
    expect(result).toBeNull();
  });

  it("ignora x-test-admin em produção mesmo com PLAYWRIGHT_MOCK=true (fail-closed)", async () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "production";
    const req = makeRequest({ "x-test-admin": "true" });
    const result = await requireGlobalAdmin(req);
    expect(result).toBeNull();
  });

  it("aceita x-test-admin somente com PLAYWRIGHT_MOCK=true e fora de produção", async () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "test";
    const req = makeRequest({ "x-test-admin": "true" });
    const result = await requireGlobalAdmin(req);
    expect(result?.id).toBe("test-admin");
    expect(result?.isGlobalAdmin).toBe(true);
  });

  it("x-test-role malformado/vazio não quebra e não concede global admin indevido", async () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "test";
    const req = makeRequest({ "x-test-admin": "true", "x-test-role": "" });
    const result = await requireGlobalAdmin(req);
    // header vazio -> cai no default "admin" do próprio código, então continua sendo admin;
    // o importante é não lançar exceção com header malformado.
    expect(result).not.toBeNull();
  });
});
