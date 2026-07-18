import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/contracts/(.*)$": "<rootDir>/shared/contracts/src/$1",
    "^@/types/(.*)$": "<rootDir>/shared/types/$1",
    "^@/data/(.*)$": "<rootDir>/database/repositories/$1",
    "^@/database/(.*)$": "<rootDir>/database/$1",
    "^@/features/(.*)$": "<rootDir>/src/features/$1",
    "^@/backend/(.*)$": "<rootDir>/backend/$1",
    "^@/shared/(.*)$": "<rootDir>/shared/$1",
    "^@/design-system/(.*)$": "<rootDir>/src/design-system/$1",
    "^@/(.*)$": "<rootDir>/app/$1",
    "^server-only$": "<rootDir>/tools/functions/ui/dados-falsos/simular-server-only.js",
    "\\.(css|less|sass|scss)$": "<rootDir>/tools/functions/ui/dados-falsos/simular-estilos.js",
  },
  reporters: ["default"],
  setupFiles: ["<rootDir>/tools/functions/banco-de-dados/ambiente/configurar-variaveis-testes.js"],
  testTimeout: 10000,
  // setupFiles removido pois o arquivo não existe mais
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
      },
    ],
  },
  testMatch: ["**/tests/**/*.test.ts?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/tests/api/integracao/"],
};

export default config;

