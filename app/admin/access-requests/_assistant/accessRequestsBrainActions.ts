import { accessRequestsPermissionDeniedReply, canRunAccessRequestsBrainAction } from "./accessRequestsBrainPermissions";
import { parseAccessRequestsBrainCommand } from "./accessRequestsBrainParser";
import {
  buildAccessRequestsBrainSummary,
  findAccessRequestsBrainRow,
  readAccessRequestsBrainRows,
  suggestAccessRequestsBrainTerm,
} from "./accessRequestsBrainSummary";
import type {
  AccessRequestsBrainActionType,
  AccessRequestsBrainFilters,
  AccessRequestsBrainPendingAction,
  AccessRequestsBrainResult,
  AccessRequestsBrainVisibleRow,
} from "./accessRequestsBrain.types";

type RunInput = {
  pathname: string;
  text: string;
  user: unknown;
  pendingAction?: AccessRequestsBrainPendingAction | null;
};

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function dispatchFilters(filters: AccessRequestsBrainFilters) {
  window.dispatchEvent(new CustomEvent("access-requests:assistant-filter", { detail: filters }));
}

function dispatchRowAction(action: AccessRequestsBrainActionType, row: AccessRequestsBrainVisibleRow, mode?: "view" | "edit") {
  window.dispatchEvent(new CustomEvent("access-requests:assistant-action", {
    detail: { action, requestId: row.id, mode },
  }));
}

function explainAccessRequestsScreen() {
  return [
    "Estou contigo nessa central de SolicitaÃ§Ãµes de acesso.",
    "",
    "Consigo buscar por pessoa, e-mail, empresa, perfil ou cargo; filtrar status e perÃ­odo; abrir a conferÃªncia; gerar PDF; e preparar aÃ§Ãµes sensÃ­veis como remover, aprovar, recusar ou pedir ajuste.",
    "",
    "Para aÃ§Ãµes decisÃ³rias eu nÃ£o executo direto. Primeiro localizo a solicitaÃ§Ã£o, abro a conferÃªncia, explico o impacto e peÃ§o confirmaÃ§Ã£o.",
  ].join("\n");
}

function buildAccessRequestsGreetingReply() {
  return [
    "Oi, tudo bem? Estou contigo na tela de SolicitaÃ§Ãµes de acesso.",
    "",
    "Pode pedir do seu jeito. Eu consigo buscar nomes ou perfis, filtrar por status/perÃ­odo, abrir uma solicitaÃ§Ã£o, gerar PDF e preparar aÃ§Ãµes como aprovar, recusar, remover ou pedir ajuste.",
    "",
    "Exemplos rÃ¡pidos: buscar Barbara, recusadas, abrir primeira, pdf da primeira, ou o que tem aqui.",
  ].join("\n");
}

function buildAccessRequestsFollowUpReply() {
  return [
    "Perfeito. Continuo acompanhando esta tela.",
    "",
    "Me diga o que vocÃª quer fazer na fila: buscar, filtrar, abrir, gerar PDF ou analisar o que estÃ¡ visÃ­vel agora.",
  ].join("\n");
}

async function findTarget(term: string) {
  let row = findAccessRequestsBrainRow(term);
  if (row || !term) return row;
  dispatchFilters({ searchTerm: term });
  await delay(650);
  row = findAccessRequestsBrainRow(term);
  return row;
}

function buildNoTargetReply(term: string) {
  const suggestion = suggestAccessRequestsBrainTerm(term);
  if (suggestion) {
    return `NÃ£o encontrei "${term}" na listagem visÃ­vel. Encontrei termos parecidos com ${suggestion}. Quer buscar por ${suggestion}?`;
  }
  return "NÃ£o encontrei uma solicitaÃ§Ã£o visÃ­vel para esse pedido. Tenta limpar filtros ou buscar sÃ³ pelo nome/perfil principal.";
}

function pendingReply(action: AccessRequestsBrainActionType, row: AccessRequestsBrainVisibleRow, extra?: string) {
  if (action === "remove") {
    return [
      `Encontrei ${row.name}${row.email ? ` â€” ${row.email}` : ""}.`,
      "",
      "Essa solicitaÃ§Ã£o serÃ¡ removida da listagem e a movimentaÃ§Ã£o ficarÃ¡ registrada em logs.",
      "Confirma remover essa solicitaÃ§Ã£o?",
    ].join("\n");
  }
  if (action === "approve") return `Encontrei ${row.name}. Abri a conferÃªncia para vocÃª. Confirma aprovar essa solicitaÃ§Ã£o?`;
  if (action === "reject") return extra ? `Encontrei ${row.name}. Abri a conferÃªncia. Confirma recusar com este motivo: ${extra}?` : "Qual motivo da recusa?";
  return extra ? `Encontrei ${row.name}. Abri a conferÃªncia. Confirma devolver para ajuste os campos informados?` : "Qual campo vocÃª quer devolver para ajuste e qual comentÃ¡rio devo usar?";
}

