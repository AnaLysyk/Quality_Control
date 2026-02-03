// Fallback Prisma client loader.
// Tenta inicializar o PrismaClient se disponível; caso contrário exporta um proxy
// que lança um erro claro quando utilizado. Isso permite que builds (ex.: Vercel)
// resolvam os imports mesmo quando o schema/client não foram gerados.

let prisma: any;
try {
  // Usamos require dinâmico para evitar falha em tempo de compilação se
  // @prisma/client não estiver presente no ambiente de build.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('@prisma/client');
  const PrismaClient = pkg && pkg.PrismaClient ? pkg.PrismaClient : pkg?.default?.PrismaClient;
  if (PrismaClient) {
    prisma = new PrismaClient();
  } else {
    throw new Error('PrismaClient não encontrado em @prisma/client');
  }
} catch (err) {
  const message =
    'Prisma client não está configurado neste ambiente. ' +
    'Se você pretende usar o banco de dados, instale e gere o cliente Prisma (prisma schema). ' +
    'Enquanto isso, este fallback evita erros de import durante o build.';

  prisma = new Proxy(
    {},
    {
      get() {
        throw new Error(message);
      },
      apply() {
        throw new Error(message);
      }
    }
  );
}

export { prisma };
