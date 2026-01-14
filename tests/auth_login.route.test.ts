jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { POST } from "@/api/auth/login/route";

const createClientMock = createClient as unknown as jest.Mock;

function mockSupabaseSignIn(result: { ok: true } | { ok: false }) {
  const signInWithPassword = jest.fn();
  if (result.ok) {
    signInWithPassword.mockResolvedValue({
      data: {
        user: { id: "uid-1", email: "a@b", user_metadata: { full_name: "A" } },
        session: { access_token: "sb-token", token_type: "bearer", expires_in: 3600 },
      },
      error: null,
    });
  } else {
    signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Invalid" } });
  }

  createClientMock.mockReturnValue({ auth: { signInWithPassword } });
  return { signInWithPassword };
}

describe("/api/auth/login", () => {
  beforeEach(() => {
    createClientMock.mockReset();
    process.env.SUPABASE_MOCK = "false";
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:9999";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-key";
  });

  it("retorna 400 se email/senha ausentes", async () => {
    const res = await POST(new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({}) }));
    expect(res.status).toBe(400);
  });

  it("retorna 401 se usuário não existe", async () => {
    mockSupabaseSignIn({ ok: false });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna 401 se usuário inativo", async () => {
    mockSupabaseSignIn({ ok: false });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna 401 se senha inválida", async () => {
    mockSupabaseSignIn({ ok: false });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(401);
  });

  it("retorna token se login ok", async () => {
    mockSupabaseSignIn({ ok: true });
    const res = await POST(
      new Request("http://localhost/api/auth/login", { method: "POST", body: JSON.stringify({ email: "a@b", password: "x" }) })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.token).toBe("sb-token");
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/auth_token=sb-token/);
  });
});
