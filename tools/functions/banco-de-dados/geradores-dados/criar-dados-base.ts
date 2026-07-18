import "../../infraestrutura/ambiente/carregar-variaveis-ambiente";
import fs from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "@/backend/passwordHash";

type QualityAlertType =
  | "quality_score"
  | "sla"
  | "mttr"
  | "release_failed"
  | "gate_failed"
  | "override"
  | "mttr_exceeded"
  | "run_failed";

type QualityAlert = {
  companySlug: string;
  type: QualityAlertType;
  severity: "critical" | "warning";
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
};
 
const isJsonMode =
  process.env.E2E_USE_JSON === "1" ||
  process.env.E2E_USE_JSON === "true" ||
  process.env.SKIP_DB_SETUP === "1" ||
  process.env.SKIP_DB_SETUP === "true";

let prismaClient: typeof import("@/database/prismaClient").prisma | null = null;

function getPrisma() {
  if (isJsonMode) return null;
  if (!prismaClient) {
    prismaClient = require("@/database/prismaClient").prisma;
  }
  return prismaClient;
}

export async function criarAlertaQualidade(alert: {
  companySlug?: string;
  type?: string;
  severity?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  const payload: QualityAlert[] = [
    {
      companySlug: alert.companySlug || "griaule",
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

  const alertsFile = path.join(process.cwd(), "data", "quality_alerts.json");
  await fs.mkdir(path.dirname(alertsFile), { recursive: true });
  await fs.writeFile(alertsFile, JSON.stringify(payload, null, 2), "utf8");
}

/**
 * Popula o banco de dados com um usuario de teste.
 */
export async function criarUsuarioBanco({ email = "teste@example.com", name = "Usuario Teste", password = "senha123" } = {}) {
  if (isJsonMode) return;
  // Se nenhum id for passado, o Prisma gera um UUID valido automaticamente
  const passwordHash = hashPassword(password);
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
export async function criarEmpresaBanco({ name = "Empresa Teste", slug = "empresa-teste" } = {}) {
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
export async function vincularUsuarioEmpresaBanco({ userEmail = "teste@example.com", companySlug = "empresa-teste", role = "admin" } = {}) {
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
export async function criarSolicitacaoSuporteBanco({ email = "teste@example.com", message = "Preciso de suporte!", userEmail = "teste@example.com" } = {}) {
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
export async function criarReleaseBanco({ slug = "release-teste", title = "Release de Teste" } = {}) {
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
export async function criarExecucaoTesteBanco({ status = "passed" } = {}) {
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
    criarUsuarioBanco(),
    criarEmpresaBanco(),
  ]).then(() =>
    vincularUsuarioEmpresaBanco()
  ).then(() =>
    Promise.all([
      criarSolicitacaoSuporteBanco(),
      criarReleaseBanco(),
      criarExecucaoTesteBanco(),
    ])
  ).then(() => {
    console.log("Seeds de todas as tabelas principais inseridos no banco de dados.");
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

