import "server-only";

import { prisma } from "@/lib/prismaClient";
import {
  searchNodes,
  getNodeMemories,
  getNodeWithContext,
  getSubgraph,
  getGraphMetrics,
  getRelatedMemories,
  getNodeAncestors,
  getNodeDescendants,
  traceImpact,
  findSimilarNodes,
} from "@/lib/brain";
import { detectAgentMode } from "@/lib/brain/agents";
import type { AgentMode } from "@/lib/brain/agents";

// â”€â”€â”€ Snapshot de dados reais do sistema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TicketSnap = {
  id: string; code: string; title: string; status: string;
  priority: string; type: string; companySlug: string | null;
  createdByName: string | null; assignedToUserId: string | null;
  createdAt: Date; updatedAt: Date;
};
type ReleaseSnap = {
  id: string; slug: string; title: string; status: string;
  app: string | null; companySlug: string | null;
  statsPass: number; statsFail: number; statsBlocked: number; statsNotRun: number;
  createdAt: Date;
};
type AccessSnap = {
  id: string; name: string | null; email: string; jobRole: string | null;
  status: string; accessType: string; createdAt: Date;
};
type SupportSnap = {
  id: string; email: string; message: string; status: string; created_at: Date;
};
type CompanySnap = {
  id: string; name: string; slug: string; status: string; active: boolean;
  integration_mode: string | null; qase_project_code: string | null; qase_project_codes: string[];
};
type UserSnap = {
  id: string; name: string; email: string; user: string | null; role: string | null;
  status: string; active: boolean; globalRole: string | null; default_company_slug: string | null;
  user_origin: string; lastLoginAt: Date | null;
};
type ApplicationSnap = {
  id: string; name: string; slug: string; companyId: string | null; companySlug: string | null;
  qaseProjectCode: string | null; source: string | null; active: boolean; updatedAt: Date;
};
type IntegrationSnap = {
  id: string; companyId: string; type: string; config: unknown; createdAt: Date;
};
type ManualTestPlanSnap = {
  id: string; companySlug: string; applicationId: string; applicationName: string;
  applicationSlug: string; projectCode: string | null; title: string; updatedAt: Date;
};
type DefectSnap = {
  id: string; title: string; description: string | null; companyId: string; releaseManualId: string | null; updatedAt: Date;
};
type TestRunSnap = { id: string; status: string; createdAt: Date };
type QualityAlertSnap = {
  id: string; companySlug: string; type: string; severity: string; message: string; timestamp: Date;
};

export type SystemSnapshot = {
  companies?: CompanySnap[];
  users?: UserSnap[];
  applications?: ApplicationSnap[];
  integrations?: IntegrationSnap[];
  tickets: TicketSnap[];
  releases: ReleaseSnap[];
  manualTestPlans?: ManualTestPlanSnap[];
  defects?: DefectSnap[];
  testRuns?: TestRunSnap[];
  qualityAlerts?: QualityAlertSnap[];
  accessRequests: AccessSnap[];
  supportRequests: SupportSnap[];
  totalCompanies?: number;
  totalUsers?: number;
  totalApplications?: number;
  totalIntegrations?: number;
  totalTickets: number;
  openTickets: number;
  totalReleases: number;
  totalManualTestPlans?: number;
  totalDefects?: number;
  totalTestRuns?: number;
  totalQualityAlerts?: number;
  recentDefects: TicketSnap[];
  companySlug: string | null;
  loadedAt: number;
};

/** Carrega snapshot de todos os dados reais do sistema, filtrando por empresa quando disponÃ­vel */
async function loadSystemSnapshot(companySlug?: string | null): Promise<SystemSnapshot> {
  const companyFilter = companySlug ? { companySlug } : {};

  const [tickets, releases, accessRequests, supportRequests] = await Promise.all([
    prisma.ticket.findMany({
      where: companyFilter,
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true, code: true, title: true, status: true, priority: true,
        type: true, companySlug: true, createdByName: true,
        assignedToUserId: true, createdAt: true, updatedAt: true,
      },
    }).catch(() => [] as TicketSnap[]),

    prisma.release.findMany({
      where: companyFilter,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, slug: true, title: true, status: true, app: true,
        companySlug: true, statsPass: true, statsFail: true,
        statsBlocked: true, statsNotRun: true, createdAt: true,
      },
    }).catch(() => [] as ReleaseSnap[]),

    prisma.accessRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, name: true, email: true, jobRole: true,
        status: true, accessType: true, createdAt: true,
      },
    }).catch(() => [] as AccessSnap[]),

    prisma.supportRequest.findMany({
      orderBy: { created_at: "desc" },
      take: 20,
      select: {
        id: true, email: true, message: true, status: true, created_at: true,
      },
    }).catch(() => [] as SupportSnap[]),
  ]);

  const openTickets = tickets.filter((t) =>
    t.status === "backlog" || t.status === "open" || t.status === "in_progress" || t.status === "review",
  );
  const recentDefects = tickets.filter((t) => t.type === "bug" || t.type === "defect");

  return {
    tickets,
    releases,
    accessRequests,
    supportRequests,
    totalTickets: tickets.length,
    openTickets: openTickets.length,
    totalReleases: releases.length,
    recentDefects,
    companySlug: companySlug ?? null,
    loadedAt: Date.now(),
  };
}

async function loadRichSystemSnapshot(companySlug?: string | null): Promise<SystemSnapshot> {
  const base = await loadSystemSnapshot(companySlug);
  const companies = await prisma.company.findMany({
    where: companySlug ? { slug: companySlug } : undefined,
    orderBy: { updatedAt: "desc" },
    take: companySlug ? 1 : 30,
    select: {
      id: true, name: true, slug: true, status: true, active: true,
      integration_mode: true, qase_project_code: true, qase_project_codes: true,
    },
  }).catch(() => [] as CompanySnap[]);

  const companyIds = companies.map((company) => company.id);
  const scopedCompanyIds = companySlug && companyIds.length > 0 ? { in: companyIds } : undefined;
  const companyIdFilter = scopedCompanyIds ? { companyId: scopedCompanyIds } : {};

  const [
    users,
    applications,
    integrations,
    manualTestPlans,
    defects,
    testRuns,
    qualityAlerts,
  ] = await Promise.all([
    prisma.user.findMany({
      where: scopedCompanyIds ? { memberships: { some: { companyId: scopedCompanyIds } } } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 40,
      select: {
        id: true, name: true, email: true, user: true, role: true,
        status: true, active: true, globalRole: true, default_company_slug: true,
        user_origin: true, lastLoginAt: true,
      },
    }).catch(() => [] as UserSnap[]),
    prisma.application.findMany({
      where: companySlug ? { OR: [{ companySlug }, companyIdFilter] } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true, name: true, slug: true, companyId: true, companySlug: true,
        qaseProjectCode: true, source: true, active: true, updatedAt: true,
      },
    }).catch(() => [] as ApplicationSnap[]),
    prisma.companyIntegration.findMany({
      where: scopedCompanyIds ? { companyId: scopedCompanyIds } : undefined,
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, companyId: true, type: true, config: true, createdAt: true },
    }).catch(() => [] as IntegrationSnap[]),
    prisma.manualTestPlan.findMany({
      where: companySlug ? { companySlug } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true, companySlug: true, applicationId: true, applicationName: true,
        applicationSlug: true, projectCode: true, title: true, updatedAt: true,
      },
    }).catch(() => [] as ManualTestPlanSnap[]),
    prisma.defect.findMany({
      where: scopedCompanyIds ? { companyId: scopedCompanyIds } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { id: true, title: true, description: true, companyId: true, releaseManualId: true, updatedAt: true },
    }).catch(() => [] as DefectSnap[]),
    prisma.testRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, status: true, createdAt: true },
    }).catch(() => [] as TestRunSnap[]),
    prisma.qualityAlert.findMany({
      where: companySlug ? { companySlug } : undefined,
      orderBy: { timestamp: "desc" },
      take: 30,
      select: { id: true, companySlug: true, type: true, severity: true, message: true, timestamp: true },
    }).catch(() => [] as QualityAlertSnap[]),
  ]);

  return {
    ...base,
    companies,
    users,
    applications,
    integrations,
    manualTestPlans,
    defects,
    testRuns,
    qualityAlerts,
    totalCompanies: companies.length,
    totalUsers: users.length,
    totalApplications: applications.length,
    totalIntegrations: integrations.length,
    totalManualTestPlans: manualTestPlans.length,
    totalDefects: defects.length,
    totalTestRuns: testRuns.length,
    totalQualityAlerts: qualityAlerts.length,
  };
}

function formatTicketStatus(status: string) {
  switch (status) {
    case "backlog": return "ðŸ“¬ Backlog";
    case "open": return "ðŸ“¬ Aberto";
    case "in_progress": return "âš™ï¸ Em andamento";
    case "review": return "ðŸ‘ï¸ Em revisÃ£o";
    case "done": case "closed": return "âœ… ConcluÃ­do";
    default: return status;
  }
}

function formatPriority(p: string) {
  switch (p) {
    case "high": case "alta": return "ðŸ”´ Alta";
    case "medium": case "media": return "ðŸŸ  MÃ©dia";
    case "low": case "baixa": return "ðŸŸ¢ Baixa";
    default: return p;
  }
}

function formatReleaseStatus(s: string) {
  switch (s) {
    case "APPROVED": return "âœ… Aprovado";
    case "DRAFT": return "ðŸ“ Rascunho";
    case "REJECTED": return "âŒ Rejeitado";
    case "IN_PROGRESS": return "âš™ï¸ Em progresso";
    default: return s;
  }
}

