import { z } from "zod";

import {
  createDefaultAuditTraceTimelineViewModel,
  validateAuditTraceTimelineViewModel,
} from "./audit-trace-timeline";
import {
  createDefaultAuditReplayViewerViewModel,
  validateAuditReplayViewerViewModel,
} from "./audit-replay-viewer";
import {
  createDefaultGovernanceBoundaryViewerViewModel,
  validateGovernanceBoundaryViewerViewModel,
} from "./audit-governance-boundary";
import {
  RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
  createDefaultRuntimeDependencyViewerViewModel,
  validateRuntimeDependencyViewerViewModel,
} from "./audit-runtime-dependency";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";

export const PHASE_9E_AUDIT_SCREEN_CLOSEOUT_GUARDS = [
  "no_run_trace_affordance",
  "no_retry_tool_affordance",
  "no_rerun_routine_affordance",
  "no_approve_or_deny_affordance",
  "no_tool_execution_affordance",
  "no_graph_execution_affordance",
  "no_source_code_rendering",
  "no_raw_payload_rendering",
  "no_live_code_introspection",
  "no_db_write_access",
  "no_telemetry_write_access",
  "no_remote_dashboard_access",
  "no_export_unredacted_affordance",
] as const;

export const PHASE_9E_AUDIT_SCREEN_FORBIDDEN_AFFORDANCE_FIELDS = [
  "run_trace_affordance_enabled",
  "retry_tool_affordance_enabled",
  "rerun_routine_affordance_enabled",
  "approve_or_deny_affordance_enabled",
  "tool_execution_affordance_enabled",
  "graph_execution_affordance_enabled",
  "source_code_rendering_enabled",
  "raw_payload_rendering_enabled",
  "live_code_introspection_enabled",
  "db_write_access_enabled",
  "telemetry_write_access_enabled",
  "remote_dashboard_access_enabled",
  "export_unredacted_affordance_enabled",
] as const;

export const PHASE_9E_AUDIT_SCREEN_CLOSEOUT_VERDICTS = [
  "pass",
  "fail",
] as const;

export const Phase9EAuditScreenCloseoutGuardSchema = z.enum(
  PHASE_9E_AUDIT_SCREEN_CLOSEOUT_GUARDS,
);
export const Phase9EAuditScreenForbiddenAffordanceFieldSchema = z.enum(
  PHASE_9E_AUDIT_SCREEN_FORBIDDEN_AFFORDANCE_FIELDS,
);
export const Phase9EAuditScreenCloseoutVerdictSchema = z.enum(
  PHASE_9E_AUDIT_SCREEN_CLOSEOUT_VERDICTS,
);

export const Phase9EAuditScreenGuardStateSchema = z.strictObject({
  run_trace_affordance_enabled: z.literal(false),
  retry_tool_affordance_enabled: z.literal(false),
  rerun_routine_affordance_enabled: z.literal(false),
  approve_or_deny_affordance_enabled: z.literal(false),
  tool_execution_affordance_enabled: z.literal(false),
  graph_execution_affordance_enabled: z.literal(false),
  source_code_rendering_enabled: z.literal(false),
  raw_payload_rendering_enabled: z.literal(false),
  live_code_introspection_enabled: z.literal(false),
  db_write_access_enabled: z.literal(false),
  telemetry_write_access_enabled: z.literal(false),
  remote_dashboard_access_enabled: z.literal(false),
  export_unredacted_affordance_enabled: z.literal(false),
});

