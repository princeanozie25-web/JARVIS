import { z } from "zod";

export const NEXT_ACTION_SUGGESTION_CLASSES = [
  "review_failure",
  "check_cost",
  "inspect_project_blocker",
  "review_calibration_drift",
  "review_denied_action",
  "continue_project",
] as const;

export const NEXT_ACTION_PRIORITIES = ["low", "medium", "high"] as const;

export const NEXT_ACTION_SUGGESTION_STATUSES = ["proposed"] as const;

export const NEXT_ACTION_REDACTION_STATUSES = [
  "metadata_only",
  "redacted",
] as const;

export const NEXT_ACTION_TELEMETRY_EVENT_TYPES = [
  "next_action_suggestions_generated",
] as const;

export type NextActionSuggestionClass =
  (typeof NEXT_ACTION_SUGGESTION_CLASSES)[number];
export type NextActionPriority = (typeof NEXT_ACTION_PRIORITIES)[number];
export type NextActionSuggestionStatus =
  (typeof NEXT_ACTION_SUGGESTION_STATUSES)[number];
export type NextActionRedactionStatus =
  (typeof NEXT_ACTION_REDACTION_STATUSES)[number];
export type NextActionTelemetryEventType =
  (typeof NEXT_ACTION_TELEMETRY_EVENT_TYPES)[number];

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

const SuggestionIdHashSchema = z
  .string()
  .trim()
  .regex(/^suggestion:[a-f0-9]{8}$/);

export const NextActionSuggestionClassSchema = z.enum(
  NEXT_ACTION_SUGGESTION_CLASSES,
);
export const NextActionPrioritySchema = z.enum(NEXT_ACTION_PRIORITIES);
export const NextActionSuggestionStatusSchema = z.enum(
  NEXT_ACTION_SUGGESTION_STATUSES,
);
export const NextActionRedactionStatusSchema = z.enum(
  NEXT_ACTION_REDACTION_STATUSES,
);
export const NextActionTelemetryEventTypeSchema = z.enum(
  NEXT_ACTION_TELEMETRY_EVENT_TYPES,
);

