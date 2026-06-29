import type {
  BrainAccessRequestRow,
  BrainAuditLogItem,
  BrainEdge,
  BrainGraphBuildInput,
  BrainGraphSummary,
  BrainNode,
  BrainNodeStatus,
  BuiltBrainGraph,
} from "../_types/brain.types";
import { formatDateTime, makeStableId, normalizeBrainText, statusLabel } from "./brainGraphFormatters";

const ACCESS_REQUESTS_MODULE = "Solicitacoes";

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function metadataRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function requestHasRealNode(request: BrainAccessRequestRow, realNodes: BrainGraphBuildInput["realBrainNodes"] = []) {
  const id = normalizeBrainText(request.id);
  return realNodes.some((node) => {
    const refId = normalizeBrainText(String(node.refId ?? ""));
    const label = normalizeBrainText(node.label ?? "");
    const metadata = node.metadata ?? {};
    const metadataRequestId = normalizeBrainText(String(metadata.requestId ?? metadata.accessRequestId ?? ""));
    return refId === id || metadataRequestId === id || label.includes(id);
  });
}

function auditLogMatchesRequest(log: BrainAuditLogItem, request: BrainAccessRequestRow) {
  const metadata = metadataRecord(log.metadata);
  const values = [
    log.entity_id,
    log.entity_label,
    metadata.requestId,
    metadata.accessRequestId,
    metadata.email,
    metadata.requesterEmail,
    metadata.userEmail,
  ]
    .filter((value): value is string => typeof value === "string")
    .map(normalizeBrainText);

  const requestId = normalizeBrainText(request.id);
  const email = normalizeBrainText(request.email);
  return values.some((value) => value === requestId || (!!email && value.includes(email)));
}

function auditLogsForRequest(logs: BrainAuditLogItem[], request: BrainAccessRequestRow) {
  return logs.filter((log) => log.entity_type === "access_request" && auditLogMatchesRequest(log, request));
}

function actionFromLog(log: BrainAuditLogItem) {
  if (log.action.includes("accepted")) return "aprovacao";
  if (log.action.includes("rejected")) return "recusa";
  if (log.action.includes("deleted")) return "remocao";
  if (log.action.includes("commented")) return "comentario";
  if (log.action.includes("updated")) return "atualizacao";
  if (log.action.includes("created")) return "criacao";
  return log.action;
}

function mapRequestStatusToNodeStatus(request: BrainAccessRequestRow, hasRealNode: boolean): BrainNodeStatus {
  if (!hasRealNode) return "pending";
  if (request.status === "rejected") return "warning";
  return "ok";
}

function addNode(nodes: BrainNode[], node: BrainNode) {
  nodes.push(node);
}

function addEdge(edges: BrainEdge[], edge: BrainEdge) {
  edges.push(edge);
}

function addActionNodes(edges: BrainEdge[], nodes: BrainNode[], requestId: string) {
  for (const action of ["visualizar", "pdf", "aprovar", "recusar", "solicitar ajuste", "remover"]) {
    const actionNodeId = makeStableId("action", action);
    addNode(nodes, {
      id: actionNodeId,
      type: action === "pdf" ? "pdf" : "action",
      module: ACCESS_REQUESTS_MODULE,
      label: action === "pdf" ? "Gerar PDF" : action,
      description: action === "pdf" ? "Acao disponivel para gerar documento da solicitacao." : "Acao operacional disponivel na tela de solicitacoes.",
      status: action === "visualizar" || action === "pdf" ? "ok" : "pending",
      size: "sm",
      missingKnowledge: !["visualizar", "pdf"].includes(action) ? ["Confirmacao obrigatoria antes da execucao."] : [],
      metadata: { requiresConfirmation: !["visualizar", "pdf"].includes(action) },
    });
    addEdge(edges, {
      id: `${requestId}-action-${actionNodeId}`,
      source: `access_request:${requestId}`,
      target: actionNodeId,
      label: "permite acao",
      type: "action",
    });
  }
}

