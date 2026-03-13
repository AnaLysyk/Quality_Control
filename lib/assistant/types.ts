export type AssistantModule =
  | "support"
  | "permissions"
  | "company"
  | "test_plans"
  | "dashboard"
  | "general";

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
};

export type AssistantToolName =
  | "get_screen_context"
  | "list_available_actions"
  | "search_internal_records"
  | "summarize_entity"
  | "draft_test_case"
  | "explain_permission"
  | "create_ticket"
  | "create_comment"
  | "suggest_next_step";

export type AssistantPromptAction = {
  kind: "prompt";
  label: string;
  prompt: string;
};

export type AssistantToolAction = {
  kind: "tool";
  label: string;
  tool: "create_ticket" | "create_comment";
  input: Record<string, unknown>;
};

export type AssistantAction = AssistantPromptAction | AssistantToolAction;

export type AssistantReplyPayload = {
  reply: string;
  tool: AssistantToolName;
  actions?: AssistantAction[];
  context: AssistantScreenContext;
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
  action?: AssistantToolAction | null;
  history?: AssistantConversationTurn[] | null;
};
