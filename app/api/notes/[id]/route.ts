import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { deleteUserNote, updateUserNote } from "@/lib/userNotesStore";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateUserNote(user.id, id, {
    title: body?.title,
    content: body?.content,
    color: body?.color,
  });

  if (!updated) {
    return NextResponse.json({ error: "Nota nao encontrada" }, { status: 404 });
  }

  return NextResponse.json({ item: updated }, { status: 200 });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const removed = await deleteUserNote(user.id, id);
  return NextResponse.json({ ok: removed }, { status: 200 });
}
