import { NextResponse } from "next/server";
import { listLocalCompanies, createLocalCompany } from "@/lib/auth/localStore";

export async function GET() {
  const companies = await listLocalCompanies();
  return NextResponse.json(companies);
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Se não for JSON válido, body permanece {}
  }
  if (!body.name) {
    return NextResponse.json({ error: "Campo 'name' obrigatório" }, { status: 400 });
  }
  const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const company = await createLocalCompany({
    name: body.name,
    slug,
    company_name: body.company_name || body.name,
    integration_mode: body.integration_mode || "manual",
    qase_project_code: body.qase_project_code || null,
    qase_token: body.qase_token || null,
    created_at: new Date().toISOString(),
  });
  return NextResponse.json(company, { status: 201 });
}

export async function PATCH(req: Request) {
  // Not implemented: PATCH for localAuthStore
  return NextResponse.json({ error: "PATCH não implementado" }, { status: 501 });
}

export async function DELETE(req: Request) {
  // Accept id via query param for RESTful DELETE
  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "ID da empresa é obrigatório" }, { status: 400 });
  }
  // Use localAuthStore for deletion
  const companies = await listLocalCompanies();
  const idx = companies.findIndex((c: any) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  companies[idx].deletedAt = new Date().toISOString();
  // Optionally: implement deleteLocalCompany if needed
  return NextResponse.json({ ok: true });
}
