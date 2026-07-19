describe("local auth store in memory mode", () => {
  const ORIGINAL_ENV = process.env;

  async function loadStore() {
    jest.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
      AUTH_STORE: "json",
      E2E_USE_JSON: "1",
      LOCAL_AUTH_IN_MEMORY: "true",
      LOCAL_AUTH_ENABLE_DEMO_USERS: "false",
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
      readFile: jest.fn().mockRejectedValue(new Error("missing")),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn().mockRejectedValue(new Error("missing")),
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

  it("inicia vazio quando demo users estão desabilitados", async () => {
    const storeModule = await loadStore();

    await expect(storeModule.readLocalAuthStore()).resolves.toEqual({
      users: [],
      companies: [],
      memberships: [],
      links: [],
    });
  });

  it("persiste e devolve clone independente no modo memória", async () => {
    const storeModule = await loadStore();
    const payload = {
      users: [{
        id: "u1",
        name: "Ana",
        email: "ana@example.com",
        user: "ana",
        password_hash: "hash",
      }],
      companies: [{ id: "c1", name: "Empresa", slug: "empresa" }],
      memberships: [],
      links: [],
    };

    await storeModule.writeLocalAuthStore(payload);
    const first = await storeModule.readLocalAuthStore();
    first.users[0].name = "Alterado";
    const second = await storeModule.readLocalAuthStore();

    expect(second.users[0].name).toBe("Ana");
    expect(second.companies[0].slug).toBe("empresa");
  });

  it("normaliza acentos e incrementa logins ocupados ou evitados", async () => {
    const storeModule = await loadStore();
    await storeModule.writeLocalAuthStore({
      users: [
        { id: "u1", name: "Ana", email: "ana@example.com", user: "ana.paula", password_hash: "hash" },
        { id: "u2", name: "Ana 2", email: "ana2@example.com", user: "ana.paula.2", password_hash: "hash" },
      ],
      companies: [],
      memberships: [],
      links: [],
    });

    await expect(storeModule.suggestNextUniqueLogin({
      seed: "Ána   Paula",
      avoid: ["ana.paula.3"],
    })).resolves.toBe("ana.paula.4");
  });

  it("ignora o próprio usuário ao sugerir login em edição", async () => {
    const storeModule = await loadStore();
    await storeModule.writeLocalAuthStore({
      users: [
        { id: "u1", name: "Ana", email: "ana@example.com", user: "ana.paula", password_hash: "hash" },
      ],
      companies: [],
      memberships: [],
      links: [],
    });

    await expect(storeModule.suggestNextUniqueLogin({
      seed: "Ana Paula",
      excludeUserId: "u1",
    })).resolves.toBe("ana.paula");
  });
});
