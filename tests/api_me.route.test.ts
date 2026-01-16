import { GET } from "@/api/me/route";

jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
}));

import { getRedis } from "@/lib/redis";

const getRedisMock = getRedis as unknown as jest.Mock;

function requestWithAuth(url: string, sessionId = "test-session") {
  return new Request(url, { headers: { cookie: `session_id=${sessionId}` } });
}

describe("/api/me route", () => {
  beforeEach(() => {
    getRedisMock.mockReset();
  });

  it("retorna 401 se não autenticado", async () => {
    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      expire: jest.fn(),
    };
    getRedisMock.mockReturnValue(mockRedis);
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(401);
  });

  it("retorna usuário autenticado via session_id", async () => {
    const user = {
      userId: "usr1",
      email: "ana@example.com",
      name: "Ana",
      companyId: "comp1",
      companySlug: "test-company",
      role: "admin",
    };
    const mockRedis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(user)),
      expire: jest.fn().mockResolvedValue(1),
    };
    getRedisMock.mockReturnValue(mockRedis);

    const res = await GET(requestWithAuth("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toMatchObject(user);
    expect(mockRedis.expire).toHaveBeenCalledWith("session:test-session", 28800); // 8*3600
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/session_id=test-session/);
    expect(setCookie).toMatch(/Max-Age=28800/);
  });
});
