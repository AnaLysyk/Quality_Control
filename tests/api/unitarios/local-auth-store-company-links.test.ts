describe("local auth company and link flows", () => {
  async function loadStore() {
    jest.resetModules();
    process.env.E2E_USE_JSON = "1";
    process.env.LOCAL_AUTH_IN_MEMORY = "true";
    const mod = await import("../../../backend/auth/localStore");
    await mod.writeLocalAuthStore({ users: [], companies: [], memberships: [], links: [] });
    return mod;
  }

  it("creates, updates and deletes companies", async () => {
    const mod = await loadStore();
   