/** Resumo inline curto do estado do sistema para appender no fim das respostas */
function snapshotInline(snap: SystemSnapshot): string {
  const parts: string[] = [];
  const companyNames = snap.companies?.slice(0, 3).map((company) => company.name).filter(Boolean) ?? [];
  if (companyNames.length > 0) parts.push(`empresas: ${companyNames.join(", ")}`);
  if (snap.openTickets > 0) parts.push(`${snap.openTickets} ticket${snap.openTickets > 1 ? "s" : ""} aberto${snap.openTickets > 1 ? "s" : ""}`);
  if (snap.recentDefects.length > 0) parts.push(`${snap.recentDefects.length} bug${snap.recentDefects.length > 1 ? "s" : ""} ativo${snap.recentDefects.length > 1 ? "s" : ""}`);
  if (snap.totalReleases > 0) parts.push(`${snap.totalReleases} release${snap.totalReleases > 1 ? "s" : ""} recente${snap.totalReleases > 1 ? "s" : ""}`);
  if ((snap.totalApplications ?? 0) > 0) parts.push(`${snap.totalApplications} aplicaÃƒÂ§ÃƒÂ£o${snap.totalApplications === 1 ? "" : "ÃƒÂµes"}`);
  if ((snap.totalManualTestPlans ?? 0) > 0) parts.push(`${snap.totalManualTestPlans} plano${snap.totalManualTestPlans === 1 ? "" : "s"} de teste`);
  const qaseIntegrations = snap.integrations?.filter((integration) => integration.type === "QASE").length ?? 0;
  if (qaseIntegrations > 0) parts.push(`${qaseIntegrations} integraÃƒÂ§ÃƒÂ£o${qaseIntegrations === 1 ? "" : "ÃƒÂµes"} Qase`);
  else if ((snap.totalIntegrations ?? 0) > 0) parts.push(`${snap.totalIntegrations} integraÃƒÂ§ÃƒÂ£o${snap.totalIntegrations === 1 ? "" : "ÃƒÂµes"}`);
  if ((snap.totalQualityAlerts ?? 0) > 0) parts.push(`${snap.totalQualityAlerts} alerta${snap.totalQualityAlerts === 1 ? "" : "s"} de qualidade`);
  const accessOpen = snap.accessRequests.filter((a) => a.status === "open").length;
  if (accessOpen > 0) parts.push(`${accessOpen} solicitaÃ§Ã£o${accessOpen > 1 ? "Ãµes" : ""} de acesso pendente${accessOpen > 1 ? "s" : ""}`);
  if (!parts.length) return "";
  return `_No sistema agora: ${parts.join(", ")}._`;
}

// â”€â”€â”€ Tipos de evento de stream (compatÃ­veis com AgentView) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// text-delta  â†’ { type, text }
// tool-input-start â†’ { type, id, toolName }
// tool-call        â†’ { type, toolCallId, toolName, input }
// tool-result      â†’ { type, toolCallId, output }
// error            â†’ { type, error }
export type StreamEvent =
  | { type: "tool-input-start"; id: string; toolName: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; output: unknown }
  | { type: "text-delta"; text: string }
  | { type: "error"; error: string };

