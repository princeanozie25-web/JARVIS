import { z } from "zod";

import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import { CommandCenterObservabilityRedactionStatusSchema } from "./observability-contract";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const DEMO_MODE_DATASET_PROFILES = [
  "portfolio_default",
  "recruiter_walkthrough",
  "governance_showcase",
  "failure_replay_demo",
  "safe_empty",
] as const;

export const DEMO_MODE_DATA_SOURCE_KINDS = [
  "synthetic_build_time_dataset",
] as const;

export const DEMO_MODE_DATA_SOURCE_VALIDATION_REASONS = [
  "demo_mode_data_source_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "real_or_live_source_kind",
  "live_data_access_enabled",
  "writes_enabled",
  "remote_sync_enabled",
  "badge_missing",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "unknown_dataset_profile",
  "render_not_safe",
  "replay_not_safe",
  "not_non_executable",
] as const;

export const DEMO_MODE_ISOLATION_POLICY_VALIDATION_REASONS = [
  "demo_mode_isolation_policy_valid",
  "schema_rejected",
  "isolation_invariant_failed",
] as const;

export const DemoModeDatasetProfileSchema = z.enum(DEMO_MODE_DATASET_PROFILES);
export const DemoModeDataSourceKindSchema = z.enum(DEMO_MODE_DATA_SOURCE_KINDS);
export const DemoModeDataSourceValidationReasonSchema = z.enum(
  DEMO_MODE_DATA_SOURCE_VALIDATION_REASONS,
);
export const DemoModeIsolationPolicyValidationReasonSchema = z.enum(
  DEMO_MODE_ISOLATION_POLICY_VALIDATION_REASONS,
);

export const DemoModeDataSourceSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.demo_mode_data_source"),
    phase: z.literal("9I1"),
    source_id: z.string().trim().min(1).max(160),
    source_kind: z.literal("synthetic_build_time_dataset"),
    dataset_profile: DemoModeDatasetProfileSchema,
    generated_at: z.number().int().nonnegative(),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    replay_safe: z.literal(true),
    non_executable: z.literal(true),
    live_data_access_allowed: z.literal(false),
    writes_allowed: z.literal(false),
    remote_sync_allowed: z.literal(false),
    badge_required: z.literal(true),
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    metadata_only: z.literal(true),
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
    live_audit_db_access_allowed: z.literal(false),
    live_telemetry_access_allowed: z.literal(false),
    user_project_data_allowed: z.literal(false),
    real_suggestions_allowed: z.literal(false),
    real_traces_allowed: z.literal(false),
    real_frames_or_voice_allowed: z.literal(false),
    secrets_or_exact_pii_allowed: z.literal(false),
  });

export const DemoModeIsolationPolicySchema = z.strictObject({
  kind: z.literal("command_center.demo_mode_isolation_policy"),
  phase: z.literal("9I1"),
  no_live_audit_db_access: z.literal(true),
  no_live_telemetry_access: z.literal(true),
  no_user_project_data: z.literal(true),
  no_real_suggestions: z.literal(true),
  no_real_traces: z.literal(true),
  no_real_frames_or_voice: z.literal(true),
  no_secrets_or_exact_pii: z.literal(true),
  no_writes_to_real_audit_db: z.literal(true),
  badge_always_visible: z.literal(true),
  source_must_be_synthetic: z.literal(true),
  metadata_only: z.literal(true),
  render_safe: z.literal(true),
  non_executable: z.literal(true),
});

export const DemoModeDataSourceValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(DemoModeDataSourceValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    replay_safe: z.boolean(),
    non_executable: z.boolean(),
    synthetic_only: z.boolean(),
    live_data_access_allowed: z.boolean(),
    writes_allowed: z.boolean(),
    remote_sync_allowed: z.boolean(),
    badge_required: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export const DemoModeIsolationPolicyValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(DemoModeIsolationPolicyValidationReasonSchema),
    failed_invariants: z.array(z.string().trim().min(1).max(160)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    non_executable: z.boolean(),
    mutated_input: z.literal(false),
  });

export type DemoModeDatasetProfile = z.infer<
  typeof DemoModeDatasetProfileSchema
>;
export type DemoModeDataSourceKind = z.infer<
  typeof DemoModeDataSourceKindSchema
>;
export type DemoModeDataSourceValidationReason = z.infer<
  typeof DemoModeDataSourceValidationReasonSchema
>;
export type DemoModeIsolationPolicyValidationReason = z.infer<
  typeof DemoModeIsolationPolicyValidationReasonSchema
>;
export type DemoModeDataSource = z.infer<typeof DemoModeDataSourceSchema>;
export type DemoModeIsolationPolicy = z.infer<
  typeof DemoModeIsolationPolicySchema
>;
export type DemoModeDataSourceValidation = z.infer<
  typeof DemoModeDataSourceValidationSchema
>;
export type DemoModeIsolationPolicyValidation = z.infer<
  typeof DemoModeIsolationPolicyValidationSchema
>;

export const DEFAULT_DEMO_MODE_ISOLATION_POLICY: DemoModeIsolationPolicy =
  DemoModeIsolationPolicySchema.parse({
    kind: "command_center.demo_mode_isolation_policy",
    phase: "9I1",
    no_live_audit_db_access: true,
    no_live_telemetry_access: true,
    no_user_project_data: true,
    no_real_suggestions: true,
    no_real_traces: true,
    no_real_frames_or_voice: true,
    no_secrets_or_exact_pii: true,
    no_writes_to_real_audit_db: true,
    badge_always_visible: true,
    source_must_be_synthetic: true,
    metadata_only: true,
    render_safe: true,
    non_executable: true,
  });

