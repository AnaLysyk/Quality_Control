const cookieStoreMock = { get: jest.fn() };
jest.mock("next/headers", () => ({ cookies: jest.fn(async () => cookieStoreMock) }));

import { getMockRole } from "@/lib/rbac/defects";

describe("getMockRole - gate do cookie mock_role", () => {
  const originalPlaywrightMock = process.env.PLAYWRIGHT_MOCK;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PLAYWRIGHT_MOCK;
    (process.env as any).NODE_ENV = "test";
    cookieStoreMock.get.mockReturnValue({ value: "leader_tc" });
  });

  afterAll(() => {
    if (originalPlaywrightMock === undefined) {
      delete process.env.PLAYWRIGHT_MOCK;
    } else {
      process.env.PLAYWRIGHT_MOCK = originalPlaywrightMock;
    }
    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  it("ignora o cookie mock_role quando PLAYWRIGHT_MOCK não está habilitado", async () => {
    const role = await getMockRole();
    expect(role).toBeNull();
    expect(cookieStoreMock.get).not.toHaveBeenCalled();
  });

  it("ignora o cookie mock_role em produção mesmo com PLAYWRIGHT_MOCK=true", async () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "production";
    const role = await getMockRole();
    expect(role).toBeNull();
  });

  it("usa o cookie mock_role somente com PLAYWRIGHT_MOCK=true e fora de produção", async () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "test";
    const role = await getMockRole();
    expect(role).toBe("leader_tc");
  });

  it("cookie mock_role malformado (valor fora do enum) retorna null sem lançar exceção", async () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "test";
    cookieStoreMock.get.mockReturnValue({ value: "role-invalido-<script>" });
    const role = await getMockRole();
    expect(role).toBeNull();
  });
});
