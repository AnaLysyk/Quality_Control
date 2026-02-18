import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getDefectsPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "defects.json");
}

async function readDefects(companyId: string) {
  try {
    const data = await fs.readFile(getDefectsPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeDefects(companyId: string, defects: any[]) {
  await fs.mkdir(path.dirname(getDefectsPath(companyId)), { recursive: true });
  await fs.writeFile(getDefectsPath(companyId), JSON.stringify(defects, null, 2));
}

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const { searchParams } = new URL(req.url!);
  const projectId = searchParams.get("projectId");
  const defects = await readDefects(companyId);
  const filtered = projectId ? defects.filter((d: any) => d.projectId === projectId) : defects;
  return NextResponse.json(filtered);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.title || !body.projectId || !body.createdBy) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const defects = await readDefects(companyId);
  const newDefect = {
    id: crypto.randomUUID(),
    title: body.title,
    description: body.description || "",
    projectId: body.projectId,
    runId: body.runId || null,
    attachments: body.attachments || [],
    createdBy: body.createdBy,
    companyId,
    createdAt: new Date().toISOString(),
    integrationSource: body.integrationSource || "manual",
    qaseId: body.qaseId || null,
  };
  defects.push(newDefect);
  await writeDefects(companyId, defects);
  return NextResponse.json(newDefect, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const defects = await readDefects(companyId);
  const idx = defects.findIndex((d: any) => d.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Defeito não encontrado" }, { status: 404 });
  Object.assign(defects[idx], body.updates, { updatedAt: new Date().toISOString() });
  await writeDefects(companyId, defects);
  return NextResponse.json(defects[idx]);
}

export async function DELETE(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const defects = await readDefects(companyId);
  const idx = defects.findIndex((d: any) => d.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Defeito não encontrado" }, { status: 404 });
  defects[idx].deletedAt = new Date().toISOString();
  await writeDefects(companyId, defects);
  return NextResponse.json({ ok: true });
}
