import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getRunsDir(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "runs");
}

async function readRun(companyId: string, runId: string) {
  const runPath = path.join(getRunsDir(companyId), `${runId}.json`);
  try {
    const data = await fs.readFile(runPath, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeRun(companyId: string, runId: string, run: any) {
  const runPath = path.join(getRunsDir(companyId), `${runId}.json`);
  await fs.mkdir(path.dirname(runPath), { recursive: true });
  await fs.writeFile(runPath, JSON.stringify(run, null, 2));
}

async function listRuns(companyId: string) {
  const dir = getRunsDir(companyId);
  try {
    const files = await fs.readdir(dir);
    const runs = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(path.join(dir, file), "utf8");
        runs.push(JSON.parse(data));
      }
    }
    return runs;
  } catch {
    return [];
  }
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
  const runs = await listRuns(companyId);
  return NextResponse.json(runs);
}

export async function POST(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  try {
    const params = (context.params && typeof (context.params as any).then === 'function')
      ? await (context.params as Promise<{ companyId: string }>)
      : (context.params as { companyId: string });
    const { companyId } = params;
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!body.name || !body.projectId) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: name, projectId" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const runId = safeUUID();
    const columns = body.columns || [
      { id: "backlog", title: "Backlog" },
      { id: "in_progress", title: "Em andamento" },
      { id: "passed", title: "Passou" },
      { id: "failed", title: "Falhou" }
    ];
    const run = {
      id: runId,
      name: body.name,
      projectId: body.projectId,
      columns,
      cases: body.cases || [],
      createdAt: new Date().toISOString(),
      metrics: body.metrics || null
    };
    await writeRun(companyId, runId, run);
    return NextResponse.json(run, { status: 201 });
  } catch (err: any) {
    console.error('POST /runs error:', err);
    return new Response(JSON.stringify({ error: err?.message || String(err), stack: err?.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
