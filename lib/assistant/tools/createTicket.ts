import "server-only";

import { findLocalCompanyBySlug, getLocalUserById } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";
import { appendTicketEvent } from "@/lib/ticketEventsStore";
import { notifyTicketCreated } from "@/lib/notificationService";
import { attachAssigneeToTicket } from "@/lib/ticketsPresenter";
import { createTicket } from "@/lib/ticketsStore";
import type { AssistantScreenContext, AssistantToolAction } from "../types";
import { compactMultiline, normalizeText, formatValidationIssues } from "../helpers";
import { buildPromptActions, displayName, formatTicketCard } from "../data";
import {
  validateAssistantTicketDraft,
  normalizeTicketTypeInput,
  normalizeTicketPriorityInput,
} from "../validations";
import {
  buildStructuredTicketDescription,
  buildStructuredTicketTemplate,
  buildTicketDescription,
  buildTicketTitle,
  extractNarrativePayload,
  extractTicketNarrativeSource,
  inferTicketPriority,
  inferTicketType,
  isGenericTicketPrompt,
  isTicketTemplateRequest,
  parseStructuredTicketDraft,
} from "./ticketHelpers";
import type { AssistantExecutorResult } from "./types";

export async function buildTicketCreationAction(user: AuthUser, context: AssistantScreenContext, message: string): Promise<AssistantExecutorResult> {
  if (
    !hasPermissionAccess(user.permissions, "tickets", "create") &&
    !hasPermissionAccess(user.permissions, "support", "create")
  ) {
    return {
      tool: "create_ticket",
      success: false,
      summary: "sem permissão para criar ticket",
      reply: "Seu perfil atual não pode criar chamados. Posso ajudar a estruturar o texto, mas a criação exige permissão de tickets/support:create.",
    };
  }

  if (isGenericTicketPrompt(message)) {
    return {
      tool: "create_ticket",
      success: true,
      summary: "aguardando conteúdo do chamado",
      actions: [
        { kind: "prompt", label: "Usar modelo de chamado", prompt: "Montar modelo de chamado estruturado" },
        { kind: "prompt", label: "Converter nota em chamado", prompt: "Converter esta nota em chamado: " },
      ],
      reply: compactMultiline([
        "Consigo transformar texto, nota ou relato em chamado, mas preciso do conteúdo real para estruturar.",
        "",
        "Envie algo como:",
        "- Converter esta nota em chamado: [cole o texto aqui]",
        "- Criar chamado com base neste relato: [cole o relato aqui]",
        "",
        "Quando você mandar o conteúdo, eu preparo título, descrição, tipo e prioridade antes de criar.",
      ].join("\n")),
    };
  }

  const structuredDraft = parseStructuredTicketDraft(message);
  if (structuredDraft?.hasNamedFields) {
    if (!structuredDraft.title || !structuredDraft.description) {
      return {
        tool: "create_ticket",
        success: true,
        summary: "faltam campos para estruturar o chamado",
        actions: [
          {
            kind: "prompt",
            label: "Completar modelo",
            prompt: [
              "Criar chamado estruturado:",
              `Titulo: ${structuredDraft.title}`,
              `Descricao: ${structuredDraft.description}`,
              `Impacto: ${structuredDraft.impact}`,
              `Comportamento esperado: ${structuredDraft.expectedBehavior}`,
              `Comportamento atual: ${structuredDraft.currentBehavior}`,
              `Tipo: ${structuredDraft.type ?? "bug"}`,
              `Prioridade: ${structuredDraft.priority ?? "media"}`,
            ].join("\n"),
          },
        ],
        reply: compactMultiline([
          "Identifiquei um modelo estruturado de chamado, mas ele ainda não passou nas validações do módulo.",
          "",
          "Pendências encontradas:",
          formatValidationIssues([
            !structuredDraft.title ? "Campo Título obrigatório." : "",
            !structuredDraft.description ? "Campo Descrição obrigatório." : "",
          ].filter(Boolean)),
          "",
          buildStructuredTicketTemplate(),
        ].join("\n")),
      };
    }

    const title = structuredDraft.title.slice(0, 110);
    const description = buildStructuredTicketDescription(structuredDraft, context);
    const type = structuredDraft.type ?? inferTicketType(message, context);
    const priority = structuredDraft.priority ?? inferTicketPriority(message);
    const validation = validateAssistantTicketDraft({ title, description, type, priority });

    if (!validation.ok) {
      return {
        tool: "create_ticket",
        success: true,
        summary: "pendências para criar chamado",
        actions: [{ kind: "prompt", label: "Completar modelo", prompt: buildStructuredTicketTemplate() }],
        reply: compactMultiline([
          "Identifiquei o modelo estruturado, mas ele ainda não passou nas validações do módulo de suporte.",
          "",
          "Pendências encontradas:",
          formatValidationIssues(validation.issues),
          "",
          buildStructuredTicketTemplate(),
        ].join("\n")),
      };
    }

    return {
      tool: "create_ticket",
      success: true,
      summary: validation.title,
      actions: [
        {
          kind: "tool",
          label: "Criar chamado agora",
          tool: "create_ticket",
          input: {
            title: validation.title,
            description: validation.description,
            type: validation.type,
            priority: validation.priority,
            companySlug: context.companySlug ?? user.companySlug ?? null,
          },
        },
      ],
      reply: compactMultiline([
        "Preparei um chamado estruturado a partir dos campos informados.",
        "",
        `Título: ${validation.title}`,
        `Tipo: ${validation.type}`,
        `Prioridade: ${validation.priority}`,
        "",
        validation.description,
        "",
        "Se estiver ok, execute a ação abaixo para criar no sistema.",
      ].join("\n")),
    };
  }

  const narrativeSource = extractNarrativePayload(message) || extractTicketNarrativeSource(message);
  if (!narrativeSource || narrativeSource.length < 12) {
    return {
      tool: "create_ticket",
      success: true,
      summary: "aguardando conteúdo do chamado",
      actions: [
        { kind: "prompt", label: "Usar modelo de chamado", prompt: "Montar modelo de chamado estruturado" },
        { kind: "prompt", label: "Converter nota em chamado", prompt: "Converter esta nota em chamado: " },
      ],
      reply: compactMultiline([
        "Antes de criar o chamado, preciso validar os dados do módulo de suporte.",
        "",
        "O texto enviado ainda está genérico demais para passar nas validações.",
        "",
        buildStructuredTicketTemplate(),
      ].join("\n")),
    };
  }

  if (isTicketTemplateRequest(message)) {
    return {
      tool: "create_ticket",
      success: true,
      summary: "modelo de chamado estruturado",
      actions: [
        {
          kind: "prompt",
          label: "Preencher modelo",
          prompt: [
            "Criar chamado estruturado:",
            "Titulo:",
            "Descricao:",
            "Impacto:",
            "Comportamento esperado:",
            "Comportamento atual:",
            "Tipo: bug",
            "Prioridade: media",
          ].join("\n"),
        },
        { kind: "prompt", label: "Converter nota em chamado", prompt: "Converter esta nota em chamado: " },
      ],
      reply: buildStructuredTicketTemplate(),
    };
  }

  const title = buildTicketTitle(narrativeSource, context);
  const description = buildTicketDescription(narrativeSource, context);
  const type = inferTicketType(narrativeSource, context);
  const priority = inferTicketPriority(narrativeSource);
  const validation = validateAssistantTicketDraft({ title, description, type, priority });

  if (!validation.ok) {
    return {
      tool: "create_ticket",
      success: true,
      summary: "pendências para criar chamado",
      actions: [
        { kind: "prompt", label: "Usar modelo de chamado", prompt: "Montar modelo de chamado estruturado" },
        { kind: "prompt", label: "Converter nota em chamado", prompt: "Converter esta nota em chamado: " },
      ],
      reply: compactMultiline([
        "Antes de criar o chamado, preciso passar pelas validações do módulo de suporte.",
        "",
        "Pendências encontradas:",
        formatValidationIssues(validation.issues),
        "",
        buildStructuredTicketTemplate(),
      ].join("\n")),
    };
  }

  return {
    tool: "create_ticket",
    success: true,
    summary: validation.title,
    actions: [
      {
        kind: "tool",
        label: "Criar chamado agora",
        tool: "create_ticket",
        input: {
          title: validation.title,
          description: validation.description,
          type: validation.type,
          priority: validation.priority,
          companySlug: context.companySlug ?? user.companySlug ?? null,
        },
      },
    ],
    reply: compactMultiline([
      "Preparei um rascunho de chamado e ele passou nas validações do módulo de suporte.",
      "",
      `Título: ${validation.title}`,
      `Tipo: ${validation.type}`,
      `Prioridade: ${validation.priority}`,
      "",
      validation.description,
      "",
      "Se estiver ok, execute a ação abaixo para criar no sistema.",
    ].join("\n")),
  };
}

