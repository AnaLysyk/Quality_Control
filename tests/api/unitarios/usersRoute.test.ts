jest.mock("@/backend/rbac/requireGlobalAdmin", () => ({ requireGlobalAdminWithStatus: jest.fn() }));
jest.mock("@/backend/auth/session", () => ({ getAccessContext: jest.fn() }));
jest.mock("@/backend/jwtAuth", () => ({ authenticateRequest: jest.fn() }));
jest.mock("@/backend/adminUsers", () => ({
  listAdminUserItems: jest.fn(),
  getAdminUserItem: jest.fn(),
}));
jest.mock("@/backend/adminUserDeleteAccess", () => ({ canDeleteUserByProfile: jest.fn() }));
jest.mock("@/backend/auth/localStore", () => ({
  createLocalUser: jest.fn(),
  listLocalCompanies: jest.fn(),
  listLocalUsers: jest.fn(),
  updateLocalUser: jest.fn(),
  upsertLocalLink: jest.fn(),
}));

import { GET, POST, PATCH, DELETE } from "@/api/users/route";
import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";
import { getAccessContext } from "@/backend/auth/session";
import { authenticateRequest } from "@/backend/jwtAuth";
import { listAdminUserItems, getAdminUserItem } from "@/backend/adminUsers";
import { canDeleteUserByProfile } from "@/backend/adminUserDeleteAccess";
import {
  createLocalUser,
  listLocalCompanies,
  listLocalUsers,
  updateLocalUser,
  upsertLocalLink,
} from "@/backend/auth/localStore";

const mockedRequireGlobalAdminWithStatus = requireGlobalAdminWithStatus as jest.MockedFunction<
  typeof requireGlobalAdminWithStatus
>;
const mockedGetAccessContext = getAccessContext as jest.MockedFunction<typeof getAccessContext>;
const mockedAuthenticateRequest = authenticateRequest as jest.MockedFunction<typeof authenticateRequest>;
const mockedListAdminUserItems = listAdminUserItems as jest.MockedFunction<typeof listAdminUserItems>;
const mockedGetAdminUserItem = getAdminUserItem as jest.MockedFunction<typeof getAdminUserItem>;
const mockedCanDeleteUserByProfile = canDeleteUserByProfile as jest.MockedFunction<typeof canDeleteUserByProfile>;
const mockedCreateLocalUser = createLocalUser as jest.MockedFunction<typeof createLocalUser>;
const mockedListLocalCompanies = listLocalCompanies as jest.MockedFunction<typeof listLocalCompanies>;
const mockedListLocalUsers = listLocalUsers as jest.MockedFunction<typeof listLocalUsers>;
const mockedUpdateLocalUser = updateLocalUser as jest.MockedFunction<typeof updateLocalUser>;
const mockedUpsertLocalLink = upsertLocalLink as jest.MockedFunction<typeof upsertLocalLink>;

function makeRequest(opts: { url?: string; method?: string; body?: any } = {}) {
  return new Request(opts.url ?? "https://app.local/api/users?companyId=cmp-a", {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }) as any;
}

function mockUnauthenticated() {
  mockedRequireGlobalAdminWithStatus.mockResolvedValue({ admin: null, status: 401 });
}

function mockForbidden() {
  mockedRequireGlobalAdminWithStatus.mockResolvedValue({ admin: null, status: 403 });
}

function mockAuthorized() {
  mockedRequireGlobalAdminWithStatus.mockResolvedValue({
    admin: { id: "admin-1", email: "admin@x.com", token: "" } as any,
    status: 200,
  });
  mockedAuthenticateRequest.mockResolvedValue({
    id: "admin-1",
    email: "admin@x.com",
    role: "technical_support",
    isGlobalAdmin: true,
    projectScope: "unrestricted",
    assignments: [],
  });
}

