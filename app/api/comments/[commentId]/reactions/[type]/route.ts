import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { removeReaction } from "@/lib/ticketReactionsStore";

type RouteContext = {
  params: {
    commentId?: string;
    type?: string;
  };
};

export async function DELETE(req: Request, context: { params: Promise<{ commentId: string; type: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && Number.parseInt(contentLength, 10) > 0) {
    return NextResponse.json({ error: "Payload nao suportado" }, { status: 415 });
  }

  const params = await context.params;
  const commentId = String(params.commentId ?? "").trim();
  const type = String(params.type ?? "").toLowerCase();

  if (!commentId) {
    return NextResponse.json({ error: "commentId ausente" }, { status: 400 });
  }

  if (commentId.length > 120) {
    return NextResponse.json({ error: "commentId invalido" }, { status: 400 });
  }

  if (type !== "like") {
    return NextResponse.json({ error: "Tipo invalido" }, { status: 400 });
  }

  const removed = await removeReaction({
    commentId,
    userId: user.id,
    type: "like",
  });

  return NextResponse.json({ ok: removed }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
