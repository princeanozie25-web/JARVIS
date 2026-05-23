import { z } from "zod";

import {
  CommandCenterObservabilityRedactionStatusSchema,
  CommandCenterObservabilityResponseEnvelopeSchema,
  type CommandCenterObservabilityRedactionStatus,
  type CommandCenterObservabilityResponseEnvelope,
} from "./observability-contract";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  validateObservabilityPayloadSafety,
} from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const AUDIT_TRACE_TIMELINE_ORIGINS = [
  "tool_call",
  "routine_run",
  "vision_event",
  "approval_flow",
  "router_decision",
] as const;
export const AUDIT_TRACE_TIMESTAMP_BANDS = [
  "unknown",
  "latest",
  "recent",
  "session",
] as const;
export const AUDIT_TRACE_DURATION_BANDS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const AUDIT_TRACE_STATUS_CLASSES = [
  "unknown",
  "queued",
  "running",
  "succeeded",
  "failed",
  "blocked",
  "degraded",
] as const;
export const AUDIT_TRACE_GATE_DECISION_CLASSES = [
  "unknown",
  "allowed",
  "blocked",
  "withheld",
] as const;
export const AUDIT_TRACE_SUBSYSTEM_CLASSES = [
  "unknown",
  "router",
  "tools",
  "routines",
  "vision",
  "approvals",
] as const;
export const AUDIT_TRACE_TIMELINE_VALIDATION_REASONS = [
  "audit_trace_timeline_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;
export const AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS = [
  "run",
  "retry",
  "execute",
  "replay",
  "run_trace",
  "retry_trace",
  "rerun_trace",
  "rerun_routine",
  "execute_tool",
  "approve",
  "deny",
  "schedule",
  "mutate",
  "on_run",
  "on_retry",
  "on_execute",
  "on_replay",
  "graph_execute",
  "tool_execution_hook",
  "routine_hook",
  "approval_hook",
] as const;

export const AuditTraceTimelineOriginSchema = z.enum(
  AUDIT_TRACE_TIMELINE_ORIGINS,
);
export const AuditTraceTimestampBandSchema = z.enum(
  AUDIT_TRACE_TIMESTAMP_BANDS,
);
export const AuditTraceDurationBandSchema = z.enum(AUDIT_TRACE_DURATION_BANDS);
export const AuditTraceStatusClassSchema = z.enum(AUDIT_TRACE_STATUS_CLASSES);
export const AuditTraceGateDecisionClassSchema = z.enum(
  AUDIT_TRACE_GATE_DECISION_CLASSES,
);
export const AuditTraceSubsystemClassSchema = z.enum(
  AUDIT_TRACE_SUBSYSTEM_CLASSES,
);
export const AuditTraceTimelineValidationReasonSchema = z.enum(
  AUDIT_TRACE_TIMELINE_VALIDATION_REASONS,
);
export const AuditTraceExecutableAffordanceKeySchema = z.enum(
  AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS,
);

export const AuditTraceTimelineItemSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.audit_trace_timeline_item"),
    phase: z.literal("9E1"),
    trace_id: z.string().trim().min(1).max(160),
    origin: AuditTraceTimelineOriginSchema,
    timestamp_band: AuditTraceTimestampBandSchema,
    duration_band: AuditTraceDurationBandSchema,
    status_class: AuditTraceStatusClassSchema,
    gate_decision_class: AuditTraceGateDecisionClassSchema,
    subsystem_class: AuditTraceSubsystemClassSchema,
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    replay_safe: z.boolean(),
    render_safe: z.literal(true),
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    metadata_only: z.literal(true),
    non_executable: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    authority_surface: z.literal(false),
    callbacks_allowed: z.literal(false),
    event_handlers_allowed: z.literal(false),
    run_affordance_allowed: z.literal(false),
    retry_affordance_allowed: z.literal(false),
    execute_affordance_allowed: z.literal(false),
    tool_actions_allowed: z.literal(false),
    routine_actions_allowed: z.literal(false),
    approval_actions_allowed: z.literal(false),
    graph_execution_allowed: z.literal(false),
  });

export const AuditTraceTimelineViewModelSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.audit_trace_timeline_view_model"),
    phase: z.literal("9E1"),
    timeline_id: z.string().trim().min(1).max(160),
    items: z.array(AuditTraceTimelineItemSchema),
    generated_at: z.number().int().nonnegative(),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    replay_safe_count: z.number().int().nonnegative(),
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    metadata_only: z.literal(true),
    non_executable: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    authority_surface: z.literal(false),
    callbacks_allowed: z.literal(false),
    event_handlers_allowed: z.literal(false),
    run_affordance_allowed: z.literal(false),
    retry_affordance_allowed: z.literal(false),
    execute_affordance_allowed: z.literal(false),
    graph_execution_allowed: z.literal(false),
  });

