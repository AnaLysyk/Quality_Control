import { NextRequest, NextResponse } from "next/server";
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

function safeUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // fallback simples
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function GET(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ companyId: string }>)
    : (context.params as { companyId: string });
  const { companyId } = params;
  const { searchParams } = new URL(req.url!);
  const projectId = searchParams.get("projectId");
  const defects = await readDefects(companyId);
  const filtered = projectId ? defects.filter((d: any) => d.projectId === projectId) : defects;
  return NextResponse.json(filtered);
}

export async function POST(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ companyId: string }>)
    : (context.params as { companyId: string });
  const { companyId } = params;
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!body.title || !body.projectId || !body.createdBy) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: title, projectId, createdBy" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const defects = await readDefects(companyId);
    const newDefect = {
      id: safeUUID(),
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
  } catch (err: any) {
    console.error('POST /defects error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err), stack: err?.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
