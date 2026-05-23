import { z } from "zod";

import { AuditReplayViewerViewModelSchema } from "./audit-replay-viewer";
import { AuditTraceTimelineItemSchema } from "./audit-trace-timeline";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import {
  projectTraceRecordToReplayViewer,
  projectTraceRecordToTimelineItem,
} from "./trace-projections";
import {
  TRACE_RECORD_EXECUTABLE_PAYLOAD_FIELDS,
  createDefaultTraceRecord,
  validateTraceRecord,
} from "./trace-record";

export const PHASE_9F_REPLAY_TRACE_CLOSEOUT_GUARDS = [
  "no_executable_trace_payload",
  "no_raw_trace_payload",
  "no_tool_args_projection",
  "no_prompt_projection",
  "no_model_output_projection",
  "no_ocr_or_frame_projection",
  "no_voice_or_audio_projection",
  "no_project_or_memory_projection",
  "no_secret_or_pii_projection",
  "no_run_trace_affordance",
  "no_retry_tool_affordance",
  "no_rerun_routine_affordance",
  "no_approve_or_execute_affordance",
  "no_graph_execution_affordance",
  "no_trace_ingestion_runtime",
  "no_db_or_telemetry_reads",
] as const;

export const PHASE_9F_REPLAY_TRACE_FORBIDDEN_CAPABILITY_FIELDS = [
  "executable_trace_payloads_allowed",
  "raw_trace_payloads_allowed",
  "tool_args_projection_enabled",
  "prompt_projection_enabled",
  "model_output_projection_enabled",
  "ocr_or_frame_projection_enabled",
  "voice_or_audio_projection_enabled",
  "project_or_memory_projection_enabled",
  "secret_or_pii_projection_enabled",
  "run_trace_affordance_enabled",
  "retry_tool_affordance_enabled",
  "rerun_routine_affordance_enabled",
  "approve_or_execute_affordance_enabled",
  "graph_execution_enabled",
  "trace_ingestion_runtime_enabled",
  "db_reads_enabled",
  "telemetry_reads_enabled",
] as const;

export const PHASE_9F_REPLAY_TRACE_CLOSEOUT_VERDICTS = [
  "pass",
  "fail",
] as const;

export const Phase9FReplayTraceCloseoutGuardSchema = z.enum(
  PHASE_9F_REPLAY_TRACE_CLOSEOUT_GUARDS,
);
export const Phase9FReplayTraceForbiddenCapabilityFieldSchema = z.enum(
  PHASE_9F_REPLAY_TRACE_FORBIDDEN_CAPABILITY_FIELDS,
);
export const Phase9FReplayTraceCloseoutVerdictSchema = z.enum(
  PHASE_9F_REPLAY_TRACE_CLOSEOUT_VERDICTS,
);

export const Phase9FReplayTraceGuardStateSchema = z.strictObject({
  executable_trace_payloads_allowed: z.literal(false),
  raw_trace_payloads_allowed: z.literal(false),
  tool_args_projection_enabled: z.literal(false),
  prompt_projection_enabled: z.literal(false),
  model_output_projection_enabled: z.literal(false),
  ocr_or_frame_projection_enabled: z.literal(false),
  voice_or_audio_projection_enabled: z.literal(false),
  project_or_memory_projection_enabled: z.literal(false),
  secret_or_pii_projection_enabled: z.literal(false),
  run_trace_affordance_enabled: z.literal(false),
  retry_tool_affordance_enabled: z.literal(false),
  rerun_routine_affordance_enabled: z.literal(false),
  approve_or_execute_affordance_enabled: z.literal(false),
  graph_execution_enabled: z.literal(false),
  trace_ingestion_runtime_enabled: z.literal(false),
  db_reads_enabled: z.literal(false),
  telemetry_reads_enabled: z.literal(false),
});

export const Phase9FReplayTraceCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9f_replay_trace_closeout_report"),
  verdict: Phase9FReplayTraceCloseoutVerdictSchema,
  checked_guards: z.array(Phase9FReplayTraceCloseoutGuardSchema),
  failed_guards: z.array(Phase9FReplayTraceCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9f_replay_trace_scaffold"),
  metadata_only: z.literal(true),
  render_safe: z.boolean(),
  replay_safe: z.boolean(),
  non_executable: z.literal(true),
  projection_metadata_only: z.literal(true),
  executable_trace_payloads_allowed: z.literal(false),
  raw_trace_payloads_allowed: z.literal(false),
  trace_ingestion_runtime_allowed: z.literal(false),
  db_reads_allowed: z.literal(false),
  telemetry_reads_allowed: z.literal(false),
  graph_execution_allowed: z.literal(false),
  authority_surface: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  routine_scheduled: z.literal(false),
  routine_triggered: z.literal(false),
  memory_written: z.literal(false),
  project_written: z.literal(false),
  device_action_triggered: z.literal(false),
  cloud_fallback_triggered: z.literal(false),
  db_write_performed: z.literal(false),
  network_called: z.literal(false),
  audio_capture_started: z.literal(false),
  video_capture_started: z.literal(false),
});

