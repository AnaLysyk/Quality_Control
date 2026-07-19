import type { BrainEdge, BrainNode } from "@prisma/client";

export const BRAIN_SEARCH_SYNONYMS: Record<string, string[]> = {
  brain: ["brian", "cerebro", "memoria", "no", "node", "bolha", "grafo"],
  brian: ["brain", "cerebro", "memoria", "no", "node", "bolha", "grafo"],
  operations: ["operacional", "operacao", "operacoes", "painel operacional", "dashboard operacional"],
  operacional: ["operations", "operacao", "operacoes", "painel", "dashboard", "metricas"],
  permissions: ["permissoes", "acessos", "gestao de perfis", "perfil", "perfis"],
  permissoes: ["permissions", "acessos", "gestao de perfis", "perfil", "perfis"],
  qase: ["kase", "test runs", "runs qase", "casos qase", "suite qase"],
  kase: ["qase", "test runs", "runs qase", "casos qase", "suite qase"],
  jira: ["issue", "issues", "bug jira", "ticket externo", "sprint"],
};

export type BrainSearchIndexEntry = {
  nodeId: string;
  label: string;
  description?: string | null;
  type: string;
  moduleId?: string | null;
  route?: string | null;
  company?: string | null;
  project?: string | null;
  status?: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  aliases: string[];
  relatedLabels: string[];
  updatedAt?: string | null;
  accessCount?: number;
};

export type BrainSearchResult = BrainSearchIndexEntry & {
  score: number;
  matchedBy: string[];
};

type BrainSearchNodeLike = Pick<BrainNode, "id" | "type" | "label" | "description" | "refType" | "refId"> & {
  metadata?: unknown;
  updatedAt?: Date | string | null;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeBrainSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/_.:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => readString(item)).filter((item): item is string => Boolean(item));
}

export function expandBrainSearchTerms(query: string) {
  const normalized = normalizeBrainSearchText(query);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const expanded = new Set<string>([normalized, ...tokens]);

  for (const token of tokens) {
    const synonyms = BRAIN_SEARCH_SYNONYMS[token] ?? [];
    for (const synonym of synonyms) {
      expanded.add(normalizeBrainSearchText(synonym));
      for (const part of normalizeBrainSearchText(synonym).split(/\s+/)) {
        if (part) expanded.add(part);
      }
    }
  }

  return Array.from(expanded).filter(Boolean);
}

function inferTags(node: Omit<BrainSearchNodeLike, "updatedAt">) {
  const metadata = toRecord(node.metadata);
  const tags = new Set<string>([
    node.type,
    node.refType ?? "",
    readString(metadata.moduleId) ?? "",
    readString(metadata.module) ?? "",
    readString(metadata.route) ?? "",
    readString(metadata.routePath) ?? "",
    ...readStringArray(metadata.tags),
    ...readStringArray(metadata.aliases),
  ].filter(Boolean));

  const label = normalizeBrainSearchText(node.label);
  if (label.includes("operacional") || label.includes("operacoes")) {
    ["operacional", "operacao", "dashboard", "metricas", "painel", "empresa", "projeto"].forEach((tag) => tags.add(tag));
  }
  if (label.includes("permiss") || node.type.toLowerCase().includes("permission")) {
    ["permissoes", "acessos", "perfil", "perfis", "central de acessos"].forEach((tag) => tags.add(tag));
  }
  if (label.includes("qase") || label.includes("kase")) {
    ["qase", "kase", "integracao", "runs", "casos", "resultados"].forEach((tag) => tags.add(tag));
  }

  return Array.from(tags).map(normalizeBrainSearchText).filter(Boolean);
}

export function buildBrainSearchEntry(
  node: BrainSearchNodeLike,
  relatedLabels: string[] = [],
): BrainSearchIndexEntry {
  const metadata = toRecord(node.metadata);

  return {
    nodeId: node.id,
    label: node.label,
    description: node.description,
    type: node.type,
    moduleId: readString(metadata.moduleId) ?? readString(metadata.module) ?? node.refType ?? null,
    route: readString(metadata.route) ?? readString(metadata.routePath) ?? readString(metadata.path),
    company: readString(metadata.companyName) ?? readString(metadata.companySlug) ?? readString(metadata.companyId),
    project: readString(metadata.projectName) ?? readString(metadata.projectId),
    status: readString(metadata.status) ?? readString(metadata.lifecycle) ?? readString(metadata.lifecycleStatus),
    metadata,
    tags: inferTags(node),
    aliases: readStringArray(metadata.aliases).map(normalizeBrainSearchText),
    relatedLabels: relatedLabels.map(normalizeBrainSearchText).filter(Boolean),
    updatedAt: node.updatedAt instanceof Date ? node.updatedAt.toISOString() : readString(node.updatedAt),
    accessCount: typeof metadata.accessCount === "number" ? metadata.accessCount : 0,
  };
}

