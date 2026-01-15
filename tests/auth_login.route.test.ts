import { POST } from "@/api/auth/login/route";

jest.mock("@/data/usersRepository", () => ({
  getUserByEmail: jest.fn(),
}));

import { getUserByEmail } from "@/data/usersRepository";

const getUserByEmailMock = getUserByEmail as unknown as jest.Mock;

describe("/api/auth/login", () => {
  beforeEach(() => {
    getUserByEmailMock.mockReset();
    process.env.SUPABASE_DISABLED = "true";
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-jwt-secret";
  });

  it("retorna 400 se email/senha ausentes", async () => {
    const res = await POST(new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it("retorna 401 se usuário não existe", async () => {
    getUserByEmailMock.mockResolvedValue(null);
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna 401 se usuário inativo", async () => {
    getUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "a@b",
      password_hash: "deadbeef",
      active: false,
    });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna 401 se senha inválida", async () => {
    getUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "a@b",
      password_hash: "not-a-match",
      active: true,
    });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna token se login ok", async () => {
    // sha256("x")
    getUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "a@b",
      name: "A",
      password_hash: "2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881",
      active: true,
      is_global_admin: false,
    });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.token).toBe("string");
    expect(json.token.length).toBeGreaterThan(10);
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/auth_token=/);
  });
});
