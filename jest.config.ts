import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/contracts/(.*)$": "<rootDir>/packages/contracts/src/$1",
    "^@/lib/prisma$": "<rootDir>/lib/prismaClient.ts",
    "^@/lib/(.*)$": "<rootDir>/lib/$1",
    "^@/core/(.*)$": "<rootDir>/lib/core/$1",
    "^@/data/(.*)$": ["<rootDir>/data/$1", "<rootDir>/app/data/$1"],
    "^@/features/(.*)$": "<rootDir>/src/features/$1",
    "^@/backend/(.*)$": "<rootDir>/src/backend/$1",
    "^@/shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@/design-system/(.*)$": "<rootDir>/src/design-system/$1",
    "^@/(.*)$": "<rootDir>/app/$1",
    "^server-only$": "<rootDir>/support/functions/ui/dados-falsos/simular-server-only.js",
    "\\.(css|less|sass|scss)$": "<rootDir>/support/functions/ui/dados-falsos/simular-estilos.js",
  },
  reporters: ["default"],
  setupFiles: ["<rootDir>/support/functions/banco-de-dados/ambiente/configurar-variaveis-testes.js"],
  testTimeout: 10000,
  // setupFiles removido pois o arquivo nÃ£o existe mais
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
      },
    ],
  },
  testMatch: ["**/testes/**/*.test.ts?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/testes/api/integracao/"],
};

export default config;

