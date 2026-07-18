import { NextResponse } from "next/server";
import { listLocalCompanies } from "@/backend/auth/localStore";
import { NO_STORE_HEADERS } from "@/backend/http/noStore";
import { rateLimit } from "@/backend/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const rate = await rateLimit(req, "public-clients");
  if (rate.limited) return rate.response;
  const companies = await listLocalCompanies();
  const items = companies.filter((company) => company.active !== false && company.status !== "archived").map((company) => ({
    id: company.id,
    name: company.name ?? company.company_name ?? "Empresa",
    company_name: company.company_name ?? company.name ?? "Empresa",
    slug: company.slug,
    active: company.active ?? true,
  }));
  return NextResponse.json({ items }, { status: 200, headers: NO_STORE_HEADERS });
}
