import { z } from "zod";

import {
  COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_CLASSES,
  createDefaultCommandCenterPrivacyPolicy,
  validateCommandCenterPayloadPrivacy,
  validateCommandCenterPrivacyPolicy,
} from "./privacy-enforcement";
import {
  RedactionCoverageSummarySchema,
  createDefaultRedactionCoverageMatrix,
  summarizeRedactionCoverageMatrix,
  validateRedactionCoverageMatrix,
  type RedactionCoverageMatrix,
  type RedactionCoverageSummary,
} from "./redaction-coverage-matrix";

export const PHASE_9K_PRIVACY_CLOSEOUT_GUARDS = [
  "no_raw_tool_arguments",
  "no_raw_prompts",
  "no_raw_model_outputs",
  "no_raw_ocr_text",
  "no_raw_screenshots",
  "no_raw_camera_frames",
  "no_raw_frame_thumbnails",
  "no_raw_voice_transcripts",
  "no_raw_audio",
  "no_project_file_bodies",
  "no_document_bodies",
  "no_memory_contents",
  "no_source_code_rendering",
  "no_raw_stack_traces",
  "no_secrets_api_keys_tokens_passwords",
  "no_exact_pii",
  "no_unredacted_suggestion_bodies",
  "no_live_user_data_in_demo",
  "no_remote_dashboard",
  "no_export_unredacted",
  "no_mutating_or_executable_affordances",
] as const;

export const PHASE_9K_PRIVACY_CLOSEOUT_VERDICTS = ["pass", "fail"] as const;

export const PHASE_9K_PRIVACY_FORBIDDEN_CAPABILITY_FIELDS = [
  "raw_tool_arguments_enabled",
  "raw_prompts_enabled",
  "raw_model_outputs_enabled",
  "raw_ocr_text_enabled",
  "raw_screenshots_enabled",
  "raw_camera_frames_enabled",
  "raw_frame_thumbnails_enabled",
  "raw_voice_transcripts_enabled",
  "raw_audio_enabled",
  "project_file_bodies_enabled",
  "document_bodies_enabled",
  "memory_contents_enabled",
  "source_code_rendering_enabled",
  "raw_stack_traces_enabled",
  "secrets_api_keys_tokens_passwords_enabled",
  "exact_pii_enabled",
  "unredacted_suggestion_bodies_enabled",
  "live_user_data_in_demo_enabled",
  "remote_dashboard_enabled",
  "export_unredacted_enabled",
  "mutating_or_executable_affordances_enabled",
] as const;

export const Phase9KPrivacyCloseoutGuardSchema = z.enum(
  PHASE_9K_PRIVACY_CLOSEOUT_GUARDS,
);
export const Phase9KPrivacyCloseoutVerdictSchema = z.enum(
  PHASE_9K_PRIVACY_CLOSEOUT_VERDICTS,
);
export const Phase9KPrivacyForbiddenCapabilityFieldSchema = z.enum(
  PHASE_9K_PRIVACY_FORBIDDEN_CAPABILITY_FIELDS,
);

export const Phase9KPrivacyGuardStateSchema = z.strictObject({
  raw_tool_arguments_enabled: z.literal(false),
  raw_prompts_enabled: z.literal(false),
  raw_model_outputs_enabled: z.literal(false),
  raw_ocr_text_enabled: z.literal(false),
  raw_screenshots_enabled: z.literal(false),
  raw_camera_frames_enabled: z.literal(false),
  raw_frame_thumbnails_enabled: z.literal(false),
  raw_voice_transcripts_enabled: z.literal(false),
  raw_audio_enabled: z.literal(false),
  project_file_bodies_enabled: z.literal(false),
  document_bodies_enabled: z.literal(false),
  memory_contents_enabled: z.literal(false),
  source_code_rendering_enabled: z.literal(false),
  raw_stack_traces_enabled: z.literal(false),
  secrets_api_keys_tokens_passwords_enabled: z.literal(false),
  exact_pii_enabled: z.literal(false),
  unredacted_suggestion_bodies_enabled: z.literal(false),
  live_user_data_in_demo_enabled: z.literal(false),
  remote_dashboard_enabled: z.literal(false),
  export_unredacted_enabled: z.literal(false),
  mutating_or_executable_affordances_enabled: z.literal(false),
});

