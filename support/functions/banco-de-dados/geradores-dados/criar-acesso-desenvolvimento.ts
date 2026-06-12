import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_EMAIL = "paulalysyk1234@gmail.com";
const DEFAULT_COMPANIES = [
  { slug: "testing-company", name: "Testing Company" },
  { slug: "griaule", name: "Griaule" },
] as const;

function parseCompanySlugsFromEnv() {
  const raw = (process.env.DEV_ACCESS_COMPANIES ?? "").trim();
  if (!raw) return DEFAULT_COMPANIES;

  const slugs = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);

  if (!slugs.length) return DEFAULT_COMPANIES;

  return slugs.map((slug) => ({
    slug,
    name: slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  }));
}

async function ensureCompany(slug: string, name: string) {
  return prisma.company.upsert({
    where: { slug },
    update: { name },
    create: {
      slug,
      name,
      company_name: name,
      status: "active",
      active: true,
    },
  });
}

async function main() {
  const email = (process.env.DEV_ACCESS_EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase();
  const roleRaw = (process.env.DEV_ACCESS_ROLE ?? "company_admin").trim().toLowerCase();
  const role = (Object.values(Role) as string[]).includes(roleRaw) ? (roleRaw as Role) : Role.company_admin;
  const companies = parseCompanySlugsFromEnv();

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    throw new Error(
      `Usuario ${email} nao encontrado. Crie/login com um usuario existente ou ajuste DEV_ACCESS_EMAIL.`,
    );
  }

  const ensuredCompanies = [] as Array<{ id: string; slug: string }>;
  for (const company of companies) {
    const record = await ensureCompany(company.slug, company.name);
    ensuredCompanies.push({ id: record.id, slug: record.slug });
  }

  for (const company of ensuredCompanies) {
    await prisma.membership.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: { role, capabilities: [] },
      create: {
        userId: user.id,
        companyId: company.id,
        role,
        capabilities: [],
      },
    });
  }

  const defaultCompanySlug = ensuredCompanies[0]?.slug ?? null;
  if (defaultCompanySlug) {
    await prisma.user.update({
      where: { id: user.id },
      data: { default_company_slug: defaultCompanySlug },
    });
  }

  const memberships = await prisma.membership.findMany({ where: { userId: user.id } });

  console.log("[seed-dev-access] usuario:", {
    id: user.id,
    email: user.email,
    role: user.role,
    globalRole: user.globalRole,
  });
  console.log("[seed-dev-access] memberships:", memberships.map((item) => ({
    companyId: item.companyId,
    role: item.role,
  })));
}

main()
  .catch((error) => {
    console.error("[seed-dev-access] erro:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

