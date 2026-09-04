import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Python virtualenvs (R.2 faster-whisper, 25D MLX voice stack). Some
    // packages (torch, sklearn) ship vendored .js/.mjs; never lint them.
    ".venv/**",
    ".venv-mlx/**",
  ]),
]);

export default eslintConfig;
