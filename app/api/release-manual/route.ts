import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prismaClient";

// POST: Cria um novo release manual para uma empresa
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { title, description, companyId } = data;
  if (!title || !companyId) {
    return NextResponse.json({ error: "title e companyId são obrigatórios" }, { status: 400 });
  }
  const release = await prisma.releaseManual.create({
    data: { title, description, companyId },
  });
  return NextResponse.json(release, { status: 201 });
}

// GET: Lista todos os releases manuais de uma empresa
export async function GET(req: NextRequest) {
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId é obrigatório" }, { status: 400 });
  }
  const releases = await prisma.releaseManual.findMany({ where: { companyId } });
  return NextResponse.json(releases);
}
