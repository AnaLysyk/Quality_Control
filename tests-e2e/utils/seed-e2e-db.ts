import "../../scripts/loadEnv";
import { PrismaClient } from '@prisma/client';

// Prisma 7+ uses config from prisma.config.ts, so no options needed
const prisma = new PrismaClient({});

async function main() {
  // Companies
  const griaule = await prisma.company.upsert({
    where: { slug: 'griaule' },
    update: {},
    create: { name: 'Griaule', slug: 'griaule' },
  });
  const testingCompany = await prisma.company.upsert({
    where: { slug: 'testing-company' },
    update: {},
    create: { name: 'Testing Company', slug: 'testing-company' },
  });

  // Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@qa.com' },
    update: {},
    create: {
      email: 'admin@qa.com',
      password_hash: 'hash',
      name: 'Admin QA',
      active: true,
    },
  });
  // Link admin to both companies
  await prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: admin.id, company_id: griaule.id } },
    update: { role: 'admin' },
    create: { user_id: admin.id, company_id: griaule.id, role: 'admin' },
  });
  await prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: admin.id, company_id: testingCompany.id } },
    update: { role: 'admin' },
    create: { user_id: admin.id, company_id: testingCompany.id, role: 'admin' },
  });

  // Releases (for dashboards, runs, quality, risk, etc.)
  const releases = [
    {
      slug: 'mttr-test-1',
      title: 'Release MTTR Dashboard',
      app: 'GRIAULE',
      status: 'published',
      source: 'MANUAL',
      clientId: griaule.id,
      clientName: 'Griaule',
    },
    {
      slug: 'mttr-manual-unique',
      title: 'Release MTTR Manual Unique',
      app: 'GRIAULE',
      status: 'published',
      source: 'MANUAL',
      clientId: griaule.id,
      clientName: 'Griaule',
    },
    {
      slug: 'mttr-risk-1',
      title: 'Release MTTR Alto',
      app: 'GRIAULE',
      status: 'published',
      source: 'MANUAL',
      clientId: griaule.id,
      clientName: 'Griaule',
    },
    {
      slug: 'run-risk-1',
      title: 'Release com Run Falha',
      app: 'GRIAULE',
      status: 'published',
      source: 'MANUAL',
      clientId: griaule.id,
      clientName: 'Griaule',
    },
    {
      slug: 'run-busca-1',
      title: 'Run Busca Alpha',
      app: 'GRIAULE',
      status: 'published',
      source: 'MANUAL',
      clientId: griaule.id,
      clientName: 'Griaule',
    },
    {
      slug: 'run-busca-2',
      title: 'Run Busca Beta',
      app: 'GRIAULE',
      status: 'published',
      source: 'MANUAL',
      clientId: griaule.id,
      clientName: 'Griaule',
    },
    {
      slug: 'run-quality-1',
      title: 'Run Qualidade Alta',
      app: 'GRIAULE',
      status: 'published',
      source: 'MANUAL',
      clientId: griaule.id,
      clientName: 'Griaule',
    },
    {
      slug: 'run-defeito-1',
      title: 'Run com Defeitos Único',
      app: 'GRIAULE',
      status: 'published',
      source: 'MANUAL',
      clientId: griaule.id,
      clientName: 'Griaule',
    },
    {
      slug: 'run_g_benchmark',
      title: 'Run G Benchmark',
      app: 'SMART',
      status: 'published',
      source: 'MANUAL',
      clientId: griaule.id,
      clientName: 'Griaule',
    },
    {
      slug: 'run_t_benchmark',
      title: 'Run T Benchmark',
      app: 'SMART',
      status: 'published',
      source: 'MANUAL',
      clientId: testingCompany.id,
      clientName: 'Testing Company',
    },
  ];
  for (const r of releases) {
    await prisma.release.upsert({
      where: { slug: r.slug },
      update: r,
      create: r,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
