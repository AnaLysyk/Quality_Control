import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { authenticateRequest } from "@/lib/jwtAuth";

function getNotesPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "notes.json");
}

async function readNotes(companyId: string) {
  try {
    const data = await fs.readFile(getNotesPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeNotes(companyId: string, notes: any) {
  await fs.mkdir(path.dirname(getNotesPath(companyId)), { recursive: true });
  await fs.writeFile(getNotesPath(companyId), JSON.stringify(notes, null, 2));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = user.companyId;
  if (!companyId) return NextResponse.json({ error: "companyId ausente" }, { status: 400 });

  const id = params.id;
  const body = await req.json().catch(() => ({}));

  const notes = await readNotes(companyId);
  const list = Array.isArray(notes[user.id]) ? notes[user.id] : [];
  const idx = list.findIndex((i: any) => i.id === id);
  if (idx === -1) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });

  const updates: any = {};
  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.content === "string") updates.content = body.content;
  if (typeof body.color === "string") updates.color = body.color;
  updates.updatedAt = new Date().toISOString();

  Object.assign(list[idx], updates);
  notes[user.id] = list;
  await writeNotes(companyId, notes);
  return NextResponse.json({ item: list[idx] });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = user.companyId;
  if (!companyId) return NextResponse.json({ error: "companyId ausente" }, { status: 400 });

  const id = params.id;
  const notes = await readNotes(companyId);
  const list = Array.isArray(notes[user.id]) ? notes[user.id] : [];
  const idx = list.findIndex((i: any) => i.id === id);
  if (idx === -1) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });

  list[idx].deletedAt = new Date().toISOString();
  notes[user.id] = list;
  await writeNotes(companyId, notes);
  return NextResponse.json({ ok: true });
}
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
