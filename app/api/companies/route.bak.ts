import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const COMPANIES_PATH = path.join(process.cwd(), "data", "companies.json");

async function readCompanies() {
  try {
    const data = await fs.readFile(COMPANIES_PATH, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeCompanies(companies: any[]) {
  await fs.writeFile(COMPANIES_PATH, JSON.stringify(companies, null, 2));
}

export async function GET() {
  const companies = await readCompanies();
  return NextResponse.json(companies);
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name || !body.slug) {
    return NextResponse.json({ error: "Campos obrigatórios" }, { status: 400 });
  }
  const companies = await readCompanies();
  const newCompany = {
    id: crypto.randomUUID(),
    name: body.name,
    slug: body.slug,
    createdAt: new Date().toISOString(),
  };
  companies.push(newCompany);
  await writeCompanies(companies);
  return NextResponse.json(newCompany, { status: 201 });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const companies = await readCompanies();
  const idx = companies.findIndex((c: any) => c.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  Object.assign(companies[idx], body.updates, { updatedAt: new Date().toISOString() });
  await writeCompanies(companies);
  return NextResponse.json(companies[idx]);
}

export async function DELETE(req: Request) {
  const body = await req.json();
  const companies = await readCompanies();
  const idx = companies.findIndex((c: any) => c.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  companies[idx].deletedAt = new Date().toISOString();
  await writeCompanies(companies);
  return NextResponse.json({ ok: true });
}
