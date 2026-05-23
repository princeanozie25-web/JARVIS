import { z } from "zod";

import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import {
  DEFAULT_DEMO_MODE_ISOLATION_POLICY,
  DEMO_MODE_DATASET_PROFILES,
  createDefaultDemoModeDataSource,
  validateDemoModeDataSource,
  validateDemoModeIsolationPolicy,
  type DemoModeDatasetProfile,
} from "./demo-mode";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";
import {
  SYNTHETIC_DEMO_FORBIDDEN_LIVE_REFERENCE_FIELDS,
  SyntheticDemoDatasetSchema,
  deriveSyntheticDemoDatasetFromDemoModeDataSource,
  validateSyntheticDemoDataset,
} from "./synthetic-demo-dataset";

export const RECRUITER_PRESENTATION_PROFILES = [
  "recruiter_walkthrough",
  "governance_showcase",
  "failure_replay_demo",
  "portfolio_default",
  "safe_empty",
] as const satisfies readonly DemoModeDatasetProfile[];

export const RECRUITER_PRESENTATION_SUMMARY_CLASSES = [
  "safe_empty",
  "resting",
  "nominal",
  "guarded",
  "degraded",
  "replay_ready",
  "graph_ready",
  "dependency_ready",
  "unknown",
] as const;

export const RECRUITER_PRESENTATION_VALIDATION_REASONS = [
  "recruiter_presentation_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "live_or_real_source_marker_present",
  "developer_console_exposed",
  "raw_metadata_tables_exposed",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "unknown_profile",
  "invalid_source_kind",
  "badge_missing",
  "render_not_safe",
  "replay_not_safe",
  "not_non_executable",
] as const;

export const PHASE_9I_DEMO_MODE_CLOSEOUT_GUARDS = [
  "no_live_audit_db_access",
  "no_live_telemetry_access",
  "no_user_project_data",
  "no_real_suggestions",
  "no_real_traces",
  "no_real_frames_or_voice",
  "no_secrets_or_exact_pii",
  "no_writes_to_real_audit_db",
  "no_developer_console_in_recruiter_view",
  "no_raw_metadata_tables_in_recruiter_view",
  "no_execution_affordance",
  "no_remote_dashboard",
  "badge_always_visible",
] as const;

export const PHASE_9I_DEMO_MODE_FORBIDDEN_CAPABILITY_FIELDS = [
  "live_audit_db_access_enabled",
  "live_telemetry_access_enabled",
  "user_project_data_enabled",
  "real_suggestions_enabled",
  "real_traces_enabled",
  "real_frames_or_voice_enabled",
  "secrets_or_exact_pii_enabled",
  "writes_to_real_audit_db_enabled",
  "developer_console_in_recruiter_view_enabled",
  "raw_metadata_tables_in_recruiter_view_enabled",
  "execution_affordance_enabled",
  "remote_dashboard_enabled",
  "badge_always_visible",
] as const;

export const PHASE_9I_DEMO_MODE_CLOSEOUT_VERDICTS = ["pass", "fail"] as const;

export const RecruiterPresentationProfileSchema = z.enum(
  RECRUITER_PRESENTATION_PROFILES,
);
export const RecruiterPresentationSummaryClassSchema = z.enum(
  RECRUITER_PRESENTATION_SUMMARY_CLASSES,
);
export const RecruiterPresentationValidationReasonSchema = z.enum(
  RECRUITER_PRESENTATION_VALIDATION_REASONS,
);
export const Phase9IDemoModeCloseoutGuardSchema = z.enum(
  PHASE_9I_DEMO_MODE_CLOSEOUT_GUARDS,
);
export const Phase9IDemoModeForbiddenCapabilityFieldSchema = z.enum(
  PHASE_9I_DEMO_MODE_FORBIDDEN_CAPABILITY_FIELDS,
);
export const Phase9IDemoModeCloseoutVerdictSchema = z.enum(
  PHASE_9I_DEMO_MODE_CLOSEOUT_VERDICTS,
);

