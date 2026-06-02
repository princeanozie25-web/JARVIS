import { existsSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runMorningBriefPreviewCli } from "../src/lib/morning-brief";

async function runCli(): Promise<void> {
  const report = await runMorningBriefPreviewCli();
  if (report.status === "failed") {
    process.exitCode = 1;
  }
}

function isDirectCliInvocation(): boolean {
  if (!process.argv[1]) return false;
  const currentFile = fileURLToPath(import.meta.url);
  if (process.argv[1] === currentFile) return true;
  if (!existsSync(process.argv[1])) return false;
  return process.argv[1].endsWith("morning-brief.ts");
}

if (isDirectCliInvocation()) {
  void runCli();
}
