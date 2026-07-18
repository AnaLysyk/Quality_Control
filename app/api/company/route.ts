import { NextRequest, NextResponse } from "next/server";

import { getAccessContext } from "@/backend/auth/session";
import { createLocalCompany, findLocalCompanyById, listLocalCompanies } from "@/backend/auth/localStore";
import { requireGlobalAdminWithStatus } from "@/backend/rbac/requireGlobalAdmin";

export const revalidate = 0;

// GET: Lista empresas
export async function GET(req: NextRequest) {
  const access = await getAccessContext(req);
  if (!access) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const isGlobalAdmin = access.isGlobalAdmin === true || (access.role ?? "").toLowerCase() === "leader_tc";

  if (isGlobalAdmin) {
    const companies = await listLocalCompanies();
    return NextResponse.json({ items: companies }, { status: 200 });
  }

  if (!access.companyId) {
    return NextResponse.json({ error: "Sem empresa vinculada" }, { status: 403 });
  }

  const company = await findLocalCompanyById(access.companyId);
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ items: [company] }, { status: 200 });
}

// POST: Cria uma nova empresa
export async function POST(req: NextRequest) {
  const { admin, status } = await requireGlobalAdminWithStatus(req);
  if (!admin) {
    return NextResponse.json({ error: status === 401 ? "Não autenticado" : "Sem permissão" }, { status });
  }

  const data = await req.json().catch(() => null);
  const name = typeof data?.name === "string" ? data.name.trim() : "";
  const slug = typeof data?.slug === "string" ? data.slug.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name e obrigatório" }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

  try {
    const company = await createLocalCompany({
      name,
      slug: slug || undefined,
      tax_id: str(data?.tax_id),
      company_name: str(data?.company_name),
      address: str(data?.address),
      phone: str(data?.phone),
      cep: str(data?.cep),
    });
    return NextResponse.json(company, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro ao criar empresa" }, { status: 500 });
  }
}