const RecruiterPresentationSummarySchema = z.strictObject({
  section_id: z.enum([
    "rest_orb_summary",
    "audit_replay_summary",
    "boundary_graph_summary",
    "runtime_dependency_summary",
  ]),
  visible: z.literal(true),
  summary_class: RecruiterPresentationSummaryClassSchema,
  badge_required: z.literal(true),
  render_safe: z.literal(true),
  replay_safe: z.literal(true),
  non_executable: z.literal(true),
  metadata_only: z.literal(true),
  curated_summary_only: z.literal(true),
  raw_metadata_table_included: z.literal(false),
  developer_console_included: z.literal(false),
  authority_surface: z.literal(false),
});

export const RecruiterPresentationViewModelSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.recruiter_presentation_view_model"),
    phase: z.literal("9I3"),
    presentation_id: z.string().trim().min(1).max(160),
    profile: RecruiterPresentationProfileSchema,
    generated_at: z.number().int().nonnegative(),
    source_kind: z.literal("synthetic_build_time_dataset"),
    badge_required: z.literal(true),
    demo_badge_label: z.string().trim().min(1).max(80),
    render_safe: z.literal(true),
    replay_safe: z.literal(true),
    non_executable: z.literal(true),
    show_rest_orb_summary: RecruiterPresentationSummarySchema.extend({
      section_id: z.literal("rest_orb_summary"),
    }),
    show_audit_replay_summary: RecruiterPresentationSummarySchema.extend({
      section_id: z.literal("audit_replay_summary"),
    }),
    show_boundary_graph_summary: RecruiterPresentationSummarySchema.extend({
      section_id: z.literal("boundary_graph_summary"),
    }),
    show_runtime_dependency_summary: RecruiterPresentationSummarySchema.extend({
      section_id: z.literal("runtime_dependency_summary"),
    }),
    hide_developer_console: z.literal(true),
    hide_raw_metadata_tables: z.literal(true),
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    metadata_only: z.literal(true),
    synthetic_only: z.literal(true),
    curated_only: z.literal(true),
    working_cockpit_raw_tables_included: z.literal(false),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    authority_surface: z.literal(false),
    callbacks_allowed: z.literal(false),
    event_handlers_allowed: z.literal(false),
    run_affordance_allowed: z.literal(false),
    retry_affordance_allowed: z.literal(false),
    approve_affordance_allowed: z.literal(false),
    execute_affordance_allowed: z.literal(false),
    mutate_affordance_allowed: z.literal(false),
    graph_execution_allowed: z.literal(false),
    remote_dashboard_allowed: z.literal(false),
    developer_console_allowed: z.literal(false),
    raw_metadata_tables_allowed: z.literal(false),
  });

