import { NextResponse } from "next/server";
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

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const runs = await listRuns(companyId);
  return NextResponse.json(runs);
}


export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.name || !body.projectId) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const runId = crypto.randomUUID();
  const columns = body.columns || [
    { id: "backlog", title: "Backlog" },
    { id: "in_progress", title: "Em andamento" },
    { id: "passed", title: "Passou" },
    { id: "failed", title: "Falhou" }
  ];
  const cases = body.cases || [];
  // Calcula métricas por coluna
  const metrics: Record<string, number> = {};
  for (const col of columns) {
    metrics[col.id] = cases.filter((c: any) => c.status === col.id).length;
  }
  const total = cases.length;
  const pass = metrics["passed"] || 0;
  const fail = metrics["failed"] || 0;
  metrics["passRate"] = total ? pass / total : 0;
  metrics["failRate"] = total ? fail / total : 0;
  const run = {
    id: runId,
    name: body.name,
    projectId: body.projectId,
    source: body.source || "manual",
    qaseId: body.qaseId || null,
    cases,
    defects: body.defects || [],
    columns,
    metrics,
    createdAt: new Date().toISOString(),
  };
  await writeRun(companyId, runId, run);
  return NextResponse.json(run, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const run = await readRun(companyId, body.id);
  if (!run) return NextResponse.json({ error: "Run não encontrada" }, { status: 404 });
  Object.assign(run, body.updates, { updatedAt: new Date().toISOString() });
  // Recalcula métricas se casos ou colunas mudaram
  const columns = run.columns || [
    { id: "backlog", title: "Backlog" },
    { id: "in_progress", title: "Em andamento" },
    { id: "passed", title: "Passou" },
    { id: "failed", title: "Falhou" }
  ];
  const cases = run.cases || [];
  const metrics: Record<string, number> = {};
  for (const col of columns) {
    metrics[col.id] = cases.filter((c: any) => c.status === col.id).length;
  }
  const total = cases.length;
  const pass = metrics["passed"] || 0;
  const fail = metrics["failed"] || 0;
  metrics["passRate"] = total ? pass / total : 0;
  metrics["failRate"] = total ? fail / total : 0;
  run.metrics = metrics;
  await writeRun(companyId, body.id, run);
  return NextResponse.json(run);
}

export async function DELETE(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const run = await readRun(companyId, body.id);
  if (!run) return NextResponse.json({ error: "Run não encontrada" }, { status: 404 });
  run.deletedAt = new Date().toISOString();
  await writeRun(companyId, body.id, run);
  return NextResponse.json({ ok: true });
}
