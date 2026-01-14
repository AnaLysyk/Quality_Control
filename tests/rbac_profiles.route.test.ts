import { GET as GET_ME_CLIENTS } from "@/api/me/clients/route";
import { GET as GET_CLIENT_USERS, POST as POST_CLIENT_USERS, PATCH as PATCH_CLIENT_USERS } from "@/api/clients/[id]/users/route";
import { buildQueryResponse, createSupabaseServerMock, resetSupabaseServerMock } from "./utils/supabaseMock";

const supabaseServer = createSupabaseServerMock();

jest.mock("@/lib/supabaseServer", () => ({
  supabaseServer,
  getSupabaseServer: () => supabaseServer,
}));

function requestWithAuth(url: string, init?: RequestInit) {
  return new Request(url, {
    ...(init || {}),
    headers: { Authorization: "Bearer token", ...(init?.headers || {}) },
  });
}

describe("RBAC (admin/empresa/usuario) - Supabase DB", () => {
  beforeEach(() => {
    resetSupabaseServerMock(supabaseServer);
  });

  describe("/api/me/clients", () => {
    it("retorna 401 sem token", async () => {
      const res = await GET_ME_CLIENTS(new Request("http://localhost/api/me/clients"));
      expect(res.status).toBe(401);
    });

    it("admin global recebe 200 e lista vazia", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-admin", email: "a@b" } }, error: null });

      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({
            data: { id: "u-admin", is_global_admin: true, role: "global_admin", active: true, client_id: null },
            error: null,
          });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET_ME_CLIENTS(requestWithAuth("http://localhost/api/me/clients"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toEqual([]);
    });

    it("empresa recebe 200 e 1 empresa (users.client_id)", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-empresa", email: "u@empresa.com" } }, error: null });

      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({
            data: { id: "u1", is_global_admin: false, role: "client_user", active: true, client_id: "cli" },
            error: null,
          });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
        }
        if (table === "cliente") {
          return buildQueryResponse({ data: { id: "cli", company_name: "Empresa X", slug: "empresa-x", active: true }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET_ME_CLIENTS(requestWithAuth("http://localhost/api/me/clients"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toHaveLength(1);
      expect(json.items[0]).toMatchObject({ client_id: "cli", client_slug: "empresa-x", role: "USER", link_active: true });
      expect(supabaseServer.from).toHaveBeenCalledWith("users");
      expect(supabaseServer.from).toHaveBeenCalledWith("cliente");
    });

    it("usuário sem vínculo recebe 200 e lista vazia", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-nolink", email: "u@x.com" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({
            data: { id: "u1", is_global_admin: false, role: "client_user", active: true, client_id: null },
            error: null,
          });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET_ME_CLIENTS(requestWithAuth("http://localhost/api/me/clients"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toEqual([]);
    });
  });

  describe("/api/clients/[id]/users", () => {
    it("empresa consegue listar equipe apenas do próprio client", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-empresa", email: "u@empresa.com" } }, error: null });

      let usersCall = 0;
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "cliente") {
          return buildQueryResponse({ data: { id: "cli" }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
        }
        if (table === "users") {
          usersCall += 1;
          // 1st: resolve current user access. 2nd: list members.
          if (usersCall === 1) {
            return buildQueryResponse({ data: { id: "u1", client_id: "cli", active: true, role: "client_user" }, error: null });
          }
          return buildQueryResponse({
            data: [
              { id: "u1", name: "User 1", email: "u1@empresa.com", role: "client_user", active: true },
              { id: "u2", name: "User 2", email: "u2@empresa.com", role: "client_admin", active: true },
            ],
            error: null,
          });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET_CLIENT_USERS(requestWithAuth("http://localhost/api/clients/cli/users"), { params: { id: "cli" } } as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toHaveLength(2);
      expect(json.items[0]).toHaveProperty("email");
    });

    it("empresa não pode usar all=true", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-empresa", email: "u@empresa.com" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "cliente") {
          return buildQueryResponse({ data: { id: "cli" }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
        }
        if (table === "users") {
          return buildQueryResponse({ data: { id: "u1", client_id: "cli", active: true, role: "client_user" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET_CLIENT_USERS(
        requestWithAuth("http://localhost/api/clients/cli/users?all=true"),
        { params: { id: "cli" } } as any
      );
      expect(res.status).toBe(403);
    });

    it("usuário sem vínculo não pode listar empresa", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-nolink", email: "u@x.com" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "cliente") {
          return buildQueryResponse({ data: { id: "cli" }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
        }
        if (table === "users") {
          return buildQueryResponse({ data: { id: "u1", client_id: null, active: true, role: "client_user" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET_CLIENT_USERS(requestWithAuth("http://localhost/api/clients/cli/users"), { params: { id: "cli" } } as any);
      expect(res.status).toBe(403);
    });

    it("admin global pode POST (vincular) e PATCH (alterar)", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-admin", email: "admin@x.com" } }, error: null });

      let usersCall = 0;
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "cliente") {
          return buildQueryResponse({ data: { id: "cli" }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        if (table === "users") {
          usersCall += 1;
          // 1st: resolve current user access
          // 2nd: lookup target by email
          // 3rd: update target
          if (usersCall === 1) {
            return buildQueryResponse({ data: { id: "u-admin", is_global_admin: true, role: "global_admin", active: true, client_id: null }, error: null });
          }
          if (usersCall === 2) {
            return buildQueryResponse({ data: { id: "u-target", email: "user@empresa.com", client_id: null, active: false, role: "client_user" }, error: null });
          }
          return buildQueryResponse({ data: { id: "u-target", name: "User", email: "user@empresa.com", role: "client_admin", active: true }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const postRes = await POST_CLIENT_USERS(
        requestWithAuth("http://localhost/api/clients/cli/users", {
          method: "POST",
          body: JSON.stringify({ email: "user@empresa.com", role: "ADMIN" }),
        }),
        { params: { id: "cli" } } as any
      );
      expect(postRes.status).toBe(200);

      // PATCH: update target role/active
      usersCall = 0;
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "cliente") {
          return buildQueryResponse({ data: { id: "cli" }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        if (table === "users") {
          usersCall += 1;
          if (usersCall === 1) {
            return buildQueryResponse({ data: { id: "u-admin", is_global_admin: true, role: "global_admin", active: true, client_id: null }, error: null });
          }
          return buildQueryResponse({ data: { id: "u-target", name: "User", email: "user@empresa.com", role: "client_user", active: false }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const patchRes = await PATCH_CLIENT_USERS(
        requestWithAuth("http://localhost/api/clients/cli/users", {
          method: "PATCH",
          body: JSON.stringify({ userId: "u-target", role: "USER", active: false }),
        }),
        { params: { id: "cli" } } as any
      );

      expect(patchRes.status).toBe(200);
    });
  });
});
