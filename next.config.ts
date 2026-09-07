import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Phase 25G (G1): the packaged app runs the server from .next/standalone
  // as a Tauri sidecar. Dev (`next dev`) is unaffected by this setting.
  output: "standalone",
};

export default nextConfig;
