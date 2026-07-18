jest.mock("@/database/prismaClient", () => ({
  prisma: {
    brainSourceConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    brainMemory: {
      groupBy: jest.fn(),
    },
  },
}));

import { listBrainSources, BRAIN_SOURCE_MEMORY_TYPE } from "@/backend/brain/sourceSettings";
import { prisma } from "@/database/prismaClient";
import type { BrainAccessContext } from "@/backend/brain/access";

function fakeAccess(overrides: Partial<BrainAccessContext> = {}): BrainAccessContext {
  return {
    user: { id: "user-1", email: "user@example.com", isGlobalAdmin: false },
    userAccess: {
      userId: "user-1",
      role: null,
      permissionRole: null,
      profileKind: "empresa",
      companyId: null,
      companySlug: null,
      companySlugs: [],
      isGlobalAdmin: false,
      isTestingCompanyUser: false,
      isCompanyUser: false,
      permissions: { brain: ["view_external_sources", "configure_sources"] },
    },
    hasGlobalVisibility: true,
    canManage: true,
    allowedCompanySlugs: new Set(),
    allowedCompanyIds: new Set(),
    allowedProjectIds: new Set(),
    ...overrides,
  } as BrainAccessContext;
}

function sourceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "source-1",
    name: "Documentação Playwright",
    sourceType: "public_site",
    status: "active",
    scopeType: "global",
    environment: "production",
    priority: 50,
    useForCompanyContext: false,
    useForGeneralQuestions: true,
    useForRagIngestion: true,
    useForLiveQuery: false,
    config: {},
    secrets: [],
    lastSyncAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ponte Configuracao -> Memoria (BrainSourceConfig <-> BrainMemory)", () => {
  it("fonte configurada mas nunca sincronizada aparece como 'configurado', sem memorias", async () => {
    (prisma.brainSourceConfig.findMany as jest.Mock).mockResolvedValue([sourceRow()]);
    (prisma.brainMemory.groupBy as jest.Mock).mockResolvedValue([]);

    const [result] = await listBrainSources(fakeAccess());
    expect(result.memoriesGenerated).toBe(0);
    expect(result.processingStatus).toBe("configurado");
  });

  it("fonte com sucesso registrado mas sem memorias fica 'aguardando_processamento'", async () => {
    (prisma.brainSourceConfig.findMany as jest.Mock).mockResolvedValue([
      sourceRow({ lastSuccessAt: new Date("2026-07-09T00:00:00.000Z") }),
    ]);
    (prisma.brainMemory.groupBy as jest.Mock).mockResolvedValue([]);

    const [result] = await listBrainSources(fakeAccess());
    expect(result.processingStatus).toBe("aguardando_processamento");
  });

  it("fonte com memorias geradas fica 'indexado' e mostra a contagem/ultimo consumo", async () => {
    (prisma.brainSourceConfig.findMany as jest.Mock).mockResolvedValue([sourceRow()]);
    (prisma.brainMemory.groupBy as jest.Mock).mockResolvedValue([
      { sourceId: "source-1", _count: { _all: 214 }, _max: { createdAt: new Date("2026-07-09T14:32:00.000Z") } },
    ]);

    const [result] = await listBrainSources(fakeAccess());
    expect(result.memoriesGenerated).toBe(214);
    expect(result.lastMemoryAt).toBe("2026-07-09T14:32:00.000Z");
    expect(result.processingStatus).toBe("indexado");
  });

  it("fonte com erro fica 'erro' mesmo se ja tiver memorias antigas geradas", async () => {
    (prisma.brainSourceConfig.findMany as jest.Mock).mockResolvedValue([
      sourceRow({ lastErrorAt: new Date("2026-07-10T00:00:00.000Z"), lastErrorMessage: "timeout" }),
    ]);
    (prisma.brainMemory.groupBy as jest.Mock).mockResolvedValue([
      { sourceId: "source-1", _count: { _all: 5 }, _max: { createdAt: new Date("2026-07-01T00:00:00.000Z") } },
    ]);

    const [result] = await listBrainSources(fakeAccess());
    expect(result.processingStatus).toBe("erro");
  });

  it("fonte inativa fica 'desativado' independentemente de ter memorias", async () => {
    (prisma.brainSourceConfig.findMany as jest.Mock).mockResolvedValue([sourceRow({ status: "inactive" })]);
    (prisma.brainMemory.groupBy as jest.Mock).mockResolvedValue([
      { sourceId: "source-1", _count: { _all: 3 }, _max: { createdAt: new Date() } },
    ]);

    const [result] = await listBrainSources(fakeAccess());
    expect(result.processingStatus).toBe("desativado");
  });

  it("consulta memorias filtrando por sourceType=BRAIN_SOURCE e status ACTIVE", async () => {
    (prisma.brainSourceConfig.findMany as jest.Mock).mockResolvedValue([sourceRow()]);
    (prisma.brainMemory.groupBy as jest.Mock).mockResolvedValue([]);

    await listBrainSources(fakeAccess());

    expect(prisma.brainMemory.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sourceType: BRAIN_SOURCE_MEMORY_TYPE, status: "ACTIVE" }),
      }),
    );
  });
});