export type Phase9FReplayTraceCloseoutGuard = z.infer<
  typeof Phase9FReplayTraceCloseoutGuardSchema
>;
export type Phase9FReplayTraceForbiddenCapabilityField = z.infer<
  typeof Phase9FReplayTraceForbiddenCapabilityFieldSchema
>;
export type Phase9FReplayTraceCloseoutVerdict = z.infer<
  typeof Phase9FReplayTraceCloseoutVerdictSchema
>;
export type Phase9FReplayTraceGuardState = z.infer<
  typeof Phase9FReplayTraceGuardStateSchema
>;
export type Phase9FReplayTraceCloseoutReport = z.infer<
  typeof Phase9FReplayTraceCloseoutReportSchema
>;

export interface Phase9FReplayTraceCloseoutInput {
  traceRecord?: unknown;
  unsafeTraceRecord?: unknown;
  timelineProjection?: unknown;
  replayProjection?: unknown;
  guardState?: unknown;
}

export const DEFAULT_PHASE_9F_REPLAY_TRACE_GUARD_STATE: Phase9FReplayTraceGuardState =
  Phase9FReplayTraceGuardStateSchema.parse({
    executable_trace_payloads_allowed: false,
    raw_trace_payloads_allowed: false,
    tool_args_projection_enabled: false,
    prompt_projection_enabled: false,
    model_output_projection_enabled: false,
    ocr_or_frame_projection_enabled: false,
    voice_or_audio_projection_enabled: false,
    project_or_memory_projection_enabled: false,
    secret_or_pii_projection_enabled: false,
    run_trace_affordance_enabled: false,
    retry_tool_affordance_enabled: false,
    rerun_routine_affordance_enabled: false,
    approve_or_execute_affordance_enabled: false,
    graph_execution_enabled: false,
    trace_ingestion_runtime_enabled: false,
    db_reads_enabled: false,
    telemetry_reads_enabled: false,
  });

