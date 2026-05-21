import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensurePendingToolApproval,
  resumeApproval,
} from "../chat/tool-approvals";
import { insertLongTermMemory } from "../db/memory";
import { insertProjectIndexSnapshot } from "../db/project-index-snapshots";
import { insertProjectSource } from "../db/project-sources";
import { insertRegisteredProject } from "../db/projects";
import { applyMigrations } from "../db/schema";
import { listTelemetryEvents } from "../db/telemetry";
import type { RouterDecision } from "../router";
import { InProcessToolRuntime, tools } from "../tools";
import { classifyVoiceProjectTool } from "../voice-streaming/project-tool-boundary";
import {
  assembleProjectContext,
  PROJECT_CONTEXT_MIN_BUDGET_CHARS,
} from "./context-assembly";

const allowDecision: RouterDecision = {
  intent: { intent: "CONVERSATIONAL", reason: "phase5-closeout" },
  safety: { safetyTag: "ALLOW", reason: "phase5-closeout" },
  capability: {
    tier: "T3",
    requiredCapabilities: ["text", "stream"],
    reason: "phase5-closeout",
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
    reason: "phase5-closeout",
  },
};

let db: Database.Database;
let runtime: InProcessToolRuntime;
let workspaceRoot: string;
let previousWorkspaceRoot: string | undefined;
let now: number;

beforeEach(() => {
  previousWorkspaceRoot = process.env.JARVIS_WORKSPACE_ROOT;
  workspaceRoot = mkdtempSync(join(tmpdir(), "jarvis-phase5-closeout-"));
  process.env.JARVIS_WORKSPACE_ROOT = workspaceRoot;
  db = new Database(":memory:");
  applyMigrations(db);
  now = 10_000;
  runtime = new InProcessToolRuntime(tools, {
    db,
    now: () => now,
    toolsEnabled: true,
    bindHost: "127.0.0.1",
  });
});

afterEach(() => {
  db.close();
  rmSync(workspaceRoot, { recursive: true, force: true });
  if (previousWorkspaceRoot === undefined) {
    delete process.env.JARVIS_WORKSPACE_ROOT;
  } else {
    process.env.JARVIS_WORKSPACE_ROOT = previousWorkspaceRoot;
  }
});

async function runApproved(
  toolId: string,
  toolName: string,
  executionId: string,
  input: unknown,
) {
  await runtime.runTool({
    toolId,
    input,
    sessionId: "session-1",
    executionId,
    decision: allowDecision,
  });
  const pending = ensurePendingToolApproval({
    db,
    executionId,
    sessionId: "session-1",
    toolId,
    toolName,
    scopeHash: tools.get(toolId).scopeOf(input),
    requiredSafetyTag: "CONFIRM_ALWAYS",
    safetyTag: "ALLOW",
    toolInput: input,
    now,
    ttlMs: 500,
  });
  now += 100;
  return resumeApproval({
    db,
    runtime,
    executionId,
    decision: "APPROVED_ONCE",
    approvalToken: pending.approvalToken,
    now,
  });
}

function seedCloseoutProject() {
  insertRegisteredProject(db, {
    id: "proj_closeout_secret_id",
    slug: "raw-secret-slug",
    displayName: "Raw Secret Display",
    rootKind: "virtual",
    rootRef: "virtual:raw-secret",
    createdAt: 1_000,
  });
  insertProjectSource(db, {
    id: "psrc_closeout_secret",
    projectId: "proj_closeout_secret_id",
    kind: "file",
    ref: "raw-secret-source.md",
  });
  insertLongTermMemory(db, {
    id: "mem_closeout_secret",
    category: "decision",
    content: "RAW_MEMORY_TEXT_CLOSEOUT",
    source: "user",
    source_id: null,
    project: "raw-secret-slug",
    tags_json: JSON.stringify(["#closeout"]),
    sensitivity: "personal",
    created_at: 1_000,
    updated_at: 1_000,
    obsidian_path: "20-projects/raw-secret/memory.md",
    hash: "sha256:closeout",
  });
}

