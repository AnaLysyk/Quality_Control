jest.mock("@/lib/prismaClient", () => ({
  prisma: {
    brainBehaviorProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    brainBehaviorProfileAssignment: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

import {
  DEFAULT_BEHAVIOR_PROFILE_ID,
  canConfigureBehaviorScope,
  createBehaviorProfile,
  listBehaviorProfiles,
  resolveEffectiveBehaviorProfile,
  setBehaviorAssignment,
  updateBehaviorProfile,
  deleteBehaviorProfile,
} from "@/lib/brain/behaviorProfiles";
import { prisma } from "@/lib/prismaClient";
import type { BrainAccessContext } from "@/lib/brain/access";

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
      permissions: {},
    },
    hasGlobalVisibility: false,
    canManage: false,
    allowedCompanySlugs: new Set(),
    allowedCompanyIds: new Set(["company-a"]),
    allowedProjectIds: new Set(["project-a"]),
    ...overrides,
  } as BrainAccessContext;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("canConfigureBehaviorScope", () => {
  it("qualquer usuario configura o proprio escopo pessoal", () => {
    expect(canConfigureBehaviorScope(fakeAccess(), "user")).toBe(true);
  });

  it("escopo empresa/projeto exige admin do Brain ou visao global de empresa", () => {
    const withoutAdmin = fakeAccess();
    expect(canConfigureBehaviorScope(withoutAdmin, "company")).toBe(false);
    expect(canConfigureBehaviorScope(withoutAdmin, "project")).toBe(false);

    const withGlobalVisibility = fakeAccess({ hasGlobalVisibility: true });
    expect(canConfigureBehaviorScope(withGlobalVisibility, "company")).toBe(true);

    const withAdminPermission = fakeAccess({
      userAccess: { ...fakeAccess().userAccess, permissions: { brain: ["admin"] } },
    });
    expect(canConfigureBehaviorScope(withAdminPermission, "project")).toBe(true);
  });

  it("escopo global exige isGlobalAdmin explicito, nao basta hasGlobalVisibility", () => {
    const withGlobalVisibilityOnly = fakeAccess({ hasGlobalVisibility: true });
    expect(canConfigureBehaviorScope(withGlobalVisibilityOnly, "global")).toBe(false);

    const trueGlobalAdmin = fakeAccess({ user: { ...fakeAccess().user, isGlobalAdmin: true } });
    expect(canConfigureBehaviorScope(trueGlobalAdmin, "global")).toBe(true);
  });
});

describe("listBehaviorProfiles", () => {
  it("sempre inclui os presets do sistema mesmo sem nenhum perfil customizado", async () => {
    (prisma.brainBehaviorProfile.findMany as jest.Mock).mockResolvedValue([]);

    const profiles = await listBehaviorProfiles(fakeAccess());
    expect(profiles.some((profile) => profile.id === DEFAULT_BEHAVIOR_PROFILE_ID)).toBe(true);
    expect(profiles.filter((profile) => profile.isSystem).length).toBeGreaterThanOrEqual(9);
  });
});

describe("createBehaviorProfile", () => {
  it("nega criacao em escopo empresa sem permissao administrativa", async () => {
    await expect(
      createBehaviorProfile(fakeAccess(), { name: "X", instructions: "Y", scopeType: "company" }),
    ).rejects.toThrow(/permissao/i);
  });

  it("nega criacao em escopo global sem isGlobalAdmin", async () => {
    await expect(
      createBehaviorProfile(fakeAccess({ hasGlobalVisibility: true }), { name: "X", instructions: "Y", scopeType: "global" }),
    ).rejects.toThrow(/permissao/i);
  });

  it("cria perfil pessoal normalmente para qualquer usuario", async () => {
    (prisma.brainBehaviorProfile.create as jest.Mock).mockResolvedValue({
      id: "profile-custom-1",
      name: "Assistente QA da Ana",
      description: null,
      instructions: "Responder de forma objetiva.",
      tone: null,
      formality: null,
      responseLength: null,
      rules: null,
      scopeType: "user",
      companyId: null,
      projectId: null,
      ownerUserId: "user-1",
      isSystem: false,
      status: "active",
      version: 1,
      createdBy: "user-1",
      updatedBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const profile = await createBehaviorProfile(fakeAccess(), {
      name: "Assistente QA da Ana",
      instructions: "Responder de forma objetiva.",
      scopeType: "user",
    });
    expect(profile.name).toBe("Assistente QA da Ana");
    expect(profile.scopeType).toBe("user");
  });
});

describe("updateBehaviorProfile / deleteBehaviorProfile", () => {
  it("nao permite editar ou excluir perfil do sistema", async () => {
    await expect(updateBehaviorProfile(fakeAccess(), "preset-profissional", { name: "Novo nome" })).rejects.toThrow(/sistema/i);
    await expect(deleteBehaviorProfile(fakeAccess(), "preset-profissional")).rejects.toThrow(/sistema/i);
  });

  it("nao permite alterar perfil pessoal de outro usuario", async () => {
    (prisma.brainBehaviorProfile.findUnique as jest.Mock).mockResolvedValue({
      id: "profile-outro",
      name: "Perfil de outro usuario",
      instructions: "x",
      scopeType: "user",
      ownerUserId: "outro-usuario",
      isSystem: false,
      status: "active",
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(updateBehaviorProfile(fakeAccess(), "profile-outro", { name: "Hackeado" })).rejects.toThrow(/permissao/i);
  });
});

describe("resolveEffectiveBehaviorProfile", () => {
  it("usa o preset padrao quando nao ha nenhuma atribuicao salva", async () => {
    (prisma.brainBehaviorProfileAssignment.findMany as jest.Mock).mockResolvedValue([]);

    const resolved = await resolveEffectiveBehaviorProfile(fakeAccess(), "chat");
    expect(resolved?.id).toBe(DEFAULT_BEHAVIOR_PROFILE_ID);
  });

  it("prioriza o escopo do usuario sobre o escopo da empresa", async () => {
    (prisma.brainBehaviorProfileAssignment.findMany as jest.Mock).mockResolvedValue([
      { scopeType: "company", scopeId: "company-a", profileId: "preset-executivo" },
      { scopeType: "user", scopeId: "user-1", profileId: "preset-engracado" },
    ]);
    (prisma.brainBehaviorProfile.findUnique as jest.Mock).mockResolvedValue(null);

    const resolved = await resolveEffectiveBehaviorProfile(fakeAccess(), "chat");
    expect(resolved?.id).toBe("preset-engracado");
  });

  it("cai para o escopo da empresa quando o usuario nao tem atribuicao propria", async () => {
    (prisma.brainBehaviorProfileAssignment.findMany as jest.Mock).mockResolvedValue([
      { scopeType: "company", scopeId: "company-a", profileId: "preset-tecnico" },
    ]);

    const resolved = await resolveEffectiveBehaviorProfile(fakeAccess(), "chat");
    expect(resolved?.id).toBe("preset-tecnico");
  });
});

describe("setBehaviorAssignment", () => {
  it("nega aplicar perfil em escopo empresa sem permissao administrativa", async () => {
    await expect(
      setBehaviorAssignment(fakeAccess(), { scopeType: "company", surface: "chat", profileId: DEFAULT_BEHAVIOR_PROFILE_ID }),
    ).rejects.toThrow(/permissao/i);
  });

  it("aplica perfil no escopo pessoal e grava com o scopeId do proprio usuario", async () => {
    (prisma.brainBehaviorProfileAssignment.upsert as jest.Mock).mockResolvedValue({ id: "assignment-1" });

    await setBehaviorAssignment(fakeAccess(), { scopeType: "user", surface: "chat", profileId: DEFAULT_BEHAVIOR_PROFILE_ID });

    expect(prisma.brainBehaviorProfileAssignment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scopeType_scopeId_surface: { scopeType: "user", scopeId: "user-1", surface: "chat" } },
      }),
    );
  });
});