export async function executeCreateTicket(user: AuthUser, context: AssistantScreenContext, action: AssistantToolAction): Promise<AssistantExecutorResult> {
  if (
    !hasPermissionAccess(user.permissions, "tickets", "create") &&
    !hasPermissionAccess(user.permissions, "support", "create")
  ) {
    return { tool: "create_ticket", success: false, summary: "criação bloqueada", reply: "Seu perfil atual não pode criar chamados." };
  }

  const validation = validateAssistantTicketDraft({
    title: action.input.title,
    description: action.input.description,
    type: action.input.type,
    priority: action.input.priority,
  });

  if (!validation.ok) {
    return {
      tool: "create_ticket",
      success: false,
      summary: "validação do chamado falhou",
      reply: compactMultiline([
        "Não executei a criação porque o chamado não passou nas validações do módulo de suporte.",
        "",
        formatValidationIssues(validation.issues),
      ].join("\n")),
    };
  }

  const localUser = await getLocalUserById(user.id);
  const companySlug = normalizeText(action.input.companySlug, 120) || context.companySlug || user.companySlug || "";
  const company = companySlug ? await findLocalCompanyBySlug(companySlug) : null;

  const ticket = await createTicket({
    title: validation.title,
    description: validation.description,
    type: validation.type,
    priority: validation.priority,
    createdBy: user.id,
    createdByName: displayName(localUser),
    createdByEmail: localUser?.email ?? user.email,
    companyId: company?.id ?? user.companyId ?? null,
    companySlug: company?.slug ?? user.companySlug ?? null,
  });

  if (!ticket) {
    return { tool: "create_ticket", success: false, summary: "falha ao criar", reply: "Não consegui criar o chamado. Verifique se título ou descrição ficaram vazios." };
  }

  appendTicketEvent({ ticketId: ticket.id, type: "CREATED", actorUserId: user.id, payload: { source: "assistant", route: context.route } }).catch(() => null);
  notifyTicketCreated(ticket).catch(() => null);

  const enriched = await attachAssigneeToTicket(ticket);
  return {
    tool: "create_ticket",
    success: true,
    summary: ticket.code,
    actions: [
      { kind: "prompt", label: "Resumir chamado criado", prompt: `Resumir o chamado ${ticket.code}` },
      { kind: "prompt", label: "Sugerir caso de teste", prompt: `Gerar caso de teste para o chamado ${ticket.code}` },
    ],
    reply: compactMultiline(["Chamado criado com sucesso.", "", formatTicketCard(enriched)].join("\n")),
  };
}