export const Phase9EAuditScreenCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9e_audit_screen_closeout_report"),
  verdict: Phase9EAuditScreenCloseoutVerdictSchema,
  checked_guards: z.array(Phase9EAuditScreenCloseoutGuardSchema),
  failed_guards: z.array(Phase9EAuditScreenCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9e_audit_screen_scaffold"),
  render_only: z.literal(true),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  read_only: z.literal(true),
  render_safe: z.boolean(),
  non_executable: z.literal(true),
  source_code_rendering_allowed: z.literal(false),
  raw_payload_rendering_allowed: z.literal(false),
  graph_execution_allowed: z.literal(false),
  remote_dashboard_allowed: z.literal(false),
  export_unredacted_allowed: z.literal(false),
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

export type Phase9EAuditScreenCloseoutGuard = z.infer<
  typeof Phase9EAuditScreenCloseoutGuardSchema
>;
export type Phase9EAuditScreenForbiddenAffordanceField = z.infer<
  typeof Phase9EAuditScreenForbiddenAffordanceFieldSchema
>;
export type Phase9EAuditScreenCloseoutVerdict = z.infer<
  typeof Phase9EAuditScreenCloseoutVerdictSchema
>;
export type Phase9EAuditScreenGuardState = z.infer<
  typeof Phase9EAuditScreenGuardStateSchema
>;
export type Phase9EAuditScreenCloseoutReport = z.infer<
  typeof Phase9EAuditScreenCloseoutReportSchema
>;

export interface Phase9EAuditScreenCloseoutInput {
  traceTimeline?: unknown;
  replayViewer?: unknown;
  governanceBoundaryViewer?: unknown;
  runtimeDependencyViewer?: unknown;
  guardState?: unknown;
}

export const DEFAULT_PHASE_9E_AUDIT_SCREEN_GUARD_STATE: Phase9EAuditScreenGuardState =
  Phase9EAuditScreenGuardStateSchema.parse({
    run_trace_affordance_enabled: false,
    retry_tool_affordance_enabled: false,
    rerun_routine_affordance_enabled: false,
    approve_or_deny_affordance_enabled: false,
    tool_execution_affordance_enabled: false,
    graph_execution_affordance_enabled: false,
    source_code_rendering_enabled: false,
    raw_payload_rendering_enabled: false,
    live_code_introspection_enabled: false,
    db_write_access_enabled: false,
    telemetry_write_access_enabled: false,
    remote_dashboard_access_enabled: false,
    export_unredacted_affordance_enabled: false,
  });

export function createPhase9EAuditScreenCloseoutReport(
  input: Phase9EAuditScreenCloseoutInput = {},
): Phase9EAuditScreenCloseoutReport {
  const failedGuards = new Set<Phase9EAuditScreenCloseoutGuard>();
  const notes = new Set<string>();

  evaluateViewer(
    "trace_timeline",
    input.traceTimeline ?? createDefaultAuditTraceTimelineViewModel(),
    validateAuditTraceTimelineViewModel,
    failedGuards,
    notes,
  );
  evaluateViewer(
    "replay_viewer",
    input.replayViewer ?? createDefaultAuditReplayViewerViewModel(),
    validateAuditReplayViewerViewModel,
    failedGuards,
    notes,
  );
  evaluateViewer(
    "governance_boundary_viewer",
    input.governanceBoundaryViewer ??
      createDefaultGovernanceBoundaryViewerViewModel(),
    validateGovernanceBoundaryViewerViewModel,
    failedGuards,
    notes,
  );
  evaluateViewer(
    "runtime_dependency_viewer",
    input.runtimeDependencyViewer ??
      createDefaultRuntimeDependencyViewerViewModel(),
    validateRuntimeDependencyViewerViewModel,
    failedGuards,
    notes,
  );
  evaluateGuardState(
    input.guardState ?? DEFAULT_PHASE_9E_AUDIT_SCREEN_GUARD_STATE,
    failedGuards,
    notes,
  );

  if (failedGuards.size === 0) {
    notes.add("phase_9e_audit_screen_scaffold_is_render_only_metadata_only");
  }

  return Phase9EAuditScreenCloseoutReportSchema.parse({
    kind: "command_center.phase_9e_audit_screen_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9E_AUDIT_SCREEN_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    notes: [...notes],
    generated_from: "phase_9e_audit_screen_scaffold",
    render_only: true,
    metadata_only: true,
    redaction_required: true,
    read_only: true,
    render_safe: failedGuards.size === 0,
    non_executable: true,
    source_code_rendering_allowed: false,
    raw_payload_rendering_allowed: false,
    graph_execution_allowed: false,
    remote_dashboard_allowed: false,
    export_unredacted_allowed: false,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function evaluateViewer(
  viewerName: string,
  viewer: unknown,
  validate: (input: unknown) => { passed: boolean; reasons: string[] },
  failedGuards: Set<Phase9EAuditScreenCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validate(viewer);
  const scan = scanAuditCloseoutInput(viewer, new WeakSet<object>());

  addScannedFailures(scan, failedGuards, notes);
  if (!validation.passed) {
    notes.add(`audit_${viewerName}_validation_failed`);
    for (const reason of validation.reasons) {
      addValidationReasonFailures(reason, failedGuards);
    }
  }
}

function evaluateGuardState(
  guardState: unknown,
  failedGuards: Set<Phase9EAuditScreenCloseoutGuard>,
  notes: Set<string>,
): void {
  if (Phase9EAuditScreenGuardStateSchema.safeParse(guardState).success) return;
  if (!guardState || typeof guardState !== "object") {
    for (const [, guard] of FORBIDDEN_AFFORDANCE_FIELD_TO_GUARD) {
      failedGuards.add(guard);
    }
    notes.add("audit_screen_guard_state_invalid");
    return;
  }

  const record = guardState as Partial<
    Record<Phase9EAuditScreenForbiddenAffordanceField, unknown>
  >;
  for (const [field, guard] of FORBIDDEN_AFFORDANCE_FIELD_TO_GUARD) {
    if (record[field] !== false) {
      failedGuards.add(guard);
      notes.add(`forbidden_audit_affordance_enabled:${field}`);
    }
  }
}

function addValidationReasonFailures(
  reason: string,
  failedGuards: Set<Phase9EAuditScreenCloseoutGuard>,
): void {
  if (reason === "raw_payload_field_present") {
    failedGuards.add("no_raw_payload_rendering");
  }
  if (reason === "source_code_field_present") {
    failedGuards.add("no_source_code_rendering");
  }
  if (reason === "executable_affordance_present") {
    failedGuards.add("no_run_trace_affordance");
    failedGuards.add("no_retry_tool_affordance");
    failedGuards.add("no_tool_execution_affordance");
    failedGuards.add("no_graph_execution_affordance");
  }
  if (reason === "not_non_executable") {
    failedGuards.add("no_graph_execution_affordance");
  }
}

function addScannedFailures(
  scan: AuditCloseoutScan,
  failedGuards: Set<Phase9EAuditScreenCloseoutGuard>,
  notes: Set<string>,
): void {
  for (const guard of scan.guards) failedGuards.add(guard);
  for (const note of scan.notes) notes.add(note);
}

interface AuditCloseoutScan {
  guards: Set<Phase9EAuditScreenCloseoutGuard>;
  notes: Set<string>;
}

function scanAuditCloseoutInput(
  input: unknown,
  seen: WeakSet<object>,
): AuditCloseoutScan {
  const guards = new Set<Phase9EAuditScreenCloseoutGuard>();
  const notes = new Set<string>();
  if (!input || typeof input !== "object") return { guards, notes };
  if (seen.has(input)) {
    notes.add("audit_closeout_cycle_detected");
    guards.add("no_raw_payload_rendering");
    return { guards, notes };
  }
  seen.add(input);

  for (const [key, value] of Object.entries(input)) {
    const mapped = CLOSEOUT_KEY_TO_GUARDS[key];
    if (mapped && value !== false) {
      for (const guard of mapped) guards.add(guard);
      notes.add(`forbidden_audit_viewer_field_enabled:${key}`);
    }
    if (key === "non_executable" && value !== true) {
      guards.add("no_graph_execution_affordance");
      notes.add("forbidden_audit_viewer_field_enabled:non_executable");
    }
    if (
      (
        COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES as readonly string[]
      ).includes(key)
    ) {
      guards.add("no_raw_payload_rendering");
      notes.add(`raw_payload_field_present:${key}`);
    }
    if (
      (
        RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS as readonly string[]
      ).includes(key)
    ) {
      guards.add("no_source_code_rendering");
      notes.add(`source_code_field_present:${key}`);
    }
    const nested = scanAuditCloseoutInput(value, seen);
    addScannedFailures(nested, guards, notes);
  }
  return { guards, notes };
}

const CLOSEOUT_KEY_TO_GUARDS: Readonly<
  Record<string, readonly Phase9EAuditScreenCloseoutGuard[]>
> = {
  run_affordance_allowed: ["no_run_trace_affordance"],
  replay_affordance_allowed: ["no_run_trace_affordance"],
  retry_affordance_allowed: ["no_retry_tool_affordance"],
  execute_affordance_allowed: ["no_tool_execution_affordance"],
  tool_actions_allowed: ["no_tool_execution_affordance"],
  routine_actions_allowed: ["no_rerun_routine_affordance"],
  approval_actions_allowed: ["no_approve_or_deny_affordance"],
  approve_affordance_allowed: ["no_approve_or_deny_affordance"],
  graph_execution_allowed: ["no_graph_execution_affordance"],
  raw_payloads_included: ["no_raw_payload_rendering"],
  raw_payload_rendering_allowed: ["no_raw_payload_rendering"],
  implementation_body_included: ["no_source_code_rendering"],
  source_code_rendering_allowed: ["no_source_code_rendering"],
  live_code_introspection_allowed: ["no_live_code_introspection"],
  db_write_access_allowed: ["no_db_write_access"],
  telemetry_write_access_allowed: ["no_telemetry_write_access"],
  remote_dashboard_allowed: ["no_remote_dashboard_access"],
  export_unredacted_allowed: ["no_export_unredacted_affordance"],
};

const FORBIDDEN_AFFORDANCE_FIELD_TO_GUARD: ReadonlyArray<
  [Phase9EAuditScreenForbiddenAffordanceField, Phase9EAuditScreenCloseoutGuard]
> = [
  ["run_trace_affordance_enabled", "no_run_trace_affordance"],
  ["retry_tool_affordance_enabled", "no_retry_tool_affordance"],
  ["rerun_routine_affordance_enabled", "no_rerun_routine_affordance"],
  ["approve_or_deny_affordance_enabled", "no_approve_or_deny_affordance"],
  ["tool_execution_affordance_enabled", "no_tool_execution_affordance"],
  ["graph_execution_affordance_enabled", "no_graph_execution_affordance"],
  ["source_code_rendering_enabled", "no_source_code_rendering"],
  ["raw_payload_rendering_enabled", "no_raw_payload_rendering"],
  ["live_code_introspection_enabled", "no_live_code_introspection"],
  ["db_write_access_enabled", "no_db_write_access"],
  ["telemetry_write_access_enabled", "no_telemetry_write_access"],
  ["remote_dashboard_access_enabled", "no_remote_dashboard_access"],
  ["export_unredacted_affordance_enabled", "no_export_unredacted_affordance"],
];
