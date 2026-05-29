import { z } from "zod";

import {
  NEXT_ACTION_PRIORITIES,
  NEXT_ACTION_REDACTION_STATUSES,
  NEXT_ACTION_SUGGESTION_CLASSES,
  NextActionSuggestionSchema,
  type NextActionSuggestion,
} from "./next-action-suggestions";

export const SUGGESTION_INBOX_STATUSES = [
  "new",
  "seen",
  "dismissed",
  "acted",
] as const;

export const SUGGESTION_INBOX_TELEMETRY_EVENT_TYPES = [
  "suggestion_inbox_item_transitioned",
] as const;

export const PHASE_17_SUGGESTION_INBOX_STATUSES = [
  "unavailable",
  "pending",
  "dismissed",
  "accepted_metadata_only",
] as const;

export const PHASE_17_SUGGESTION_INBOX_VALIDATION_REASONS = [
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

export type SuggestionInboxStatus = (typeof SUGGESTION_INBOX_STATUSES)[number];
export type SuggestionInboxTelemetryEventType =
  (typeof SUGGESTION_INBOX_TELEMETRY_EVENT_TYPES)[number];
export type Phase17SuggestionInboxStatus =
  (typeof PHASE_17_SUGGESTION_INBOX_STATUSES)[number];
export type Phase17SuggestionInboxValidationReason =
  (typeof PHASE_17_SUGGESTION_INBOX_VALIDATION_REASONS)[number];

const AliasOrHashSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^(alias|hash):[a-z0-9._:-]+$/);

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const SuggestionIdSchema = z
  .string()
  .trim()
  .regex(/^suggestion:[a-f0-9]{8}$/);

const Phase17SuggestionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^suggestion:[a-z0-9._:-]+$/);

const Phase17InboxItemIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^inbox_item:[a-z0-9._:-]+$/);

export const SuggestionInboxStatusSchema = z.enum(SUGGESTION_INBOX_STATUSES);
export const SuggestionInboxTelemetryEventTypeSchema = z.enum(
  SUGGESTION_INBOX_TELEMETRY_EVENT_TYPES,
);
export const Phase17SuggestionInboxStatusSchema = z.enum(
  PHASE_17_SUGGESTION_INBOX_STATUSES,
);
export const Phase17SuggestionInboxValidationReasonSchema = z.enum(
  PHASE_17_SUGGESTION_INBOX_VALIDATION_REASONS,
);

