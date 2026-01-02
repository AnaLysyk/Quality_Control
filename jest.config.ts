import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/lib/(.*)$": "<rootDir>/lib/$1",
    "^@/data/(.*)$": "<rootDir>/app/data/$1",
    "^@/(.*)$": "<rootDir>/app/$1",
    "^server-only$": "<rootDir>/tests/mocks/server-only.js",
  },
  reporters: ["default", "<rootDir>/tests/reporters/relatorioPortugues.js"],
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
