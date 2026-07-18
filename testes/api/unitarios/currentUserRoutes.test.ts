jest.mock("@/backend/auth/session", () => ({ getAccessContext: jest.fn() }));
jest.mock("@/backend/serverPermissionAccess", () => ({ resolvePermissionAccessForUser: jest.fn() }));
jest.mock("@/backend/auth/localStore", () => ({
  getLocalUserById: jest.fn(),
  findLocalCompanyById: jest.fn(),
  findLocalCompanyBySlug: jest.fn(),
  listLocalCompanies: jest.fn(),
  listLocalLinksForUser: jest.fn(),
  normalizeLocalRole: jest.fn((value) => value),
  findLocalUserByEmailOrId: jest.fn(),
  listLocalUsers: jest.fn(),
  updateLocalUser: jest.fn(),
}));
jest.mock("@/backend/avatarCatalog", () => ({ isAvatarKey: jest.fn(() => true) }));
jest.mock("@/backend/companyRoutes", () => ({
  COMPANY_ROUTE_MODE_COOKIE: "company_route_mode",
  resolveCompanyRouteMode: jest.fn(() => "platform"),
}));
jest.mock("@/data/auditLogRepository", () => ({ addAuditLogSafe: jest.fn() }));

import { GET as getMe } from "@/api/me/route";
import { GET as getAuthMe } from "@/api/auth/me/route";
import { getAccessContext } from "@/backend/auth/session";
import {
  getLocalUserById,
  findLocalCompanyById,
  listLocalCompanies,
  listLocalLinksForUser,
} from "@/backend/auth/localStore";
import { resolvePermissionAccessForUser } from "@/backend/serverPermissionAccess";

const mockedGetAccessContext = getAccessContext as jest.MockedFunction<typeof getAccessContext>;
const mockedGetLocalUserById = getLocalUserById as jest.MockedFunction<typeof getLocalUserById>;
const mockedFindLocalCompanyById = findLocalCompanyById as jest.MockedFunction<typeof findLocalCompanyById>;
const mockedListLocalCompanies = listLocalCompanies as jest.MockedFunction<typeof listLocalCompanies>;
const mockedListLocalLinksForUser = listLocalLinksForUser as jest.MockedFunction<typeof listLocalLinksForUser>;
const mockedResolvePermissionAccessForUser = resolvePermissionAccessForUser as jest.MockedFunction<
  typeof resolvePermissionAccessForUser
>;

const USER = {
  id: "user-1",
  email: "ana@example.com",
  name: "Ana",
  full_name: "Ana Paula",
  user: "ana",
  phone: null,
  avatar_key: "robot",
  avatar_url: "/avatar.png",
  active: true,
  status: "active",
  job_title: "QA",
  linkedin_url: null,
  user_origin: "testing_company",
  default_company_slug: "empresa-a",
  password_hash: "segredo-password",
} as any;

const COMPANY_A = {
  id: "cmp-a",
  name: "Empresa A",
  company_name: null,
  slug: "empresa-a",
  active: true,
  logo_url: "/logo-a.png",
} as any;

const ACCESS = {
  userId: "user-1",
  email: "ana@example.com",
  user: "ana",
  userOrigin: "testing_company",
  isGlobalAdmin: false,
  role: "leader_tc",
  permissionRole: "leader_tc",
  globalRole: null,
  companyRole: "leader_tc",
  capabilities: ["tickets:view"],
  companyId: "cmp-a",
  companySlug: "empresa-a",
  companySlugs: ["empresa-a", "empresa-b"],
  allowedProjectIds: ["proj-a1", "proj-b1"],
  projectScope: "restricted",
  assignments: [
    {
      companyId: "cmp-b",
      companySlug: "empresa-b",
      companyName: "Empresa B",
      projectId: "proj-b1",
      projectSlug: "b1",
      projectName: "B1",
      projectAccess: "selected_projects",
      role: "leader_tc",
      status: "active",
      source: "project_assignment",
    },
    {
      companyId: "cmp-a",
      companySlug: "empresa-a",
      companyName: "Empresa A",
      projectId: "proj-a1",
      projectSlug: "a1",
      projectName: "A1",
      projectAccess: "selected_projects",
      role: "leader_tc",
      status: "active",
      source: "project_assignment",
    },
  ],
} as any;

function request(path: string) {
  return new Request(`https://app.local${path}`, { method: "GET" });
}

describe("/api/me e /api/auth/me - contrato canônico", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetAccessContext.mockResolvedValue(ACCESS);
    mockedGetLocalUserById.mockResolvedValue(USER);
    mockedFindLocalCompanyById.mockResolvedValue(COMPANY_A);
    mockedListLocalCompanies.mockResolvedValue([COMPANY_A]);
    mockedListLocalLinksForUser.mockResolvedValue([
      { userId: "user-1", companyId: "cmp-a", role: "leader_tc", capabilities: [] },
    ] as any);
    mockedResolvePermissionAccessForUser.mockResolvedValue({
      userId: "user-1",
      roleKey: "leader_tc",
      roleDefaults: {},
      override: null,
      permissions: { tickets: ["view"], dashboard: ["view"] },
    } as any);
  });

  it("retorna 401 nas duas rotas sem contexto autenticado", async () => {
    mockedGetAccessContext.mockResolvedValue(null);

    const [me, authMe] = await Promise.all([getMe(request("/api/me")), getAuthMe(request("/api/auth/me"))]);

    expect(me.status).toBe(401);
    expect(authMe.status).toBe(401);
  });

  it("usa o mesmo user, permissions e access nas duas rotas", async () => {
    const meResponse = await getMe(request("/api/me"));
    const authMeResponse = await getAuthMe(request("/api/auth/me"));
    const me = await meResponse.json();
    const authMe = await authMeResponse.json();

    expect(me.user).toEqual(authMe.user);
    expect(me.permissions).toEqual(authMe.permissions);
    expect(me.access).toEqual(authMe.access);
    expect(me.companies).toHaveLength(1);
  });

  it("preserva os pares e ordena deterministicamente sem produto cartesiano", async () => {
    const body = await (await getAuthMe(request("/api/auth/me"))).json();

    expect(body.access.assignments.map((item: any) => `${item.companySlug}:${item.projectSlug}`)).toEqual([
      "empresa-a:a1",
      "empresa-b:b1",
    ]);
    expect(body.access.assignments).not.toContainEqual(
      expect.objectContaining({ companySlug: "empresa-a", projectSlug: "b1" }),
    );
    expect(body.access.assignments).not.toContainEqual(
      expect.objectContaining({ companySlug: "empresa-b", projectSlug: "a1" }),
    );
  });

  it("não expõe segredos do usuário ou detalhes internos de override", async () => {
    const body = await (await getMe(request("/api/me"))).json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("segredo-password");
    expect(serialized).not.toContain("password_hash");
    expect(serialized).not.toContain("roleDefaults");
    expect(serialized).not.toContain("override");
  });

  it("consulta a mesma matriz efetiva por userId nas duas rotas", async () => {
    await getMe(request("/api/me"));
    await getAuthMe(request("/api/auth/me"));

    expect(mockedResolvePermissionAccessForUser).toHaveBeenNthCalledWith(1, "user-1");
    expect(mockedResolvePermissionAccessForUser).toHaveBeenNthCalledWith(2, "user-1");
  });
});
