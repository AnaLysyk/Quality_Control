import "server-only";

import type { BrainScreenContext } from "./context";
import type { BrainScreenRegistration } from "./registry";

export type BrainAgentMode = "qa" | "debug" | "playwright" | "memory" | "copilot";

export type BrainAgentInput = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  screen?: BrainScreenRegistration | null;
  context?: BrainScreenContext | null;
  agentMode?: BrainAgentMode | null;
};

export type BrainAgentDecision = {
  mode: BrainAgentMode;
  intent: string;
  requiresConfirmation: boolean;
  suggestedActions: string[];
};

