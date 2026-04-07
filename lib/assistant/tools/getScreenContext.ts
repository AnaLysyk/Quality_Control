import "server-only";

import { getLocalUserById } from "@/lib/auth/localStore";
import type { AuthUser } from "@/lib/jwtAuth";
import type { AssistantScreenContext } from "../types";
import { compactMultiline } from "../helpers";
import { displayName, displayRole, summarizePermissionMatrix, buildPromptActions } from "../data";
import type { AssistantExecutorResult } from "./types";

export async function toolGetScreenContext(user: AuthUser, context: AssistantScreenContext): Promise<AssistantExecutorResult> {
  const currentUser = await getLocalUserById(user.id);
  return {
    tool: "get_screen_context",
    success: true,
    summary: context.screenLabel,
    actions: buildPromptActions(context),
    reply: compactMultiline([
      `${context.screenLabel}`,
      context.screenSummary,
      "",
      `Rota atual: ${context.route}`,
      `Modulo: ${context.module}`,
      `Usuario atual: ${displayName(currentUser)} | ${currentUser?.user ?? currentUser?.email ?? user.email}`,
      `Perfil atual: ${displayRole(user)}`,
      `Escopo de empresa: ${context.companySlug ?? user.companySlug ?? "global"}`,
      `Permissoes relevantes: ${summarizePermissionMatrix(user.permissions)}`,
    ].join("\n")),
  };
}
