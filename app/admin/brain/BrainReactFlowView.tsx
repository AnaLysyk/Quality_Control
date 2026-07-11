"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { FiCommand, FiGitBranch, FiList, FiMessageCircle, FiShare2, FiTable, FiUsers } from "react-icons/fi";

import { useBrainGraph } from "@/hooks/useBrain";
import { BRAIN_GRAPH_NODE_COLORS, getBrainGraphNodeDefinition } from "@/lib/brain/graph";
import styles from "./Brain.module.css";

type BrainNodeApi = {
  id: string;
  label: string;
  type: string;
  refType?: string | null;
  refId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type BrainEdgeApi = {
  id: string;
  source: string;
  target: string;
  type: string;
};

type BrainNodeDetails = {
  node?: BrainNodeApi;
  outgoing?: Array<{ id: string; fromId: string; toId: string; type: string }>;
  incoming?: Array<{ id: string; fromId: string; toId: string; type: string }>;
  neighbors?: BrainNodeApi[];
};

type BrainNeighborhood = {
  nodes: BrainNodeApi[];
  edges: BrainEdgeApi[];
};

type BrainSearchData = {
  companies?: Array<{ id: string; label: string }>;
  projects?: Array<{ id: string; label: string }>;
  types?: string[];
  statuses?: string[];
  nodes?: BrainNodeApi[];
};

type CommunityItem = {
  communityId: string;
  size: number;
  labels: string[];
  dominantTypes: Array<{ type: string; count: number }>;
};

type PendingData = {
  pending?: {
    suggestedRelations?: number;
    possibleDuplicates?: number;
    orphanNodes?: number;
    staleMemories?: number;
    failedEvents?: number;
    inboxPending?: number;
  };
  sampleSuggestions?: Array<{ id: string; title: string; description: string; type: string; confidence: number }>;
  inboxItems?: Array<{ id: string; title: string; summary?: string | null; kind: string; status: string }>;
};

type ReplayData = {
  replay: Array<{ step: number; action: string; entityType: string; entityLabel?: string | null; timestamp: string }>;
  currentState: { nodeCount: number; edgeCount: number };
  history: { firstEventAt?: string | null; lastEventAt?: string | null };
};

type CommandResult = {
  ok: boolean;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  result?: unknown;
  error?: string;
};

type ProviderId = "groq" | "gemini" | "openrouter";

type ProviderConfig = {
  provider: ProviderId;
  enabled: boolean;
  model: string | null;
  models: string[];
  priority: number;
  dailyRequestLimit: number | null;
  dailyTokenLimit: number | null;
  strictFreeModels: boolean;
  timeoutMs: number | null;
  maxOutputTokens: number | null;
};

type ProviderPayload = {
  configs: ProviderConfig[];
  keyStatus: Record<ProviderId, { configured: boolean }>;
};

const PROVIDER_IDS: ProviderId[] = ["groq", "gemini", "openrouter"];

const PROVIDER_LABELS: Record<ProviderId, string> = {
  groq: "Groq",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

const EMPTY_PROVIDER_KEY_STATUS: ProviderPayload["keyStatus"] = {
  groq: { configured: false },
  gemini: { configured: false },
  openrouter: { configured: false },
};

const PROVIDER_NODE_PREFIX = "ai-provider:";

function providerNodeId(provider: ProviderId) {
  return `${PROVIDER_NODE_PREFIX}${provider}`;
}

function isProviderNodeId(id: string | null): id is string {
  return typeof id === "string" && id.startsWith(PROVIDER_NODE_PREFIX);
}

function providerIdFromNodeId(id: string): ProviderId | null {
  const raw = id.slice(PROVIDER_NODE_PREFIX.length);
  return (PROVIDER_IDS as string[]).includes(raw) ? (raw as ProviderId) : null;
}

async function fetchProviderJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha na requisicao");
  return json as T;
}

function toOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function splitModels(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

function numberValue(value: number | null) {
  return value === null || value === undefined ? "" : String(value);
}

const fetcher = (url: string) =>
  fetch(url, { credentials: "include" }).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  });

const NODE_COLORS: Record<string, string> = BRAIN_GRAPH_NODE_COLORS;

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readFirstText(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readText(metadata[key]);
    if (value) return value;
  }
  return null;
}

function formatDetailDate(value: unknown) {
  const raw = value instanceof Date ? value.toISOString() : readText(value);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function readTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => readText(item)).filter((item): item is string => Boolean(item)).slice(0, 8);
}

const SENSITIVE_METADATA_KEYS = [
  "password",
  "senha",
  "token",
  "secret",
  "apiKey",
  "api_key",
  "credential",
  "credentials",
  "authorization",
  "cookie",
  "session",
  "hash",
  "privateKey",
  "private_key",
  "database_url",
  "connectionString",
  "smtp",
];

