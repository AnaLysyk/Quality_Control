const _pkg = require("@prisma/client");
const PrismaClient = (_pkg && _pkg.PrismaClient) || (_pkg && _pkg.default && _pkg.default.PrismaClient);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = PrismaClient ? new PrismaClient() : ({} as any);

async function main() {
  // Buscar uma empresa existente para associar releases manuais
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Nenhuma empresa encontrada para associar ReleaseManual.");
  }

  // Inserir ReleaseManual de exemplo
  const releaseManual = await prisma.releaseManual.create({
    data: {
      title: "Release Manual Exemplo",
      description: "Primeiro release manual cadastrado via script.",
      status: "draft",
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
