import "../../scripts/loadEnv";
import { prisma } from "../../lib/prismaClient";

async function main() {
  const demo = await prisma.company.upsert({
    where: { slug: "DEMO" },
    update: {},
    create: { name: "DEMO", slug: "DEMO" },
  });
  const testingCompany = await prisma.company.upsert({
    where: { slug: "testing-company" },
    update: {},
    create: { name: "Testing Company", slug: "testing-company" },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@qa.com" },
    update: {},
    create: {
      email: "admin@qa.com",
      password_hash: "hash",
      name: "Admin QA",
      active: true,
    },
  });

  await prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: admin.id, company_id: demo.id } },
    update: { role: "admin" },
    create: { user_id: admin.id, company_id: demo.id, role: "admin" },
  });
  await prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: admin.id, company_id: testingCompany.id } },
    update: { role: "admin" },
    create: { user_id: admin.id, company_id: testingCompany.id, role: "admin" },
  });

  const releases = [
    {
      slug: "mttr-test-1",
      title: "Release MTTR Dashboard",
      app: "DEMO",
      status: "published",
      source: "MANUAL",
      clientId: demo.id,
      clientName: "DEMO",
    },
    {
      slug: "mttr-manual-unique",
      title: "Release MTTR Manual Unique",
      app: "DEMO",
      status: "published",
      source: "MANUAL",
      clientId: demo.id,
      clientName: "DEMO",
    },
    {
      slug: "mttr-risk-1",
      title: "Release MTTR Alto",
      app: "DEMO",
      status: "published",
      source: "MANUAL",
      clientId: demo.id,
      clientName: "DEMO",
    },
    {
      slug: "run-risk-1",
      title: "Release com Run Falha",
      app: "DEMO",
      status: "published",
      source: "MANUAL",
      clientId: demo.id,
      clientName: "DEMO",
    },
    {
      slug: "run-busca-1",
      title: "Run Busca Alpha",
      app: "DEMO",
      status: "published",
      source: "MANUAL",
      clientId: demo.id,
      clientName: "DEMO",
    },
    {
      slug: "run-busca-2",
      title: "Run Busca Beta",
      app: "DEMO",
      status: "published",
      source: "MANUAL",
      clientId: demo.id,
      clientName: "DEMO",
    },
    {
      slug: "run-quality-1",
      title: "Run Qualidade Alta",
      app: "DEMO",
      status: "published",
      source: "MANUAL",
      clientId: demo.id,
      clientName: "DEMO",
    },
    {
      slug: "run-defeito-1",
      title: "Run com Defeitos Unico",
      app: "DEMO",
      status: "published",
      source: "MANUAL",
      clientId: demo.id,
      clientName: "DEMO",
    },
    {
      slug: "run_g_benchmark",
      title: "Run G Benchmark",
      app: "SMART",
      status: "published",
      source: "MANUAL",
      clientId: demo.id,
      clientName: "DEMO",
    },
    {
      slug: "run_t_benchmark",
      title: "Run T Benchmark",
      app: "SMART",
      status: "published",
      source: "MANUAL",
      clientId: testingCompany.id,
      clientName: "Testing Company",
    },
  ];

  for (const release of releases) {
    await prisma.release.upsert({
      where: { slug: release.slug },
      update: release,
      create: release,
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

