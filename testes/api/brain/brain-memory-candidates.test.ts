jest.mock("@/lib/brain/brainPrisma", () => ({
  brainPrisma: {
    brainInboxItem: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    brainMemory: { create: jest.fn() },
    brainAuditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
    brainSuggestion: { update: jest.fn() },
  },
}));

jest.mock("@/lib/brain/access", () => ({
  resolveBrainAccess: jest.fn(),
}));

import {
  MEMORY_CANDIDATE_KIND,
  detectMemoryCandidate,
  recordMemoryCandidateFromChat,
} from "@/lib/brain/memoryCandidates";
import { brainPrisma } from "@/lib/brain/brainPrisma";
import { resolveBrainAccess } from "@/lib/brain/access";
import { PATCH } from "@/api/brain/inbox/route";
import type { BrainAccessContext } from "@/lib/brain/access";

function fakeAccess(): BrainAccessContext {
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
  } as BrainAccessContext;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("detectMemoryCandidate", () => {
  it("nao salva uma saudacao simples", () => {
    expect(detectMemoryCandidate("Bom dia.", "Bom dia! Como posso ajudar?").shouldSave).toBe(false);
  });

  it("nao salva mensagem curta sem sinal de conteudo relevante", () => {
    expect(detectMemoryCandidate("ok", "Perfeito.").shouldSave).toBe(false);
  });

  it("detecta regra de negocio explicita", () => {
    const result = detectMemoryCandidate(
      "O limite de reanálise do Cidadão Smart deve seguir o limite do SMART.",
      "Entendido, vou aplicar essa regra.",
    );
    expect(result.shouldSave).toBe(true);
    if (result.shouldSave) expect(result.memoryType).toBe("RULE");
  });

  it("detecta decisao explicita", () => {
    const result = detectMemoryCandidate("A partir de agora vamos usar Playwright para tudo.", "Ok, combinado.");
    expect(result.shouldSave).toBe(true);
    if (result.shouldSave) expect(result.memoryType).toBe("DECISION");
  });

  it("detecta correcao do usuario", () => {
    const result = detectMemoryCandidate("Na verdade, o certo é validar por empresa e não por usuário.", "Certo, corrigido.");
    expect(result.shouldSave).toBe(true);
    if (result.shouldSave) expect(result.memoryType).toBe("EXCEPTION");
  });
});

describe("recordMemoryCandidateFromChat", () => {
  it("nao cria inbox item quando a troca nao e candidata", async () => {
    const result = await recordMemoryCandidateFromChat(fakeAccess(), { message: "Bom dia.", answer: "Bom dia!" });
    expect(result).toBeNull();
    expect(brainPrisma.brainInboxItem.create).not.toHaveBeenCalled();
  });

  it("cria BrainInboxItem pendente com o kind correto quando ha sinal de conteudo relevante", async () => {
    (brainPrisma.brainInboxItem.create as jest.Mock).mockResolvedValue({ id: "inbox-1" });

    await recordMemoryCandidateFromChat(fakeAccess(), {
      message: "Ficou decidido que vamos usar Playwright para os testes de regressão.",
      answer: "Combinado.",
      nodeId: "node-123",
    });

    expect(brainPrisma.brainInboxItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: MEMORY_CANDIDATE_KIND,
          status: "pending",
          companySlug: "empresa-a",
        }),
      }),
    );
  });
});

describe("PATCH /api/brain/inbox - aprovar candidato de memoria", () => {
  function makeRequest(body: object) {
    return new Request("http://localhost/api/brain/inbox", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("ao aprovar, cria a BrainMemory e marca o inbox item como merged", async () => {
    (resolveBrainAccess as jest.Mock).mockResolvedValue({ ok: true, context: fakeAccess() });
    (brainPrisma.brainInboxItem.findUnique as jest.Mock).mockResolvedValue({
      id: "inbox-1",
      kind: MEMORY_CANDIDATE_KIND,
      title: "Regra do limite de reanálise",
      summary: "O limite deve seguir o SMART.",
      payload: { memoryType: "RULE", nodeId: null, requestedBy: "user-1" },
    });
    (brainPrisma.brainMemory.create as jest.Mock).mockResolvedValue({ id: "memory-1", title: "Regra do limite de reanálise", memoryType: "RULE" });
    (brainPrisma.brainInboxItem.update as jest.Mock).mockResolvedValue({ id: "inbox-1", status: "merged" });

    const response = await PATCH(makeRequest({ id: "inbox-1", action: "approve" }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.memory.id).toBe("memory-1");
    expect(brainPrisma.brainMemory.create).toHaveBeenCalledTimes(1);
    expect(brainPrisma.brainInboxItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "merged" }) }),
    );
  });

  it("ao rejeitar, nao cria memoria alguma", async () => {
    (resolveBrainAccess as jest.Mock).mockResolvedValue({ ok: true, context: fakeAccess() });
    (brainPrisma.brainInboxItem.findUnique as jest.Mock).mockResolvedValue({
      id: "inbox-2",
      kind: MEMORY_CANDIDATE_KIND,
      title: "x",
      summary: "y",
      payload: { memoryType: "CONTEXT" },
    });
    (brainPrisma.brainInboxItem.update as jest.Mock).mockResolvedValue({ id: "inbox-2", status: "rejected" });

    const response = await PATCH(makeRequest({ id: "inbox-2", action: "reject" }));
    expect(response.status).toBe(200);
    expect(brainPrisma.brainMemory.create).not.toHaveBeenCalled();
  });
});
