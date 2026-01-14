import { GET as GET_CLIENTS, POST as POST_CLIENTS } from "@/api/clients/route";
import { buildQueryResponse, createSupabaseServerMock, resetSupabaseServerMock } from "./utils/supabaseMock";

const supabaseServer = createSupabaseServerMock();

jest.mock("@/lib/supabaseServer", () => ({
  supabaseServer,
  getSupabaseServer: () => supabaseServer,
}));

function requestWithAuth(url: string, init?: RequestInit) {
  return new Request(url, { ...(init || {}), headers: { Authorization: "Bearer token", ...(init?.headers || {}) } });
}

describe("/api/clients GET/POST", () => {
  beforeEach(() => {
    resetSupabaseServerMock(supabaseServer);
  });

  describe("GET", () => {
    it("retorna 401 sem user", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      const res = await GET_CLIENTS(new Request("http://localhost/api/clients"));
      expect(res.status).toBe(401);
    });

    it("retorna 403 se não admin", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: false }, error: null });
        return buildQueryResponse({ data: [], error: null });
      });
      const res = await GET_CLIENTS(requestWithAuth("http://localhost/api/clients"));
      expect(res.status).toBe(403);
    });

    it("retorna lista se admin global", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: true }, error: null });
        if (table === "cliente") return buildQueryResponse({ data: [{ id: "c1", company_name: "C1" }], error: null });
        return buildQueryResponse({ data: [], error: null });
      });
      const res = await GET_CLIENTS(requestWithAuth("http://localhost/api/clients"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items[0].id).toBe("c1");
      expect(json.items[0].name).toBe("C1");
    });
  });

  describe("POST", () => {
    it("retorna 401 sem user", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      const res = await POST_CLIENTS(new Request("http://localhost/api/clients", { method: "POST", body: "{}" }));
      expect(res.status).toBe(401);
    });

    it("retorna 403 se nao admin", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: false }, error: null });
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await POST_CLIENTS(requestWithAuth("http://localhost/api/clients", { method: "POST", body: JSON.stringify({ name: "C1" }) }));
      expect(res.status).toBe(403);
    });

    it("retorna 400 se name ausente", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: true }, error: null });
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await POST_CLIENTS(requestWithAuth("http://localhost/api/clients", { method: "POST", body: JSON.stringify({}) }));
      expect(res.status).toBe(400);
    });

    it("cria cliente para admin", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "profiles") return buildQueryResponse({ data: { is_global_admin: true }, error: null });
        if (table === "cliente") return buildQueryResponse({ data: { id: "c1", company_name: "C1" }, error: null });
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await POST_CLIENTS(
        requestWithAuth("http://localhost/api/clients", { method: "POST", body: JSON.stringify({ name: "C1" }) })
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.name).toBe("C1");
    });
  });
});
