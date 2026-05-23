import { z } from "zod";

import {
  AuditReplayViewerViewModelSchema,
  createDefaultAuditReplayViewerViewModel,
  validateAuditReplayViewerViewModel,
} from "./audit-replay-viewer";
import {
  AuditTraceTimelineViewModelSchema,
  createDefaultAuditTraceTimelineViewModel,
  validateAuditTraceTimelineViewModel,
} from "./audit-trace-timeline";
import {
  GovernanceBoundaryViewerViewModelSchema,
  createDefaultGovernanceBoundaryViewerViewModel,
  validateGovernanceBoundaryViewerViewModel,
} from "./audit-governance-boundary";
import {
  RuntimeDependencyViewerViewModelSchema,
  createDefaultRuntimeDependencyViewerViewModel,
  validateRuntimeDependencyViewerViewModel,
} from "./audit-runtime-dependency";
import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import {
  DEMO_MODE_DATASET_PROFILES,
  DemoModeDatasetProfileSchema,
  DemoModeDataSourceSchema,
  validateDemoModeDataSource,
  type DemoModeDatasetProfile,
} from "./demo-mode";
import { CommandCenterObservabilityRedactionStatusSchema } from "./observability-contract";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import {
  OrbDisplayStateSchema,
  createDefaultOrbDisplayState,
  validateOrbDisplayState,
} from "./rest-orb";
import {
  RestSceneDescriptorSchema,
  deriveRestSceneDescriptor,
  validateRestSceneDescriptor,
} from "./rest-scene";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";
import {
  WorkingCockpitViewModelSchema,
  createDefaultWorkingCockpitViewModel,
  validateWorkingCockpitViewModel,
} from "./working-cockpit-view-models";

export const SYNTHETIC_DEMO_DATASET_VALIDATION_REASONS = [
  "synthetic_demo_dataset_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "live_or_real_source_marker_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "unknown_profile",
  "invalid_source_kind",
  "render_not_safe",
  "replay_not_safe",
  "not_non_executable",
  "badge_missing",
  "nested_section_unsafe",
] as const;

export const SYNTHETIC_DEMO_FORBIDDEN_LIVE_REFERENCE_FIELDS = [
  "live_audit_db",
  "live_audit_db_ref",
  "audit_db_ref",
  "live_telemetry",
  "telemetry_ref",
  "user_project_data",
  "user_project_id",
  "real_project_id",
  "real_suggestion",
  "real_suggestion_id",
  "real_trace",
  "real_trace_id",
  "real_frame",
  "real_voice",
  "frame_ref",
  "voice_ref",
] as const;

export const SyntheticDemoDatasetValidationReasonSchema = z.enum(
  SYNTHETIC_DEMO_DATASET_VALIDATION_REASONS,
);
export const SyntheticDemoForbiddenLiveReferenceFieldSchema = z.enum(
  SYNTHETIC_DEMO_FORBIDDEN_LIVE_REFERENCE_FIELDS,
);

export const SyntheticDemoRestStateSchema = z.strictObject({
  kind: z.literal("command_center.synthetic_demo_rest_state"),
  orb_state: OrbDisplayStateSchema,
  scene_descriptor: RestSceneDescriptorSchema,
  metadata_only: z.literal(true),
  render_safe: z.literal(true),
  non_executable: z.literal(true),
});

export const SyntheticDemoDatasetSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.synthetic_demo_dataset"),
    phase: z.literal("9I2"),
    dataset_id: z.string().trim().min(1).max(160),
    profile: DemoModeDatasetProfileSchema,
    generated_at: z.number().int().nonnegative(),
    source_kind: z.literal("synthetic_build_time_dataset"),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    replay_safe: z.literal(true),
    non_executable: z.literal(true),
    badge_required: z.literal(true),
    rest_state: SyntheticDemoRestStateSchema,
    working_cockpit: WorkingCockpitViewModelSchema,
    audit_timeline: AuditTraceTimelineViewModelSchema,
    audit_replay: AuditReplayViewerViewModelSchema,
    governance_boundary: GovernanceBoundaryViewerViewModelSchema,
    runtime_dependency: RuntimeDependencyViewerViewModelSchema,
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    metadata_only: z.literal(true),
    synthetic_only: z.literal(true),
    live_data_access_allowed: z.literal(false),
    writes_allowed: z.literal(false),
    remote_sync_allowed: z.literal(false),
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
  });

export const SyntheticDemoDatasetValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(SyntheticDemoDatasetValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    synthetic_only: z.boolean(),
    render_safe: z.boolean(),
    replay_safe: z.boolean(),
    non_executable: z.boolean(),
    badge_required: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type SyntheticDemoDatasetValidationReason = z.infer<
  typeof SyntheticDemoDatasetValidationReasonSchema
>;
export type SyntheticDemoForbiddenLiveReferenceField = z.infer<
  typeof SyntheticDemoForbiddenLiveReferenceFieldSchema
>;
export type SyntheticDemoRestState = z.infer<
  typeof SyntheticDemoRestStateSchema
>;
export type SyntheticDemoDataset = z.infer<typeof SyntheticDemoDatasetSchema>;
export type SyntheticDemoDatasetValidation = z.infer<
  typeof SyntheticDemoDatasetValidationSchema
>;

export function createDefaultSyntheticDemoDataset(
  profile: DemoModeDatasetProfile = "safe_empty",
): SyntheticDemoDataset {
  const safeProfile = DemoModeDatasetProfileSchema.safeParse(profile).success
    ? profile
    : "safe_empty";
  const orbState = createDefaultOrbDisplayState();
  return SyntheticDemoDatasetSchema.parse({
    kind: "command_center.synthetic_demo_dataset",
    phase: "9I2",
    dataset_id: `synthetic_demo:${safeProfile}`,
    profile: safeProfile,
    generated_at: 0,
    source_kind: "synthetic_build_time_dataset",
    redaction_status: "metadata_only",
    render_safe: true,
    replay_safe: true,
    non_executable: true,
    badge_required: true,
    rest_state: {
      kind: "command_center.synthetic_demo_rest_state",
      orb_state: orbState,
      scene_descriptor: deriveRestSceneDescriptor({ orbState }),
      metadata_only: true,
      render_safe: true,
      non_executable: true,
    },
    working_cockpit: createDefaultWorkingCockpitViewModel(),
    audit_timeline: createDefaultAuditTraceTimelineViewModel(),
    audit_replay: createDefaultAuditReplayViewerViewModel(),
    governance_boundary: createDefaultGovernanceBoundaryViewerViewModel(),
    runtime_dependency: createDefaultRuntimeDependencyViewerViewModel(),
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      ...SYNTHETIC_DEMO_FORBIDDEN_LIVE_REFERENCE_FIELDS,
    ],
    truncated: false,
    metadata_only: true,
    synthetic_only: true,
    live_data_access_allowed: false,
    writes_allowed: false,
    remote_sync_allowed: false,
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
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateSyntheticDemoDataset(
  input: unknown,
): SyntheticDemoDatasetValidation {
  const parsed = SyntheticDemoDatasetSchema.safeParse(input);
  const scan = scanSyntheticDemoDataset(input, [], new WeakSet<object>());
  const reasons = new Set<SyntheticDemoDatasetValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.liveReferenceFields.length > 0)
    reasons.add("live_or_real_source_marker_present");
  if (scan.executableFields.length > 0)
    reasons.add("executable_affordance_present");
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (hasUnknownProfile(input)) reasons.add("unknown_profile");
  if (readField(input, "source_kind") !== "synthetic_build_time_dataset") {
    reasons.add("invalid_source_kind");
  }
  if (readBooleanField(input, "render_safe") !== true)
    reasons.add("render_not_safe");
  if (readBooleanField(input, "replay_safe") !== true)
    reasons.add("replay_not_safe");
  if (readBooleanField(input, "non_executable") !== true)
    reasons.add("not_non_executable");
  if (readBooleanField(input, "badge_required") !== true)
    reasons.add("badge_missing");
  if (!nestedSectionsAreSafe(input)) reasons.add("nested_section_unsafe");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.liveReferenceFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return SyntheticDemoDatasetValidationSchema.parse({
    passed,
    reasons: passed ? ["synthetic_demo_dataset_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["synthetic_demo_dataset_safe_empty"],
    metadata_only: true,
    synthetic_only:
      readField(input, "source_kind") === "synthetic_build_time_dataset",
    render_safe: passed,
    replay_safe: passed,
    non_executable: passed,
    badge_required: readBooleanField(input, "badge_required") === true,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function deriveSyntheticDemoDatasetFromDemoModeDataSource(
  input: unknown,
): SyntheticDemoDataset {
  const validation = validateDemoModeDataSource(input);
  const parsed = DemoModeDataSourceSchema.safeParse(input);
  if (!validation.passed || !parsed.success) {
    return createDefaultSyntheticDemoDataset("safe_empty");
  }
  return createDefaultSyntheticDemoDataset(parsed.data.dataset_profile);
}

interface SyntheticDemoDatasetScanResult {
  rawPayloadFields: string[];
  liveReferenceFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanSyntheticDemoDataset(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): SyntheticDemoDatasetScanResult {
  const result: SyntheticDemoDatasetScanResult = {
    rawPayloadFields: [],
    liveReferenceFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("synthetic_demo_dataset_missing");
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
    const child = scanSyntheticDemoDataset(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.liveReferenceFields.push(...child.liveReferenceFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function nestedSectionsAreSafe(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const dataset = input as Record<string, unknown>;
  const rest = dataset.rest_state as Record<string, unknown> | undefined;
  return (
    !!rest &&
    validateOrbDisplayState(rest.orb_state).passed &&
    validateRestSceneDescriptor(rest.scene_descriptor).passed &&
    validateWorkingCockpitViewModel(dataset.working_cockpit).passed &&
    validateAuditTraceTimelineViewModel(dataset.audit_timeline).passed &&
    validateAuditReplayViewerViewModel(dataset.audit_replay).passed &&
    validateGovernanceBoundaryViewerViewModel(dataset.governance_boundary)
      .passed &&
    validateRuntimeDependencyViewerViewModel(dataset.runtime_dependency).passed
  );
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
    key === "graph_execution_allowed"
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
