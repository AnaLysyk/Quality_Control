import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getProjectsPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "projects.json");
}

async function readProjects(companyId: string) {
  try {
    const data = await fs.readFile(getProjectsPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeProjects(companyId: string, projects: any[]) {
  await fs.mkdir(path.dirname(getProjectsPath(companyId)), { recursive: true });
  await fs.writeFile(getProjectsPath(companyId), JSON.stringify(projects, null, 2));
}

import { readdir, readFile } from "fs/promises";

async function aggregateProjectMetrics(companyId: string, projectId: string) {
  // Lê todas as runs do projeto
  const runsDir = path.join(process.cwd(), "data", "companies", companyId, "runs");
  let totalRuns = 0, totalPassed = 0, totalFailed = 0, totalCases = 0;
  try {
    const files = await readdir(runsDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const run = JSON.parse(await readFile(path.join(runsDir, file), "utf8"));
        if (run.projectId === projectId && run.metrics) {
          totalRuns++;
          totalPassed += run.metrics.passed || 0;
          totalFailed += run.metrics.failed || 0;
          totalCases += (run.cases ? run.cases.length : 0);
        }
      }
    }
  } catch {}
  const passRate = totalCases ? totalPassed / totalCases : 0;
  return { totalRuns, totalPassed, totalFailed, totalCases, passRate };
}

export async function GET(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ companyId: string }>)
    : (context.params as { companyId: string });
  const { companyId } = params;
  const projects = await readProjects(companyId);
  // Agrega métricas para cada projeto
  for (const project of projects) {
    project.metrics = await aggregateProjectMetrics(companyId, project.id);
  }
  return NextResponse.json(projects);
}

export async function POST(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ companyId: string }>)
    : (context.params as { companyId: string });
  const { companyId } = params;
  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }
  const projects = await readProjects(companyId);
  const newProject = {
    id: crypto.randomUUID(),
    name: body.name,
    qaseId: body.qaseId || null,
    createdAt: new Date().toISOString(),
    integrationSource: body.integrationSource || "manual",
  };
  projects.push(newProject);
  await writeProjects(companyId, projects);
  return NextResponse.json(newProject, { status: 201 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ companyId: string }>)
    : (context.params as { companyId: string });
  const { companyId } = params;
  const body = await req.json();
  const projects = await readProjects(companyId);
  const idx = projects.findIndex((p: any) => p.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  Object.assign(projects[idx], body.updates, { updatedAt: new Date().toISOString() });
  await writeProjects(companyId, projects);
  return NextResponse.json(projects[idx]);
}

export async function DELETE(
  req: NextRequest,
  context: { params: { companyId: string } } | { params: Promise<{ companyId: string }> }
) {
  const params = (context.params && typeof (context.params as any).then === 'function')
    ? await (context.params as Promise<{ companyId: string }>)
    : (context.params as { companyId: string });
  const { companyId } = params;
  const body = await req.json();
  const projects = await readProjects(companyId);
  const idx = projects.findIndex((p: any) => p.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  projects[idx].deletedAt = new Date().toISOString();
  await writeProjects(companyId, projects);
  return NextResponse.json({ ok: true });
}
