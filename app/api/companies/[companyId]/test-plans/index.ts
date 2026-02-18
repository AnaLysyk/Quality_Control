import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getTestPlansDir(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "test-plans");
}

async function readTestPlan(companyId: string, planId: string) {
  const planPath = path.join(getTestPlansDir(companyId), `${planId}.json`);
  try {
    const data = await fs.readFile(planPath, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeTestPlan(companyId: string, planId: string, plan: any) {
  const planPath = path.join(getTestPlansDir(companyId), `${planId}.json`);
  await fs.mkdir(path.dirname(planPath), { recursive: true });
  await fs.writeFile(planPath, JSON.stringify(plan, null, 2));
}

async function listTestPlans(companyId: string) {
  const dir = getTestPlansDir(companyId);
  try {
    const files = await fs.readdir(dir);
    const plans = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await fs.readFile(path.join(dir, file), "utf8");
        plans.push(JSON.parse(data));
      }
    }
    return plans;
  } catch {
    return [];
  }
}

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const plans = await listTestPlans(companyId);
  return NextResponse.json(plans);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.name || !body.cases) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const planId = crypto.randomUUID();
  const plan = {
    id: planId,
    name: body.name,
    cases: body.cases,
    source: body.source || "manual",
    qaseId: body.qaseId || null,
    createdAt: new Date().toISOString(),
  };
  await writeTestPlan(companyId, planId, plan);
  return NextResponse.json(plan, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const plan = await readTestPlan(companyId, body.id);
  if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
  Object.assign(plan, body.updates, { updatedAt: new Date().toISOString() });
  await writeTestPlan(companyId, body.id, plan);
  return NextResponse.json(plan);
}

export async function DELETE(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const plan = await readTestPlan(companyId, body.id);
  if (!plan) return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
  plan.deletedAt = new Date().toISOString();
  await writeTestPlan(companyId, body.id, plan);
  return NextResponse.json({ ok: true });
}
