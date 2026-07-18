import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";
import { hashPasswordSha256 } from "@/lib/passwordHash";
import { prisma } from "@/database/prismaClient";
import type { TestCaseRecord } from "@/lib/test-cases/types";
import type { Prisma } from "@prisma/client";

const COMPANY = {
  name: "Demo",
  slug: "demo",
};

const USERS = {
  admin: {
    email: "admin@demo.test",
    name: "Demo Admin",
    role: "admin",
  },
  user: {
    email: "user@demo.test",
    name: "Demo User",
    role: "user",
  },
};

const PASSWORD = "Demo@123";

function buildDemoCaseRecord(input: {
  id: string;
  key: string;
  title: string;
  description: string;
  companySlug: string;
  projectId: string;
  projectCode: string;
  createdBy: string;
}): TestCaseRecord {
  const now = new Date().toISOString();
  return {
    testCase: {
      id: input.id,
      key: input.key,
      source: "manual",
      title: input.title,
      description: input.description,
      type: "manual",
      status: "active",
      priority: "medium",
      companyId: input.companySlug,
      projectId: input.projectId,
      testProjectCode: input.projectCode,
      testProjectName: "Projeto Demo",
      tags: ["demo", "seed"],
      automationStatus: "none",
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
      lastExecutionStatus: "not_run",
    },
    steps: [
      {
        id: `${input.id}-s1`,
        testCaseId: input.id,
        order: 1,
        action: "Abrir a tela principal",
        expectedResult: "Tela carregada sem erro",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${input.id}-s2`,
        testCaseId: input.id,
        order: 2,
        action: "Executar fluxo principal",
        expectedResult: "Fluxo concluido com sucesso",
        createdAt: now,
        updatedAt: now,
      },
    ],
    versions: [
      {
        id: `${input.id}-v1`,
        testCaseId: input.id,
        version: 1,
        createdBy: input.createdBy,
        createdAt: now,
        snapshot: {
          title: input.title,
          description: input.description,
          steps: [
            { order: 1, action: "Abrir a tela principal", expectedResult: "Tela carregada sem erro" },
            { order: 2, action: "Executar fluxo principal", expectedResult: "Fluxo concluido com sucesso" },
          ],
          tags: ["demo", "seed"],
          priority: "medium",
          status: "active",
        },
      },
    ],
    automationLink: null,
    externalSync: null,
  };
}

async function upsertUser(email: string, name: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { name, password_hash: passwordHash, active: true },
    create: { email, name, password_hash: passwordHash, active: true },
  });
}

async function upsertLink(userId: string, companyId: string, role: string) {
  return prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: userId, company_id: companyId } },
    update: { role: role as any },
    create: { user_id: userId, company_id: companyId, role: role as any },
  });
}

async function main() {
  const passwordHash = hashPasswordSha256(PASSWORD);

  const company = await prisma.company.upsert({
    where: { slug: COMPANY.slug },
    update: { name: COMPANY.name },
    create: { name: COMPANY.name, slug: COMPANY.slug },
  });

  const adminUser = await upsertUser(USERS.admin.email, USERS.admin.name, passwordHash);
  const normalUser = await upsertUser(USERS.user.email, USERS.user.name, passwordHash);

  await upsertLink(adminUser.id, company.id, USERS.admin.role);
  await upsertLink(normalUser.id, company.id, USERS.user.role);

  const project = await prisma.project.upsert({
    where: { companyId_slug: { companyId: company.id, slug: "demo-qa" } },
    update: { name: "Projeto Demo QA", status: "active", archivedAt: null, archivedById: null },
    create: {
      companyId: company.id,
      slug: "demo-qa",
      name: "Projeto Demo QA",
      description: "Projeto seed para fluxo de QA manual",
      status: "active",
      createdById: adminUser.id,
    },
  });

  const application = await prisma.application.upsert({
    where: { slug_companySlug: { slug: "demo-web", companySlug: company.slug } },
    update: { name: "Demo Web", active: true },
    create: {
      name: "Demo Web",
      slug: "demo-web",
      description: "Aplicacao demo para testes",
      companyId: company.id,
      companySlug: company.slug,
      active: true,
    },
  });

  const plan = await prisma.testPlan.upsert({
    where: { id: `plan-${project.id}` },
    update: { title: "Plano Demo Regressao", status: "active", archivedAt: null, archivedById: null },
    create: {
      id: `plan-${project.id}`,
      companyId: company.slug,
      projectId: project.id,
      title: "Plano Demo Regressao",
      description: "Plano seed para validar fluxo de planos e runs",
      status: "active",
      createdById: adminUser.id,
    },
  });

  await prisma.manualTestPlan.upsert({
    where: { id: `manual-${project.id}` },
    update: {
      title: "Plano Manual Demo",
      description: "Plano manual seed",
      projectId: project.id,
    },
    create: {
      id: `manual-${project.id}`,
      companySlug: company.slug,
      applicationId: application.id,
      applicationName: application.name,
      applicationSlug: application.slug,
      projectCode: "DEMO",
      projectId: project.id,
      title: "Plano Manual Demo",
      description: "Plano manual seed",
      cases: [
        { id: "TC-DEMO-1", title: "Login com sucesso" },
        { id: "TC-DEMO-2", title: "Criacao de chamado" },
      ],
      automation: {},
    },
  });

  const run = await prisma.testRun.upsert({
    where: { id: `run-${project.id}` },
    update: {
      title: "Run Demo #1",
      status: "passed",
      passCount: 1,
      failCount: 1,
      skipCount: 0,
      totalCount: 2,
      archivedAt: null,
      archivedById: null,
    },
    create: {
      id: `run-${project.id}`,
      companyId: company.slug,
      projectId: project.id,
      planId: plan.id,
      title: "Run Demo #1",
      source: "manual",
      status: "passed",
      passCount: 1,
      failCount: 1,
      skipCount: 0,
      totalCount: 2,
      startedAt: new Date(),
      finishedAt: new Date(),
      createdById: adminUser.id,
    },
  });

  await prisma.testRunResult.deleteMany({ where: { runId: run.id } });
  await prisma.testRunResult.createMany({
    data: [
      {
        id: `${run.id}-r1`,
        runId: run.id,
        caseId: "TC-DEMO-1",
        title: "Login com sucesso",
        status: "passed",
        durationMs: 1200,
      },
      {
        id: `${run.id}-r2`,
        runId: run.id,
        caseId: "TC-DEMO-2",
        title: "Criacao de chamado",
        status: "failed",
        durationMs: 2100,
        errorMsg: "Timeout no salvamento",
      },
    ],
  });

  const case1 = buildDemoCaseRecord({
    id: "tc-demo-1",
    key: "TC-DEMO-1",
    title: "Login com sucesso",
    description: "Valida login com credenciais validas",
    companySlug: company.slug,
    projectId: project.id,
    projectCode: "DEMO",
    createdBy: adminUser.id,
  });
  const case2 = buildDemoCaseRecord({
    id: "tc-demo-2",
    key: "TC-DEMO-2",
    title: "Criacao de chamado",
    description: "Valida abertura de chamado via painel",
    companySlug: company.slug,
    projectId: project.id,
    projectCode: "DEMO",
    createdBy: adminUser.id,
  });

  const case1Json = JSON.parse(JSON.stringify(case1)) as Prisma.InputJsonValue;
  const case2Json = JSON.parse(JSON.stringify(case2)) as Prisma.InputJsonValue;

  await prisma.storedTestCase.upsert({
    where: { id: case1.testCase.id },
    update: { companyId: company.slug, projectId: project.id, data: case1Json, archivedAt: null, archivedById: null },
    create: { id: case1.testCase.id, companyId: company.slug, projectId: project.id, data: case1Json },
  });

  await prisma.storedTestCase.upsert({
    where: { id: case2.testCase.id },
    update: { companyId: company.slug, projectId: project.id, data: case2Json, archivedAt: null, archivedById: null },
    create: { id: case2.testCase.id, companyId: company.slug, projectId: project.id, data: case2Json },
  });

  console.log("Seed Demo ok:", {
    company: COMPANY.slug,
    admin: USERS.admin.email,
    user: USERS.user.email,
    project: project.slug,
    plan: plan.id,
    run: run.id,
    testCases: [case1.testCase.key, case2.testCase.key],
  });
}

main()
  .catch((err) => {
    console.error("Seed Demo failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