export function buildBrainSearchIndex(
  nodes: BrainSearchNodeLike[],
  edges: Array<Pick<BrainEdge, "fromId" | "toId">> = [],
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const relatedByNode = new Map<string, string[]>();

  for (const edge of edges) {
    const from = nodeById.get(edge.fromId);
    const to = nodeById.get(edge.toId);
    if (!from || !to) continue;
    relatedByNode.set(from.id, [...(relatedByNode.get(from.id) ?? []), to.label]);
    relatedByNode.set(to.id, [...(relatedByNode.get(to.id) ?? []), from.label]);
  }

  return nodes.map((node) => buildBrainSearchEntry(node, relatedByNode.get(node.id) ?? []));
}

function includesAny(haystack: string, terms: string[]) {
  return terms.some((term) => term && haystack.includes(term));
}

export function scoreBrainSearchEntry(
  entry: BrainSearchIndexEntry,
  query: string,
  options: { currentNodeId?: string | null; currentModuleId?: string | null } = {},
) {
  const normalizedQuery = normalizeBrainSearchText(query);
  const terms = expandBrainSearchTerms(query);
  if (!normalizedQuery && terms.length === 0) return { score: 0, matchedBy: [] };

  const label = normalizeBrainSearchText(entry.label);
  const aliases = entry.aliases.join(" ");
  const tags = entry.tags.join(" ");
  const route = normalizeBrainSearchText(entry.route);
  const description = normalizeBrainSearchText(entry.description);
  const related = entry.relatedLabels.join(" ");
  const type = normalizeBrainSearchText(entry.type);
  const moduleId = normalizeBrainSearchText(entry.moduleId);
  const metadata = normalizeBrainSearchText(JSON.stringify(entry.metadata ?? {}));
  const matchedBy: string[] = [];
  let score = 0;

  if (label === normalizedQuery) {
    score += 120;
    matchedBy.push("label_exact");
  } else if (includesAny(label, terms)) {
    score += 90;
    matchedBy.push("label");
  }
  if (includesAny(aliases, terms)) {
    score += 75;
    matchedBy.push("alias");
  }
  if (includesAny(tags, terms)) {
    score += 70;
    matchedBy.push("tag");
  }
  if (includesAny(route, terms)) {
    score += 55;
    matchedBy.push("route");
  }
  if (includesAny(description, terms)) {
    score += 40;
    matchedBy.push("description");
  }
  if (includesAny(related, terms)) {
    score += 28;
    matchedBy.push("relation");
  }
  if (includesAny(type, terms) || includesAny(moduleId, terms)) {
    score += 22;
    matchedBy.push("type");
  }
  if (includesAny(metadata, terms)) {
    score += 10;
    matchedBy.push("metadata");
  }

  if (options.currentNodeId && entry.nodeId === options.currentNodeId) score += 20;
  if (options.currentModuleId && entry.moduleId === options.currentModuleId) score += 12;
  if (entry.updatedAt) score += Math.max(0, 8 - Math.floor((Date.now() - Date.parse(entry.updatedAt)) / 86_400_000));
  if (entry.accessCount) score += Math.min(10, entry.accessCount);

  return { score, matchedBy };
}

export function searchBrainIndex(
  entries: BrainSearchIndexEntry[],
  query: string,
  options: { limit?: number; currentNodeId?: string | null; currentModuleId?: string | null } = {},
): BrainSearchResult[] {
  const limit = Math.min(50, Math.max(1, options.limit ?? 10));
  return entries
    .map((entry) => {
      const scored = scoreBrainSearchEntry(entry, query, options);
      return { ...entry, ...scored };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label, "pt-BR"))
    .slice(0, limit);
}
