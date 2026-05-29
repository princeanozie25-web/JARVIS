import { z } from "zod";

export const ROUTINE_SUGGESTION_KINDS = [
  "next_action",
  "cost_review",
  "project_progress",
  "calibration_review",
  "self_audit_followup",
] as const;

export const ROUTINE_SUGGESTION_REDACTION_STATUSES = [
  "not_started",
  "unavailable",
  "unsupported",
] as const;

export const ROUTINE_SUGGESTION_VALIDATION_REASONS = [
  "valid_schema",
  "invalid_schema",
  "raw_body_forbidden",
  "raw_content_forbidden",
  "raw_report_forbidden",
  "raw_source_snapshot_forbidden",
  "secret_forbidden",
  "pii_forbidden",
  "project_body_forbidden",
  "tool_output_forbidden",
  "prompt_forbidden",
  "model_output_forbidden",
  "action_payload_forbidden",
  "persistence_forbidden",
  "approval_or_action_forbidden",
  "approval_reference_forbidden",
] as const;

export type RoutineSuggestionKind = (typeof ROUTINE_SUGGESTION_KINDS)[number];
export type RoutineSuggestionRedactionStatus =
  (typeof ROUTINE_SUGGESTION_REDACTION_STATUSES)[number];
export type RoutineSuggestionValidationReason =
  (typeof ROUTINE_SUGGESTION_VALIDATION_REASONS)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const SuggestionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^suggestion:[a-z0-9._:-]+$/);

const SourceReportIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^self_audit_report:phase17:[a-z0-9._:-]+$/);

export const RoutineSuggestionKindSchema = z.enum(ROUTINE_SUGGESTION_KINDS);
export const RoutineSuggestionRedactionStatusSchema = z.enum(
  ROUTINE_SUGGESTION_REDACTION_STATUSES,
);
export const RoutineSuggestionValidationReasonSchema = z.enum(
  ROUTINE_SUGGESTION_VALIDATION_REASONS,
);

