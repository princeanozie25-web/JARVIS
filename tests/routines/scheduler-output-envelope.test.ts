import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_PHASE_17_ROUTINE_REGISTRY } from "../../src/lib/routines/routine-registry";
import {
  ForegroundSchedulerOutputEnvelopeSchema,
  buildForegroundSchedulerOutputEnvelope,
} from "../../src/lib/routines/scheduler-output-envelope";

const repoRoot = process.cwd();
const tick_id = "tick:phase17b:output-envelope";

describe("Phase 17B.4 foreground scheduler output envelope scaffold", () => {
  it("gives eligible report routines output-shaped metadata without output generation", () => {
    const routine = DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[0];

    expect(
      buildForegroundSchedulerOutputEnvelope({
        tick_id,
        routine,
        eligible: true,
      }),
    ).toMatchObject({
      envelope_id: "envelope:phase17b:output-envelope:daily_self_audit",
      tick_id,
      routine_id: routine.routine_id,
      routine_kind: routine.routine_kind,
      output_kind: "report",
      output_supported: false,
      output_generated: false,
      metadata_only: true,
      redaction_required: true,
      redaction_status: "not_started",
      raw_output_allowed: false,
      persistence_supported: false,
      persistence_attempted: false,
      approval_bridge_supported: false,
      approval_bridge_attempted: false,
      report_generated: false,
      suggestion_generated: false,
      baseline_update_generated: false,
    });
  });

  it("maps suggestion and baseline routines to output-shaped metadata without content", () => {
    const baselineRoutine = DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines.find(
      (routine) => routine.output_kind === "baseline_update",
    );
    const suggestionRoutine = DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines.find(
      (routine) => routine.output_kind === "suggestion",
    );

    expect(baselineRoutine).toBeDefined();
    expect(suggestionRoutine).toBeDefined();
    expect(
      buildForegroundSchedulerOutputEnvelope({
        tick_id,
        routine: baselineRoutine!,
        eligible: true,
      }),
    ).toMatchObject({
      output_kind: "baseline_update",
      output_supported: false,
      output_generated: false,
      baseline_update_generated: false,
      raw_output_allowed: false,
    });
    expect(
      buildForegroundSchedulerOutputEnvelope({
        tick_id,
        routine: suggestionRoutine!,
        eligible: true,
      }),
    ).toMatchObject({
      output_kind: "suggestion",
      output_supported: false,
      output_generated: false,
      suggestion_generated: false,
      raw_output_allowed: false,
    });
  });

  it("gives skipped routines none output metadata with redaction unavailable", () => {
    const routine = DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[1];

    expect(
      buildForegroundSchedulerOutputEnvelope({
        tick_id,
        routine,
        eligible: false,
      }),
    ).toMatchObject({
      output_kind: "none",
      output_supported: false,
      output_generated: false,
      redaction_required: true,
      redaction_status: "unavailable",
      raw_output_allowed: false,
      persistence_attempted: false,
      approval_bridge_attempted: false,
    });
  });

  it("schema rejects generated raw output, persistence, approval bridge, collectors, or authority", () => {
    const envelope = buildForegroundSchedulerOutputEnvelope({
      tick_id,
      routine: DEFAULT_PHASE_17_ROUTINE_REGISTRY.routines[0],
      eligible: true,
    });

    expect(
      ForegroundSchedulerOutputEnvelopeSchema.safeParse({
        ...envelope,
        output_supported: true,
        output_generated: true,
        raw_output_allowed: true,
        persistence_supported: true,
        persistence_attempted: true,
        approval_bridge_supported: true,
        approval_bridge_attempted: true,
        collector_execution_supported: true,
        report_generated: true,
        tool_called: true,
      }).success,
    ).toBe(false);
  });

  it("does not add collectors, DB reads, reports, suggestions, baselines, persistence, tools, mutations, approval, cloud, or network behavior", () => {
    const source = read("src/lib/routines/scheduler-output-envelope.ts");

    expect(source).not.toMatch(
      /setTimeout\s*\(|setInterval\s*\(|cron|scheduleJob|SELECT\s+|INSERT INTO|db\.|database\.|readEventStore|queryEventStore|writeEventStore|saveEvent|fetch\s*\(|WebSocket|XMLHttpRequest|node:http|node:https|writeMemory|callTool|executeTool|controlDevice|approveExecution|generateReport|generateSuggestion|generateBaseline/i,
    );
    expect(source).not.toMatch(/\bcollect[A-Z]/);
  });
});

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}
