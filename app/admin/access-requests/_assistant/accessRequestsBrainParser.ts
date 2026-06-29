import type {
  AccessRequestsBrainCommand,
  AccessRequestsBrainDateFilter,
  AccessRequestsBrainPendingAction,
  AccessRequestsBrainStatusFilter,
} from "./accessRequestsBrain.types";

export function normalizeAccessRequestsBrainText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?()[\]{}]+/g, " ")
    .replace(/\bburca\b/g, "busca")
    .replace(/\bbuscq\b/g, "busca")
    .replace(/\bbuca\b/g, "busca")
    .replace(/\bsatus\b/g, "status")
    .replace(/\brejitado\b/g, "rejeitado")
    .replace(/\brejitados\b/g, "rejeitados")
    .replace(/\bajusts\b/g, "ajustes")
    .replace(/\bthisgo\b/g, "thiago")
    .replace(/\bentao\b/g, "estao")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHelperWords(value: string) {
  return value
    .replace(/\b(busca|buscar|procura|procurar|localiza|localizar|filtra|filtrar|pesquisa|pesquisar)\b/g, " ")
    .replace(/\b(por|pelo|pela|com|sem|de|da|do|das|dos|a|o|as|os|na|no|nas|nos)\b/g, " ")
    .replace(/\b(quais|qual|quem|estao|estão|estao|sao|são)\b/g, " ")
    .replace(/\b(status|satus|situacao)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStatus(text: string): AccessRequestsBrainStatusFilter | null {
  if (/\b(rejeitad\w*|recusad\w*|negad\w*)\b/.test(text)) return "rejected";
  if (/\b(aceit\w*|aceito\w*|aprovad\w*|deferid\w*)\b/.test(text)) return "closed";
  if (/\b(abert\w*|nov\w*)\b/.test(text)) return "open";
  if (/\b(ajuste\w*|ajustar|aguardando|pendente\w*|andamento|progresso)\b/.test(text)) return "in_progress";
  return null;
}

function parseDate(text: string): AccessRequestsBrainDateFilter | null {
  if (/\blimpar filtros\b|^(limpar|resetar)\b/.test(text)) return "all";
  if (/\bhoje\b/.test(text)) return "today";
  if (/(ultim[oa]s?|nas|nos|no).*(2h|2 h|2 horas|duas horas)/.test(text)) return "two_hours";
  if (/(ultim[oa]s?|nas|nos|no).*(7 dias|sete dias)|ultima semana|ultimos 7/.test(text)) return "week";
  if (/(30 dias|trinta dias|ultimo mes|ultimos 30|ultimo mês)/.test(text)) return "month";
  return null;
}

function parseAction(text: string) {
  if (/\b(baixar|download|gerar)\b.*\bpdf\b|\bpdf\b/.test(text)) return "pdf" as const;
  if (/\b(visualizar|ver|abrir|mostrar)\b/.test(text)) return "view" as const;
  if (/\b(remover|excluir|apagar)\b/.test(text)) return "remove" as const;
  if (/\b(aprovar|aceitar)\b/.test(text)) return "approve" as const;
  if (/\b(recusar|rejeitar|negar)\b/.test(text)) return "reject" as const;
  if (/\b(solicitar|pedir|devolver|marcar)\b.*\bajuste\b/.test(text)) return "request_adjustment" as const;
  return null;
}

function extractActionTerm(text: string, action: string) {
  return stripHelperWords(text)
    .replace(/\b(visualizar|ver|abrir|mostrar|primeira|solicitacao|solicitacoes|visivel)\b/g, " ")
    .replace(/\b(baixar|download|gerar|pdf|da|do)\b/g, " ")
    .replace(/\b(remover|excluir|apagar)\b/g, " ")
    .replace(/\b(aprovar|aceitar|recusar|rejeitar|negar)\b/g, " ")
    .replace(/\b(solicitar|pedir|devolver|marcar|campo|para|no|na)\b/g, " ")
    .replace(action === "request_adjustment" ? /\bajuste\b/g : /\b$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAdjustmentFields(text: string) {
  const fields: string[] = [];
  const pairs: Array<[RegExp, string]> = [
    [/\bperfil\b/, "profileType"],
    [/\bempresa\b/, "company"],
    [/\bnome completo\b|\bnome\b/, "fullName"],
    [/\busuario sugerido\b|\blogin\b|\busuario\b/, "username"],
    [/\be mail\b|\bemail\b/, "email"],
    [/\btelefone\b/, "phone"],
    [/\bcargo\b/, "jobRole"],
    [/\btitulo\b/, "title"],
    [/\bdescricao\b/, "description"],
    [/\bobservacoes\b|\bobservacao\b/, "notes"],
    [/\bsenha\b/, "password"],
  ];
  for (const [pattern, field] of pairs) {
    if (pattern.test(text)) fields.push(field);
  }
  return Array.from(new Set(fields));
}

function isGreeting(text: string) {
  return /^(oi+|ola|olá|oie|bom dia|boa tarde|boa noite|hello|hi)[\s!?.]*$/.test(text);
}

function isShortFollowUp(text: string) {
  return /^(tudo|td|tudo bem|tudo certo|beleza|blz|ok|okay|ta|tá|entendi|certo|show|fechou|valeu|obrigado|obrigada)[\s!?.]*$/.test(text);
}

export function parseAccessRequestsBrainCommand(
  rawText: string,
  pendingAction?: AccessRequestsBrainPendingAction | null,
): AccessRequestsBrainCommand {
  const text = normalizeAccessRequestsBrainText(rawText);
  if (!text) return { kind: "none" };

  if (!pendingAction && isGreeting(text)) return { kind: "greeting" };
  if (!pendingAction && isShortFollowUp(text)) return { kind: "follow_up" };

  if (pendingAction) {
    if (/^(sim|confirmo|pode|pode sim|aprova|recusa|remove|confirmar|ok|ss)\b/.test(text)) return { kind: "confirm_pending" };
    if (/^(nao|não|cancela|cancelar|deixa|voltar|para)\b/.test(text)) return { kind: "cancel_pending" };
  }

  if (/\b(o que tem aqui|analisa|analise|resumo|o que voce encontrou|tem algo errado|qual proximo passo)\b/.test(text)) {
    return { kind: "analyze" };
  }

  if (/\b(me explica essa tela|explica|o que posso fazer|ajuda|fluxo)\b/.test(text)) {
    return { kind: "explain" };
  }

  const action = parseAction(text);
  if (action) {
    return {
      kind: "action",
      action,
      term: extractActionTerm(text, action),
      fields: action === "request_adjustment" ? extractAdjustmentFields(text) : undefined,
      reason: action === "reject" ? extractActionTerm(text, action) : undefined,
    };
  }

  const dateFilter = parseDate(text);
  if (dateFilter) {
    return {
      kind: "filter",
      filters: dateFilter === "all" ? { searchTerm: "", statusFilter: "all", dateFilter: "all" } : { dateFilter },
      actionText: dateFilter === "all" ? "limpei os filtros" : `filtrei por período`,
    };
  }

  const statusFilter = parseStatus(text);
  const searchTerm = stripHelperWords(text)
    .replace(/\b(rejeitad\w*|recusad\w*|negad\w*|aceit\w*|aprovad\w*|deferid\w*|abert\w*|nov\w*|aguardando|ajuste\w*|pendente\w*|andamento|progresso)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (statusFilter || searchTerm.length >= 2) {
    return {
      kind: "filter",
      filters: { ...(statusFilter ? { statusFilter } : {}), ...(searchTerm ? { searchTerm } : {}) },
      actionText: [
        searchTerm ? `busquei por "${searchTerm}"` : "",
        statusFilter ? "apliquei filtro de status" : "",
      ].filter(Boolean).join(" e "),
    };
  }

  return { kind: "none" };
}