describe("app/api/users/route.ts - autenticação (correção de vulnerabilidade não autenticada)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET sem sessão -> 401, sem consultar dados de usuários", async () => {
    mockUnauthenticated();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockedListAdminUserItems).not.toHaveBeenCalled();
  });

  it("GET autenticado sem privilégio de admin global -> 403", async () => {
    mockForbidden();
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockedListAdminUserItems).not.toHaveBeenCalled();
  });

  it("POST sem sessão -> 401, sem criar usuário", async () => {
    mockUnauthenticated();
    const res = await POST(
      makeRequest({ method: "POST", body: { companyId: "cmp-a", name: "Novo", email: "novo@x.com" } }),
    );
    expect(res.status).toBe(401);
    expect(mockedCreateLocalUser).not.toHaveBeenCalled();
  });

  it("POST autenticado sem privilégio de admin global -> 403, sem criar usuário", async () => {
    mockForbidden();
    const res = await POST(
      makeRequest({ method: "POST", body: { companyId: "cmp-a", name: "Novo", email: "novo@x.com" } }),
    );
    expect(res.status).toBe(403);
    expect(mockedCreateLocalUser).not.toHaveBeenCalled();
  });

  it("PATCH sem sessão -> 401, sem atualizar usuário", async () => {
    mockUnauthenticated();
    const res = await PATCH(
      makeRequest({ method: "PATCH", body: { companyId: "cmp-a", userId: "user-1", updates: { name: "X" } } }),
    );
    expect(res.status).toBe(401);
    expect(mockedUpdateLocalUser).not.toHaveBeenCalled();
  });

  it("PATCH autenticado sem privilégio de admin global -> 403, sem atualizar usuário", async () => {
    mockForbidden();
    const res = await PATCH(
      makeRequest({ method: "PATCH", body: { companyId: "cmp-a", userId: "user-1", updates: { name: "X" } } }),
    );
    expect(res.status).toBe(403);
    expect(mockedUpdateLocalUser).not.toHaveBeenCalled();
  });

  it("DELETE sem sessão continua retornando 401 (comportamento pré-existente, preservado)", async () => {
    mockUnauthenticated();
    const res = await DELETE(
      makeRequest({ method: "DELETE", body: { companyId: "cmp-a", userId: "user-1" } }),
    );
    expect(res.status).toBe(401);
  });

  it("GET autenticado como admin global continua funcionando (200)", async () => {
    mockAuthorized();
    mockedListAdminUserItems.mockResolvedValue([{ id: "user-1", name: "Fulano" } as any]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([{ id: "user-1", name: "Fulano" }]);
    expect(mockedListAdminUserItems).toHaveBeenCalledWith({ companyId: "cmp-a" });
  });

  it("POST autenticado como admin global continua criando usuário (201)", async () => {
    mockAuthorized();
    mockedListLocalCompanies.mockResolvedValue([{ id: "cmp-a", name: "Empresa A" } as any]);
    mockedListLocalUsers.mockResolvedValue([]);
    mockedCreateLocalUser.mockResolvedValue({ id: "user-novo", email: "novo@x.com" } as any);
    mockedUpsertLocalLink.mockResolvedValue(undefined as any);
    mockedGetAdminUserItem.mockResolvedValue({ id: "user-novo", email: "novo@x.com" } as any);

    const res = await POST(
      makeRequest({
        method: "POST",
        body: { companyId: "cmp-a", name: "Novo", email: "novo@x.com", user: "novo" },
      }),
    );
    expect(res.status).toBe(201);
    expect(mockedCreateLocalUser).toHaveBeenCalled();
  });

  it("PATCH autenticado como admin global continua atualizando usuário (200)", async () => {
    mockAuthorized();
    mockedListLocalUsers.mockResolvedValue([]);
    mockedUpdateLocalUser.mockResolvedValue({ id: "user-1", name: "Atualizado" } as any);
    mockedGetAdminUserItem.mockResolvedValue({ id: "user-1", name: "Atualizado" } as any);

    const res = await PATCH(
      makeRequest({
        method: "PATCH",
        body: { companyId: "cmp-a", userId: "user-1", updates: { name: "Atualizado" } },
      }),
    );
    expect(res.status).toBe(200);
    expect(mockedUpdateLocalUser).toHaveBeenCalled();
  });

  it("DELETE autenticado como admin global e com permissão de perfil continua funcionando (200)", async () => {
    mockAuthorized();
    mockedGetAccessContext.mockResolvedValue({ role: "leader_tc" } as any);
    mockedGetAdminUserItem.mockResolvedValue({ id: "user-1", permission_role: "company_user", companyIds: ["cmp-a"] } as any);
    mockedCanDeleteUserByProfile.mockReturnValue(true);
    mockedUpdateLocalUser.mockResolvedValue({ id: "user-1", active: false, status: "blocked" } as any);

    const res = await DELETE(
      makeRequest({ method: "DELETE", body: { companyId: "cmp-a", userId: "user-1" } }),
    );
    expect(res.status).toBe(200);
  });
});
