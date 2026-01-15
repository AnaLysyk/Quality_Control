import { NextResponse } from "next/server";
import { buildQueryResponse, createSupabaseServerMock, resetSupabaseServerMock } from "./utils/supabaseMock";

function requestWithAuth(url: string, init?: RequestInit) {
  return new Request(url, {
    ...(init || {}),
    headers: { Authorization: "Bearer token", ...(init?.headers || {}) },
  });
}

// --- Mocks (top-level) ---

jest.mock("@/data/auditLogRepository", () => {
  return {
    addAuditLogSafe: jest.fn().mockResolvedValue(undefined),
  };
});

const { addAuditLogSafe } = jest.requireMock("@/data/auditLogRepository") as {
  addAuditLogSafe: jest.Mock;
};

const supabaseServer = createSupabaseServerMock();

jest.mock("@/lib/supabaseServer", () => ({
  supabaseServer,
  getSupabaseServer: () => supabaseServer,
}));

const userClient = {
  auth: { getUser: jest.fn() },
};
const serviceClient = {
  auth: {
    admin: {
      inviteUserByEmail: jest.fn(),
      deleteUser: jest.fn(),
    },
  },
  from: jest.fn(),
};

jest.mock("@supabase/supabase-js", () => {
  return {
    createClient: (...args: any[]) => {
      const key = args?.[1];
      if (key === process.env.SUPABASE_SERVICE_ROLE_KEY) return serviceClient;
      return userClient;
    },
  };
});

// Import routes after mocks
const { GET: GET_CLIENTS, POST: POST_CLIENTS } = require("@/api/clients/route") as {
  GET: (req: any) => Promise<NextResponse>;
  POST: (req: any) => Promise<NextResponse>;
};

const { POST: POST_ADMIN_USERS } = require("@/api/admin/users/route") as {
  POST: (req: any) => Promise<NextResponse>;
};

