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
    "^@/(.*)$": "<rootDir>/app/$1",
    "^server-only$": "<rootDir>/tests/mocks/server-only.js",
  },
  reporters: ["default"],
  setupFiles: ["<rootDir>/tests/setup-env.js"],
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
};

export default config;
