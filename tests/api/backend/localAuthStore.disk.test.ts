import { join } from "node:path";

describe("local auth store disk mode", () => {
  const ORIGINAL_ENV = process.env;

  async function loadStore(options: {
    readFile: jest.Mock;
    writeFile?: jest.Mock;
    mkdir?: jest.Mock;
  }) {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
      AUTH_STORE: "json",
      E2E_USE_JSON: "1",
      LOCAL_AUTH_IN_MEMORY: "false",
      LOCAL_AUTH_ENABLE_DEMO_USERS: "false",
      LOCAL_AUTH_DATA_DIR: "/tmp/qc-auth-tests",
    };

    jest.doMock("server-only", () => ({}));
    jest.doMock("@/database/persistenceMode", () => ({
      shouldUsePostgresPersistence: jest.fn(() => false),
    }));
    jest.doMock("@/database/databaseUrl", () => ({
      resolveDatabaseUrlFromEnv: jest.fn(() => null),
    }));
    jest.doMock("@/backend/redis", () => ({
      isRedisConfigured: jest.fn(() => false),
      getRedis: jest.fn(),
    }));
    jest.doMock("fs/promises", () => ({
      readFile: options.readFile,
      writeFile: options.writeFile ?? jest.fn(),
      mkdir: options.mkdir ?? jest.fn(),
      access: jest.fn().mockResolvedValue(undefined),
    }));

    const globalStore = globalThis as typeof globalThis & {
      __qcLocalAuthStore?: unknown;
      __qcLocalAuthStoreInit?: boolean;
    };
    delete globalStore.__qcLocalAuthStore;
    delete globalStore.__qcLocalAuthStoreInit;

    return import("@/backend/auth/localStore");
  }

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("normaliza arrays ausentes e converte links em memberships", async () => {
    const readFile = jest.fn().mockResolvedValue(JSON.stringify({
      users: [{ id: "u1", name: "Ana", email: "ana@example.com", password_hash: "hash" }],
      companies: [{ id: "c1", name: "Empresa", slug: "empresa" }],
      links: [{
        user_id: "u1",
        company_id: "c1",
        role: "company_admin",
        permissions: ["tickets.read"],
      }],
    }));
    const storeModule = await loadStore({ readFile });

    const result = await storeModule.readLocalAuthStore();

    expect(result.memberships).toEqual([
      expect.objectContaining({
        id: "u1-c1",
        userId: "u1",
        companyId: "c1",
        role: "empresa",
        capabilities: ["tickets.read"],
      }),
    ]);
  });

  it("preserva membership existente sem duplicar o vínculo", async () => {
    const readFile = jest.fn().mockResolvedValue(JSON.stringify({
      users: [],
      companies: [],
      memberships: [{
        id: "m1",
        userId: "u1",
        companyId: "c1",
        role: "support",
      }],
      links: [{ user_id: "u1", company_id: "c1", role: "viewer" }],
    }));
    const storeModule = await loadStore({ readFile });

    const result = await storeModule.readLocalAuthStore();

    expect(result.memberships).toHaveLength(1);
    expect(result.memberships?.[0]).toEqual(expect.objectContaining({
      id: "m1",
      role: "technical_support",
    }));
  });

  it("grava JSON formatado no diretório configurado", async () => {
    const mkdir = jest.fn();
    const writeFile = jest.fn();
    const storeModule = await loadStore({
      readFile: jest.fn().mockRejectedValue(new Error("missing")),
      mkdir,
      writeFile,
    });

    await storeModule.writeLocalAuthStore({
      users: [],
      companies: [],
      links: [],
    });

    expect(mkdir).toHaveBeenCalledWith("/tmp/qc-auth-tests", { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      join("/tmp/qc-auth-tests", "local-auth-store.json"),
      expect.stringContaining('"memberships": []'),
      "utf8",
    );
  });

  it("registra e absorve a falha de gravação em disco", async () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const storeModule = await loadStore({
      readFile: jest.fn().mockRejectedValue(new Error("missing")),
      mkdir: jest.fn().mockRejectedValue(new Error("readonly")),
    });

    await expect(storeModule.writeLocalAuthStore({
      users: [{ id: "u1", name: "Ana", email: "ana@example.com", password_hash: "hash" }],
      companies: [],
      memberships: [],
      links: [],
    })).resolves.toBeUndefined();

    expect(warning).toHaveBeenCalledWith(expect.stringContaining("Falha ao persistir em disco"));
    warning.mockRestore();
  });
});