export const Phase9KPrivacyTelemetryCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9k_privacy_telemetry_closeout_report"),
  verdict: Phase9KPrivacyCloseoutVerdictSchema,
  checked_guards: z.array(Phase9KPrivacyCloseoutGuardSchema),
  failed_guards: z.array(Phase9KPrivacyCloseoutGuardSchema),
  coverage_summary: RedactionCoverageSummarySchema,
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9k_privacy_telemetry_audit_scaffold"),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  render_safe: z.boolean(),
  non_executable: z.literal(true),
  raw_payloads_forbidden: z.literal(true),
  source_code_forbidden: z.literal(true),
  live_user_data_forbidden_in_demo: z.literal(true),
  remote_dashboard_forbidden: z.literal(true),
  export_unredacted_forbidden: z.literal(true),
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

export type Phase9KPrivacyCloseoutGuard = z.infer<
  typeof Phase9KPrivacyCloseoutGuardSchema
>;
export type Phase9KPrivacyCloseoutVerdict = z.infer<
  typeof Phase9KPrivacyCloseoutVerdictSchema
>;
export type Phase9KPrivacyForbiddenCapabilityField = z.infer<
  typeof Phase9KPrivacyForbiddenCapabilityFieldSchema
>;
export type Phase9KPrivacyGuardState = z.infer<
  typeof Phase9KPrivacyGuardStateSchema
>;
export type Phase9KPrivacyTelemetryCloseoutReport = z.infer<
  typeof Phase9KPrivacyTelemetryCloseoutReportSchema
>;

export interface Phase9KPrivacyTelemetryCloseoutInput {
  privacyPolicy?: unknown;
  redactionMatrix?: unknown;
  guardState?: unknown;
  unsafePayloadByGuard?: Partial<Record<Phase9KPrivacyCloseoutGuard, unknown>>;
}

export const DEFAULT_PHASE_9K_PRIVACY_GUARD_STATE: Phase9KPrivacyGuardState =
  Phase9KPrivacyGuardStateSchema.parse({
    raw_tool_arguments_enabled: false,
    raw_prompts_enabled: false,
    raw_model_outputs_enabled: false,
    raw_ocr_text_enabled: false,
    raw_screenshots_enabled: false,
    raw_camera_frames_enabled: false,
    raw_frame_thumbnails_enabled: false,
    raw_voice_transcripts_enabled: false,
    raw_audio_enabled: false,
    project_file_bodies_enabled: false,
    document_bodies_enabled: false,
    memory_contents_enabled: false,
    source_code_rendering_enabled: false,
    raw_stack_traces_enabled: false,
    secrets_api_keys_tokens_passwords_enabled: false,
    exact_pii_enabled: false,
    unredacted_suggestion_bodies_enabled: false,
    live_user_data_in_demo_enabled: false,
    remote_dashboard_enabled: false,
    export_unredacted_enabled: false,
    mutating_or_executable_affordances_enabled: false,
  });

export function createPhase9KPrivacyTelemetryCloseoutReport(
  input: Phase9KPrivacyTelemetryCloseoutInput = {},
): Phase9KPrivacyTelemetryCloseoutReport {
  const failedGuards = new Set<Phase9KPrivacyCloseoutGuard>();
  const notes = new Set<string>();
  const privacyPolicy =
    input.privacyPolicy ?? createDefaultCommandCenterPrivacyPolicy();
  const redactionMatrix =
    input.redactionMatrix ?? createDefaultRedactionCoverageMatrix();
  const coverageSummary = summarizeRedactionCoverageMatrix(redactionMatrix);

  evaluatePrivacyPolicy(privacyPolicy, failedGuards, notes);
  evaluateRedactionMatrix(
    redactionMatrix,
    coverageSummary,
    failedGuards,
    notes,
  );
  evaluateForbiddenPayloadFailClosed(
    input.unsafePayloadByGuard ?? {},
    failedGuards,
    notes,
  );
  evaluateDemoAndRecruiterFailClosed(failedGuards, notes);
  evaluateGuardState(
    input.guardState ?? DEFAULT_PHASE_9K_PRIVACY_GUARD_STATE,
    failedGuards,
    notes,
  );

  if (failedGuards.size === 0) {
    notes.add("phase_9k_privacy_telemetry_audit_scaffold_closed");
  }

  return Phase9KPrivacyTelemetryCloseoutReportSchema.parse({
    kind: "command_center.phase_9k_privacy_telemetry_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9K_PRIVACY_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    coverage_summary: coverageSummary,
    notes: [...notes],
    generated_from: "phase_9k_privacy_telemetry_audit_scaffold",
    metadata_only: true,
    redaction_required: true,
    render_safe: failedGuards.size === 0,
    non_executable: true,
    raw_payloads_forbidden: true,
    source_code_forbidden: true,
    live_user_data_forbidden_in_demo: true,
    remote_dashboard_forbidden: true,
    export_unredacted_forbidden: true,
    authority_surface: false,
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    routine_scheduled: false,
    routine_triggered: false,
    memory_written: false,
    project_written: false,
    device_action_triggered: false,
    cloud_fallback_triggered: false,
    db_write_performed: false,
    network_called: false,
    audio_capture_started: false,
    video_capture_started: false,
  });
}

