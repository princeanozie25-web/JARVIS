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

export type SuggestionInboxStatus = (typeof SUGGESTION_INBOX_STATUSES)[number];
export type SuggestionInboxTelemetryEventType =
  (typeof SUGGESTION_INBOX_TELEMETRY_EVENT_TYPES)[number];

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

export const SuggestionInboxStatusSchema = z.enum(SUGGESTION_INBOX_STATUSES);
export const SuggestionInboxTelemetryEventTypeSchema = z.enum(
  SUGGESTION_INBOX_TELEMETRY_EVENT_TYPES,
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

const ALLOWED_TRANSITIONS = new Set<string>([
  "new->seen",
  "new->dismissed",
  "seen->dismissed",
  "seen->acted",
]);

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
