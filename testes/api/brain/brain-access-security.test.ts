import type { PermissionMatrix } from "@/lib/permissionMatrix";

jest.mock("@/lib/jwtAuth", () => ({
  authenticateRequest: jest.fn(),
}));

jest.mock("@/lib/serverPermissionAccess", () => ({
  resolvePermissionAccessForUser: jest.fn(),
}));

jest.mock("@/database/prismaClient", () => ({
  prisma: {
    company: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    brainNode: { findUnique: jest.fn() },
  },
}));

import {
  assertBrainNodeAccess,
  canAccessBrainModule,
  filterBrainDomainGraphByAccess,
  filterBrainGraphByAccess,
  isBrainDomainNodeVisible,
  isBrainNodeVisible,
  resolveBrainAccess,
} from "@/lib/brain/access";
import { mergeBrainGraphs } from "../../../app/brain/_utils/brainGraphBuilder";
import { authenticateRequest } from "@/lib/jwtAuth";
import { prisma } from "@/database/prismaClient";
import { resolvePermissionAccessForUser } from "@/lib/serverPermissionAccess";

type MockAuthUser = {
  id: string;
  email: string;
  isGlobalAdmin: boolean;
  role?: string | null;
  permissionRole?: string | null;
  companyRole?: string | null;
  companyId?: string | null;
  companySlug?: string | null;
  companySlugs?: string[];
};

function mockUser(overrides: Partial<MockAuthUser> = {}): MockAuthUser {
  return {
    id: "user-1",
    email: "user@example.com",
    isGlobalAdmin: false,
    role: "leader_tc",
    permissionRole: "leader_tc",
    companyRole: null,
    companyId: null,
    companySlug: null,
    companySlugs: [],
    ...overrides,
  };
}

function mockPermissions(overrides: Partial<PermissionMatrix> = {}): PermissionMatrix {
  return {
    context: ["global_overview", "view_all_companies", "view_all_projects"],
    brain: ["view", "read", "use"],
    audit: ["view", "export"],
    users: ["view"],
    applications: ["view"],
    defect_tracking: ["read"],
    defects: ["view"],
    test_repository: [],
    ...overrides,
  };
}

function makeRequest() {
  return new Request("http://localhost/api/brain/graph");
}

function mockResolvedPermissions(permissions: PermissionMatrix) {
  (resolvePermissionAccessForUser as jest.Mock).mockResolvedValue({
    userId: "user-1",
    roleKey: "leader_tc",
    roleDefaults: {},
    override: null,
    permissions,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.company.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.project.findMany as jest.Mock).mockResolvedValue([]);
});

describe("Brain access - Lider TC com Empresas/Usuarios mas sem Auditoria", () => {
  it("mantem visao global de empresa mas nega o modulo de auditoria", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(mockUser());
    mockResolvedPermissions(mockPermissions({ audit: [] }));

    const result = await resolveBrainAccess(makeRequest());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Empresa/projeto global concedido pela matriz (context:view_all_companies)...
    expect(result.context.hasGlobalVisibility).toBe(true);
    // ...mas isso NAO deve bypassar a permissao de modulo: sem audit:view, sem Logs.
    expect(canAccessBrainModule(result.context, "Logs")).toBe(false);
    expect(canAccessBrainModule(result.context, "Usuarios")).toBe(true);
    expect(canAccessBrainModule(result.context, "Empresas")).toBe(true);
  });

  it("nao inclui nos nem edges de log no grafo de dominio, mesmo com visao global de empresa", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(mockUser());
    mockResolvedPermissions(mockPermissions({ audit: [] }));

    const result = await resolveBrainAccess(makeRequest());
    if (!result.ok) throw new Error("access should be ok");

    const nodes = [
      { id: "company:A", module: "Empresas", type: "company", companyId: "A" },
      { id: "log:1", module: "Logs", type: "log", companyId: "A" },
    ];
    const edges = [
      { id: "e1", source: "company:A", target: "log:1", module: "Logs", companyId: "A" },
    ];

    const filtered = filterBrainDomainGraphByAccess(nodes, edges, result.context);
    expect(filtered.nodes.map((node) => node.id)).toEqual(["company:A"]);
    expect(filtered.edges).toHaveLength(0);
  });

  it("isBrainDomainNodeVisible nega nó de log direto por causa do modulo, nao da empresa", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(mockUser());
    mockResolvedPermissions(mockPermissions({ audit: [] }));

    const result = await resolveBrainAccess(makeRequest());
    if (!result.ok) throw new Error("access should be ok");

    expect(isBrainDomainNodeVisible({ module: "Logs", type: "log", companyId: "A" }, result.context)).toBe(false);
  });
});

