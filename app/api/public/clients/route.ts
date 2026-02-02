import { NextResponse } from "next/server";
import { listLocalCompanies } from "@/lib/auth/localStore";

export const runtime = "nodejs";

export async function GET() {
  const companies = await listLocalCompanies();
  const items = companies.map((company) => ({
    id: company.id,
    name: company.name ?? company.company_name ?? "Empresa",
    company_name: company.company_name ?? company.name ?? "Empresa",
    slug: company.slug,
    active: company.active ?? true,
  }));
  return NextResponse.json({ items }, { status: 200 });
}
