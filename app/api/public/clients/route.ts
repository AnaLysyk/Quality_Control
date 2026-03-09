import { NextResponse } from "next/server";
import { listLocalCompanies } from "@/lib/auth/localStore";
import { NO_STORE_HEADERS } from "@/lib/http/noStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const companies = await listLocalCompanies();
  const items = companies.map((company) => ({
    id: company.id,
    name: company.name ?? company.company_name ?? "Empresa",
    company_name: company.company_name ?? company.name ?? "Empresa",
    slug: company.slug,
    active: company.active ?? true,
  }));
  return NextResponse.json({ items }, { status: 200, headers: NO_STORE_HEADERS });
}
