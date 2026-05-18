import Database from "better-sqlite3";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recordApproval } from "../db/approvals";
import { listLongTermMemory } from "../db/memory";
import { listRollbacks } from "../db/rollbacks";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import type { RouterDecision } from "../router";
import { InProcessToolRuntime, tools } from ".";
import type { MemoryNoteInput } from "./memory-note";

const decision: RouterDecision = {
  intent: { intent: "DETERMINISTIC_COMMAND", reason: "test" },
  safety: { safetyTag: "CONFIRM_ONCE", reason: "test" },
  capability: {
    tier: "T3",
    requiredCapabilities: ["tools"],
    reason: "test",
  },
  selection: {
    providerId: "openai",
    model: {
      id: "openai/gpt-4o-mini",
      provider: "openai",
      modelName: "gpt-4o-mini",
      tier: "T3",
      capabilities: ["text", "stream"],
      enabled: true,
    },
    reason: "test",
  },
};

let db: Database.Database;
let vaultRoot: string;
let previousVaultRoot: string | undefined;

function runtime(): InProcessToolRuntime {
  return new InProcessToolRuntime(tools, { db, now: () => 1_000 });
}

function approve(input: MemoryNoteInput, executionId: string): void {
  recordApproval(db, {
    id: `approval-${executionId}`,
    execution_id: executionId,
    session_id: "session-1",
    tool_id: "memory.note",
    scope_hash: tools.get("memory.note").scopeOf(input),
    decision: "APPROVED_ONCE",
    decided_at: 900,
    expires_at: 2_000,
  });
}

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
  vaultRoot = mkdtempSync(join(tmpdir(), "jarvis-memory-note-"));
  previousVaultRoot = process.env.JARVIS_OBSIDIAN_VAULT_ROOT;
  process.env.JARVIS_OBSIDIAN_VAULT_ROOT = vaultRoot;
});

afterEach(() => {
  db.close();
  rmSync(vaultRoot, { recursive: true, force: true });
  if (previousVaultRoot === undefined) {
    delete process.env.JARVIS_OBSIDIAN_VAULT_ROOT;
  } else {
    process.env.JARVIS_OBSIDIAN_VAULT_ROOT = previousVaultRoot;
  }
});

describe("memory.note", () => {
  it("validates input before execution", async () => {
    const result = await runtime().runTool({
      toolId: "memory.note",
      input: {
        title: "Bad tier",
        content: "hello",
        category: "fact",
        sensitivity: "secret",
      },
      sessionId: "session-1",
      executionId: "exec-invalid",
      decision,
    });

    expect(result).toMatchObject({
      ok: false,
      status: "DENIED",
      data: { reason: "invalid_tool_input" },
    });
    expect(listLongTermMemory(db)).toEqual([]);
  });

  it("writes an approved public note into SQLite and the vault", async () => {
    const input: MemoryNoteInput = {
      title: "Phase 3A starts",
      content: "Phase 3A focuses on vault foundation and memory schema.",
      category: "decision",
      sensitivity: "public",
      source: "user",
      sourceId: "session-1",
      project: "jarvis",
      tags: ["phase3", "#memory"],
    };
    approve(input, "exec-memory");

    const result = await runtime().runTool({
      toolId: "memory.note",
      input,
      sessionId: "session-1",
      executionId: "exec-memory",
      decision,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "COMPLETED",
      message: "Memory note written.",
      data: {
        sensitivity: "public",
        category: "decision",
      },
    });

    const rows = listLongTermMemory(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: "decision",
      content: input.content,
      sensitivity: "public",
      source: "user",
      project: "jarvis",
    });
    expect(rows[0]?.obsidian_path).toContain("20-projects/jarvis/decisions");
    const notePath = join(vaultRoot, rows[0]!.obsidian_path!);
    expect(existsSync(notePath)).toBe(true);
    expect(readFileSync(notePath, "utf8")).toContain(
      "Phase 3A focuses on vault foundation",
    );
    expect(listRollbacks(db, { sessionId: "session-1" })[0]?.kind).toBe(
      "memory_delete_created",
    );
  });

  it.each([
    ["sensitive", "sensitive_requires_encryption"],
    ["restricted", "restricted_requires_encryption"],
  ] as const)(
    "refuses %s writes until encrypted storage exists",
    async (sensitivity, reason) => {
      const input: MemoryNoteInput = {
        title: "Private note",
        content: "Do not store this yet.",
        category: "fact",
        sensitivity,
        source: "user",
        tags: [],
      };
      const executionId = `exec-${sensitivity}`;
      approve(input, executionId);

      const result = await runtime().runTool({
        toolId: "memory.note",
        input,
        sessionId: "session-1",
        executionId,
        decision,
      });

      expect(result).toMatchObject({
        ok: false,
        status: "DENIED",
        data: { reason },
      });
      expect(listLongTermMemory(db)).toEqual([]);
    },
  );

  it("emits memory_write telemetry without raw note content", async () => {
    const input: MemoryNoteInput = {
      title: "Preference",
      content: "Prince prefers local-first memory.",
      category: "preference",
      sensitivity: "personal",
      source: "user",
      tags: ["preferences"],
    };
    approve(input, "exec-telemetry");

    await runtime().runTool({
      toolId: "memory.note",
      input,
      sessionId: "session-1",
      executionId: "exec-telemetry",
      decision,
    });

    const memoryEvent = listTelemetryEvents(db).find(
      (event) => event.event_type === "memory_write",
    );
    expect(memoryEvent).toMatchObject({
      success: 1,
      session_id: "session-1",
      execution_id: "exec-telemetry",
      tool_name: "memory.note",
    });
    expect(memoryEvent?.notes).toContain("category=preference");
    expect(memoryEvent?.notes).toContain("sensitivity=personal");
    expect(memoryEvent?.notes).not.toContain("local-first memory");
  });
});
