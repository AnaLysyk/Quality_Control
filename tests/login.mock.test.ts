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

process.env.SUPABASE_MOCK = "true";
import { POST } from "../app/api/auth/login/route";
import { GET } from "../app/api/me/route";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const getRedisMock = getRedis as unknown as jest.Mock;
const findUniqueMock = prisma.user.findUnique as jest.Mock;

describe("Login mock flow", () => {
  const loginUrl = "http://localhost/api/auth/login";

  beforeEach(() => {
    getRedisMock.mockReset();
    findUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "admin@test.com",
      password_hash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
      name: "Admin Test",
      active: true,
      created_at: new Date(),
      userCompanies: [
        {
          user_id: "user-1",
          company_id: "company-1",
          role: "admin",
          company: {
            id: "company-1",
            name: "Testing Company",
            slug: "testing-company",
          },
        },
      ],
    });
    const mockRedis = {
      set: jest.fn().mockResolvedValue("OK"),
      get: jest.fn().mockResolvedValue(JSON.stringify({
        userId: "user-1",
        email: "admin@test.com",
        name: "Admin Test",
        companyId: "company-1",
        companySlug: "testing-company",
        role: "admin",
      })),
      expire: jest.fn().mockResolvedValue(1),
    };
    getRedisMock.mockReturnValue(mockRedis);
  });

  it("retorna 400 se faltar email ou senha", async () => {
    const req = new Request(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@test.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Email e senha obrigatórios/i);
  });

  it("loga com credenciais mock e define session_id cookie", async () => {
    const req = new Request(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@test.com",
        password: "123456",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/session_id=/);
  });

  it("GET retorna user quando session_id presente", async () => {
    const req = new Request("http://localhost/api/me", {
      method: "GET",
      headers: { cookie: "session_id=test-session" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("admin@test.com");
  });

  it("GET 401 quando session_id ausente", async () => {
    const req = new Request("http://localhost/api/me", { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
