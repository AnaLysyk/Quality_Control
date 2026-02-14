import { NextResponse } from "next/server";
import { listLocalCompanies } from "@/lib/auth/localStore";

export const runtime = "nodejs";

export async function GET() {
  try {
    const companies = await listLocalCompanies();
    if (!Array.isArray(companies)) {
      throw new Error("Formato inválido de empresas");
    }
    const items = companies.map((company) => ({
      id: company.id,
      name: company.name ?? company.company_name ?? "Empresa",
      slug: company.slug ?? null,
      active: company.active === true,
    }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (error) {
    console.error("Erro ao listar empresas:", error);
    return NextResponse.json(
      { error: "Erro interno ao listar empresas" },
      { status: 500 }
    );
  }
}
