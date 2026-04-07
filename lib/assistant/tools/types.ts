/**
 * Shared type for all tool executor results.
 */
import type { AssistantAction, AssistantToolName } from "../types";

export type AssistantExecutorResult = {
  tool: AssistantToolName;
  reply: string;
  actions?: AssistantAction[];
  success: boolean;
  summary: string | null;
};
