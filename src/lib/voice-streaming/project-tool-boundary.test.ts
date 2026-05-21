import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "../db/schema";
import {
  insertRegisteredProject,
  listRegisteredProjects,
} from "../db/projects";
import { listProjectSources } from "../db/project-sources";
import { listProjectIndexSnapshots } from "../db/project-index-snapshots";
import { listProjectTasks } from "../db/project-artifacts";
import { listToolCalls } from "../db/tool-calls";
import { tools } from "../tools";
import { VoiceRuntimeBoundaryCoordinator } from "./runtime-boundary-coordinator";
import {
  classifyVoiceProjectTool,
  VOICE_ALLOWED_PROJECT_READ_TOOL_IDS,
} from "./project-tool-boundary";
import type { VoiceOrchestrationTelemetryEvent } from "./types";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  applyMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("Phase 5 A14 project voice boundary", () => {
  it("allows only read-only project tools for voice invocation", () => {
    expect(VOICE_ALLOWED_PROJECT_READ_TOOL_IDS).toEqual([
      "project.list",
      "project.get",
      "project.summarize",
    ]);
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
  });

  it("denies project mutation tools, project.write_memory, and unknown tools", () => {
    for (const toolId of [
      "project.register",
      "project.add_source",
      "project.index",
      "project.promote_task",
      "project.set_status",
    ]) {
      expect(classifyVoiceProjectTool(tools, toolId)).toEqual({
        allowed: false,
        toolId,
        decision: "denied_project_mutation_tool",
        metadataOnly: true,
        canApprove: false,
        canMutate: false,
      });
    }

    expect(tools.has("project.write_memory")).toBe(false);
    expect(classifyVoiceProjectTool(tools, "project.write_memory")).toEqual({
      allowed: false,
      toolId: "project.write_memory",
      decision: "denied_unregistered_project_tool",
      metadataOnly: true,
      canApprove: false,
      canMutate: false,
    });
    expect(classifyVoiceProjectTool(tools, "memory.note")).toMatchObject({
      allowed: false,
      decision: "denied_non_project_tool",
      canApprove: false,
      canMutate: false,
    });
  });

  it("does not mutate project state through the voice boundary path", () => {
    insertRegisteredProject(db, {
      id: "proj_voice",
      slug: "voice",
      displayName: "Voice",
      rootKind: "virtual",
      rootRef: "virtual:voice",
      createdAt: 1_000,
    });
    const before = {
      projects: listRegisteredProjects(db, { includeArchived: true }),
      sources: listProjectSources(db, "proj_voice"),
      snapshots: listProjectIndexSnapshots(db, "proj_voice"),
      tasks: listProjectTasks(db, "proj_voice"),
      toolCalls: listToolCalls(db),
    };

    const denied = classifyVoiceProjectTool(tools, "project.set_status");

    expect(denied).toMatchObject({
      allowed: false,
      decision: "denied_project_mutation_tool",
      canApprove: false,
      canMutate: false,
    });
    expect(listRegisteredProjects(db, { includeArchived: true })).toEqual(
      before.projects,
    );
    expect(listProjectSources(db, "proj_voice")).toEqual(before.sources);
    expect(listProjectIndexSnapshots(db, "proj_voice")).toEqual(
      before.snapshots,
    );
    expect(listProjectTasks(db, "proj_voice")).toEqual(before.tasks);
    expect(listToolCalls(db)).toEqual(before.toolCalls);
  });

  it("keeps voice project boundary decisions metadata-only", () => {
    const result = classifyVoiceProjectTool(tools, "project.index");
    const serialized = JSON.stringify({
      result,
      sourceRef: undefined,
      originRef: undefined,
    });

    expect(serialized).not.toContain("secret source ref");
    expect(serialized).not.toContain("secret origin ref");
    expect(serialized).not.toContain("secret file content");
    expect(serialized).not.toContain("secret TTS content");
    expect(serialized).not.toContain("wake_word");
    expect(serialized).not.toContain("always_listening");
  });

  it("voice approval attempts remain rejected and cannot approve project mutations", async () => {
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
    const coordinator = new VoiceRuntimeBoundaryCoordinator({
      newId: () => "voice-project-boundary-1",
      now: () => 1_000,
      getActiveSessionId: () => "session-1",
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    });

    const result = await coordinator.handleEvent({
      id: "voice-project-approval-attempt",
      type: "runtime_pending_approval_detected",
      sessionId: "session-1",
      turnId: "turn-1",
      approvalRequestId: "secret-project-approval-id",
      toolName: "project.set_status",
      voiceApprovalAttemptCategory: "spoken_approve",
      voiceTurnState: "waiting_for_send",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "voice_approval_rejected",
      advisory: {
        action: "require_on_screen_confirmation",
        state: "rejected",
        reason: "voice_approval_rejected",
        toolName: "project.set_status",
      },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_runtime_boundary_voice_approval_rejected",
        voiceApprovalAttemptCategory: "spoken_approve",
        voiceApprovalRefusalAction: "rejected_voice_approval",
        runtimeBoundaryReason: "voice_approval_rejected",
      }),
    );
    expect(JSON.stringify(telemetry)).not.toContain(
      "secret-project-approval-id",
    );
  });

  it("does not introduce wake-word, always-listening, extraction, network, or runtime execution wiring", () => {
    const projectBoundarySource = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/project-tool-boundary.ts"),
      "utf8",
    );
    const voiceIndexSource = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/index.ts"),
      "utf8",
    );
    const serialized = `${projectBoundarySource}\n${voiceIndexSource}`;

    expect(serialized).not.toMatch(/wake.?word/i);
    expect(serialized).not.toMatch(/always.?listening/i);
    expect(serialized).not.toMatch(/project\.extract|llm|LLM/);
    expect(serialized).not.toMatch(/network_url|fetch\(|WebSocket/);
    expect(serialized).not.toMatch(/exec\(|spawn\(|runtime\.runTool/);
    expect(serialized).not.toMatch(/project\.write_memory/);
    expect(serialized).not.toMatch(/insertLongTermMemory|memory\.note/);
  });
});
