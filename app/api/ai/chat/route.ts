import { NextResponse } from "next/server";
import { runAssistantRequest } from "@/lib/assistant/service";
import type { AssistantClientRequest } from "@/lib/assistant/types";
import { authenticateRequest } from "@/lib/jwtAuth";
import { hasPermissionAccess } from "@/lib/permissionMatrix";

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
  if (
    !hasPermissionAccess(authUser.permissions, "ai", "view") ||
    !hasPermissionAccess(authUser.permissions, "ai", "use")
  ) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as AssistantClientRequest;
    const response = await runAssistantRequest(authUser, body ?? {});
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("[assistant] falha ao processar requisicao:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
