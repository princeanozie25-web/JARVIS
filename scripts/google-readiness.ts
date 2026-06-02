import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runGoogleReadinessCli } from "../src/lib/google-adapters";

function runCli(): void {
  runGoogleReadinessCli({
    env: process.env,
  });
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("google-readiness.ts");
}

if (isDirectCliInvocation()) {
  runCli();
}
