jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { GET } from "@/api/me/route";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const getRedisMock = getRedis as unknown as jest.Mock;
const findUniqueMock = prisma.user.findUnique as jest.Mock;

function requestWithAuth(url: string, sessionId = "test-session") {
  return new Request(url, { headers: { cookie: `session_id=${sessionId}` } });
}

describe("/api/me route", () => {
  beforeEach(() => {
    getRedisMock.mockReset();
    findUniqueMock.mockReset();
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
    const sessionUser = {
      userId: "usr1",
      email: "ana@example.com",
      name: "Ana",
      companyId: "comp1",
      companySlug: "test-company",
      role: "admin",
    };
    findUniqueMock.mockResolvedValue({
      id: "usr1",
      email: "ana@example.com",
      name: "Ana",
      userCompanies: [
        {
          role: "admin",
          company: {
            id: "comp1",
            slug: "test-company",
            name: "Test Company",
          },
        },
      ],
    });
    const mockRedis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(sessionUser)),
      expire: jest.fn().mockResolvedValue(1),
    };
    getRedisMock.mockReturnValue(mockRedis);

    const res = await GET(requestWithAuth("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toMatchObject({
      id: "usr1",
      email: "ana@example.com",
      name: "Ana",
      role: "admin",
      clientId: "comp1",
      clientSlug: "test-company",
    });
    expect(mockRedis.expire).toHaveBeenCalledWith("session:test-session", 28800); // 8*3600
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/session_id=test-session/);
    expect(setCookie).toMatch(/Max-Age=28800/);
  });
});
