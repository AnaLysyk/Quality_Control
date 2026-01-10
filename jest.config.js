/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.(ts|js)"],
  moduleNameMapper: {
    "^server-only$": "<rootDir>/tests/mocks/server-only.js",
    "^@/data/(.*)$": "<rootDir>/data/$1",
    "^@/data/(.*)$": "<rootDir>/app/data/$1",
    "^@/api/(.*)$": "<rootDir>/app/api/$1",
    "^@/hooks/(.*)$": "<rootDir>/hooks/$1",
    "^@/lib/(.*)$": "<rootDir>/lib/$1",
    "^@/contracts/(.*)$": "<rootDir>/packages/contracts/src/$1",
    "^@/types/(.*)$": "<rootDir>/src/types/$1",
    "^@/components/(.*)$": "<rootDir>/app/components/$1",
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFiles: ["<rootDir>/tests/jest.setup.ts"],
};