describe("Phase 5 closeout guard", () => {
  it("keeps disabled Phase 5 features absent from the tool registry", () => {
    const registeredToolIds = tools.list().map((tool) => tool.id);

    expect(registeredToolIds).not.toEqual(
      expect.arrayContaining([
        "project.write_memory",
        "project.extract",
        "project.extract_tasks",
        "project.llm_extract",
        "project.background_index",
        "project.watch",
        "project.cron",
        "project.network_source",
        "project.voice_mutation",
        "voice.project_mutation",
        "project.voice_approval",
        "project.wake_word",
        "project.always_listening",
        "project.cross_project_synthesis",
        "project.synthesize",
        "project.auto_promote",
        "project.auto_status",
        "project.auto_archive",
        "memory.auto_prune",
      ]),
    );
  });

  it("keeps live project mutations approval-gated and read tools pure read", () => {
    for (const toolId of [
      "project.register",
      "project.add_source",
      "project.index",
      "project.promote_task",
      "project.set_status",
    ]) {
      expect(tools.get(toolId)).toMatchObject({
        requiredSafetyTag: "CONFIRM_ALWAYS",
        reversibilityClass: "REVERSIBLE_WRITE",
      });
    }

    for (const toolId of ["project.list", "project.get", "project.summarize"]) {
      expect(tools.get(toolId)).toMatchObject({
        requiredSafetyTag: "ALLOW",
        reversibilityClass: "PURE_READ",
      });
    }
  });

  it("keeps project telemetry metadata-only and redacted", async () => {
    seedCloseoutProject();
    writeFileSync(
      join(workspaceRoot, "raw-secret-source.md"),
      [
        "TODO: RAW_TASK_TITLE_CLOSEOUT",
        "blocked by RAW_BLOCKER_DESCRIPTION_CLOSEOUT",
        "RAW_FILE_CONTENT_CLOSEOUT",
      ].join("\n"),
    );

    await runApproved(
      "project.index",
      "Index Project Snapshot",
      "closeout-index",
      { projectId: "proj_closeout_secret_id", triggeredBy: "manual" },
    );
    const task = db
      .prepare(
        `SELECT id
         FROM project_task
         WHERE project_id = ?
         ORDER BY id ASC
         LIMIT 1`,
      )
      .get("proj_closeout_secret_id") as { id: string };
    await runApproved(
      "project.promote_task",
      "Promote Project Task",
      "closeout-promote",
      { projectId: "proj_closeout_secret_id", taskId: task.id },
    );
    await runApproved(
      "project.set_status",
      "Set Project Status",
      "closeout-status",
      { projectId: "proj_closeout_secret_id", status: "paused" },
    );
    await runtime.runTool({
      toolId: "project.summarize",
      input: { id: "proj_closeout_secret_id" },
      sessionId: "session-1",
      executionId: "closeout-summarize",
      decision: allowDecision,
    });

    const projectTelemetry = listTelemetryEvents(db, 100).filter((event) =>
      event.event_type.startsWith("project."),
    );
    expect(projectTelemetry.map((event) => event.event_type).sort()).toEqual([
      "project.indexed",
      "project.status_changed",
      "project.summarized",
      "project.task_extracted",
      "project.task_promoted",
    ]);
    const serialized = JSON.stringify(projectTelemetry);
    for (const unsafe of [
      "proj_closeout_secret_id",
      "raw-secret-slug",
      "Raw Secret Display",
      "raw-secret-source.md",
      "RAW_TASK_TITLE_CLOSEOUT",
      "RAW_BLOCKER_DESCRIPTION_CLOSEOUT",
      "RAW_FILE_CONTENT_CLOSEOUT",
      "RAW_MEMORY_TEXT_CLOSEOUT",
      "origin:",
      "source_ref",
    ]) {
      expect(serialized).not.toContain(unsafe);
    }
    expect(serialized).toContain("project_id_hash=sha256:");
  });

  it("keeps the voice project boundary read-only and non-approving", () => {
    for (const toolId of ["project.list", "project.get", "project.summarize"]) {
      expect(classifyVoiceProjectTool(tools, toolId)).toEqual({
        allowed: true,
        toolId,
        decision: "allowed_read_only_project_tool",
        metadataOnly: true,
        canApprove: false,
        canMutate: false,
      });
    }

    for (const toolId of [
      "project.register",
      "project.add_source",
      "project.index",
      "project.promote_task",
      "project.set_status",
    ]) {
      expect(classifyVoiceProjectTool(tools, toolId)).toMatchObject({
        allowed: false,
        decision: "denied_project_mutation_tool",
        canApprove: false,
        canMutate: false,
      });
    }
    expect(
      classifyVoiceProjectTool(tools, "project.write_memory"),
    ).toMatchObject({
      allowed: false,
      decision: "denied_unregistered_project_tool",
      canApprove: false,
      canMutate: false,
    });
    expect(classifyVoiceProjectTool(tools, "project.unknown")).toMatchObject({
      allowed: false,
      decision: "denied_unregistered_project_tool",
      canApprove: false,
      canMutate: false,
    });
  });

  it("keeps project context assembly explicit, bounded, redacted, and library-only", () => {
    seedCloseoutProject();
    insertProjectIndexSnapshot(db, {
      id: "pidx_closeout",
      projectId: "proj_closeout_secret_id",
      startedAt: 2_000,
      finishedAt: 2_100,
      sourcesSeen: 1,
      artifactsExtracted: 0,
      triggeredBy: "manual",
      status: "completed",
    });
    db.prepare(
      `INSERT INTO project_task (
         id, project_id, thread_id, title, status, confidence, promoted,
         origin_ref, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "ptask_context_closeout",
      "proj_closeout_secret_id",
      null,
      "Context commitment closeout",
      "open",
      0.9,
      1,
      "origin:RAW_ORIGIN_CLOSEOUT",
      1_000,
      1_100,
    );

    expect(assembleProjectContext(db, {})).toMatchObject({
      ok: false,
      reason: "project_id_required",
      derivedState: true,
      authoritative: false,
      context: null,
    });
    const result = assembleProjectContext(db, {
      projectId: "proj_closeout_secret_id",
      maxChars: PROJECT_CONTEXT_MIN_BUDGET_CHARS,
      now: 3_000,
    });

    expect(result).toMatchObject({
      ok: true,
      context: {
        derivedState: true,
        authoritative: false,
        budget: {
          maxChars: PROJECT_CONTEXT_MIN_BUDGET_CHARS,
          truncated: true,
        },
      },
    });
    if (!result.ok) throw new Error("expected context");
    expect(result.context.contextText.length).toBeLessThanOrEqual(
      PROJECT_CONTEXT_MIN_BUDGET_CHARS,
    );
    const serialized = JSON.stringify(result.context);
    expect(serialized).not.toContain("origin:RAW_ORIGIN_CLOSEOUT");
    expect(serialized).not.toContain("raw-secret-source.md");
    expect(serialized).not.toContain("RAW_MEMORY_TEXT_CLOSEOUT");

    const chatContinuation = readFileSync(
      join(process.cwd(), "src/lib/chat/tool-continuation.ts"),
      "utf8",
    );
    const chatApprovals = readFileSync(
      join(process.cwd(), "src/lib/chat/tool-approvals.ts"),
      "utf8",
    );
    const appChatRoute = readFileSync(
      join(process.cwd(), "app/api/chat/route.ts"),
      "utf8",
    );
    expect(
      `${chatContinuation}\n${chatApprovals}\n${appChatRoute}`,
    ).not.toContain("assembleProjectContext");
  });

  it("keeps Phase 5 source files free of disabled wiring strings", () => {
    const phase5Sources = [
      "src/lib/tools/projects.ts",
      "src/lib/projects/context-assembly.ts",
      "src/lib/projects/memory-bridge.ts",
      "src/lib/voice-streaming/project-tool-boundary.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    for (const pattern of [
      /project\.write_memory/,
      /project\.cross_project_synthesis/,
      /project\.synthesize/,
      /project\.auto_promote/,
      /project\.auto_status/,
      /project\.auto_archive/,
      /memory\.auto_prune/,
      /wake.?word/i,
      /always.?listening/i,
      /voice.*approval.*approve/i,
      /background.*index/i,
      /watcher|chokidar|cron/i,
      /network_url/,
      /fetch\(|WebSocket/,
      /source_content_telemetry/,
    ]) {
      expect(phase5Sources).not.toMatch(pattern);
    }
  });
});
