import Database from "better-sqlite3";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import {
  getRuntimeWorkspaceConfig,
  resolveRuntimeWorkingDirectory,
} from "./workspace";

let db: Database.Database;
const tempRoots: string[] = [];

function tempDir(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("runtime workspace boundary", () => {
  it("loads runtime workspace root from env or safe cwd fallback", () => {
    const configured = getRuntimeWorkspaceConfig({
      env: { JARVIS_RUNTIME_WORKSPACE_ROOT: "C:\\workspace" },
      cwd: "C:\\ignored",
    });
    expect(configured.workspaceRoot).toBe(resolve("C:\\workspace"));

    const fallbackRoot = tempDir("jarvis-runtime-fallback-");
    const fallback = getRuntimeWorkspaceConfig({
      env: {},
      cwd: fallbackRoot,
    });
    expect(fallback.workspaceRoot).toBe(resolve(fallbackRoot));
  });

  it("accepts valid relative cwd inside workspace", () => {
    const workspaceRoot = tempDir("jarvis-runtime-root-");
    mkdirSync(join(workspaceRoot, "packages", "app"), { recursive: true });

    const result = resolveRuntimeWorkingDirectory({
      requestedCwd: "packages/app",
      workspaceRoot,
      db,
      now: () => 1_000,
      commandId: "git.status",
      callId: "runtime-call-1",
    });

    expect(result).toMatchObject({
      ok: true,
      relativeCwd: join("packages", "app"),
      resolvedCwd: join(workspaceRoot, "packages", "app"),
    });
  });

  it("rejects path traversal", () => {
    const workspaceRoot = tempDir("jarvis-runtime-root-");
    mkdirSync(join(workspaceRoot, "safe"), { recursive: true });

    const result = resolveRuntimeWorkingDirectory({
      requestedCwd: "../safe",
      workspaceRoot,
      db,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "path_traversal_rejected",
    });
  });

  it("rejects absolute cwd outside workspace", () => {
    const workspaceRoot = tempDir("jarvis-runtime-root-");
    const outside = tempDir("jarvis-runtime-outside-");

    const result = resolveRuntimeWorkingDirectory({
      requestedCwd: outside,
      workspaceRoot,
      db,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "outside_workspace_rejected",
    });
  });

  it("rejects symlink escape when supported by the environment", () => {
    const workspaceRoot = tempDir("jarvis-runtime-root-");
    const outside = tempDir("jarvis-runtime-outside-");
    const link = join(workspaceRoot, "outside-link");
    try {
      symlinkSync(outside, link, "junction");
    } catch {
      return;
    }

    const result = resolveRuntimeWorkingDirectory({
      requestedCwd: "outside-link",
      workspaceRoot,
      db,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "symlink_escape_rejected",
    });
  });

  it("rejects Windows-style absolute path escape", () => {
    const workspaceRoot = tempDir("jarvis-runtime-root-");
    const result = resolveRuntimeWorkingDirectory({
      requestedCwd: "C:\\Windows",
      workspaceRoot,
      db,
    });

    expect(result.ok).toBe(false);
  });

  it("rejects protected runtime cwd targets", () => {
    const workspaceRoot = tempDir("jarvis-runtime-root-");
    mkdirSync(join(workspaceRoot, ".git"), { recursive: true });

    const result = resolveRuntimeWorkingDirectory({
      requestedCwd: ".git",
      workspaceRoot,
      db,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "protected_directory_rejected",
    });
  });

  it("rejects file cwd targets", () => {
    const workspaceRoot = tempDir("jarvis-runtime-root-");
    writeFileSync(join(workspaceRoot, "file.txt"), "not a directory");

    const result = resolveRuntimeWorkingDirectory({
      requestedCwd: "file.txt",
      workspaceRoot,
      db,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "working_directory_not_directory",
    });
  });

  it("emits workspace telemetry for resolved and denied attempts", () => {
    const workspaceRoot = tempDir("jarvis-runtime-root-");
    mkdirSync(join(workspaceRoot, "safe"), { recursive: true });

    resolveRuntimeWorkingDirectory({
      requestedCwd: "safe",
      workspaceRoot,
      db,
      commandId: "git.status",
    });
    resolveRuntimeWorkingDirectory({
      requestedCwd: "..",
      workspaceRoot,
      db,
      commandId: "git.status",
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "runtime_workspace_resolved",
        "runtime_workspace_denied",
      ]),
    );
  });
});
