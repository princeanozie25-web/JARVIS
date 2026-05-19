import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getRuntimeCommandCall,
  listRuntimeCommandCalls,
} from "../db/runtime-command-calls";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import {
  INITIAL_RUNTIME_COMMAND_SPECS,
  RuntimeCommandRegistry,
  approveRuntimeCommandCall,
  createDefaultRuntimeCommandRegistry,
  denyRuntimeCommandCall,
  listRuntimeCommands,
  markRuntimeCommandApprovalExpired,
  proposeRuntimeCommandCall,
  runtimeCommandScopeHash,
  validateRuntimeCommandInput,
  type RuntimeCommandSpec,
} from ".";

let db: Database.Database;
let workspaceRoot: string;
let previousWorkspaceRoot: string | undefined;

const baseSpec: RuntimeCommandSpec = {
  id: "test.safe",
  command: "git",
  structuredArgSchema: { type: "argv", allowed: [["status", "--short"]] },
  description: "Test-only safe read metadata.",
  requiredSafetyTag: "ALLOW",
  reversibilityClass: "PURE_READ",
  timeoutMs: 5_000,
  workingDirectoryPolicy: { type: "repo_root" },
  environmentPolicy: { inherit: false, allowedEnv: [] },
  enabled: true,
};

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  workspaceRoot = mkdtempSync(join(tmpdir(), "jarvis-runtime-index-"));
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  process.env.JARVIS_WORKSPACE_ROOT = workspaceRoot;
});

afterEach(() => {
  if (previousWorkspaceRoot === undefined) {
    delete process.env.JARVIS_WORKSPACE_ROOT;
  } else {
    process.env.JARVIS_WORKSPACE_ROOT = previousWorkspaceRoot;
  }
  rmSync(workspaceRoot, { recursive: true, force: true });
  db.close();
});