export type EngineInput = {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  question?: string;
  nodeId?: string | null;
  companySlug?: string | null;
  agentMode?: AgentMode | null;
  route?: string | null;
  screenLabel?: string | null;
  userId?: string | null;
  actorName?: string | null;
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`;
}

/** Emite texto linha a linha para simular stream natural */
async function* yieldText(text: string): AsyncGenerator<StreamEvent> {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const words = line.split(" ");
    for (let j = 0; j < words.length; j += 6) {
      const chunk = words.slice(j, j + 6).join(" ");
      yield { type: "text-delta", text: (j === 0 && i > 0 ? "\n" : j > 0 ? " " : (i > 0 ? "\n" : "")) + chunk };
    }
    if (words.length === 0) {
      yield { type: "text-delta", text: "\n" };
    }
  }
}

/** Tenta extrair uma rota de URL da descriÃ§Ã£o ou label do nÃ³. */
function extractRouteFromNode(
  node: { label: string; description?: string | null; metadata?: unknown } | null,
  fallback?: string | null,
): string | null {
  if (fallback && fallback !== "/" && fallback !== "") return fallback;
  if (!node) return null;
  if (node.metadata && typeof node.metadata === "object" && !Array.isArray(node.metadata)) {
    const metadata = node.metadata as Record<string, unknown>;
    for (const key of ["route", "path", "url", "href"]) {
      const value = metadata[key];
      if (typeof value === "string" && value.startsWith("/")) return value;
    }
  }
  const haystack = `${node.label} ${node.description ?? ""}`;
  const match = haystack.match(/(?:rota|route|path|url|href)[:\s]+([/][^\s,)'"]+)/i)
    ?? haystack.match(/([/][a-z][a-z0-9/-]+)/i);
  return match ? match[1] : null;
}

function isCasualConversation(question: string) {
  const n = question.trim().toLowerCase();
  if (!n) return true;

  // Perguntas sobre capacidades do agente â†’ tratar como casual (tem handler prÃ³prio)
  if (/o que (voc[eÃª]|vc) (pode|faz|consegue|sabe)\b/.test(n)) return true;

  const technicalTerms = /(ticket|chamado|bug|erro|falha|defect|playwright|teste|testes|spec|release|deploy|api|endpoint|permiss|acesso|m[Ã©e]trica|dashboard|empresa|usu[Ã¡a]rio|node|n[oÃ³]|brain|mem[oÃ³]ria|decis[aÃ£]o|regra|cobertura|risco|audit)/;
  if (technicalTerms.test(n)) return false;

  const casualPatterns = [
    /^(oi|ola|ol[Ã¡a]|e ai|e a[iÃ­]|bom dia|boa tarde|boa noite)\b/,
    /^(tudo bem|como vai|como voce est[aÃ¡]|como vocÃª est[aÃ¡])\b/,
    /^(obrigado|obrigada|valeu|show|perfeito|top|boa)\b/,
    /^(me ajuda|pode ajudar|preciso de ajuda|ajuda)\b/,
    /^(ok|blz|beleza|fechou|entendi)\b/,
  ];

  if (casualPatterns.some((re) => re.test(n))) return true;
  const wordCount = n.split(/\s+/).filter(Boolean).length;
  return wordCount <= 3;
}

function buildCasualReply(question: string, screenLabel?: string | null) {
  const n = question.trim().toLowerCase();
  const label = screenLabel?.trim() ? ` em ${screenLabel}` : "";

  if (/^(obrigado|obrigada|valeu|show|perfeito|top|boa)\b/.test(n)) {
    return `Disponha. Se quiser, eu jÃ¡ sigo com o prÃ³ximo passo${label}.`;
  }

  if (/^(me ajuda|pode ajudar|preciso de ajuda|ajuda)\b/.test(n)) {
    return `Claro. Me diz em uma frase o que vocÃª quer resolver${label} e eu vou direto ao ponto.`;
  }

  if (/^(oi|ola|ol[Ã¡a]|e ai|e a[iÃ­]|bom dia|boa tarde|boa noite|tudo bem|como vai|como voce est[aÃ¡]|como vocÃª est[aÃ¡])\b/.test(n)) {
    return `Tudo certo. O que vocÃª quer resolver agora${label}?`;
  }

  return `Perfeito. Me fala o objetivo e eu te ajudo de forma direta${label}.`;
}

function extractPreviousUserTopic(
  messages?: Array<{ role: "user" | "assistant"; content: string }>,
  currentQuestion?: string,
) {
  if (!messages?.length) return null;
  const current = String(currentQuestion ?? "").trim().toLowerCase();

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item.role !== "user") continue;
    const text = String(item.content ?? "").trim();
    if (!text) continue;
    if (text.toLowerCase() === current) continue;
    return text.slice(0, 120);
  }

  return null;
}

function buildHumanContinuationReply(
  question: string,
  screenLabel?: string | null,
  messages?: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const n = question.trim().toLowerCase();
  const previousTopic = extractPreviousUserTopic(messages, question);
  const label = screenLabel?.trim() ? ` em ${screenLabel}` : "";

  // Pedido de detalhamento/explicaÃ§Ã£o baseado no que jÃ¡ foi dito
  if (/^(explica|explique|detalha|detalhe|aprofund(a|e)|mostra|mostre)\b/.test(n) && previousTopic) {
    return [
      `Vou conectar com o que vocÃª trouxe antes â€” fluxo de conversa baseado em "${previousTopic}"${label}.`,
      "",
      "Quer que eu aprofunde em qual recorte?",
      "1) arquitetura/fluxo (passo a passo),",
      "2) regras de negÃ³cio/validaÃ§Ãµes,",
      "3) ou como testar (Playwright/Jest)?",
    ].join("\n");
  }

  // ContinuaÃ§Ã£o explÃ­cita com tÃ³pico anterior
  if (/^(sim|isso|ok|blz|beleza|fechou|pode|continua|continuar)\b/.test(n) && previousTopic) { 
    return `Perfeito, continuando sobre "${previousTopic}"${label}. Quer que eu siga com resumo rÃ¡pido ou jÃ¡ com aÃ§Ã£o prÃ¡tica?`; 
  } 

  // Pedido de ajuda com contexto de tela
  if (/^(me ajuda|pode ajudar|preciso de ajuda|ajuda|o que (eu|vc|vocÃª) (pode|conseg))\b/.test(n)) {
    if (screenLabel?.trim()) {
      return `Claro. Estou na tela **${screenLabel}** com vocÃª. Me diz em uma frase o que vocÃª quer resolver â€” anÃ¡lise QA, debug, gerar teste ou consultar memÃ³rias do Brain?`;
    }
    return `Claro. Me diz em uma frase o que quer resolver e eu vou direto ao ponto â€” anÃ¡lise, debug, spec ou memÃ³rias.`;
  }

  // Pergunta sobre o que o agente pode fazer
  if (/o que (voc[eÃª]|vc) (pode|faz|consegue|sabe)\b/.test(n)) {
    return `Sou um assistente interno especializado no sistema. Posso:\n- **QA:** analisar cobertura, risco e defeitos de um nÃ³ no Brain\n- **Debug:** rastrear exceÃ§Ãµes, logs de auditoria e evidÃªncias de falha\n- **Playwright:** gerar specs de teste E2E baseados no Brain\n- **Memory:** consultar decisÃµes, regras e padrÃµes documentados\n\nSÃ³ me diz o nÃ³ ou o que estÃ¡ acontecendo.`;
  }

  return buildCasualReply(question, screenLabel);
}

function isShortFollowUp(text: string) {
  return /^(sim|isso|ok|blz|beleza|fechou|pode|continua|continuar|entendi|certo|show|valeu)\b/.test(text);
}

function buildLearningQuery(
  question: string,
  messages?: Array<{ role: "user" | "assistant"; content: string }>,
  screenLabel?: string | null,
) {
  const base = question.trim();
  const topics: string[] = [];

  if (messages?.length) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const item = messages[i];
      if (item.role !== "user") continue;
      const text = String(item.content ?? "").trim();
      if (!text) continue;
      const normalized = text.toLowerCase();
      if (normalized === base.toLowerCase()) continue;
      if (isShortFollowUp(normalized)) continue;
      topics.push(text.slice(0, 140));
      if (topics.length >= 2) break;
    }
  }

  const parts = [base];
  if (screenLabel?.trim()) parts.push(`contexto de tela: ${screenLabel.trim()}`);
  if (topics.length) parts.push(`continuidade da conversa: ${topics.reverse().join(" | ")}`);
  return parts.join(" ; ");
}

type FocusNode = {
  id: string;
  label: string;
  type: string;
  description?: string | null;
  metadata?: unknown;
};

type FocusMemory = {
  id: string;
  memoryType: string;
  title: string;
  summary: string;
  importance: number;
};

type FocusNodeContext = {
  node: FocusNode;
  neighbors: FocusNode[];
  outgoingCount: number;
  incomingCount: number;
  subgraphNodes: FocusNode[];
  defects: FocusNode[];
  testRuns: FocusNode[];
  releases: FocusNode[];
  tickets: FocusNode[];
  modules: FocusNode[];
  screens: FocusNode[];
  applications: FocusNode[];
  directMemories: FocusMemory[];
  memories: FocusMemory[];
  ancestors: FocusNode[];
  descendants: FocusNode[];
  impactedNodes: FocusNode[];
  similarNodes: FocusNode[];
  edgeTypes: string[];
};

async function safeLoad<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function compactNode(node: FocusNode): FocusNode {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    description: node.description ?? null,
    metadata: node.metadata ?? null,
  };
}

function formatNodeNames(nodes: FocusNode[], limit = 5) {
  if (nodes.length === 0) return "nenhum";
  const names = nodes.slice(0, limit).map((node) => `${node.label} (${node.type})`);
  const suffix = nodes.length > limit ? ` e mais ${nodes.length - limit}` : "";
  return `${names.join(", ")}${suffix}`;
}

function summarizeTypes(nodes: FocusNode[]) {
  if (nodes.length === 0) return "nenhum";
  const counts = new Map<string, number>();
  for (const node of nodes) counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([type, count]) => `${type}: ${count}`)
    .join(" | ");
}

async function loadFocusNodeContext(nodeId: string): Promise<FocusNodeContext | null> {
  const fallbackGraph = { nodes: [] as FocusNode[], edges: [] as Array<{ type: string }> };

  const context = await safeLoad(() => getNodeWithContext(nodeId, 2), null);
  const node = context?.node ?? (await safeLoad(() => prisma.brainNode.findUnique({ where: { id: nodeId } }), null));
  if (!node) return null;

  const [subgraph, directMemories, relatedMemories, ancestors, descendants, impact, similarNodes] = await Promise.all([
    safeLoad(() => getSubgraph(nodeId, 2), fallbackGraph),
    safeLoad(() => getNodeMemories(nodeId), [] as FocusMemory[]),
    safeLoad(() => getRelatedMemories(nodeId, 2), [] as FocusMemory[]),
    safeLoad(() => getNodeAncestors(nodeId), [] as FocusNode[]),
    safeLoad(() => getNodeDescendants(nodeId), [] as FocusNode[]),
    safeLoad(async () => {
      const value = await traceImpact(nodeId, 2);
      return {
        impactedNodes: value.impactedNodes.map((entry) => compactNode(entry as FocusNode)),
        paths: value.paths,
      };
    }, { impactedNodes: [] as FocusNode[], paths: [] as unknown[] }),
    safeLoad(() => findSimilarNodes(nodeId, 8), [] as FocusNode[]),
  ]);

  const subgraphNodes = dedupeById(
    subgraph.nodes
      .filter((entry) => entry.id !== nodeId)
      .map((entry) => compactNode(entry as FocusNode)),
  );
  const memories = dedupeById([...(directMemories as FocusMemory[]), ...(relatedMemories as FocusMemory[])])
    .sort((left, right) => right.importance - left.importance);

  return {
    node: compactNode(node as FocusNode),
    neighbors: (context?.neighbors ?? []).map((entry) => compactNode(entry as FocusNode)),
    outgoingCount: context?.outgoing.length ?? 0,
    incomingCount: context?.incoming.length ?? 0,
    subgraphNodes,
    defects: subgraphNodes.filter((entry) => entry.type === "Defect"),
    testRuns: subgraphNodes.filter((entry) => entry.type === "TestRun"),
    releases: subgraphNodes.filter((entry) => entry.type === "Release"),
    tickets: subgraphNodes.filter((entry) => entry.type === "Ticket"),
    modules: subgraphNodes.filter((entry) => entry.type === "Module"),
    screens: subgraphNodes.filter((entry) => entry.type === "Screen"),
    applications: subgraphNodes.filter((entry) => entry.type === "Application"),
    directMemories: (directMemories as FocusMemory[]).sort((left, right) => right.importance - left.importance),
    memories,
    ancestors: (ancestors as FocusNode[]).map(compactNode),
    descendants: (descendants as FocusNode[]).map(compactNode),
    impactedNodes: impact.impactedNodes,
    similarNodes: (similarNodes as FocusNode[]).map(compactNode),
    edgeTypes: [...new Set(subgraph.edges.map((edge) => edge.type).filter(Boolean))],
  };
}

function buildHumanizedFlowIntro(
  question: string,
  messages?: Array<{ role: "user" | "assistant"; content: string }>,
  screenLabel?: string | null,
) {
  const previousTopic = extractPreviousUserTopic(messages, question);
  const label = screenLabel?.trim() ? ` na tela ${screenLabel}` : "";

  if (previousTopic) {
    return `Entendi o contexto${label}. Vou conectar com o que voce trouxe antes sobre "${previousTopic}" e seguir em fluxo de conversa.`;
  }

  return `Entendi o ponto${label}. Vou analisar o assunto no sistema e explicar de forma direta, humana e em continuidade.`;
}

type ResponseTone = "executive" | "technical" | "balanced";

function detectResponseTone(question: string, agentMode: AgentMode): ResponseTone {
  const n = question.toLowerCase();
  if (/(diretoria|executiv|lideran|gest[aÃ£]o|gestao|resumo rapido|resumo r[aÃ¡]pido|decis[aÃ£]o|status para lideran[aÃ§]a)/.test(n)) {
    return "executive";
  }
  if (agentMode === "debug" || agentMode === "playwright" || /(stack|trace|log|erro|bug|playwright|spec|api|endpoint)/.test(n)) {
    return "technical";
  }
  return "balanced";
}

function adaptResponseTone(text: string, question: string, agentMode: AgentMode): string {
  const tone = detectResponseTone(question, agentMode);
  if (tone !== "executive") return text;

  const lines = text.split("\n").map((l) => l.trimEnd());
  const title = lines.find((l) => l.startsWith("## "))?.replace(/^##\s*/, "") ?? "Resumo";
  const keepSection = (section: string) => /(diagn[oÃ³]stico|recomenda|pr[oÃ³]ximos passos|o que encontrei)/i.test(section);

  const out: string[] = [];
  out.push(`## Resumo executivo â€” ${title}`);
  out.push("");

  let currentSection = "";
  let keptBullets = 0;
  for (const line of lines) {
    if (/^###\s+/.test(line)) {
      currentSection = line.replace(/^###\s+/, "");
      keptBullets = 0;
      if (keepSection(currentSection)) {
        out.push(`### ${currentSection}`);
      }
      continue;
    }

    if (!keepSection(currentSection)) continue;
    if (/^[-*]\s+/.test(line)) {
      if (keptBullets >= 3) continue;
      out.push(line);
      keptBullets += 1;
      continue;
    }

    if (line && !/^##\s+/.test(line) && !/^###\s+/.test(line) && out[out.length - 1] !== "") {
      out.push(line);
    }
  }

  if (out.length <= 4) {
    return `## Resumo executivo\n\nPrincipais pontos preparados. Se quiser, eu transformo em plano de aÃ§Ã£o de 3 itens com prioridade.`;
  }

  out.push("");
  out.push("Se quiser, eu transformo isso em plano de aÃ§Ã£o curto para lideranÃ§a (impacto, risco e prÃ³ximo passo).\n");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// â”€â”€â”€ Engine principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export class InternalBrainEngine {
  async *run(input: EngineInput): AsyncGenerator<StreamEvent> {
    try {
      const question =
        input.question ||
        input.messages?.slice().reverse().find((m) => m.role === "user")?.content ||
        "";

      if (!question.trim()) {
        yield { type: "error", error: "Mensagem vazia." };
        return;
      }

      const agentMode: AgentMode =
        input.agentMode && ["qa", "debug", "playwright", "memory"].includes(input.agentMode)
          ? input.agentMode
          : detectAgentMode(question);

      // For explicit agentMode calls, always run the agent pipeline (even for short follow-ups like "explica isso"),
      // so the engine can learn from conversation context and query the Brain when appropriate.
      if (!input.agentMode && isCasualConversation(question)) {
        yield* yieldText(buildHumanContinuationReply(question, input.screenLabel, input.messages));
        return;
      }

      // Carrega snapshot real do sistema (tickets, releases, requests)
      const systemSnapshot = await loadRichSystemSnapshot(input.companySlug).catch(
        () => null,
      );

      switch (agentMode) {
        case "qa":
          yield* this.runQA({ ...input, question }, systemSnapshot);
          break;
        case "debug":
          yield* this.runDebug({ ...input, question }, systemSnapshot);
          break;
        case "playwright":
          yield* this.runPlaywright({ ...input, question }, systemSnapshot);
          break;
        case "memory":
          yield* this.runMemory({ ...input, question }, systemSnapshot);
          break;
      }
    } catch (err) {
      yield { type: "error", error: String(err) };
    }
  }

  // â”€â”€â”€ QA Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async *runQA(input: EngineInput & { question: string }, snap: SystemSnapshot | null): AsyncGenerator<StreamEvent> {
    const toolId = makeId("search_brain");
    const learningQuery = buildLearningQuery(input.question, input.messages, input.screenLabel);

    yield { type: "tool-input-start", id: toolId, toolName: "search_brain" };
    yield { type: "tool-call", toolCallId: toolId, toolName: "search_brain", input: { query: learningQuery } };

    const [searchResults, metrics] = await Promise.all([
      searchNodes({ query: learningQuery, limit: 8 }),
      getGraphMetrics(),
    ]);

    let focusContext: FocusNodeContext | null = null;
    let focusNode: FocusNode | null = null;
    let defects: Array<{ label: string; description?: string | null }> = [];
    let testRuns: Array<{ label: string; description?: string | null }> = [];
    let releases: Array<{ label: string }> = [];
    let memories: Array<{ memoryType: string; title: string; summary: string; importance: number }> = [];

    if (input.nodeId) {
      focusContext = await loadFocusNodeContext(input.nodeId);
      if (focusContext) {
        focusNode = focusContext.node;
        defects = focusContext.defects;
        testRuns = focusContext.testRuns;
        releases = focusContext.releases;
        memories = focusContext.memories;
      }
    }

    yield {
      type: "tool-result",
      toolCallId: toolId,
      output: {
        found: searchResults.length,
        defects: defects.length,
        testRuns: testRuns.length,
        releases: releases.length,
        memories: memories.length,
        neighbors: focusContext?.neighbors.length ?? 0,
        impactedNodes: focusContext?.impactedNodes.length ?? 0,
        relatedNodes: focusContext?.subgraphNodes.length ?? 0,
      },
    };

    if (focusNode) {
      const covId = makeId("analyze_coverage");
      yield { type: "tool-input-start", id: covId, toolName: "analyze_coverage" };
      yield { type: "tool-call", toolCallId: covId, toolName: "analyze_coverage", input: { nodeId: input.nodeId } };
      const coverageScore =
        testRuns.length > 0 ? Math.min(100, Math.round((testRuns.length / Math.max(1, releases.length)) * 20)) : 0;
      yield {
        type: "tool-result",
        toolCallId: covId,
        output: { testRuns: testRuns.length, defects: defects.length, releases: releases.length, coverageScore },
      };
    }

    let resp = "";

    if (focusNode) {
      const criticalMems = memories.filter((m) => m.importance >= 7);
      const otherMems = memories.filter((m) => m.importance < 7);
      const defectRatio = defects.length / Math.max(1, testRuns.length);
      const coverageScore =
        testRuns.length > 0 ? Math.min(100, Math.round((testRuns.length / Math.max(1, releases.length || 1)) * 20)) : 0;
      const riskLabel =
        defects.length > 5 || defectRatio > 3 ? "ðŸ”´ alto"
        : defects.length > 2 || defectRatio > 1.5 ? "ðŸŸ¡ mÃ©dio"
        : testRuns.length === 0 ? "ðŸŸ  indefinido (sem cobertura)"
        : "ðŸŸ¢ baixo";

      const descNote = focusNode.description ? ` â€” ${focusNode.description.slice(0, 120)}` : "";
      resp += `**${focusNode.label}** (${focusNode.type})${descNote}.\n\n`;

      // Contexto estrutural no grafo
      if (focusContext) {
        const structParts: string[] = [];
        if (focusContext.ancestors.length > 0) structParts.push(`pertence a ${formatNodeNames(focusContext.ancestors, 2)}`);
        if (focusContext.applications.length > 0) structParts.push(`app: ${focusContext.applications[0].label}`);
        if (focusContext.modules.length > 0) structParts.push(`mÃ³dulos: ${focusContext.modules.slice(0, 2).map((m) => m.label).join(", ")}`);
        if (focusContext.screens.length > 0) structParts.push(`telas: ${focusContext.screens.slice(0, 2).map((s) => s.label).join(", ")}`);
        if (focusContext.neighbors.length > 0) structParts.push(`${focusContext.neighbors.length} vizinho${focusContext.neighbors.length > 1 ? "s" : ""} no grafo`);
        if (structParts.length > 0) resp += `_Contexto: ${structParts.join(" | ")}._\n\n`;
      }

      // Cobertura e risco
      if (testRuns.length === 0 && releases.length > 0) {
        resp += `Tem ${releases.length} release${releases.length > 1 ? "s" : ""} mas nenhuma execuÃ§Ã£o de teste registrada â€” risco direto de regressÃ£o nÃ£o detectada. Risco: **${riskLabel}**.\n\n`;
      } else if (testRuns.length === 0) {
        resp += `Sem execuÃ§Ãµes de teste ainda. Risco: **${riskLabel}** â€” sem cobertura nÃ£o consigo afirmar estabilidade.\n\n`;
      } else {
        resp += `${testRuns.length} run${testRuns.length > 1 ? "s" : ""} de teste, ${defects.length === 0 ? "nenhum defeito" : `${defects.length} defeito${defects.length > 1 ? "s" : ""} ativo${defects.length > 1 ? "s" : ""}`} â€” risco **${riskLabel}**, score de cobertura estimado: **${coverageScore}/100**.\n\n`;
        if (testRuns.length > 0) {
          resp += `Runs: ${testRuns.slice(0, 4).map((t) => t.label).join(", ")}${testRuns.length > 4 ? ` e mais ${testRuns.length - 4}` : ""}.\n\n`;
        }
      }

      // Defeitos listados
      if (defects.length > 0) {
        if (defects.length === 1) {
          resp += `Defeito: **${defects[0].label}**${defects[0].description ? ` â€” "${defects[0].description.slice(0, 150)}"` : ""}.\n\n`;
        } else {
          resp += `${defects.length} defeito${defects.length > 1 ? "s" : ""} no subgrafo:\n`;
          defects.slice(0, 6).forEach((d) => {
            resp += `- **${d.label}**${d.description ? ` â€” ${d.description.slice(0, 120)}` : ""}\n`;
          });
          if (defects.length > 6) resp += `_...e mais ${defects.length - 6} nÃ£o listados._\n`;
          resp += "\n";
        }
      }

      // Releases conectadas
      if (releases.length > 0) {
        resp += `Releases conectadas (${releases.length}): ${releases.slice(0, 4).map((r) => r.label).join(", ")}${releases.length > 4 ? ` e mais ${releases.length - 4}` : ""}.\n\n`;
      }

      // MemÃ³rias crÃ­ticas
      if (criticalMems.length > 0) {
        if (criticalMems.length === 1) {
          resp += `MemÃ³ria crÃ­tica: **[${criticalMems[0].memoryType}] ${criticalMems[0].title}** _(${criticalMems[0].importance}/10)_\n> ${criticalMems[0].summary.slice(0, 220)}\n\n`;
        } else {
          resp += `${criticalMems.length} memÃ³rias crÃ­ticas:\n`;
          criticalMems.slice(0, 4).forEach((m) => {
            resp += `- **[${m.memoryType}] ${m.title}** _(${m.importance}/10)_ â€” ${m.summary.slice(0, 150)}\n`;
          });
          if (criticalMems.length > 4) resp += `_...e mais ${criticalMems.length - 4}._\n`;
          resp += "\n";
        }
      }

      // MemÃ³rias de contexto
      if (otherMems.length > 0) {
        resp += `Contexto documentado (${otherMems.length} memÃ³ria${otherMems.length > 1 ? "s" : ""}):\n`;
        otherMems.slice(0, 3).forEach((m) => {
          resp += `- **[${m.memoryType}] ${m.title}** _(${m.importance}/10)_ â€” ${m.summary.slice(0, 130)}\n`;
        });
        if (otherMems.length > 3) resp += `_...e mais ${otherMems.length - 3}._\n`;
        resp += "\n";
      }

      if (memories.length === 0) {
        resp += `Nenhuma memÃ³ria documentada neste nÃ³ â€” recomendo ao menos uma \`DECISION\` ou \`RULE\` para dar contexto ao Brain.\n\n`;
      }

      // NÃ³s similares â€” comparaÃ§Ã£o de padrÃ£o de risco
      if (focusContext && focusContext.similarNodes.length > 0) {
        resp += `NÃ³s similares para comparaÃ§Ã£o: ${formatNodeNames(focusContext.similarNodes, 3)}.\n\n`;
      }

      // Impacto
      if (focusContext && focusContext.impactedNodes.length > 0) {
        resp += `Impacto mapeado em ${focusContext.impactedNodes.length} nÃ³${focusContext.impactedNodes.length > 1 ? "s" : ""}: ${formatNodeNames(focusContext.impactedNodes, 4)}.\n\n`;
      }

      // Tickets reais do sistema relacionados a este nÃ³
      if (snap) {
        const firstWord = focusNode.label.toLowerCase().split(/\s+/)[0];
        const allWords = focusNode.label.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        const relatedTickets = snap.tickets
          .filter((t) => {
            const title = t.title.toLowerCase();
            return title.includes(firstWord) || allWords.some((w) => title.includes(w));
          })
          .slice(0, 4);
        if (relatedTickets.length > 0) {
          resp += `Tickets no sistema relacionados: ${relatedTickets.map((t) => `[${t.code}] ${t.title} (${formatTicketStatus(t.status)})`).join("; ")}.\n\n`;
        }
      }

      // RecomendaÃ§Ã£o direta
      if (defects.length > 3) {
        resp += `**AÃ§Ã£o:** triage imediata nos ${defects.length} defeitos â€” priorize pelos de alta severidade e verifique quais tÃªm release associada.`;
      } else if (testRuns.length === 0) {
        resp += `**AÃ§Ã£o:** crie uma suite mÃ­nima antes do prÃ³ximo deploy. Use o agente Playwright para gerar um spec baseado neste nÃ³.`;
      } else if (defects.length === 0 && testRuns.length > 0) {
        resp += `MÃ³dulo aparentemente saudÃ¡vel (score ${coverageScore}/100). Mantenha a cadÃªncia e documente decisÃµes como memÃ³rias \`DECISION\`.`;
      } else {
        resp += `**AÃ§Ã£o:** revise os ${defects.length} defeito${defects.length > 1 ? "s" : ""} e atualize o status. Se algum foi corrigido, documente a soluÃ§Ã£o como memÃ³ria \`DECISION\`.`;
      }

    } else if (searchResults.length > 0) {
      const byType: Record<string, typeof searchResults> = {};
      for (const node of searchResults) {
        if (!byType[node.type]) byType[node.type] = [];
        byType[node.type].push(node);
      }

      resp += `Busquei **"${input.question}"** no Brain e encontrei ${searchResults.length} nÃ³${searchResults.length > 1 ? "s" : ""} relacionado${searchResults.length > 1 ? "s" : ""}.\n\n`;
      resp += `_Brain: ${metrics.nodeCount} nÃ³s, ${metrics.edgeCount} conexÃµes, ${metrics.memoryCount} memÃ³rias registradas._\n\n`;

      for (const [type, nodes] of Object.entries(byType)) {
        resp += `**${type} (${nodes.length}):**\n`;
        nodes.slice(0, 5).forEach((node) => {
          resp += `- **${node.label}**${node.description ? ` â€” ${node.description.slice(0, 140)}` : ""}\n`;
        });
        if (nodes.length > 5) resp += `_...e mais ${nodes.length - 5}._\n`;
        resp += "\n";
      }

      const hasDefects = (byType["Defect"]?.length ?? 0) > 0;
      const hasTestRuns = (byType["TestRun"]?.length ?? 0) > 0;
      const hasReleases = (byType["Release"]?.length ?? 0) > 0;

      if (hasDefects && !hasTestRuns) {
        resp += `${byType["Defect"].length} defeito${byType["Defect"].length > 1 ? "s" : ""} sem execuÃ§Ãµes de teste visÃ­veis â€” risco de cobertura. Selecione um nÃ³ para anÃ¡lise detalhada.`;
      } else if (hasDefects && hasTestRuns) {
        const ratio = (byType["Defect"].length / byType["TestRun"].length).toFixed(1);
        resp += `Ratio defeitos/runs: **${ratio}** â€” ${parseFloat(ratio) > 2 ? "alto, requer atenÃ§Ã£o" : parseFloat(ratio) > 1 ? "moderado" : "dentro do esperado"}. Selecione um nÃ³ para diagnÃ³stico completo.`;
      } else if (hasReleases) {
        resp += `${byType["Release"].length} release${byType["Release"].length > 1 ? "s" : ""} encontrada${byType["Release"].length > 1 ? "s" : ""}. Selecione uma para ver mÃ©tricas pass/fail detalhadas.`;
      } else {
        resp += `Selecione um nÃ³ no Brain para ver cobertura, defeitos e risco detalhado.`;
      }

      if (snap && snap.openTickets > 0) {
        resp += `\n\n_Sistema agora: ${snap.openTickets} ticket${snap.openTickets > 1 ? "s" : ""} aberto${snap.openTickets > 1 ? "s" : ""}, ${snap.recentDefects.length} bug${snap.recentDefects.length > 1 ? "s" : ""} ativo${snap.recentDefects.length > 1 ? "s" : ""}._`;
      }
    } else {
      resp += `Busquei **"${input.question}"** mas o Brain nÃ£o retornou nÃ³s correspondentes.\n\n`;
      resp += `Brain atual: ${metrics.nodeCount} nÃ³s, ${metrics.edgeCount} conexÃµes, ${metrics.memoryCount} memÃ³rias.\n\n`;

      const previousTopic = extractPreviousUserTopic(input.messages, input.question);
      if (previousTopic) {
        resp += `Vou conectar com o que voce trouxe antes (fluxo de conversa): "${previousTopic}".\n\n`;
      }

      if (snap) {
        const openDefects = snap.recentDefects.filter((d) => d.status !== "done" && d.status !== "closed");
        if (openDefects.length > 0) {
          resp += `Bugs abertos no sistema: ${openDefects.slice(0, 3).map((d) => `[${d.code}] ${d.title}`).join("; ")}.\n\n`;
        }
      }

      resp += `Se o sistema estÃ¡ cadastrado, tente sincronizar via \`/api/brain/sync\` ou selecione um nÃ³ diretamente no grafo.`;
    }

    if (snap) {
      const inline = snapshotInline(snap);
      if (inline) resp += `\n\n${inline}`;
    }
    yield* yieldText(adaptResponseTone(resp, input.question, "qa"));
  }

  // â”€â”€â”€ Debug Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async *runDebug(input: EngineInput & { question: string }, snap: SystemSnapshot | null): AsyncGenerator<StreamEvent> {
    const toolId = makeId("search_brain");
    const learningQuery = buildLearningQuery(input.question, input.messages, input.screenLabel);

    yield { type: "tool-input-start", id: toolId, toolName: "search_brain" };
    yield { type: "tool-call", toolCallId: toolId, toolName: "search_brain", input: { query: learningQuery, scope: "debug" } };

    const searchResults = await searchNodes({ query: learningQuery, limit: 10 });

    let focusContext: FocusNodeContext | null = null;
    let focusNode: FocusNode | null = null;
    let defects: Array<{ label: string; description?: string | null }> = [];
    let exceptions: Array<{ memoryType: string; title: string; summary: string }> = [];
    let recentAudit: Array<{ action: string; entityType?: string | null; createdAt: Date }> = [];

    if (input.nodeId) {
      focusContext = await loadFocusNodeContext(input.nodeId);
      if (focusContext) {
        focusNode = focusContext.node;
        defects = focusContext.defects;
        exceptions = focusContext.memories.filter(
          (m) => m.memoryType === "EXCEPTION" || m.memoryType === "TECHNICAL_NOTE",
        );
        recentAudit = await prisma.brainAuditLog.findMany({
          where: { entityId: input.nodeId },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { action: true, entityType: true, createdAt: true },
        });
      }
    }

    yield {
      type: "tool-result",
      toolCallId: toolId,
      output: {
        found: searchResults.length,
        defects: defects.length,
        exceptions: exceptions.length,
        auditLogs: recentAudit.length,
        neighbors: focusContext?.neighbors.length ?? 0,
        impactedNodes: focusContext?.impactedNodes.length ?? 0,
      },
    };

    const patternId = makeId("find_patterns");
    yield { type: "tool-input-start", id: patternId, toolName: "find_patterns" };
    yield { type: "tool-call", toolCallId: patternId, toolName: "find_patterns", input: { focus: "defects" } };

    const globalExceptions = await prisma.brainMemory.findMany({
      where: { memoryType: "EXCEPTION", status: "ACTIVE" },
      orderBy: { importance: "desc" },
      take: 5,
    });

    yield { type: "tool-result", toolCallId: patternId, output: { globalExceptions: globalExceptions.length } };

    let resp = "";

    if (focusNode) {
      const descNote = focusNode.description ? ` â€” ${focusNode.description.slice(0, 110)}` : "";
      resp += `**${focusNode.label}** (${focusNode.type})${descNote}.\n\n`;

      // Contexto estrutural
      if (focusContext) {
        const structParts: string[] = [];
        if (focusContext.ancestors.length > 0) structParts.push(`dentro de ${formatNodeNames(focusContext.ancestors, 2)}`);
        if (focusContext.neighbors.length > 0) structParts.push(`${focusContext.neighbors.length} vizinho${focusContext.neighbors.length > 1 ? "s" : ""}: ${focusContext.neighbors.slice(0, 2).map((n) => n.label).join(", ")}`);
        if (focusContext.impactedNodes.length > 0) structParts.push(`impacto em ${focusContext.impactedNodes.length} nÃ³${focusContext.impactedNodes.length > 1 ? "s" : ""}`);
        if (structParts.length > 0) resp += `_Contexto: ${structParts.join(" | ")}._\n\n`;
      }

      // DiagnÃ³stico direto
      if (exceptions.length > 0 && defects.length > 0) {
        resp += `EvidÃªncia real de problema: ${exceptions.length} exceÃ§Ã£o${exceptions.length > 1 ? "Ãµes" : ""} documentada${exceptions.length > 1 ? "s" : ""} + ${defects.length} defeito${defects.length > 1 ? "s" : ""} conectado${defects.length > 1 ? "s" : ""}.\n\n`;
      } else if (exceptions.length > 0) {
        resp += `${exceptions.length} exceÃ§Ã£o${exceptions.length > 1 ? "Ãµes" : ""} documentada${exceptions.length > 1 ? "s" : ""} neste nÃ³.${defects.length === 0 ? " Nenhum defeito formal associado, mas o problema estÃ¡ registrado." : ""}\n\n`;
      } else if (defects.length > 0) {
        resp += `${defects.length} defeito${defects.length > 1 ? "s" : ""} conectado${defects.length > 1 ? "s" : ""} sem exceÃ§Ã£o (EXCEPTION) documentada â€” pode indicar defeitos funcionais sem stack trace registrado.\n\n`;
      } else if (recentAudit.length > 0) {
        const changeLog = recentAudit.find((a) => a.action.includes("DELETE") || a.action.includes("UPDATE"));
        if (changeLog) {
          const changeDate = new Date(changeLog.createdAt).toLocaleDateString("pt-BR");
          resp += `Sem exceÃ§Ãµes ou defeitos diretos, mas hÃ¡ log de \`${changeLog.action}\` em ${changeDate}. Vale verificar se essa alteraÃ§Ã£o afetou algum fluxo.\n\n`;
        } else {
          resp += `Sem exceÃ§Ãµes ou defeitos diretos. ${recentAudit.length} log${recentAudit.length > 1 ? "s" : ""} de auditoria â€” o nÃ³ foi modificado recentemente.\n\n`;
        }
      } else {
        resp += `Sem exceÃ§Ãµes, defeitos ou logs de auditoria neste nÃ³. EstÃ¡ limpo â€” ou nÃ£o foi monitorado ainda.\n\n`;
      }

      // ExceÃ§Ãµes com detalhe completo
      if (exceptions.length > 0) {
        if (exceptions.length === 1) {
          resp += `A exceÃ§Ã£o registrada:\n**[${exceptions[0].memoryType}] ${exceptions[0].title}**\n> ${exceptions[0].summary.slice(0, 380)}\n\n`;
        } else {
          resp += `ExceÃ§Ãµes registradas (${exceptions.length}):\n`;
          exceptions.forEach((m) => {
            resp += `\n**[${m.memoryType}] ${m.title}**\n> ${m.summary.slice(0, 250)}\n`;
          });
          resp += "\n";
        }
      }

      // Defeitos listados com descriÃ§Ã£o
      if (defects.length > 0) {
        resp += `Defeitos conectados (${defects.length}):\n`;
        defects.slice(0, 6).forEach((d) => {
          resp += `- **${d.label}**${d.description ? ` â€” ${d.description.slice(0, 140)}` : ""}\n`;
        });
        if (defects.length > 6) resp += `_...e mais ${defects.length - 6}._\n`;
        resp += "\n";
      }

      // Auditoria com contexto temporal
      if (recentAudit.length > 0) {
        const relevantLogs = recentAudit.filter(
          (a) => a.action.includes("DELETE") || a.action.includes("UPDATE") || a.action.includes("CREATE"),
        );
        if (relevantLogs.length > 0) {
          resp += `MudanÃ§as recentes (auditoria):\n`;
          relevantLogs.slice(0, 5).forEach((log) => {
            const date = new Date(log.createdAt).toLocaleDateString("pt-BR");
            resp += `- \`${log.action}\` (${log.entityType ?? "â€”"}) â€” ${date}\n`;
          });
          resp += "\n";
        }
      }

      // Impacto detalhado
      if (focusContext && focusContext.impactedNodes.length > 0) {
        resp += `Impacto mapeado em ${focusContext.impactedNodes.length} nÃ³${focusContext.impactedNodes.length > 1 ? "s" : ""}: ${formatNodeNames(focusContext.impactedNodes, 5)}.\n\n`;
      }

      // NÃ³s similares â€” padrÃ£o sistÃªmico
      if (focusContext && focusContext.similarNodes.length > 0) {
        resp += `NÃ³s similares (para comparar padrÃµes): ${formatNodeNames(focusContext.similarNodes, 3)}.\n\n`;
      }

      // ExceÃ§Ãµes globais â€” cruzamento
      if (globalExceptions.length > 0) {
        if (exceptions.length === 0) {
          resp += `No Brain hÃ¡ ${globalExceptions.length} exceÃ§Ã£o${globalExceptions.length > 1 ? "Ãµes" : ""} global${globalExceptions.length > 1 ? "is" : ""} ativa${globalExceptions.length > 1 ? "s" : ""}:\n`;
          globalExceptions.slice(0, 3).forEach((m) => {
            resp += `- **${m.title}** _(${m.importance}/10)_ â€” ${m.summary.slice(0, 200)}\n`;
          });
          if (globalExceptions.length > 3) resp += `_...e mais ${globalExceptions.length - 3}._\n`;
          resp += "\n";
        } else {
          resp += `_Outras ${globalExceptions.length} exceÃ§Ã£o${globalExceptions.length > 1 ? "Ãµes" : ""} no Brain â€” verifique se alguma Ã© relacionada._\n\n`;
        }
      }

      // Bugs reais do sistema (snap)
      if (snap) {
        const firstWord = focusNode.label.toLowerCase().split(/\s+/)[0];
        const allWords = focusNode.label.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        const relatedBugs = snap.recentDefects
          .filter((d) => {
            const title = d.title.toLowerCase();
            return (
              (d.status !== "done" && d.status !== "closed") &&
              (title.includes(firstWord) || allWords.some((w) => title.includes(w)))
            );
          })
          .slice(0, 4);
        if (relatedBugs.length > 0) {
          resp += `Bugs abertos no sistema relacionados: ${relatedBugs.map((d) => `[${d.code}] ${d.title}`).join("; ")}.\n\n`;
        } else if (snap.recentDefects.length > 0) {
          const openBugs = snap.recentDefects.filter((d) => d.status !== "done" && d.status !== "closed").slice(0, 3);
          if (openBugs.length > 0) {
            resp += `Bugs abertos no sistema (geral): ${openBugs.map((d) => `[${d.code}] ${d.title}`).join("; ")}.\n\n`;
          }
        }
      }

      // AÃ§Ã£o direta
      if (exceptions.length > 0) {
        resp += `**AÃ§Ã£o:** reproduza "${exceptions[0].title}" no ambiente de dev e confirme se ainda ocorre. Se sim, abra ticket com stack trace completo e marque como urgente.`;
      } else if (defects.length > 0) {
        resp += `**AÃ§Ã£o:** revise os ${defects.length} defeito${defects.length > 1 ? "s" : ""} e adicione uma memÃ³ria \`EXCEPTION\` com o stack trace para documentar o problema de forma rastreÃ¡vel.`;
      } else if (recentAudit.length > 0) {
        resp += `**AÃ§Ã£o:** verifique se as alteraÃ§Ãµes recentes de auditoria introduziram regressÃµes. Se encontrou o problema, registre como memÃ³ria \`EXCEPTION\`.`;
      } else {
        resp += `**AÃ§Ã£o:** se o problema existe mas nÃ£o estÃ¡ documentado, registre uma memÃ³ria \`EXCEPTION\` neste nÃ³ com stack trace e passos para reproduzir.`;
      }

    } else if (searchResults.length > 0) {
      resp += `Busquei **"${input.question}"** para debug e encontrei ${searchResults.length} nÃ³${searchResults.length > 1 ? "s" : ""} relacionado${searchResults.length > 1 ? "s" : ""}.\n\n`;

      searchResults.slice(0, 6).forEach((node) => {
        resp += `- **${node.label}** (${node.type})${node.description ? ` â€” ${node.description.slice(0, 150)}` : ""}\n`;
      });
      if (searchResults.length > 6) resp += `_...e mais ${searchResults.length - 6}._\n`;
      resp += "\n";

      if (globalExceptions.length > 0) {
        resp += `ExceÃ§Ãµes globais ativas no Brain (${globalExceptions.length}):\n`;
        globalExceptions.slice(0, 4).forEach((m) => {
          resp += `- **${m.title}** _(${m.importance}/10)_ â€” ${m.summary.slice(0, 200)}\n`;
        });
        if (globalExceptions.length > 4) resp += `_...e mais ${globalExceptions.length - 4}._\n`;
        resp += "\n";
      }

      resp += `Selecione um nÃ³ especÃ­fico no grafo para anÃ¡lise de exceÃ§Ãµes detalhada por nÃ³.`;
    } else {
      resp += `Busquei **"${input.question}"** mas nÃ£o encontrei nÃ³s correspondentes no Brain.\n\n`;

      if (globalExceptions.length > 0) {
        resp += `HÃ¡ ${globalExceptions.length} exceÃ§Ã£o${globalExceptions.length > 1 ? "Ãµes" : ""} global${globalExceptions.length > 1 ? "is" : ""} ativa${globalExceptions.length > 1 ? "s" : ""} â€” pode ser o que vocÃª estÃ¡ buscando:\n`;
        globalExceptions.slice(0, 4).forEach((m) => {
          resp += `- **${m.title}** _(${m.importance}/10)_ â€” ${m.summary.slice(0, 220)}\n`;
        });
        resp += "\n";
      }

      resp += `Para documentar o problema, registre uma memÃ³ria \`EXCEPTION\` com stack trace no nÃ³ afetado.`;
    }

    // Snapshot de bugs reais inline
    if (snap) {
      const openBugNames = snap.recentDefects
        .filter((d) => d.status !== "done" && d.status !== "closed")
        .slice(0, 4)
        .map((d) => `[${d.code}] ${d.title}`);
      if (openBugNames.length > 0) {
        resp += `\n\n_Bugs abertos no sistema: ${openBugNames.join(" | ")}._`;
      } else {
        const inline = snapshotInline(snap);
        if (inline) resp += `\n\n${inline}`;
      }
    }
    yield* yieldText(adaptResponseTone(resp, input.question, "debug"));
  }

  // â”€â”€â”€ Playwright Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async *runPlaywright(input: EngineInput & { question: string }, snap: SystemSnapshot | null): AsyncGenerator<StreamEvent> {
    const toolId = makeId("generate_test_spec");

    yield { type: "tool-input-start", id: toolId, toolName: "generate_test_spec" };
    yield {
      type: "tool-call",
      toolCallId: toolId,
      toolName: "generate_test_spec",
      input: { feature: input.question, route: input.route, nodeId: input.nodeId },
    };

    let focusContext: FocusNodeContext | null = null;
    let focusNode: FocusNode | null = null;
    let nodeMemories: Array<{ memoryType: string; title: string; summary: string }> = [];

    if (input.nodeId) {
      focusContext = await loadFocusNodeContext(input.nodeId);
      if (focusContext) {
        focusNode = focusContext.node;
        nodeMemories = focusContext.memories.filter((m) =>
          m.memoryType === "PATTERN" || m.memoryType === "TECHNICAL_NOTE" || m.memoryType === "RULE",
        );
      }
    }

    const brainPatterns = await prisma.brainMemory.findMany({
      where: { status: "ACTIVE", memoryType: { in: ["PATTERN", "TECHNICAL_NOTE"] } },
      orderBy: { importance: "desc" },
      take: 5,
    });

    const featureName = focusNode?.label ?? input.question.slice(0, 50);
    const nodeType = focusNode?.type ?? "Feature";

    // Detect real route: prefer explicit input.route, then try to extract from node metadata
    const detectedRoute = extractRouteFromNode(focusNode, input.route);
    const hasRealRoute = Boolean(detectedRoute);
    const pageUrl = detectedRoute ?? `/* rota nÃ£o encontrada para "${featureName}" */`;

    const slug = featureName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const typeSpecificTests = this.buildTypeSpecificTests(nodeType, featureName, nodeMemories, detectedRoute);

    const ruleAssertions = nodeMemories
      .filter((m) => m.memoryType === "RULE")
      .slice(0, 3)
      .map((m) => `    // Regra: ${m.title}\n    // ${m.summary.slice(0, 100)}\n    // await expect(...).toBeVisible();`);

    const specLines = [
      `import { test, expect } from "@playwright/test";`,
      `import { mockAuth } from "./helpers/mockAuth";`,
      ``,
      `/**`,
      ` * Suite: ${featureName}`,
      focusNode ? ` * NÃ³ Brain: ${focusNode.id} (${nodeType})` : ` * Query: ${input.question}`,
      focusNode?.description ? ` * ${focusNode.description.slice(0, 100)}` : null,
      hasRealRoute ? null : ` * âš ï¸ SKELETON: rota nÃ£o identificada â€” substitua a constante PAGE_URL`,
      ` */`,
      hasRealRoute ? null : `const PAGE_URL = "/* TODO: adicione a rota deste nÃ³ */";`,
      `test.describe("${featureName}", () => {`,
      `  test.beforeEach(async ({ page, context }) => {`,
      `    await mockAuth(context, { role: "company", companies: ["DEMO"], clientSlug: "DEMO" });`,
      `    await page.goto(${hasRealRoute ? `"${pageUrl}"` : "PAGE_URL"}, { waitUntil: "domcontentloaded" });`,
      `  });`,
      ``,
      `  test("deve renderizar sem erros", async ({ page }) => {`,
      `    await expect(page).not.toHaveTitle(/error|404|500/i);`,
      `    await expect(page.getByRole("main")).toBeVisible();`,
      `  });`,
      ``,
      ...typeSpecificTests,
      ...(ruleAssertions.length > 0
        ? [
            ``,
            `  test("deve respeitar regras de negÃ³cio", async ({ page }) => {`,
            ...ruleAssertions,
            `  });`,
          ]
        : []),
      ...(nodeMemories.length > 0
        ? [
            ``,
            `  // PadrÃµes registrados no Brain:`,
            ...nodeMemories.slice(0, 3).map((m) => `  // [${m.memoryType}] ${m.title}: ${m.summary.slice(0, 80)}`),
          ]
        : []),
      `});`,
    ].filter((l): l is string => l !== null);

    yield {
      type: "tool-result",
      toolCallId: toolId,
      output: {
        specName: `${slug}.spec.ts`,
        lines: specLines.length,
        nodeType,
        memoryCount: nodeMemories.length,
        relatedNodes: focusContext?.subgraphNodes.length ?? 0,
        impactedNodes: focusContext?.impactedNodes.length ?? 0,
        routeDetected: hasRealRoute,
        route: pageUrl,
      },
    };

    let resp = "";

    // Intro conversacional â€” direto ao ponto com contexto completo
    if (focusNode) {
      const descNote = focusNode.description ? ` â€” ${focusNode.description.slice(0, 110)}` : "";
      resp += `Spec gerado para **${focusNode.label}** (${nodeType})${descNote}.\n\n`;

      // Contexto do subgrafo
      if (focusContext) {
        const parts: string[] = [];
        if (focusContext.ancestors.length > 0) parts.push(`pertence a ${formatNodeNames(focusContext.ancestors, 2)}`);
        if (focusContext.defects.length > 0) parts.push(`${focusContext.defects.length} defeito${focusContext.defects.length > 1 ? "s" : ""} no grafo (incluÃ­dos como regressÃ£o)`);
        if (focusContext.releases.length > 0) parts.push(`${focusContext.releases.length} release${focusContext.releases.length > 1 ? "s" : ""} associada${focusContext.releases.length > 1 ? "s" : ""}`);
        if (focusContext.impactedNodes.length > 0) parts.push(`impacto em ${focusContext.impactedNodes.length} nÃ³${focusContext.impactedNodes.length > 1 ? "s" : ""}: ${formatNodeNames(focusContext.impactedNodes, 2)}`);
        if (focusContext.neighbors.length > 0) parts.push(`${focusContext.neighbors.length} vizinho${focusContext.neighbors.length > 1 ? "s" : ""} no grafo`);
        if (parts.length > 0) resp += `_${parts.join(" | ")}._\n\n`;
      }
    } else {
      resp += `Spec gerado para **"${input.question}"** â€” sem nÃ³ Brain selecionado, usando a query como referÃªncia.\n\n`;
    }

    if (!hasRealRoute) {
      resp += `âš ï¸ Rota nÃ£o identificada para "${featureName}". Substitua \`PAGE_URL\` no spec ou adicione \`metadata.route\` ao nÃ³ Brain para geraÃ§Ã£o automÃ¡tica.\n\n`;
    }

    if (nodeMemories.length > 0) {
      const ruleCount = nodeMemories.filter((m) => m.memoryType === "RULE").length;
      const patternCount = nodeMemories.filter((m) => m.memoryType === "PATTERN").length;
      const techCount = nodeMemories.filter((m) => m.memoryType === "TECHNICAL_NOTE").length;
      const parts = [];
      if (ruleCount > 0) parts.push(`${ruleCount} regra${ruleCount > 1 ? "s" : ""}`);
      if (patternCount > 0) parts.push(`${patternCount} padrÃ£o${patternCount > 1 ? "Ãµes" : ""}`);
      if (techCount > 0) parts.push(`${techCount} nota${techCount > 1 ? "s" : ""} tÃ©cnica${techCount > 1 ? "s" : ""}`);
      if (parts.length) resp += `Incorporei ${parts.join(", ")} do Brain no spec.\n\n`;
    }

    if (brainPatterns.length > 0 && nodeMemories.length === 0) {
      resp += `PadrÃµes globais do Brain usados como referÃªncia: ${brainPatterns.slice(0, 3).map((p) => p.title).join("; ")}.\n\n`;
    }

    // Spec code block â€” mantÃ©m estrutura
    resp += `**Arquivo:** \`tests-e2e/${slug}.spec.ts\`\n\n`;
    resp += "```typescript\n";
    resp += specLines.join("\n");
    resp += "\n```\n\n";

    // O que falta â€” inline
    const missingItems: string[] = [];
    if (!hasRealRoute) missingItems.push(`rota real (substitua \`PAGE_URL\`)`);
    if (nodeMemories.filter((m) => m.memoryType === "RULE").length === 0)
      missingItems.push("memÃ³rias `RULE` no nÃ³ para gerar assertions automÃ¡ticas");
    if (nodeType === "Feature" || nodeType === "Module")
      missingItems.push("`data-testid` nos componentes JSX");

    if (missingItems.length > 0) {
      resp += `Para tornar o spec executÃ¡vel: ${missingItems.join(", ")}.\n\n`;
    }

    // NÃ³s vizinhos que tambÃ©m precisam de cobertura
    if (focusContext && focusContext.neighbors.length > 0) {
      const untested = focusContext.neighbors.filter((n) => n.type === "Feature" || n.type === "Module" || n.type === "Screen");
      if (untested.length > 0) {
        resp += `NÃ³s vizinhos que podem precisar de spec: ${formatNodeNames(untested, 3)}.\n\n`;
      }
    }

    // Defeitos no subgrafo que viraram regressÃ£o
    if (focusContext && focusContext.defects.length > 0) {
      resp += `Defeitos no subgrafo (cobertos como regressÃ£o no spec): ${focusContext.defects.slice(0, 4).map((d) => d.label).join(", ")}.\n\n`;
    }

    // Como executar â€” compacto
    resp += `Execute: \`npm run test:e2e -- --grep "${featureName}"\``;

    // Releases recentes com taxa de pass
    if (snap?.releases.length) {
      const releaseStats = snap.releases.slice(0, 4).map((r) => {
        const total = r.statsPass + r.statsFail + r.statsBlocked + r.statsNotRun;
        const passRate = total > 0 ? `${Math.round((r.statsPass / total) * 100)}% pass` : "sem stats";
        return `${r.title} (${passRate})`;
      });
      resp += `\n\n_Releases recentes para regressÃ£o: ${releaseStats.join(" | ")}._`;
    }

    yield* yieldText(adaptResponseTone(resp, input.question, "playwright"));
  }

  /** Gera blocos de teste especÃ­ficos por tipo de nÃ³ */
  private buildTypeSpecificTests(
    nodeType: string,
    featureName: string,
    memories: Array<{ memoryType: string; title: string; summary: string }>,
    detectedRoute?: string | null,
  ): string[] {
    const lines: string[] = [];
    const testId = featureName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const routeNote = detectedRoute ? `"${detectedRoute}"` : "PAGE_URL";

    switch (nodeType) {
      case "Feature":
      case "Module":
        lines.push(
          `  test("deve exibir conteÃºdo principal", async ({ page }) => {`,
          `    // Substitua pelo seletor real do componente principal`,
          `    await expect(page.getByTestId("${testId}-container")).toBeVisible();`,
          `    // Alternativa: await expect(page.getByRole("heading", { name: /${featureName.split(" ")[0]}/i })).toBeVisible();`,
          `  });`,
          ``,
          `  test("deve responder a interaÃ§Ã£o do usuÃ¡rio", async ({ page }) => {`,
          `    // Simule a aÃ§Ã£o principal (clique, submit, navegaÃ§Ã£o)`,
          `    // await page.getByRole("button", { name: "..." }).click();`,
          `    // await expect(page.getByRole("status")).toContainText("sucesso");`,
          `    // await expect(page).toHaveURL(${routeNote});`,
          `  });`,
        );
        break;
      case "Defect":
        lines.push(
          `  test("nÃ£o deve reproduzir o defeito original", async ({ page }) => {`,
          `    // RegressÃ£o para: ${featureName}`,
          `    // Passe pelos passos que reproduziam o defeito:`,
          `    // await page.getByTestId("${testId}-trigger").click();`,
          `    // await expect(page.getByRole("alert")).not.toBeVisible();`,
          `    // await expect(page.getByTestId("${testId}-result")).toBeVisible();`,
          `  });`,
        );
        break;
      case "Release":
        lines.push(
          `  test("deve manter funcionalidades da release", async ({ page }) => {`,
          `    // Smoke test para: ${featureName}`,
          `    await expect(page).not.toHaveURL(/error|500/);`,
          `    // Valide os entregÃ¡veis desta release:`,
          `    // await expect(page.getByTestId("${testId}-feature")).toBeVisible();`,
          `  });`,
        );
        break;
      case "API":
      case "Endpoint": {
        const apiPath = detectedRoute ?? "/api/...";
        lines.push(
          `  test("deve responder com sucesso (GET)", async ({ request }) => {`,
          `    const resp = await request.get("${apiPath}");`,
          `    expect(resp.ok()).toBeTruthy();`,
          `    // Valide o schema da resposta:`,
          `    // const body = await resp.json();`,
          `    // expect(body).toHaveProperty("data");`,
          `  });`,
          ``,
          `  test("deve rejeitar request invÃ¡lido (POST)", async ({ request }) => {`,
          `    const resp = await request.post("${apiPath}", { data: {} });`,
          `    // Expect 400 ou 422 para payload vazio:`,
          `    expect(resp.status()).toBeGreaterThanOrEqual(400);`,
          `  });`,
        );
        break;
      }
      default:
        lines.push(
          `  test("deve funcionar corretamente", async ({ page }) => {`,
          `    // Assertions especÃ­ficas para ${featureName}`,
          `    await expect(page.getByRole("heading", { name: /${featureName.split(" ")[0]}/i })).toBeVisible();`,
          `  });`,
        );
    }

    const patterns = memories.filter((m) => m.memoryType === "PATTERN").slice(0, 1);
    if (patterns.length > 0) {
      lines.push(
        ``,
        `  test("deve lidar com caso especial (padrÃ£o Brain)", async ({ page }) => {`,
        `    // PadrÃ£o: ${patterns[0].title}`,
        `    // ${patterns[0].summary.slice(0, 100)}`,
        `    // TODO: implemente o caso baseado no padrÃ£o acima`,
        `  });`,
      );
    }

    return lines;
  }

  // â”€â”€â”€ Memory Agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  private async *runMemory(input: EngineInput & { question: string }, snap: SystemSnapshot | null): AsyncGenerator<StreamEvent> {
    const toolId = makeId("search_brain");
    const learningQuery = buildLearningQuery(input.question, input.messages, input.screenLabel);

    yield { type: "tool-input-start", id: toolId, toolName: "search_brain" };
    yield { type: "tool-call", toolCallId: toolId, toolName: "search_brain", input: { query: learningQuery, scope: "memory" } };

    const searchResults = await searchNodes({ query: learningQuery, limit: 8 });

    let nodeMemories: Array<{ memoryType: string; title: string; summary: string; importance: number }> = [];
    let focusContext: FocusNodeContext | null = null;
    let focusNode: FocusNode | null = null;

    if (input.nodeId) {
      focusContext = await loadFocusNodeContext(input.nodeId);
      if (focusContext) {
        focusNode = focusContext.node;
        nodeMemories = focusContext.memories;
      }
    }

    const queryTerms = input.question.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    const globalMemories = await prisma.brainMemory.findMany({
      where: {
        status: "ACTIVE",
        OR:
          queryTerms.length > 0
            ? queryTerms.map((term) => ({
                OR: [
                  { title: { contains: term, mode: "insensitive" as const } },
                  { summary: { contains: term, mode: "insensitive" as const } },
                ],
              }))
            : [{ importance: { gte: 7 } }],
      },
      orderBy: { importance: "desc" },
      take: 10,
      include: { node: { select: { label: true, type: true } } },
    });

    yield {
      type: "tool-result",
      toolCallId: toolId,
      output: {
        nodeMemories: nodeMemories.length,
        globalMemories: globalMemories.length,
        relatedNodes: focusContext?.subgraphNodes.length ?? 0,
        directMemories: focusContext?.directMemories.length ?? 0,
      },
    };

    let resp = "";

    if (focusNode) {
      const descNote = focusNode.description ? ` â€” ${focusNode.description.slice(0, 110)}` : "";
      resp += `**${focusNode.label}** (${focusNode.type})${descNote}.\n\n`;

      // Contexto no grafo
      if (focusContext) {
        const structParts: string[] = [];
        if (focusContext.ancestors.length > 0) structParts.push(`dentro de ${formatNodeNames(focusContext.ancestors, 2)}`);
        if (focusContext.descendants.length > 0) structParts.push(`${focusContext.descendants.length} descendente${focusContext.descendants.length > 1 ? "s" : ""}`);
        if (focusContext.neighbors.length > 0) structParts.push(`${focusContext.neighbors.length} vizinho${focusContext.neighbors.length > 1 ? "s" : ""}: ${focusContext.neighbors.slice(0, 2).map((n) => n.label).join(", ")}`);
        if (focusContext.directMemories.length !== focusContext.memories.length) {
          structParts.push(`${focusContext.directMemories.length} diretas + ${focusContext.memories.length - focusContext.directMemories.length} herdadas`);
        }
        if (structParts.length > 0) resp += `_Contexto: ${structParts.join(" | ")}._\n\n`;
      }

      if (nodeMemories.length === 0) {
        resp += `Nenhuma memÃ³ria registrada neste nÃ³ ainda.\n\n`;
        resp += `Para comeÃ§ar, recomendo:\n`;
        resp += `- \`DECISION\` â€” decisÃ£o de produto ou arquitetura que define este ${focusNode.type.toLowerCase()}\n`;
        resp += `- \`RULE\` â€” regra de negÃ³cio invariÃ¡vel que ninguÃ©m pode esquecer\n`;
        resp += `- \`PATTERN\` â€” comportamento recorrente (positivo ou problemÃ¡tico)\n`;
        resp += `- \`EXCEPTION\` â€” caso de erro documentado com contexto ou stack trace\n\n`;
        resp += `Use a aba MemÃ³rias no Brain ou \`POST /api/brain/memories\` com \`nodeId\`, \`memoryType\`, \`title\`, \`summary\`, \`importance\` (1â€“10).`;

        // Mostra memÃ³rias de nÃ³s vizinhos como inspiraÃ§Ã£o
        if (globalMemories.length > 0) {
          resp += `\n\nMemÃ³rias de nÃ³s relacionados (referÃªncia para o que documentar):\n`;
          globalMemories.slice(0, 4).forEach((m) => {
            const nodeInfo = m.node ? ` _[${m.node.label}]_` : "";
            resp += `- **[${m.memoryType}] ${m.title}**${nodeInfo} _(${m.importance}/10)_ â€” ${m.summary.slice(0, 150)}\n`;
          });
        }
      } else {
        const critical = nodeMemories.filter((m) => m.importance >= 7).sort((a, b) => b.importance - a.importance);
        const contextual = nodeMemories.filter((m) => m.importance < 7).sort((a, b) => b.importance - a.importance);

        resp += `${nodeMemories.length} memÃ³ria${nodeMemories.length > 1 ? "s" : ""} registrada${nodeMemories.length > 1 ? "s" : ""}${critical.length > 0 ? ` (${critical.length} crÃ­tica${critical.length > 1 ? "s" : ""})` : ""}.\n\n`;

        if (critical.length > 0) {
          if (critical.length === 1) {
            resp += `MemÃ³ria crÃ­tica: **[${critical[0].memoryType}] ${critical[0].title}** _(${critical[0].importance}/10)_\n> ${critical[0].summary}\n\n`;
          } else {
            critical.forEach((m) => {
              resp += `**[${m.memoryType}] ${m.title}** _(${m.importance}/10)_\n> ${m.summary.slice(0, 300)}\n\n`;
            });
          }
        }

        if (contextual.length > 0) {
          if (critical.length > 0) {
            resp += `MemÃ³rias de contexto (${contextual.length}):\n`;
            contextual.slice(0, 5).forEach((m) => {
              resp += `- **[${m.memoryType}] ${m.title}** _(${m.importance}/10)_ â€” ${m.summary.slice(0, 170)}\n`;
            });
            if (contextual.length > 5) resp += `_...e mais ${contextual.length - 5}._\n`;
          } else {
            contextual.slice(0, 5).forEach((m) => {
              resp += `**[${m.memoryType}] ${m.title}** _(${m.importance}/10)_\n> ${m.summary.slice(0, 240)}\n\n`;
            });
            if (contextual.length > 5) resp += `_...e mais ${contextual.length - 5} memÃ³ria${contextual.length - 5 > 1 ? "s" : ""}._\n`;
          }
        }

        // MemÃ³rias herdadas de ancestrais
        if (focusContext && focusContext.ancestors.length > 0) {
          const ancestorMems = globalMemories.filter(
            (m) => m.node && focusContext!.ancestors.some((a) => a.label === m.node!.label),
          );
          if (ancestorMems.length > 0) {
            resp += `\nMemÃ³rias herdadas dos ancestrais (${ancestorMems.length}):\n`;
            ancestorMems.slice(0, 3).forEach((m) => {
              resp += `- **[${m.memoryType}] ${m.title}** _[${m.node!.label}]_ _(${m.importance}/10)_ â€” ${m.summary.slice(0, 160)}\n`;
            });
            if (ancestorMems.length > 3) resp += `_...e mais ${ancestorMems.length - 3}._\n`;
            resp += "\n";
          }
        }

        // Lacunas de documentaÃ§Ã£o
        const existingTypes = new Set(nodeMemories.map((m) => m.memoryType));
        const missingTypes = ["DECISION", "RULE"].filter((t) => !existingTypes.has(t));
        if (missingTypes.length > 0) {
          resp += `_Tipos ainda nÃ£o documentados: ${missingTypes.map((t) => `\`${t}\``).join(", ")}._\n`;
        }
      }
    }

    if (globalMemories.length > 0) {
      if (focusNode && nodeMemories.length > 0) {
        // Filtra memÃ³rias de ancestrais jÃ¡ mostradas
        const ancestorLabels = new Set(focusContext?.ancestors.map((a) => a.label) ?? []);
        const nonAncestorGlobals = globalMemories.filter((m) => !m.node || !ancestorLabels.has(m.node.label));

        if (nonAncestorGlobals.length > 0) {
          resp += `\nMemÃ³rias relacionadas no Brain (${nonAncestorGlobals.length}):\n`;
          nonAncestorGlobals.slice(0, 5).forEach((m) => {
            const nodeInfo = m.node ? ` [${m.node.label}]` : "";
            resp += `- **[${m.memoryType}] ${m.title}**${nodeInfo} _(${m.importance}/10)_ â€” ${m.summary.slice(0, 160)}\n`;
          });
          if (nonAncestorGlobals.length > 5) resp += `_...e mais ${nonAncestorGlobals.length - 5}._\n`;
        }
      } else if (!focusNode) {
        resp += `Encontrei ${globalMemories.length} memÃ³ria${globalMemories.length > 1 ? "s" : ""} para **"${input.question}"**:\n\n`;

        const byType: Record<string, typeof globalMemories> = {};
        globalMemories.forEach((m) => {
          if (!byType[m.memoryType]) byType[m.memoryType] = [];
          byType[m.memoryType].push(m);
        });

        const typeOrder = ["DECISION", "RULE", "PATTERN", "EXCEPTION", "CONTEXT", "TECHNICAL_NOTE"];
        const sortedTypes = [
          ...typeOrder.filter((t) => byType[t]),
          ...Object.keys(byType).filter((t) => !typeOrder.includes(t)),
        ];

        for (const type of sortedTypes) {
          const mems = byType[type];
          resp += `**${type}${mems.length > 1 ? ` (${mems.length})` : ""}:**\n`;
          mems.slice(0, 4).forEach((m) => {
            const nodeInfo = m.node ? ` _[${m.node.label}]_` : "";
            resp += `- **${m.title}**${nodeInfo} _(${m.importance}/10)_ â€” ${m.summary.slice(0, 200)}\n`;
          });
          if (mems.length > 4) resp += `_...e mais ${mems.length - 4}._\n`;
          resp += "\n";
        }

        // NÃ³s da busca como referÃªncia adicional
        if (searchResults.length > 0) {
          resp += `NÃ³s encontrados (${searchResults.length}):\n`;
          searchResults.slice(0, 5).forEach((node) => {
            resp += `- **${node.label}** (${node.type})${node.description ? ` â€” ${node.description.slice(0, 120)}` : ""}\n`;
          });
          resp += "\n";
        }
      }
    } else if (!focusNode) {
      resp += `Nenhuma memÃ³ria encontrada para **"${input.question}"** no Brain.\n\n`;

      if (searchResults.length > 0) {
        resp += `NÃ³s relacionados (sem memÃ³rias documentadas ainda):\n`;
        searchResults.slice(0, 5).forEach((node) => {
          resp += `- **${node.label}** (${node.type})${node.description ? ` â€” ${node.description.slice(0, 130)}` : ""}\n`;
        });
        resp += "\n";
      }

      resp += `Para registrar: \`POST /api/brain/memories\` com \`nodeId\`, \`memoryType\`, \`title\`, \`summary\`, \`importance\` (1-10).`;
    }

    if (snap) {
      const inline = snapshotInline(snap);
      if (inline) resp += `\n\n${inline}`;
    }
    yield* yieldText(adaptResponseTone(resp, input.question, "memory"));
  }
}

