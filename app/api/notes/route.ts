import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { createUserNote, listUserNotes } from "@/lib/userNotesStore";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const items = await listUserNotes(user.id);
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const note = await createUserNote(user.id, {
    title: body?.title,
    content: body?.content,
    color: body?.color,
    status: body?.status,
    priority: body?.priority,
    tags: body?.tags,
  });

  if (!note) {
    return NextResponse.json({ error: "Informe título ou conteudo" }, { status: 400 });
  }

  return NextResponse.json({ item: note }, { status: 201 });
}