describe("Cadastro (empresa e usuario) - RBAC + DB", () => {
  describe("/api/clients (cadastro empresa)", () => {
    beforeEach(() => {
      resetSupabaseServerMock(supabaseServer);
      addAuditLogSafe.mockClear();
    });

    it("retorna 401 sem token", async () => {
      const res = await POST_CLIENTS(
        new Request("http://localhost/api/clients", {
          method: "POST",
          body: JSON.stringify({ company_name: "X" }),
        }) as any,
      );
      expect(res.status).toBe(401);
    });

    it("empresa (nao-admin) recebe 403", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-empresa", email: "u@empresa.com" } }, error: null });

      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await POST_CLIENTS(
        requestWithAuth("http://localhost/api/clients", {
          method: "POST",
          body: JSON.stringify({ company_name: "Empresa X" }),
        }) as any,
      );
      expect(res.status).toBe(403);
    });

    it("GET: nao-admin recebe 403", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-empresa", email: "u@empresa.com" } }, error: null });

      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user", active: true }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET_CLIENTS(requestWithAuth("http://localhost/api/clients"));
      expect(res.status).toBe(403);
    });

    it("GET: admin lista empresas (200)", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-admin", email: "admin@x.com" } }, error: null });

      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin", active: true }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        if (table === "cliente") {
          // GET uses .select(...).order(...)
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
              data: [{ id: "cli", company_name: "Empresa X", slug: "empresa-x", active: true, created_by: "auth-admin" }],
              error: null,
            }),
          };
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await GET_CLIENTS(requestWithAuth("http://localhost/api/clients"));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.items[0]).toMatchObject({ id: "cli", name: "Empresa X" });
    });

    it("admin cria empresa e recebe 201", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-admin", email: "admin@x.com" } }, error: null });

      const insertSpy = jest.fn().mockReturnThis();
      const selectSpy = jest.fn().mockReturnThis();
      const maybeSingleSpy = jest
        .fn()
        .mockResolvedValue({ data: { id: "cli", company_name: "Empresa X", slug: "empresa-x", active: true, created_by: "auth-admin" }, error: null });

      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        if (table === "cliente") {
          return { insert: insertSpy, select: selectSpy, maybeSingle: maybeSingleSpy };
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await POST_CLIENTS(
        requestWithAuth("http://localhost/api/clients", {
          method: "POST",
          body: JSON.stringify({ company_name: "Empresa X", qase_token: "SECRET" }),
        }) as any,
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toMatchObject({ id: "cli", company_name: "Empresa X", active: true });
      // should never leak tokens
      expect(json.qase_token).toBeNull();
      expect(insertSpy).toHaveBeenCalledTimes(1);

      expect(addAuditLogSafe).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: "auth-admin",
          actorEmail: "admin@x.com",
          action: "client.created",
          entityType: "client",
          entityId: "cli",
        }),
      );
    });

    it("admin com payload invalido recebe 400", async () => {
      supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-admin", email: "admin@x.com" } }, error: null });
      supabaseServer.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await POST_CLIENTS(
        requestWithAuth("http://localhost/api/clients", {
          method: "POST",
          body: JSON.stringify({}),
        }) as any,
      );
      expect(res.status).toBe(400);
    });
  });

  describe("/api/admin/users (cadastro usuario)", () => {
    beforeEach(() => {
      resetSupabaseServerMock(supabaseServer);
      userClient.auth.getUser.mockReset();
      serviceClient.auth.admin.inviteUserByEmail.mockReset();
      serviceClient.auth.admin.deleteUser.mockReset();
      serviceClient.from.mockReset();
      addAuditLogSafe.mockClear();
    });

    it("nao-admin recebe 403", async () => {
      userClient.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-empresa", email: "u@empresa.com", app_metadata: {} } }, error: null });

      serviceClient.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user", active: true }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await POST_ADMIN_USERS(
        requestWithAuth("http://localhost/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ name: "User", email: "user@empresa.com", role: "client_user", client_id: "cli" }),
        }) as any,
      );
      expect(res.status).toBe(403);
    });

    it("admin cria usuario client_user exige client_id (400 se faltar)", async () => {
      userClient.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-admin", email: "admin@x.com", app_metadata: {} } }, error: null });

      serviceClient.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin", active: true }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      const res = await POST_ADMIN_USERS(
        requestWithAuth("http://localhost/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ name: "User", email: "user@empresa.com", role: "client_user" }),
        }) as any,
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Empresa/i);
    });

    it("admin cria global_admin sem client_id (201)", async () => {
      userClient.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-admin", email: "admin@x.com", app_metadata: {} } }, error: null });

      serviceClient.from.mockImplementation((table: string) => {
        if (table === "users") {
          // 1st: requireAdmin lookup; 2nd: insert
          const query = buildQueryResponse({ data: { is_global_admin: true, role: "global_admin", active: true }, error: null });
          (query.insert as jest.Mock).mockResolvedValue({ error: null });
          return query;
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      serviceClient.auth.admin.inviteUserByEmail.mockResolvedValue({ data: { user: { id: "auth-new" } }, error: null });

      const res = await POST_ADMIN_USERS(
        requestWithAuth("http://localhost/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ name: "New Admin", email: "new@x.com", role: "global_admin" }),
        }) as any,
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json).toMatchObject({ email: "new@x.com", role: "global_admin", client_id: null, invited: true });
      expect(serviceClient.auth.admin.inviteUserByEmail).toHaveBeenCalledWith("new@x.com", expect.any(Object));
      expect(serviceClient.from).toHaveBeenCalledWith("users");

      expect(addAuditLogSafe).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: "auth-admin",
          actorEmail: "admin@x.com",
          action: "user.created",
          entityType: "user",
          entityLabel: "new@x.com",
        }),
      );
    });

    it("invite duplicado retorna 409", async () => {
      userClient.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-admin", email: "admin@x.com", app_metadata: {} } }, error: null });
      serviceClient.from.mockImplementation((table: string) => {
        if (table === "users") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin", active: true }, error: null });
        }
        if (table === "profiles") {
          return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
        }
        return buildQueryResponse({ data: null, error: null });
      });

      serviceClient.auth.admin.inviteUserByEmail.mockResolvedValue({
        data: null,
        error: { status: 422, message: "User already exists" },
      });

      const res = await POST_ADMIN_USERS(
        requestWithAuth("http://localhost/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ name: "Dup", email: "dup@x.com", role: "global_admin" }),
        }) as any,
      );
      expect(res.status).toBe(409);
    });
  });
});
