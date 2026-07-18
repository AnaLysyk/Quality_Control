import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";

import { type Role } from "@prisma/client";
import { hashPasswordSha256 } from "../../../../../lib/passwordHash";
import { prisma } from "../../../../database/prismaClient";

const senhaPadrao = process.env.QC_REVIEWER_PASSWORD ?? process.env.E2E_PROFILE_PASSWORD ?? "SenhaVisual@123";

const usuarios = [
  {
    full_name: "E2E Líder TC",
    name: "E2E Líder TC",
    user: "e2e-leader-tc",
    email: "e2e-leader-tc@testingcompany.local",
    phone: "+55 11 4000-0000",
    job_title: "Líder TC",
    role: "leader_tc" as Role,
  },
  {
    full_name: "E2E Suporte Técnico",
    name: "E2E Suporte Técnico",
    user: "e2e-suporte",
    email: "e2e-suporte@testingcompany.local",
    phone: "+55 11 4000-0001",
    job_title: "Suporte Técnico",
    role: "technical_support" as Role,
  },
  {
    full_name: "E2E Usuário TC",
    name: "E2E Usuário TC",
    user: "e2e-user-tc",
    email: "e2e-user-tc@testingcompany.local",
    phone: "+55 11 4000-0002",
    job_title: "Usuário Testing Company",
    role: "user" as Role,
  },
  {
    full_name: "E2E Usuário Empresa",
    name: "E2E Usuário Empresa",
    user: "e2e-company-user",
    email: "e2e-company-user@empresa.local",
    phone: "+55 11 4000-0003",
    job_title: "Usuário da empresa",
    role: "user" as Role,
  },
  {
    full_name: "E2E Empresa",
    name: "E2E Empresa",
    user: "e2e-empresa",
    email: "e2e-empresa@empresa.local",
    phone: "+55 11 4000-0004",
    job_title: "Empresa",
    role: "company" as Role,
  },
];

async function main() {
  const password_hash = hashPasswordSha256(senhaPadrao);

  for (const usuario of usuarios) {
    await prisma.user.upsert({
      where: { email: usuario.email },
      update: {
        full_name: usuario.full_name,
        name: usuario.name,
        user: usuario.user,
        phone: usuario.phone,
        job_title: usuario.job_title,
        role: usuario.role,
        active: true,
        password_hash,
      },
      create: {
        full_name: usuario.full_name,
        name: usuario.name,
        email: usuario.email,
        user: usuario.user,
        phone: usuario.phone,
        job_title: usuario.job_title,
        role: usuario.role,
        active: true,
        password_hash,
      },
    });

    console.log(`[OK] Usuário preparado: ${usuario.email} / ${usuario.role}`);
  }

  console.log(`[OK] Senha padrão dos usuários E2E: ${senhaPadrao}`);
}

main()
  .catch((error) => {
    console.error("[ERRO] Falha ao preparar usuários E2E:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