describe("Brain access - deny individual prevalece sobre o perfil", () => {
  it("nega Defeitos para o usuario com deny individual mesmo que o perfil libere", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(mockUser({ id: "user-deny" }));
    // Simula deny individual: o perfil leader_tc libera defect_tracking/defects, mas a
    // matriz efetiva resolvida para este usuario especifico ja vem sem essas acoes.
    mockResolvedPermissions(mockPermissions({ defect_tracking: [], defects: [] }));

    const result = await resolveBrainAccess(makeRequest());
    if (!result.ok) throw new Error("access should be ok");

    expect(canAccessBrainModule(result.context, "Defeitos")).toBe(false);
    expect(canAccessBrainModule(result.context, "Usuarios")).toBe(true);
  });
});

describe("Brain access - allow individual e isolado por usuario", () => {
  it("da o modulo extra apenas ao usuario que recebeu o allow individual", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(mockUser({ id: "user-A" }));
    (resolvePermissionAccessForUser as jest.Mock).mockImplementation(async (userId: string) => ({
      userId,
      roleKey: "testing_company_user",
      roleDefaults: {},
      override: null,
      permissions:
        userId === "user-A"
          ? mockPermissions({ test_repository: ["read"] })
          : mockPermissions({ test_repository: [] }),
    }));

    const resultA = await resolveBrainAccess(makeRequest());
    if (!resultA.ok) throw new Error("access should be ok");
    expect(canAccessBrainModule(resultA.context, "Casos de teste")).toBe(true);

    (authenticateRequest as jest.Mock).mockResolvedValue(mockUser({ id: "user-B" }));
    const resultB = await resolveBrainAccess(makeRequest());
    if (!resultB.ok) throw new Error("access should be ok");
    expect(canAccessBrainModule(resultB.context, "Casos de teste")).toBe(false);
  });
});

describe("Brain access - escopo de empresa/projeto", () => {
  it("usuario da Empresa A nao ve nos, itens nem conexoes da Empresa B", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(
      mockUser({
        id: "user-empresa-a",
        role: "empresa",
        permissionRole: "empresa",
        companyId: "company-a",
        companySlug: "empresa-a",
        companySlugs: ["empresa-a"],
      }),
    );
    // Perfil "empresa" nao tem visao global (sem context:view_all_companies).
    mockResolvedPermissions(mockPermissions({ context: ["view_own_company"] }));

    const result = await resolveBrainAccess(makeRequest());
    if (!result.ok) throw new Error("access should be ok");

    expect(result.context.hasGlobalVisibility).toBe(false);
    expect(result.context.allowedCompanyIds.has("company-a")).toBe(true);
    expect(result.context.allowedCompanyIds.has("company-b")).toBe(false);

    const nodes = [
      { id: "company:company-a", module: "Empresas", type: "company", companyId: "company-a" },
      { id: "project:p-a", module: "Empresas", type: "project", companyId: "company-a" },
      { id: "company:company-b", module: "Empresas", type: "company", companyId: "company-b" },
      { id: "project:p-b", module: "Empresas", type: "project", companyId: "company-b" },
    ];
    const edges = [
      { id: "e-a", source: "company:company-a", target: "project:p-a", module: "Empresas", companyId: "company-a" },
      { id: "e-b", source: "company:company-b", target: "project:p-b", module: "Empresas", companyId: "company-b" },
    ];

    const filtered = filterBrainDomainGraphByAccess(nodes, edges, result.context);
    expect(filtered.nodes.map((node) => node.id).sort()).toEqual(["company:company-a", "project:p-a"]);
    expect(filtered.edges.map((edge) => edge.id)).toEqual(["e-a"]);
  });
});

