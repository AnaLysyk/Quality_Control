import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getArgOrEnv(key: string, envKey: string, fallback?: string): string {
  const idx = process.argv.findIndex((a) => a === `--${key}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  if (process.env[envKey]) return process.env[envKey]!;
  if (fallback) return fallback;
  throw new Error(`Missing required argument/env: ${key}`);
}

async function main() {
  // Buscar uma empresa existente para associar releases manuais
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Nenhuma empresa encontrada para associar ReleaseManual.");
  }
  console.log(`Empresa associada: ${company.name} (id=${company.id})`);

  const title = getArgOrEnv("title", "RELEASE_TITLE", "Release Manual Exemplo");
  const description = getArgOrEnv(
    "description",
    "RELEASE_DESCRIPTION",
    "Primeiro release manual cadastrado via script."
  );
  const status = getArgOrEnv("status", "RELEASE_STATUS", "draft");

  // Evitar duplicidade: verifica se já existe release igual para a empresa
  const existing = await prisma.releaseManual.findFirst({
    where: { companyId: company.id, title },
  });
  if (existing) {
    console.log(
      "Já existe um ReleaseManual com esse título para a empresa:",
      existing
    );
    return;
  }

  // Inserir ReleaseManual
  const releaseManual = await prisma.releaseManual.create({
    data: {
      title,
      description,
      status,
      companyId: company.id,
    },
  });
  console.log("ReleaseManual inserido:", releaseManual);

  // Buscar todos os releases manuais da empresa
  const releases = await prisma.releaseManual.findMany({
    where: { companyId: company.id },
  });
  console.log("Releases manuais da empresa:", releases);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
