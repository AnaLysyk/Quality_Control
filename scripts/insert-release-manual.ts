import { prisma } from "../lib/prismaClient";

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Nenhuma empresa encontrada para associar ReleaseManual.");
  }

  const releaseManual = await prisma.releaseManual.create({
    data: {
      title: "Release Manual Exemplo",
      description: "Primeiro release manual cadastrado via script.",
      status: "draft",
      companyId: company.id,
    },
  });
  console.log("ReleaseManual inserido:", releaseManual);

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
