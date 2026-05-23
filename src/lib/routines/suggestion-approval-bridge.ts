import { z } from "zod";

import {
  SUGGESTION_INBOX_STATUSES,
  SuggestionInboxItemSchema,
  type SuggestionInboxItem,
} from "./suggestion-inbox";

export const SUGGESTION_APPROVAL_BRIDGE_ALLOWED_ORIGINS = [
  "user_click",
  "user_typed_command",
] as const;

export const SUGGESTION_APPROVAL_BRIDGE_BLOCKED_ORIGINS = [
  "routine",
  "scheduler",
  "voice",
  "system_auto",
  "background",
] as const;

export const SUGGESTION_APPROVAL_BRIDGE_ORIGINS = [
  ...SUGGESTION_APPROVAL_BRIDGE_ALLOWED_ORIGINS,
  ...SUGGESTION_APPROVAL_BRIDGE_BLOCKED_ORIGINS,
] as const;

export const SUGGESTION_APPROVAL_BRIDGE_DECISION_STATES = [
  "eligible_for_existing_approval_flow",
  "blocked",
  "invalid",
] as const;

export const SUGGESTION_APPROVAL_BRIDGE_REASONS = [
  "eligible_user_action",
  "blocked_origin",
  "user_action_required",
  "invalid_request",
] as const;

export const SUGGESTION_APPROVAL_BRIDGE_TELEMETRY_EVENT_TYPES = [
  "suggestion_approval_bridge_evaluated",
] as const;

export type SuggestionApprovalBridgeOrigin =
  (typeof SUGGESTION_APPROVAL_BRIDGE_ORIGINS)[number];
export type SuggestionApprovalBridgeDecisionState =
  (typeof SUGGESTION_APPROVAL_BRIDGE_DECISION_STATES)[number];
export type SuggestionApprovalBridgeReason =
  (typeof SUGGESTION_APPROVAL_BRIDGE_REASONS)[number];
export type SuggestionApprovalBridgeTelemetryEventType =
  (typeof SUGGESTION_APPROVAL_BRIDGE_TELEMETRY_EVENT_TYPES)[number];

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

export const SuggestionApprovalBridgeOriginSchema = z.enum(
  SUGGESTION_APPROVAL_BRIDGE_ORIGINS,
);
export const SuggestionApprovalBridgeDecisionStateSchema = z.enum(
  SUGGESTION_APPROVAL_BRIDGE_DECISION_STATES,
);
export const SuggestionApprovalBridgeReasonSchema = z.enum(
  SUGGESTION_APPROVAL_BRIDGE_REASONS,
);
export const SuggestionApprovalBridgeTelemetryEventTypeSchema = z.enum(
  SUGGESTION_APPROVAL_BRIDGE_TELEMETRY_EVENT_TYPES,
);

