describe("local auth store CRUD", () => {
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
    jest.doMock("@/database/persistenceMode", () => ({ shouldUsePostgresPersistence: () => false }));
    jest.doMock("@/database/databaseUrl", () => ({ resolveDatabaseUrlFromEnv: () => null }));
    jest.doMock("@/backend/redis", () => ({ isRedisConfigured: () => false, getRedis: jest.fn() }));
    jest.doMock("fs/promises", () => ({
      readFile: jest.fn().mockRejectedValue(new Error("missing")),
      writeFile: jest.fn(),
      mkdir: jest.fn(),
      access: jest.fn().mockRejectedValue(new Error("missing")),
    }));
    jest.doMock("crypto", () => {
      const actual = jest.requireActual<typeof import("crypto")>("crypto");
      return {
        ...actual,
        randomUUID: jest.fn(() => "12345678-abcd-efgh-ijkl-123456789012"),
      };
    });

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

  it("cria, encontra, atualiza e lista usuário", async () => {
    const store = await loadStore();
    const created = await store.createLocalUser({
      name: " Ana Paula ",
      email: " ANA@EXAMPLE.COM ",
      password_hash: "hash",
      role: "viewer",
    });

    expect(created).toEqual(expect.objectContaining({
      id: "usr_12345678",
      name: "Ana Paula",
      email: "ana@example.com",
      user: "ana.paula",
      active: true,
    }));
    await expect(store.findLocalUserByEmailOrId("ANA@EXAMPLE.COM")).resolves.toEqual(expect.objectContaining({ id: created.id }));
    await expect(store.getLocalUserById(created.id)).resolves.toEqual(expect.objectContaining({ email: "ana@example.com" }));

    const updated = await store.updateLocalUser(created.id, {
      full_name: "Ana P. Lysyk",
      user: "ana.lysik",
      status: "blocked",
      active: false,
      phone: "51999999999",
      password_hash: "new-hash",
    });
    expect(updated).toEqual(expect.objectContaining({
      full_name: "Ana P. Lysyk",
      user: "ana.lysik",
      status: "blocked",
      active: false,
      password_hash: "new-hash",
    }));
    await expect(store.listLocalUsers()).resolves.toHaveLength(1);
    await expect(store.updateLocalUser("missing", { name: "X" })).resolves.toBeNull();
  });

  it("bloqueia e-mail e login duplicados", async () => {
    const store = await loadStore();
    await store.createLocalUser({ name: "Ana", email: "ana@example.com", user: "ana", password_hash: "hash" });

    await expect(store.createLocalUser({ name: "Outra", email: "ANA@example.com", user: "outra", password_hash: "hash" }))
      .rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });
    await expect(store.createLocalUser({ name: "Outra", email: "outra@example.com", user: "ANA", password_hash: "hash" }))
      .rejects.toMatchObject({ code: "DUPLICATE_USER" });
  });

  it("cria, localiza, atualiza e remove empresa com seus vínculos", async () => {
    const store = await loadStore();
    const user = await store.createLocalUser({ name: "Ana", email: "ana@example.com", password_hash: "hash" });
    const company = await store.createLocalCompany({
      name: " Empresa Ágil ",
      tax_id: "12.345.678/0001-90",
    });

    expect(company).toEqual(expect.objectContaining({
      id: "cmp_12345678",
      name: "Empresa Ágil",
      slug: "empresa-agil",
      status: "active",
    }));
    await expect(store.findLocalCompanyById(company.id)).resolves.toEqual(expect.objectContaining({ slug: "empresa-agil" }));
    await expect(store.findLocalCompanyBySlug("EMPRESA ÁGIL")).resolves.toEqual(expect.objectContaining({ id: company.id }));

    const updated = await store.updateLocalCompany(company.id, { name: "Empresa Nova", slug: "Empresa Nova!" });
    expect(updated).toEqual(expect.objectContaining({ name: "Empresa Nova", company_name: "Empresa Nova", slug: "empresa-nova" }));

    await store.upsertLocalLink({ userId: user.id, companyId: company.id, role: "company_admin", capabilities: ["tickets.read"] });
    await expect(store.listLocalLinksForUser(user.id)).resolves.toHaveLength(1);
    await expect(store.listLocalLinksForCompany(company.id)).resolves.toHaveLength(1);
    await expect(store.resolveUserCompanies(user.id)).resolves.toEqual([
      expect.objectContaining({ company: expect.objectContaining({ id: company.id }) }),
    ]);

    await expect(store.deleteLocalCompany(company.id)).resolves.toBe(true);
    await expect(store.listLocalCompanies()).resolves.toEqual([]);
    await expect(store.listLocalMemberships()).resolves.toEqual([]);
    await expect(store.deleteLocalCompany("missing")).resolves.toBe(false);
  });

  it("valida duplicidade de nome e CNPJ de empresa", async () => {
    const store = await loadStore();
    await store.createLocalCompany({ name: "Empresa A", tax_id: "12345678000190" });

    await expect(store.createLocalCompany({ name: " empresa   a ", tax_id: "99999999000199" }))
      .rejects.toMatchObject({ code: "DUPLICATE_COMPANY_NAME" });
    await expect(store.createLocalCompany({ name: "Empresa B", tax_id: "12.345.678/0001-90" }))
      .rejects.toMatchObject({ code: "DUPLICATE_COMPANY_TAX_ID" });
  });

  it("atualiza e remove vínculo existente", async () => {
    const store = await loadStore();
    const user = await store.createLocalUser({ name: "Ana", email: "ana@example.com", password_hash: "hash" });
    const company = await store.createLocalCompany({ name: "Empresa" });

    await expect(store.upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer" }))
      .resolves.toBe("usuario_tc");
    await expect(store.upsertLocalLink({
      userId: user.id,
      companyId: company.id,
      role: "support",
      capabilities: ["admin.read"],
      allowedProjectIds: ["p1"],
    })).resolves.toBe("suporte_tecnico");

    const links = await store.listLocalLinks();
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual(expect.objectContaining({
      role: "suporte_tecnico",
      capabilities: ["admin.read"],
      allowedProjectIds: ["p1"],
    }));
    await expect(store.removeLocalLink(user.id, company.id)).resolves.toBe(true);
    await expect(store.removeLocalLink(user.id, company.id)).resolves.toBe(false);
  });

  it("normaliza papéis legados e globais", async () => {
    const store = await loadStore();
    expect(store.normalizeLocalRole("company_admin")).toBe("empresa");
    expect(store.normalizeLocalRole("developer")).toBe("suporte_tecnico");
    expect(store.normalizeLocalRole("tc_leader")).toBe("lider_tc");
    expect(store.normalizeGlobalRole("GLOBAL_ADMIN")).toBe("global_admin");
    expect(store.normalizeGlobalRole("user")).toBeNull();
    expect(store.toLegacyRole("viewer", false)).toBe("usuario_tc");
    expect(store.toLegacyRole("viewer", true)).toBe("lider_tc");
  });
});
