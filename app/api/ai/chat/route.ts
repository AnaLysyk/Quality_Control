import { NextResponse } from "next/server";
import { runAssistantRequest } from "@/backend/assistant/service";
import type { AssistantClientRequest } from "@/backend/assistant/types";
import { authenticateRequest } from "@/backend/jwtAuth";
import { hasPermissionAccess } from "@/backend/permissionMatrix";
import { rateLimit } from "@/backend/rateLimit";

// Keep the API aligned with the client-side toggle used by ChatButton.
const ASSISTANT_ENABLED = process.env.NEXT_PUBLIC_AI_ASSISTANT_ENABLED !== "false";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!ASSISTANT_ENABLED) {
    return NextResponse.json({ error: "Assistente desativado" }, { status: 410 });
  }

  const authUser = await authenticateRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const isGlobalAdmin =
    authUser.isGlobalAdmin === true ||
    (authUser as { is_global_admin?: boolean }).is_global_admin === true;
  if (
    !isGlobalAdmin &&
    (!hasPermissionAccess(authUser.permissions, "ai", "view") ||
      !hasPermissionAccess(authUser.permissions, "ai", "use"))
  ) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const limiter = await rateLimit(req, `ai-chat:${authUser.id}`, 20, 60);
  if (limiter.limited) return limiter.response;

  try {
    const body = (await req.json().catch(() => ({}))) as AssistantClientRequest;
    const response = await runAssistantRequest(authUser, body ?? {});
    return NextResponse.json(response);
  } catch (error) {
    console.error("[assistant] falha ao processar requisicao:", error);
    return NextResponse.json({ error: "Erro interno ao processar a solicitação" }, { status: 500 });
  }
}
