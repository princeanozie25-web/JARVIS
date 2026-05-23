import { describe, expect, it } from "vitest";

import {
  DEFAULT_PHASE_9F_REPLAY_TRACE_GUARD_STATE,
  PHASE_9F_REPLAY_TRACE_CLOSEOUT_GUARDS,
  Phase9FReplayTraceCloseoutReportSchema,
  createDefaultTraceRecord,
  createPhase9FReplayTraceCloseoutReport,
  projectTraceRecordToReplayViewer,
} from "./index";

describe("Phase 9F replay trace closeout guards", () => {
  it("passes the default 9F closeout report", () => {
    const report = createPhase9FReplayTraceCloseoutReport();

    expect(report).toMatchObject({
      verdict: "pass",
      checked_guards: [...PHASE_9F_REPLAY_TRACE_CLOSEOUT_GUARDS],
      failed_guards: [],
      generated_from: "phase_9f_replay_trace_scaffold",
      metadata_only: true,
      render_safe: true,
      replay_safe: true,
      non_executable: true,
      projection_metadata_only: true,
      executable_trace_payloads_allowed: false,
      raw_trace_payloads_allowed: false,
      trace_ingestion_runtime_allowed: false,
      db_reads_allowed: false,
      telemetry_reads_allowed: false,
      graph_execution_allowed: false,
      tool_called: false,
      action_executed: false,
      approval_granted: false,
      routine_scheduled: false,
      db_write_performed: false,
      network_called: false,
    });
  });

  it("fails if executable trace payloads are allowed", () => {
    const report = createPhase9FReplayTraceCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9F_REPLAY_TRACE_GUARD_STATE,
        executable_trace_payloads_allowed: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_executable_trace_payload"],
      notes: [
        "forbidden_replay_trace_capability_enabled:executable_trace_payloads_allowed",
      ],
    });
  });

  it("fails if raw trace payloads are allowed", () => {
    const report = createPhase9FReplayTraceCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9F_REPLAY_TRACE_GUARD_STATE,
        raw_trace_payloads_allowed: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_raw_trace_payload"],
    });
  });

  it("fails if projection can carry forbidden raw content classes", () => {
    const report = createPhase9FReplayTraceCloseoutReport({
      timelineProjection: {
        raw_tool_args: "withheld",
        raw_prompt: "withheld",
        raw_model_output: "withheld",
        raw_ocr_text: "withheld",
        raw_frame: "withheld",
        raw_voice_transcript: "withheld",
        raw_audio: "withheld",
        project_file_body: "withheld",
        memory_content: "withheld",
        secret: "withheld",
        exact_pii: "withheld",
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_tool_args_projection",
        "no_prompt_projection",
        "no_model_output_projection",
        "no_ocr_or_frame_projection",
        "no_voice_or_audio_projection",
        "no_project_or_memory_projection",
        "no_secret_or_pii_projection",
      ]),
    });
  });

  it("fails if run, retry, approve, execute, or rerun affordance is enabled", () => {
    const report = createPhase9FReplayTraceCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9F_REPLAY_TRACE_GUARD_STATE,
        run_trace_affordance_enabled: true,
        retry_tool_affordance_enabled: true,
        rerun_routine_affordance_enabled: true,
        approve_or_execute_affordance_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_run_trace_affordance",
        "no_retry_tool_affordance",
        "no_rerun_routine_affordance",
        "no_approve_or_execute_affordance",
      ]),
    });
  });

  it("fails if graph execution is enabled", () => {
    const report = createPhase9FReplayTraceCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9F_REPLAY_TRACE_GUARD_STATE,
        graph_execution_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: ["no_graph_execution_affordance"],
    });
  });

  it("fails if trace ingestion runtime, DB reads, or telemetry reads are enabled", () => {
    const report = createPhase9FReplayTraceCloseoutReport({
      guardState: {
        ...DEFAULT_PHASE_9F_REPLAY_TRACE_GUARD_STATE,
        trace_ingestion_runtime_enabled: true,
        db_reads_enabled: true,
        telemetry_reads_enabled: true,
      },
    });

    expect(report).toMatchObject({
      verdict: "fail",
      failed_guards: expect.arrayContaining([
        "no_trace_ingestion_runtime",
        "no_db_or_telemetry_reads",
      ]),
    });
  });

  it("confirms projection to replay viewer is non-executable", () => {
    const replayProjection = projectTraceRecordToReplayViewer(
      createDefaultTraceRecord(),
    );
    const report = createPhase9FReplayTraceCloseoutReport({
      replayProjection,
    });

    expect(replayProjection).toMatchObject({
      non_executable: true,
      run_affordance_allowed: false,
      retry_affordance_allowed: false,
      replay_affordance_allowed: false,
      execute_affordance_allowed: false,
      graph_execution_allowed: false,
      action_executed: false,
    });
    expect(report).toMatchObject({
      verdict: "pass",
      failed_guards: [],
    });
  });

  it("is deterministic and serializable", () => {
    const first = createPhase9FReplayTraceCloseoutReport();
    const second = createPhase9FReplayTraceCloseoutReport();

    expect(first).toEqual(second);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Phase9FReplayTraceCloseoutReportSchema.parse(first)).toEqual(first);
  });

  it("exports replay trace closeout helpers from command-center index", () => {
    expect(typeof createPhase9FReplayTraceCloseoutReport).toBe("function");
    expect(
      Phase9FReplayTraceCloseoutReportSchema.parse(
        createPhase9FReplayTraceCloseoutReport(),
      ),
    ).toEqual(createPhase9FReplayTraceCloseoutReport());
  });
});
