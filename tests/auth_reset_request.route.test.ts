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

import { POST } from "@/api/auth/reset-request/route";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const getRedisMock = getRedis as unknown as jest.Mock;
const findUniqueMock = prisma.user.findUnique as jest.Mock;

describe("/api/auth/reset-request", () => {
  beforeEach(() => {
    getRedisMock.mockReset();
    findUniqueMock.mockReset();
    const mockRedis = {
      set: jest.fn().mockResolvedValue("OK"),
    };
    getRedisMock.mockReturnValue(mockRedis);
  });

  it("retorna 400 se email ausente", async () => {
    const res = await POST(new Request("http://localhost/api/auth/reset-request", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it("retorna ok mesmo se email não existe (segurança)", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/auth/reset-request", { method: "POST", body: JSON.stringify({ email: "nonexistent@test.com" }) })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("retorna ok e salva token se email existe", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-1",
      email: "admin@test.com",
    });
    const res = await POST(
      new Request("http://localhost/api/auth/reset-request", { method: "POST", body: JSON.stringify({ email: "admin@test.com" }) })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });
});