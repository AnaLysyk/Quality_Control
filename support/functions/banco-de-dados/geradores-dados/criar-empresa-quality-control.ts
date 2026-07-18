import { prisma } from "@/database/prismaClient";
import { pgCreateLocalCompany, pgFindLocalCompanyBySlug } from "@/lib/auth/pgStore";
import { syncCompanyApplications } from "@/lib/applicationsStore";

const COMPANY_SLUG = "quality-control";

const INTERNAL_PROJECTS = [
  { code: "QCPLAT", title: "Plataforma Quality Control" },
  { code: "QCBRAIN", title: "Brain" },
  { code: "QCAUTO", title: "Automacao" },
  { code: "QCRUNS", title: "Runs e Relatorios" },
  { code: "QCACCESS", title: "Gestao de Perfis e Acessos" },
  { code: "QCCENTRAL", title: "Central de Qualidade" },
  { code: "QCDASH", title: "Dashboards e Indicadores" },
];

async function ensureCompany() {
  const existing = await pgFindLocalCompanyBySlug(COMPANY_SLUG);
  if (existing) return existing;

  return pgCreateLocalCompany({
    name: "Quality Control",
    slug: COMPANY_SLUG,
    status: "active",
    short_description: "Empresa interna do produto Quality Control",
    notes: "Usada para organizar automacoes, runs, relatorios e evidencias do proprio produto.",
  });
}

export async function seedQualityControlInternalCompany() {
  const company = await ensureCompany();
  const applications = await syncCompanyApplications({
    companyId: company.id,
    companySlug: COMPANY_SLUG,
    source: "quality-control-internal",
    projects: INTERNAL_PROJECTS,
  });

  return { company, applications };
}

seedQualityControlInternalCompany()
  .then(({ company, applications }) => {
    console.log(`Quality Control pronta: ${company.slug}`);
    console.log(`Projetos internos: ${applications.length}`);
  })
  .catch((error) => {
    console.error(error);
    globalThis.process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

