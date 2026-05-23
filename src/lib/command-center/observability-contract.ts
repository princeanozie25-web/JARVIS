import { z } from "zod";

import {
  COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS,
  type CommandCenterForbiddenRenderPayloadField,
} from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";

export const COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES = [
  "router",
  "tool_calls",
  "approvals",
  "costs",
  "safety",
  "vision",
  "environment",
  "projects",
  "routines",
  "suggestions",
  "traces",
  "governance_boundaries",
  "runtime_dependencies",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS = [
  "mutate",
  "execute_tool",
  "approve",
  "deny",
  "retry_trace",
  "run_trace",
  "rerun_routine",
  "enable_routine",
  "disable_routine",
  "schedule_routine",
  "write_memory",
  "write_project",
  "device_action",
  "cloud_fallback_toggle",
  "export_unredacted",
  "remote_dashboard_publish",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_ALLOWED_ACTIONS = [
  "read_query",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_REDACTION_STATUSES = [
  "redacted",
  "fully_withheld",
  "metadata_only",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_SCOPE_TYPES = [
  "mode",
  "session",
  "project",
  "global",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_TIME_WINDOW_BANDS = [
  "latest",
  "recent",
  "session",
  "custom_metadata",
] as const;

export const COMMAND_CENTER_OBSERVABILITY_VALIDATION_REASONS = [
  "read_only_metadata_query",
  "schema_rejected",
  "raw_payload_field_present",
  "mode_not_read_only",
  "redaction_not_required",
  "forbidden_action",
  "unknown_action",
] as const;

export const CommandCenterObservabilityQueryCategorySchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_QUERY_CATEGORIES,
);
export const CommandCenterObservabilityForbiddenActionSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS,
);
export const CommandCenterObservabilityAllowedActionSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_ALLOWED_ACTIONS,
);
export const CommandCenterObservabilityRedactionStatusSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_REDACTION_STATUSES,
);
export const CommandCenterObservabilityScopeTypeSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_SCOPE_TYPES,
);
export const CommandCenterObservabilityTimeWindowBandSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_TIME_WINDOW_BANDS,
);
export const CommandCenterObservabilityValidationReasonSchema = z.enum(
  COMMAND_CENTER_OBSERVABILITY_VALIDATION_REASONS,
);

const ObservabilityIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

export const CommandCenterObservabilityScopeMetadataSchema = z.strictObject({
  scope_type: CommandCenterObservabilityScopeTypeSchema,
  scope_ref: ObservabilityIdSchema.optional(),
  metadata_only: z.literal(true),
  raw_identifiers_included: z.literal(false),
});

export const CommandCenterObservabilityQueryRequestSchema = z.strictObject({
  kind: z.literal("command_center.observability_query_request"),
  query_id: ObservabilityIdSchema,
  category: CommandCenterObservabilityQueryCategorySchema,
  time_window: CommandCenterObservabilityTimeWindowBandSchema.optional(),
  scope: CommandCenterObservabilityScopeMetadataSchema.optional(),
  max_items: z.number().int().min(1).max(100),
  redaction_required: z.literal(true),
  mode: z.literal("read_only"),
  metadata_only: z.literal(true),
  raw_payloads_allowed: z.literal(false),
});

export const CommandCenterObservabilityPayloadItemSchema = z.strictObject({
  item_id: ObservabilityIdSchema,
  item_class: z.string().trim().min(1).max(80),
  status: z.string().trim().min(1).max(80).optional(),
  count_band: z.enum(["none", "low", "medium", "high", "unknown"]).optional(),
  redaction_status: CommandCenterObservabilityRedactionStatusSchema,
  metadata_only: z.literal(true),
  raw_payload_included: z.literal(false),
});

export const CommandCenterObservabilityResponseEnvelopeSchema = z.strictObject({
  kind: z.literal("command_center.observability_response_envelope"),
  query_id: ObservabilityIdSchema,
  category: CommandCenterObservabilityQueryCategorySchema,
  generated_at: z.number().int().nonnegative(),
  redaction_status: CommandCenterObservabilityRedactionStatusSchema,
  payload: z.array(CommandCenterObservabilityPayloadItemSchema),
  withheld_fields: z.array(z.string().trim().min(1).max(120)),
  truncated: z.boolean(),
  replay_safe: z.boolean(),
  render_safe: z.boolean(),
  metadata_only: z.literal(true),
  raw_payloads_included: z.literal(false),
  exact_pii_included: z.literal(false),
});

