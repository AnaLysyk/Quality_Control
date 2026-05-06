import "server-only";

import { prisma } from "@/lib/prismaClient";
import {
  searchNodes,
  getNodeMemories,
  getSubgraph,
  getGraphMetrics,
} from "@/lib/brain";
import { detectAgentMode } from "@/lib/brain/agents";
import type { AgentMode } from "@/lib/brain/agents";

// ─── Tipos de evento de stream (compatíveis com AgentView) ─────────────────
// text-delta  → { type, text }
// tool-input-start → { type, id, toolName }
// tool-call        → { type, toolCallId, toolName, input }
// tool-result      → { type, toolCallId, output }
// error            → { type, error }
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
};

// ─── Helpers ────────────────────────────────────────────────────────────────
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

/**
 * Extrai o título da última resposta do assistente para referência de continuidade.
 * Retorna null se for a primeira mensagem da conversa.
 */
function extractPriorContext(messages?: Array<{ role: "user" | "assistant"; content: string }>): string | null {
  if (!messages || messages.length < 2) return null;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant) return null;
  const firstLine = lastAssistant.content.split("\n")[0].replace(/^#+\s*/, "").trim();
  return firstLine.slice(0, 120) || null;
}

/** Tenta extrair uma rota de URL da descrição ou label do nó. */
function extractRouteFromNode(
  node: { label: string; description?: string | null } | null,
  fallback?: string | null,
): string | null {
  if (fallback && fallback !== "/" && fallback !== "") return fallback;
  if (!node) return null;
  const haystack = `${node.label} ${node.description ?? ""}`;
  const match = haystack.match(/(?:rota|route|path|url|href)[:\s]+([/][^\s,)'"]+)/i)
    ?? haystack.match(/([/][a-z][a-z0-9/-]+)/i);
  return match ? match[1] : null;
}

function isCasualConversation(question: string) {
  const n = question.trim().toLowerCase();
  if (!n) return true;

  const technicalTerms = /(ticket|chamado|bug|erro|falha|defect|playwright|teste|testes|spec|release|deploy|api|endpoint|permiss|acesso|m[ée]trica|dashboard|empresa|usu[áa]rio|node|n[oó])/;
  if (technicalTerms.test(n)) return false;

  const casualPatterns = [
    /^(oi|ola|ol[áa]|e ai|e a[ií]|bom dia|boa tarde|boa noite)\b/,
    /^(tudo bem|como vai|como voce est[aá]|como você est[aá])\b/,
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
    return `Disponha. Se quiser, eu já sigo com o próximo passo${label}.`;
  }

  if (/^(me ajuda|pode ajudar|preciso de ajuda|ajuda)\b/.test(n)) {
    return `Claro. Me diz em uma frase o que você quer resolver${label} e eu vou direto ao ponto.`;
  }

  if (/^(oi|ola|ol[áa]|e ai|e a[ií]|bom dia|boa tarde|boa noite|tudo bem|como vai|como voce est[aá]|como você est[aá])\b/.test(n)) {
    return `Tudo certo. O que você quer resolver agora${label}?`;
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

  if (/^(sim|isso|ok|blz|beleza|fechou|pode|continua|continuar)\b/.test(n) && previousTopic) {
    return `Perfeito, continuando sobre "${previousTopic}"${label}. Quer que eu siga com resumo rápido ou já com ação prática?`;
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
  if (/(diretoria|executiv|lideran|gest[aã]o|gestao|resumo rapido|resumo r[aá]pido|decis[aã]o|status para lideran[aç]a)/.test(n)) {
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
  const keepSection = (section: string) => /(diagn[oó]stico|recomenda|pr[oó]ximos passos|o que encontrei)/i.test(section);

  const out: string[] = [];
  out.push(`## Resumo executivo — ${title}`);
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
    return `## Resumo executivo\n\nPrincipais pontos preparados. Se quiser, eu transformo em plano de ação de 3 itens com prioridade.`;
  }

  out.push("");
  out.push("Se quiser, eu transformo isso em plano de ação curto para liderança (impacto, risco e próximo passo).\n");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ─── Engine principal ────────────────────────────────────────────────────────
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

      if (isCasualConversation(question)) {
        yield* yieldText(buildHumanContinuationReply(question, input.screenLabel, input.messages));
        return;
      }

      const agentMode: AgentMode =
        input.agentMode && ["qa", "debug", "playwright", "memory"].includes(input.agentMode)
          ? input.agentMode
          : detectAgentMode(question);

      switch (agentMode) {
        case "qa":
          yield* this.runQA({ ...input, question });
          break;
        case "debug":
          yield* this.runDebug({ ...input, question });
          break;
        case "playwright":
          yield* this.runPlaywright({ ...input, question });
          break;
        case "memory":
          yield* this.runMemory({ ...input, question });
          break;
      }
    } catch (err) {
      yield { type: "error", error: String(err) };
    }
  }

  // ─── QA Agent ─────────────────────────────────────────────────────────────
  private async *runQA(input: EngineInput & { question: string }): AsyncGenerator<StreamEvent> {
    const toolId = makeId("search_brain");
    const learningQuery = buildLearningQuery(input.question, input.messages, input.screenLabel);
    const flowIntro = buildHumanizedFlowIntro(input.question, input.messages, input.screenLabel);

    yield { type: "tool-input-start", id: toolId, toolName: "search_brain" };
    yield { type: "tool-call", toolCallId: toolId, toolName: "search_brain", input: { query: learningQuery } };

    const [searchResults, metrics] = await Promise.all([
      searchNodes({ query: learningQuery, limit: 8 }),
      getGraphMetrics(),
    ]);

    let focusNode: { id: string; label: string; type: string; description?: string | null } | null = null;
    let defects: Array<{ label: string; description?: string | null }> = [];
    let testRuns: Array<{ label: string; description?: string | null }> = [];
    let releases: Array<{ label: string }> = [];
    let memories: Array<{ memoryType: string; title: string; summary: string; importance: number }> = [];

    if (input.nodeId) {
      focusNode = await prisma.brainNode.findUnique({ where: { id: input.nodeId } });
      if (focusNode) {
        const sub = await getSubgraph(input.nodeId, 2);
        defects = sub.nodes.filter((n) => n.type === "Defect");
        testRuns = sub.nodes.filter((n) => n.type === "TestRun");
        releases = sub.nodes.filter((n) => n.type === "Release");
        memories = await getNodeMemories(input.nodeId);
      }
    }

    yield {
      type: "tool-result",
      toolCallId: toolId,
      output: { found: searchResults.length, defects: defects.length, testRuns: testRuns.length, releases: releases.length, memories: memories.length },
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
    const priorCtx = extractPriorContext(input.messages);

    if (focusNode) {
      const criticalMems = memories.filter((m) => m.importance >= 7);
      const otherMems = memories.filter((m) => m.importance < 7);
      const defectRatio = defects.length / Math.max(1, testRuns.length);

      const riskLevel =
        defects.length > 5 || defectRatio > 3
          ? { label: "🔴 Alto", note: "Volume crítico de defeitos — intervenção imediata recomendada." }
          : defects.length > 2 || defectRatio > 1.5
            ? { label: "🟡 Médio", note: "Defeitos presentes — monitorar e planejar correções." }
            : testRuns.length === 0
              ? { label: "🟠 Indefinido", note: "Sem execuções de teste — não é possível afirmar estabilidade." }
              : { label: "🟢 Baixo", note: "Cobertura adequada para o volume de defeitos." };

      resp += `## Análise QA — ${focusNode.label}\n`;
      resp += `${flowIntro}\n`;
      if (priorCtx) resp += `_Continuando a partir de: "${priorCtx}"_\n`;
      resp += `**Tipo:** ${focusNode.type} | **Risco:** ${riskLevel.label}\n\n`;
      if (focusNode.description) resp += `> ${focusNode.description}\n\n`;

      // ── Seção 1: O que encontrei ──────────────────────────────────────────
      resp += `### 📊 O que encontrei\n`;
      resp += `- **Defeitos:** ${defects.length === 0 ? "nenhum no subgrafo (profundidade 2)" : `${defects.length} registrado(s)`}\n`;
      resp += `- **Execuções de teste:** ${testRuns.length === 0 ? "nenhuma" : `${testRuns.length} TestRun(s)`}\n`;
      resp += `- **Releases:** ${releases.length === 0 ? "nenhuma" : `${releases.length} release(s)`}\n`;
      resp += `- **Memórias:** ${
        memories.length === 0
          ? "nenhuma — nó sem histórico documentado"
          : `${memories.length} (${criticalMems.length} crítica(s) / ${otherMems.length} de contexto)`
      }\n\n`;

      // ── Seção 2: Diagnóstico ──────────────────────────────────────────────
      resp += `### 🩺 Diagnóstico\n`;
      resp += `${riskLevel.note}\n`;
      if (defects.length > 0 && testRuns.length > 0) {
        resp += `Ratio defeitos/execuções: **${defectRatio.toFixed(1)}** — ${defectRatio > 2 ? "alto, cobertura insuficiente para o volume de problemas" : "aceitável"}\n`;
      }
      if (releases.length > 0 && testRuns.length === 0) {
        resp += `⚠️ Existem ${releases.length} release(s) mas nenhuma execução de teste registrada — alto risco de regressão não detectada.\n`;
      }
      resp += "\n";

      // ── Seção 3: Evidências ───────────────────────────────────────────────
      resp += `### 📋 Evidências\n`;

      if (defects.length > 0) {
        resp += `**Defeitos (${defects.length}):**\n`;
        defects.slice(0, 6).forEach((d) => {
          resp += `- **${d.label}**`;
          if (d.description) resp += ` — _${d.description.slice(0, 140)}_`;
          resp += "\n";
        });
        if (defects.length > 6) resp += `_...e mais ${defects.length - 6} defeito(s) no grafo._\n`;
        resp += "\n";
      } else {
        resp += `**Defeitos:** nenhum registrado neste nó.\n\n`;
      }

      if (testRuns.length > 0) {
        resp += `**Execuções de teste (${testRuns.length}):**\n`;
        testRuns.slice(0, 5).forEach((r) => { resp += `- ${r.label}\n`; });
        if (testRuns.length > 5) resp += `_...e mais ${testRuns.length - 5} run(s)._\n`;
        resp += "\n";
      } else {
        resp += `**Execuções de teste:** nenhuma encontrada.\n\n`;
      }

      if (releases.length > 0) {
        resp += `**Releases (${releases.length}):**\n`;
        releases.slice(0, 5).forEach((r) => { resp += `- ${r.label}\n`; });
        resp += "\n";
      }

      if (criticalMems.length > 0) {
        resp += `**Memórias críticas (${criticalMems.length}):**\n`;
        criticalMems.slice(0, 4).forEach((m) => {
          resp += `- **[${m.memoryType}] ${m.title}** _(${m.importance}/10)_\n  > ${m.summary.slice(0, 180)}\n`;
        });
        resp += "\n";
      }
      if (otherMems.length > 0) {
        resp += `**Memórias de contexto (${otherMems.length}):**\n`;
        otherMems.slice(0, 3).forEach((m) => {
          resp += `- **[${m.memoryType}]** ${m.title} _(${m.importance}/10)_: ${m.summary.slice(0, 100)}\n`;
        });
        resp += "\n";
      }

      // ── Seção 4: Recomendações ────────────────────────────────────────────
      resp += `### 💡 Recomendações\n`;
      const recs: string[] = [];
      if (defects.length === 0 && testRuns.length > 0)
        recs.push("✅ Nenhum defeito encontrado — módulo aparentemente saudável. Manter cadência.");
      if (defects.length > 3)
        recs.push(`⚠️ ${defects.length} defeitos ativos — priorize triagem pelos mais recentes.`);
      if (testRuns.length === 0)
        recs.push("🚨 Sem cobertura de testes — crie suite mínima para este módulo.");
      if (releases.length > 0 && testRuns.length === 0)
        recs.push("🚨 Releases sem validação de testes — risco direto de regressão em produção.");
      if (defectRatio > 2 && testRuns.length > 0)
        recs.push(`⚠️ Ratio ${defectRatio.toFixed(1)} defeitos/run — adicione mais casos de teste para cobrir os problemas existentes.`);
      if (memories.length === 0)
        recs.push("📝 Sem memórias — documente decisões e regras críticas deste módulo no Brain.");
      if (recs.length === 0) recs.push("Nenhuma recomendação crítica no momento.");
      recs.forEach((r) => { resp += `${r}\n`; });
      resp += "\n";

      // ── Seção 5: Próximos passos ──────────────────────────────────────────
      resp += `### ⏭️ Próximos passos\n`;
      if (defects.length > 0) resp += `1. Revise os ${defects.length} defeito(s) listados e classifique por severidade\n`;
      if (testRuns.length === 0) resp += `${defects.length > 0 ? 2 : 1}. Crie uma suite de testes mínima para este módulo\n`;
      if (memories.length === 0) resp += `- Registre ao menos uma memória \`RULE\` ou \`DECISION\` para documentar o que sabe sobre este nó\n`;
      resp += `- Use "Gerar teste Playwright" para obter um spec baseado neste contexto\n`;

    } else if (searchResults.length > 0) {
      const byType: Record<string, typeof searchResults> = {};
      for (const node of searchResults) {
        if (!byType[node.type]) byType[node.type] = [];
        byType[node.type].push(node);
      }

      resp += `## QA — "${input.question}"\n`;
      resp += `${flowIntro}\n`;
      if (priorCtx) resp += `_Continuando a partir de: "${priorCtx}"_\n`;
      resp += `\n`;
      resp += `**Brain:** ${metrics.nodeCount} nós | ${metrics.edgeCount} conexões | ${metrics.memoryCount} memórias\n\n`;

      resp += `### 📊 O que encontrei\n`;
      resp += `- ${searchResults.length} nó(s) relacionado(s) à query\n`;
      resp += `- Tipos: ${Object.keys(byType).join(", ")}\n\n`;

      for (const [type, nodes] of Object.entries(byType)) {
        resp += `**${type} (${nodes.length}):**\n`;
        nodes.slice(0, 4).forEach((node) => {
          resp += `- **${node.label}**`;
          if (node.description) resp += ` — ${node.description.slice(0, 120)}`;
          resp += "\n";
        });
        resp += "\n";
      }

      const hasDefects = byType["Defect"]?.length > 0;
      const hasTestRuns = byType["TestRun"]?.length > 0;
      resp += `### 🩺 Diagnóstico\n`;
      if (hasDefects && !hasTestRuns)
        resp += "🚨 Defeitos encontrados sem execuções de teste visíveis — selecione um nó no grafo para análise detalhada.\n";
      else if (hasDefects && hasTestRuns)
        resp += "🟡 Defeitos e execuções presentes — selecione um nó específico para ver risco por módulo.\n";
      else
        resp += "Selecione um nó no Brain para análise detalhada de cobertura e risco.\n";
    } else {
      resp += `## QA — sem dados\n\n`;
      resp += `${flowIntro}\n\n`;
      resp += `### 📊 O que encontrei\n`;
      resp += `- Busca por "${input.question}" retornou **0 nós** no Brain\n`;
      resp += `- Brain atual: ${metrics.nodeCount} nós, ${metrics.edgeCount} conexões\n\n`;
      resp += `### 🩺 Diagnóstico\nNão há dados suficientes para análise. O Brain pode não ter sido sincronizado para esta empresa ou query.\n\n`;
      resp += `### ⏭️ Próximos passos\n`;
      resp += `- Selecione um nó no grafo e clique em "Analisar riscos"\n`;
      resp += `- Sincronize via \`/api/brain/sync\`\n`;
      resp += `- Verifique se a empresa está cadastrada no Brain\n`;
    }

    yield* yieldText(adaptResponseTone(resp, input.question, "qa"));
  }

  // ─── Debug Agent ──────────────────────────────────────────────────────────
  private async *runDebug(input: EngineInput & { question: string }): AsyncGenerator<StreamEvent> {
    const toolId = makeId("search_brain");
    const learningQuery = buildLearningQuery(input.question, input.messages, input.screenLabel);
    const flowIntro = buildHumanizedFlowIntro(input.question, input.messages, input.screenLabel);

    yield { type: "tool-input-start", id: toolId, toolName: "search_brain" };
    yield { type: "tool-call", toolCallId: toolId, toolName: "search_brain", input: { query: learningQuery, scope: "debug" } };

    const searchResults = await searchNodes({ query: learningQuery, limit: 10 });

    let focusNode: { id: string; label: string; type: string; description?: string | null } | null = null;
    let defects: Array<{ label: string; description?: string | null }> = [];
    let exceptions: Array<{ memoryType: string; title: string; summary: string }> = [];
    let recentAudit: Array<{ action: string; entityType?: string | null; createdAt: Date }> = [];

    if (input.nodeId) {
      focusNode = await prisma.brainNode.findUnique({ where: { id: input.nodeId } });
      if (focusNode) {
        const sub = await getSubgraph(input.nodeId, 2);
        defects = sub.nodes.filter((n) => n.type === "Defect");
        const allMem = await getNodeMemories(input.nodeId);
        exceptions = allMem.filter(
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
      output: { found: searchResults.length, defects: defects.length, exceptions: exceptions.length, auditLogs: recentAudit.length },
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
    const priorCtx = extractPriorContext(input.messages);

    if (focusNode) {
      resp += `## 🐛 Debug — ${focusNode.label}\n`;
      resp += `${flowIntro}\n`;
      if (priorCtx) resp += `_Continuando a partir de: "${priorCtx}"_\n`;
      if (focusNode.description) resp += `> ${focusNode.description}\n`;
      resp += "\n";

      // ── Seção 1: O que encontrei ──────────────────────────────────────────
      resp += `### 📊 O que encontrei\n`;
      resp += `- **Exceções/notas técnicas:** ${exceptions.length === 0 ? "nenhuma (memoryType EXCEPTION/TECHNICAL_NOTE)" : `${exceptions.length} registrada(s)`}\n`;
      resp += `- **Defeitos conectados:** ${defects.length === 0 ? "nenhum no subgrafo" : `${defects.length}`}\n`;
      resp += `- **Logs de auditoria do nó:** ${recentAudit.length === 0 ? "nenhum" : `${recentAudit.length} entradas recentes`}\n`;
      resp += `- **Exceções globais no Brain:** ${globalExceptions.length}\n\n`;

      // ── Seção 2: Diagnóstico ──────────────────────────────────────────────
      resp += `### 🩺 Diagnóstico\n`;
      const hasEvidence = exceptions.length > 0 || defects.length > 0;
      if (hasEvidence) {
        if (exceptions.length > 0 && defects.length > 0)
          resp += `Existem ${exceptions.length} exceção(ões) documentada(s) e ${defects.length} defeito(s) associado(s) — evidências reais de problema.\n`;
        else if (exceptions.length > 0)
          resp += `${exceptions.length} exceção(ões) documentada(s) neste nó. Sem defeitos ativos associados.\n`;
        else
          resp += `${defects.length} defeito(s) conectado(s), mas nenhuma exceção EXCEPTION documentada. Pode indicar defeitos funcionais sem stack trace registrado.\n`;
      } else {
        resp += `Nenhuma exceção (EXCEPTION/TECHNICAL_NOTE) ou defeito encontrado diretamente neste nó.\n`;
        if (recentAudit.length > 0)
          resp += `Há ${recentAudit.length} log(s) de auditoria — pode indicar mudanças recentes que merecem revisão.\n`;
        else
          resp += `Sem logs de auditoria recentes. O nó parece estável ou não foi monitorado.\n`;
      }
      resp += "\n";

      // ── Seção 3: Evidências ───────────────────────────────────────────────
      resp += `### 📋 Evidências\n`;

      if (exceptions.length > 0) {
        resp += `**Exceções/notas técnicas (${exceptions.length}) — dado real:**\n`;
        exceptions.forEach((m) => {
          resp += `- **[${m.memoryType}] ${m.title}**\n  > ${m.summary.slice(0, 300)}\n`;
        });
        resp += "\n";
      } else {
        resp += `**Exceções:** nenhuma registrada com memoryType=EXCEPTION ou TECHNICAL_NOTE para este nó.\n\n`;
      }

      if (defects.length > 0) {
        resp += `**Defeitos conectados (${defects.length}) — dado real:**\n`;
        defects.slice(0, 6).forEach((d) => {
          resp += `- **${d.label}**`;
          if (d.description) resp += `\n  _${d.description.slice(0, 200)}_`;
          resp += "\n";
        });
        if (defects.length > 6) resp += `_...e mais ${defects.length - 6} defeito(s)._\n`;
        resp += "\n";
      }

      if (recentAudit.length > 0) {
        resp += `**Histórico de auditoria (${recentAudit.length} entradas):**\n`;
        recentAudit.forEach((log) => {
          const date = new Date(log.createdAt).toLocaleDateString("pt-BR");
          resp += `- \`${log.action}\` (${log.entityType ?? "—"}) — ${date}\n`;
        });
        resp += "\n";
      }

      // ── Seção 4: Hipóteses ────────────────────────────────────────────────
      resp += `### 🔍 Hipóteses\n`;
      const hypotheses: string[] = [];
      if (exceptions.length > 0) {
        hypotheses.push(`🔴 **[baseado em dado real]** Exceção documentada "${exceptions[0].title}" — revise se ainda reproduz no ambiente atual.`);
      }
      if (defects.length > 3) {
        hypotheses.push(`🟡 **[baseado em dado real]** ${defects.length} defeitos ativos — possível regressão ou mudança recente sem cobertura suficiente.`);
      }
      if (recentAudit.some((a) => a.action.includes("DELETE") || a.action.includes("UPDATE"))) {
        const changeLog = recentAudit.find((a) => a.action.includes("DELETE") || a.action.includes("UPDATE"));
        const changeDate = changeLog ? new Date(changeLog.createdAt).toLocaleDateString("pt-BR") : "data desconhecida";
        hypotheses.push(`🟡 **[baseado em dado real]** Ação \`${changeLog?.action}\` em ${changeDate} — verificar se alteração no Brain impactou o fluxo.`);
      }
      if (hypotheses.length === 0) {
        hypotheses.push("⚪ **[sem evidência direta]** Nenhum dado de defeito, exceção ou mudança recente encontrado neste nó.");
        hypotheses.push("⚪ Se o problema existe, registre uma memória `EXCEPTION` com o stack trace para documentá-lo.");
      }
      hypotheses.forEach((h) => { resp += `${h}\n`; });
      resp += "\n";

      // ── Seção 5: Próximos passos ──────────────────────────────────────────
      resp += `### ⏭️ Próximos passos\n`;
      if (exceptions.length > 0) resp += `1. Reproduza "${exceptions[0].title}" no ambiente de dev e confirme se ainda ocorre\n`;
      if (defects.length > 0) resp += `${exceptions.length > 0 ? 2 : 1}. Revise os ${defects.length} defeito(s) conectados e atualize o status\n`;
      resp += `- Registre memória \`EXCEPTION\` com stack trace completo se houver novo erro\n`;
      if (globalExceptions.length > 0) resp += `- ${globalExceptions.length} exceção(ões) global(is) no Brain — verifique se alguma é relevante para este nó\n`;

    } else if (searchResults.length > 0) {
      resp += `## 🐛 Debug — "${input.question}"\n`;
      resp += `${flowIntro}\n`;
      if (priorCtx) resp += `_Continuando a partir de: "${priorCtx}"_\n`;
      resp += `\n`;

      resp += `### 📊 O que encontrei\n`;
      resp += `- ${searchResults.length} nó(s) relacionado(s) à query\n`;
      resp += `- Nenhum nodeId específico selecionado — análise por busca textual\n\n`;

      resp += `### 📋 Nós relacionados\n`;
      for (const node of searchResults.slice(0, 5)) {
        resp += `- **${node.label}** (${node.type})`;
        if (node.description) resp += ` — ${node.description.slice(0, 140)}`;
        resp += "\n";
      }
      resp += "\n";

      if (globalExceptions.length > 0) {
        resp += `### 🔴 Exceções globais no Brain (${globalExceptions.length})\n`;
        globalExceptions.slice(0, 4).forEach((m) => {
          resp += `**${m.title}** _(importância: ${m.importance}/10)_\n> ${m.summary.slice(0, 200)}\n\n`;
        });
      }
      resp += `_Selecione um nó específico no grafo para análise de exceções e defeitos por nó._\n`;
    } else {
      resp += `## 🐛 Debug — sem dados\n\n`;
      resp += `${flowIntro}\n\n`;
      resp += `### 📊 O que encontrei\n`;
      resp += `- Busca por "${input.question}" retornou **0 nós**\n`;
      resp += `- Exceções globais no Brain: ${globalExceptions.length}\n\n`;
      resp += `### ⏭️ Próximos passos\n`;
      resp += `- Selecione o nó afetado no grafo e tente novamente\n`;
      resp += `- Sincronize via \`/api/brain/sync\`\n`;
      resp += `- Registre uma memória \`EXCEPTION\` com o stack trace para documentar o problema\n`;
    }

    yield* yieldText(adaptResponseTone(resp, input.question, "debug"));
  }

  // ─── Playwright Agent ─────────────────────────────────────────────────────
  private async *runPlaywright(input: EngineInput & { question: string }): AsyncGenerator<StreamEvent> {
    const toolId = makeId("generate_test_spec");
    const flowIntro = buildHumanizedFlowIntro(input.question, input.messages, input.screenLabel);

    yield { type: "tool-input-start", id: toolId, toolName: "generate_test_spec" };
    yield {
      type: "tool-call",
      toolCallId: toolId,
      toolName: "generate_test_spec",
      input: { feature: input.question, route: input.route, nodeId: input.nodeId },
    };

    let focusNode: { id: string; label: string; type: string; description?: string | null } | null = null;
    let nodeMemories: Array<{ memoryType: string; title: string; summary: string }> = [];

    if (input.nodeId) {
      focusNode = await prisma.brainNode.findUnique({ where: { id: input.nodeId } });
      if (focusNode) {
        const all = await getNodeMemories(input.nodeId);
        nodeMemories = all.filter((m) =>
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
    const pageUrl = detectedRoute ?? `/* rota não encontrada para "${featureName}" */`;

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
      focusNode ? ` * Nó Brain: ${focusNode.id} (${nodeType})` : ` * Query: ${input.question}`,
      focusNode?.description ? ` * ${focusNode.description.slice(0, 100)}` : null,
      hasRealRoute ? null : ` * ⚠️ SKELETON: rota não identificada — substitua a constante PAGE_URL`,
      ` */`,
      hasRealRoute ? null : `const PAGE_URL = "/* TODO: adicione a rota deste nó */";`,
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
            `  test("deve respeitar regras de negócio", async ({ page }) => {`,
            ...ruleAssertions,
            `  });`,
          ]
        : []),
      ...(nodeMemories.length > 0
        ? [
            ``,
            `  // Padrões registrados no Brain:`,
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
        routeDetected: hasRealRoute,
        route: pageUrl,
      },
    };

    const priorCtx = extractPriorContext(input.messages);

    let resp = `## 🎭 Playwright — ${featureName}\n`;
    resp += `${flowIntro}\n`;
    if (priorCtx) resp += `_Continuando a partir de: "${priorCtx}"_\n`;
    resp += `\n`;
    if (focusNode?.description) resp += `> ${focusNode.description.slice(0, 180)}\n\n`;

    // ── Seção 1: Contexto ─────────────────────────────────────────────────
    resp += `### 📊 O que encontrei\n`;
    resp += `- **Nó:** ${focusNode ? `${focusNode.label} (${nodeType})` : "não selecionado — gerado por query"}\n`;
    resp += `- **Rota:** ${hasRealRoute ? `\`${pageUrl}\`` : "⚠️ **não identificada** — spec gerado como skeleton"}\n`;
    resp += `- **Memórias de padrão/regra:** ${nodeMemories.length === 0 ? "nenhuma" : `${nodeMemories.length} incorporada(s) ao spec`}\n\n`;

    if (!hasRealRoute) {
      resp += `> ⚠️ **Rota não encontrada** para o nó "${featureName}". Para que o spec seja executável:\n`;
      resp += `> 1. Adicione o campo \`route\` ou \`metadata.route\` ao nó Brain\n`;
      resp += `> 2. Ou inclua a rota na descrição do nó no formato: \`rota: /caminho/da/pagina\`\n`;
      resp += `> Até lá, substitua \`PAGE_URL\` no spec abaixo pela rota correta.\n\n`;
    }

    // ── Seção 2: Spec ────────────────────────────────────────────────────
    resp += `**Arquivo:** \`tests-e2e/${slug}.spec.ts\`\n\n`;
    resp += "```typescript\n";
    resp += specLines.join("\n");
    resp += "\n```\n\n";

    // ── Seção 3: O que falta para completar ──────────────────────────────
    const missingItems: string[] = [];
    if (!hasRealRoute) missingItems.push("Rota real da tela/endpoint — adicione ao nó Brain ou substitua `PAGE_URL`");
    if (nodeMemories.filter((m) => m.memoryType === "RULE").length === 0)
      missingItems.push("Memórias `RULE` — adicione regras de negócio ao nó para gerar assertions automáticas");
    if (nodeType === "Feature" || nodeType === "Module")
      missingItems.push("Seletores reais (`data-testid`) — adicione aos componentes JSX e substitua os `TODO` no spec");
    if (nodeType === "API" || nodeType === "Endpoint")
      missingItems.push("URL e schema da resposta esperada — adicione na descrição do nó");

    if (missingItems.length > 0) {
      resp += `### 🔧 O que falta para completar o spec\n`;
      missingItems.forEach((item) => { resp += `- ${item}\n`; });
      resp += "\n";
    }

    if (brainPatterns.length > 0) {
      resp += `### Padrões globais do Brain\n`;
      brainPatterns.slice(0, 3).forEach((p) => {
        resp += `- **[${p.memoryType}]** ${p.title}: ${p.summary.slice(0, 120)}\n`;
      });
      resp += "\n";
    }

    // ── Seção 4: Como executar ────────────────────────────────────────────
    resp += `### ⏭️ Como executar\n`;
    resp += `1. Salve como \`tests-e2e/${slug}.spec.ts\`\n`;
    if (!hasRealRoute) resp += `2. **Substitua** \`PAGE_URL\` pela rota real\n`;
    resp += `${hasRealRoute ? 2 : 3}. Substitua os \`TODO\` por assertions reais do componente\n`;
    resp += `${hasRealRoute ? 3 : 4}. Execute: \`npm run test:e2e -- --grep "${featureName}"\`\n`;

    yield* yieldText(adaptResponseTone(resp, input.question, "playwright"));
  }

  /** Gera blocos de teste específicos por tipo de nó */
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
          `  test("deve exibir conteúdo principal", async ({ page }) => {`,
          `    // Substitua pelo seletor real do componente principal`,
          `    await expect(page.getByTestId("${testId}-container")).toBeVisible();`,
          `    // Alternativa: await expect(page.getByRole("heading", { name: /${featureName.split(" ")[0]}/i })).toBeVisible();`,
          `  });`,
          ``,
          `  test("deve responder a interação do usuário", async ({ page }) => {`,
          `    // Simule a ação principal (clique, submit, navegação)`,
          `    // await page.getByRole("button", { name: "..." }).click();`,
          `    // await expect(page.getByRole("status")).toContainText("sucesso");`,
          `    // await expect(page).toHaveURL(${routeNote});`,
          `  });`,
        );
        break;
      case "Defect":
        lines.push(
          `  test("não deve reproduzir o defeito original", async ({ page }) => {`,
          `    // Regressão para: ${featureName}`,
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
          `    // Valide os entregáveis desta release:`,
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
          `  test("deve rejeitar request inválido (POST)", async ({ request }) => {`,
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
          `    // Assertions específicas para ${featureName}`,
          `    await expect(page.getByRole("heading", { name: /${featureName.split(" ")[0]}/i })).toBeVisible();`,
          `  });`,
        );
    }

    const patterns = memories.filter((m) => m.memoryType === "PATTERN").slice(0, 1);
    if (patterns.length > 0) {
      lines.push(
        ``,
        `  test("deve lidar com caso especial (padrão Brain)", async ({ page }) => {`,
        `    // Padrão: ${patterns[0].title}`,
        `    // ${patterns[0].summary.slice(0, 100)}`,
        `    // TODO: implemente o caso baseado no padrão acima`,
        `  });`,
      );
    }

    return lines;
  }

  // ─── Memory Agent ─────────────────────────────────────────────────────────
  private async *runMemory(input: EngineInput & { question: string }): AsyncGenerator<StreamEvent> {
    const toolId = makeId("search_brain");
    const learningQuery = buildLearningQuery(input.question, input.messages, input.screenLabel);
    const flowIntro = buildHumanizedFlowIntro(input.question, input.messages, input.screenLabel);

    yield { type: "tool-input-start", id: toolId, toolName: "search_brain" };
    yield { type: "tool-call", toolCallId: toolId, toolName: "search_brain", input: { query: learningQuery, scope: "memory" } };

    const searchResults = await searchNodes({ query: learningQuery, limit: 8 });

    let nodeMemories: Array<{ memoryType: string; title: string; summary: string; importance: number }> = [];
    let focusNode: { id: string; label: string; type: string } | null = null;

    if (input.nodeId) {
      focusNode = await prisma.brainNode.findUnique({ where: { id: input.nodeId } });
      if (focusNode) {
        nodeMemories = await getNodeMemories(input.nodeId);
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
      output: { nodeMemories: nodeMemories.length, globalMemories: globalMemories.length },
    };

    let resp = "";
    const priorCtx = extractPriorContext(input.messages);

    if (focusNode) {
      resp += `## 🧠 Memórias — ${focusNode.label}\n`;
      resp += `${flowIntro}\n`;
      if (priorCtx) resp += `_Continuando a partir de: "${priorCtx}"_\n`;
      resp += `\n`;

      // ── Seção 1: O que busquei ────────────────────────────────────────────
      resp += `### 📊 O que encontrei\n`;
      resp += `- **Nó:** ${focusNode.label} (${focusNode.type}), nodeId: \`${focusNode.id}\`\n`;
      resp += `- **Memórias do nó:** ${nodeMemories.length === 0 ? "nenhuma registrada" : `${nodeMemories.length} encontrada(s)`}\n`;
      resp += `- **Memórias relacionadas no Brain:** ${globalMemories.length}\n\n`;

      if (nodeMemories.length === 0) {
        resp += `Nenhuma memória registrada para este nó ainda.\n\n`;
        resp += `**Para criar:**\n`;
        resp += `- Use a aba Memórias no painel do Brain\n`;
        resp += `- \`POST /api/brain/memories\` com \`nodeId\`, \`memoryType\`, \`title\`, \`summary\`, \`importance\`\n\n`;
        resp += `**Tipos úteis para começar:**\n`;
        resp += `- \`DECISION\` — decisões de produto ou arquitetura\n`;
        resp += `- \`RULE\` — regras de negócio que não mudam\n`;
        resp += `- \`PATTERN\` — padrões recorrentes de defeitos ou comportamento\n`;
      } else {
        // Separate critical (high importance) from contextual
        const critical = nodeMemories.filter((m) => m.importance >= 7).sort((a, b) => b.importance - a.importance);
        const contextual = nodeMemories.filter((m) => m.importance < 7).sort((a, b) => b.importance - a.importance);

        if (critical.length > 0) {
          resp += `### Memórias críticas (importância ≥ 7)\n`;
          critical.forEach((m) => {
            resp += `**[${m.memoryType}] ${m.title}** — _(${m.importance}/10)_\n`;
            resp += `> ${m.summary}\n\n`;
          });
        }

        if (contextual.length > 0) {
          resp += `### Memórias de contexto\n`;
          contextual.slice(0, 4).forEach((m) => {
            resp += `**[${m.memoryType}] ${m.title}** — _(${m.importance}/10)_\n`;
            resp += `> ${m.summary.slice(0, 200)}\n\n`;
          });
          if (contextual.length > 4) {
            resp += `_...e mais ${contextual.length - 4} memória(s) de contexto._\n\n`;
          }
        }
      }
    }

    if (globalMemories.length > 0) {
      if (focusNode) {
        resp += `### Memórias relacionadas no Brain\n`;
      } else {
        resp += `## 🧠 Memórias — "${input.question}"\n`;
        resp += `${flowIntro}\n`;
        if (priorCtx) resp += `_Continuando a partir de: "${priorCtx}"_\n`;
        resp += `\n`;
        resp += `### 📊 O que busquei\n`;
        resp += `- Termos: ${input.question}\n`;
        resp += `- Memórias globais encontradas: ${globalMemories.length}\n\n`;
      }

      // Group by type for scannability
      const byType: Record<string, typeof globalMemories> = {};
      globalMemories.forEach((m) => {
        if (!byType[m.memoryType]) byType[m.memoryType] = [];
        byType[m.memoryType].push(m);
      });

      // Show in order: DECISION → RULE → PATTERN → CONTEXT → rest
      const typeOrder = ["DECISION", "RULE", "PATTERN", "CONTEXT", "EXCEPTION", "TECHNICAL_NOTE"];
      const sortedTypes = [
        ...typeOrder.filter((t) => byType[t]),
        ...Object.keys(byType).filter((t) => !typeOrder.includes(t)),
      ];

      for (const type of sortedTypes) {
        const mems = byType[type];
        resp += `#### ${type} (${mems.length})\n`;
        mems.slice(0, 3).forEach((m) => {
          const nodeInfo = m.node ? ` _[${m.node.label}]_` : "";
          resp += `**${m.title}**${nodeInfo} — importância ${m.importance}/10\n`;
          resp += `> ${m.summary.slice(0, 220)}\n\n`;
        });
        if (mems.length > 3) resp += `_...e mais ${mems.length - 3} do tipo ${type}._\n\n`;
      }
    } else if (!focusNode) {
      resp += `## 🧠 Memórias — sem resultados\n\n`;
      resp += `${flowIntro}\n\n`;
      resp += `### 📊 O que busquei\n`;
      resp += `- Termos: "${input.question}"\n`;
      resp += `- Memórias globais encontradas: **0**\n\n`;
      resp += `### 🩺 Diagnóstico\nNenhuma memória corresponde a esta query no Brain.\n\n`;
      resp += `### ⏭️ Para registrar\n`;
      resp += `- Use a aba Memórias no Brain\n`;
      resp += `- Ou \`POST /api/brain/memories\` com \`nodeId\`, \`memoryType\`, \`title\`, \`summary\`, \`importance\`\n`;
    }

    if (searchResults.length > 0 && nodeMemories.length === 0 && globalMemories.length === 0) {
      resp += `### Nós relacionados (sem memórias registradas)\n`;
      searchResults.slice(0, 4).forEach((node) => {
        resp += `- **${node.label}** (${node.type})`;
        if (node.description) resp += `: ${node.description.slice(0, 100)}`;
        resp += "\n";
      });
    }

    yield* yieldText(adaptResponseTone(resp, input.question, "memory"));
  }
}
