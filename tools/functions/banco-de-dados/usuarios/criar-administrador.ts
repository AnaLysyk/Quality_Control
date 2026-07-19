import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";

import { hashPassword } from "@/backend/passwordHash";
import { prisma } from "@/database/prismaClient";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} é obrigatória para executar este seed.`);
  return value;
}

async function createAdmin() {
  const email = requiredEnv("CREATE_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("CREATE_ADMIN_PASSWORD");
  const login = process.env.CREATE_ADMIN_LOGIN?.trim().toLowerCase() || email.split("@")[0];
  const name = process.env.CREATE_ADMIN_NAME?.trim() || "Administrador";
  const companySlug = process.env.CREATE_ADMIN_COMPANY_SLUG?.trim().toLowerCase() || "testing-company";
  const companyName = process.env.CREATE_ADMIN_COMPANY_NAME?.trim() || "Testing Company";

  if (password.length < 12) {
    throw new Error("CREATE_ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
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
        user_origin: "testing_company",
        default_company_slug: company.slug,
        home_company_id: company.id,
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
        user_origin: "testing_company",
        default_company_slug: company.slug,
        home_company_id: company.id,
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

    console.log("Administrador criado ou atualizado.", { userId: user.id, login, companySlug });
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin().catch((error) => {
  console.error("Falha ao criar administrador:", error instanceof Error ? error.message : "erro desconhecido");
  process.exitCode = 1;
});