export async function runAccessRequestsBrainCommand(input: RunInput): Promise<AccessRequestsBrainResult> {
  if (!input.pathname.startsWith("/admin/access-requests") || typeof window === "undefined") return { handled: false };
  const command = parseAccessRequestsBrainCommand(input.text, input.pendingAction);

  if (command.kind === "none") return { handled: false };
  if (command.kind === "greeting") return { handled: true, reply: buildAccessRequestsGreetingReply() };
  if (command.kind === "follow_up") return { handled: true, reply: buildAccessRequestsFollowUpReply() };

  if (command.kind === "cancel_pending") {
    return { handled: true, pendingAction: null, reply: "Tudo bem, cancelei a aÃ§Ã£o pendente. Nada foi executado." };
  }

  if (command.kind === "confirm_pending") {
    const pending = input.pendingAction;
    if (!pending || Date.now() - pending.createdAt > 5 * 60 * 1000) {
      return { handled: true, pendingAction: null, reply: "NÃ£o encontrei uma aÃ§Ã£o pendente vÃ¡lida para confirmar. Me diga novamente o que vocÃª quer fazer." };
    }
    const row = readAccessRequestsBrainRows().find((item) => item.id === pending.targetRequestId);
    if (!row) return { handled: true, pendingAction: null, reply: "A solicitaÃ§Ã£o pendente nÃ£o estÃ¡ mais visÃ­vel. NÃ£o executei nada." };
    dispatchRowAction(pending.type, row, "edit");
    return {
      handled: true,
      pendingAction: null,
      reply: pending.type === "remove"
        ? "Perfeito, abri a confirmaÃ§Ã£o visual de remoÃ§Ã£o. Revise o aviso e confirme no modal para concluir."
        : "Perfeito, mantive a solicitaÃ§Ã£o aberta em modo de anÃ¡lise. Revise os dados no modal e use o botÃ£o de decisÃ£o da tela para concluir.",
    };
  }

  if (command.kind === "explain") return { handled: true, reply: explainAccessRequestsScreen() };
  if (command.kind === "analyze") return { handled: true, reply: buildAccessRequestsBrainSummary("analisei a tabela visÃ­vel", input.user) };

  if (command.kind === "filter") {
    const rowsBeforeFilter = readAccessRequestsBrainRows();
    dispatchFilters(command.filters);
    await delay(650);
    const rows = readAccessRequestsBrainRows();
    const reply = buildAccessRequestsBrainSummary(command.actionText || "apliquei os filtros", input.user, rows);
    if (rows.length === 0 && command.filters.searchTerm) {
      const suggestion = suggestAccessRequestsBrainTerm(command.filters.searchTerm, rowsBeforeFilter);
      return {
        handled: true,
        reply: suggestion ? `${reply}\n\nSugestÃ£o: encontrei termo parecido com ${suggestion}. Quer buscar por ${suggestion}?` : reply,
      };
    }
    return { handled: true, reply };
  }

  const row = await findTarget(command.term);
  if (!row) return { handled: true, reply: buildNoTargetReply(command.term) };

  if (!canRunAccessRequestsBrainAction(input.user as Parameters<typeof canRunAccessRequestsBrainAction>[0], command.action)) {
    return { handled: true, reply: accessRequestsPermissionDeniedReply() };
  }

  if (command.action === "view") {
    dispatchRowAction("view", row, "view");
    return { handled: true, reply: `Abri a conferÃªncia de ${row.name}${row.email ? ` â€” ${row.email}` : ""}. Usei a primeira solicitaÃ§Ã£o visÃ­vel que bateu com o pedido.` };
  }

  if (command.action === "pdf") {
    dispatchRowAction("pdf", row, "view");
    return { handled: true, reply: `Gerei o PDF da solicitaÃ§Ã£o de ${row.name}${row.email ? ` â€” ${row.email}` : ""}.` };
  }

  dispatchRowAction(command.action, row, "edit");
  const pendingAction: AccessRequestsBrainPendingAction = {
    type: command.action,
    targetRequestId: row.id,
    targetLabel: row.name,
    requiredFields: command.fields,
    reason: command.reason,
    createdAt: Date.now(),
  };

  return {
    handled: true,
    pendingAction,
    reply: pendingReply(command.action, row, command.reason || command.fields?.join(", ")),
  };
}

