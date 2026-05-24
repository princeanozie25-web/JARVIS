import { z } from "zod";

import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import { RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS } from "./audit-runtime-dependency";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const COMMAND_CENTER_SURFACES = [
  "rest",
  "working",
  "audit",
  "demo",
  "recruiter",
  "developer",
] as const;

export const COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_CLASSES = [
  "raw_tool_arguments",
  "raw_prompts",
  "raw_model_outputs",
  "raw_ocr_text",
  "raw_screenshots",
  "raw_camera_frames",
  "raw_frame_thumbnails",
  "raw_voice_transcripts",
  "raw_audio",
  "project_file_bodies",
  "document_bodies",
  "memory_contents",
  "source_code",
  "raw_stack_traces",
  "secrets",
  "api_keys",
  "tokens",
  "passwords",
  "exact_pii",
  "unredacted_suggestion_bodies",
  "live_user_data_in_demo",
] as const;

export const COMMAND_CENTER_PRIVACY_POLICY_VALIDATION_REASONS = [
  "privacy_policy_valid",
  "schema_rejected",
  "enforcement_boolean_disabled",
  "unknown_surface",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;

export const COMMAND_CENTER_PAYLOAD_PRIVACY_VALIDATION_REASONS = [
  "payload_privacy_valid",
  "policy_invalid",
  "unknown_surface",
  "forbidden_payload_class_present",
  "executable_affordance_present",
  "callback_or_non_serializable_value",
  "unsafe_payload_shape",
  "demo_live_user_data_present",
  "recruiter_exposure_marker_present",
  "metadata_only_requirement_failed",
  "redaction_requirement_failed",
  "render_safe_requirement_failed",
  "non_executable_requirement_failed",
] as const;

export const COMMAND_CENTER_PRIVACY_EXECUTABLE_AFFORDANCE_KEYS = [
  ...AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS,
  ...COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
  "approve",
  "approve_button",
  "deny",
  "deny_button",
  "run",
  "run_button",
  "retry",
  "retry_button",
  "rerun",
  "rerun_button",
  "execute",
  "execute_button",
  "mutate",
  "mutate_button",
  "schedule",
  "schedule_routine",
  "debug_action",
  "on_debug",
  "export",
  "export_json",
  "export_unredacted",
  "write",
  "write_file",
  "patch",
] as const;

const COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_FIELD_ALIASES = [
  ...COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_CLASSES,
  ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  ...RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
  "raw_tool_args",
  "raw_prompt",
  "raw_model_output",
  "raw_screenshot",
  "raw_camera_frame",
  "raw_frame_thumbnail",
  "raw_voice_transcript",
  "project_file_body",
  "document_body",
  "memory_content",
  "secret",
  "api_key",
  "token",
  "password",
  "unredacted_suggestion_body",
] as const;

const DEMO_FORBIDDEN_LIVE_MARKER_FIELDS = [
  "live_user_data_in_demo",
  "live_audit_db_ref",
  "live_audit_db_access",
  "live_telemetry",
  "telemetry_ref",
  "user_project_data",
  "user_project_id",
  "real_suggestion_id",
  "real_trace_id",
  "frame_ref",
  "voice_ref",
  "live_data_access_allowed",
] as const;

const RECRUITER_FORBIDDEN_EXPOSURE_MARKER_FIELDS = [
  "developer_console",
  "developer_console_visible",
  "developer_console_included",
  "developer_console_allowed",
  "raw_metadata_table",
  "raw_metadata_tables",
  "raw_metadata_table_included",
  "raw_metadata_tables_allowed",
  "working_cockpit_raw_tables_included",
] as const;

export const CommandCenterSurfaceSchema = z.enum(COMMAND_CENTER_SURFACES);
export const CommandCenterForbiddenUiPayloadClassSchema = z.enum(
  COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_CLASSES,
);
export const CommandCenterPrivacyPolicyValidationReasonSchema = z.enum(
  COMMAND_CENTER_PRIVACY_POLICY_VALIDATION_REASONS,
);
export const CommandCenterPayloadPrivacyValidationReasonSchema = z.enum(
  COMMAND_CENTER_PAYLOAD_PRIVACY_VALIDATION_REASONS,
);
export const CommandCenterPrivacyExecutableAffordanceKeySchema = z.enum(
  COMMAND_CENTER_PRIVACY_EXECUTABLE_AFFORDANCE_KEYS,
);

export const CommandCenterPrivacyPolicySchema = z.strictObject({
  kind: z.literal("command_center.privacy_policy"),
  phase: z.literal("9K1"),
  policy_id: z.string().trim().min(1).max(160),
  applies_to_surfaces: z.array(CommandCenterSurfaceSchema),
  metadata_only_required: z.literal(true),
  redaction_required: z.literal(true),
  render_safe_required: z.literal(true),
  non_executable_required: z.literal(true),
  raw_payloads_forbidden: z.literal(true),
  source_code_forbidden: z.literal(true),
  live_user_data_forbidden_in_demo: z.literal(true),
  remote_dashboard_forbidden: z.literal(true),
  export_unredacted_forbidden: z.literal(true),
  generated_at: z.number().int().nonnegative(),
});

export const CommandCenterPrivacyPolicyValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(CommandCenterPrivacyPolicyValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    applies_to_surfaces: z.array(CommandCenterSurfaceSchema),
    metadata_only_required: z.boolean(),
    redaction_required: z.boolean(),
    render_safe_required: z.boolean(),
    non_executable_required: z.boolean(),
    raw_payloads_forbidden: z.boolean(),
    source_code_forbidden: z.boolean(),
    live_user_data_forbidden_in_demo: z.boolean(),
    remote_dashboard_forbidden: z.boolean(),
    export_unredacted_forbidden: z.boolean(),
    mutated_input: z.literal(false),
  });

export const CommandCenterPayloadPrivacyValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(CommandCenterPayloadPrivacyValidationReasonSchema),
    surface: z.union([CommandCenterSurfaceSchema, z.literal("unknown")]),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.boolean(),
    redaction_required: z.boolean(),
    render_safe: z.boolean(),
    non_executable: z.boolean(),
    raw_payloads_included: z.literal(false),
    source_code_included: z.literal(false),
    exact_pii_included: z.literal(false),
    remote_dashboard_allowed: z.literal(false),
    export_unredacted_allowed: z.literal(false),
    mutated_input: z.literal(false),
  });

export const CommandCenterPayloadRenderAssertionSchema = z.strictObject({
  surface: z.union([CommandCenterSurfaceSchema, z.literal("unknown")]),
  render_safe: z.boolean(),
  withheld_fields: z.array(z.string().trim().min(1).max(180)),
  notes: z.array(z.string().trim().min(1).max(180)),
});

export type CommandCenterSurface = z.infer<typeof CommandCenterSurfaceSchema>;
export type CommandCenterForbiddenUiPayloadClass = z.infer<
  typeof CommandCenterForbiddenUiPayloadClassSchema
>;
export type CommandCenterPrivacyPolicyValidationReason = z.infer<
  typeof CommandCenterPrivacyPolicyValidationReasonSchema
>;
export type CommandCenterPayloadPrivacyValidationReason = z.infer<
  typeof CommandCenterPayloadPrivacyValidationReasonSchema
>;
export type CommandCenterPrivacyExecutableAffordanceKey = z.infer<
  typeof CommandCenterPrivacyExecutableAffordanceKeySchema
>;
export type CommandCenterPrivacyPolicy = z.infer<
  typeof CommandCenterPrivacyPolicySchema
>;
export type CommandCenterPrivacyPolicyValidation = z.infer<
  typeof CommandCenterPrivacyPolicyValidationSchema
>;
export type CommandCenterPayloadPrivacyValidation = z.infer<
  typeof CommandCenterPayloadPrivacyValidationSchema
>;
export type CommandCenterPayloadRenderAssertion = z.infer<
  typeof CommandCenterPayloadRenderAssertionSchema
>;

export function createDefaultCommandCenterPrivacyPolicy(): CommandCenterPrivacyPolicy {
  return CommandCenterPrivacyPolicySchema.parse({
    kind: "command_center.privacy_policy",
    phase: "9K1",
    policy_id: "command_center:privacy:metadata_only:v1",
    applies_to_surfaces: [...COMMAND_CENTER_SURFACES],
    metadata_only_required: true,
    redaction_required: true,
    render_safe_required: true,
    non_executable_required: true,
    raw_payloads_forbidden: true,
    source_code_forbidden: true,
    live_user_data_forbidden_in_demo: true,
    remote_dashboard_forbidden: true,
    export_unredacted_forbidden: true,
    generated_at: 0,
  });
}

