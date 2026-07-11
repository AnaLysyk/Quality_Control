"use client";

import { parseAccessRequestMessage } from "@/lib/accessRequestMessage";
import { parsePasswordResetAccessRequestMessage } from "@/lib/passwordResetAccessQueue";
import { normalizeRequestProfileType, toRequestProfileTypeLabel } from "@/lib/requestRouting";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";
import { normalizeBrainText, statusLabel } from "../_utils/brainGraphFormatters";
import type {
  BrainAccessRequestRemovalHistoryItem,
  BrainAccessRequestRow,
  BrainAuditLogItem,
  BrainContextResponse,
  BrainEdge,
  BrainNode,
  BrainNodeStatus,
  BrainNodeType,
} from "../_types/brain.types";

type RawSupportRequest = {
  id: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
  admin_notes?: string | null;
};

type BrainGraphApiNode = {
  id: string;
  label: string;
  type: string;
  module?: string | null;
  status?: string | null;
  accessLevel?: "full" | "summary";
  companyId?: string | null;
  companySlug?: string | null;
  companyName?: string | null;
  projectId?: string | null;
  projectSlug?: string | null;
  projectName?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  source?: string | null;
  sourceType?: string | null;
  allowedActions?: string[];
  relatedMemoryCount?: number;
  relatedDocumentCount?: number;
  relatedLogCount?: number;
  relatedNodeCount?: number;
  tags?: string[];
  refType?: string | null;
  refId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
};

type BrainGraphApiEdge = {
  id: string;
  source: string;
  target: string;
  type?: string | null;
  weight?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | null;
};

const EDGE_TYPE_LABELS: Record<string, string> = {
  belongs_to_company: "pertence a",
  belongs_to_project: "pertence a",
  belongs_to_module: "pertence a",
  belongs_to: "pertence a",
  created_by: "criado por",
  generated_by: "gerado por",
  has_status: "esta com status",
  has_log: "possui log",
  has_comment: "possui comentario",
  has_document: "possui documento",
  has_email: "possui e-mail",
  has_pdf: "possui pdf",
  has_decision: "possui decisao",
  has_adjustment: "possui ajuste",
  depends_on: "depende de",
  mentions: "menciona",
  forms_information: "informa",
  permission_allows: "permite",
  permission_blocks: "bloqueia",
  permission: "depende de permissao",
  action: "permite acao",
  contains: "contem",
  generates: "gera",
  history: "possui historico",
  updated_by: "atualizado por",
  assigned_to: "atribuido a",
  executed_in: "executado em",
  found: "encontrou",
  related_to: "relacionado a",
  blocks: "bloqueia",
  has_evidence: "possui evidencia",
};

function edgeTypeToLabel(type: string | null | undefined): string {
  if (!type) return "relacionado a";
  const known = EDGE_TYPE_LABELS[type];
  if (known) return known;
  return type.replace(/_/g, " ");
}

type BrainGraphApiResponse = {
  nodes?: BrainGraphApiNode[];
  edges?: BrainGraphApiEdge[];
  root?: BrainGraphApiNode | null;
  filters?: Record<string, unknown>;
  access?: Record<string, unknown>;
  summary?: Record<string, unknown>;
  availableActions?: string[];
  error?: string;
};

type BrainDomainApiResponse = {
  nodes?: BrainNode[];
  edges?: BrainEdge[];
  error?: string;
};

type AccessRequestsApiResponse = {
  items?: RawSupportRequest[];
  error?: string;
};

type RemovalHistoryApiResponse = {
  items?: BrainAccessRequestRemovalHistoryItem[];
  error?: string;
};

type AuditLogsApiResponse = {
  items?: BrainAuditLogItem[];
  data?: { items?: BrainAuditLogItem[] };
  error?: string;
};

function getItemsFromEnvelope(value: unknown): RawSupportRequest[] {
  const data = unwrapEnvelopeData<AccessRequestsApiResponse>(value) ?? {};
  return Array.isArray(data.items) ? data.items : [];
}

function getRemovalHistoryFromEnvelope(value: unknown): BrainAccessRequestRemovalHistoryItem[] {
  const data = unwrapEnvelopeData<RemovalHistoryApiResponse>(value) ?? {};
  return Array.isArray(data.items) ? data.items : [];
}