describe("RuntimeCommandRegistry", () => {
  it("starts with only safe read-only runtime command specs", () => {
    const specs = createDefaultRuntimeCommandRegistry().list();

    expect(specs.map((spec) => spec.id).sort()).toEqual([
      "git.diff_stat",
      "git.log",
      "git.status",
      "node.version",
    ]);
    expect(
      specs.every(
        (spec) =>
          spec.requiredSafetyTag === "ALLOW" &&
          spec.reversibilityClass === "PURE_READ" &&
          spec.enabled,
      ),
    ).toBe(true);
    expect(INITIAL_RUNTIME_COMMAND_SPECS).toHaveLength(4);
  });

  it("rejects duplicate ids", () => {
    const registry = new RuntimeCommandRegistry();
    registry.register(baseSpec);

    expect(() => registry.register(baseSpec)).toThrow(
      "Runtime command already registered: test.safe",
    );
  });

  it.each([";", "&", "|", "`", "$(", "${", ">", "<"])(
    "rejects dangerous shell metacharacter %s",
    (token) => {
      const registry = createDefaultRuntimeCommandRegistry();

      const result = registry.validateInput(
        {
          id: "git.status",
          args: ["status", "--short", token],
        },
        { db, now: () => 1_000 },
      );

      expect(result).toMatchObject({
        ok: false,
        status: "invalid",
      });
      expect(
        listTelemetryEvents(db).map((event) => event.event_type),
      ).toContain("runtime_command_validation_failed");
    },
  );

  it("rejects disabled commands during validation", () => {
    const registry = new RuntimeCommandRegistry();
    registry.register({ ...baseSpec, enabled: false });

    expect(
      registry.validateInput({
        id: "test.safe",
        args: ["status", "--short"],
      }),
    ).toEqual({
      ok: false,
      status: "disabled",
      reason: "disabled",
    });
  });

  it("keeps command specs as read-only metadata without execution functions", () => {
    const spec = createDefaultRuntimeCommandRegistry().get("git.status");

    expect(spec).toMatchObject({
      id: "git.status",
      command: "git",
      requiredSafetyTag: "ALLOW",
      reversibilityClass: "PURE_READ",
    });
    expect(spec).not.toHaveProperty("execute");
    expect(spec).not.toHaveProperty("run");
    expect(spec).not.toHaveProperty("spawn");
    expect(spec).not.toHaveProperty("invoke");
  });

  it("validates only explicitly allowed structured argv", () => {
    const registry = createDefaultRuntimeCommandRegistry();

    expect(
      registry.validateInput({
        id: "git.status",
        args: ["status", "--short"],
      }).ok,
    ).toBe(true);
    expect(
      registry.validateInput({
        id: "git.status",
        args: ["status", "--porcelain"],
      }),
    ).toEqual({
      ok: false,
      status: "invalid",
      reason: "args_not_allowed",
    });
  });

  it("emits registry telemetry", () => {
    const registry = new RuntimeCommandRegistry();

    registry.register(baseSpec, { db, now: () => 1_000 });
    registry.list({ db, now: () => 2_000 });
    registry.validateInput(
      { id: "test.safe", args: ["status", "--porcelain"] },
      { db, now: () => 3_000 },
    );

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "runtime_command_registered",
        "runtime_command_registry_read",
        "runtime_command_validation_failed",
      ]),
    );
  });

  it("exposes read-only helper access to registered metadata", () => {
    expect(
      listRuntimeCommands()
        .map((spec) => spec.id)
        .sort(),
    ).toEqual(["git.diff_stat", "git.log", "git.status", "node.version"]);
    expect(
      validateRuntimeCommandInput({
        id: "node.version",
        args: ["--version"],
      }).ok,
    ).toBe(true);
  });

  it("proposes a valid read-only runtime command without executing it", () => {
    const result = proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "git.status",
      argv: ["status", "--short"],
      workingDirectory: "repo_root",
      callId: "runtime-call-1",
      now: () => 4_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected runtime proposal");
    expect(result.call).toMatchObject({
      id: "runtime-call-1",
      session_id: "session-1",
      command_id: "git.status",
      command: "git",
      argv_json: JSON.stringify(["status", "--short"]),
      status: "pending",
      proposed_at: 4_000,
    });
    expect(result.approval).toMatchObject({
      requiredSafetyTag: "ALLOW",
      approvalRequired: false,
      decision: "PENDING",
    });
    expect(result.approval.scopeHash).toBe(
      runtimeCommandScopeHash({
        commandId: "git.status",
        argv: ["status", "--short"],
        workingDirectory: ".",
      }),
    );
    expect(getRuntimeCommandCall(db, "runtime-call-1")?.status).toBe("pending");
  });

  it("rejects invalid command proposals before creating audit rows", () => {
    const result = proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "git.status",
      argv: ["status", "--porcelain"],
      workingDirectory: "repo_root",
      callId: "runtime-call-1",
    });

    expect(result).toEqual({
      ok: false,
      status: "invalid",
      reason: "args_not_allowed",
    });
    expect(listRuntimeCommandCalls(db)).toEqual([]);
  });

  it("rejects dangerous argv before creating audit rows", () => {
    const result = proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "git.status",
      argv: ["status", "--short", ";"],
      workingDirectory: "repo_root",
      callId: "runtime-call-1",
    });

    expect(result).toMatchObject({ ok: false, status: "invalid" });
    expect(listRuntimeCommandCalls(db)).toEqual([]);
  });

  it("approves pending runtime command calls without running them", () => {
    proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "git.status",
      argv: ["status", "--short"],
      workingDirectory: "repo_root",
      callId: "runtime-call-1",
    });

    const result = approveRuntimeCommandCall(db, {
      callId: "runtime-call-1",
      approvedAt: 5_000,
    });

    expect(result).toMatchObject({
      ok: true,
      call: {
        id: "runtime-call-1",
        status: "approved",
        approved_at: 5_000,
        started_at: null,
        completed_at: null,
        stdout_ref: null,
        stderr_ref: null,
        exit_code: null,
      },
    });
  });

  it("denies pending runtime command calls without running them", () => {
    proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "git.status",
      argv: ["status", "--short"],
      workingDirectory: "repo_root",
      callId: "runtime-call-1",
    });

    const result = denyRuntimeCommandCall(db, {
      callId: "runtime-call-1",
      deniedAt: 5_000,
      reason: "Manual denial.",
    });

    expect(result).toMatchObject({
      ok: true,
      call: {
        id: "runtime-call-1",
        status: "denied",
        started_at: null,
        stdout_ref: null,
        stderr_ref: null,
        exit_code: null,
        error_class: "RuntimeCommandApprovalDenied",
        error_message: "Manual denial.",
      },
    });
  });

  it("marks pending runtime command approvals expired without running them", () => {
    proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "git.status",
      argv: ["status", "--short"],
      workingDirectory: "repo_root",
      callId: "runtime-call-1",
    });

    const result = markRuntimeCommandApprovalExpired(db, {
      callId: "runtime-call-1",
      expiredAt: 6_000,
    });

    expect(result).toMatchObject({
      ok: true,
      call: {
        id: "runtime-call-1",
        status: "denied",
        completed_at: 6_000,
        started_at: null,
        error_class: "RuntimeCommandApprovalExpired",
      },
    });
  });

  it("does not expose an execution function", () => {
    const registry = createDefaultRuntimeCommandRegistry();
    const spec = registry.get("node.version");

    expect(spec).not.toHaveProperty("execute");
    expect(spec).not.toHaveProperty("run");
    expect(spec).not.toHaveProperty("spawn");
    expect(spec).not.toHaveProperty("invoke");
    expect(registry).not.toHaveProperty("execute");
    expect(registry).not.toHaveProperty("run");
    expect(registry).not.toHaveProperty("spawn");
    expect(registry).not.toHaveProperty("invoke");
  });

  it("emits runtime proposal approval telemetry", () => {
    proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "git.status",
      argv: ["status", "--short"],
      workingDirectory: "repo_root",
      callId: "runtime-call-1",
      now: () => 7_000,
    });
    approveRuntimeCommandCall(db, {
      callId: "runtime-call-1",
      approvedAt: 8_000,
    });

    proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "node.version",
      argv: ["--version"],
      workingDirectory: "none",
      callId: "runtime-call-2",
      now: () => 9_000,
    });
    denyRuntimeCommandCall(db, {
      callId: "runtime-call-2",
      deniedAt: 10_000,
    });

    proposeRuntimeCommandCall(db, {
      sessionId: "session-1",
      commandId: "git.diff_stat",
      argv: ["diff", "--stat"],
      workingDirectory: "repo_root",
      callId: "runtime-call-3",
      now: () => 11_000,
    });
    markRuntimeCommandApprovalExpired(db, {
      callId: "runtime-call-3",
      expiredAt: 12_000,
    });

    expect(listTelemetryEvents(db).map((event) => event.event_type)).toEqual(
      expect.arrayContaining([
        "runtime_command_proposed",
        "runtime_command_approved",
        "runtime_command_denied",
        "runtime_command_approval_expired",
      ]),
    );
  });
});
