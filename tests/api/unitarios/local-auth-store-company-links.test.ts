describe("local auth company and link flows", () => {
  async function loadStore() {
    jest.resetModules();
    process.env.E2E_USE_JSON = "1";
    process.env.LOCAL_AUTH_IN_MEMORY = "true";
    const mod = await import("../../../backend/auth/localStore");
    await mod.writeLocalAuthStore({ users: [], companies: [], memberships: [], links: [] });
    return mod;
  }

  it("creates, updates and deletes companies with linked memberships", async () => {
    const mod = await loadStore();
    const company = await mod.createLocalCompany({ name: " Empresa Ágil ", tax_id: "12.345.678/0001-99" });
    expect(company).toMatchObject({ name: "Empresa Ágil", slug: "empresa-agil", active: true, status: "active" });

    const updated = await mod.updateLocalCompany(company.id, { name: "Empresa Nova", slug: " Nova Empresa " });
    expect(updated).toMatchObject({ name: "Empresa Nova", company_name: "Empresa Nova", slug: "nova-empresa" });
    await expect(mod.updateLocalCompany("missing", { name: "X" })).resolves.toBeNull();

    const user = await mod.createLocalUser({ name: "Pessoa", email: "pessoa@teste.local", password_hash: "hash" });
    await mod.upsertLocalLink({ userId: user.id, companyId: company.id, role: "company_admin", capabilities: ["users.read"] });
    expect(await mod.listLocalLinksForCompany(company.id)).toEqual([
      expect.objectContaining({ userId: user.id, companyId: company.id, role: "empresa" }),
    ]);

    await expect(mod.deleteLocalCompany(company.id)).resolves.toBe(true);
    await expect(mod.deleteLocalCompany(company.id)).resolves.toBe(false);
    await expect(mod.listLocalLinksForCompany(company.id)).resolves.toEqual([]);
  });

  it("rejects duplicate company name and tax id", async () => {
    const mod = await loadStore();
    await mod.createLocalCompany({ name: "Empresa Única", tax_id: "11.222.333/0001-44" });

    await expect(mod.createLocalCompany({ name: " empresa   única " })).rejects.toMatchObject({ code: "DUPLICATE_COMPANY_NAME" });
    await expect(mod.createLocalCompany({ name: "Outra", tax_id: "11222333000144" })).rejects.toMatchObject({ code: "DUPLICATE_COMPANY_TAX_ID" });
  });

  it("upserts and removes links and resolves companies", async () => {
    const mod = await loadStore();
    const company = await mod.createLocalCompany({ name: "Cliente" });
    const user = await mod.createLocalUser({ name: "Usuário", email: "user@teste.local", password_hash: "hash" });

    await mod.upsertLocalLink({ userId: user.id, companyId: company.id, role: "viewer", allowedProjectIds: ["p1"] });
    await mod.upsertLocalLink({ userId: user.id, companyId: company.id, role: "support", capabilities: ["tickets.read"], allowedProjectIds: [] });

    expect(await mod.resolveUserCompanies(user.id)).toEqual([
      expect.objectContaining({ company: expect.objectContaining({ id: company.id }) }),
    ]);
    await expect(mod.removeLocalLink(user.id, company.id)).resolves.toBe(true);
    await expect(mod.removeLocalLink(user.id, company.id)).resolves.toBe(false);
  });

  it("normalizes local and legacy roles", async () => {
    const mod = await loadStore();
    expect(mod.normalizeLocalRole("company_admin")).toBe("empresa");
    expect(mod.normalizeLocalRole("support")).toBe("technical_support");
    expect(mod.normalizeGlobalRole("GLOBAL_ADMIN")).toBe("global_admin");
    expect(mod.normalizeGlobalRole("user")).toBeNull();
    expect(mod.toLegacyRole("viewer", true)).toBe("leader_tc");
    expect(mod.toLegacyRole("viewer", false)).toBe("testing_company_user");
  });
});