function getAuditLogsFromEnvelope(value: unknown): BrainAuditLogItem[] {
  const data = unwrapEnvelopeData<AuditLogsApiResponse>(value) ?? {};
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data?.items)) return data.data.items;
  return [];
}

function mapRawAccessRequest(row: RawSupportRequest): BrainAccessRequestRow {
  const reset = parsePasswordResetAccessRequestMessage(row.message);
  if (reset) {
    const profileType = normalizeRequestProfileType(reset.profileType) ?? "testing_company_user";
    return {
      id: row.id,
      name: reset.userName || reset.userEmail || row.email,
      email: reset.userEmail || row.email,
      status: row.status,
      statusLabel: statusLabel(row.status),
      accessType: toRequestProfileTypeLabel(profileType),
      company: reset.companyName || "(nao informado)",
      createdAt: row.created_at,
      message: row.message,
      adminNotes: row.admin_notes ?? null,
      adjustmentRound: 0,
      lastAdjustmentAt: null,
      lastAdjustmentDiffCount: 0,
    };
  }

  const parsed = parseAccessRequestMessage(row.message, row.email);
  return {
    id: row.id,
    name: parsed.fullName || parsed.name || parsed.email || row.email,
    email: parsed.email || row.email,
    status: row.status,
    statusLabel: statusLabel(row.status),
    accessType: toRequestProfileTypeLabel(parsed.profileType),
    company: parsed.company || "(nao informado)",
    createdAt: row.created_at,
    message: row.message,
    adminNotes: row.admin_notes ?? null,
    adjustmentRound: parsed.adjustmentRound,
    lastAdjustmentAt: parsed.lastAdjustmentAt,
    lastAdjustmentDiffCount: parsed.lastAdjustmentDiff.length,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readFirst(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readText(metadata[key]);
    if (value) return value;
  }
  return null;
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(readText).filter((item): item is string => Boolean(item));
}

const NODE_TYPE_MAP: Record<string, BrainNodeType> = {
  company: "company",
  empresa: "company",
  project: "project",
  projeto: "project",
  user: "person",
  usuario: "person",
  person: "person",
  module: "module",
  modulo: "module",
  screen: "screen",
  route: "screen",
  permission: "permission",
  permissionmodule: "permission",
  permissionaction: "permission",
  log: "log",
  auditevent: "log",
  event: "event",
  document: "document",
  wikidoc: "document",
  companydocument: "document",
  defect: "defect",
  testrun: "execution",
  runmanagement: "execution",
  storedtestcase: "test_case",
  testcase: "test_case",
  brainmemory: "memory",
  memory: "memory",
  brainsource: "source",
  integration: "integration",
  automation: "automation",
  automationscript: "automation",
};

function normalizeNodeType(value: string): BrainNodeType {
  const normalized = normalizeBrainText(value).replace(/[^a-z0-9]/g, "");
  return NODE_TYPE_MAP[normalized] ?? "entity";
}

function normalizeNodeStatus(value: unknown): BrainNodeStatus {
  const normalized = normalizeBrainText(String(value ?? "ok"));
  if (["warning", "missing", "pending", "error", "orphan", "ok"].includes(normalized)) return normalized as BrainNodeStatus;
  if (["inactive", "archived", "blocked", "denied"].includes(normalized)) return "warning";
  return "ok";
}

// Automacao/caso de teste so pode aparecer como "ok" (finalizado) quando de fato
// estiver publicada/estavel. Antes disso (fila, rodando, rascunho) tem que mostrar
// um status intermediario, nunca "pronto" antes da hora.
function resolveTestCaseNodeStatus(metadata: Record<string, unknown>, fallbackStatus: unknown): BrainNodeStatus {
  const automationStatus = normalizeBrainText(String(metadata.automationStatus ?? ""));
  if (["stable", "published"].includes(automationStatus)) return "ok";
  if (["broken", "disabled"].includes(automationStatus)) return "error";
  if (["running", "review", "approved", "linked"].includes(automationStatus)) return "warning";
  if (["planned", "ai_generated", "pending"].includes(automationStatus)) return "pending";

  const rawStatus = normalizeBrainText(String(fallbackStatus ?? ""));
  if (rawStatus === "draft") return "pending";
  if (rawStatus === "obsolete" || rawStatus === "archived") return "warning";
  return "ok";
}

function mapGraphApiNode(node: BrainGraphApiNode): BrainNode {
  const metadata = asRecord(node.metadata);
  const moduleName =
    readText(node.module) ??
    readFirst(metadata, ["module", "moduleLabel", "moduleKey", "layer"]) ??
    node.type ??
    "Brain";

  return {
    id: node.id,
    type: normalizeNodeType(node.type),
    module: moduleName,
    companyId: readText(node.companyId) ?? readFirst(metadata, ["companyId", "clientId"]) ?? undefined,
    companySlug: readText(node.companySlug) ?? readFirst(metadata, ["companySlug", "clientSlug"]) ?? undefined,
    companyName: readText(node.companyName) ?? readFirst(metadata, ["companyName", "clientName"]) ?? undefined,
    projectId: readText(node.projectId) ?? readFirst(metadata, ["projectId"]) ?? undefined,
    projectSlug: readText(node.projectSlug) ?? readFirst(metadata, ["projectSlug", "projectCode"]) ?? undefined,
    projectName: readText(node.projectName) ?? readFirst(metadata, ["projectName"]) ?? undefined,
    label: node.label,
    description: node.description ?? undefined,
    status: /testcase/i.test(String(node.refType ?? node.type ?? ""))
      ? resolveTestCaseNodeStatus(metadata, node.status ?? metadata.status)
      : normalizeNodeStatus(node.status ?? metadata.status),
    accessLevel: node.accessLevel,
    size: node.type === "Company" || node.type === "Project" ? "lg" : "md",
    information: node.description ?? readFirst(metadata, ["screenSummary", "information", "summary"]) ?? undefined,
    createdBy: readText(node.createdBy) ?? readFirst(metadata, ["createdBy", "actorUserId", "userId"]) ?? undefined,
    createdByName: readText(node.createdByName) ?? readFirst(metadata, ["createdByName", "actorName", "email"]) ?? undefined,
    createdAt: readText(node.createdAt) ?? readFirst(metadata, ["createdAt"]) ?? undefined,
    updatedBy: readText(node.updatedBy) ?? readFirst(metadata, ["updatedBy"]) ?? undefined,
    updatedAt: readText(node.updatedAt) ?? readFirst(metadata, ["updatedAt"]) ?? undefined,
    generatedBy: "system",
    entityType: node.refType ?? readFirst(metadata, ["entityType"]) ?? undefined,
    entityId: node.refId ?? readFirst(metadata, ["entityId"]) ?? undefined,
    actions: node.allowedActions,
    tags: node.tags?.length ? node.tags : readStringList(metadata.tags),
    allowedActions: node.allowedActions,
    relatedMemoryCount: node.relatedMemoryCount ?? 0,
    relatedDocumentCount: node.relatedDocumentCount ?? 0,
    relatedLogCount: node.relatedLogCount ?? 0,
    relatedNodeCount: node.relatedNodeCount ?? 0,
    sourceType: node.sourceType ?? null,
    refType: node.refType ?? null,
    refId: node.refId ?? null,
    source: {
      type: node.sourceType ?? node.refType ?? undefined,
      route: readFirst(metadata, ["route", "path"]) ?? undefined,
      provider: readFirst(metadata, ["provider"]) ?? undefined,
    },
    metadata,
  };
}

function mapGraphApiEdge(edge: BrainGraphApiEdge): BrainEdge {
  const metadata = asRecord(edge.metadata);
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edgeTypeToLabel(edge.type),
    type: (edge.type as BrainEdge["type"]) ?? "relation",
    status: normalizeNodeStatus(readFirst(metadata, ["status"]) ?? undefined),
    companyId: readFirst(metadata, ["companyId", "clientId"]) ?? undefined,
    projectId: readFirst(metadata, ["projectId"]) ?? undefined,
    module: readFirst(metadata, ["module", "moduleId"]) ?? undefined,
    metadata: {
      ...metadata,
      weight: edge.weight ?? undefined,
      createdAt: edge.createdAt ?? undefined,
    },
  };
}

