import { GET, POST } from "@/api/kanban/route";
import { buildQueryResponse, createSupabaseServerMock, resetSupabaseServerMock } from "./utils/supabaseMock";
import { NextRequest } from "next/server";

const supabaseServer = createSupabaseServerMock();

jest.mock("@/lib/supabaseServer", () => ({
  supabaseServer,
  getSupabaseServer: () => supabaseServer,
}));

function requestWithAuth(url: string, init?: RequestInit) {
  const req = new Request(url, {
    ...(init || {}),
    headers: { Authorization: "Bearer token", ...(init?.headers || {}) },
  });
  return new NextRequest(req);
}

describe("/api/kanban - Supabase DB + RBAC", () => {
  beforeEach(() => {
    resetSupabaseServerMock(supabaseServer);
  });

  it("empresa (nao-admin) pode GET sem enviar slug (usa seu slug)", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-empresa" } }, error: null });

    const kanbanQuery = buildQueryResponse({
      data: [
        { id: 1, client_slug: "empresa-x", project: "CDS", run_id: 10, case_id: 12, title: "T", status: "NOT_RUN", bug: null, link: null, created_at: null },
      ],
      error: null,
    });

    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        const q = buildQueryResponse({ data: { client_id: "cli", is_global_admin: false, role: "client_user" }, error: null });
        return q;
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: { slug: "empresa-x" }, error: null });
      }
      if (table === "kanban_cards") {
        return kanbanQuery;
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await GET(requestWithAuth("http://localhost/api/kanban?project=CDS&runId=10") as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    expect(kanbanQuery.eq).toHaveBeenCalledWith("client_slug", "empresa-x");
  });

  it("empresa (nao-admin) recebe 403 se tentar slug de outra empresa", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-empresa" } }, error: null });

    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        return buildQueryResponse({ data: { client_id: "cli", is_global_admin: false, role: "client_user" }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: { slug: "empresa-x" }, error: null });
      }
      if (table === "kanban_cards") {
        return buildQueryResponse({ data: [], error: null });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await GET(requestWithAuth("http://localhost/api/kanban?project=CDS&runId=10&slug=outra") as any);
    expect(res.status).toBe(403);
  });

  it("admin pode GET sem slug (retorna tudo)", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-admin" } }, error: null });

    const kanbanQuery = buildQueryResponse({
      data: [
        { id: 1, client_slug: "empresa-a", project: "CDS", run_id: 10, case_id: null, title: "A", status: "PASS", bug: null, link: null, created_at: null },
        { id: 2, client_slug: "empresa-b", project: "CDS", run_id: 10, case_id: null, title: "B", status: "FAIL", bug: null, link: null, created_at: null },
      ],
      error: null,
    });

    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        return buildQueryResponse({ data: { client_id: null, is_global_admin: true, role: "global_admin" }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: true, role: "global_admin" }, error: null });
      }
      if (table === "kanban_cards") {
        return kanbanQuery;
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await GET(requestWithAuth("http://localhost/api/kanban?project=CDS&runId=10") as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toHaveLength(2);
    // should not force client_slug scoping for admin
    expect(kanbanQuery.eq).not.toHaveBeenCalledWith("client_slug", expect.anything());
  });

  it("empresa POST cria card com slug da empresa quando body nao envia slug", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: { id: "auth-empresa" } }, error: null });

    const kanbanInsertQuery = buildQueryResponse({
      data: {
        id: 10,
        client_slug: "empresa-x",
        project: "CDS",
        run_id: 10,
        case_id: 12,
        title: "Novo",
        status: "NOT_RUN",
        bug: null,
        link: null,
        created_at: null,
      },
      error: null,
    });

    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "users") {
        return buildQueryResponse({ data: { client_id: "cli", is_global_admin: false, role: "client_user" }, error: null });
      }
      if (table === "profiles") {
        return buildQueryResponse({ data: { is_global_admin: false, role: "client_user" }, error: null });
      }
      if (table === "cliente") {
        return buildQueryResponse({ data: { slug: "empresa-x" }, error: null });
      }
      if (table === "kanban_cards") {
        return kanbanInsertQuery;
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await POST(
      requestWithAuth("http://localhost/api/kanban", {
        method: "POST",
        body: JSON.stringify({ project: "CDS", runId: 10, title: "Novo", status: "NOT_RUN", caseId: 12 }),
      }) as any,
    );

    expect(res.status).toBe(201);
    await res.json();
    expect(kanbanInsertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ client_slug: "empresa-x" }));
  });
});
