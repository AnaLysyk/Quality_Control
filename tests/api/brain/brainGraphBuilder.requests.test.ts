import { buildAccessRequestsBrainGraph } from "@/brain/_utils/brainGraphBuilder";
import type { BrainAccessRequestRow, BrainAuditLogItem } from "@/brain/_types/brain.types";

function makeRequest(overrides: Partial<BrainAccessRequestRow> = {}): BrainAccessRequestRow {
  return {
    id: "req-1",
    name: "Pessoa Teste",
    email: "pessoa@teste.local",
    status: "open",
    statusLabel: "Aberta",
    accessType: "Usuario TC",
    company: "Empresa A",
    createdAt: "2026-07-19T10:00:00.000Z",
    ...overrides,
  };
}

function makeLog(overrides: Partial<BrainAuditLogItem> = {}): BrainAuditLogItem {
  return {
    id: "log-1",
    created_at: "2026-07-19T11:00:00.000Z",
    actor_user_id: "user-1",
    actor_email: "admin@teste.local",
    action: "access_request.accepted",
    entity_type: "access_request",
    entity_id: "req-1",
    entity_label: "Pessoa Teste",
    metadata: { requestId: "req-1" },
    ...overrides,
  };
}

describe("buildAccessRequestsBrainGraph", () => {
  it("gera solicitacao completa com decisao, ajuste, log e no real", () => {
    const result = buildAccessRequestsBrainGraph({
      requests: [makeRequest({ status: "closed", statusLabel: "Aprovada", adjustmentRound: 2, lastAdjustmentAt: "2026-07-19T09:00:00.000Z", lastAdjustmentDiffCount: 3 })],
      auditLogs: [makeLog()],
      realBrainNodes: [{ id: "real-1", label: "Solicitacao req-1", type: "access_request", refId: "req-1", metadata: { requestId: "req-1" } }],
      realBrainEdges: [{ id: "edge-real", source: "real-1", target: "outro" }],
    });

    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "access_request:req-1", status: "ok" }),
      expect.objectContaining({ id: "decision:req-1", status: "ok" }),
      expect.objectContaining({ id: "adjustment:req-1", status: "ok" }),
      expect.objectContaining({ id: "log:req-1", status: "ok" }),
      expect.objectContaining({ id: "real:real-1" }),
    ]));
    expect(result.summary.requestsWithoutNode).toBe(0);
    expect(result.summary.logsLinked).toBe(1);
  });

  it("marca pendencias quando faltam no real, perfil, email e logs", () => {
    const result = buildAccessRequestsBrainGraph({
      requests: [makeRequest({ email: "", accessType: "", company: "" })],
    });

    expect(result.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "access_request:req-1", status: "pending" }),
      expect.objectContaining({ id: "log:req-1", status: "missing" }),
      expect.objectContaining({ type: "requester", status: "warning" }),
      expect.objectContaining({ type: "profile", status: "warning" }),
    ]));
    expect(result.summary.requestsWithoutNode).toBe(1);
    expect(result.summary.pendingMappings.join(" ")).toContain("sem no real");
    expect(result.summary.pendingMappings.join(" ")).toContain("Logs reais");
  });

  it("direciona empresa e usuario para telas diferentes", () => {
    const companyGraph = buildAccessRequestsBrainGraph({ requests: [makeRequest({ id: "company-1", accessType: "Empresa" })] });
    const userGraph = buildAccessRequestsBrainGraph({ requests: [makeRequest({ id: "user-1", accessType: "Usuario TC" })] });

    expect(companyGraph.edges).toContainEqual(expect.objectContaining({ id: "company-1-target-screen", target: "screen:companies-management" }));
    expect(userGraph.edges).toContainEqual(expect.objectContaining({ id: "user-1-target-screen", target: "screen:users-management" }));
  });

  it("cria decisao inferida sem audit log", () => {
    const result = buildAccessRequestsBrainGraph({ requests: [makeRequest({ status: "rejected", statusLabel: "Recusada" })] });
    expect(result.nodes).toContainEqual(expect.objectContaining({ id: "decision:req-1", status: "warning" }));
  });
});