function evaluatePrivacyPolicy(
  privacyPolicy: unknown,
  failedGuards: Set<Phase9KPrivacyCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateCommandCenterPrivacyPolicy(privacyPolicy);
  if (validation.passed) return;

  notes.add("privacy_policy_validation_failed");
  for (const guard of PHASE_9K_PRIVACY_CLOSEOUT_GUARDS) {
    failedGuards.add(guard);
  }
}

function evaluateRedactionMatrix(
  redactionMatrix: unknown,
  coverageSummary: RedactionCoverageSummary,
  failedGuards: Set<Phase9KPrivacyCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateRedactionCoverageMatrix(redactionMatrix);
  if (validation.passed && coverageSummary.verdict === "pass") return;

  notes.add("redaction_coverage_matrix_validation_failed");
  for (const guard of PHASE_9K_PRIVACY_CLOSEOUT_GUARDS) {
    failedGuards.add(guard);
  }
}

function evaluateForbiddenPayloadFailClosed(
  overridePayloads: Partial<Record<Phase9KPrivacyCloseoutGuard, unknown>>,
  failedGuards: Set<Phase9KPrivacyCloseoutGuard>,
  notes: Set<string>,
): void {
  for (const [guard, payload] of FORBIDDEN_PAYLOAD_PROBES) {
    const effectivePayload = overridePayloads[guard] ?? payload;
    const validation = validateCommandCenterPayloadPrivacy(
      "audit",
      effectivePayload,
    );
    if (validation.passed) {
      failedGuards.add(guard);
      notes.add(`forbidden_payload_rendered:${guard}`);
    }
  }
}

function evaluateDemoAndRecruiterFailClosed(
  failedGuards: Set<Phase9KPrivacyCloseoutGuard>,
  notes: Set<string>,
): void {
  const demoValidation = validateCommandCenterPayloadPrivacy("demo", {
    metadata_only: true,
    render_safe: true,
    non_executable: true,
    live_user_data_in_demo: true,
  });
  if (demoValidation.passed) {
    failedGuards.add("no_live_user_data_in_demo");
    notes.add("demo_live_user_data_rendered");
  }

  const recruiterValidation = validateCommandCenterPayloadPrivacy("recruiter", {
    metadata_only: true,
    render_safe: true,
    non_executable: true,
    hide_developer_console: false,
    hide_raw_metadata_tables: false,
  });
  if (recruiterValidation.passed) {
    failedGuards.add("no_mutating_or_executable_affordances");
    notes.add("recruiter_exposure_markers_rendered");
  }
}

function evaluateGuardState(
  guardState: unknown,
  failedGuards: Set<Phase9KPrivacyCloseoutGuard>,
  notes: Set<string>,
): void {
  if (Phase9KPrivacyGuardStateSchema.safeParse(guardState).success) return;
  if (!guardState || typeof guardState !== "object") {
    for (const [, guard] of CAPABILITY_FIELD_TO_GUARD) failedGuards.add(guard);
    notes.add("phase_9k_guard_state_invalid");
    return;
  }
  const record = guardState as Partial<
    Record<Phase9KPrivacyForbiddenCapabilityField, unknown>
  >;
  for (const [field, guard] of CAPABILITY_FIELD_TO_GUARD) {
    if (record[field] !== false) {
      failedGuards.add(guard);
      notes.add(`forbidden_privacy_capability_enabled:${field}`);
    }
  }
}