export const RoutineSuggestionSchema = z.strictObject({
  suggestion_id: SuggestionIdSchema,
  routine_id: RoutineIdSchema,
  source_report_id: SourceReportIdSchema.optional(),
  suggestion_kind: RoutineSuggestionKindSchema,
  metadata_only: z.literal(true),
  suggestion_generated: z.literal(false),
  body_generated: z.literal(false),
  raw_body_allowed: z.literal(false),
  raw_content_allowed: z.literal(false),
  redaction_required: z.literal(true),
  redaction_status: RoutineSuggestionRedactionStatusSchema,
  persistence_supported: z.literal(false),
  persistence_attempted: z.literal(false),
  approval_bridge_supported: z.literal(false),
  approval_bridge_attempted: z.literal(false),
  approval_reference_allowed: z.literal(false),
  approval_reference_present: z.literal(false),
  approval_required_if_executed: z.literal(true),
  approval_state: z.literal("unavailable"),
  action_execution_supported: z.literal(false),
  action_execution_attempted: z.literal(false),
  inbox_item_supported: z.literal(false),
  inbox_item_created: z.literal(false),
  report_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  telemetry_supported: z.literal(false),
  telemetry_attempted: z.literal(false),
  tool_called: z.literal(false),
  device_action_executed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  approval_executed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const RoutineSuggestionValidationSchema = z.strictObject({
  kind: z.literal("phase17.routine_suggestion_validation"),
  pass: z.boolean(),
  suggestion_id: z.string().trim().min(1).max(160).nullable(),
  suggestion_kind: RoutineSuggestionKindSchema.nullable(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(RoutineSuggestionValidationReasonSchema),
  metadata_only: z.literal(true),
  suggestion_generated: z.literal(false),
  body_generated: z.literal(false),
  inbox_item_created: z.literal(false),
  report_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
  persisted: z.literal(false),
  persistence_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  telemetry_attempted: z.literal(false),
  approval_bridge_attempted: z.literal(false),
  action_execution_attempted: z.literal(false),
  tool_called: z.literal(false),
  device_action_executed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  approval_executed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const RoutineSuggestionSafetyBoundarySchema = z.strictObject({
  redaction_required: z.literal(true),
  redaction_supported: z.literal(false),
  redaction_attempted: z.literal(false),
  safety_review_required: z.literal(true),
  safety_review_supported: z.literal(false),
  safety_review_attempted: z.literal(false),
  raw_body_allowed: z.literal(false),
  raw_report_allowed: z.literal(false),
  raw_source_snapshot_allowed: z.literal(false),
  pii_allowed: z.literal(false),
  secrets_allowed: z.literal(false),
  project_body_allowed: z.literal(false),
  tool_output_allowed: z.literal(false),
  prompt_allowed: z.literal(false),
  model_output_allowed: z.literal(false),
  action_payload_allowed: z.literal(false),
  metadata_only: z.literal(true),
  suggestion_generated: z.literal(false),
  body_generated: z.literal(false),
  body_attached: z.literal(false),
  inbox_item_created: z.literal(false),
  persistence_supported: z.literal(false),
  persistence_attempted: z.literal(false),
  approval_bridge_supported: z.literal(false),
  approval_bridge_attempted: z.literal(false),
  approval_reference_allowed: z.literal(false),
  approval_reference_present: z.literal(false),
  approval_required_if_executed: z.literal(true),
  approval_state: z.literal("unavailable"),
  action_execution_supported: z.literal(false),
  action_execution_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  telemetry_supported: z.literal(false),
  telemetry_attempted: z.literal(false),
  tool_called: z.literal(false),
  device_action_executed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  approval_executed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const RoutineSuggestionSafetyValidationSchema = z.strictObject({
  kind: z.literal("phase17.routine_suggestion_safety_validation"),
  pass: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(RoutineSuggestionValidationReasonSchema),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  redaction_supported: z.literal(false),
  redaction_attempted: z.literal(false),
  safety_review_required: z.literal(true),
  safety_review_supported: z.literal(false),
  safety_review_attempted: z.literal(false),
  suggestion_generated: z.literal(false),
  body_generated: z.literal(false),
  body_attached: z.literal(false),
  inbox_item_created: z.literal(false),
  persisted: z.literal(false),
  persistence_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  telemetry_attempted: z.literal(false),
  approval_bridge_attempted: z.literal(false),
  action_execution_attempted: z.literal(false),
  tool_called: z.literal(false),
  device_action_executed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  approval_executed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const RoutineSuggestionApprovalBridgeSchema = z.strictObject({
  approval_bridge_supported: z.literal(false),
  approval_bridge_attempted: z.literal(false),
  approval_reference_allowed: z.literal(false),
  approval_reference_present: z.literal(false),
  action_execution_supported: z.literal(false),
  action_execution_attempted: z.literal(false),
  approval_required_if_executed: z.literal(true),
  approval_state: z.literal("unavailable"),
  metadata_only: z.literal(true),
  suggestion_generated: z.literal(false),
  body_generated: z.literal(false),
  body_attached: z.literal(false),
  inbox_item_created: z.literal(false),
  persistence_supported: z.literal(false),
  persistence_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  telemetry_supported: z.literal(false),
  telemetry_attempted: z.literal(false),
  tool_called: z.literal(false),
  device_action_executed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  approval_created: z.literal(false),
  approval_executed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const RoutineSuggestionApprovalBridgeValidationSchema = z.strictObject({
  kind: z.literal("phase17.routine_suggestion_approval_bridge_validation"),
  pass: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(RoutineSuggestionValidationReasonSchema),
  metadata_only: z.literal(true),
  approval_bridge_supported: z.literal(false),
  approval_bridge_attempted: z.literal(false),
  approval_reference_allowed: z.literal(false),
  approval_reference_present: z.literal(false),
  action_execution_supported: z.literal(false),
  action_execution_attempted: z.literal(false),
  approval_required_if_executed: z.literal(true),
  approval_state: z.literal("unavailable"),
  suggestion_generated: z.literal(false),
  body_generated: z.literal(false),
  inbox_item_created: z.literal(false),
  persisted: z.literal(false),
  persistence_attempted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  event_store_write_performed: z.literal(false),
  telemetry_attempted: z.literal(false),
  tool_called: z.literal(false),
  device_action_executed: z.literal(false),
  project_mutated: z.literal(false),
  memory_written: z.literal(false),
  approval_created: z.literal(false),
  approval_executed: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export type RoutineSuggestion = z.infer<typeof RoutineSuggestionSchema>;
export type RoutineSuggestionValidation = z.infer<
  typeof RoutineSuggestionValidationSchema
>;
export type RoutineSuggestionSafetyBoundary = z.infer<
  typeof RoutineSuggestionSafetyBoundarySchema
>;
export type RoutineSuggestionSafetyValidation = z.infer<
  typeof RoutineSuggestionSafetyValidationSchema
>;
export type RoutineSuggestionApprovalBridge = z.infer<
  typeof RoutineSuggestionApprovalBridgeSchema
>;
export type RoutineSuggestionApprovalBridgeValidation = z.infer<
  typeof RoutineSuggestionApprovalBridgeValidationSchema
>;

export const DEFAULT_ROUTINE_SUGGESTION_SAFETY_BOUNDARY =
  RoutineSuggestionSafetyBoundarySchema.parse({
    redaction_required: true,
    redaction_supported: false,
    redaction_attempted: false,
    safety_review_required: true,
    safety_review_supported: false,
    safety_review_attempted: false,
    raw_body_allowed: false,
    raw_report_allowed: false,
    raw_source_snapshot_allowed: false,
    pii_allowed: false,
    secrets_allowed: false,
    project_body_allowed: false,
    tool_output_allowed: false,
    prompt_allowed: false,
    model_output_allowed: false,
    action_payload_allowed: false,
    metadata_only: true,
    suggestion_generated: false,
    body_generated: false,
    body_attached: false,
    inbox_item_created: false,
    persistence_supported: false,
    persistence_attempted: false,
    approval_bridge_supported: false,
    approval_bridge_attempted: false,
    approval_reference_allowed: false,
    approval_reference_present: false,
    approval_required_if_executed: true,
    approval_state: "unavailable",
    action_execution_supported: false,
    action_execution_attempted: false,
    db_read_performed: false,
    db_write_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    telemetry_supported: false,
    telemetry_attempted: false,
    tool_called: false,
    device_action_executed: false,
    project_mutated: false,
    memory_written: false,
    approval_executed: false,
    network_called: false,
    cloud_called: false,
  });

export const DEFAULT_ROUTINE_SUGGESTION_APPROVAL_BRIDGE =
  RoutineSuggestionApprovalBridgeSchema.parse({
    approval_bridge_supported: false,
    approval_bridge_attempted: false,
    approval_reference_allowed: false,
    approval_reference_present: false,
    action_execution_supported: false,
    action_execution_attempted: false,
    approval_required_if_executed: true,
    approval_state: "unavailable",
    metadata_only: true,
    suggestion_generated: false,
    body_generated: false,
    body_attached: false,
    inbox_item_created: false,
    persistence_supported: false,
    persistence_attempted: false,
    db_read_performed: false,
    db_write_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    telemetry_supported: false,
    telemetry_attempted: false,
    tool_called: false,
    device_action_executed: false,
    project_mutated: false,
    memory_written: false,
    approval_created: false,
    approval_executed: false,
    network_called: false,
    cloud_called: false,
  });

export function createEmptyRoutineSuggestion(input: {
  readonly suggestion_id: string;
  readonly routine_id: string;
  readonly suggestion_kind: RoutineSuggestionKind;
  readonly source_report_id?: string;
}): RoutineSuggestion {
  return RoutineSuggestionSchema.parse({
    suggestion_id: input.suggestion_id,
    routine_id: input.routine_id,
    source_report_id: input.source_report_id,
    suggestion_kind: input.suggestion_kind,
    metadata_only: true,
    suggestion_generated: false,
    body_generated: false,
    raw_body_allowed: false,
    raw_content_allowed: false,
    redaction_required: true,
    redaction_status: "not_started",
    persistence_supported: false,
    persistence_attempted: false,
    approval_bridge_supported: false,
    approval_bridge_attempted: false,
    approval_reference_allowed: false,
    approval_reference_present: false,
    approval_required_if_executed: true,
    approval_state: "unavailable",
    action_execution_supported: false,
    action_execution_attempted: false,
    inbox_item_supported: false,
    inbox_item_created: false,
    report_generated: false,
    baseline_update_generated: false,
    db_read_performed: false,
    db_write_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    telemetry_supported: false,
    telemetry_attempted: false,
    tool_called: false,
    device_action_executed: false,
    project_mutated: false,
    memory_written: false,
    approval_executed: false,
    network_called: false,
    cloud_called: false,
  });
}

export function validateRoutineSuggestion(
  input: unknown,
): RoutineSuggestionValidation {
  const parsed = RoutineSuggestionSchema.safeParse(input);
  const violations = new Set<RoutineSuggestionValidationReason>(
    forbiddenSuggestionViolations(input),
  );

  if (!parsed.success) {
    violations.add("invalid_schema");
  }

  return RoutineSuggestionValidationSchema.parse({
    kind: "phase17.routine_suggestion_validation",
    pass: violations.size === 0,
    suggestion_id: parsed.success ? parsed.data.suggestion_id : null,
    suggestion_kind: parsed.success ? parsed.data.suggestion_kind : null,
    violation_count: violations.size,
    violations: violations.size === 0 ? ["valid_schema"] : [...violations],
    metadata_only: true,
    suggestion_generated: false,
    body_generated: false,
    inbox_item_created: false,
    report_generated: false,
    baseline_update_generated: false,
    persisted: false,
    persistence_attempted: false,
    db_read_performed: false,
    db_write_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    telemetry_attempted: false,
    approval_bridge_attempted: false,
    action_execution_attempted: false,
    tool_called: false,
    device_action_executed: false,
    project_mutated: false,
    memory_written: false,
    approval_executed: false,
    network_called: false,
    cloud_called: false,
  });
}

export function validateRoutineSuggestionSafety(
  input: unknown,
): RoutineSuggestionSafetyValidation {
  const parsed = RoutineSuggestionSafetyBoundarySchema.safeParse(input);
  const violations = new Set<RoutineSuggestionValidationReason>(
    forbiddenSuggestionViolations(input),
  );

  if (!parsed.success) {
    violations.add("invalid_schema");
  }

  return RoutineSuggestionSafetyValidationSchema.parse({
    kind: "phase17.routine_suggestion_safety_validation",
    pass: violations.size === 0,
    violation_count: violations.size,
    violations: violations.size === 0 ? ["valid_schema"] : [...violations],
    metadata_only: true,
    redaction_required: true,
    redaction_supported: false,
    redaction_attempted: false,
    safety_review_required: true,
    safety_review_supported: false,
    safety_review_attempted: false,
    suggestion_generated: false,
    body_generated: false,
    body_attached: false,
    inbox_item_created: false,
    persisted: false,
    persistence_attempted: false,
    db_read_performed: false,
    db_write_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    telemetry_attempted: false,
    approval_bridge_attempted: false,
    action_execution_attempted: false,
    tool_called: false,
    device_action_executed: false,
    project_mutated: false,
    memory_written: false,
    approval_executed: false,
    network_called: false,
    cloud_called: false,
  });
}

export function validateSuggestionApprovalBridge(
  input: unknown,
): RoutineSuggestionApprovalBridgeValidation {
  const parsed = RoutineSuggestionApprovalBridgeSchema.safeParse(input);
  const violations = new Set<RoutineSuggestionValidationReason>(
    forbiddenSuggestionViolations(input),
  );

  if (!parsed.success) {
    violations.add("invalid_schema");
  }

  return RoutineSuggestionApprovalBridgeValidationSchema.parse({
    kind: "phase17.routine_suggestion_approval_bridge_validation",
    pass: violations.size === 0,
    violation_count: violations.size,
    violations: violations.size === 0 ? ["valid_schema"] : [...violations],
    metadata_only: true,
    approval_bridge_supported: false,
    approval_bridge_attempted: false,
    approval_reference_allowed: false,
    approval_reference_present: false,
    action_execution_supported: false,
    action_execution_attempted: false,
    approval_required_if_executed: true,
    approval_state: "unavailable",
    suggestion_generated: false,
    body_generated: false,
    inbox_item_created: false,
    persisted: false,
    persistence_attempted: false,
    db_read_performed: false,
    db_write_performed: false,
    event_store_read_performed: false,
    event_store_write_performed: false,
    telemetry_attempted: false,
    tool_called: false,
    device_action_executed: false,
    project_mutated: false,
    memory_written: false,
    approval_created: false,
    approval_executed: false,
    network_called: false,
    cloud_called: false,
  });
}

function forbiddenSuggestionViolations(
  input: unknown,
): RoutineSuggestionValidationReason[] {
  const violations = new Set<RoutineSuggestionValidationReason>();

  visitUnknown(input, (key, value) => {
    const normalized = key.toLowerCase();
    if (/raw_body|body_text|body_generated/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("raw_body_forbidden");
      }
    }
    if (/raw_content|content|raw_payload/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("raw_content_forbidden");
      }
    }
    if (/raw_report|report_body|report_text/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("raw_report_forbidden");
      }
    }
    if (/raw_source_snapshot|source_snapshot/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("raw_source_snapshot_forbidden");
      }
    }
    if (/secret|token|password|api_key|apikey/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("secret_forbidden");
      }
    }
    if (/pii|email|phone|address/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("pii_forbidden");
      }
    }
    if (/project_body|project_content/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("project_body_forbidden");
      }
    }
    if (/tool_output/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("tool_output_forbidden");
      }
    }
    if (/prompt/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("prompt_forbidden");
      }
    }
    if (/model_output|model_response|llm_output/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("model_output_forbidden");
      }
    }
    if (/action_payload/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("action_payload_forbidden");
      }
    }
    if (/persist|db_write|event_store_write/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("persistence_forbidden");
      }
    }
    if (/approval_reference|approval_id/.test(normalized)) {
      if (value !== false && value !== undefined) {
        violations.add("approval_reference_forbidden");
      }
    }
    if (
      /approval|action_execution|action_executed/.test(normalized) &&
      normalized !== "approval_required_if_executed" &&
      normalized !== "approval_state"
    ) {
      if (value !== false && value !== undefined) {
        violations.add("approval_or_action_forbidden");
      }
    }
  });

  return [...violations];
}

function visitUnknown(
  input: unknown,
  visit: (key: string, value: unknown) => void,
): void {
  if (!input || typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    visit(key, value);
    visitUnknown(value, visit);
  }
}
