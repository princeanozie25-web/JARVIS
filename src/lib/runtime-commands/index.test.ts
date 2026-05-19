import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import {
  INITIAL_RUNTIME_COMMAND_SPECS,
  RuntimeCommandRegistry,
  createDefaultRuntimeCommandRegistry,
  listRuntimeCommands,
  validateRuntimeCommandInput,
  type RuntimeCommandSpec,
} from ".";

let db: Database.Database;

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
});

afterEach(() => {
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
});
