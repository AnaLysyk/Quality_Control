export type AssistantModule =
  | "support"
  | "permissions"
  | "company"
  | "companies"
  | "test_plans"
  | "dashboard"
  | "operations"
  | "releases"
  | "integrations"
  | "admin"
  | "brain"
  | "general";

export type AssistantPanelMode = "compact" | "side" | "expanded";

export type AssistantContextEntityType =
  | "ticket"
  | "company"
  | "user"
  | "permission_profile"
  | "test_plan"
  | "screen"
  | null;

export type AssistantScreenContext = {
  route: string;
  module: AssistantModule;
  screenLabel: string;
  screenSummary: string;
  companySlug?: string | null;
  entityType?: AssistantContextEntityType;
  entityId?: string | null;
  suggestedPrompts: string[];
  metadata?: Record<string, unknown> | null;
};

export type AssistantToolName =
  | "get_screen_context"
  | "list_available_actions"
  | "search_internal_records"
  | "summarize_entity"
  | "draft_test_case"
  | "create_test_case"
  | "explain_permission"
  | "create_ticket"
  | "create_comment"
  | "suggest_next_step"
  | "use_brain";

export type AssistantPromptAction = {
  kind: "prompt";
  label: string;
  prompt: string;
};

export type AssistantToolAction = {
  kind: "tool";
  label: string;
  tool: "create_ticket" | "create_comment" | "create_test_case";
  input: Record<string, unknown>;
};

export type AssistantAction = AssistantPromptAction | AssistantToolAction;

export type AssistantReplyPayload = {
  reply: string;
  tool: AssistantToolName;
  actions?: AssistantAction[];
  context: AssistantScreenContext;
  meta?: {
    agentMode?: string | null;
    agentName?: string | null;
    agentIcon?: string | null;
    agentLabel?: string | null;
    agentColor?: string | null;
    nodeId?: string | null;
    source?: string | null;
    durationMs?: number | null;
  } | null;
};

export type AssistantConversationTurn = {
  from: "user" | "assistant";
  text: string;
  tool?: AssistantToolName | "system" | null;
  ts?: number;
  actionLabels?: string[];
};

export type AssistantClientRequest = {
  message?: string;
  context?: Partial<AssistantScreenContext> | null;
  actor?: {
    userId?: string | null;
    permissionRole?: string | null;
    role?: string | null;
    companyRole?: string | null;
    companySlug?: string | null;
    companySlugs?: string[] | null;
    userOrigin?: string | null;
    isGlobalAdmin?: boolean;
  } | null;
  action?: AssistantToolAction | null;
  history?: AssistantConversationTurn[] | null;
  /** Contexto enriquecido vindo de telas externas (Brain, tickets, releases…) */
  brainContext?: {
    route?: string | null;
    nodeId?: string | null;
    nodeLabel?: string | null;
    nodeType?: string | null;
    source?: string | null;
    entityId?: string | null;
    entityType?: string | null;
    agentMode?: string | null;
    metadata?: Record<string, unknown>;
  } | null;
};

// ─── Evento global para abrir o assistente flutuante ────────────────────────
// Qualquer tela pode despachar window.dispatchEvent(new CustomEvent("assistant:open", { detail }))
// para abrir o ChatButton já contextualizado.
export type AssistantOpenEventDetail = {
  /** Origem: brain, autologs, automacoes, tickets, dashboard, etc. */
  source?: string;
  /** Rota atual */
  route?: string;
  /** Empresa ativa */
  companySlug?: string;
  /** Tipo da entidade selecionada (BrainNode, ticket, defect…) */
  entityType?: string;
  /** ID da entidade selecionada */
  entityId?: string;
  /** ID do nó no Brain */
  nodeId?: string;
  /** Label do nó */
  nodeLabel?: string;
  /** Tipo do nó */
  nodeType?: string;
  /** Agente sugerido: qa | debug | playwright | memory */
  agentMode?: string;
  /** Mensagem já preenchida no input do assistente */
  initialMessage?: string;
  /** Contexto parcial para abrir o assistente já enriquecido */
  context?: Partial<AssistantScreenContext> | null;
  /** Modo preferido ao abrir o painel */
  panelMode?: AssistantPanelMode;
  /** Solicita foco no input assim que o painel abrir */
  focusInput?: boolean;
  /** Dados extras de contexto (livre) */
  metadata?: Record<string, unknown>;
};
