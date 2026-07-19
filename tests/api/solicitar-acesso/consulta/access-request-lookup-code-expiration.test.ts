const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
}

describe("codigo de consulta da solicitacao de acesso", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers({ now: new Date("2026-06-23T12:00:00.000Z") });
    delete process.env.ACCESS_REQUEST_LOOKUP_CODE_TTL_MINUTES;
    delete process.env.ACCESS_REQUEST_ACCESS_KEY_TTL_MINUTES;
  });

  afterEach(() => {
    jest.useRealTimers();
    restoreEnv();
  });

  it("usa 15 minutos como tempo padrao de expiracao", async () => {
    const { createAccessRequestLookupCodeExpiresAt } = await import(
      "../../../../backend/access-requests/accessKeyExpiration"
    );

    const expiresAt = createAccessRequestLookupCodeExpiresAt();

    expect(expiresAt).toBe("2026-06-23T12:15:00.000Z");
  });

  it("permite alterar o tempo de expiracao por variavel de ambiente", async () => {
    process.env.ACCESS_REQUEST_LOOKUP_CODE_TTL_MINUTES = "1";

    const { createAccessRequestLookupCodeExpiresAt } = await import(
      "../../../../backend/access-requests/accessKeyExpiration"
    );

    const expiresAt = createAccessRequestLookupCodeExpiresAt();

    expect(expiresAt).toBe("2026-06-23T12:01:00.000Z");
  });

  it("identifica codigo expirado pelo horario configurado", async () => {
    const { isAccessRequestLookupCodeExpired } = await import(
      "../../../../backend/access-requests/accessKeyExpiration"
    );

    const expiresAt = "2026-06-23T12:01:00.000Z";

    expect(isAccessRequestLookupCodeExpired(expiresAt)).toBe(false);

    jest.setSystemTime(new Date("2026-06-23T12:01:01.000Z"));

    expect(isAccessRequestLookupCodeExpired(expiresAt)).toBe(true);
  });
});
