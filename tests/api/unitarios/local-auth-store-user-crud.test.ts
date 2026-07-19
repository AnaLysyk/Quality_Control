describe("local auth user CRUD flows", () => {
  async function loadStore() {
    jest.resetModules();
    process.env.E2E_USE_JSON = "1";
    process.env.LOCAL_AUTH_IN_MEMORY = "true";
    const mod = await import("../../../backend/auth/localStore");
    await mod.writeLocalAuthStore({ users: [], companies: [], memberships: [], links: [] });
    return mod;
  }

  it("creates and updates a normalized user", async () => {
    const mod = await loadStore();
    const created = await mod.createLocalUser({
      name: "  Ana Paula  ",
      full_name: " Ana Paula Lysyk ",
      email: " ANA@EXAMPLE.COM ",
      password_hash: "hash",
      user_scope: "company_only",
      user_origin: "client_company",
      allow_multi_company_link: true,
    });

    expect(created).toMatchObject({
      name: "Ana Paula",
      full_name: "Ana Paula Lysyk",
      email: "ana@example.com",
      user: "ana.paula.lysyk",
      user_scope: "company_only",
      user_origin: "client_company",
      allow_multi_company_link: true,
      status: "active",
      active: true,
    });

    const updated = await mod.updateLocalUser(created.id, {
      full_name: "Ana Atualizada",
      email: "NOVA@EXAMPLE.COM",
      user: "ana.nova",
      status: "blocked",
      active: false,
      phone: "51999999999",
      password_hash: "new-hash",
    });

    expect(updated).toMatchObject({
      full_name: "Ana Atualizada",
      email: "nova@example.com",
      user: "ana.nova",
      status: "blocked",
      active: false,
      phone: "51999999999",
      password_hash: "new-hash",
    });
  });

  it("rejects duplicate email and returns null for missing user", async () => {
    const mod = await loadStore();
    const first = await mod.createLocalUser({ name: "Primeiro", email: "dup@example.com", password_hash: "hash" });
    await mod.createLocalUser({ name: "Segundo", email: "other@example.com", password_hash: "hash" });

    await expect(
      mod.createLocalUser({ name: "Duplicado", email: " DUP@EXAMPLE.COM ", password_hash: "hash" }),
    ).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });

    await expect(mod.updateLocalUser(first.id, { email: "other@example.com" })).rejects.toMatchObject({ code: "DUPLICATE_EMAIL" });
    await expect(mod.updateLocalUser("missing", { name: "Nada" })).resolves.toBeNull();
  });
});
