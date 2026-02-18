import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

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

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const notes = await readNotes(companyId);
  return NextResponse.json(notes);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.userId || !body.note) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const notes = await readNotes(companyId);
  if (!notes[body.userId]) notes[body.userId] = [];
  notes[body.userId].push({ note: body.note, createdAt: new Date().toISOString() });
  await writeNotes(companyId, notes);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const notes = await readNotes(companyId);
  if (!notes[body.userId]) return NextResponse.json({ error: "Usuário não possui notas" }, { status: 404 });
  const idx = notes[body.userId].findIndex((n: any) => n.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  Object.assign(notes[body.userId][idx], body.updates, { updatedAt: new Date().toISOString() });
  await writeNotes(companyId, notes);
  return NextResponse.json(notes[body.userId][idx]);
}

export async function DELETE(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const notes = await readNotes(companyId);
  if (!notes[body.userId]) return NextResponse.json({ error: "Usuário não possui notas" }, { status: 404 });
  const idx = notes[body.userId].findIndex((n: any) => n.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Nota não encontrada" }, { status: 404 });
  notes[body.userId][idx].deletedAt = new Date().toISOString();
  await writeNotes(companyId, notes);
  return NextResponse.json({ ok: true });
}
