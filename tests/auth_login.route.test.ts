import { POST } from "@/api/auth/login/route";
import { signToken } from "@/lib/jwtAuth";

jest.mock("@/data/usersRepository", () => ({
  getUserByEmail: jest.fn(),
}));

const getUserByEmail = jest.requireMock("@/data/usersRepository").getUserByEmail as jest.Mock;

describe("/api/auth/login", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret";
  });
  beforeEach(() => {
    getUserByEmail.mockReset();
  });

  it("retorna 400 se email/senha ausentes", async () => {
    const res = await POST(new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it("retorna 401 se usuário não existe", async () => {
    getUserByEmail.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna 401 se usuário inativo", async () => {
    getUserByEmail.mockResolvedValue({ email: "a@b", password_hash: "hash", active: false });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna 401 se senha inválida", async () => {
    getUserByEmail.mockResolvedValue({ email: "a@b", password_hash: "hasherrado", active: true });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna token se login ok", async () => {
    // hash de "x" com sha256
    const crypto = await import("crypto");
    const passHash = crypto.createHash("sha256").update("x").digest("hex");
    getUserByEmail.mockResolvedValue({
      id: "u1",
      email: "a@b",
      password_hash: passHash,
      active: true,
      is_global_admin: false,
    });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.token).toBeDefined();
    const payload = signToken({ sub: "u1", email: "a@b", isGlobalAdmin: false });
    expect(payload).toBeDefined();
  });
});