export const NextActionSuggestionInputSchema = z.strictObject({
  source_event_hash: AliasOrHashSchema,
  project_id_hash: AliasOrHashSchema.nullable().default(null),
  routine_id: RoutineIdSchema,
  suggestion_class: NextActionSuggestionClassSchema,
  signal_count: z.number().int().nonnegative().default(1),
  observed_at_ms: z.number().int().nonnegative(),
  redaction_status: NextActionRedactionStatusSchema,
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  raw_content_included: z.literal(false),
  raw_body_included: z.literal(false),
  raw_project_text_included: z.literal(false),
  raw_task_text_included: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  mutation_performed: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const NextActionSuggestionSchema = z.strictObject({
  suggestion_id_hash: SuggestionIdHashSchema,
  suggestion_class: NextActionSuggestionClassSchema,
  priority: NextActionPrioritySchema,
  status: NextActionSuggestionStatusSchema,
  source_event_hash: AliasOrHashSchema,
  project_id_hash: AliasOrHashSchema.nullable(),
  routine_id: RoutineIdSchema,
  rank: z.number().int().positive(),
  advisory_only: z.literal(true),
  inbox_only: z.literal(true),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
  raw_content_included: z.literal(false),
  raw_project_text_included: z.literal(false),
  raw_task_text_included: z.literal(false),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  mutation_performed: z.literal(false),
  persisted: z.literal(false),
});

export const SuggestionEngineResultSchema = z.strictObject({
  suggestions: z.array(NextActionSuggestionSchema).max(5),
  input_count: z.number().int().nonnegative(),
  output_count: z.number().int().nonnegative().max(5),
  output_cap: z.number().int().positive().max(5),
  omitted_count: z.number().int().nonnegative(),
  redaction_status: NextActionRedactionStatusSchema,
  truncated: z.boolean(),
  deterministic: z.literal(true),
  rule_based: z.literal(true),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  inbox_only: z.literal(true),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  mutation_performed: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export const NextActionSuggestionTelemetryEventSchema = z.strictObject({
  event_type: NextActionTelemetryEventTypeSchema,
  input_count: z.number().int().nonnegative(),
  output_count: z.number().int().nonnegative().max(5),
  omitted_count: z.number().int().nonnegative(),
  high_count: z.number().int().nonnegative(),
  medium_count: z.number().int().nonnegative(),
  low_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  action_executed: z.literal(false),
  approval_triggered: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  mutation_performed: z.literal(false),
  db_read_performed: z.literal(false),
  db_write_performed: z.literal(false),
  provider_called: z.literal(false),
  llm_called: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
});

export type NextActionSuggestionInput = z.input<
  typeof NextActionSuggestionInputSchema
>;
export type NextActionSuggestion = z.infer<typeof NextActionSuggestionSchema>;
export type SuggestionEngineResult = z.infer<
  typeof SuggestionEngineResultSchema
>;
export type NextActionSuggestionTelemetryEvent = z.infer<
  typeof NextActionSuggestionTelemetryEventSchema
>;

const PRIORITY_BY_CLASS: Record<NextActionSuggestionClass, NextActionPriority> =
  {
    review_failure: "high",
    review_denied_action: "high",
    inspect_project_blocker: "high",
    check_cost: "medium",
    review_calibration_drift: "medium",
    continue_project: "low",
  };

const PRIORITY_RANK: Record<NextActionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const CLASS_RANK = new Map<NextActionSuggestionClass, number>(
  NEXT_ACTION_SUGGESTION_CLASSES.map((item, index) => [item, index]),
);

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `suggestion:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function rankNextActionPriority(
  suggestionClass: NextActionSuggestionClass,
): NextActionPriority {
  return PRIORITY_BY_CLASS[suggestionClass];
}

function suggestionFromInput(
  input: z.infer<typeof NextActionSuggestionInputSchema>,
  rank: number,
): NextActionSuggestion {
  return NextActionSuggestionSchema.parse({
    suggestion_id_hash: stableHash(
      JSON.stringify({
        source_event_hash: input.source_event_hash,
        project_id_hash: input.project_id_hash,
        routine_id: input.routine_id,
        suggestion_class: input.suggestion_class,
      }),
    ),
    suggestion_class: input.suggestion_class,
    priority: rankNextActionPriority(input.suggestion_class),
    status: "proposed",
    source_event_hash: input.source_event_hash,
    project_id_hash: input.project_id_hash,
    routine_id: input.routine_id,
    rank,
    advisory_only: true,
    inbox_only: true,
    metadata_only: true,
    raw_body_included: false,
    raw_content_included: false,
    raw_project_text_included: false,
    raw_task_text_included: false,
    action_executed: false,
    approval_triggered: false,
    tool_called: false,
    memory_written: false,
    mutation_performed: false,
    persisted: false,
  });
}

export function generateNextActionSuggestions(input: {
  events: NextActionSuggestionInput[];
  output_cap?: number;
}): SuggestionEngineResult {
  const outputCap = Math.min(input.output_cap ?? 5, 5);
  const parsedEvents = input.events.map((event) =>
    NextActionSuggestionInputSchema.parse(event),
  );
  const sortedEvents = [...parsedEvents].sort((left, right) => {
    const leftPriority = rankNextActionPriority(left.suggestion_class);
    const rightPriority = rankNextActionPriority(right.suggestion_class);
    return (
      PRIORITY_RANK[leftPriority] - PRIORITY_RANK[rightPriority] ||
      CLASS_RANK.get(left.suggestion_class)! -
        CLASS_RANK.get(right.suggestion_class)! ||
      right.signal_count - left.signal_count ||
      left.source_event_hash.localeCompare(right.source_event_hash)
    );
  });
  const suggestions = sortedEvents
    .slice(0, outputCap)
    .map((event, index) => suggestionFromInput(event, index + 1));

  return SuggestionEngineResultSchema.parse({
    suggestions,
    input_count: parsedEvents.length,
    output_count: suggestions.length,
    output_cap: outputCap,
    omitted_count: Math.max(parsedEvents.length - suggestions.length, 0),
    redaction_status: parsedEvents.some(
      (event) => event.redaction_status === "redacted",
    )
      ? "redacted"
      : "metadata_only",
    truncated:
      parsedEvents.some((event) => event.truncated) ||
      suggestions.length < parsedEvents.length,
    deterministic: true,
    rule_based: true,
    metadata_only: true,
    advisory_only: true,
    inbox_only: true,
    action_executed: false,
    approval_triggered: false,
    tool_called: false,
    memory_written: false,
    mutation_performed: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
  });
}

export function createNextActionSuggestionsTelemetryEvent(
  resultInput: SuggestionEngineResult,
): NextActionSuggestionTelemetryEvent {
  const result = SuggestionEngineResultSchema.parse(resultInput);
  return NextActionSuggestionTelemetryEventSchema.parse({
    event_type: "next_action_suggestions_generated",
    input_count: result.input_count,
    output_count: result.output_count,
    omitted_count: result.omitted_count,
    high_count: result.suggestions.filter(
      (suggestion) => suggestion.priority === "high",
    ).length,
    medium_count: result.suggestions.filter(
      (suggestion) => suggestion.priority === "medium",
    ).length,
    low_count: result.suggestions.filter(
      (suggestion) => suggestion.priority === "low",
    ).length,
    truncated: result.truncated,
    metadata_only: true,
    counts_and_flags_only: true,
    action_executed: false,
    approval_triggered: false,
    tool_called: false,
    memory_written: false,
    mutation_performed: false,
    db_read_performed: false,
    db_write_performed: false,
    provider_called: false,
    llm_called: false,
    network_called: false,
    cloud_called: false,
  });
}
