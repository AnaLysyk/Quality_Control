// GET: Lista empresas
export async function GET(req: NextRequest) {
  // Extrai sessão do request (ajuste conforme seu middleware/session)
  const session = (req as any).session || {};
  const userEmail = session.email;
  const userRole = session.role;
  const userCompanyId = session.companyId;

  // Se for admin (role admin/super-admin ou email da admin global), pode ver todas
  const isGlobalAdmin = userRole === 'admin' || userRole === 'super-admin' || userEmail === 'ana.testing.company@gmail.com';

  if (isGlobalAdmin) {
    // Admin vê todas as empresas
    const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ items: companies }, { status: 200 });
  }

  // Usuário comum só vê a própria empresa
  if (!userCompanyId) {
    return NextResponse.json({ error: "Sem empresa vinculada" }, { status: 403 });
  }
  const company = await prisma.company.findUnique({ where: { id: userCompanyId } });
  if (!company) {
    return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ items: [company] }, { status: 200 });
}
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";

// POST: Cria uma nova empresa
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { name, slug } = data;
  if (!name || !slug) {
    return NextResponse.json({ error: "name e slug são obrigatórios" }, { status: 400 });
  }
  try {
    const company = await prisma.company.create({
      data: { name, slug },
    });
    return NextResponse.json(company, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Slug já existe" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao criar empresa" }, { status: 500 });
  }
}
