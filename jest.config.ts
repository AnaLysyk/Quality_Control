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
    "^server-only$": "<rootDir>/tests/mocks/server-only.js",
    "\\.(css|less|sass|scss)$": "<rootDir>/tests/mocks/styleMock.js",
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
  testPathIgnorePatterns: ["/node_modules/", "/tests/integration/"],
};

export default config;
