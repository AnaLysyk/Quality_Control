import { GET, PATCH, PUT } from "@/api/clients/[id]/route";

jest.mock("@/lib/supabaseServer", () => {
  const auth = { getUser: jest.fn() };
  const from = jest.fn();
  const supabaseServer = { auth, from };
  return { supabaseServer, getSupabaseServer: () => supabaseServer };
});

const supabaseServer = jest.requireMock("@/lib/supabaseServer").supabaseServer as {
  auth: { getUser: jest.Mock };
  from: jest.Mock;
};

function buildQueryResponse(response: { data: any; error: any }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(response),
  };
}

function requestWithAuth(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: "Bearer token" },
  });
}

describe("/api/clients/[id] GET/PATCH/PUT", () => {
  beforeEach(() => {
    supabaseServer.auth.getUser.mockReset();
    supabaseServer.from.mockReset();
  });

  describe("GET", () => {
    it("retorna 401 sem user", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      const res = await GET(new Request("http://localhost/api/clients/cli"), { params: { id: "cli" } });
      expect(res.status).toBe(401);
    });

    it("retorna 404 se cliente nao existe", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "clients") return buildQueryResponse({ data: null, error: null });
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: true }, error: null });
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET(requestWithAuth("http://localhost/api/clients/cli"), { params: { id: "cli" } });
      expect(res.status).toBe(404);
    });

    it("retorna 403 se nao admin e nao vinculado", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "clients") return buildQueryResponse({ data: { id: "cli" }, error: null });
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: false }, error: null });
        if (table === "user_clients") return buildQueryResponse({ data: null, error: null });
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET(requestWithAuth("http://localhost/api/clients/cli"), { params: { id: "cli" } });
      expect(res.status).toBe(403);
    });

    it("retorna 200 com cliente para admin", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "clients") return buildQueryResponse({ data: { id: "cli", name: "Cliente" }, error: null });
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: true }, error: null });
        if (table === "user_clients") return buildQueryResponse({ data: null, error: null });
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET(requestWithAuth("http://localhost/api/clients/cli"), { params: { id: "cli" } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe("cli");
    });
  });

  describe("PATCH/PUT", () => {
    const payload = { name: "Novo", slug: "novo", logo_url: "http://logo", description: "desc" };

    it("retorna 401 sem user", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      const res = await PATCH(
        new Request("http://localhost/api/clients/cli", { method: "PATCH", body: JSON.stringify(payload) }),
        { params: { id: "cli" } }
      );
      expect(res.status).toBe(401);
    });

    it("retorna 403 se nao admin e nao admin do cliente", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: false }, error: null });
        if (table === "user_clients") return buildQueryResponse({ data: { role: "USER", active: true }, error: null });
        if (table === "clients") return buildQueryResponse({ data: { id: "cli" }, error: null });
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await PATCH(
        requestWithAuth("http://localhost/api/clients/cli", { method: "PATCH", body: JSON.stringify(payload) }),
        { params: { id: "cli" } }
      );
      expect(res.status).toBe(403);
    });

    it("atualiza e retorna 200 para admin global", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: true }, error: null });
        if (table === "user_clients") return buildQueryResponse({ data: null, error: null });
        if (table === "clients") return buildQueryResponse({ data: { id: "cli", name: "Novo" }, error: null });
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await PATCH(
        requestWithAuth("http://localhost/api/clients/cli", { method: "PATCH", body: JSON.stringify(payload) }),
        { params: { id: "cli" } }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("Novo");
    });

    it("PUT redireciona para PATCH", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: true }, error: null });
        if (table === "user_clients") return buildQueryResponse({ data: null, error: null });
        if (table === "clients") return buildQueryResponse({ data: { id: "cli", name: "Novo" }, error: null });
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await PUT(
        requestWithAuth("http://localhost/api/clients/cli", { method: "PUT", body: JSON.stringify(payload) }),
        { params: { id: "cli" } }
      );
      expect(res.status).toBe(200);
    });
  });
});
