console.log("DATABASE_URL:", process.env.DATABASE_URL);

import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { prisma } from "@/database/prismaClient";

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
        role: "company_admin",
        default_company_slug: company.slug,
      },
      create: {
        email,
        name: "Ana Testing Company",
        password_hash: hashedPassword,
        active: true,
        role: "company_admin",
        default_company_slug: company.slug,
      },
    });

    await prisma.membership.upsert({
      where: {
        userId_companyId: {
          userId: user.id,
          companyId: company.id,
        },
      },
      update: { role: "company_admin" },
      create: {
        userId: user.id,
        companyId: company.id,
        role: "company_admin",
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

    console.log("Usuario admin criado ou atualizado:", { email, company: company.slug });
  } catch (error) {
    console.error("Erro ao criar admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createAnaAdmin();

