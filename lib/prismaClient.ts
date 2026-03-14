// Fallback Prisma client loader.
// Tenta inicializar o PrismaClient se disponivel; caso contrario exporta um
// proxy que lanca um erro claro quando utilizado. Isso permite que builds
// resolvam os imports mesmo quando o schema/client nao foram gerados.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any;

try {
  // Usamos require dinamico para evitar falha em tempo de compilacao se
  // @prisma/client nao estiver presente no ambiente de build.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require("@prisma/client");
  const PrismaClient = pkg && pkg.PrismaClient ? pkg.PrismaClient : pkg?.default?.PrismaClient;
  if (PrismaClient) {
    prisma = new PrismaClient();
  } else {
    throw new Error("PrismaClient nao encontrado em @prisma/client");
  }
} catch {
  const message =
    "Prisma client nao esta configurado neste ambiente. " +
    "Se voce pretende usar o banco de dados, instale e gere o cliente Prisma (prisma schema). " +
    "Enquanto isso, este fallback evita erros de import durante o build.";

  prisma = new Proxy(
    {},
    {
      get() {
        throw new Error(message);
      },
      apply() {
        throw new Error(message);
      },
    },
  );
}

export { prisma };