export function buildAccessRequestsBrainGraph(input: BrainGraphBuildInput): BuiltBrainGraph {
  const nodes: BrainNode[] = [];
  const edges: BrainEdge[] = [];
  const requests = input.requests;
  const realNodes = input.realBrainNodes ?? [];
  const realEdges = input.realBrainEdges ?? [];
  const auditLogs = input.auditLogs ?? [];
  const removalHistory = input.removalHistory ?? [];

  addNode(nodes, {
    id: "screen:access-requests",
    type: "screen",
    module: ACCESS_REQUESTS_MODULE,
    label: "Solicitacoes de acesso",
    description: "Tela administrativa de revisao, PDF, ajuste, aprovacao, recusa e remocao.",
    status: "ok",
    size: "lg",
    information: "A tela de solicitacoes organiza pedidos, solicitantes, perfis, status, logs, e-mails e decisoes.",
    metadata: { route: "/admin/access-requests" },
  });

  const permissionNodeId = "permission:access-requests-reviewer";
  addNode(nodes, {
    id: permissionNodeId,
    type: "permission",
    module: "Permissoes",
    label: "Permissao de revisao de solicitacoes",
    description: "Define quem pode visualizar, baixar PDF, solicitar ajuste, aprovar, recusar ou remover.",
    status: "pending",
    size: "md",
    missingKnowledge: ["Mapear politicas efetivas por perfil e empresa."],
    metadata: { module: "access_requests", source: "permissoes efetivas do usuario" },
  });

  for (const request of requests) {
    const hasRealNode = requestHasRealNode(request, realNodes);
    const requestNodeId = `access_request:${request.id}`;
    const requesterNodeId = makeStableId("requester", request.email || request.name);
    const profileNodeId = makeStableId("profile", request.accessType);
    const statusNodeId = makeStableId("status", request.status || request.statusLabel);
    const requestLogs = auditLogsForRequest(auditLogs, request);
    const hasAdjustment = request.status === "in_progress" || Boolean(request.adjustmentRound) || Boolean(request.lastAdjustmentAt);
    const hasDecision = request.status === "closed" || request.status === "rejected" || requestLogs.some((log) => /accepted|rejected/.test(log.action));

    addNode(nodes, {
      id: requestNodeId,
      type: "access_request",
      module: ACCESS_REQUESTS_MODULE,
      label: request.name || request.email || `Solicitacao ${request.id}`,
      description: hasRealNode
        ? "Solicitacao carregada e com no correspondente no Brain real."
        : "Solicitacao carregada, mas ainda sem no real registrado no Brain.",
      status: mapRequestStatusToNodeStatus(request, hasRealNode),
      size: "lg",
      information: `${request.name || request.email || "A solicitacao"} pediu o perfil ${request.accessType || "nao informado"}, esta com status ${statusLabel(request.status)} e pertence ao modulo Solicitacoes.`,
      missingKnowledge: hasRealNode ? [] : ["Registrar no real desta solicitacao no Brain."],
      actions: ["Abrir modulo relacionado", "Explicar conexoes", "Revisar pendencias"],
      metadata: {
        requestId: request.id,
        email: request.email,
        status: request.status,
        statusLabel: request.statusLabel,
        accessType: request.accessType,
        company: request.company,
        hasRealNode,
      },
    });

    addNode(nodes, {
      id: requesterNodeId,
      type: "requester",
      module: "Usuarios",
      label: request.name || request.email || "Solicitante nao identificado",
      description: request.email ? `Solicitante vinculado ao e-mail ${request.email}.` : "Solicitante sem e-mail estruturado.",
      status: request.email ? "ok" : "warning",
      size: "md",
      metadata: { email: request.email },
    });

    addNode(nodes, {
      id: profileNodeId,
      type: "profile",
      module: "Usuarios",
      label: request.accessType || "Perfil nao informado",
      description: "Perfil solicitado na criacao ou ajuste da conta.",
      status: request.accessType ? "ok" : "warning",
      size: "md",
      metadata: { accessType: request.accessType },
    });

    addNode(nodes, {
      id: statusNodeId,
      type: "status",
      module: ACCESS_REQUESTS_MODULE,
      label: statusLabel(request.status),
      description: "Estado atual da solicitacao na fila administrativa.",
      status: "ok",
      size: "sm",
      metadata: { status: request.status },
    });

    addEdge(edges, { id: `screen-contains-${request.id}`, source: "screen:access-requests", target: requestNodeId, label: "contem", type: "contains", status: "ok" });
    addEdge(edges, { id: `${request.id}-requester`, source: requestNodeId, target: requesterNodeId, label: "foi aberto por", type: "created_by", status: request.email ? "ok" : "warning" });
    addEdge(edges, { id: `${request.id}-profile`, source: requestNodeId, target: profileNodeId, label: "pede perfil", type: "belongs_to", status: request.accessType ? "ok" : "warning" });
    addEdge(edges, { id: `${request.id}-status`, source: requestNodeId, target: statusNodeId, label: "esta com status", type: "has_status", status: "ok" });
    addEdge(edges, { id: `${request.id}-permission`, source: profileNodeId, target: permissionNodeId, label: "depende de permissao", type: "permission" });

    if (hasDecision) {
      const decisionNodeId = `decision:${request.id}`;
      const decisionLog = requestLogs.find((log) => /accepted|rejected/.test(log.action));
      addNode(nodes, {
        id: decisionNodeId,
        type: "decision",
        module: ACCESS_REQUESTS_MODULE,
        label: request.status === "closed" ? "Decisao: aprovada" : request.status === "rejected" ? "Decisao: recusada" : "Decisao registrada",
        description: decisionLog
          ? `Decisao encontrada em audit log: ${actionFromLog(decisionLog)} em ${formatDateTime(decisionLog.created_at)}.`
          : "Decisao inferida pelo status atual. Historico detalhado depende de log real.",
        status: decisionLog ? "ok" : "warning",
        size: "sm",
        missingKnowledge: decisionLog ? [] : ["Vincular audit log da decisao."],
        metadata: { requestId: request.id, inferredFromStatus: !decisionLog, auditLogId: decisionLog?.id },
      });
      addEdge(edges, { id: `${request.id}-decision`, source: requestNodeId, target: decisionNodeId, label: "possui decisao", type: "generates", status: decisionLog ? "ok" : "warning" });
    }

    if (hasAdjustment) {
      const adjustmentNodeId = `adjustment:${request.id}`;
      addNode(nodes, {
        id: adjustmentNodeId,
        type: "adjustment",
        module: ACCESS_REQUESTS_MODULE,
        label: "Ajuste solicitado",
        description: request.lastAdjustmentAt ? `Ultimo ajuste em ${formatDateTime(request.lastAdjustmentAt)}.` : "Ajuste inferido pelo estado da solicitacao.",
        status: request.lastAdjustmentAt ? "ok" : "warning",
        size: "sm",
        metadata: { requestId: request.id, adjustmentRound: request.adjustmentRound, changedFields: request.lastAdjustmentDiffCount },
      });
      addEdge(edges, { id: `${request.id}-adjustment`, source: requestNodeId, target: adjustmentNodeId, label: "possui ajuste", type: "history" });
    }

    addActionNodes(edges, nodes, request.id);

    const logNodeId = `log:${request.id}`;
    addNode(nodes, {
      id: logNodeId,
      type: "log",
      module: "Logs",
      label: "Logs da solicitacao",
      description: requestLogs.length
        ? `${requestLogs.length} audit log(s) vinculado(s) a esta solicitacao.`
        : "Log real nao encontrado para esta visualizacao.",
      status: requestLogs.length ? "ok" : "missing",
      size: "sm",
      missingKnowledge: requestLogs.length ? [] : ["Vincular audit log real da solicitacao."],
      metadata: { requestId: request.id, auditLogIds: requestLogs.map((log) => log.id) },
    });
    addEdge(edges, { id: `${request.id}-log`, source: requestNodeId, target: logNodeId, label: requestLogs.length ? "possui log" : "deveria possuir log", type: "has_log", status: requestLogs.length ? "ok" : "missing" });

    const emailNodeId = `email:${request.id}`;
    addNode(nodes, {
      id: emailNodeId,
      type: "email",
      module: "Logs",
      label: "Historico de e-mail",
      description: "Historico de e-mail ainda nao vinculado ao grafo desta tela.",
      status: "pending",
      size: "sm",
      missingKnowledge: ["Integrar historico de e-mails ao grafo."],
      metadata: { requestId: request.id, integration: "pending" },
    });
    addEdge(edges, { id: `${request.id}-email`, source: requestNodeId, target: emailNodeId, label: "deveria vincular e-mail", type: "history" });
  }

  for (const historyItem of removalHistory) {
    const removedNodeId = `access_request:${historyItem.requestId}`;
    if (!nodes.some((node) => node.id === removedNodeId)) {
      addNode(nodes, {
        id: removedNodeId,
        type: "access_request",
        module: ACCESS_REQUESTS_MODULE,
        label: historyItem.requesterName || historyItem.requesterEmail || `Solicitacao removida ${historyItem.requestId}`,
        description: `Solicitacao removida em ${formatDateTime(historyItem.removedAt)}. Visivel apenas pelo historico de remocao.`,
        status: "warning",
        size: "lg",
        metadata: {
          requestId: historyItem.requestId,
          removedAt: historyItem.removedAt,
          removedByEmail: historyItem.removedByEmail,
          source: historyItem.source,
          hasRealNode: requestHasRealNode({ id: historyItem.requestId } as BrainAccessRequestRow, realNodes),
        },
      });
      addEdge(edges, { id: `screen-contains-removed-${historyItem.requestId}`, source: "screen:access-requests", target: removedNodeId, label: "historico removido", type: "history" });
    }

    const removalDecisionId = `decision:removed:${historyItem.requestId}`;
    addNode(nodes, {
      id: removalDecisionId,
      type: "decision",
      module: ACCESS_REQUESTS_MODULE,
      label: "Remocao registrada",
      description: `Removida por ${historyItem.removedByEmail || "usuario nao identificado"} em ${formatDateTime(historyItem.removedAt)}.`,
      status: "ok",
      size: "sm",
      metadata: historyItem as unknown as Record<string, unknown>,
    });
    addEdge(edges, { id: `removed-${historyItem.requestId}-decision`, source: removedNodeId, target: removalDecisionId, label: "possui remocao", type: "history" });
  }

  for (const realNode of realNodes) {
    const normalizedType = normalizeBrainText(realNode.type);
    if (!["accessrequest", "access_request", "solicitacao", "solicitacao_acesso"].includes(normalizedType)) continue;
    const id = `real:${realNode.id}`;
    addNode(nodes, {
      id,
      type: "access_request",
      module: ACCESS_REQUESTS_MODULE,
      label: realNode.label,
      description: realNode.description ?? "No real vindo da API do Brain.",
      status: "ok",
      size: "md",
      metadata: { realBrainNodeId: realNode.id, refId: realNode.refId, refType: realNode.refType },
    });
  }

  const uniqueNodes = uniqueById(nodes);
  const uniqueEdges = uniqueById(edges);
  const connected = new Set(uniqueEdges.flatMap((edge) => [edge.source, edge.target]));
  const orphanNodes = uniqueNodes.filter((node) => !connected.has(node.id));
  const requestsWithoutNode = requests.filter((request) => !requestHasRealNode(request, realNodes));
  const logsLinked = uniqueNodes.filter((node) => node.type === "log" && node.status === "ok").length;
  const hasMissingLogs = uniqueNodes.some((node) => node.type === "log" && node.status === "missing");
  const hasPendingEmails = uniqueNodes.some((node) => node.type === "email" && node.status === "pending");

  const pendingMappings = [
    requestsWithoutNode.length ? `${requestsWithoutNode.length} solicitacao(oes) sem no real no Brain.` : "",
    hasMissingLogs ? "Logs reais de solicitacoes ainda ausentes ou sem permissao de leitura." : "",
    hasPendingEmails ? "Historico de e-mails ainda sem vinculo estruturado com o grafo." : "",
    uniqueNodes.some((node) => node.type === "action" && node.status === "pending") ? "Acoes sensiveis precisam confirmacao e permissao efetiva." : "",
    realEdges.length === 0 ? "Conexoes reais do Brain indisponiveis ou nao carregadas para este recorte." : "",
  ].filter(Boolean);

  const summary: BrainGraphSummary = {
    totalNodes: uniqueNodes.length,
    totalEdges: uniqueEdges.length,
    totalModules: new Set(uniqueNodes.map((node) => node.module)).size,
    accessRequestNodes: uniqueNodes.filter((node) => node.type === "access_request").length,
    requestsWithoutNode: requestsWithoutNode.length,
    orphanNodes: orphanNodes.length,
    logsLinked,
    pendingMappings,
  };

  return {
    nodes: uniqueNodes,
    edges: uniqueEdges,
    summary,
    requests,
    removalHistory,
    auditLogs,
  };
}
