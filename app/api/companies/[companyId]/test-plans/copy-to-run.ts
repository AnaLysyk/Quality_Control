import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getTestPlanPath(companyId: string, planId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "test-plans", `${planId}.json`);
}
function getRunPath(companyId: string, runId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "runs", `${runId}.json`);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.planId || !body.runId) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const planPath = getTestPlanPath(companyId, body.planId);
  const runPath = getRunPath(companyId, body.runId);
  let plan, run;
  try {
    plan = JSON.parse(await fs.readFile(planPath, "utf8"));
    run = JSON.parse(await fs.readFile(runPath, "utf8"));
  } catch {
    return NextResponse.json({ error: "Plano ou run não encontrado" }, { status: 404 });
  }
  // Se body.caseIds, filtra só os casos selecionados
  const casesToAdd = body.caseIds ? plan.cases.filter((c: any) => body.caseIds.includes(c.id)) : plan.cases;
  run.cases = [...run.cases, ...casesToAdd];
  run.updatedAt = new Date().toISOString();
  await fs.writeFile(runPath, JSON.stringify(run, null, 2));
  return NextResponse.json(run);
}
