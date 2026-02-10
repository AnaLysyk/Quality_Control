import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/contracts/(.*)$": "<rootDir>/packages/contracts/src/$1",
    "^@/lib/(.*)$": "<rootDir>/lib/$1",
    "^@/data/(.*)$": "<rootDir>/app/data/$1",
    "^@/(.*)$": "<rootDir>/app/$1",
    "^server-only$": "<rootDir>/tests/mocks/server-only.js",
  },
  reporters: ["default"],
  // Avoid child_process workers on restricted environments.
  workerThreads: true,
  // setupFiles removido pois o arquivo nao existe mais
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {},
    ],
  },
  testMatch: ["**/tests/**/*.test.ts?(x)"],
};

export default config;

