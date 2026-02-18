import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getCasesPath(companyId: string) {
  return path.join(process.cwd(), "data", "companies", companyId, "cases.json");
}

async function readCases(companyId: string) {
  try {
    const data = await fs.readFile(getCasesPath(companyId), "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeCases(companyId: string, cases: any[]) {
  await fs.mkdir(path.dirname(getCasesPath(companyId)), { recursive: true });
  await fs.writeFile(getCasesPath(companyId), JSON.stringify(cases, null, 2));
}

export async function GET(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const cases = await readCases(companyId);
  return NextResponse.json(cases);
}

export async function POST(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  if (!body.title || !body.createdBy) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const cases = await readCases(companyId);
  const newCase = {
    id: crypto.randomUUID(),
    title: body.title,
    description: body.description || "",
    createdBy: body.createdBy,
    companyId,
    createdAt: new Date().toISOString(),
  };
  cases.push(newCase);
  await writeCases(companyId, cases);
  return NextResponse.json(newCase, { status: 201 });
}

export async function PATCH(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const cases = await readCases(companyId);
  const idx = cases.findIndex((c: any) => c.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  Object.assign(cases[idx], body.updates, { updatedAt: new Date().toISOString() });
  await writeCases(companyId, cases);
  return NextResponse.json(cases[idx]);
}

export async function DELETE(req: Request, { params }: { params: { companyId: string } }) {
  const { companyId } = params;
  const body = await req.json();
  const cases = await readCases(companyId);
  const idx = cases.findIndex((c: any) => c.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  cases[idx].deletedAt = new Date().toISOString();
  await writeCases(companyId, cases);
  return NextResponse.json({ ok: true });
}
