console.log('DATABASE_URL:', process.env.DATABASE_URL);

import "./loadEnv";
import { hashPasswordSha256 } from "../lib/passwordHash";
// PrismaClient deve ser importado após o carregamento das variáveis de ambiente
// Load PrismaClient dynamically to avoid build-time type errors when @prisma/client
// is not installed in the environment used for building the frontend assets.
const _pkg = require("@prisma/client");
const PrismaClient = (_pkg && _pkg.PrismaClient) || (_pkg && _pkg.default && _pkg.default.PrismaClient);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = PrismaClient ? new PrismaClient() : ({} as any);

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
