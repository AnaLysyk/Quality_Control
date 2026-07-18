import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);


const qualityControlWarningCleanup = {
  ignores: [
    "coverage/**",
    ".next/**",
    "node_modules/**"
  ],
  rules: {
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/exhaustive-deps": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }
    ]
  }
};


const qualityControlSupportAndTestsCleanup = {
  files: [
    "support/**/*.{js,ts,mjs,cjs}",
    "testes/**/*.{js,ts,tsx}",
    "database/**/*.{js,ts}",
    "backend/auth/pgStore.ts"
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/exhaustive-deps": "off"
  }
};

eslintConfig.unshift(qualityControlWarningCleanup);
eslintConfig.push(qualityControlSupportAndTestsCleanup);

export default eslintConfig;
