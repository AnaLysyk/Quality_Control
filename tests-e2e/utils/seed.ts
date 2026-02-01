import "../../scripts/loadEnv";
import { writeAlertsStore } from "../../lib/qualityAlert";
import { prisma } from "@/lib/prismaClient";
import { hashPasswordSha256 } from "@/lib/passwordHash";

export async function seedQualityAlert(alert: { companySlug?: string; type?: string; severity?: string; message?: string; metadata?: any }) {
  await writeAlertsStore([
    {
      companySlug: alert.companySlug || "griaule",
      type: alert.type || "sla",
      severity: alert.severity || "critical",
      message: alert.message || "Defeitos fora do SLA: 1",
      metadata: alert.metadata || { slaOverdue: 1 },
      timestamp: new Date().toISOString(),
    },
  ]);
}

/**
 * Popula o banco de dados com um usuário de teste.
 */
export async function seedDbUser({ id = undefined, email = "teste@example.com", name = "Usuário Teste", password = "senha123" } = {}) {
  // Se id não for passado, Prisma vai gerar um UUID válido automaticamente
  const passwordHash = hashPasswordSha256(password);
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
  await prisma.company.upsert({
    where: { slug },
    update: { name },
    create: { name, slug },
  });
}

/**
 * Popula a tabela UserCompany com vínculo entre usuário e empresa.
 */
export async function seedDbUserCompany({ userEmail = "teste@example.com", companySlug = "empresa-teste", role = "admin" } = {}) {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  const company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!user || !company) throw new Error("Usuário ou empresa não encontrados para vincular.");
  await prisma.userCompany.upsert({
    where: { user_id_company_id: { user_id: user.id, company_id: company.id } },
    update: { role },
    create: { user_id: user.id, company_id: company.id, role },
  });
}

/**
 * Popula a tabela SupportRequest com um chamado de teste.
 */
export async function seedDbSupportRequest({ email = "teste@example.com", message = "Preciso de suporte!", userEmail = "teste@example.com" } = {}) {
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
  await prisma.release.upsert({
    where: { slug },
    update: { title },
    create: { slug, title },
  });
}

/**
 * Popula a tabela TestRun com um teste de execução.
 */
export async function seedDbTestRun({ status = "passed" } = {}) {
  await prisma.testRun.create({
    data: { status },
  });
}

// Exemplo de uso automático ao rodar como script
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
    // eslint-disable-next-line no-console
    console.log("Seeds de todas as tabelas principais inseridos no banco de dados.");
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
