import "../../scripts/loadEnv";
import { writeAlertsStore, type QualityAlert, type QualityAlertType } from "../../lib/qualityAlert";
import { hashPasswordSha256 } from "@/lib/passwordHash";
 
const isJsonMode =
  process.env.E2E_USE_JSON === "1" ||
  process.env.E2E_USE_JSON === "true" ||
  process.env.SKIP_DB_SETUP === "1" ||
  process.env.SKIP_DB_SETUP === "true";

let prismaClient: typeof import("@/lib/prismaClient").prisma | null = null;

function getPrisma() {
  if (isJsonMode) return null;
  if (!prismaClient) {
    prismaClient = require("@/lib/prismaClient").prisma;
  }
  return prismaClient;
}

export async function seedQualityAlert(alert: {
  companySlug?: string;
  type?: string;
  severity?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  const payload: QualityAlert[] = [
    {
      companySlug: alert.companySlug || "demo",
      type: (alert.type as QualityAlertType) || "sla",
      severity: (alert.severity as "critical" | "warning") || "critical",
      message: alert.message || "Defeitos fora do SLA: 1",
      metadata: alert.metadata || { slaOverdue: 1 },
      timestamp: new Date().toISOString(),
    },
  ];

  const useApiSeed =
    process.env.PLAYWRIGHT_MOCK === "true" ||
    process.env.E2E_USE_JSON === "1" ||
    process.env.E2E_USE_JSON === "true";

  if (useApiSeed) {
    const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
    await fetch(`${baseURL}/api/_test/quality-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return;
  }

  await writeAlertsStore(payload);
}

/**
 * Popula o banco de dados com um usuario de teste.
 */
export async function seedDbUser({ email = "teste@example.com", name = "Usuario Teste", password = "senha123" } = {}) {
  if (isJsonMode) return;
  // Se nenhum id for passado, o Prisma gera um UUID valido automaticamente
  const passwordHash = hashPasswordSha256(password);
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.user.upsert({
    where: { email },
    update: { name, password_hash: passwordHash },
    create: { email, name, password_hash: passwordHash },
  });
}

/**
 * Popula a tabela Company com uma empresa de teste.
 */
export async function seedDbCompany({ name = "Empresa Teste", slug = "empresa-teste" } = {}) {
  if (isJsonMode) return;
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.company.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });
}

/**
 * Popula a tabela UserCompany com vinculo entre usuario e empresa.
 */
export async function seedDbUserCompany({ userEmail = "teste@example.com", companySlug = "empresa-teste", role = "admin" } = {}) {
  if (isJsonMode) return;
  const prisma = getPrisma();
  if (!prisma) return;
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!user || !company) throw new Error("Usuario ou empresa nao encontrados para vincular.");
  await prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: user.id, company_id: company.id } },
    update: { role: role as any },
    create: { user_id: user.id, company_id: company.id, role: role as any },
  });
}

/**
 * Popula a tabela SupportRequest com um chamado de teste.
 */
export async function seedDbSupportRequest({ email = "teste@example.com", message = "Preciso de suporte!", userEmail = "teste@example.com" } = {}) {
  if (isJsonMode) return;
  const prisma = getPrisma();
  if (!prisma) return;
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  await prisma.supportRequest.create({
    data: {
      email,
      message,
      user_id: user?.id,
      status: "open",
    },
  });
}

/**
 * Popula a tabela Release com um release de teste.
 */
export async function seedDbRelease({ slug = "release-teste", title = "Release de Teste" } = {}) {
  if (isJsonMode) return;
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.release.upsert({
    where: { slug },
    update: { title },
    create: { slug, title },
  });
}

/**
 * Popula a tabela TestRun com um teste de execucao.
 */
export async function seedDbTestRun({ status = "passed" } = {}) {
  if (isJsonMode) return;
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.testRun.create({
    data: { status },
  });
}

// Exemplo de uso automatico ao rodar como script
if (require.main === module) {
  Promise.all([
    seedDbUser(),
    seedDbCompany(),
  ]).then(() =>
    seedDbUserCompany()
  ).then(() =>
    Promise.all([
      seedDbSupportRequest(),
      seedDbRelease(),
      seedDbTestRun(),
    ])
  ).then(() => {
    console.log("Seeds de todas as tabelas principais inseridos no banco de dados.");
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