function isSensitiveMetadataKey(key: string) {
  const normalized = key.trim().toLowerCase();
  return SENSITIVE_METADATA_KEYS.some((pattern) => normalized.includes(pattern.toLowerCase()));
}

function sanitizeMetadataValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (isSensitiveMetadataKey(key)) return "[REDACTED]";
  if (typeof value === "string") return value.length > 240 ? `${value.slice(0, 240)}...` : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadataValue(key, item));
  if (value && typeof value === "object") return sanitizeClientMetadata(value);
  return value;
}

function sanitizeClientMetadata(value: unknown): Record<string, unknown> {
  const record = toRecord(value);
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, sanitizeMetadataValue(key, item)]),
  );
}

function countByType(items: Array<{ type: string }>) {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "pt-BR"))
    .slice(0, 5)
    .map(([type, count]) => `${type} (${count})`);
}

function resolveNodePosition(node: BrainNodeApi, index: number, total: number) {
  const metadata = toRecord(node.metadata);
  const position = toRecord(metadata.position);
  const x = Number(position.x);
  const y = Number(position.y);
  if (Number.isFinite(x) && Number.isFinite(y)) {
    return { x, y };
  }

  const angle = (Math.PI * 2 * index) / Math.max(total, 1);
  const radius = 280 + (index % 3) * 60;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

function mapGraphToFlow(nodes: BrainNodeApi[], edges: BrainEdgeApi[]) {
  const flowNodes: Node[] = nodes.map((node, index) => {
    const color = NODE_COLORS[node.type] ?? "#455a64";
    const nodeDefinition = getBrainGraphNodeDefinition(node.type);
    return {
      id: node.id,
      position: resolveNodePosition(node, index, nodes.length),
      data: {
        label: `${node.label}`,
        type: node.type,
        typeLabel: nodeDefinition?.label ?? node.type,
      },
      style: {
        borderRadius: 16,
        border: `2px solid ${color}`,
        background: "linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(248,251,255,0.94) 100%)",
        color: "#0f172a",
        boxShadow: `0 18px 42px rgba(1, 24, 72, 0.14), 0 0 0 5px ${color}14`,
        minWidth: 180,
        fontSize: 12,
        fontWeight: 600,
      },
    };
  });

  const flowEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    label: edge.type,
    style: {
      stroke: "#64748b",
      strokeWidth: 1.4,
    },
    labelStyle: {
      fill: "#334155",
      fontSize: 10,
    },
  }));

  return { flowNodes, flowEdges };
}

type ViewMode = "graph" | "list" | "table" | "tree" | "communities" | "pending" | "replay" | "agents";