export function createPhase9FReplayTraceCloseoutReport(
  input: Phase9FReplayTraceCloseoutInput = {},
): Phase9FReplayTraceCloseoutReport {
  const failedGuards = new Set<Phase9FReplayTraceCloseoutGuard>();
  const notes = new Set<string>();
  const traceRecord = input.traceRecord ?? createDefaultTraceRecord();

  evaluateTraceRecord(traceRecord, failedGuards, notes);
  evaluateUnsafeTraceRejection(
    input.unsafeTraceRecord ?? {
      ...createDefaultTraceRecord(),
      executable_payload: { blocked: true },
      raw_prompt: "withheld",
    },
    failedGuards,
    notes,
  );
  evaluateTimelineProjection(
    input.timelineProjection ?? projectTraceRecordToTimelineItem(traceRecord),
    failedGuards,
    notes,
  );
  evaluateReplayProjection(
    input.replayProjection ?? projectTraceRecordToReplayViewer(traceRecord),
    failedGuards,
    notes,
  );
  evaluateGuardState(
    input.guardState ?? DEFAULT_PHASE_9F_REPLAY_TRACE_GUARD_STATE,
    failedGuards,
    notes,
  );

  if (failedGuards.size === 0) {
    notes.add("phase_9f_replay_trace_scaffold_is_metadata_only_non_executable");
  }

  return Phase9FReplayTraceCloseoutReportSchema.parse({
    kind: "command_center.phase_9f_replay_trace_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9F_REPLAY_TRACE_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    notes: [...notes],
    generated_from: "phase_9f_replay_trace_scaffold",
    metadata_only: true,
    render_safe: failedGuards.size === 0,
    replay_safe: failedGuards.size === 0,
    non_executable: true,
    projection_metadata_only: true,
    executable_trace_payloads_allowed: false,
    raw_trace_payloads_allowed: false,
    trace_ingestion_runtime_allowed: false,
    db_reads_allowed: false,
    telemetry_reads_allowed: false,
    graph_execution_allowed: false,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function evaluateTraceRecord(
  traceRecord: unknown,
  failedGuards: Set<Phase9FReplayTraceCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateTraceRecord(traceRecord);
  if (!validation.passed) {
    notes.add("trace_record_validation_failed");
    for (const reason of validation.reasons) {
      mapTraceValidationReason(reason, failedGuards);
    }
  }
  addScannedFailures(
    scanCloseoutPayload(traceRecord, new WeakSet<object>()),
    failedGuards,
    notes,
  );
}

function evaluateUnsafeTraceRejection(
  unsafeTraceRecord: unknown,
  failedGuards: Set<Phase9FReplayTraceCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateTraceRecord(unsafeTraceRecord);
  if (validation.passed) {
    failedGuards.add("no_executable_trace_payload");
    failedGuards.add("no_raw_trace_payload");
    notes.add("unsafe_trace_record_was_not_rejected");
  }
}

function evaluateTimelineProjection(
  timelineProjection: unknown,
  failedGuards: Set<Phase9FReplayTraceCloseoutGuard>,
  notes: Set<string>,
): void {
  if (!AuditTraceTimelineItemSchema.safeParse(timelineProjection).success) {
    notes.add("timeline_projection_schema_rejected");
    failedGuards.add("no_raw_trace_payload");
  }
  addScannedFailures(
    scanCloseoutPayload(timelineProjection, new WeakSet<object>()),
    failedGuards,
    notes,
  );
}

function evaluateReplayProjection(
  replayProjection: unknown,
  failedGuards: Set<Phase9FReplayTraceCloseoutGuard>,
  notes: Set<string>,
): void {
  const parsed = AuditReplayViewerViewModelSchema.safeParse(replayProjection);
  if (!parsed.success) {
    notes.add("replay_projection_schema_rejected");
    failedGuards.add("no_graph_execution_affordance");
  } else if (parsed.data.non_executable !== true) {
    failedGuards.add("no_graph_execution_affordance");
    notes.add("replay_projection_not_non_executable");
  }
  addScannedFailures(
    scanCloseoutPayload(replayProjection, new WeakSet<object>()),
    failedGuards,
    notes,
  );
}

function evaluateGuardState(
  guardState: unknown,
  failedGuards: Set<Phase9FReplayTraceCloseoutGuard>,
  notes: Set<string>,
): void {
  if (Phase9FReplayTraceGuardStateSchema.safeParse(guardState).success) return;
  if (!guardState || typeof guardState !== "object") {
    for (const [, guard] of CAPABILITY_FIELD_TO_GUARD) failedGuards.add(guard);
    notes.add("replay_trace_guard_state_invalid");
    return;
  }

  const record = guardState as Partial<
    Record<Phase9FReplayTraceForbiddenCapabilityField, unknown>
  >;
  for (const [field, guard] of CAPABILITY_FIELD_TO_GUARD) {
    if (record[field] !== false) {
      failedGuards.add(guard);
      notes.add(`forbidden_replay_trace_capability_enabled:${field}`);
    }
  }
}

function mapTraceValidationReason(
  reason: string,
  failedGuards: Set<Phase9FReplayTraceCloseoutGuard>,
): void {
  if (reason === "raw_payload_field_present") {
    failedGuards.add("no_raw_trace_payload");
  }
  if (reason === "executable_payload_field_present") {
    failedGuards.add("no_executable_trace_payload");
  }
  if (reason === "executable_affordance_present") {
    failedGuards.add("no_run_trace_affordance");
    failedGuards.add("no_retry_tool_affordance");
    failedGuards.add("no_approve_or_execute_affordance");
    failedGuards.add("no_rerun_routine_affordance");
  }
  if (
    reason === "replay_not_safe" ||
    reason === "render_not_safe" ||
    reason === "not_non_executable"
  ) {
    failedGuards.add("no_graph_execution_affordance");
  }
}

interface CloseoutPayloadScan {
  guards: Set<Phase9FReplayTraceCloseoutGuard>;
  notes: Set<string>;
}

function scanCloseoutPayload(
  input: unknown,
  seen: WeakSet<object>,
): CloseoutPayloadScan {
  const guards = new Set<Phase9FReplayTraceCloseoutGuard>();
  const notes = new Set<string>();
  if (!input || typeof input !== "object") return { guards, notes };
  if (seen.has(input)) {
    guards.add("no_raw_trace_payload");
    notes.add("replay_trace_closeout_cycle_detected");
    return { guards, notes };
  }
  seen.add(input);

  for (const [key, value] of Object.entries(input)) {
    const mapped = CLOSEOUT_KEY_TO_GUARDS[key];
    if (mapped && value !== false) {
      for (const guard of mapped) guards.add(guard);
      notes.add(`forbidden_replay_trace_field_enabled:${key}`);
    }
    const rawPayloadGuard = rawPayloadGuardForKey(key);
    if (rawPayloadGuard) {
      guards.add(rawPayloadGuard);
      notes.add(`forbidden_projection_field:${key}`);
    }
    if (
      (TRACE_RECORD_EXECUTABLE_PAYLOAD_FIELDS as readonly string[]).includes(
        key,
      )
    ) {
      guards.add("no_executable_trace_payload");
      notes.add(`executable_trace_payload_field:${key}`);
    }
    const nested = scanCloseoutPayload(value, seen);
    addScannedFailures(nested, guards, notes);
  }
  return { guards, notes };
}

function addScannedFailures(
  scan: CloseoutPayloadScan,
  failedGuards: Set<Phase9FReplayTraceCloseoutGuard>,
  notes: Set<string>,
): void {
  for (const guard of scan.guards) failedGuards.add(guard);
  for (const note of scan.notes) notes.add(note);
}

function rawPayloadGuardForKey(
  key: string,
): Phase9FReplayTraceCloseoutGuard | null {
  if (
    !(
      COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES as readonly string[]
    ).includes(key)
  ) {
    return null;
  }
  if (key.includes("tool_arg") || key.includes("tool_argument")) {
    return "no_tool_args_projection";
  }
  if (key.includes("prompt")) return "no_prompt_projection";
  if (key.includes("model_output")) return "no_model_output_projection";
  if (
    key.includes("ocr") ||
    key.includes("frame") ||
    key.includes("screenshot")
  ) {
    return "no_ocr_or_frame_projection";
  }
  if (key.includes("voice") || key.includes("audio")) {
    return "no_voice_or_audio_projection";
  }
  if (key.includes("project") || key.includes("memory")) {
    return "no_project_or_memory_projection";
  }
  if (
    key.includes("secret") ||
    key.includes("api_key") ||
    key.includes("token") ||
    key.includes("pii") ||
    key.includes("password")
  ) {
    return "no_secret_or_pii_projection";
  }
  return "no_raw_trace_payload";
}

const CLOSEOUT_KEY_TO_GUARDS: Readonly<
  Record<string, readonly Phase9FReplayTraceCloseoutGuard[]>
> = {
  run_affordance_allowed: ["no_run_trace_affordance"],
  replay_affordance_allowed: ["no_run_trace_affordance"],
  retry_affordance_allowed: ["no_retry_tool_affordance"],
  execute_affordance_allowed: ["no_approve_or_execute_affordance"],
  approve_affordance_allowed: ["no_approve_or_execute_affordance"],
  rerun_affordance_allowed: ["no_rerun_routine_affordance"],
  tool_actions_allowed: ["no_approve_or_execute_affordance"],
  routine_actions_allowed: ["no_rerun_routine_affordance"],
  approval_actions_allowed: ["no_approve_or_execute_affordance"],
  graph_execution_allowed: ["no_graph_execution_affordance"],
  replay_execution_allowed: ["no_graph_execution_affordance"],
  raw_payloads_included: ["no_raw_trace_payload"],
  trace_ingestion_runtime_allowed: ["no_trace_ingestion_runtime"],
  db_reads_allowed: ["no_db_or_telemetry_reads"],
  telemetry_reads_allowed: ["no_db_or_telemetry_reads"],
  run_trace: ["no_run_trace_affordance"],
  retry_trace: ["no_retry_tool_affordance"],
  retry: ["no_retry_tool_affordance"],
  rerun_routine: ["no_rerun_routine_affordance"],
  approve: ["no_approve_or_execute_affordance"],
  execute: ["no_approve_or_execute_affordance"],
  execute_tool: ["no_approve_or_execute_affordance"],
  graph_execute: ["no_graph_execution_affordance"],
  ...Object.fromEntries(
    COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS.map((field) => [
      field,
      ["no_approve_or_execute_affordance"] as const,
    ]),
  ),
};

const CAPABILITY_FIELD_TO_GUARD: ReadonlyArray<
  [Phase9FReplayTraceForbiddenCapabilityField, Phase9FReplayTraceCloseoutGuard]
> = [
  ["executable_trace_payloads_allowed", "no_executable_trace_payload"],
  ["raw_trace_payloads_allowed", "no_raw_trace_payload"],
  ["tool_args_projection_enabled", "no_tool_args_projection"],
  ["prompt_projection_enabled", "no_prompt_projection"],
  ["model_output_projection_enabled", "no_model_output_projection"],
  ["ocr_or_frame_projection_enabled", "no_ocr_or_frame_projection"],
  ["voice_or_audio_projection_enabled", "no_voice_or_audio_projection"],
  ["project_or_memory_projection_enabled", "no_project_or_memory_projection"],
  ["secret_or_pii_projection_enabled", "no_secret_or_pii_projection"],
  ["run_trace_affordance_enabled", "no_run_trace_affordance"],
  ["retry_tool_affordance_enabled", "no_retry_tool_affordance"],
  ["rerun_routine_affordance_enabled", "no_rerun_routine_affordance"],
  ["approve_or_execute_affordance_enabled", "no_approve_or_execute_affordance"],
  ["graph_execution_enabled", "no_graph_execution_affordance"],
  ["trace_ingestion_runtime_enabled", "no_trace_ingestion_runtime"],
  ["db_reads_enabled", "no_db_or_telemetry_reads"],
  ["telemetry_reads_enabled", "no_db_or_telemetry_reads"],
];
