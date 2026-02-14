import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { deleteUserNote, updateUserNote } from "@/lib/userNotesStore";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const params = await context.params;
  const { id } = params;
  if (!id || typeof id !== "string" || id.length < 6) {
    return NextResponse.json({ error: "Id invalido" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const patch = {
    title: typeof body.title === "string" ? body.title.trim().slice(0, 120) : undefined,
    content: typeof body.content === "string" ? body.content.trim().slice(0, 5000) : undefined,
    color: typeof body.color === "string" ? body.color : undefined,
  };

  if (!patch.title && !patch.content && !patch.color) {
    return NextResponse.json({ error: "Nenhuma alteracao informada" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const updated = await updateUserNote(user.id, id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Nota nao encontrada" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ item: updated }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const params = await context.params;
  const { id } = params;
  if (!id || typeof id !== "string" || id.length < 6) {
    return NextResponse.json({ error: "Id invalido" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const removed = await deleteUserNote(user.id, id);
  if (!removed) {
    return NextResponse.json({ error: "Nota nao encontrada" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
