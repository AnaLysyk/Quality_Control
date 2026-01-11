process.env.SUPABASE_MOCK = "true";
import { POST, GET } from "../app/api/auth/login/route";

describe("Login mock flow", () => {
  const loginUrl = "http://localhost/api/auth/login";
  const meUrl = "http://localhost/api/auth/login"; // reusa o handler GET do mesmo arquivo

  it("retorna 400 se faltar email ou senha", async () => {
    const req = new Request(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ana.testing.company@gmail.com" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toMatch(/Email e senha sao obrigatorios/i);
  });

  it("loga com credenciais mock e define token/cookie", async () => {
    const req = new Request(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "ana.testing.company@gmail.com",
        password: "griaule4096PD$",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBe("mock-token");
    expect(body.user.email).toBe("ana.testing.company@gmail.com");
    const setCookie = res.headers.get("set-cookie") || "";
    expect(setCookie).toMatch(/auth_token=mock-token/);
  });

  it("GET retorna user quando token mock presente", async () => {
    const req = new Request(meUrl, {
      method: "GET",
      headers: { cookie: "auth_token=mock-token" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe("ana.testing.company@gmail.com");
  });

  it("GET 401 quando token ausente", async () => {
    const req = new Request(meUrl, { method: "GET" });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
