import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPasswordSha256 } from "@/lib/passwordHash";

// POST: Cria um novo usuário e vincula a uma empresa
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { email, name, password, companyId } = data;
  if (!email || !name || !password || !companyId) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }
  try {
    const hash = hashPasswordSha256(password);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password_hash: hash,
        userCompanies: {
          create: {
            role: "user",
            company: { connect: { id: String(companyId) } },
          },
        },
      },
      include: { userCompanies: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "E-mail já existe" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 });
  }
}