export default function BrainReactFlowView() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rootNodeId, setRootNodeId] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("graph");
  const [commandInput, setCommandInput] = useState("");
  const [commandLog, setCommandLog] = useState<Array<{ id: string; role: "user" | "system"; text: string }>>([]);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<{ command: string } | null>(null);
  const [askAiLoading, setAskAiLoading] = useState(false);
  const [askAiError, setAskAiError] = useState<string | null>(null);

  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([]);
  const [providerKeyStatus, setProviderKeyStatus] = useState<ProviderPayload["keyStatus"]>(EMPTY_PROVIDER_KEY_STATUS);
  const [providerLoading, setProviderLoading] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerFeedback, setProviderFeedback] = useState<string | null>(null);

  const loadProviderConfigs = useCallback(async () => {
    setProviderLoading(true);
    setProviderError(null);
    try {
      const payload = await fetchProviderJson<ProviderPayload>("/api/admin/brain/provider-config");
      setProviderConfigs(payload.configs ?? []);
      setProviderKeyStatus(payload.keyStatus ?? EMPTY_PROVIDER_KEY_STATUS);
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "Erro ao carregar providers");
    } finally {
      setProviderLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviderConfigs();
  }, [loadProviderConfigs]);

  const updateProviderConfig = useCallback((provider: ProviderId, patch: Partial<ProviderConfig>) => {
    setProviderConfigs((current) =>
      current.map((config) => (config.provider === provider ? { ...config, ...patch } : config)),
    );
  }, []);

  const saveProviderConfigs = useCallback(async () => {
    setProviderSaving(true);
    setProviderError(null);
    setProviderFeedback(null);
    try {
      const payload = await fetchProviderJson<ProviderPayload>("/api/admin/brain/provider-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs: providerConfigs }),
      });
      setProviderConfigs(payload.configs ?? []);
      setProviderKeyStatus(payload.keyStatus ?? EMPTY_PROVIDER_KEY_STATUS);
      setProviderFeedback("Configuracao salva.");
    } catch (err) {
      setProviderError(err instanceof Error ? err.message : "Erro ao salvar configuracao");
    } finally {
      setProviderSaving(false);
    }
  }, [providerConfigs]);

  const providerNodesApi: BrainNodeApi[] = useMemo(
    () =>
      PROVIDER_IDS.map((provider, index) => {
        const config = providerConfigs.find((item) => item.provider === provider) ?? null;
        return {
          id: providerNodeId(provider),
          label: PROVIDER_LABELS[provider],
          type: "AiProvider",
          description: config
            ? `${config.enabled ? "Ativo" : "Inativo"} • modelo ${config.model ?? "-"}`
            : "Carregando configuracao...",
          metadata: { position: { x: -620, y: -240 + index * 180 } },
        };
      }),
    [providerConfigs],
  );

  const { data: graphData, isLoading } = useBrainGraph(rootNodeId, depth);

  const nodesApi: BrainNodeApi[] = useMemo(() => graphData?.nodes ?? [], [graphData?.nodes]);
  const edgesApi: BrainEdgeApi[] = useMemo(() => graphData?.edges ?? [], [graphData?.edges]);

  const hasBackendFilters = Boolean(
    search.trim() ||
    typeFilter !== "all" ||
    companyFilter !== "all" ||
    projectFilter !== "all" ||
    statusFilter !== "all",
  );

  const brainSearchKey = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "250");
    if (search.trim()) params.set("q", search.trim());
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (companyFilter !== "all") params.set("companySlug", companyFilter);
    if (projectFilter !== "all") params.set("projectId", projectFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    return `/api/brain/search?${params.toString()}`;
  }, [companyFilter, projectFilter, search, statusFilter, typeFilter]);

  const { data: searchData } = useSWR<BrainSearchData>(brainSearchKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 6000,
  });

  const filteredNodes = useMemo(
    () => (hasBackendFilters ? searchData?.nodes ?? [] : nodesApi),
    [hasBackendFilters, nodesApi, searchData?.nodes],
  );

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);
  const filteredEdges = useMemo(
    () => edgesApi.filter((edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)),
    [edgesApi, filteredNodeIds],
  );

  const typeOptions = useMemo(() => {
    const sourceTypes = searchData?.types?.length ? searchData.types : nodesApi.map((node) => node.type);
    const types = Array.from(new Set(sourceTypes)).sort((left, right) =>
      left.localeCompare(right, "pt-BR"),
    );
    return ["all", ...types];
  }, [nodesApi, searchData?.types]);

  const companyOptions = useMemo(() => searchData?.companies ?? [], [searchData?.companies]);
  const projectOptions = useMemo(() => searchData?.projects ?? [], [searchData?.projects]);
  const statusOptions = useMemo(() => searchData?.statuses ?? [], [searchData?.statuses]);

  const mapped = useMemo(
    () => mapGraphToFlow([...filteredNodes, ...providerNodesApi], filteredEdges),
    [filteredNodes, filteredEdges, providerNodesApi],
  );
  const [nodes, setNodes, onNodesChangeBase] = useNodesState(mapped.flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(mapped.flowEdges);

  useEffect(() => {
    setNodes(mapped.flowNodes);
    setEdges(mapped.flowEdges);
  }, [mapped.flowNodes, mapped.flowEdges, setNodes, setEdges]);

  const positionTimersRef = useRef<Map<string, number>>(new Map());

  const persistNodePosition = useCallback(async (id: string, x: number, y: number) => {
    await fetch(`/api/brain/graph/node/${id}/position`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y }),
    });
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChangeBase(changes);

    for (const change of changes) {
      if (change.type !== "position" || !change.position || change.dragging) continue;
      if (isProviderNodeId(change.id)) continue;
      const timer = positionTimersRef.current.get(change.id);
      if (timer) window.clearTimeout(timer);
      const timeoutId = window.setTimeout(() => {
        persistNodePosition(change.id, change.position!.x, change.position!.y).catch(() => {});
      }, 300);
      positionTimersRef.current.set(change.id, timeoutId);
    }
  }, [onNodesChangeBase, persistNodePosition]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => addEdge({ ...connection, type: "smoothstep" }, current));
    },
    [setEdges],
  );

  const selectedProviderId = useMemo(
    () => (isProviderNodeId(selectedNodeId) ? providerIdFromNodeId(selectedNodeId) : null),
    [selectedNodeId],
  );

  const { data: nodeDetails } = useSWR<BrainNodeDetails>(
    selectedNodeId && !selectedProviderId ? `/api/brain/graph/node/${selectedNodeId}?depth=1` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: neighborhood } = useSWR<BrainNeighborhood>(
    selectedNodeId && !selectedProviderId ? `/api/brain/graph/node/${selectedNodeId}/neighborhood?depth=2` : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: communitiesData } = useSWR<{ communities: CommunityItem[] }>(
    viewMode === "communities" ? "/api/brain/graph/analytics?mode=communities&limit=60" : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: pendingData } = useSWR<PendingData>(
    viewMode === "pending" ? "/api/brain/pending" : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: replayData } = useSWR<ReplayData>(
    viewMode === "replay" && selectedNodeId
      ? `/api/brain/replay?rootNodeId=${encodeURIComponent(selectedNodeId)}&depth=2`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  const { data: commandCatalog } = useSWR<{ commands: Array<{ command: string; description: string; requiresConfirmation: boolean }> }>(
    "/api/brain/commands",
    fetcher,
    { revalidateOnFocus: false },
  );

  const submitCommand = useCallback(async (rawInput: string, confirmed = false) => {
    const input = rawInput.trim();
    if (!input) return;

    setCommandLog((current) => [
      ...current,
      { id: `${Date.now()}-${Math.random()}`, role: "user", text: input },
    ]);

    const response = await fetch("/api/brain/commands", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input, confirmed }),
    });
    const payload = (await response.json().catch(() => ({}))) as CommandResult;

    if (payload.requiresConfirmation && !confirmed) {
      setAwaitingConfirmation({ command: input });
      setCommandLog((current) => [
        ...current,
        {
          id: `${Date.now()}-${Math.random()}`,
          role: "system",
          text: payload.confirmationMessage ?? "Esse comando exige confirmação.",
        },
      ]);
      return;
    }

    setAwaitingConfirmation(null);
    setCommandLog((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        role: "system",
        text: payload.ok
          ? JSON.stringify(payload.result ?? { ok: true }, null, 2)
          : payload.error ?? "Falha ao executar comando.",
      },
    ]);
  }, []);

  const runCommand = useCallback(
    (rawInput: string, confirmed = false) => {
      submitCommand(rawInput, confirmed).catch((error) => {
        setCommandLog((current) => [
          ...current,
          {
            id: `${Date.now()}-${Math.random()}`,
            role: "system",
            text: error instanceof Error ? error.message : "Falha ao executar comando.",
          },
        ]);
      });
    },
    [submitCommand],
  );

  const visibleNodesSorted = useMemo(
    () => [...filteredNodes].sort((a, b) => a.label.localeCompare(b.label)),
    [filteredNodes],
  );

  const groupedTree = useMemo(() => {
    const map = new Map<string, BrainNodeApi[]>();
    for (const node of visibleNodesSorted) {
      const bucket = map.get(node.type) ?? [];
      bucket.push(node);
      map.set(node.type, bucket);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleNodesSorted]);

  useEffect(() => {
    setAskAiError(null);
  }, [selectedNodeId]);

  const selectedMetadata = useMemo(() => toRecord(nodeDetails?.node?.metadata), [nodeDetails?.node?.metadata]);
  const selectedTags = useMemo(() => readTags(selectedMetadata.tags), [selectedMetadata]);
  const selectedRelations = useMemo(
    () => countByType([...(nodeDetails?.outgoing ?? []), ...(nodeDetails?.incoming ?? [])]),
    [nodeDetails?.incoming, nodeDetails?.outgoing],
  );
  const selectedDetailRows = useMemo(() => {
    const node = nodeDetails?.node;
    if (!node) return [];
    return [
      ["Empresa", readFirstText(selectedMetadata, ["companyName", "companySlug", "companyId", "slug"])],
      ["Projeto", readFirstText(selectedMetadata, ["projectName", "projectId", "projectSlug", "projectCode"])],
      ["Status", readFirstText(selectedMetadata, ["status", "lifecycle", "lifecycleStatus"])],
      ["Criado em", formatDetailDate(selectedMetadata.createdAt ?? node.createdAt)],
      ["Atualizado em", formatDetailDate(selectedMetadata.updatedAt ?? node.updatedAt)],
      ["Criado por", readFirstText(selectedMetadata, ["createdByName", "createdBy", "ownerId"])],
      ["Origem", readFirstText(selectedMetadata, ["sourceType", "source"])],
      ["Ref", [node.refType, node.refId].filter(Boolean).join(" / ") || null],
      ["Conexões", String((nodeDetails?.outgoing?.length ?? 0) + (nodeDetails?.incoming?.length ?? 0))],
    ].filter((row): row is [string, string] => Boolean(row[1]));
  }, [nodeDetails?.incoming?.length, nodeDetails?.node, nodeDetails?.outgoing?.length, selectedMetadata]);

  const askAiAboutSelectedNode = useCallback(async () => {
    if (!selectedNodeId || askAiLoading) return;
    setAskAiLoading(true);
    setAskAiError(null);

    try {
      const response = await fetch("/api/brain/query/local", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: selectedNodeId,
          depth: 2,
          maxNodes: 60,
          maxMemories: 12,
          maxDocs: 8,
          maxEvents: 16,
        }),
      });
      const localContext = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok) {
        throw new Error(readText(localContext?.error) ?? `HTTP ${response.status}`);
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("assistant:open", {
            detail: {
              source: "brain",
              route: "/admin/brain",
              nodeId: selectedNodeId,
              nodeLabel: nodeDetails?.node?.label ?? selectedNodeId,
              nodeType: nodeDetails?.node?.type ?? undefined,
              entityType: nodeDetails?.node?.refType ?? nodeDetails?.node?.type ?? "BrainNode",
              entityId: nodeDetails?.node?.refId ?? selectedNodeId,
              agentMode: "qa",
              panelMode: "side",
              focusInput: true,
              initialMessage: `Analise o nó "${nodeDetails?.node?.label ?? selectedNodeId}" com o contexto local autorizado: resumo, conexões, impacto, riscos e próximos passos.`,
              metadata: {
                localContext,
                nodeMetadata: sanitizeClientMetadata(selectedMetadata),
              },
            },
          }),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao montar contexto local.";
      setAskAiError(message);
    } finally {
      setAskAiLoading(false);
    }
  }, [askAiLoading, nodeDetails?.node, selectedMetadata, selectedNodeId]);

  return (
    <div className={styles.reactFlowShell}>
      <div className={styles.reactFlowTopBar}>
        <div className="flex items-center gap-2">
          <span className={styles.pulseOrb} aria-hidden="true" />
          <div>
            <span className={styles.reactFlowEyebrow}>Brain Operacional</span>
            <p className={styles.reactFlowSubtitle}>Grafo vivo, agentes e contexto em tempo real</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar texto"
            className={styles.searchInput}
          />

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filtrar por tipo de no"
            title="Filtrar por tipo de no"
            className={styles.compactSelect}
          >
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "Todos os tipos" : type}
                {type !== "all" && getBrainGraphNodeDefinition(type)?.label ? ` (${getBrainGraphNodeDefinition(type)?.label})` : ""}
              </option>
            ))}
          </select>

          <select
            value={companyFilter}
            onChange={(event) => setCompanyFilter(event.target.value)}
            aria-label="Filtrar por empresa"
            title="Filtrar por empresa"
            className={styles.compactSelect}
          >
            <option value="all">Todas as empresas</option>
            {companyOptions.map((company) => (
              <option key={company.id} value={company.id}>
                {company.label}
              </option>
            ))}
          </select>

          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            aria-label="Filtrar por projeto"
            title="Filtrar por projeto"
            className={styles.compactSelect}
          >
            <option value="all">Todos os projetos</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label="Filtrar por status"
            title="Filtrar por status"
            className={styles.compactSelect}
          >
            <option value="all">Todos os status</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={String(depth)}
            onChange={(event) => setDepth(Number(event.target.value))}
            aria-label="Selecionar profundidade do grafo"
            title="Selecionar profundidade do grafo"
            className={styles.compactSelect}
          >
            <option value="1">Profundidade 1</option>
            <option value="2">Profundidade 2</option>
            <option value="3">Profundidade 3</option>
            <option value="4">Profundidade 4</option>
          </select>

          <div className={styles.viewTabs} role="tablist" aria-label="Modo de visualização do Brain">
            {([
              ["graph", "Grafo", FiShare2],
              ["list", "Lista", FiList],
              ["table", "Tabela", FiTable],
              ["tree", "Árvore", FiGitBranch],
              ["communities", "Comunidades", FiUsers],
              ["pending", "Pendências", FiCommand],
              ["replay", "Estado vs Histórico", FiCommand],
              ["agents", "Agentes", FiMessageCircle],
            ] as Array<[ViewMode, string, typeof FiList]>).map(([mode, label, Icon]) => (
              <button
                key={mode}
                role="tab"
                data-testid={mode === "agents" ? "brain-agents-tab" : undefined}
                aria-selected={viewMode === mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={viewMode === mode ? styles.filterBtnActive : styles.filterBtn}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.reactFlowStage}>
        {viewMode === "graph" ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_event, node) => setSelectedNodeId(node.id)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={1.6}
            proOptions={{ hideAttribution: true }}
            nodesFocusable
            edgesFocusable
          >
            <Background gap={22} size={1} color="rgba(1, 24, 72, 0.16)" />
            <MiniMap zoomable pannable nodeColor={(node) => NODE_COLORS[String(node.data?.type)] ?? "#475569"} />
            <Controls showInteractive={false} />
          </ReactFlow>
        ) : null}

        {viewMode === "list" ? (
          <div className="h-full overflow-auto p-4">
            <div className={styles.surfaceCard} role="region" aria-label="Lista de nós">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">Modo Lista</h2>
              <ul className="mt-3 space-y-2" role="list">
                {visibleNodesSorted.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(node.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover:bg-slate-100"
                    >
                      <span className="font-semibold text-slate-800">{node.label}</span>
                      <span className="text-xs text-slate-500">{node.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {viewMode === "table" ? (
          <div className="h-full overflow-auto p-4">
            <div className={styles.surfaceCard}>
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">Modo Tabela</h2>
              <table className="mt-3 w-full border-collapse text-sm" aria-label="Tabela de nós do Brain">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="border-b border-slate-200 py-2">Nome</th>
                    <th className="border-b border-slate-200 py-2">Tipo</th>
                    <th className="border-b border-slate-200 py-2">ID</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleNodesSorted.map((node) => (
                    <tr key={node.id} className="hover:bg-slate-50">
                      <td className="border-b border-slate-100 py-2 pr-3">
                        <button
                          type="button"
                          onClick={() => setSelectedNodeId(node.id)}
                          className="text-left font-semibold text-[#011848]"
                        >
                          {node.label}
                        </button>
                      </td>
                      <td className="border-b border-slate-100 py-2 pr-3">{node.type}</td>
                      <td className="border-b border-slate-100 py-2 pr-3 text-xs text-slate-500">{node.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {viewMode === "tree" ? (
          <div className="h-full overflow-auto p-4">
            <div className={styles.surfaceCard}>
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">Modo Árvore</h2>
              <div className="mt-3 space-y-3" role="tree" aria-label="Árvore de tipos e nós">
                {groupedTree.map(([type, typeNodes]) => (
                  <div key={type} role="treeitem" aria-expanded={true} aria-selected={false} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">{type}</p>
                    <ul className="mt-2 space-y-1 pl-3">
                      {typeNodes.map((node) => (
                        <li key={node.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedNodeId(node.id)}
                            className="text-left text-sm font-semibold text-[#011848] hover:underline"
                          >
                            {node.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {viewMode === "communities" ? (
          <div className="h-full overflow-auto p-4">
            <div className={styles.surfaceCard}>
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">Modo Comunidades</h2>
              <p className="mt-1 text-xs text-slate-500">Clusters conectados para análise de domínio e dependências.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {(communitiesData?.communities ?? []).map((community) => (
                  <article key={community.communityId} className={styles.miniCard}>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{community.communityId}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{community.size} nós</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Dominantes: {community.dominantTypes.map((item) => `${item.type} (${item.count})`).join(", ") || "-"}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">{community.labels.slice(0, 6).join(" • ")}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {viewMode === "pending" ? (
          <div className="h-full overflow-auto p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className={styles.surfaceCard}>
                <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">Pendências do Brain</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <StatPill label="Relações sugeridas" value={pendingData?.pending?.suggestedRelations ?? 0} />
                  <StatPill label="Duplicidades" value={pendingData?.pending?.possibleDuplicates ?? 0} />
                  <StatPill label="Nós órfãos" value={pendingData?.pending?.orphanNodes ?? 0} />
                  <StatPill label="Inbox pendente" value={pendingData?.pending?.inboxPending ?? 0} />
                </div>
                <div className="mt-4 space-y-2">
                  {(pendingData?.sampleSuggestions ?? []).map((item) => (
                    <article key={item.id} className={styles.miniCard}>
                      <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">{item.type}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{item.description}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className={styles.surfaceCard}>
                <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">Terminal de Comandos</h3>
                <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs">
                  {commandLog.length === 0 ? (
                    <p className="text-slate-500">Sem comandos executados.</p>
                  ) : (
                    commandLog.map((entry) => (
                      <p key={entry.id} className="mb-1 whitespace-pre-wrap">
                        <strong>{entry.role === "user" ? ">" : "brain"}</strong> {entry.text}
                      </p>
                    ))
                  )}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={commandInput}
                    onChange={(event) => setCommandInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        runCommand(commandInput);
                        setCommandInput("");
                      }
                    }}
                    placeholder="Digite /expandir TC-1042 depth=2"
                    className="h-9 flex-1 rounded-lg border border-slate-300 px-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      runCommand(commandInput);
                      setCommandInput("");
                    }}
                    className="rounded-lg bg-[#011848] px-3 text-xs font-semibold text-white"
                  >
                    Executar
                  </button>
                </div>
                {awaitingConfirmation ? (
                  <button
                    type="button"
                    onClick={() => runCommand(awaitingConfirmation.command, true)}
                    className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
                  >
                    Confirmar comando pendente
                  </button>
                ) : null}
                <div className="mt-3 rounded-xl border border-slate-200 p-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Comandos oficiais</p>
                  <ul className="mt-1 space-y-1 text-xs text-slate-600">
                    {(commandCatalog?.commands ?? []).slice(0, 8).map((item) => (
                      <li key={item.command}>{item.command} - {item.description}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {viewMode === "replay" ? (
          <div className="h-full overflow-auto p-4">
            <div className={styles.surfaceCard}>
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">Estado atual vs Histórico</h2>
              <p className="mt-1 text-xs text-slate-500">Selecione um nó e acompanhe trilha de eventos.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <StatPill label="Nós visíveis" value={replayData?.currentState?.nodeCount ?? 0} />
                <StatPill label="Arestas visíveis" value={replayData?.currentState?.edgeCount ?? 0} />
              </div>
              <div className="mt-3 space-y-2">
                {(replayData?.replay ?? []).slice(0, 80).map((entry) => (
                  <div key={`${entry.step}-${entry.timestamp}`} className={styles.timelineCard}>
                    <p className="font-semibold text-slate-800">#{entry.step} {entry.action}</p>
                    <p className="text-slate-600">{entry.entityType} {entry.entityLabel ? `- ${entry.entityLabel}` : ""}</p>
                    <p className="text-slate-500">{new Date(entry.timestamp).toLocaleString("pt-BR")}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {viewMode === "agents" ? (
          <div className={styles.agentStage}>
            <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
              <div className="text-center">
                <p className="text-lg font-black text-slate-200">Agentes Brain</p>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedNodeId
                    ? `Nó: ${nodeDetails?.node?.label ?? selectedNodeId} — escolha um agente`
                    : "Selecione um nó no grafo ou escolha um agente para começar"}
                </p>
              </div>
              <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                {[
                  { mode: "qa", icon: "ðŸ”", name: "QA Analyst", label: "Riscos e cobertura", borderCls: "border-[#5b92ff44]" },
                  { mode: "debug", icon: "ðŸ›", name: "Debug Agent", label: "Diagnóstico e causa raiz", borderCls: "border-[#f59e0b44]" },
                  { mode: "playwright", icon: "ðŸŽ­", name: "Playwright", label: "Specs e automação", borderCls: "border-[#10b98144]" },
                  { mode: "memory", icon: "ðŸ§ ", name: "Memory Agent", label: "Conhecimento e decisões", borderCls: "border-[#a78bfa44]" },
                ].map(({ mode, icon, name, label, borderCls }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("assistant:open", {
                            detail: {
                              source: "brain",
                              nodeId: selectedNodeId ?? undefined,
                              nodeLabel: nodeDetails?.node?.label ?? undefined,
                              nodeType: nodeDetails?.node?.type ?? undefined,
                              agentMode: mode,
                              panelMode: "side",
                              initialMessage: selectedNodeId
                                ? `Analise o nó "${nodeDetails?.node?.label ?? selectedNodeId}" com o agente ${name}.`
                                : undefined,
                            },
                          }),
                        );
                      }
                    }}
                    className={`flex flex-col items-start rounded-2xl border bg-white/4 p-4 text-left transition hover:bg-white/8 active:scale-[0.97] ${borderCls}`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="mt-2 text-sm font-bold text-slate-200">{name}</span>
                    <span className="mt-0.5 text-[11px] text-slate-400">{label}</span>
                  </button>
                ))}
              </div>
              <p className="text-center text-[11px] text-slate-500">
                Os agentes abrem no Assistente Flutuante (lateral)
              </p>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className={styles.loadingPill}>
            Carregando grafo...
          </div>
        ) : null}

        {selectedNodeId && viewMode === "graph" && selectedProviderId ? (
          <div className={styles.detailPanel}>
            <ProviderNodePanel
              providerId={selectedProviderId}
              config={providerConfigs.find((item) => item.provider === selectedProviderId) ?? null}
              configured={providerKeyStatus[selectedProviderId]?.configured ?? false}
              loading={providerLoading}
              saving={providerSaving}
              error={providerError}
              feedback={providerFeedback}
              onChange={(patch) => updateProviderConfig(selectedProviderId, patch)}
              onSave={() => void saveProviderConfigs()}
              onReload={() => void loadProviderConfigs()}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        ) : null}

        {selectedNodeId && viewMode === "graph" && !selectedProviderId ? (
          <div className={styles.detailPanel}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">No selecionado</p>
                <p className="text-sm font-bold text-slate-900">{nodeDetails?.node?.label ?? selectedNodeId}</p>
                <p className="text-xs text-slate-600">{nodeDetails?.node?.type ?? "-"}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                className={styles.panelAction}
              >
                Fechar
              </button>
            </div>

            {nodeDetails?.node?.description ? (
              <p className="mb-3 text-xs text-slate-700">{nodeDetails.node.description}</p>
            ) : null}

            {selectedDetailRows.length ? (
              <div className="mb-3 grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50/70 p-2 dark:border-white/10 dark:bg-white/5">
                {selectedDetailRows.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 text-[11px] leading-5">
                    <span className="font-semibold uppercase text-slate-500 dark:text-white/52">{label}</span>
                    <span className="min-w-0 break-words text-slate-700 dark:text-white/78">{value}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {selectedTags.length ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/70">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <button
                type="button"
                onClick={() => setRootNodeId(selectedNodeId)}
                className={styles.primaryPanelAction}
              >
                Centralizar
              </button>
              <div className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700">
                Out: {nodeDetails?.outgoing?.length ?? 0}
              </div>
              <div className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700">
                In: {nodeDetails?.incoming?.length ?? 0}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void askAiAboutSelectedNode()}
              disabled={askAiLoading}
              className="mb-3 w-full rounded-lg border border-[rgba(1,24,72,0.14)] bg-[linear-gradient(135deg,#011848_0%,#1f4aa3_100%)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
            >
              {askAiLoading ? "Montando contexto..." : "Perguntar IA sobre este nó"}
            </button>
            {askAiError ? (
              <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700">
                {askAiError}
              </p>
            ) : null}

            {selectedRelations.length ? (
              <div className="mb-3 rounded-xl border border-slate-200 p-2 dark:border-white/10">
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500 dark:text-white/52">Principais relações</p>
                <p className="text-xs text-slate-700 dark:text-white/72">{selectedRelations.join(" • ")}</p>
              </div>
            ) : null}

            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Vizinhanca</p>
              <div className="max-h-40 space-y-1 overflow-auto pr-1">
                {(neighborhood?.nodes ?? [])
                  .filter((item) => item.id !== selectedNodeId)
                  .slice(0, 12)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedNodeId(item.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                    >
                      <span className="truncate pr-2">{item.label}</span>
                      <span className="text-[10px] text-slate-500">{item.type}</span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className={styles.legendPanel}>
          <p className="font-semibold">Legenda Viva</p>
          <p>Azul empresa/usuário • Verde caso/plano/run • Roxo automação • Vermelho defeito/falha</p>
          <p>Linha cheia confirmada • Linha tracejada sugerida</p>
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.statPill}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#011848]">{value}</p>
    </div>
  );
}

type ProviderNodePanelProps = {
  providerId: ProviderId;
  config: ProviderConfig | null;
  configured: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  feedback: string | null;
  onChange: (patch: Partial<ProviderConfig>) => void;
  onSave: () => void;
  onReload: () => void;
  onClose: () => void;
};

function ProviderNodePanel({
  providerId,
  config,
  configured,
  loading,
  saving,
  error,
  feedback,
  onChange,
  onSave,
  onReload,
  onClose,
}: ProviderNodePanelProps) {
  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Provider de IA</p>
          <p className="text-sm font-bold text-slate-900">{PROVIDER_LABELS[providerId]}</p>
          <p className="text-xs text-slate-600">Chave: {configured ? "configurada" : "não configurada"}</p>
        </div>
        <button type="button" onClick={onClose} className={styles.panelAction}>
          Fechar
        </button>
      </div>

      {error ? (
        <p className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700">
          {feedback}
        </p>
      ) : null}

      {!config ? (
        <p className="text-xs text-slate-500">{loading ? "Carregando configuracao..." : "Configuracao indisponivel."}</p>
      ) : (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => onChange({ enabled: event.target.checked })}
            />
            Ativo
          </label>

          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Modelo principal
            <input
              value={config.model ?? ""}
              onChange={(event) => onChange({ model: event.target.value || null })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
            />
          </label>

          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Modelos fallback, separados por vírgula
            <input
              value={config.models.join(", ")}
              onChange={(event) => onChange({ models: splitModels(event.target.value) })}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
              Prioridade
              <input
                type="number"
                value={numberValue(config.priority)}
                onChange={(event) => onChange({ priority: toOptionalNumber(event.target.value) ?? 100 })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
              Timeout
              <input
                type="number"
                value={numberValue(config.timeoutMs)}
                onChange={(event) => onChange({ timeoutMs: toOptionalNumber(event.target.value) })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
              Limite diário de requests
              <input
                type="number"
                value={numberValue(config.dailyRequestLimit)}
                onChange={(event) => onChange({ dailyRequestLimit: toOptionalNumber(event.target.value) })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
              Limite diário de tokens
              <input
                type="number"
                value={numberValue(config.dailyTokenLimit)}
                onChange={(event) => onChange({ dailyTokenLimit: toOptionalNumber(event.target.value) })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
              />
            </label>
            <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
              Max output tokens
              <input
                type="number"
                value={numberValue(config.maxOutputTokens)}
                onChange={(event) => onChange({ maxOutputTokens: toOptionalNumber(event.target.value) })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none"
              />
            </label>
            <label className="flex items-center gap-2 pt-5 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={config.strictFreeModels}
                onChange={(event) => onChange({ strictFreeModels: event.target.checked })}
              />
              Strict free models
            </label>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || loading || !config}
          className={styles.primaryPanelAction}
        >
          {saving ? "Salvando..." : "Salvar configuração"}
        </button>
        <button type="button" onClick={onReload} disabled={loading || saving} className={styles.panelAction}>
          Recarregar
        </button>
      </div>
    </div>
  );
}
