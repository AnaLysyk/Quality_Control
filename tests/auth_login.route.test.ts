jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  isPrismaConfigured: jest.fn(() => true),
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { POST } from "@/api/auth/login/route";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const getRedisMock = getRedis as unknown as jest.Mock;
const findUniqueMock = prisma.user.findUnique as jest.Mock;

describe("/api/auth/login", () => {
  beforeEach(() => {
    getRedisMock.mockReset();
    findUniqueMock.mockReset();
    const mockRedis = {
      set: jest.fn().mockResolvedValue("OK"),
    };
    getRedisMock.mockReturnValue(mockRedis);
  });

  it("retorna 400 se email/senha ausentes", async () => {
    const res = await POST(new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it("retorna 401 se credenciais inválidas", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "wrong@test.com", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna ok e seta cookie se login ok", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "admin@test.com",
      password_hash: "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92", // hash of 123456
      name: "Admin Test",
      active: true,
      created_at: new Date(),      userCompanies: [
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
      ],    });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "admin@test.com", password: "123456" }) })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/session_id=/);
  });
});
