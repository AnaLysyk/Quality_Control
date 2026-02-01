console.log('DATABASE_URL:', process.env.DATABASE_URL);

import "./loadEnv";
import { hashPasswordSha256 } from "../lib/passwordHash";
// PrismaClient deve ser importado após o carregamento das variáveis de ambiente
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createAnaAdmin() {
  const email = "ana.testing.company@gmail.com";
  const password = "griaule4096PD$";
  const hashedPassword = hashPasswordSha256(password);

  try {
    const company = await prisma.company.upsert({
      where: { slug: "griaule" },
      update: { name: "Griaule" },
      create: {
        name: "Griaule",
        slug: "griaule",
      },
    });

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: "Ana Testing Company",
        password_hash: hashedPassword,
        active: true,
      },
      create: {
        email,
        name: "Ana Testing Company",
        password_hash: hashedPassword,
        active: true,
      },
    });

    await prisma.userCompany.upsert({
      where: {
        user_id_company_id: {
          user_id: user.id,
          company_id: company.id,
        },
      },
      update: { role: "admin" },
      create: {
        user_id: user.id,
        company_id: company.id,
        role: "admin",
      },
    });

    console.log("Usuário admin criado ou atualizado:", { email, company: company.slug });
  } catch (error) {
    console.error("Erro ao criar admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAnaAdmin();