async function fetchJson<T>(url: string, timeoutMs = 45000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { credentials: "include", cache: "no-store", signal: controller.signal });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof json?.error === "string" ? json.error : typeof json?.message === "string" ? json.message : `Falha ao buscar ${url}`;
      throw new Error(message);
    }
    return json as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Tempo esgotado ao buscar ${url}. Usando dados iniciais disponiveis.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchBrainGraphForDashboard() {
  const graph = await fetchJson<BrainGraphApiResponse>("/api/brain/graph?depth=2");
  return {
    nodes: Array.isArray(graph.nodes) ? graph.nodes.map(mapGraphApiNode) : [],
    edges: Array.isArray(graph.edges) ? graph.edges.map(mapGraphApiEdge) : [],
    filters: graph.filters ?? {},
    access: graph.access ?? {},
    summary: graph.summary ?? {},
  };
}

export async function fetchBrainDomainGraphForDashboard() {
  const graph = await fetchJson<BrainDomainApiResponse>("/api/brain/domain", 45000);
  return {
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
  };
}

export async function fetchBrainContextForDashboard() {
  return fetchJson<BrainContextResponse>("/api/brain/context");
}

export async function fetchAccessRequestsForBrainDashboard() {
  const json = await fetchJson<AccessRequestsApiResponse>("/api/admin/access-requests");
  return getItemsFromEnvelope(json).map(mapRawAccessRequest);
}

