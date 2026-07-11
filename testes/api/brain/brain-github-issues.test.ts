jest.mock("@/lib/brain/sourceSettings", () => ({
  getBrainSourceById: jest.fn(),
  getDecryptedSourceSecret: jest.fn(),
  isBrainSourceStorageUnavailable: jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/brain/ssrfGuard", () => ({
  safeOutboundFetch: jest.fn(),
}));

import { canSendToGithub, createGithubIssueFromSource } from "@/lib/brain/integrations/githubIssues";
import { getBrainSourceById, getDecryptedSourceSecret } from "@/lib/brain/sourceSettings";
import { safeOutboundFetch } from "@/lib/brain/ssrfGuard";
import type { BrainAccessContext } from "@/lib/brain/access";

function fakeAccess(overrides: Partial<BrainAccessContext> = {}): BrainAccessContext {
  return {
    user: { id: "user-1", email: "user@example.com", isGlobalAdmin: false },
    userAccess: {
      userId: "user-1",
      role: null,
      permissionRole: null,
      profileKind: "empresa",
      companyId: "company-a",
      companySlug: "empresa-a",
      companySlugs: ["empresa-a"],
      isGlobalAdmin: false,
      isTestingCompanyUser: false,
      isCompanyUser: true,
      permissions: {},
    },
    hasGlobalVisibility: false,
    canManage: false,
    allowedCompanySlugs: new Set(["empresa-a"]),
    allowedCompanyIds: new Set(["company-a"]),
    allowedProjectIds: new Set(),
    ...overrides,
  } as BrainAccessContext;
}

function githubSource(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "source-1",
    sourceType: "external_api",
    provider: "github",
    status: "active",
    config: { github: { owner: "testing-company", repo: "quality-control" } },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("canSendToGithub", () => {
  it("nega quando o usuario nao tem assistant:create_external_ticket, canManage nem isGlobalAdmin", () => {
    expect(canSendToGithub(fakeAccess())).toBe(false);
  });

  it("permite com a permissao do catalogo assistant:create_external_ticket", () => {
    const access = fakeAccess({ userAccess: { ...fakeAccess().userAccess, permissions: { assistant: ["create_external_ticket"] } } });
    expect(canSendToGithub(access)).toBe(true);
  });

  it("permite para quem tem canManage (visao global de empresa)", () => {
    expect(canSendToGithub(fakeAccess({ canManage: true }))).toBe(true);
  });
});

describe("createGithubIssueFromSource", () => {
  it("nega sem permissao antes de tocar na fonte", async () => {
    await expect(
      createGithubIssueFromSource(fakeAccess(), { sourceId: "source-1", title: "Bug X", body: "detalhes" }),
    ).rejects.toThrow(/permissao/i);
    expect(getBrainSourceById).not.toHaveBeenCalled();
  });

  it("rejeita fonte que nao seja external_api/github", async () => {
    const access = fakeAccess({ canManage: true });
    (getBrainSourceById as jest.Mock).mockResolvedValue(githubSource({ provider: "qase" }));

    await expect(
      createGithubIssueFromSource(access, { sourceId: "source-1", title: "Bug X", body: "detalhes" }),
    ).rejects.toThrow(/nao e uma integracao GitHub valida/i);
  });

  it("rejeita fonte desativada", async () => {
    const access = fakeAccess({ canManage: true });
    (getBrainSourceById as jest.Mock).mockResolvedValue(githubSource({ status: "inactive" }));

    await expect(
      createGithubIssueFromSource(access, { sourceId: "source-1", title: "Bug X", body: "detalhes" }),
    ).rejects.toThrow(/desativada/i);
  });

  it("rejeita quando owner/repo nao estao configurados", async () => {
    const access = fakeAccess({ canManage: true });
    (getBrainSourceById as jest.Mock).mockResolvedValue(githubSource({ config: { github: {} } }));

    await expect(
      createGithubIssueFromSource(access, { sourceId: "source-1", title: "Bug X", body: "detalhes" }),
    ).rejects.toThrow(/owner\/repo/i);
  });

  it("rejeita quando o token nao esta configurado", async () => {
    const access = fakeAccess({ canManage: true });
    (getBrainSourceById as jest.Mock).mockResolvedValue(githubSource());
    (getDecryptedSourceSecret as jest.Mock).mockResolvedValue(null);

    await expect(
      createGithubIssueFromSource(access, { sourceId: "source-1", title: "Bug X", body: "detalhes" }),
    ).rejects.toThrow(/token/i);
  });

  it("cria a issue chamando a API do GitHub com o token descriptografado e retorna numero/url", async () => {
    const access = fakeAccess({ canManage: true });
    (getBrainSourceById as jest.Mock).mockResolvedValue(githubSource());
    (getDecryptedSourceSecret as jest.Mock).mockResolvedValue("ghp_supersecret");
    (safeOutboundFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ number: 42, html_url: "https://github.com/testing-company/quality-control/issues/42", id: 999 }),
    });

    const result = await createGithubIssueFromSource(access, {
      sourceId: "source-1",
      title: "Bug: falha no login",
      body: "Passos para reproduzir...",
      labels: ["defect"],
    });

    expect(result).toEqual({ number: 42, url: "https://github.com/testing-company/quality-control/issues/42", id: 999 });
    expect(safeOutboundFetch).toHaveBeenCalledWith(
      "https://api.github.com/repos/testing-company/quality-control/issues",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer ghp_supersecret" }),
      }),
    );
  });

  it("propaga erro da API do GitHub quando a resposta nao e ok", async () => {
    const access = fakeAccess({ canManage: true });
    (getBrainSourceById as jest.Mock).mockResolvedValue(githubSource());
    (getDecryptedSourceSecret as jest.Mock).mockResolvedValue("ghp_supersecret");
    (safeOutboundFetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Bad credentials",
    });

    await expect(
      createGithubIssueFromSource(access, { sourceId: "source-1", title: "Bug X", body: "detalhes" }),
    ).rejects.toThrow(/GitHub retornou erro 401/);
  });
});
