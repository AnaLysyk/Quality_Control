import { GET, POST } from "@/api/clients/[id]/users/route";
import { buildQueryResponse, createSupabaseServerMock, resetSupabaseServerMock } from "./utils/supabaseMock";
import { NextRequest } from "next/server";

const supabaseServer = createSupabaseServerMock();

jest.mock("@/lib/supabaseServer", () => ({
  supabaseServer,
  getSupabaseServer: () => supabaseServer,
}));

function requestWithAuth(url: string, init?: RequestInit) {
  const req = new Request(url, { ...(init || {}), headers: { Authorization: "Bearer token", ...(init?.headers || {}) } });
  return new NextRequest(req);
}

describe("/api/clients/[id]/users GET/POST", () => {
  beforeEach(() => {
    resetSupabaseServerMock(supabaseServer);
  });

  it("GET retorna 401 se não autenticado", async () => {
    const res = await GET(new NextRequest("http://localhost/api/clients/cli/users"), { params: { id: "cli" } } as any);
    expect(res.status).toBe(401);
  });

  it("GET retorna 404 se cliente não existe", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth1", email: "a@b" } }, error: null });
    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        return buildQueryResponse({ data: { id: "u1", client_id: "cli", active: true, role: "client_user" }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: null, error: null });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await GET(requestWithAuth("http://localhost/api/clients/cli/users"), { params: { id: "cli" } } as any);
    expect(res.status).toBe(404);
  });

  it("GET retorna 403 se usuário não pertence ao cliente", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth1", email: "a@b" } }, error: null });
    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        // Current user belongs to a different client.
        return buildQueryResponse({ data: { id: "u1", client_id: "other", active: true, role: "client_user" }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: { id: "cli" }, error: null });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await GET(requestWithAuth("http://localhost/api/clients/cli/users"), { params: { id: "cli" } } as any);
    expect(res.status).toBe(403);
  });

  it("GET retorna lista quando autorizado", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth1", email: "a@b" } }, error: null });
    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "cliente") {
        return buildQueryResponse({ data: { id: "cli" }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
      }
      if (table === "users") {
        // First call: current user access row
        // Second call: list users for client
        const callIndex = supabaseServer.from.mock.calls.filter((c: [string]) => c[0] === "users").length;
        if (callIndex === 1) {
          return buildQueryResponse({ data: { id: "u1", client_id: "cli", active: true, role: "client_user" }, error: null });
        }
        return buildQueryResponse({ data: [{ id: "u2", name: "Ana", email: "ana@x", role: "client_user", active: true }], error: null });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await GET(requestWithAuth("http://localhost/api/clients/cli/users"), { params: { id: "cli" } } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(json.items[0]).toMatchObject({ name: "Ana", email: "ana@x" });
  });

  it("POST retorna 403 se authorizeClientAccess falhar", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth1", email: "a@b" } }, error: null });
    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        // current user is not admin
        return buildQueryResponse({ data: { id: "u1", client_id: "cli", active: true, role: "client_user", is_global_admin: false }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: { id: "cli" }, error: null });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await POST(
      requestWithAuth("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({ email: "a@b", role: "ADMIN" }) }),
      { params: { id: "cli" } } as any
    );
    expect(res.status).toBe(403);
  });

  it("POST retorna 404 se usuário não encontrado", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth1", email: "a@b" } }, error: null });
    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        const callIndex = supabaseServer.from.mock.calls.filter((c: [string]) => c[0] === "users").length;
        if (callIndex === 1) {
          // current user is admin
          return buildQueryResponse({ data: { id: "uAdmin", client_id: null, active: true, role: "global_admin", is_global_admin: true }, error: null });
        }
        // lookup by email -> not found
        return buildQueryResponse({ data: null, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: { id: "cli" }, error: null });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await POST(
      requestWithAuth("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({ email: "a@b", role: "ADMIN" }) }),
      { params: { id: "cli" } } as any
    );
    expect(res.status).toBe(404);
  });

  it("POST retorna 400 se email/role ausentes", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth1", email: "a@b" } }, error: null });
    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        return buildQueryResponse({ data: { id: "uAdmin", client_id: null, active: true, role: "global_admin", is_global_admin: true }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: { id: "cli" }, error: null });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await POST(
      requestWithAuth("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({}) }),
      { params: { id: "cli" } } as any
    );
    expect(res.status).toBe(400);
  });

  it("POST retorna 409 se usuário já vinculado", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth1", email: "a@b" } }, error: null });
    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        const callIndex = supabaseServer.from.mock.calls.filter((c: [string]) => c[0] === "users").length;
        if (callIndex === 1) {
          return buildQueryResponse({ data: { id: "uAdmin", client_id: null, active: true, role: "global_admin", is_global_admin: true }, error: null });
        }
        // lookup target by email -> already linked and active
        return buildQueryResponse({ data: { id: "uTarget", email: "a@b", client_id: "cli", active: true, role: "client_user" }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: { id: "cli" }, error: null });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await POST(
      requestWithAuth("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({ email: "a@b", role: "USER" }) }),
      { params: { id: "cli" } } as any
    );
    expect(res.status).toBe(409);
  });

  it("POST vincula usuário e retorna 200 quando autorizado", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth1", email: "a@b" } }, error: null });
    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        const callIndex = supabaseServer.from.mock.calls.filter((c: [string]) => c[0] === "users").length;
        if (callIndex === 1) {
          return buildQueryResponse({ data: { id: "uAdmin", client_id: null, active: true, role: "global_admin", is_global_admin: true }, error: null });
        }
        if (callIndex === 2) {
          // lookup target by email -> found but not linked
          return buildQueryResponse({ data: { id: "uTarget", email: "a@b", client_id: null, active: false, role: "client_user" }, error: null });
        }
        // update response
        return buildQueryResponse({ data: { id: "uTarget", name: "Ana", email: "a@b", role: "client_admin", active: true }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: { id: "cli" }, error: null });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await POST(
      requestWithAuth("http://localhost/api/clients/cli/users", { method: "POST", body: JSON.stringify({ email: "a@b", role: "ADMIN" }) }),
      { params: { id: "cli" } } as any
    );
    expect(res.status).toBe(200);
  });
});
