import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";

import { hashPassword } from "@/backend/passwordHash";
import { prisma } from "@/database/prismaClient";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} é obrigatória para executar este seed.`);
  return value;
}

async function createAnaAdmin() {
  const email = requiredEnv("SEED_ANA_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("SEED_ANA_ADMIN_PASSWORD");
  const login = process.env.SEED_ANA_ADMIN_LOGIN?.trim().toLowerCase() || "ana.paula.lysyk";
  const name = process.env.SEED_ANA_ADMIN_NAME?.trim() || "Ana Paula Lysyk";
  const companySlug = process.env.SEED_ANA_ADMIN_COMPANY_SLUG?.trim().toLowerCase() || "testing-company";
  const companyName = process.env.SEED_ANA_ADMIN_COMPANY_NAME?.trim() || "Testing Company";

  if (password.length < 12) {
    throw new Error("SEED_ANA_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
  }

  try {
    const company = await prisma.company.upsert({
      where: { slug: companySlug },
      update: { name: companyName, active: true, status: "active" },
      create: { name: companyName, slug: companySlug, active: true, status: "active" },
    });

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        full_name: name,
        user: login,
        password_hash: hashPassword(password),
        active: true,
        status: "active",
        role: "leader_tc",
        globalRole: "global_admin",
        is_global_admin: true,
        default_company_slug: company.slug,
        home_company_id: company.id,
        user_origin: "testing_company",
        user_scope: "shared",
        allow_multi_company_link: true,
      },
      create: {
        email,
        name,
        full_name: name,
        user: login,
        password_hash: hashPassword(password),
        active: true,
        status: "active",
        role: "leader_tc",
        globalRole: "global_admin",
        is_global_admin: true,
        default_company_slug: company.slug,
        home_company_id: company.id,
        user_origin: "testing_company",
        user_scope: "shared",
        allow_multi_company_link: true,
      },
    });

    await Promise.all([
      prisma.membership.upsert({
        where: { userId_companyId: { userId: user.id, companyId: company.id } },
        update: { role: "leader_tc", allowedProjectIds: [] },
        create: { userId: user.id, companyId: company.id, role: "leader_tc", allowedProjectIds: [] },
      }),
      prisma.userCompany.upsert({
        where: { user_id_company_id: { user_id: user.id, company_id: company.id } },
        update: { role: "leader_tc" },
        create: { user_id: user.id, company_id: company.id, role: "leader_tc" },
      }),
      prisma.userCompanyLink.upsert({
        where: { userId_companyId: { userId: user.id, companyId: company.id } },
        update: { role: "leader_tc", active: true, status: "active" },
        create: { userId: user.id, companyId: company.id, role: "leader_tc", active: true, status: "active" },
      }),
    ]);

    console.log("Administradora criada ou atualizada.", { userId: user.id, login, companySlug });
  } finally {
    await prisma.$disconnect();
  }
}

createAnaAdmin().catch((error) => {
  console.error("Falha ao criar administradora:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
