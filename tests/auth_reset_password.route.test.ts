jest.mock("@/lib/redis", () => ({
  getRedis: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: jest.fn(),
    },
  },
}));

import { POST } from "@/api/auth/reset-password/route";
import { getRedis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

const getRedisMock = getRedis as unknown as jest.Mock;
const updateMock = prisma.user.update as jest.Mock;

describe("/api/auth/reset-password", () => {
  beforeEach(() => {
    getRedisMock.mockReset();
    updateMock.mockReset();
    const mockRedis = {
      get: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
    };
    getRedisMock.mockReturnValue(mockRedis);
  });

  it("retorna 400 se token ou senha ausentes", async () => {
    const res = await POST(new Request("http://localhost/api/auth/reset-password", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it("retorna 400 se token inválido", async () => {
    const mockRedis = getRedisMock();
    mockRedis.get.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: "invalid", newPassword: "newpass" }) })
    );
    expect(res.status).toBe(400);
  });

  it("retorna ok e atualiza senha se token válido", async () => {
    const mockRedis = getRedisMock();
    mockRedis.get.mockResolvedValue("user-1");
    updateMock.mockResolvedValue({ id: "user-1" });
    const res = await POST(
      new Request("http://localhost/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: "valid-token", newPassword: "newpass123" }) })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { password_hash: expect.any(String) },
    });
    expect(mockRedis.del).toHaveBeenCalledWith("reset:valid-token");
  });
});