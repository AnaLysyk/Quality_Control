import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("userPermissionsStore JSON fallback", () => {
  const originalE2eUseJson = process.env.E2E_USE_JSON;
  const originalLocalAuthDataDir = process.env.LOCAL_AUTH_DATA_DIR;
  let tempDir: string;

  function restoreEnv(name: "E2E_USE_JSON" | "LOCAL_AUTH_DATA_DIR", value: string | undefined) {
    if (value === undefined) {
      delete process.env[name];
      return;
    }
    process.env[name] = value;
  }

  beforeEach(async () => {
    jest.resetModules();
    tempDir = await mkdtemp(path.join(tmpdir(), "qc-user-permissions-"));
    process.env.E2E_USE_JSON = "1";
    process.env.LOCAL_AUTH_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    restoreEnv("E2E_USE_JSON", originalE2eUseJson);
    restoreEnv("LOCAL_AUTH_DATA_DIR", originalLocalAuthDataDir);
    await rm(tempDir, { recursive: true, force: true });
  });

  it("persiste allow/deny locais para o resolver oficial ler depois", async () => {
    const store = await import("@/backend/store/userPermissionsStore");

    await store.setUserPermissionOverride("user-json-1", {
      allow: { users: ["view", "edit"] },
      deny: { permissions: ["reset"] },
      updatedBy: "admin@example.com",
    });

    await expect(store.getUserPermissionOverride("user-json-1")).resolves.toMatchObject({
      userId: "user-json-1",
      allow: { users: ["view", "edit"] },
      deny: { permissions: ["reset"] },
      updatedBy: "admin@example.com",
    });

    await store.deleteUserPermissionOverride("user-json-1");

    await expect(store.getUserPermissionOverride("user-json-1")).resolves.toBeNull();
  });
});
