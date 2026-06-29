"use client";

import { parseAccessRequestMessage } from "@/lib/accessRequestMessage";
import { parsePasswordResetAccessRequestMessage } from "@/lib/passwordResetAccessQueue";
import { normalizeRequestProfileType, toRequestProfileTypeLabel } from "@/lib/requestRouting";
import { unwrapEnvelopeData } from "@/lib/apiEnvelope";
import { statusLabel } from "../_utils/brainGraphFormatters";
import type {
  BrainAccessRequestRemovalHistoryItem,
  BrainAccessRequestRow,
  BrainAuditLogItem,
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
};

type BrainGraphApiResponse = {
  nodes?: BrainGraphApiNode[];
  edges?: BrainGraphApiEdge[];
  root?: BrainGraphApiNode | null;
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

async function fetchJson<T>(url: string, timeoutMs = 8500): Promise<T> {
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
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
  };
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
  const [graphResult, requestsResult, removalHistoryResult, auditLogsResult] = await Promise.allSettled([
    fetchBrainGraphForDashboard(),
    fetchAccessRequestsForBrainDashboard(),
    fetchAccessRequestRemovalHistoryForBrainDashboard(),
    fetchAccessRequestAuditLogsForBrainDashboard(),
  ]);

  return {
    graph: graphResult.status === "fulfilled" ? graphResult.value : { nodes: [], edges: [] },
    requests: requestsResult.status === "fulfilled" ? requestsResult.value : [],
    removalHistory: removalHistoryResult.status === "fulfilled" ? removalHistoryResult.value : [],
    auditLogs: auditLogsResult.status === "fulfilled" ? auditLogsResult.value : [],
    errors: [
      graphResult.status === "rejected" ? graphResult.reason instanceof Error ? graphResult.reason.message : "Erro ao carregar grafo" : "",
      requestsResult.status === "rejected" ? requestsResult.reason instanceof Error ? requestsResult.reason.message : "Erro ao carregar solicitacoes" : "",
      removalHistoryResult.status === "rejected" ? removalHistoryResult.reason instanceof Error ? removalHistoryResult.reason.message : "Historico de remocao indisponivel" : "",
      auditLogsResult.status === "rejected" ? auditLogsResult.reason instanceof Error ? `Audit logs pendentes: ${auditLogsResult.reason.message}` : "Audit logs pendentes" : "",
    ].filter(Boolean),
  };
}
