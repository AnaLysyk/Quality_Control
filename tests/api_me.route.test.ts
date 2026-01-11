import { GET } from "@/api/me/route";

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
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(response),
  };
}

function requestWithAuth(url: string, token = "token") {
  return new Request(url, { headers: { Authorization: `Bearer ${token}` } });
}

describe("/api/me route", () => {
  beforeEach(() => {
    supabaseServer.auth.getUser.mockReset();
    supabaseServer.from.mockReset();
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