export const CommandCenterObservabilityRequestValidationSchema = z.strictObject(
  {
    passed: z.boolean(),
    reason: CommandCenterObservabilityValidationReasonSchema,
    query_id: ObservabilityIdSchema.nullable(),
    category: CommandCenterObservabilityQueryCategorySchema.nullable(),
    read_only: z.boolean(),
    metadata_only: z.literal(true),
    redaction_required: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
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
  },
);

export const CommandCenterObservabilityActionValidationSchema = z.strictObject({
  action: z.string().trim().min(1).max(120),
  allowed: z.boolean(),
  reason: CommandCenterObservabilityValidationReasonSchema,
  read_only_query_action: z.boolean(),
  mutating_action: z.literal(false),
  metadata_only: z.literal(true),
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

export type CommandCenterObservabilityQueryCategory = z.infer<
  typeof CommandCenterObservabilityQueryCategorySchema
>;
export type CommandCenterObservabilityForbiddenAction = z.infer<
  typeof CommandCenterObservabilityForbiddenActionSchema
>;
export type CommandCenterObservabilityAllowedAction = z.infer<
  typeof CommandCenterObservabilityAllowedActionSchema
>;
export type CommandCenterObservabilityRedactionStatus = z.infer<
  typeof CommandCenterObservabilityRedactionStatusSchema
>;
export type CommandCenterObservabilityScopeType = z.infer<
  typeof CommandCenterObservabilityScopeTypeSchema
>;
export type CommandCenterObservabilityTimeWindowBand = z.infer<
  typeof CommandCenterObservabilityTimeWindowBandSchema
>;
export type CommandCenterObservabilityValidationReason = z.infer<
  typeof CommandCenterObservabilityValidationReasonSchema
>;
export type CommandCenterObservabilityScopeMetadata = z.infer<
  typeof CommandCenterObservabilityScopeMetadataSchema
>;
export type CommandCenterObservabilityQueryRequest = z.infer<
  typeof CommandCenterObservabilityQueryRequestSchema
>;
export type CommandCenterObservabilityPayloadItem = z.infer<
  typeof CommandCenterObservabilityPayloadItemSchema
>;
export type CommandCenterObservabilityResponseEnvelope = z.infer<
  typeof CommandCenterObservabilityResponseEnvelopeSchema
>;
export type CommandCenterObservabilityRequestValidation = z.infer<
  typeof CommandCenterObservabilityRequestValidationSchema
>;
export type CommandCenterObservabilityActionValidation = z.infer<
  typeof CommandCenterObservabilityActionValidationSchema
>;

export function createCommandCenterObservabilityQueryRequest(input: {
  query_id: string;
  category: CommandCenterObservabilityQueryCategory;
  time_window?: CommandCenterObservabilityTimeWindowBand;
  scope?: CommandCenterObservabilityScopeMetadata;
  max_items?: number;
}): CommandCenterObservabilityQueryRequest {
  return CommandCenterObservabilityQueryRequestSchema.parse({
    kind: "command_center.observability_query_request",
    query_id: input.query_id,
    category: input.category,
    time_window: input.time_window ?? "latest",
    scope: input.scope,
    max_items: input.max_items ?? 25,
    redaction_required: true,
    mode: "read_only",
    metadata_only: true,
    raw_payloads_allowed: false,
  });
}

export function createCommandCenterObservabilityResponseEnvelope(input: {
  query_id: string;
  category: CommandCenterObservabilityQueryCategory;
  generated_at?: number;
  payload?: CommandCenterObservabilityPayloadItem[];
  withheld_fields?: string[];
  truncated?: boolean;
  redaction_status?: CommandCenterObservabilityRedactionStatus;
  replay_safe?: boolean;
  render_safe?: boolean;
}): CommandCenterObservabilityResponseEnvelope {
  return CommandCenterObservabilityResponseEnvelopeSchema.parse({
    kind: "command_center.observability_response_envelope",
    query_id: input.query_id,
    category: input.category,
    generated_at: input.generated_at ?? 0,
    redaction_status: input.redaction_status ?? "metadata_only",
    payload: input.payload ?? [],
    withheld_fields: input.withheld_fields ?? [
      ...COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS,
    ],
    truncated: input.truncated ?? false,
    replay_safe: input.replay_safe ?? true,
    render_safe: input.render_safe ?? true,
    metadata_only: true,
    raw_payloads_included: false,
    exact_pii_included: false,
  });
}

export function validateCommandCenterObservabilityQueryRequest(
  input: unknown,
): CommandCenterObservabilityRequestValidation {
  const parsed = CommandCenterObservabilityQueryRequestSchema.safeParse(input);
  const query = readPartialQuery(input);

  if (containsForbiddenObservabilityPayloadField(input)) {
    return requestValidation({
      passed: false,
      reason: "raw_payload_field_present",
      queryId: query.query_id,
      category: query.category,
      readOnly: query.mode === "read_only",
      redactionRequired: query.redaction_required === true,
    });
  }
  if (!parsed.success) {
    if (query.mode !== undefined && query.mode !== "read_only") {
      return requestValidation({
        passed: false,
        reason: "mode_not_read_only",
        queryId: query.query_id,
        category: query.category,
        readOnly: false,
        redactionRequired: query.redaction_required === true,
      });
    }
    if (
      query.redaction_required !== undefined &&
      query.redaction_required !== true
    ) {
      return requestValidation({
        passed: false,
        reason: "redaction_not_required",
        queryId: query.query_id,
        category: query.category,
        readOnly: query.mode === "read_only",
        redactionRequired: false,
      });
    }
    return requestValidation({
      passed: false,
      reason: "schema_rejected",
      queryId: query.query_id,
      category: query.category,
      readOnly: query.mode === "read_only",
      redactionRequired: query.redaction_required === true,
    });
  }

  return requestValidation({
    passed: true,
    reason: "read_only_metadata_query",
    queryId: parsed.data.query_id,
    category: parsed.data.category,
    readOnly: true,
    redactionRequired: true,
  });
}

export function validateCommandCenterObservabilityAction(
  actionInput: string,
): CommandCenterObservabilityActionValidation {
  const action = actionInput.trim();
  const allowed = (
    COMMAND_CENTER_OBSERVABILITY_ALLOWED_ACTIONS as readonly string[]
  ).includes(action);
  const forbidden = (
    COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS as readonly string[]
  ).includes(action);

  return CommandCenterObservabilityActionValidationSchema.parse({
    action,
    allowed,
    reason: allowed
      ? "read_only_metadata_query"
      : forbidden
        ? "forbidden_action"
        : "unknown_action",
    read_only_query_action: allowed,
    mutating_action: false,
    metadata_only: true,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function requestValidation(input: {
  passed: boolean;
  reason: CommandCenterObservabilityValidationReason;
  queryId: string | null;
  category: CommandCenterObservabilityQueryCategory | null;
  readOnly: boolean;
  redactionRequired: boolean;
}): CommandCenterObservabilityRequestValidation {
  return CommandCenterObservabilityRequestValidationSchema.parse({
    passed: input.passed,
    reason: input.reason,
    query_id: input.queryId,
    category: input.category,
    read_only: input.readOnly,
    metadata_only: true,
    redaction_required: input.redactionRequired,
    raw_payloads_included: false,
    exact_pii_included: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function readPartialQuery(input: unknown): {
  query_id: string | null;
  category: CommandCenterObservabilityQueryCategory | null;
  mode?: unknown;
  redaction_required?: unknown;
} {
  if (!input || typeof input !== "object") {
    return { query_id: null, category: null };
  }
  const record = input as Record<string, unknown>;
  const category = CommandCenterObservabilityQueryCategorySchema.safeParse(
    record.category,
  );
  return {
    query_id: typeof record.query_id === "string" ? record.query_id : null,
    category: category.success ? category.data : null,
    mode: record.mode,
    redaction_required: record.redaction_required,
  };
}

function containsForbiddenObservabilityPayloadField(input: unknown): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }
  if (Array.isArray(input)) {
    return input.some((item) =>
      containsForbiddenObservabilityPayloadField(item),
    );
  }
  for (const [key, value] of Object.entries(input)) {
    if (
      (
        COMMAND_CENTER_FORBIDDEN_RENDER_PAYLOAD_FIELDS as readonly CommandCenterForbiddenRenderPayloadField[]
      ).includes(key as CommandCenterForbiddenRenderPayloadField)
    ) {
      return true;
    }
    if (containsForbiddenObservabilityPayloadField(value)) {
      return true;
    }
  }
  return false;
}
