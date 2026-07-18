import { isE2eMockAllowed } from "@/backend/auth/e2eMockGate";

describe("isE2eMockAllowed - gate único do mock E2E", () => {
  const originalPlaywrightMock = process.env.PLAYWRIGHT_MOCK;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalPlaywrightMock === undefined) {
      delete process.env.PLAYWRIGHT_MOCK;
    } else {
      process.env.PLAYWRIGHT_MOCK = originalPlaywrightMock;
    }
    (process.env as any).NODE_ENV = originalNodeEnv;
  });

  it("bloqueia quando PLAYWRIGHT_MOCK está ausente (flag E2E não habilitada)", () => {
    delete process.env.PLAYWRIGHT_MOCK;
    (process.env as any).NODE_ENV = "test";
    expect(isE2eMockAllowed()).toBe(false);
  });

  it("bloqueia quando PLAYWRIGHT_MOCK tem valor diferente de 'true'", () => {
    process.env.PLAYWRIGHT_MOCK = "1";
    (process.env as any).NODE_ENV = "test";
    expect(isE2eMockAllowed()).toBe(false);
  });

  it("bloqueia em produção mesmo com PLAYWRIGHT_MOCK=true (fail-closed)", () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "production";
    expect(isE2eMockAllowed()).toBe(false);
  });

  it("libera somente com PLAYWRIGHT_MOCK=true e fora de produção", () => {
    process.env.PLAYWRIGHT_MOCK = "true";
    (process.env as any).NODE_ENV = "test";
    expect(isE2eMockAllowed()).toBe(true);
  });
});
