import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored real-world fixtures for the precision/recall benchmark —
    // not application code, not meant to lint clean on their own.
    "benchmark/corpus/**",
    "benchmark/corpus-holdout/**",
  ]),
]);

export default eslintConfig;