export function validateCommandCenterPrivacyPolicy(
  input: unknown = createDefaultCommandCenterPrivacyPolicy(),
): CommandCenterPrivacyPolicyValidation {
  const parsed = CommandCenterPrivacyPolicySchema.safeParse(input);
  const scan = scanPrivacyValue(input, [], new WeakSet<object>());
  const reasons = new Set<CommandCenterPrivacyPolicyValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (hasDisabledEnforcementBoolean(input)) {
    reasons.add("enforcement_boolean_disabled");
  }
  if (hasUnknownSurface(input)) reasons.add("unknown_surface");
  if (scan.forbiddenPayloadFields.length > 0) {
    reasons.add("raw_payload_field_present");
  }
  if (scan.executableFields.length > 0) {
    reasons.add("executable_affordance_present");
  }
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");

  for (const field of scan.forbiddenPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return CommandCenterPrivacyPolicyValidationSchema.parse({
    passed,
    reasons: passed ? ["privacy_policy_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes:
      notes.size > 0
        ? [...notes]
        : ["command_center_privacy_policy_enforces_all_surfaces"],
    applies_to_surfaces: readPolicySurfaces(input),
    metadata_only_required:
      readBooleanField(input, "metadata_only_required") === true,
    redaction_required: readBooleanField(input, "redaction_required") === true,
    render_safe_required:
      readBooleanField(input, "render_safe_required") === true,
    non_executable_required:
      readBooleanField(input, "non_executable_required") === true,
    raw_payloads_forbidden:
      readBooleanField(input, "raw_payloads_forbidden") === true,
    source_code_forbidden:
      readBooleanField(input, "source_code_forbidden") === true,
    live_user_data_forbidden_in_demo:
      readBooleanField(input, "live_user_data_forbidden_in_demo") === true,
    remote_dashboard_forbidden:
      readBooleanField(input, "remote_dashboard_forbidden") === true,
    export_unredacted_forbidden:
      readBooleanField(input, "export_unredacted_forbidden") === true,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateCommandCenterPayloadPrivacy(
  surface: unknown,
  payload: unknown,
  policy: unknown = createDefaultCommandCenterPrivacyPolicy(),
): CommandCenterPayloadPrivacyValidation {
  const parsedSurface = CommandCenterSurfaceSchema.safeParse(surface);
  const policyValidation = validateCommandCenterPrivacyPolicy(policy);
  const scan = scanPrivacyValue(payload, [], new WeakSet<object>());
  const reasons = new Set<CommandCenterPayloadPrivacyValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const surfaceName = parsedSurface.success ? parsedSurface.data : "unknown";

  if (!policyValidation.passed) reasons.add("policy_invalid");
  if (!parsedSurface.success) reasons.add("unknown_surface");
  if (
    parsedSurface.success &&
    !policyValidation.applies_to_surfaces.includes(parsedSurface.data)
  ) {
    reasons.add("unknown_surface");
  }
  if (scan.forbiddenPayloadFields.length > 0) {
    reasons.add("forbidden_payload_class_present");
  }
  if (scan.executableFields.length > 0) {
    reasons.add("executable_affordance_present");
  }
  if (scan.nonSerializable) {
    reasons.add("callback_or_non_serializable_value");
  }
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (surfaceName === "demo" && hasDemoLiveUserData(payload)) {
    reasons.add("demo_live_user_data_present");
  }
  if (surfaceName === "recruiter" && hasRecruiterExposureMarker(payload)) {
    reasons.add("recruiter_exposure_marker_present");
  }
  if (
    policyValidation.metadata_only_required &&
    readBooleanField(payload, "metadata_only") === false
  ) {
    reasons.add("metadata_only_requirement_failed");
  }
  if (
    policyValidation.redaction_required &&
    readBooleanField(payload, "redaction_required") === false
  ) {
    reasons.add("redaction_requirement_failed");
  }
  if (
    policyValidation.render_safe_required &&
    readBooleanField(payload, "render_safe") === false
  ) {
    reasons.add("render_safe_requirement_failed");
  }
  if (
    policyValidation.non_executable_required &&
    readBooleanField(payload, "non_executable") === false
  ) {
    reasons.add("non_executable_requirement_failed");
  }

  for (const field of policyValidation.withheld_fields) {
    withheldFields.add(`policy.${field}`);
  }
  for (const field of scan.forbiddenPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const field of scan.demoLiveFields) withheldFields.add(field);
  for (const field of scan.recruiterExposureFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);
  if (!policyValidation.passed) notes.add("privacy_policy_failed_closed");

  const passed = reasons.size === 0;
  return CommandCenterPayloadPrivacyValidationSchema.parse({
    passed,
    reasons: passed ? ["payload_privacy_valid"] : [...reasons],
    surface: surfaceName,
    withheld_fields: [...withheldFields],
    notes:
      notes.size > 0
        ? [...notes]
        : ["command_center_payload_metadata_only_render_safe"],
    metadata_only: passed,
    redaction_required: passed,
    render_safe: passed,
    non_executable: passed,
    raw_payloads_included: false,
    source_code_included: false,
    exact_pii_included: false,
    remote_dashboard_allowed: false,
    export_unredacted_allowed: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function assertCommandCenterPayloadCanRender(
  surface: unknown,
  payload: unknown,
): CommandCenterPayloadRenderAssertion {
  const validation = validateCommandCenterPayloadPrivacy(
    surface,
    payload,
    createDefaultCommandCenterPrivacyPolicy(),
  );
  return CommandCenterPayloadRenderAssertionSchema.parse({
    surface: validation.surface,
    render_safe: validation.passed,
    withheld_fields: validation.withheld_fields,
    notes: validation.notes,
  });
}

interface PrivacyScanResult {
  forbiddenPayloadFields: string[];
  executableFields: string[];
  demoLiveFields: string[];
  recruiterExposureFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanPrivacyValue(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): PrivacyScanResult {
  const result: PrivacyScanResult = {
    forbiddenPayloadFields: [],
    executableFields: [],
    demoLiveFields: [],
    recruiterExposureFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("payload_missing");
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

  if (input instanceof Date) return result;
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
    const fieldPath = [...path, key].join(".");
    if (isForbiddenPayloadField(key)) {
      result.forbiddenPayloadFields.push(fieldPath);
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push(fieldPath);
    }
    if (isDemoLiveField(key, value)) {
      result.demoLiveFields.push(fieldPath);
    }
    if (isRecruiterExposureField(key, value)) {
      result.recruiterExposureFields.push(fieldPath);
    }
    const child = scanPrivacyValue(value, [...path, key], seen);
    result.forbiddenPayloadFields.push(...child.forbiddenPayloadFields);
    result.executableFields.push(...child.executableFields);
    result.demoLiveFields.push(...child.demoLiveFields);
    result.recruiterExposureFields.push(...child.recruiterExposureFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function hasDisabledEnforcementBoolean(input: unknown): boolean {
  return ENFORCEMENT_BOOLEAN_FIELDS.some(
    (field) => readBooleanField(input, field) !== true,
  );
}

function hasUnknownSurface(input: unknown): boolean {
  if (!input || typeof input !== "object") return true;
  const surfaces = (input as { applies_to_surfaces?: unknown })
    .applies_to_surfaces;
  if (!Array.isArray(surfaces)) return true;
  return (
    surfaces.length === 0 ||
    surfaces.some(
      (surface) => !CommandCenterSurfaceSchema.safeParse(surface).success,
    )
  );
}

function readPolicySurfaces(input: unknown): CommandCenterSurface[] {
  if (!input || typeof input !== "object") return [];
  const surfaces = (input as { applies_to_surfaces?: unknown })
    .applies_to_surfaces;
  if (!Array.isArray(surfaces)) return [];
  return surfaces.filter(
    (surface): surface is CommandCenterSurface =>
      CommandCenterSurfaceSchema.safeParse(surface).success,
  );
}

function hasDemoLiveUserData(input: unknown): boolean {
  return (
    scanPrivacyValue(input, [], new WeakSet<object>()).demoLiveFields.length > 0
  );
}

function hasRecruiterExposureMarker(input: unknown): boolean {
  return (
    scanPrivacyValue(input, [], new WeakSet<object>()).recruiterExposureFields
      .length > 0
  );
}

function isForbiddenPayloadField(key: string): boolean {
  return (
    COMMAND_CENTER_FORBIDDEN_UI_PAYLOAD_FIELD_ALIASES as readonly string[]
  ).includes(key);
}

function isDemoLiveField(key: string, value: unknown): boolean {
  if ((DEMO_FORBIDDEN_LIVE_MARKER_FIELDS as readonly string[]).includes(key)) {
    return value !== false;
  }
  if (key === "source_kind") {
    return value !== undefined && value !== "synthetic_build_time_dataset";
  }
  return false;
}

function isRecruiterExposureField(key: string, value: unknown): boolean {
  if (key === "hide_developer_console" || key === "hide_raw_metadata_tables") {
    return value !== true;
  }
  if (
    (RECRUITER_FORBIDDEN_EXPOSURE_MARKER_FIELDS as readonly string[]).includes(
      key,
    )
  ) {
    return value !== false;
  }
  return false;
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
    key === "remote_access_allowed" ||
    key === "export_allowed" ||
    key === "export_unredacted_allowed" ||
    key === "debug_actions_allowed" ||
    key === "writes_allowed"
  ) {
    return value !== false;
  }
  return (
    COMMAND_CENTER_PRIVACY_EXECUTABLE_AFFORDANCE_KEYS as readonly string[]
  ).includes(key);
}

function readBooleanField(input: unknown, field: string): boolean | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "boolean" ? value : undefined;
}

const ENFORCEMENT_BOOLEAN_FIELDS = [
  "metadata_only_required",
  "redaction_required",
  "render_safe_required",
  "non_executable_required",
  "raw_payloads_forbidden",
  "source_code_forbidden",
  "live_user_data_forbidden_in_demo",
  "remote_dashboard_forbidden",
  "export_unredacted_forbidden",
] as const;
