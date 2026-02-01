import { NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";

export const runtime = "nodejs";

export async function GET() {
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
  const items = companies.map((company) => ({
    id: company.id,
    name: company.name,
    company_name: company.name,
    slug: company.slug,
    active: true,
  }));
  return NextResponse.json({ items }, { status: 200 });
}
