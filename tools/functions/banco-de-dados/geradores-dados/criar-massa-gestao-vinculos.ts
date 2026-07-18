import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";

import { Role } from "@prisma/client";
import { hashPasswordSha256 } from "@/backend/passwordHash";
import { prisma } from "@/database/prismaClient";

const TEST_PASSWORD = "Teste@12345";

const leaders = [
  {
    name: "Marina Costa",
    email: "marina.lider.tc@example.test",
    login: "marina.lider.tc",
  },
  {
    name: "Rafael Mendes",
    email: "rafael.lider.tc@example.test",
    login: "rafael.lider.tc",
  },
] as const;

const qaUsers = [
  {
    name: "Lucas Almeida",
    email: "lucas.usuario.tc@example.test",
    login: "lucas.usuario.tc",
  },
  {
    name: "Camila Rocha",
    email: "camila.usuario.tc@example.test",
    login: "camila.usuario.tc",
  },
  {
    name: "Diego Martins",
    email: "diego.usuario.tc@example.test",
    login: "diego.usuario.tc",
  },
] as const;

const projectSeeds = [
  {
    slug: "gestao-vinculos-web",
    name: "Gestão de Vínculos Web",
  },
  {
    slug: "gestao-vinculos-api",
    name: "Gestão de Vínculos API",
  },
] as const;

async function ensureCompany() {
  return prisma.company.upsert({
    where: { slug: "testing-company" },
    update: {
      name: "Testing Company",
      company_name: "Testing Company",
      active: true,
      status: "active",
    },
    create: {
      slug: "testing-company",
      name: "Testing Company",
      company_name: "Testing Company",
      active: true,
      status: "active",
    },
  });
}

async function ensureProject(companyId: string, seed: (typeof projectSeeds)[number]) {
  return prisma.project.upsert({
    where: {
      companyId_slug: {
        companyId,
        slug: seed.slug,
      },
    },
    update: {
      name: seed.name,
      status: "active",
      archivedAt: null,
    },
    create: {
      companyId,
      slug: seed.slug,
      name: seed.name,
      status: "active",
    },
  });
}

async function ensureLeader(companyId: string, seed: (typeof leaders)[number]) {
  const user = await prisma.user.upsert({
    where: { email: seed.email },
    update: {
      name: seed.name,
      full_name: seed.name,
      user: seed.login,
      role: Role.leader_tc,
      globalRole: "leader_tc",
      active: true,
      status: "active",
      user_origin: "testing_company",
      user_scope: "shared",
      allow_multi_company_link: true,
    },
    create: {
      name: seed.name,
      full_name: seed.name,
      email: seed.email,
      user: seed.login,
      password_hash: hashPasswordSha256(TEST_PASSWORD),
      role: Role.leader_tc,
      globalRole: "leader_tc",
      active: true,
      status: "active",
      user_origin: "testing_company",
      user_scope: "shared",
      allow_multi_company_link: true,
    },
  });

  await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId } },
    update: { role: Role.leader_tc },
    create: { userId: user.id, companyId, role: Role.leader_tc },
  });

  return user;
}

async function ensureQaUser(companyId: string, seed: (typeof qaUsers)[number]) {
  const user = await prisma.user.upsert({
    where: { email: seed.email },
    update: {
      name: seed.name,
      full_name: seed.name,
      user: seed.login,
      role: Role.user,
      globalRole: "testing_company_user",
      active: true,
      status: "active",
      user_origin: "testing_company",
      user_scope: "shared",
      allow_multi_company_link: true,
    },
    create: {
      name: seed.name,
      full_name: seed.name,
      email: seed.email,
      user: seed.login,
      password_hash: hashPasswordSha256(TEST_PASSWORD),
      role: Role.user,
      globalRole: "testing_company_user",
      active: true,
      status: "active",
      user_origin: "testing_company",
      user_scope: "shared",
      allow_multi_company_link: true,
    },
  });

  await prisma.membership.upsert({
    where: { userId_companyId: { userId: user.id, companyId } },
    update: { role: Role.user },
    create: { userId: user.id, companyId, role: Role.user },
  });

  return user;
}

async function ensureAssignment(input: {
  userId: string;
  companyId: string;
  projectId: string;
  role: "leader_tc" | "qa_tc";
  createdBy: string;
}) {
  const current = await prisma.projectTeamAssignment.findFirst({
    where: {
      userId: input.userId,
      projectId: input.projectId,
      role: input.role,
      status: "active",
    },
  });

  if (current) return current;

  return prisma.projectTeamAssignment.create({
    data: input,
  });
}

async function main() {
  const company = await ensureCompany();
  const projects = await Promise.all(projectSeeds.map((seed) => ensureProject(company.id, seed)));
  const leaderUsers = await Promise.all(leaders.map((seed) => ensureLeader(company.id, seed)));
  const qaUserRecords = await Promise.all(qaUsers.map((seed) => ensureQaUser(company.id, seed)));

  for (let index = 0; index < projects.length; index += 1) {
    const project = projects[index];
    const leader = leaderUsers[index];

    const existingLeader = await prisma.projectTeamAssignment.findFirst({
      where: {
        projectId: project.id,
        role: "leader_tc",
        status: "active",
      },
    });

    if (!existingLeader) {
      await ensureAssignment({
        userId: leader.id,
        companyId: company.id,
        projectId: project.id,
        role: "leader_tc",
        createdBy: leader.id,
      });
    }
  }

  await ensureAssignment({
    userId: qaUserRecords[0].id,
    companyId: company.id,
    projectId: projects[0].id,
    role: "qa_tc",
    createdBy: leaderUsers[0].id,
  });

  await ensureAssignment({
    userId: qaUserRecords[1].id,
    companyId: company.id,
    projectId: projects[0].id,
    role: "qa_tc",
    createdBy: leaderUsers[0].id,
  });

  await ensureAssignment({
    userId: qaUserRecords[2].id,
    companyId: company.id,
    projectId: projects[1].id,
    role: "qa_tc",
    createdBy: leaderUsers[1].id,
  });

  console.log("[seed-gestao-vinculos] massa criada/atualizada com sucesso");
  console.table([
    ...leaders.map((item) => ({ perfil: "Líder TC", nome: item.name, login: item.login, senha: TEST_PASSWORD })),
    ...qaUsers.map((item) => ({ perfil: "Usuário TC", nome: item.name, login: item.login, senha: TEST_PASSWORD })),
  ]);
}

main()
  .catch((error) => {
    console.error("[seed-gestao-vinculos] erro:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