describe("Brain access - no direto por URL", () => {
  it("libera no autorizado e bloqueia no fora do escopo sem revelar metadado", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(
      mockUser({ id: "user-empresa-a", role: "empresa", permissionRole: "empresa", companyId: "company-a" }),
    );
    mockResolvedPermissions(mockPermissions({ context: ["view_own_company"] }));

    const result = await resolveBrainAccess(makeRequest());
    if (!result.ok) throw new Error("access should be ok");

    (prisma.brainNode.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "node-allowed",
      type: "Project",
      refType: null,
      refId: null,
      metadata: { companyId: "company-a" },
    });
    const allowed = await assertBrainNodeAccess("node-allowed", result.context);
    expect(allowed.ok).toBe(true);

    (prisma.brainNode.findUnique as jest.Mock).mockResolvedValueOnce({
      id: "node-other-company",
      type: "Project",
      refType: null,
      refId: null,
      metadata: { companyId: "company-b" },
    });
    const denied = await assertBrainNodeAccess("node-other-company", result.context);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.status).toBe(403);

    (prisma.brainNode.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const missing = await assertBrainNodeAccess("node-does-not-exist", result.context);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.status).toBe(404);
  });
});

describe("Brain access - edges nunca revelam no oculto", () => {
  it("filterBrainGraphByAccess remove edge quando qualquer ponta esta oculta", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(
      mockUser({ id: "user-empresa-a", role: "empresa", permissionRole: "empresa", companyId: "company-a" }),
    );
    mockResolvedPermissions(mockPermissions({ context: ["view_own_company"] }));

    const result = await resolveBrainAccess(makeRequest());
    if (!result.ok) throw new Error("access should be ok");

    const nodes = [
      { id: "n1", type: "Company", refType: "Company", refId: "company-a", metadata: { companyId: "company-a" } },
      { id: "n2", type: "Company", refType: "Company", refId: "company-b", metadata: { companyId: "company-b" } },
    ];
    const edges = [{ id: "edge-1", fromId: "n1", toId: "n2" }];

    const { visibleNodeIds, visibleEdgeIds } = filterBrainGraphByAccess(nodes as never, edges as never, result.context);
    expect(visibleNodeIds.has("n1")).toBe(true);
    expect(visibleNodeIds.has("n2")).toBe(false);
    expect(visibleEdgeIds.size).toBe(0);
  });
});

describe("Brain graph merge - uniao deterministica de fontes", () => {
  it("deduplica por id preferindo o no mais completo e remove edges orfas", () => {
    const graphSource = {
      nodes: [
        { id: "shared", type: "company", module: "Empresas", label: "Empresa X", status: "ok" as const },
        { id: "only-in-graph", type: "project", module: "Empresas", label: "Projeto", status: "ok" as const },
      ],
      edges: [{ id: "edge-graph", source: "shared", target: "only-in-graph", label: "possui", type: "contains" as const }],
    };
    const domainSource = {
      nodes: [
        {
          id: "shared",
          type: "company" as const,
          module: "Empresas",
          label: "Empresa X",
          status: "ok" as const,
          companyId: "company-a",
          createdBy: "user-1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      edges: [{ id: "edge-orphan", source: "shared", target: "nonexistent", label: "relacionado a", type: "relation" as const }],
    };

    const merged = mergeBrainGraphs(graphSource as never, domainSource as never);

    expect(merged.nodes).toHaveLength(2);
    const sharedNode = merged.nodes.find((node) => node.id === "shared");
    // o no do domainSource tem mais campos preenchidos (companyId/createdBy/createdAt) e deve prevalecer.
    expect(sharedNode?.companyId).toBe("company-a");
    expect(sharedNode?.createdBy).toBe("user-1");

    // a edge orfa (target inexistente) nao deve sobreviver ao merge.
    expect(merged.edges.map((edge) => edge.id)).toEqual(["edge-graph"]);
  });
});

describe("Brain access - isBrainNodeVisible respeita permissao mesmo com no nao sensivel", () => {
  it("nega modulo mesmo quando o no e classificado como sistema/nao sensivel", async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue(mockUser());
    mockResolvedPermissions(mockPermissions({ audit: [] }));

    const result = await resolveBrainAccess(makeRequest());
    if (!result.ok) throw new Error("access should be ok");

    const node = {
      type: "Module",
      refType: "SystemModule",
      refId: "logs",
      metadata: { moduleKey: "logs" },
    };
    expect(isBrainNodeVisible(node as never, result.context)).toBe(false);
  });
});