export async function fetchAccessRequestRemovalHistoryForBrainDashboard() {
  const json = await fetchJson<RemovalHistoryApiResponse>("/api/admin/access-requests/history");
  return getRemovalHistoryFromEnvelope(json);
}

export async function fetchAccessRequestAuditLogsForBrainDashboard() {
  const json = await fetchJson<AuditLogsApiResponse>("/api/admin/audit-logs?entityType=access_request&limit=100");
  return getAuditLogsFromEnvelope(json);
}

export async function fetchBrainDashboardData() {
  const [contextResult, graphResult, domainResult, requestsResult, removalHistoryResult, auditLogsResult] = await Promise.allSettled([
    fetchBrainContextForDashboard(),
    fetchBrainGraphForDashboard(),
    fetchBrainDomainGraphForDashboard(),
    fetchAccessRequestsForBrainDashboard(),
    fetchAccessRequestRemovalHistoryForBrainDashboard(),
    fetchAccessRequestAuditLogsForBrainDashboard(),
  ]);

  return {
    context: contextResult.status === "fulfilled" ? contextResult.value : null,
    graph: graphResult.status === "fulfilled" ? graphResult.value : { nodes: [], edges: [] },
    domainGraph: domainResult.status === "fulfilled" ? domainResult.value : { nodes: [], edges: [] },
    requests: requestsResult.status === "fulfilled" ? requestsResult.value : [],
    removalHistory: removalHistoryResult.status === "fulfilled" ? removalHistoryResult.value : [],
    auditLogs: auditLogsResult.status === "fulfilled" ? auditLogsResult.value : [],
    errors: [
      contextResult.status === "rejected" ? contextResult.reason instanceof Error ? contextResult.reason.message : "Erro ao carregar contexto" : "",
      graphResult.status === "rejected" ? graphResult.reason instanceof Error ? graphResult.reason.message : "Erro ao carregar grafo" : "",
      domainResult.status === "rejected" ? domainResult.reason instanceof Error ? domainResult.reason.message : "Erro ao carregar mapa completo do Brain" : "",
      requestsResult.status === "rejected" ? requestsResult.reason instanceof Error ? requestsResult.reason.message : "Erro ao carregar solicitacoes" : "",
      removalHistoryResult.status === "rejected" ? removalHistoryResult.reason instanceof Error ? removalHistoryResult.reason.message : "Historico de remocao indisponivel" : "",
      auditLogsResult.status === "rejected" ? auditLogsResult.reason instanceof Error ? `Audit logs pendentes: ${auditLogsResult.reason.message}` : "Audit logs pendentes" : "",
    ].filter(Boolean),
  };
}
