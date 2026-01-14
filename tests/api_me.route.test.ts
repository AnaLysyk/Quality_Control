import { GET } from "@/api/me/route";
import { buildQueryResponse, createSupabaseServerMock, resetSupabaseServerMock } from "./utils/supabaseMock";

const supabaseServer = createSupabaseServerMock();

jest.mock("@/lib/supabaseServer", () => ({
  supabaseServer,
  getSupabaseServer: () => supabaseServer,
}));

function requestWithAuth(url: string, token = "token") {
  return new Request(url, { headers: { Authorization: `Bearer ${token}` } });
}

describe("/api/me route", () => {
  beforeEach(() => {
    resetSupabaseServerMock(supabaseServer);
  });

  it("retorna 401 se não autenticado", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET(new Request("http://localhost/api/me"));
    expect(res.status).toBe(401);
  });

  it("retorna usuário autenticado via bearer", async () => {
    supabaseServer.auth.getUser.mockResolvedValue({
      data: { user: { id: "usr1", email: "ana@example.com", user_metadata: { full_name: "Ana" } } },
      error: null,
    });
    supabaseServer.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return buildQueryResponse({ data: { full_name: "Ana", avatar_url: "http://img", is_global_admin: false }, error: null });
      }
      if (table === "user_clients") {
        return buildQueryResponse({
          data: [{ client_id: "griaule", client_slug: "griaule", active: true }],
          error: null,
        });
      }
      return buildQueryResponse({ data: null, error: null });
    });

    const res = await GET(requestWithAuth("http://localhost/api/me"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.user).toMatchObject({
      id: "usr1",
      name: "Ana",
      email: "ana@example.com",
      avatarUrl: "http://img",
      isGlobalAdmin: false,
    });
  });
});
