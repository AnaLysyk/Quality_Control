import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
