// Importa utilitários do Next.js para lidar com requisições e respostas
import { NextRequest, NextResponse } from "next/server";
// Importa o cliente Prisma para acesso ao banco de dados
import { prisma } from "../../../lib/prismaClient";

// POST: Cria um novo defeito para uma empresa e release manual
// Espera receber no corpo: title, description, companyId, releaseManualId
export async function POST(req: NextRequest) {
  // Lê os dados enviados na requisição
  const data = await req.json();
  const { title, description, companyId, releaseManualId } = data;
  // Valida se os campos obrigatórios foram enviados
  if (!title || !companyId) {
    return NextResponse.json({ error: "title e companyId são obrigatórios" }, { status: 400 });
  }
  // Cria o defeito no banco de dados usando o modelo Defect
  const defect = await prisma.defect.create({
    data: { title, description, companyId, releaseManualId },
  });
  // Retorna o defeito criado com status 201 (Created)
  return NextResponse.json(defect, { status: 201 });
}

// GET: Lista todos os defeitos de uma empresa (e opcionalmente de um release manual)
// Parâmetros de busca: companyId (obrigatório), releaseManualId (opcional)
export async function GET(req: NextRequest) {
  // Obtém o companyId e releaseManualId dos parâmetros da URL
  const companyId = req.nextUrl.searchParams.get("companyId");
  const releaseManualId = req.nextUrl.searchParams.get("releaseManualId");
  // Valida se o companyId foi informado
  if (!companyId) {
    return NextResponse.json({ error: "companyId é obrigatório" }, { status: 400 });
  }
  // Busca todos os defeitos da empresa (e opcionalmente do release manual)
  const defects = await prisma.defect.findMany({
    where: {
      companyId,
      ...(releaseManualId ? { releaseManualId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  // Retorna a lista de defeitos encontrados
  return NextResponse.json(defects);
}
