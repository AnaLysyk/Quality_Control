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

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = user.companyId;
  if (!companyId) return NextResponse.json({ error: "companyId ausente" }, { status: 400 });

  const notes = await readNotes(companyId);
  const items = Array.isArray(notes[user.id]) ? notes[user.id] : [];
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = user.companyId;
  if (!companyId) return NextResponse.json({ error: "companyId ausente" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title : "";
  const content = typeof body.content === "string" ? body.content : "";
  const color = typeof body.color === "string" ? body.color : "amber";

  const notes = await readNotes(companyId);
  if (!notes[user.id]) notes[user.id] = [];
  const item = {
    id: (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2),
    title,
    content,
    color,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  notes[user.id].unshift(item);
  await writeNotes(companyId, notes);
  return NextResponse.json({ item });
}
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/jwtAuth";
import { createUserNote, listUserNotes } from "@/lib/userNotesStore";

export async function GET(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const items = await listUserNotes(user.id);
  return NextResponse.json({ items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await authenticateRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const note = await createUserNote(user.id, {
    title: body?.title,
    content: body?.content,
    color: body?.color,
  });

  if (!note) {
    return NextResponse.json({ error: "Informe titulo ou conteudo" }, { status: 400 });
  }

  return NextResponse.json({ item: note }, { status: 201 });
}