export function createDefaultDemoModeDataSource(): DemoModeDataSource {
  return DemoModeDataSourceSchema.parse({
    kind: "command_center.demo_mode_data_source",
    phase: "9I1",
    source_id: "demo_mode:synthetic:safe_empty",
    source_kind: "synthetic_build_time_dataset",
    dataset_profile: "safe_empty",
    generated_at: 0,
    redaction_status: "metadata_only",
    render_safe: true,
    replay_safe: true,
    non_executable: true,
    live_data_access_allowed: false,
    writes_allowed: false,
    remote_sync_allowed: false,
    badge_required: true,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
    ],
    truncated: false,
    metadata_only: true,
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
    live_audit_db_access_allowed: false,
    live_telemetry_access_allowed: false,
    user_project_data_allowed: false,
    real_suggestions_allowed: false,
    real_traces_allowed: false,
    real_frames_or_voice_allowed: false,
    secrets_or_exact_pii_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateDemoModeDataSource(
  input: unknown,
): DemoModeDataSourceValidation {
  const parsed = DemoModeDataSourceSchema.safeParse(input);
  const scan = scanDemoModeDataSource(input, [], new WeakSet<object>());
  const reasons = new Set<DemoModeDataSourceValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (readField(input, "source_kind") !== "synthetic_build_time_dataset") {
    reasons.add("real_or_live_source_kind");
  }
  if (readBooleanField(input, "live_data_access_allowed") !== false) {
    reasons.add("live_data_access_enabled");
  }
  if (readBooleanField(input, "writes_allowed") !== false) {
    reasons.add("writes_enabled");
  }
  if (readBooleanField(input, "remote_sync_allowed") !== false) {
    reasons.add("remote_sync_enabled");
  }
  if (readBooleanField(input, "badge_required") !== true) {
    reasons.add("badge_missing");
  }
  if (scan.executableFields.length > 0)
    reasons.add("executable_affordance_present");
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (hasUnknownDatasetProfile(input)) reasons.add("unknown_dataset_profile");
  if (readBooleanField(input, "render_safe") !== true)
    reasons.add("render_not_safe");
  if (readBooleanField(input, "replay_safe") !== true)
    reasons.add("replay_not_safe");
  if (readBooleanField(input, "non_executable") !== true)
    reasons.add("not_non_executable");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return DemoModeDataSourceValidationSchema.parse({
    passed,
    reasons: passed ? ["demo_mode_data_source_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["demo_mode_source_synthetic_only"],
    metadata_only: true,
    render_safe: passed,
    replay_safe: passed,
    non_executable: passed,
    synthetic_only:
      readField(input, "source_kind") === "synthetic_build_time_dataset",
    live_data_access_allowed:
      readBooleanField(input, "live_data_access_allowed") === true,
    writes_allowed: readBooleanField(input, "writes_allowed") === true,
    remote_sync_allowed:
      readBooleanField(input, "remote_sync_allowed") === true,
    badge_required: readBooleanField(input, "badge_required") === true,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateDemoModeIsolationPolicy(
  input: unknown = DEFAULT_DEMO_MODE_ISOLATION_POLICY,
): DemoModeIsolationPolicyValidation {
  const parsed = DemoModeIsolationPolicySchema.safeParse(input);
  const failedInvariants = new Set<string>();

  if (!parsed.success) {
    for (const field of DEMO_MODE_ISOLATION_INVARIANT_FIELDS) {
      if (readBooleanField(input, field) !== true) {
        failedInvariants.add(field);
      }
    }
  }

  const passed = parsed.success && failedInvariants.size === 0;
  return DemoModeIsolationPolicyValidationSchema.parse({
    passed,
    reasons: passed
      ? ["demo_mode_isolation_policy_valid"]
      : [
          "schema_rejected",
          ...(failedInvariants.size > 0
            ? (["isolation_invariant_failed"] as const)
            : []),
        ],
    failed_invariants: [...failedInvariants],
    notes: passed
      ? ["demo_mode_isolation_policy_synthetic_only"]
      : ["demo_mode_isolation_policy_failed_closed"],
    metadata_only: true,
    render_safe: passed,
    non_executable: passed,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

interface DemoModeDataSourceScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanDemoModeDataSource(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): DemoModeDataSourceScanResult {
  const result: DemoModeDataSourceScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("demo_mode_data_source_missing");
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
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push([...path, key].join("."));
    }
    const child = scanDemoModeDataSource(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function hasUnknownDatasetProfile(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const profile = (input as { dataset_profile?: unknown }).dataset_profile;
  return (
    profile !== undefined &&
    !DemoModeDatasetProfileSchema.safeParse(profile).success
  );
}

function isForbiddenRawPayloadField(key: string): boolean {
  return (
    COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES as readonly string[]
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
    key === "live_audit_db_access_allowed" ||
    key === "live_telemetry_access_allowed" ||
    key === "user_project_data_allowed" ||
    key === "real_suggestions_allowed" ||
    key === "real_traces_allowed" ||
    key === "real_frames_or_voice_allowed" ||
    key === "secrets_or_exact_pii_allowed"
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

const DEMO_MODE_ISOLATION_INVARIANT_FIELDS = [
  "no_live_audit_db_access",
  "no_live_telemetry_access",
  "no_user_project_data",
  "no_real_suggestions",
  "no_real_traces",
  "no_real_frames_or_voice",
  "no_secrets_or_exact_pii",
  "no_writes_to_real_audit_db",
  "badge_always_visible",
  "source_must_be_synthetic",
] as const;