export const RecruiterPresentationValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(RecruiterPresentationValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    synthetic_only: z.boolean(),
    curated_only: z.boolean(),
    render_safe: z.boolean(),
    replay_safe: z.boolean(),
    non_executable: z.boolean(),
    badge_required: z.boolean(),
    developer_console_hidden: z.boolean(),
    raw_metadata_tables_hidden: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export const Phase9IDemoModeGuardStateSchema = z.strictObject({
  live_audit_db_access_enabled: z.literal(false),
  live_telemetry_access_enabled: z.literal(false),
  user_project_data_enabled: z.literal(false),
  real_suggestions_enabled: z.literal(false),
  real_traces_enabled: z.literal(false),
  real_frames_or_voice_enabled: z.literal(false),
  secrets_or_exact_pii_enabled: z.literal(false),
  writes_to_real_audit_db_enabled: z.literal(false),
  developer_console_in_recruiter_view_enabled: z.literal(false),
  raw_metadata_tables_in_recruiter_view_enabled: z.literal(false),
  execution_affordance_enabled: z.literal(false),
  remote_dashboard_enabled: z.literal(false),
  badge_always_visible: z.literal(true),
});

export const Phase9IDemoModeCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9i_demo_mode_closeout_report"),
  verdict: Phase9IDemoModeCloseoutVerdictSchema,
  checked_guards: z.array(Phase9IDemoModeCloseoutGuardSchema),
  failed_guards: z.array(Phase9IDemoModeCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9i_demo_portfolio_mode_scaffold"),
  metadata_only: z.literal(true),
  synthetic_only: z.literal(true),
  curated_only: z.literal(true),
  render_safe: z.boolean(),
  replay_safe: z.boolean(),
  non_executable: z.literal(true),
  badge_required: z.literal(true),
  developer_console_hidden: z.literal(true),
  raw_metadata_tables_hidden: z.literal(true),
  live_data_access_allowed: z.literal(false),
  writes_allowed: z.literal(false),
  remote_sync_allowed: z.literal(false),
  remote_dashboard_allowed: z.literal(false),
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

export type RecruiterPresentationProfile = z.infer<
  typeof RecruiterPresentationProfileSchema
>;
export type RecruiterPresentationSummaryClass = z.infer<
  typeof RecruiterPresentationSummaryClassSchema
>;
export type RecruiterPresentationValidationReason = z.infer<
  typeof RecruiterPresentationValidationReasonSchema
>;
export type RecruiterPresentationViewModel = z.infer<
  typeof RecruiterPresentationViewModelSchema
>;
export type RecruiterPresentationValidation = z.infer<
  typeof RecruiterPresentationValidationSchema
>;
export type Phase9IDemoModeCloseoutGuard = z.infer<
  typeof Phase9IDemoModeCloseoutGuardSchema
>;
export type Phase9IDemoModeForbiddenCapabilityField = z.infer<
  typeof Phase9IDemoModeForbiddenCapabilityFieldSchema
>;
export type Phase9IDemoModeCloseoutVerdict = z.infer<
  typeof Phase9IDemoModeCloseoutVerdictSchema
>;
export type Phase9IDemoModeGuardState = z.infer<
  typeof Phase9IDemoModeGuardStateSchema
>;
export type Phase9IDemoModeCloseoutReport = z.infer<
  typeof Phase9IDemoModeCloseoutReportSchema
>;

export interface Phase9IDemoModeCloseoutInput {
  dataSource?: unknown;
  isolationPolicy?: unknown;
  dataset?: unknown;
  presentation?: unknown;
  derivedPresentation?: unknown;
  guardState?: unknown;
}

export const DEFAULT_PHASE_9I_DEMO_MODE_GUARD_STATE: Phase9IDemoModeGuardState =
  Phase9IDemoModeGuardStateSchema.parse({
    live_audit_db_access_enabled: false,
    live_telemetry_access_enabled: false,
    user_project_data_enabled: false,
    real_suggestions_enabled: false,
    real_traces_enabled: false,
    real_frames_or_voice_enabled: false,
    secrets_or_exact_pii_enabled: false,
    writes_to_real_audit_db_enabled: false,
    developer_console_in_recruiter_view_enabled: false,
    raw_metadata_tables_in_recruiter_view_enabled: false,
    execution_affordance_enabled: false,
    remote_dashboard_enabled: false,
    badge_always_visible: true,
  });

export function createDefaultRecruiterPresentationViewModel(
  profile: RecruiterPresentationProfile = "safe_empty",
): RecruiterPresentationViewModel {
  const safeProfile = RecruiterPresentationProfileSchema.safeParse(profile)
    .success
    ? profile
    : "safe_empty";
  return createRecruiterPresentationForProfile(safeProfile);
}

export function deriveRecruiterPresentationFromSyntheticDataset(
  input: unknown,
): RecruiterPresentationViewModel {
  const validation = validateSyntheticDemoDataset(input);
  const parsed = SyntheticDemoDatasetSchema.safeParse(input);
  if (!validation.passed || !parsed.success) {
    return createDefaultRecruiterPresentationViewModel("safe_empty");
  }
  const dataset = parsed.data;
  return RecruiterPresentationViewModelSchema.parse({
    ...createRecruiterPresentationForProfile(dataset.profile),
    presentation_id: `recruiter_presentation:${dataset.profile}`,
    profile: dataset.profile,
    generated_at: dataset.generated_at,
    show_rest_orb_summary: summaryFor(
      "rest_orb_summary",
      restSummaryClass(dataset.rest_state.orb_state.governance_posture),
    ),
    show_audit_replay_summary: summaryFor(
      "audit_replay_summary",
      dataset.audit_replay.replay_safe ? "replay_ready" : "safe_empty",
    ),
    show_boundary_graph_summary: summaryFor(
      "boundary_graph_summary",
      dataset.governance_boundary.incident_count > 0
        ? "guarded"
        : "graph_ready",
    ),
    show_runtime_dependency_summary: summaryFor(
      "runtime_dependency_summary",
      dataset.runtime_dependency.edges.length > 0
        ? "dependency_ready"
        : "safe_empty",
    ),
    withheld_fields: dataset.withheld_fields,
    truncated: dataset.truncated,
  });
}

export function validateRecruiterPresentationViewModel(
  input: unknown,
): RecruiterPresentationValidation {
  const parsed = RecruiterPresentationViewModelSchema.safeParse(input);
  const scan = scanRecruiterPresentation(input, [], new WeakSet<object>());
  const reasons = new Set<RecruiterPresentationValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.liveReferenceFields.length > 0)
    reasons.add("live_or_real_source_marker_present");
  if (readBooleanField(input, "hide_developer_console") !== true)
    reasons.add("developer_console_exposed");
  if (readBooleanField(input, "hide_raw_metadata_tables") !== true)
    reasons.add("raw_metadata_tables_exposed");
  if (scan.executableFields.length > 0)
    reasons.add("executable_affordance_present");
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (hasUnknownProfile(input)) reasons.add("unknown_profile");
  if (readField(input, "source_kind") !== "synthetic_build_time_dataset") {
    reasons.add("invalid_source_kind");
  }
  if (readBooleanField(input, "badge_required") !== true)
    reasons.add("badge_missing");
  if (readBooleanField(input, "render_safe") !== true)
    reasons.add("render_not_safe");
  if (readBooleanField(input, "replay_safe") !== true)
    reasons.add("replay_not_safe");
  if (readBooleanField(input, "non_executable") !== true)
    reasons.add("not_non_executable");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.liveReferenceFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return RecruiterPresentationValidationSchema.parse({
    passed,
    reasons: passed ? ["recruiter_presentation_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes:
      notes.size > 0
        ? [...notes]
        : ["recruiter_presentation_curated_synthetic_only"],
    metadata_only: true,
    synthetic_only:
      readField(input, "source_kind") === "synthetic_build_time_dataset",
    curated_only: readBooleanField(input, "curated_only") === true,
    render_safe: passed,
    replay_safe: passed,
    non_executable: passed,
    badge_required: readBooleanField(input, "badge_required") === true,
    developer_console_hidden:
      readBooleanField(input, "hide_developer_console") === true,
    raw_metadata_tables_hidden:
      readBooleanField(input, "hide_raw_metadata_tables") === true,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function createPhase9IDemoModeCloseoutReport(
  input: Phase9IDemoModeCloseoutInput = {},
): Phase9IDemoModeCloseoutReport {
  const failedGuards = new Set<Phase9IDemoModeCloseoutGuard>();
  const notes = new Set<string>();
  const dataSource = input.dataSource ?? createDefaultDemoModeDataSource();
  const isolationPolicy =
    input.isolationPolicy ?? DEFAULT_DEMO_MODE_ISOLATION_POLICY;
  const dataset =
    input.dataset ??
    deriveSyntheticDemoDatasetFromDemoModeDataSource(dataSource);
  const presentation =
    input.presentation ?? createDefaultRecruiterPresentationViewModel();
  const derivedPresentation =
    input.derivedPresentation ??
    deriveRecruiterPresentationFromSyntheticDataset(dataset);

  evaluateDataSource(dataSource, failedGuards, notes);
  evaluateIsolationPolicy(isolationPolicy, failedGuards, notes);
  evaluateDataset(dataset, failedGuards, notes);
  evaluatePresentation(presentation, failedGuards, notes);
  evaluatePresentation(derivedPresentation, failedGuards, notes);
  evaluateGuardState(
    input.guardState ?? DEFAULT_PHASE_9I_DEMO_MODE_GUARD_STATE,
    failedGuards,
    notes,
  );

  if (failedGuards.size === 0) {
    notes.add("phase_9i_demo_portfolio_mode_synthetic_curated_only");
  }

  return Phase9IDemoModeCloseoutReportSchema.parse({
    kind: "command_center.phase_9i_demo_mode_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9I_DEMO_MODE_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    notes: [...notes],
    generated_from: "phase_9i_demo_portfolio_mode_scaffold",
    metadata_only: true,
    synthetic_only: true,
    curated_only: true,
    render_safe: failedGuards.size === 0,
    replay_safe: failedGuards.size === 0,
    non_executable: true,
    badge_required: true,
    developer_console_hidden: true,
    raw_metadata_tables_hidden: true,
    live_data_access_allowed: false,
    writes_allowed: false,
    remote_sync_allowed: false,
    remote_dashboard_allowed: false,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function createRecruiterPresentationForProfile(
  profile: RecruiterPresentationProfile,
): RecruiterPresentationViewModel {
  return RecruiterPresentationViewModelSchema.parse({
    kind: "command_center.recruiter_presentation_view_model",
    phase: "9I3",
    presentation_id: `recruiter_presentation:${profile}`,
    profile,
    generated_at: 0,
    source_kind: "synthetic_build_time_dataset",
    badge_required: true,
    demo_badge_label: "Synthetic demo",
    render_safe: true,
    replay_safe: true,
    non_executable: true,
    show_rest_orb_summary: summaryFor("rest_orb_summary", "resting"),
    show_audit_replay_summary: summaryFor(
      "audit_replay_summary",
      profile === "failure_replay_demo" ? "replay_ready" : "safe_empty",
    ),
    show_boundary_graph_summary: summaryFor(
      "boundary_graph_summary",
      profile === "governance_showcase" ? "graph_ready" : "safe_empty",
    ),
    show_runtime_dependency_summary: summaryFor(
      "runtime_dependency_summary",
      "dependency_ready",
    ),
    hide_developer_console: true,
    hide_raw_metadata_tables: true,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      ...SYNTHETIC_DEMO_FORBIDDEN_LIVE_REFERENCE_FIELDS,
    ],
    truncated: false,
    metadata_only: true,
    synthetic_only: true,
    curated_only: true,
    working_cockpit_raw_tables_included: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    run_affordance_allowed: false,
    retry_affordance_allowed: false,
    approve_affordance_allowed: false,
    execute_affordance_allowed: false,
    mutate_affordance_allowed: false,
    graph_execution_allowed: false,
    remote_dashboard_allowed: false,
    developer_console_allowed: false,
    raw_metadata_tables_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function summaryFor(
  sectionId: z.infer<typeof RecruiterPresentationSummarySchema>["section_id"],
  summaryClass: RecruiterPresentationSummaryClass,
): z.infer<typeof RecruiterPresentationSummarySchema> {
  return RecruiterPresentationSummarySchema.parse({
    section_id: sectionId,
    visible: true,
    summary_class: summaryClass,
    badge_required: true,
    render_safe: true,
    replay_safe: true,
    non_executable: true,
    metadata_only: true,
    curated_summary_only: true,
    raw_metadata_table_included: false,
    developer_console_included: false,
    authority_surface: false,
  });
}

function restSummaryClass(posture: string): RecruiterPresentationSummaryClass {
  if (posture === "guarded" || posture === "locked") return "guarded";
  if (posture === "normal") return "nominal";
  return "resting";
}

function evaluateDataSource(
  dataSource: unknown,
  failedGuards: Set<Phase9IDemoModeCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateDemoModeDataSource(dataSource);
  if (!validation.passed) {
    notes.add("demo_mode_data_source_validation_failed");
    failedGuards.add("no_live_audit_db_access");
    failedGuards.add("no_live_telemetry_access");
    if (validation.writes_allowed)
      failedGuards.add("no_writes_to_real_audit_db");
    if (validation.remote_sync_allowed) failedGuards.add("no_remote_dashboard");
    if (!validation.badge_required) failedGuards.add("badge_always_visible");
  }
}

function evaluateIsolationPolicy(
  isolationPolicy: unknown,
  failedGuards: Set<Phase9IDemoModeCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateDemoModeIsolationPolicy(isolationPolicy);
  if (validation.passed) return;
  notes.add("demo_mode_isolation_policy_validation_failed");
  for (const invariant of validation.failed_invariants) {
    const guard = ISOLATION_INVARIANT_TO_GUARD[invariant];
    if (guard) failedGuards.add(guard);
  }
}

function evaluateDataset(
  dataset: unknown,
  failedGuards: Set<Phase9IDemoModeCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateSyntheticDemoDataset(dataset);
  if (!validation.passed) {
    notes.add("synthetic_demo_dataset_validation_failed");
    failedGuards.add("no_live_audit_db_access");
    failedGuards.add("no_live_telemetry_access");
    failedGuards.add("no_user_project_data");
    failedGuards.add("no_real_suggestions");
    failedGuards.add("no_real_traces");
    failedGuards.add("no_real_frames_or_voice");
    failedGuards.add("no_secrets_or_exact_pii");
    if (!validation.badge_required) failedGuards.add("badge_always_visible");
  }
}

function evaluatePresentation(
  presentation: unknown,
  failedGuards: Set<Phase9IDemoModeCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateRecruiterPresentationViewModel(presentation);
  if (!validation.passed) {
    notes.add("recruiter_presentation_validation_failed");
    if (!validation.developer_console_hidden) {
      failedGuards.add("no_developer_console_in_recruiter_view");
    }
    if (!validation.raw_metadata_tables_hidden) {
      failedGuards.add("no_raw_metadata_tables_in_recruiter_view");
    }
    if (!validation.badge_required) failedGuards.add("badge_always_visible");
    for (const reason of validation.reasons) {
      if (reason === "executable_affordance_present") {
        failedGuards.add("no_execution_affordance");
      }
      if (
        reason === "raw_payload_field_present" ||
        reason === "live_or_real_source_marker_present"
      ) {
        failedGuards.add("no_secrets_or_exact_pii");
      }
    }
  }
}

function evaluateGuardState(
  guardState: unknown,
  failedGuards: Set<Phase9IDemoModeCloseoutGuard>,
  notes: Set<string>,
): void {
  if (Phase9IDemoModeGuardStateSchema.safeParse(guardState).success) return;
  if (!guardState || typeof guardState !== "object") {
    for (const [, guard] of CAPABILITY_FIELD_TO_GUARD) failedGuards.add(guard);
    notes.add("demo_mode_guard_state_invalid");
    return;
  }
  const record = guardState as Partial<
    Record<Phase9IDemoModeForbiddenCapabilityField, unknown>
  >;
  for (const [field, guard] of CAPABILITY_FIELD_TO_GUARD) {
    const expected = field === "badge_always_visible" ? true : false;
    if (record[field] !== expected) {
      failedGuards.add(guard);
      notes.add(`forbidden_demo_mode_capability_enabled:${field}`);
    }
  }
}

interface RecruiterPresentationScanResult {
  rawPayloadFields: string[];
  liveReferenceFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanRecruiterPresentation(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): RecruiterPresentationScanResult {
  const result: RecruiterPresentationScanResult = {
    rawPayloadFields: [],
    liveReferenceFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("recruiter_presentation_missing");
    return result;
  }
  if (
    typeof input === "function" ||
    typeof input === "symbol" ||
    typeof input === "bigint"
  ) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable:${path.join(".") || "root"}`);
    return result;
  }
  if (input === null || typeof input !== "object") return result;
  if (seen.has(input)) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable_cycle:${path.join(".") || "root"}`);
    return result;
  }
  seen.add(input);
  if (
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    result.unsafeShape = true;
    result.notes.push(`unsafe_object:${path.join(".") || "root"}`);
    return result;
  }

  const entries = Array.isArray(input)
    ? input.map((value, index) => [String(index), value] as const)
    : Object.entries(input);
  for (const [key, value] of entries) {
    if (isForbiddenRawPayloadField(key)) {
      result.rawPayloadFields.push([...path, key].join("."));
    }
    if (isForbiddenLiveReferenceField(key)) {
      result.liveReferenceFields.push([...path, key].join("."));
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push([...path, key].join("."));
    }
    const child = scanRecruiterPresentation(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.liveReferenceFields.push(...child.liveReferenceFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function hasUnknownProfile(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const profile = (input as { profile?: unknown }).profile;
  return (
    profile !== undefined &&
    !(DEMO_MODE_DATASET_PROFILES as readonly unknown[]).includes(profile)
  );
}

function isForbiddenRawPayloadField(key: string): boolean {
  return (
    COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES as readonly string[]
  ).includes(key);
}

function isForbiddenLiveReferenceField(key: string): boolean {
  return (
    SYNTHETIC_DEMO_FORBIDDEN_LIVE_REFERENCE_FIELDS as readonly string[]
  ).includes(key);
}

function isExecutableAffordanceKey(key: string, value: unknown): boolean {
  if (
    key === "run_affordance_allowed" ||
    key === "retry_affordance_allowed" ||
    key === "approve_affordance_allowed" ||
    key === "execute_affordance_allowed" ||
    key === "mutate_affordance_allowed" ||
    key === "graph_execution_allowed" ||
    key === "remote_dashboard_allowed" ||
    key === "developer_console_allowed" ||
    key === "raw_metadata_tables_allowed"
  ) {
    return value !== false;
  }
  if (
    key === "working_cockpit_raw_tables_included" ||
    key === "developer_console_included" ||
    key === "raw_metadata_table_included"
  ) {
    return value !== false;
  }
  return (
    [
      ...AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS,
      ...COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
      "approve_button",
      "retry_button",
      "run_button",
      "execute_button",
      "mutate_button",
      "graph_execute",
      "developer_console",
      "raw_metadata_table",
    ] as readonly string[]
  ).includes(key);
}

function readField(input: unknown, field: string): unknown {
  if (!input || typeof input !== "object") return undefined;
  return (input as Record<string, unknown>)[field];
}

function readBooleanField(input: unknown, field: string): boolean | undefined {
  const value = readField(input, field);
  return typeof value === "boolean" ? value : undefined;
}

const ISOLATION_INVARIANT_TO_GUARD: Record<
  string,
  Phase9IDemoModeCloseoutGuard
> = {
  no_live_audit_db_access: "no_live_audit_db_access",
  no_live_telemetry_access: "no_live_telemetry_access",
  no_user_project_data: "no_user_project_data",
  no_real_suggestions: "no_real_suggestions",
  no_real_traces: "no_real_traces",
  no_real_frames_or_voice: "no_real_frames_or_voice",
  no_secrets_or_exact_pii: "no_secrets_or_exact_pii",
  no_writes_to_real_audit_db: "no_writes_to_real_audit_db",
  badge_always_visible: "badge_always_visible",
};

const CAPABILITY_FIELD_TO_GUARD: ReadonlyArray<
  [Phase9IDemoModeForbiddenCapabilityField, Phase9IDemoModeCloseoutGuard]
> = [
  ["live_audit_db_access_enabled", "no_live_audit_db_access"],
  ["live_telemetry_access_enabled", "no_live_telemetry_access"],
  ["user_project_data_enabled", "no_user_project_data"],
  ["real_suggestions_enabled", "no_real_suggestions"],
  ["real_traces_enabled", "no_real_traces"],
  ["real_frames_or_voice_enabled", "no_real_frames_or_voice"],
  ["secrets_or_exact_pii_enabled", "no_secrets_or_exact_pii"],
  ["writes_to_real_audit_db_enabled", "no_writes_to_real_audit_db"],
  [
    "developer_console_in_recruiter_view_enabled",
    "no_developer_console_in_recruiter_view",
  ],
  [
    "raw_metadata_tables_in_recruiter_view_enabled",
    "no_raw_metadata_tables_in_recruiter_view",
  ],
  ["execution_affordance_enabled", "no_execution_affordance"],
  ["remote_dashboard_enabled", "no_remote_dashboard"],
  ["badge_always_visible", "badge_always_visible"],
];
