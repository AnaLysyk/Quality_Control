import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { removeReaction } from "@/lib/ticketReactionsStore";

export async function DELETE(req: Request, context: { params: Promise<{ commentId: string; type: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { commentId, type } = await context.params;
  if ((type ?? "").toLowerCase() !== "like") {
    return NextResponse.json({ error: "Tipo invalido" }, { status: 400 });
  }

  const removed = await removeReaction({
    commentId,
    userId: user.id,
    type: "like",
  });

  return NextResponse.json({ ok: removed }, { status: 200 });
}
