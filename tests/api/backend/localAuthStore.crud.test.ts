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
   