export const SuggestionApprovalBridgeRequestSchema = z.strictObject({
  suggestion_id: SuggestionIdSchema,
  suggestion_status: z.enum(SUGGESTION_INBOX_STATUSES),
  request_origin: SuggestionApprovalBridgeOriginSchema,
  user_selected: z.boolean(),
  source_event_hash: AliasOrHashSchema,
  project_id_hash: AliasOrHashSchema.nullable(),
  routine_id: RoutineIdSchema,
  requested_at_ms: z.number().int().nonnegative(),
  redaction_status: z.enum(["metadata_only", "redacted"]),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
  raw_content_included: z.literal(false),
  raw_project_text_included: z.literal(false),
  raw_task_text_included: z.literal(false),
  bridge_only: z.literal(true),
  existing_approval_flow_only: z.literal(true),
  approval_granted: z.literal(false),
  approval_created: z.literal(false),
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

export const SuggestionApprovalBridgeDecisionSchema = z.strictObject({
  decision_state: SuggestionApprovalBridgeDecisionStateSchema,
  reason: SuggestionApprovalBridgeReasonSchema,
  suggestion_id: SuggestionIdSchema.nullable(),
  request_origin: SuggestionApprovalBridgeOriginSchema.nullable(),
  source_event_hash: AliasOrHashSchema.nullable(),
  project_id_hash: AliasOrHashSchema.nullable(),
  routine_id: RoutineIdSchema.nullable(),
  requested_at_ms: z.number().int().nonnegative().nullable(),
  metadata_for_existing_approval_flow: z
    .strictObject({
      suggestion_id: SuggestionIdSchema,
      source_event_hash: AliasOrHashSchema,
      project_id_hash: AliasOrHashSchema.nullable(),
      routine_id: RoutineIdSchema,
    })
    .nullable(),
  user_action_required: z.boolean(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  raw_body_included: z.literal(false),
  raw_content_included: z.literal(false),
  raw_project_text_included: z.literal(false),
  raw_task_text_included: z.literal(false),
  bridge_only: z.literal(true),
  existing_approval_flow_only: z.literal(true),
  approval_granted: z.literal(false),
  approval_created: z.literal(false),
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

export const SuggestionApprovalBridgeTelemetryEventSchema = z.strictObject({
  event_type: SuggestionApprovalBridgeTelemetryEventTypeSchema,
  eligible_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  invalid_count: z.number().int().nonnegative(),
  request_origin: SuggestionApprovalBridgeOriginSchema.nullable(),
  decision_state: SuggestionApprovalBridgeDecisionStateSchema,
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  approval_granted: z.literal(false),
  approval_created: z.literal(false),
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

export type SuggestionApprovalBridgeRequest = z.infer<
  typeof SuggestionApprovalBridgeRequestSchema
>;
export type SuggestionApprovalBridgeDecision = z.infer<
  typeof SuggestionApprovalBridgeDecisionSchema
>;
export type SuggestionApprovalBridgeTelemetryEvent = z.infer<
  typeof SuggestionApprovalBridgeTelemetryEventSchema
>;

const BLOCKED_ORIGINS = new Set<string>(
  SUGGESTION_APPROVAL_BRIDGE_BLOCKED_ORIGINS,
);

function baseDecision(
  values: Pick<
    SuggestionApprovalBridgeDecision,
    | "decision_state"
    | "reason"
    | "suggestion_id"
    | "request_origin"
    | "source_event_hash"
    | "project_id_hash"
    | "routine_id"
    | "requested_at_ms"
    | "metadata_for_existing_approval_flow"
    | "user_action_required"
  >,
): SuggestionApprovalBridgeDecision {
  return SuggestionApprovalBridgeDecisionSchema.parse({
    ...values,
    metadata_only: true,
    counts_and_flags_only: true,
    raw_body_included: false,
    raw_content_included: false,
    raw_project_text_included: false,
    raw_task_text_included: false,
    bridge_only: true,
    existing_approval_flow_only: true,
    approval_granted: false,
    approval_created: false,
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

export function createSuggestionApprovalBridgeRequest(input: {
  item: SuggestionInboxItem;
  request_origin: SuggestionApprovalBridgeOrigin;
  user_selected: boolean;
  requested_at_ms: number;
}): SuggestionApprovalBridgeRequest {
  const item = SuggestionInboxItemSchema.parse(input.item);
  return SuggestionApprovalBridgeRequestSchema.parse({
    suggestion_id: item.suggestion_id,
    suggestion_status: item.status,
    request_origin: input.request_origin,
    user_selected: input.user_selected,
    source_event_hash: item.source_event_hash,
    project_id_hash: item.project_id_hash,
    routine_id: item.routine_id,
    requested_at_ms: input.requested_at_ms,
    redaction_status: item.redaction_status,
    metadata_only: true,
    raw_body_included: false,
    raw_content_included: false,
    raw_project_text_included: false,
    raw_task_text_included: false,
    bridge_only: true,
    existing_approval_flow_only: true,
    approval_granted: false,
    approval_created: false,
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

export function evaluateSuggestionApprovalBridge(
  input: unknown,
): SuggestionApprovalBridgeDecision {
  const parsed = SuggestionApprovalBridgeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return baseDecision({
      decision_state: "invalid",
      reason: "invalid_request",
      suggestion_id: null,
      request_origin: null,
      source_event_hash: null,
      project_id_hash: null,
      routine_id: null,
      requested_at_ms: null,
      metadata_for_existing_approval_flow: null,
      user_action_required: true,
    });
  }

  const request = parsed.data;
  if (BLOCKED_ORIGINS.has(request.request_origin)) {
    return baseDecision({
      decision_state: "blocked",
      reason: "blocked_origin",
      suggestion_id: request.suggestion_id,
      request_origin: request.request_origin,
      source_event_hash: request.source_event_hash,
      project_id_hash: request.project_id_hash,
      routine_id: request.routine_id,
      requested_at_ms: request.requested_at_ms,
      metadata_for_existing_approval_flow: null,
      user_action_required: true,
    });
  }

  if (request.suggestion_status !== "acted" && !request.user_selected) {
    return baseDecision({
      decision_state: "blocked",
      reason: "user_action_required",
      suggestion_id: request.suggestion_id,
      request_origin: request.request_origin,
      source_event_hash: request.source_event_hash,
      project_id_hash: request.project_id_hash,
      routine_id: request.routine_id,
      requested_at_ms: request.requested_at_ms,
      metadata_for_existing_approval_flow: null,
      user_action_required: true,
    });
  }

  return baseDecision({
    decision_state: "eligible_for_existing_approval_flow",
    reason: "eligible_user_action",
    suggestion_id: request.suggestion_id,
    request_origin: request.request_origin,
    source_event_hash: request.source_event_hash,
    project_id_hash: request.project_id_hash,
    routine_id: request.routine_id,
    requested_at_ms: request.requested_at_ms,
    metadata_for_existing_approval_flow: {
      suggestion_id: request.suggestion_id,
      source_event_hash: request.source_event_hash,
      project_id_hash: request.project_id_hash,
      routine_id: request.routine_id,
    },
    user_action_required: false,
  });
}

export function createSuggestionApprovalBridgeTelemetryEvent(
  decisionInput: SuggestionApprovalBridgeDecision,
): SuggestionApprovalBridgeTelemetryEvent {
  const decision = SuggestionApprovalBridgeDecisionSchema.parse(decisionInput);
  return SuggestionApprovalBridgeTelemetryEventSchema.parse({
    event_type: "suggestion_approval_bridge_evaluated",
    eligible_count:
      decision.decision_state === "eligible_for_existing_approval_flow" ? 1 : 0,
    blocked_count: decision.decision_state === "blocked" ? 1 : 0,
    invalid_count: decision.decision_state === "invalid" ? 1 : 0,
    request_origin: decision.request_origin,
    decision_state: decision.decision_state,
    metadata_only: true,
    counts_and_flags_only: true,
    approval_granted: false,
    approval_created: false,
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
