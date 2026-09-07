import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Phase 25G (G1): the packaged app runs the server from .next/standalone
  // as a Tauri sidecar. Dev (`next dev`) is unaffected by this setting.
  output: "standalone",
  // Phase 25G (G2): the trace otherwise sweeps the whole repo (tests, docs,
  // tmp, data) into .next/standalone. Runtime reads from cwd are only
  // prompts/, config/, db/migrations/, models/ and public/ (E-053 audit).
  outputFileTracingExcludes: {
    "*": [
      "./tests/**",
      "./docs/**",
      "./tmp/**",
      "./data/**",
      "./workspace/**",
      "./src-tauri/**",
      "./dist/**",
      "./.venv/**",
      "./.venv-mlx/**",
      "./assets/**",
      "./plugins/**",
      "./runtimes/**",
      "./scripts/**",
    ],
  },
};

export default nextConfig;
