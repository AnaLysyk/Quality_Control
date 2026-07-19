describe("local auth store read and lookup flows", () => {
  async function loadStore() {
    jest.resetModules();
    process.env.E2E_USE_JSON = "1";
    process.env.LOCAL_AUTH_IN_MEMORY = "true";
    const mod = await import("../../../backend/auth/localStore");
    await mod.writeLocalAuthStore({
      users: [
        {
          id: "usr-a",
          name: "Ana",
          full_name: "Ana Teste",
          email: "ANA@EXAMPLE.COM",
          user: "ana.teste",
          password_hash: "hash",
        },
      ],
      companies: [
        { id: "cmp-b", name: "Beta", slug: "Beta Cliente" },
        { id: "cmp-a", name: "Alpha", slug: "Álpha Cliente" },
      ],
      memberships: [
        { id: "m1", userId: "usr-a", companyId: "cmp-a", role: "company_admin" },
        { id: "m2", userId: "usr-a", companyId: "cmp-b", role: "viewer" },
      ],
      links: [],
    });
    return mod;
  }

  it("reads cloned data, sorts companies and filters memberships", async () => {
    const mod = await loadStore();

    const first = await mod.readLocalAuthStore();
    first.users[0].name = "Alterado fora";
    const second = await mod.readLocalAuthStore();

    expect(second.users[0].name).toBe("Ana");
    expect((await mod.listLocalCompanies()).map((company) => company.name)).toEqual(["Alpha", "Beta"]);
    expect(await mod.listLocalLinksForUser("usr-a")).toHaveLength(2);
    expect(await mod.listLocalLinksForCompany("cmp-a")).toEqual([
      expect.objectContaining({ userId: "usr-a", role: "company_admin" }),
    ]);
    expect(await mod.listLocalLinks()).toHaveLength(2);
  });

  it("finds users and companies by normalized identifiers", async () => {
    const mod = await loadStore();

    await expect(mod.findLocalUserByEmailOrId(" ANA.TESTE ")).resolves.toMatchObject({ id: "usr-a" });
    await expect(mod.findLocalUserByEmailOrId("ana@example.com")).resolves.toMatchObject({ id: "usr-a" });
    await expect(mod.findLocalUserByEmailOrId("usr-a")).resolves.toMatchObject({ email: "ANA@EXAMPLE.COM" });
    await expect(mod.findLocalUserByEmailOrId("missing")).resolves.toBeNull();
    await expect(mod.getLocalUserById("usr-a")).resolves.toMatchObject({ name: "Ana" });
    await expect(mod.getLocalUserById("missing")).resolves.toBeNull();
    await expect(mod.findLocalCompanyById("cmp-a")).resolves.toMatchObject({ name: "Alpha" });
    await expect(mod.findLocalCompanyBySlug(" alpha cliente ")).resolves.toMatchObject({ id: "cmp-a" });
    await expect(mod.findLocalCompanyBySlug("missing")).resolves.toBeNull();
  });

  it("suggests a unique normalized login while respecting avoid list", async () => {
    const mod = await loadStore();

    await expect(mod.suggestNextUniqueLogin({ seed: "Ána Teste" })).resolves.toBe("ana.teste.2");
    await expect(mod.suggestNextUniqueLogin({ seed: "Novo Usuário", avoid: ["novo.usuario"] })).resolves.toBe("novo.usuario.2");
    await expect(mod.suggestNextUniqueLogin({ seed: "Livre" })).resolves.toBe("livre");
  });
});
