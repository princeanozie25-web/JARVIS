import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("tool execution boundary", () => {
  it("keeps direct tool.execute calls inside the runtime", () => {
    const root = join(process.cwd(), "src");
    const allowedDirectExecute = new Set([
      "lib\\tools\\runtime.ts",
      "lib/tools/runtime.ts",
    ]);

    const offenders = listSourceFiles(root)
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => !file.endsWith("types.ts"))
      .filter((file) => !file.endsWith("mock.ts"))
      .filter((file) => readFileSync(file, "utf8").includes(".execute("))
      .map((file) => relative(root, file))
      .filter((file) => !allowedDirectExecute.has(file));

    expect(offenders).toEqual([]);
  });
});
