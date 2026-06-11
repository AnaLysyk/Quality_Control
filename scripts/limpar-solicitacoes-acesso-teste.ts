import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const CONFIRM = process.env.ACCESS_REQUEST_CLEANUP_CONFIRM === "SIM";

const where = {
  OR: [
    { email: { contains: "+status-" } },
    { email: { contains: "+status-ui" } },
    { email: { contains: "+status-api" } },
    { email: { contains: "+ui" } },
    { email: { contains: "+ui-duplicado" } },
    { email: { contains: "+e2e" } },
    { email: { contains: "@demo.test" } },
    { email: { contains: "@testingcompany.local" } },
  ],
};

async function main() {
  const { prisma } = await import("../lib/prismaClient");

  const encontrados = await prisma.accessRequest.findMany({
    where,
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`Solicitações de teste encontradas: ${encontrados.length}`);

  for (const item of encontrados.slice(0, 50)) {
    console.log(`- ${item.id} | ${item.email} | ${item.status} | ${item.createdAt.toISOString()}`);
  }

  if (!CONFIRM) {
    console.log("");
    console.log("Modo simulação. Nada foi removido.");
    console.log('Para remover, rode com: $env:ACCESS_REQUEST_CLEANUP_CONFIRM="SIM"');
    return;
  }

  const result = await prisma.accessRequest.deleteMany({ where });

  console.log("");
  console.log(`Removidas: ${result.count}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
