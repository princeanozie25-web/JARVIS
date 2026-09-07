// Phase 25G (E-054) — build the macOS app: Next standalone server + Node
// sidecar + Tauri shell, loopback only.
//
//   npx tsx scripts/package/build-mac.ts            # full build → src-tauri/target/release/bundle/macos/*.app
//   npx tsx scripts/package/build-mac.ts --stage    # stop after staging dist/mac (no cargo)
//   npx tsx scripts/package/build-mac.ts --skip-next  # reuse the existing .next build
//   npx tsx scripts/package/build-mac.ts --install    # also copy the .app to ~/Applications (outside TCC-protected folders)
//
// What it does, in order, all under the repo root:
//   1. `next build` (output: "standalone", E-053)
//   2. stage dist/mac/standalone = .next/standalone + .next/static + public,
//      minus the repo sweep (tests, docs, tmp, data, src, …) — the artifact
//      must never carry data/ or .env*
//   3. copy the running Node binary to src-tauri/binaries/node-<triple>
//      (Tauri's externalBin convention)
//   4. `tauri build --config src-tauri/tauri.package.conf.json`
// Nothing here touches the network, signs with a real identity, or writes
// outside dist/, src-tauri/binaries/ and src-tauri/target/.
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const args = new Set(process.argv.slice(2));
const STAGE = join(ROOT, "dist", "mac", "standalone");
const BIN_DIR = join(ROOT, "src-tauri", "binaries");

// Directories the server never reads at runtime (E-053 audit of process.cwd()
// sites: prompts/, db/migrations/, config/, models/, data/ (external), public/).
const STAGE_EXCLUDE = new Set([
  ".env",
  ".env.local",
  ".env.example",
  ".git",
  ".github",
  ".husky",
  ".venv",
  ".venv-mlx",
  ".claude",
  "assets",
  "data",
  "dist",
  "docs",
  "plugins",
  "runtimes",
  "scripts",
  "src",
  "src-tauri",
  "tests",
  "tmp",
  "workspace",
  "app",
  "components.json",
  "eslint.config.mjs",
  "postcss.config.mjs",
  "tsconfig.json",
  "tsconfig.tsbuildinfo",
  "vitest.config.ts",
  "package-lock.json",
]);

function log(step: string, detail = ""): void {
  console.log(`[package] ${step}${detail ? ` — ${detail}` : ""}`);
}