export const AuditTraceTimelineValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(AuditTraceTimelineValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    replay_non_executable: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type AuditTraceTimelineOrigin = z.infer<
  typeof AuditTraceTimelineOriginSchema
>;
export type AuditTraceTimestampBand = z.infer<
  typeof AuditTraceTimestampBandSchema
>;
export type AuditTraceDurationBand = z.infer<
  typeof AuditTraceDurationBandSchema
>;
export type AuditTraceStatusClass = z.infer<typeof AuditTraceStatusClassSchema>;
export type AuditTraceGateDecisionClass = z.infer<
  typeof AuditTraceGateDecisionClassSchema
>;
export type AuditTraceSubsystemClass = z.infer<
  typeof AuditTraceSubsystemClassSchema
>;
export type AuditTraceTimelineValidationReason = z.infer<
  typeof AuditTraceTimelineValidationReasonSchema
>;
export type AuditTraceExecutableAffordanceKey = z.infer<
  typeof AuditTraceExecutableAffordanceKeySchema
>;
export type AuditTraceTimelineItem = z.infer<
  typeof AuditTraceTimelineItemSchema
>;
export type AuditTraceTimelineViewModel = z.infer<
  typeof AuditTraceTimelineViewModelSchema
>;
export type AuditTraceTimelineValidation = z.infer<
  typeof AuditTraceTimelineValidationSchema
>;

export function createDefaultAuditTraceTimelineViewModel(): AuditTraceTimelineViewModel {
  return AuditTraceTimelineViewModelSchema.parse({
    kind: "command_center.audit_trace_timeline_view_model",
    phase: "9E1",
    timeline_id: "audit_trace_timeline:default",
    items: [],
    generated_at: 0,
    redaction_status: "metadata_only",
    render_safe: true,
    replay_safe_count: 0,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
    ],
    truncated: false,
    metadata_only: true,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    run_affordance_allowed: false,
    retry_affordance_allowed: false,
    execute_affordance_allowed: false,
    graph_execution_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateAuditTraceTimelineItem(
  input: unknown,
): AuditTraceTimelineValidation {
  return validateAuditTraceTimelineLike(
    input,
    AuditTraceTimelineItemSchema.safeParse(input).success,
  );
}

export function validateAuditTraceTimelineViewModel(
  input: unknown,
): AuditTraceTimelineValidation {
  return validateAuditTraceTimelineLike(
    input,
    AuditTraceTimelineViewModelSchema.safeParse(input).success,
  );
}

export function deriveAuditTraceTimelineFromObservabilityResponses(
  responses: unknown,
): AuditTraceTimelineViewModel {
  const safeTraceEnvelopes = readSafeTraceEnvelopes(responses);
  if (safeTraceEnvelopes.length === 0) {
    return createDefaultAuditTraceTimelineViewModel();
  }

  const items = safeTraceEnvelopes.flatMap((envelope) =>
    envelope.payload.map((payloadItem, index) =>
      createTimelineItemFromEnvelope(envelope, index),
    ),
  );
  const withheldFields = [
    ...new Set(
      safeTraceEnvelopes.flatMap((envelope) => envelope.withheld_fields),
    ),
  ];
  const generatedAt = Math.max(
    ...safeTraceEnvelopes.map((envelope) => envelope.generated_at),
    0,
  );

  return AuditTraceTimelineViewModelSchema.parse({
    ...createDefaultAuditTraceTimelineViewModel(),
    timeline_id: "audit_trace_timeline:traces",
    items,
    generated_at: generatedAt,
    redaction_status: mostRestrictiveRedactionStatus(safeTraceEnvelopes),
    replay_safe_count: items.filter((item) => item.replay_safe).length,
    withheld_fields:
      withheldFields.length > 0
        ? withheldFields
        : [...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES],
    truncated: safeTraceEnvelopes.some((envelope) => envelope.truncated),
  });
}

function validateAuditTraceTimelineLike(
  input: unknown,
  schemaPassed: boolean,
): AuditTraceTimelineValidation {
  const scan = scanTimeline(input, [], new WeakSet<object>());
  const reasons = new Set<AuditTraceTimelineValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!schemaPassed) reasons.add("schema_rejected");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.executableFields.length > 0) {
    reasons.add("executable_affordance_present");
  }
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return AuditTraceTimelineValidationSchema.parse({
    passed,
    reasons: passed ? ["audit_trace_timeline_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["audit_trace_timeline_metadata_only"],
    metadata_only: true,
    render_safe: passed,
    replay_non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function readSafeTraceEnvelopes(
  responses: unknown,
): CommandCenterObservabilityResponseEnvelope[] {
  const candidates = Array.isArray(responses)
    ? responses
    : responses && typeof responses === "object"
      ? Object.values(responses)
      : [];
  const safe: CommandCenterObservabilityResponseEnvelope[] = [];

  for (const candidate of candidates) {
    const parsed =
      CommandCenterObservabilityResponseEnvelopeSchema.safeParse(candidate);
    if (!parsed.success) continue;
    if (parsed.data.category !== "traces") continue;
    if (!parsed.data.render_safe || parsed.data.raw_payloads_included) continue;
    if (!validateObservabilityPayloadSafety(candidate).passed) continue;
    safe.push(parsed.data);
  }
  return safe;
}

function createTimelineItemFromEnvelope(
  envelope: CommandCenterObservabilityResponseEnvelope,
  index: number,
): AuditTraceTimelineItem {
  const payload = envelope.payload[index];
  const origin = originFromItemClass(payload.item_class);
  return AuditTraceTimelineItemSchema.parse({
    kind: "command_center.audit_trace_timeline_item",
    phase: "9E1",
    trace_id: payload.item_id,
    origin,
    timestamp_band: timestampBandFromGeneratedAt(envelope.generated_at),
    duration_band: durationBandFromCount(payload.count_band),
    status_class: statusClassFromStatus(payload.status),
    gate_decision_class: gateDecisionFromStatus(payload.status),
    subsystem_class: subsystemClassFromOrigin(origin),
    redaction_status: payload.redaction_status,
    replay_safe:
      envelope.replay_safe &&
      envelope.render_safe &&
      payload.raw_payload_included === false,
    render_safe: true,
    withheld_fields: envelope.withheld_fields,
    truncated: envelope.truncated,
    metadata_only: true,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    run_affordance_allowed: false,
    retry_affordance_allowed: false,
    execute_affordance_allowed: false,
    tool_actions_allowed: false,
    routine_actions_allowed: false,
    approval_actions_allowed: false,
    graph_execution_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function originFromItemClass(itemClass: string): AuditTraceTimelineOrigin {
  if (itemClass.includes("tool")) return "tool_call";
  if (itemClass.includes("routine")) return "routine_run";
  if (itemClass.includes("vision")) return "vision_event";
  if (itemClass.includes("approval")) return "approval_flow";
  return "router_decision";
}

function timestampBandFromGeneratedAt(
  generatedAt: number,
): AuditTraceTimestampBand {
  return generatedAt > 0 ? "latest" : "unknown";
}

function durationBandFromCount(input: unknown): AuditTraceDurationBand {
  if (
    input === "none" ||
    input === "low" ||
    input === "medium" ||
    input === "high" ||
    input === "unknown"
  ) {
    return input;
  }
  return "unknown";
}

function statusClassFromStatus(input: unknown): AuditTraceStatusClass {
  if (input === "queued") return "queued";
  if (input === "running" || input === "active") return "running";
  if (input === "succeeded" || input === "ok" || input === "nominal") {
    return "succeeded";
  }
  if (input === "failed" || input === "error") return "failed";
  if (input === "blocked") return "blocked";
  if (input === "degraded") return "degraded";
  return "unknown";
}

function gateDecisionFromStatus(input: unknown): AuditTraceGateDecisionClass {
  if (input === "blocked") return "blocked";
  if (input === "withheld") return "withheld";
  if (
    input === "succeeded" ||
    input === "ok" ||
    input === "nominal" ||
    input === "running" ||
    input === "active"
  ) {
    return "allowed";
  }
  return "unknown";
}

function subsystemClassFromOrigin(
  origin: AuditTraceTimelineOrigin,
): AuditTraceSubsystemClass {
  if (origin === "tool_call") return "tools";
  if (origin === "routine_run") return "routines";
  if (origin === "vision_event") return "vision";
  if (origin === "approval_flow") return "approvals";
  return "router";
}

function mostRestrictiveRedactionStatus(
  envelopes: CommandCenterObservabilityResponseEnvelope[],
): CommandCenterObservabilityRedactionStatus {
  if (
    envelopes.some((envelope) => envelope.redaction_status === "fully_withheld")
  ) {
    return "fully_withheld";
  }
  if (envelopes.some((envelope) => envelope.redaction_status === "redacted")) {
    return "redacted";
  }
  return "metadata_only";
}

interface TimelineScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanTimeline(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): TimelineScanResult {
  const result: TimelineScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("timeline_missing");
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
    if (isForbiddenRawPayloadField(key)) {
      result.rawPayloadFields.push([...path, key].join("."));
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push([...path, key].join("."));
    }
    const child = scanTimeline(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
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
    key === "execute_affordance_allowed" ||
    key === "graph_execution_allowed" ||
    key === "tool_actions_allowed" ||
    key === "routine_actions_allowed" ||
    key === "approval_actions_allowed"
  ) {
    return value !== false;
  }
  return (
    [
      ...AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS,
      ...COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
    ] as readonly string[]
  ).includes(key);
}
