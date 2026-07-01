describe("local auth user uniqueness", () => {
  const uid = Math.random().toString(36).slice(2, 10);
  const password_hash = "hash-for-uniqueness-test";

  async function loadStore() {
    jest.resetModules();
    process.env.E2E_USE_JSON = "1";
    process.env.LOCAL_AUTH_IN_MEMORY = "true";
    return import("../../../lib/core/auth/localStore");
  }

  it("rejects creating two users with the same usuario", async () => {
    const { createLocalUser } = await loadStore();
    const login = `unit.dup.${uid}`;

    await createLocalUser({
      name: "Unit Dup A",
      email: `unit-dup-a-${uid}@local.test`,
      user: login,
      password_hash,
    });

    await expect(
      createLocalUser({
        name: "Unit Dup B",
        email: `unit-dup-b-${uid}@local.test`,
        user: login.toUpperCase(),
        password_hash,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_USER" });
  });

  it("rejects usuario equal to another user's email", async () => {
    const { createLocalUser } = await loadStore();
    const existingEmail = `unit-email-token-${uid}@local.test`;

    await createLocalUser({
      name: "Unit Email Token A",
      email: existingEmail,
      password_hash,
    });

    await expect(
      createLocalUser({
        name: "Unit Email Token B",
        email: `unit-email-token-b-${uid}@local.test`,
        user: existingEmail,
        password_hash,
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_USER" });
  });

  it("rejects updating usuario to another user's usuario", async () => {
    const { createLocalUser, updateLocalUser } = await loadStore();
    const login = `unit.update.dup.${uid}`;
    const userA = await createLocalUser({
      name: "Unit Update Dup A",
      email: `unit-update-dup-a-${uid}@local.test`,
      user: login,
      password_hash,
    });
    const userB = await createLocalUser({
      name: "Unit Update Dup B",
      email: `unit-update-dup-b-${uid}@local.test`,
      password_hash,
    });

    await expect(
      updateLocalUser(userB.id, { user: (userA.user ?? login).toUpperCase() }),
    ).rejects.toMatchObject({ code: "DUPLICATE_USER" });
  });
});
