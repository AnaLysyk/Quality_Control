import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prismaClient";

// POST: Cria um novo defeito para uma empresa e release manual
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { title, description, companyId, releaseManualId } = data;
  if (!title || !companyId) {
    return NextResponse.json({ error: "title e companyId são obrigatórios" }, { status: 400 });
  }
  const defect = await prisma.defect.create({
    data: { title, description, companyId, releaseManualId },
  });
  return NextResponse.json(defect, { status: 201 });
}

// GET: Lista todos os defeitos de uma empresa (e opcionalmente de um release manual)
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  const releaseManualId = req.nextUrl.searchParams.get("releaseManualId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId é obrigatório" }, { status: 400 });
  }
  const defects = await prisma.defect.findMany({
    where: {
      companyId,
      ...(releaseManualId ? { releaseManualId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(defects);
}
