describe("local auth store user lifecycle", () => {
  async function loadStore() {
    jest.resetModules();
    process.env.E2E_USE_JSON = "1";
    process.env.LOCAL_AUTH_IN_MEMORY = "true";
    const mod = await import("../../../backend/auth/localStore");
    await mod.writeLocalAuthStore({ users: [], companies: [], memberships: [], links: [] });
    return mod;
  }

  it("creates, normalizes and updates a user", async () => {
    const mod = await loadStore();
    const created = await mod.createLocalUser({
      name: "  Ana QA  ",
      full_name: " Ana Paula QA ",
      email: " ANA.QA@EXAMPLE.COM ",
      password_hash: "hash-1",
      user_origin: "client_company",
      user_scope: "company_only",
      allow_multi_company_link: true,
    });

    expect(created).toMatchObject({
      name: "Ana QA",
      full_name: "Ana Paula QA",
      email: "ana.qa@example.com",
      user: "ana.paula.qa",
      active: true,
      status: "active",
      user_origin: "client_company",
      user_scope: "company_only",
      allow_multi_company_link: true,
    });

    const updated = await mod.updateLocalUser(created.id, {
      name: "Ana Atualizada",
      full_name: "  Ana Atualizada QA  ",
      email: " NOVA@EXAMPLE.COM ",
      user: " Ana.Nova ",
      status: "blocked",
      active: false,
      phone: "51999999999",
      password_hash: "hash-2",
    });

    expect(updated).toMatchObject({
      name: "Ana Atualizada",
      full_name: "Ana Atualizada QA",
      email: "nova@example.com",
      user: "ana.nova",
      status: "blocked",
      active: false,
      phone: "51999999999",
      password_hash: "hash-2",
    });
    await expect(mod.updateLocalUser("missing", { name: "X" })).resolves.toBeNull();
  });

  it("rejects duplicate email and creates suffixed login", async () => {
    const mod = await loadStore();
    await mod.createLocalUser({ name: "Joao Silva", email: "joao1@example.com", password_hash: "h" });
    const second = await mod.createLocalUser({ name: "Joao Silva", email: "joao2@example.com", password_hash: "h" });
    expect(second.user).toBe("joao.silva.2");

    await expect(
      mod.createLocalUser({ name: "Outro", email: " JOAO1@EXAMPLE.COM ", password_hash: "h" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });
  });
});