export const SuggestionInboxItemSchema = z.strictObject({
  suggestion_id: SuggestionIdSchema,
  suggestion_class: z.enum(NEXT_ACTION_SUGGESTION_CLASSES),
  priority: z.enum(NEXT_ACTION_PRIORITIES),
  status: SuggestionInboxStatusSchema,
  source_event_hash: AliasOrHashSchema,
  project_id_hash: AliasOrHashSchema.nullable(),
  routine_id: RoutineIdSchema,
  created_at_ms: z.number().int().nonnegative(),
  updated_at_ms: z.number().int().nonnegative(),
  redaction_status: z.enum(NEXT_ACTION_REDACTION_STATUSES),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  inbox_only: z.literal(true),
  raw_body_included: z.literal(false),
  raw_content_included: z.literal(false),
  raw_project_text_included: z.literal(false),
  raw_task_text_included: z.literal(false),
  auto_action_performed: z.literal(false),
  approval_triggered: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  mutation_performed: z.literal(false),
  persisted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const SuggestionInboxTransitionSchema = z.strictObject({
  suggestion_id: SuggestionIdSchema,
  from_status: SuggestionInboxStatusSchema,
  to_status: SuggestionInboxStatusSchema,
  transitioned_at_ms: z.number().int().nonnegative(),
  allowed: z.literal(true),
  external_user_action_only: z.literal(true),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  raw_body_included: z.literal(false),
  raw_content_included: z.literal(false),
  raw_project_text_included: z.literal(false),
  raw_task_text_included: z.literal(false),
  auto_action_performed: z.literal(false),
  approval_triggered: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  mutation_performed: z.literal(false),
  persisted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const SuggestionInboxTransitionResultSchema = z.strictObject({
  item: SuggestionInboxItemSchema,
  transition: SuggestionInboxTransitionSchema,
});

export const SuggestionInboxTelemetryEventSchema = z.strictObject({
  event_type: SuggestionInboxTelemetryEventTypeSchema,
  transition_count: z.number().int().nonnegative(),
  from_status: SuggestionInboxStatusSchema,
  to_status: SuggestionInboxStatusSchema,
  acted_count: z.number().int().nonnegative(),
  dismissed_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  auto_action_performed: z.literal(false),
  approval_triggered: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  mutation_performed: z.literal(false),
  persisted: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const Phase17SuggestionInboxItemSchema = z.strictObject({
  inbox_item_id: Phase17InboxItemIdSchema,
  suggestion_id: Phase17SuggestionIdSchema,
  routine_id: RoutineIdSchema,
  inbox_status: Phase17SuggestionInboxStatusSchema,
  metadata_only: z.literal(true),
  inbox_item_created: z.literal(false),
  body_attached: z.literal(false),
  raw_body_allowed: z.literal(false),
  raw_content_allowed: z.literal(false),
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
  suggestion_generated: z.literal(false),
  report_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
  scheduler_execution_attempted: z.literal(false),
  routine_execution_attempted: z.literal(false),
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

export const Phase17SuggestionInboxValidationSchema = z.strictObject({
  kind: z.literal("phase17.suggestion_inbox_item_validation"),
  pass: z.boolean(),
  inbox_item_id: z.string().trim().min(1).max(180).nullable(),
  suggestion_id: z.string().trim().min(1).max(160).nullable(),
  inbox_status: Phase17SuggestionInboxStatusSchema.nullable(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(Phase17SuggestionInboxValidationReasonSchema),
  metadata_only: z.literal(true),
  inbox_item_created: z.literal(false),
  body_attached: z.literal(false),
  suggestion_generated: z.literal(false),
  report_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
  scheduler_execution_attempted: z.literal(false),
  routine_execution_attempted: z.literal(false),
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

export const Phase17SuggestionInboxSafetyBoundarySchema = z.strictObject({
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
  inbox_item_created: z.literal(false),
  body_attached: z.literal(false),
  suggestion_generated: z.literal(false),
  report_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
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

export const Phase17SuggestionInboxSafetyValidationSchema = z.strictObject({
  kind: z.literal("phase17.suggestion_inbox_safety_validation"),
  pass: z.boolean(),
  violation_count: z.number().int().nonnegative(),
  violations: z.array(Phase17SuggestionInboxValidationReasonSchema),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  redaction_supported: z.literal(false),
  redaction_attempted: z.literal(false),
  safety_review_required: z.literal(true),
  safety_review_supported: z.literal(false),
  safety_review_attempted: z.literal(false),
  inbox_item_created: z.literal(false),
  body_attached: z.literal(false),
  suggestion_generated: z.literal(false),
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

export const Phase17SuggestionInboxApprovalBridgeSchema = z.strictObject({
  approval_bridge_supported: z.literal(false),
  approval_bridge_attempted: z.literal(false),
  approval_reference_allowed: z.literal(false),
  approval_reference_present: z.literal(false),
  action_execution_supported: z.literal(false),
  action_execution_attempted: z.literal(false),
  approval_required_if_executed: z.literal(true),
  approval_state: z.literal("unavailable"),
  metadata_only: z.literal(true),
  inbox_item_created: z.literal(false),
  body_attached: z.literal(false),
  suggestion_generated: z.literal(false),
  report_generated: z.literal(false),
  baseline_update_generated: z.literal(false),
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

export const Phase17SuggestionInboxApprovalBridgeValidationSchema =
  z.strictObject({
    kind: z.literal("phase17.suggestion_inbox_approval_bridge_validation"),
    pass: z.boolean(),
    violation_count: z.number().int().nonnegative(),
    violations: z.array(Phase17SuggestionInboxValidationReasonSchema),
    metadata_only: z.literal(true),
    approval_bridge_supported: z.literal(false),
    approval_bridge_attempted: z.literal(false),
    approval_reference_allowed: z.literal(false),
    approval_reference_present: z.literal(false),
    action_execution_supported: z.literal(false),
    action_execution_attempted: z.literal(false),
    approval_required_if_executed: z.literal(true),
    approval_state: z.literal("unavailable"),
    inbox_item_created: z.literal(false),
    body_attached: z.literal(false),
    suggestion_generated: z.literal(false),
    report_generated: z.literal(false),
    baseline_update_generated: z.literal(false),
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

export type SuggestionInboxItem = z.infer<typeof SuggestionInboxItemSchema>;
export type SuggestionInboxTransition = z.infer<
  typeof SuggestionInboxTransitionSchema
>;
export type SuggestionInboxTransitionResult = z.infer<
  typeof SuggestionInboxTransitionResultSchema
>;
export type SuggestionInboxTelemetryEvent = z.infer<
  typeof SuggestionInboxTelemetryEventSchema
>;
export type Phase17SuggestionInboxItem = z.infer<
  typeof Phase17SuggestionInboxItemSchema
>;
export type Phase17SuggestionInboxValidation = z.infer<
  typeof Phase17SuggestionInboxValidationSchema
>;
export type Phase17SuggestionInboxSafetyBoundary = z.infer<
  typeof Phase17SuggestionInboxSafetyBoundarySchema
>;
export type Phase17SuggestionInboxSafetyValidation = z.infer<
  typeof Phase17SuggestionInboxSafetyValidationSchema
>;
export type Phase17SuggestionInboxApprovalBridge = z.infer<
  typeof Phase17SuggestionInboxApprovalBridgeSchema
>;
export type Phase17SuggestionInboxApprovalBridgeValidation = z.infer<
  typeof Phase17SuggestionInboxApprovalBridgeValidationSchema
>;

export const DEFAULT_PHASE_17_SUGGESTION_INBOX_SAFETY_BOUNDARY =
  Phase17SuggestionInboxSafetyBoundarySchema.parse({
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
    inbox_item_created: false,
    body_attached: false,
    suggestion_generated: false,
    report_generated: false,
    baseline_update_generated: false,
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

export const DEFAULT_PHASE_17_SUGGESTION_INBOX_APPROVAL_BRIDGE =
  Phase17SuggestionInboxApprovalBridgeSchema.parse({
    approval_bridge_supported: false,
    approval_bridge_attempted: false,
    approval_reference_allowed: false,
    approval_reference_present: false,
    action_execution_supported: false,
    action_execution_attempted: false,
    approval_required_if_executed: true,
    approval_state: "unavailable",
    metadata_only: true,
    inbox_item_created: false,
    body_attached: false,
    suggestion_generated: false,
    report_generated: false,
    baseline_update_generated: false,
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

const ALLOWED_TRANSITIONS = new Set<string>([
  "new->seen",
  "new->dismissed",
  "seen->dismissed",
  "seen->acted",
]);

export function createEmptySuggestionInboxItem(input: {
  readonly inbox_item_id: string;
  readonly suggestion_id: string;
  readonly routine_id: string;
  readonly inbox_status?: Phase17SuggestionInboxStatus;
}): Phase17SuggestionInboxItem {
  return Phase17SuggestionInboxItemSchema.parse({
    inbox_item_id: input.inbox_item_id,
    suggestion_id: input.suggestion_id,
    routine_id: input.routine_id,
    inbox_status: input.inbox_status ?? "unavailable",
    metadata_only: true,
    inbox_item_created: false,
    body_attached: false,
    raw_body_allowed: false,
    raw_content_allowed: false,
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
    suggestion_generated: false,
    report_generated: false,
    baseline_update_generated: false,
    scheduler_execution_attempted: false,
    routine_execution_attempted: false,
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

export function validateSuggestionInboxItem(
  input: unknown,
): Phase17SuggestionInboxValidation {
  const parsed = Phase17SuggestionInboxItemSchema.safeParse(input);
  const violations = new Set<Phase17SuggestionInboxValidationReason>(
    forbiddenPhase17InboxViolations(input),
  );

  if (!parsed.success) {
    violations.add("invalid_schema");
  }

  return Phase17SuggestionInboxValidationSchema.parse({
    kind: "phase17.suggestion_inbox_item_validation",
    pass: violations.size === 0,
    inbox_item_id: parsed.success ? parsed.data.inbox_item_id : null,
    suggestion_id: parsed.success ? parsed.data.suggestion_id : null,
    inbox_status: parsed.success ? parsed.data.inbox_status : null,
    violation_count: violations.size,
    violations: violations.size === 0 ? ["valid_schema"] : [...violations],
    metadata_only: true,
    inbox_item_created: false,
    body_attached: false,
    suggestion_generated: false,
    report_generated: false,
    baseline_update_generated: false,
    scheduler_execution_attempted: false,
    routine_execution_attempted: false,
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

export function validateSuggestionInboxSafety(
  input: unknown,
): Phase17SuggestionInboxSafetyValidation {
  const parsed = Phase17SuggestionInboxSafetyBoundarySchema.safeParse(input);
  const violations = new Set<Phase17SuggestionInboxValidationReason>(
    forbiddenPhase17InboxViolations(input),
  );

  if (!parsed.success) {
    violations.add("invalid_schema");
  }

  return Phase17SuggestionInboxSafetyValidationSchema.parse({
    kind: "phase17.suggestion_inbox_safety_validation",
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
    inbox_item_created: false,
    body_attached: false,
    suggestion_generated: false,
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

export function validateInboxApprovalBridge(
  input: unknown,
): Phase17SuggestionInboxApprovalBridgeValidation {
  const parsed = Phase17SuggestionInboxApprovalBridgeSchema.safeParse(input);
  const violations = new Set<Phase17SuggestionInboxValidationReason>(
    forbiddenPhase17InboxViolations(input),
  );

  if (!parsed.success) {
    violations.add("invalid_schema");
  }

  return Phase17SuggestionInboxApprovalBridgeValidationSchema.parse({
    kind: "phase17.suggestion_inbox_approval_bridge_validation",
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
    inbox_item_created: false,
    body_attached: false,
    suggestion_generated: false,
    report_generated: false,
    baseline_update_generated: false,
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

export function createSuggestionInboxItem(input: {
  suggestion: NextActionSuggestion;
  created_at_ms: number;
}): SuggestionInboxItem {
  const suggestion = NextActionSuggestionSchema.parse(input.suggestion);
  return SuggestionInboxItemSchema.parse({
    suggestion_id: suggestion.suggestion_id_hash,
    suggestion_class: suggestion.suggestion_class,
    priority: suggestion.priority,
    status: "new",
    source_event_hash: suggestion.source_event_hash,
    project_id_hash: suggestion.project_id_hash,
    routine_id: suggestion.routine_id,
    created_at_ms: input.created_at_ms,
    updated_at_ms: input.created_at_ms,
    redaction_status: "metadata_only",
    metadata_only: true,
    advisory_only: true,
    inbox_only: true,
    raw_body_included: false,
    raw_content_included: false,
    raw_project_text_included: false,
    raw_task_text_included: false,
    auto_action_performed: false,
    approval_triggered: false,
    tool_called: false,
    action_executed: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    mutation_performed: false,
    persisted: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
  });
}

function forbiddenPhase17InboxViolations(
  input: unknown,
): Phase17SuggestionInboxValidationReason[] {
  const violations = new Set<Phase17SuggestionInboxValidationReason>();

  visitUnknown(input, (key, value) => {
    const normalized = key.toLowerCase();
    if (/raw_body|body_text|body_attached/.test(normalized)) {
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

export function transitionSuggestionInboxItem(input: {
  item: SuggestionInboxItem;
  to_status: SuggestionInboxStatus;
  transitioned_at_ms: number;
}): SuggestionInboxTransitionResult {
  const item = SuggestionInboxItemSchema.parse(input.item);
  const toStatus = SuggestionInboxStatusSchema.parse(input.to_status);
  const transitionKey = `${item.status}->${toStatus}`;
  if (!ALLOWED_TRANSITIONS.has(transitionKey)) {
    throw new Error(`invalid suggestion inbox transition: ${transitionKey}`);
  }

  const updatedItem = SuggestionInboxItemSchema.parse({
    ...item,
    status: toStatus,
    updated_at_ms: input.transitioned_at_ms,
  });
  const transition = SuggestionInboxTransitionSchema.parse({
    suggestion_id: item.suggestion_id,
    from_status: item.status,
    to_status: toStatus,
    transitioned_at_ms: input.transitioned_at_ms,
    allowed: true,
    external_user_action_only: true,
    metadata_only: true,
    counts_and_flags_only: true,
    raw_body_included: false,
    raw_content_included: false,
    raw_project_text_included: false,
    raw_task_text_included: false,
    auto_action_performed: false,
    approval_triggered: false,
    tool_called: false,
    action_executed: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    mutation_performed: false,
    persisted: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
  });

  return SuggestionInboxTransitionResultSchema.parse({
    item: updatedItem,
    transition,
  });
}

export function createSuggestionInboxTelemetryEvent(
  transitionInput: SuggestionInboxTransition,
): SuggestionInboxTelemetryEvent {
  const transition = SuggestionInboxTransitionSchema.parse(transitionInput);
  return SuggestionInboxTelemetryEventSchema.parse({
    event_type: "suggestion_inbox_item_transitioned",
    transition_count: 1,
    from_status: transition.from_status,
    to_status: transition.to_status,
    acted_count: transition.to_status === "acted" ? 1 : 0,
    dismissed_count: transition.to_status === "dismissed" ? 1 : 0,
    metadata_only: true,
    counts_and_flags_only: true,
    auto_action_performed: false,
    approval_triggered: false,
    tool_called: false,
    action_executed: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    mutation_performed: false,
    persisted: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
  });
}