const FORBIDDEN_PAYLOAD_PROBES: ReadonlyArray<
  [Phase9KPrivacyCloseoutGuard, Record<string, unknown>]
> = [
  ["no_raw_tool_arguments", { raw_tool_arguments: "withheld" }],
  ["no_raw_prompts", { raw_prompts: "withheld" }],
  ["no_raw_model_outputs", { raw_model_outputs: "withheld" }],
  ["no_raw_ocr_text", { raw_ocr_text: "withheld" }],
  ["no_raw_screenshots", { raw_screenshots: "withheld" }],
  ["no_raw_camera_frames", { raw_camera_frames: "withheld" }],
  ["no_raw_frame_thumbnails", { raw_frame_thumbnails: "withheld" }],
  ["no_raw_voice_transcripts", { raw_voice_transcripts: "withheld" }],
  ["no_raw_audio", { raw_audio: "withheld" }],
  ["no_project_file_bodies", { project_file_bodies: "withheld" }],
  ["no_document_bodies", { document_bodies: "withheld" }],
  ["no_memory_contents", { memory_contents: "withheld" }],
  ["no_source_code_rendering", { source_code: "withheld" }],
  ["no_raw_stack_traces", { raw_stack_traces: "withheld" }],
  ["no_secrets_api_keys_tokens_passwords", { api_keys: "withheld" }],
  ["no_exact_pii", { exact_pii: "withheld" }],
  ["no_unredacted_suggestion_bodies", { unredacted_suggestion_bodies: "x" }],
  ["no_live_user_data_in_demo", { live_user_data_in_demo: true }],
  ["no_remote_dashboard", { remote_dashboard_allowed: true }],
  ["no_export_unredacted", { export_unredacted_allowed: true }],
  ["no_mutating_or_executable_affordances", { execute_button: true }],
] as const;

const CAPABILITY_FIELD_TO_GUARD: ReadonlyArray<
  [Phase9KPrivacyForbiddenCapabilityField, Phase9KPrivacyCloseoutGuard]
> = [
  ["raw_tool_arguments_enabled", "no_raw_tool_arguments"],
  ["raw_prompts_enabled", "no_raw_prompts"],
  ["raw_model_outputs_enabled", "no_raw_model_outputs"],
  ["raw_ocr_text_enabled", "no_raw_ocr_text"],
  ["raw_screenshots_enabled", "no_raw_screenshots"],
  ["raw_camera_frames_enabled", "no_raw_camera_frames"],
  ["raw_frame_thumbnails_enabled", "no_raw_frame_thumbnails"],
  ["raw_voice_transcripts_enabled", "no_raw_voice_transcripts"],
  ["raw_audio_enabled", "no_raw_audio"],
  ["project_file_bodies_enabled", "no_project_file_bodies"],
  ["document_bodies_enabled", "no_document_bodies"],
  ["memory_contents_enabled", "no_memory_contents"],
  ["source_code_rendering_enabled", "no_source_code_rendering"],
  ["raw_stack_traces_enabled", "no_raw_stack_traces"],
  [
    "secrets_api_keys_tokens_passwords_enabled",
    "no_secrets_api_keys_tokens_passwords",
  ],
  ["exact_pii_enabled", "no_exact_pii"],
  ["unredacted_suggestion_bodies_enabled", "no_unredacted_suggestion_bodies"],
  ["live_user_data_in_demo_enabled", "no_live_user_data_in_demo"],
  ["remote_dashboard_enabled", "no_remote_dashboard"],
  ["export_unredacted_enabled", "no_export_unredacted"],
  [
    "mutating_or_executable_affordances_enabled",
    "no_mutating_or_executable_affordances",
  ],
];

export function listPhase9KForbiddenPayloadClasses(): readonly string[] {
  return COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_CLASSES;
}

export function coercePhase9KCoverageSummary(
  matrix: RedactionCoverageMatrix,
): RedactionCoverageSummary {
  return RedactionCoverageSummarySchema.parse(
    summarizeRedactionCoverageMatrix(matrix),
  );
}
