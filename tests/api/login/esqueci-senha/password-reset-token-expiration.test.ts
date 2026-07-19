import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const originalEnv = { ...process.env };

let tempDir = "";

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
}

describe("codigo de redefinicao enviado por e-mail", () => {
  beforeEach(async () => {
    jest.resetModules();
    jest.useFakeTimers({ now: new Date("2026-06-23T12:00:00.000Z") });

    tempDir = await mkdtemp(join(tmpdir(), "qc-reset-token-"));
    delete process.env.DATABASE_URL;
    delete process.env.PRISMA_DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    process.env.AUTH_STORE = "json";
    process.env.LOCAL_AUTH_DATA_DIR = tempDir;
  });

  afterEach(async () => {
    jest.useRealTimers();
    restoreEnv();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("expira apos 15 minutos", async () => {
    const {
      consumePasswordResetToken,
      hasPasswordResetToken,
      storePasswordResetToken,
    } = await import("../../../../backend/auth/passwordResetToken");

    const token = "codigo-email-expiravel";

    await storePasswordResetToken(token, "usr_reset_email");

    await expect(hasPasswordResetToken(token)).resolves.toBe(true);

    jest.setSystemTime(new Date("2026-06-23T12:15:01.000Z"));

    await expect(hasPasswordResetToken(token)).resolves.toBe(false);
    await expect(consumePasswordResetToken(token)).resolves.toBeNull();
  });
});

