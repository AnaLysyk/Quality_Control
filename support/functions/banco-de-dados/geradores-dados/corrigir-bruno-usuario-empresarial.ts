import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";

import { Role } from "@prisma/client";
import { prisma } from "@/lib/prismaClient";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "bruno.andrade@acme-seguros.com" },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new Error("Usuário de teste Bruno Andrade não encontrado");

  const company = await prisma.company.findFirst({
    where: {
      active: true,
      OR: [
        { slug: "acme-seguros" },
        { name: { equals: "Acme Seguros", mode: "insensitive" } },
        { company_name: { equals: "Acme Seguros", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, company_name: true, slug: true },
  });
  if (!company) throw new Error("Empresa Acme Seguros não encontrada");

  let projects = await prisma.project.findMany({
    where: { companyId: company.id, archivedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (!projects.length) {
    const created = await prisma.project.upsert({
      where: {
        companyId_slug: {
          companyId: company.id,
          slug: "portal-empresarial",
        },
      },
      update: {
        name: "Portal Empresarial",
        status: "active",
        archivedAt: null,
      },
      create: {
        companyId: company.id,
        slug: "portal-empresarial",
        name: "Portal Empresarial",
        status: "active",
      },
      select: { id: true, name: true },
    });
    projects = [created];
  }

  const projectIds = projects.map((project) => project.id);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        role: Role.user,
        globalRole: "company_user",
        active: true,
        status: "active",
        created_by_company_id: company.id,
        home_company_id: company.id,
        default_company_slug: company.slug,
        user_origin: "client_company",
        user_scope: "company_only",
        allow_multi_company_link: false,
      },
    });

    await tx.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: { role: Role.user, allowedProjectIds: projectIds },
      create: {
        userId: user.id,
        companyId: company.id,
        role: Role.user,
        capabilities: [],
        allowedProjectIds: projectIds,
      },
    });

    await tx.userCompanyLink.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: {
        role: Role.user,
        active: true,
        status: "active",
        roleInCompany: "company_user",
      },
      create: {
        userId: user.id,
        companyId: company.id,
        role: Role.user,
        active: true,
        status: "active",
        roleInCompany: "company_user",
        linkedBy: user.id,
      },
    });
  });

  console.log("[corrigir-bruno] usuário empresarial corrigido com sucesso");
  console.table({
    usuario: user.email,
    empresa: company.company_name || company.name,
    projetos: projects.map((project) => project.name).join(", "),
  });
}

main()
  .catch((error) => {
    console.error("[corrigir-bruno] erro:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