function run(
  cmd: string,
  cmdArgs: string[],
  env: Record<string, string | undefined> = {},
): void {
  log("run", [cmd, ...cmdArgs].join(" "));
  const r = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}`);
}

function dirSizeMb(dir: string): number {
  let total = 0;
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk(dir);
  return Math.round(total / 1e6);
}

export function targetTriple(): string {
  const out = execFileSync(join(homedir(), ".cargo", "bin", "rustc"), ["-vV"], {
    encoding: "utf8",
  });
  const m = /host:\s*(\S+)/.exec(out);
  if (!m) throw new Error("rustc -vV did not report a host triple");
  return m[1]!;
}

function stage(): void {
  const standalone = join(ROOT, ".next", "standalone");
  if (!existsSync(join(standalone, "server.js")))
    throw new Error("no .next/standalone/server.js — run next build first");
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });
  for (const entry of readdirSync(standalone)) {
    if (
      STAGE_EXCLUDE.has(entry) ||
      entry.endsWith(".md") ||
      entry.endsWith(".html")
    )
      continue;
    cpSync(join(standalone, entry), join(STAGE, entry), {
      recursive: true,
      dereference: true,
    });
  }
  cpSync(join(ROOT, ".next", "static"), join(STAGE, ".next", "static"), {
    recursive: true,
  });
  cpSync(join(ROOT, "public"), join(STAGE, "public"), { recursive: true });
  // Next 16 (turbopack) traces the page runtime but not every route runtime
  // (app-route-turbo.runtime.prod.js was missing → every /api/* 500 in the
  // installed app; masked in-repo because resolution fell back to the repo's
  // node_modules). Mirror the turbo production runtimes (not the 57 MB of
  // dev builds and source maps).
  const runtimes = join(
    "node_modules",
    "next",
    "dist",
    "compiled",
    "next-server",
  );
  mkdirSync(join(STAGE, runtimes), { recursive: true });
  for (const f of readdirSync(join(ROOT, runtimes))) {
    if (
      /turbo.*\.runtime\.prod\.js$/.test(f) ||
      f === "server.runtime.prod.js"
    ) {
      cpSync(join(ROOT, runtimes, f), join(STAGE, runtimes, f));
    }
  }
  // Turbopack externalises native addons through hashed aliases that are
  // SYMLINKS (.next/node_modules/better-sqlite3-<hash> -> ../../node_modules/
  // better-sqlite3). cpSync rewrites them absolute and the bundler drops
  // them → "Cannot find module better-sqlite3-<hash>" in the installed app.
  // Materialise every symlink under the stage as a real copy of its target.
  materialiseSymlinks(STAGE);
  cpSync(
    join(ROOT, "scripts", "package", "sidecar-launcher.js"),
    join(STAGE, "sidecar.js"),
  );
  // Belt and braces: the artifact must never carry a database or an env file.
  for (const forbidden of ["data", ".env", ".env.local"]) {
    if (existsSync(join(STAGE, forbidden)))
      throw new Error(`staged tree still contains ${forbidden}`);
  }
  const listing = readdirSync(STAGE).sort();
  writeFileSync(
    join(STAGE, "STAGE_MANIFEST.txt"),
    `${new Date().toISOString()}\n${listing.join("\n")}\n`,
  );
  log("staged", `${STAGE} (${dirSizeMb(STAGE)} MB): ${listing.join(", ")}`);
}

function materialiseSymlinks(dir: string): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) {
      const target = realpathSync(p);
      rmSync(p);
      cpSync(target, p, { recursive: true, dereference: true });
      log(
        "symlink materialised",
        `${p.replace(STAGE, "")} ← ${target.replace(ROOT, ".")}`,
      );
    } else if (e.isDirectory()) {
      materialiseSymlinks(p);
    }
  }
}

function stageNode(): string {
  const triple = targetTriple();
  mkdirSync(BIN_DIR, { recursive: true });
  const dest = join(BIN_DIR, `node-${triple}`);
  cpSync(process.execPath, dest);
  log(
    "node sidecar",
    `${dest} (${Math.round(statSync(dest).size / 1e6)} MB, ${process.version})`,
  );
  return dest;
}

function main(): void {
  if (!args.has("--skip-next")) run("npx", ["next", "build"]);
  stage();
  stageNode();
  if (args.has("--stage")) return;
  run(
    "npx",
    ["tauri", "build", "--config", "src-tauri/tauri.package.conf.json"],
    {
      PATH: `${join(homedir(), ".cargo", "bin")}:${process.env.PATH ?? ""}`,
    },
  );
  const bundleDir = join(
    ROOT,
    "src-tauri",
    "target",
    "release",
    "bundle",
    "macos",
  );
  const apps = existsSync(bundleDir)
    ? readdirSync(bundleDir).filter((n) => n.endsWith(".app"))
    : [];
  for (const app of apps)
    log(
      "artifact",
      `${join(bundleDir, app)} (${dirSizeMb(join(bundleDir, app))} MB)`,
    );
  if (apps.length === 0) throw new Error("tauri build produced no .app");
  if (args.has("--install")) install(join(bundleDir, apps[0]!));
}

// macOS TCC: an app that lives under ~/Desktop, ~/Documents or ~/Downloads
// cannot read its OWN resources without a consent dialog — the sidecar's
// first synchronous open() blocks on the prompt and the server never answers
// (found live, E-054). This clone sits in ~/Desktop, so the runnable copy
// goes to ~/Applications; launch THAT one, never the build-dir bundle.
export function installedAppPath(name = "JARVIS Command Center.app"): string {
  return join(homedir(), "Applications", name);
}

function install(builtApp: string): void {
  const dest = installedAppPath();
  mkdirSync(join(homedir(), "Applications"), { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  run("ditto", [builtApp, dest]);
  log(
    "installed",
    `${dest} (${dirSizeMb(dest)} MB) — open this one; the build-dir copy is TCC-blocked under ~/Desktop`,
  );
}

main();
