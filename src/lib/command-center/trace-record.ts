import { z } from "zod";

import {
  AuditReplayDroppedReasonClassSchema,
  AuditReplayLabelClassSchema,
  AuditReplayNodeKindSchema,
  type AuditReplayDroppedReasonClass,
  type AuditReplayLabelClass,
  type AuditReplayNodeKind,
} from "./audit-replay-viewer";
import {
  AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS,
  AuditTraceGateDecisionClassSchema,
  AuditTraceStatusClassSchema,
  AuditTraceSubsystemClassSchema,
  AuditTraceTimelineOriginSchema,
  type AuditTraceGateDecisionClass,
  type AuditTraceStatusClass,
  type AuditTraceSubsystemClass,
  type AuditTraceTimelineOrigin,
} from "./audit-trace-timeline";
import { RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS } from "./audit-runtime-dependency";
import { CommandCenterObservabilityRedactionStatusSchema } from "./observability-contract";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  validateObservabilityPayloadSafety,
} from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const TRACE_GATE_KINDS = [
  "approval",
  "fallback",
  "safety",
  "budget",
  "consent",
  "user_present",
  "kill_switch",
  "redaction",
] as const;

export const TRACE_METADATA_SUMMARY_CLASSES = [
  "empty",
  "metadata_only",
  "redacted",
  "withheld",
] as const;

export const TRACE_METADATA_CONFIDENCE_BANDS = [
  "unknown",
  "low",
  "medium",
  "high",
] as const;

export const TRACE_METADATA_COUNT_BINS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export const TRACE_RECORD_EXECUTABLE_PAYLOAD_FIELDS = [
  "executable_payload",
  "runnable_payload",
  "action_payload",
  "tool_args",
  "tool_call_args",
  "tool_result_payload",
  "approval_payload",
  "routine_payload",
  "graph_payload",
  "replay_payload",
] as const;

export const TRACE_RECORD_VALIDATION_REASONS = [
  "trace_record_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "executable_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "unknown_enum_value",
  "missing_edge_node",
  "replay_not_safe",
  "render_not_safe",
  "not_non_executable",
] as const;

export const TraceGateKindSchema = z.enum(TRACE_GATE_KINDS);
export const TraceMetadataSummaryClassSchema = z.enum(
  TRACE_METADATA_SUMMARY_CLASSES,
);
export const TraceMetadataConfidenceBandSchema = z.enum(
  TRACE_METADATA_CONFIDENCE_BANDS,
);
export const TraceMetadataCountBinSchema = z.enum(TRACE_METADATA_COUNT_BINS);
export const TraceRecordExecutablePayloadFieldSchema = z.enum(
  TRACE_RECORD_EXECUTABLE_PAYLOAD_FIELDS,
);
export const TraceRecordValidationReasonSchema = z.enum(
  TRACE_RECORD_VALIDATION_REASONS,
);

export const TraceGateSchema = z.strictObject({
  gate_kind: TraceGateKindSchema,
  gate_decision_class: AuditTraceGateDecisionClassSchema,
  metadata_only: z.literal(true),
  non_executable: z.literal(true),
});

export const TraceNodeMetadataSchema = z.strictObject({
  summary_class: TraceMetadataSummaryClassSchema,
  status_class: AuditTraceStatusClassSchema,
  confidence_band: TraceMetadataConfidenceBandSchema.optional(),
  count_bin: TraceMetadataCountBinSchema.optional(),
  metadata_only: z.literal(true),
  raw_payloads_included: z.literal(false),
  exact_pii_included: z.literal(false),
});

export const TraceNodeSchema = CommandCenterSideEffectSnapshotSchema.extend({
  node_id: z.string().trim().min(1).max(160),
  kind: AuditReplayNodeKindSchema,
  label_class: AuditReplayLabelClassSchema,
  subsystem_class: AuditTraceSubsystemClassSchema,
  metadata: TraceNodeMetadataSchema,
  gate: TraceGateSchema.optional(),
  replay_safe: z.literal(true),
  render_safe: z.literal(true),
  metadata_only: z.literal(true),
  non_executable: z.literal(true),
  raw_payloads_included: z.literal(false),
  exact_pii_included: z.literal(false),
  authority_surface: z.literal(false),
});

export const TraceEdgeSchema = z.strictObject({
  from: z.string().trim().min(1).max(160),
  to: z.string().trim().min(1).max(160),
  gate_decision_class: AuditTraceGateDecisionClassSchema.optional(),
  dropped_reason_class: AuditReplayDroppedReasonClassSchema.optional(),
  replay_safe: z.literal(true),
  render_safe: z.literal(true),
  metadata_only: z.literal(true),
  non_executable: z.literal(true),
  authority_surface: z.literal(false),
});

export const TraceRecordSchema = CommandCenterSideEffectSnapshotSchema.extend({
  kind: z.literal("command_center.trace_record"),
  phase: z.literal("9F1"),
  trace_id: z.string().trim().min(1).max(160),
  session_id: z.string().trim().min(1).max(160).optional(),
  ts_start: z.number().int().nonnegative(),
  ts_end: z.number().int().nonnegative(),
  origin: AuditTraceTimelineOriginSchema,
  nodes: z.array(TraceNodeSchema),
  edges: z.array(TraceEdgeSchema),
  redaction_status: CommandCenterObservabilityRedactionStatusSchema,
  replay_safe: z.literal(true),
  render_safe: z.literal(true),
  non_executable: z.literal(true),
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
  execute_affordance_allowed: z.literal(false),
  approve_affordance_allowed: z.literal(false),
  rerun_affordance_allowed: z.literal(false),
  graph_execution_allowed: z.literal(false),
  replay_execution_allowed: z.literal(false),
  tool_actions_allowed: z.literal(false),
  routine_actions_allowed: z.literal(false),
  approval_actions_allowed: z.literal(false),
});

export const TraceRecordValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(TraceRecordValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    replay_safe: z.boolean(),
    render_safe: z.boolean(),
    non_executable: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type TraceGateKind = z.infer<typeof TraceGateKindSchema>;
export type TraceMetadataSummaryClass = z.infer<
  typeof TraceMetadataSummaryClassSchema
>;
export type TraceMetadataConfidenceBand = z.infer<
  typeof TraceMetadataConfidenceBandSchema
>;
export type TraceMetadataCountBin = z.infer<typeof TraceMetadataCountBinSchema>;
export type TraceRecordExecutablePayloadField = z.infer<
  typeof TraceRecordExecutablePayloadFieldSchema
>;
export type TraceRecordValidationReason = z.infer<
  typeof TraceRecordValidationReasonSchema
>;
export type TraceGate = z.infer<typeof TraceGateSchema>;
export type TraceNodeMetadata = z.infer<typeof TraceNodeMetadataSchema>;
export type TraceNode = z.infer<typeof TraceNodeSchema>;
export type TraceEdge = z.infer<typeof TraceEdgeSchema>;
export type TraceRecord = z.infer<typeof TraceRecordSchema>;
export type TraceRecordValidation = z.infer<typeof TraceRecordValidationSchema>;

export function createDefaultTraceRecord(): TraceRecord {
  return TraceRecordSchema.parse({
    kind: "command_center.trace_record",
    phase: "9F1",
    trace_id: "trace:default",
    ts_start: 0,
    ts_end: 0,
    origin: "router_decision",
    nodes: [],
    edges: [],
    redaction_status: "metadata_only",
    replay_safe: true,
    render_safe: true,
    non_executable: true,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      ...TRACE_RECORD_EXECUTABLE_PAYLOAD_FIELDS,
      ...RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
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
    execute_affordance_allowed: false,
    approve_affordance_allowed: false,
    rerun_affordance_allowed: false,
    graph_execution_allowed: false,
    replay_execution_allowed: false,
    tool_actions_allowed: false,
    routine_actions_allowed: false,
    approval_actions_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateTraceRecord(input: unknown): TraceRecordValidation {
  const parsed = TraceRecordSchema.safeParse(input);
  const scan = scanTraceRecord(input, [], new WeakSet<object>());
  const reasons = new Set<TraceRecordValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.executablePayloadFields.length > 0) {
    reasons.add("executable_payload_field_present");
  }
  if (scan.executableAffordanceFields.length > 0) {
    reasons.add("executable_affordance_present");
  }
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (hasUnknownEnumValues(input)) reasons.add("unknown_enum_value");
  if (hasMissingEdgeNode(input)) reasons.add("missing_edge_node");
  if (readBooleanField(input, "replay_safe") !== true)
    reasons.add("replay_not_safe");
  if (readBooleanField(input, "render_safe") !== true)
    reasons.add("render_not_safe");
  if (readBooleanField(input, "non_executable") !== true)
    reasons.add("not_non_executable");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.executablePayloadFields) withheldFields.add(field);
  for (const field of scan.executableAffordanceFields)
    withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return TraceRecordValidationSchema.parse({
    passed,
    reasons: passed ? ["trace_record_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["trace_record_metadata_only"],
    metadata_only: true,
    replay_safe: passed,
    render_safe: passed,
    non_executable: passed,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function normalizeTraceRecordFromSafeMetadata(
  input: unknown,
): TraceRecord {
  const payloadSafety = validateObservabilityPayloadSafety(input);
  const scan = scanTraceRecord(input, [], new WeakSet<object>());
  if (
    !payloadSafety.passed ||
    scan.rawPayloadFields.length > 0 ||
    scan.executablePayloadFields.length > 0 ||
    scan.executableAffordanceFields.length > 0 ||
    scan.nonSerializable ||
    scan.unsafeShape
  ) {
    return createDefaultTraceRecord();
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return createDefaultTraceRecord();
  }

  const record = input as Record<string, unknown>;
  const nodes = readTraceNodes(record.nodes);
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  const edges = readTraceEdges(record.edges, nodeIds);
  const normalized = TraceRecordSchema.safeParse({
    ...createDefaultTraceRecord(),
    trace_id: readString(record.trace_id) ?? "trace:normalized",
    session_id: readString(record.session_id),
    ts_start: readNonnegativeInt(record.ts_start) ?? 0,
    ts_end:
      readNonnegativeInt(record.ts_end) ??
      readNonnegativeInt(record.ts_start) ??
      0,
    origin: readOrigin(record.origin),
    nodes,
    edges,
    redaction_status: readRedactionStatus(record.redaction_status),
    withheld_fields: readStringArray(record.withheld_fields),
    truncated: record.truncated === true,
  });

  if (!normalized.success) return createDefaultTraceRecord();
  const validation = validateTraceRecord(normalized.data);
  return validation.passed ? normalized.data : createDefaultTraceRecord();
}

function readTraceNodes(input: unknown): TraceNode[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      return [];
    const record = candidate as Record<string, unknown>;
    const nodeId = readString(record.node_id);
    if (!nodeId) return [];
    const parsed = TraceNodeSchema.safeParse({
      node_id: nodeId,
      kind: readNodeKind(record.kind),
      label_class: readLabelClass(record.label_class),
      subsystem_class: readSubsystemClass(record.subsystem_class),
      metadata: readTraceNodeMetadata(record.metadata),
      gate: readTraceGate(record.gate),
      replay_safe: true,
      render_safe: true,
      metadata_only: true,
      non_executable: true,
      raw_payloads_included: false,
      exact_pii_included: false,
      authority_surface: false,
      ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
    });
    return parsed.success ? [parsed.data] : [];
  });
}

function readTraceEdges(input: unknown, nodeIds: Set<string>): TraceEdge[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
      return [];
    const record = candidate as Record<string, unknown>;
    const from = readString(record.from);
    const to = readString(record.to);
    if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to)) return [];
    const parsed = TraceEdgeSchema.safeParse({
      from,
      to,
      gate_decision_class: readGateDecisionClass(record.gate_decision_class),
      dropped_reason_class: readDroppedReasonClass(record.dropped_reason_class),
      replay_safe: true,
      render_safe: true,
      metadata_only: true,
      non_executable: true,
      authority_surface: false,
    });
    return parsed.success ? [parsed.data] : [];
  });
}

function readTraceNodeMetadata(input: unknown): TraceNodeMetadata {
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  return TraceNodeMetadataSchema.parse({
    summary_class: readMetadataSummaryClass(record.summary_class),
    status_class: readStatusClass(record.status_class),
    confidence_band: readConfidenceBand(record.confidence_band),
    count_bin: readCountBin(record.count_bin),
    metadata_only: true,
    raw_payloads_included: false,
    exact_pii_included: false,
  });
}

function readTraceGate(input: unknown): TraceGate | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  const record = input as Record<string, unknown>;
  const gateKind = readGateKind(record.gate_kind);
  if (!gateKind) return undefined;
  return TraceGateSchema.parse({
    gate_kind: gateKind,
    gate_decision_class: readGateDecisionClass(record.gate_decision_class),
    metadata_only: true,
    non_executable: true,
  });
}

interface TraceRecordScanResult {
  rawPayloadFields: string[];
  executablePayloadFields: string[];
  executableAffordanceFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanTraceRecord(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): TraceRecordScanResult {
  const result: TraceRecordScanResult = {
    rawPayloadFields: [],
    executablePayloadFields: [],
    executableAffordanceFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("trace_record_missing");
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
    const fieldPath = [...path, key].join(".");
    if (isRawPayloadField(key)) result.rawPayloadFields.push(fieldPath);
    if (isExecutablePayloadField(key)) {
      result.executablePayloadFields.push(fieldPath);
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableAffordanceFields.push(fieldPath);
    }
    const child = scanTraceRecord(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.executablePayloadFields.push(...child.executablePayloadFields);
    result.executableAffordanceFields.push(...child.executableAffordanceFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function isRawPayloadField(key: string): boolean {
  return (
    [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      ...RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
    ] as readonly string[]
  ).includes(key);
}

function isExecutablePayloadField(key: string): boolean {
  return (TRACE_RECORD_EXECUTABLE_PAYLOAD_FIELDS as readonly string[]).includes(
    key,
  );
}

function isExecutableAffordanceKey(key: string, value: unknown): boolean {
  if (
    key === "run_affordance_allowed" ||
    key === "retry_affordance_allowed" ||
    key === "execute_affordance_allowed" ||
    key === "approve_affordance_allowed" ||
    key === "rerun_affordance_allowed" ||
    key === "graph_execution_allowed" ||
    key === "replay_execution_allowed" ||
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
      "retry_button",
      "run_button",
      "approve_button",
      "execute_button",
      "rerun_button",
    ] as readonly string[]
  ).includes(key);
}

function hasUnknownEnumValues(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  if (
    "origin" in record &&
    !AuditTraceTimelineOriginSchema.safeParse(record.origin).success
  ) {
    return true;
  }
  const nodes = Array.isArray(record.nodes) ? record.nodes : [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const candidate = node as Record<string, unknown>;
    if (
      "kind" in candidate &&
      !AuditReplayNodeKindSchema.safeParse(candidate.kind).success
    ) {
      return true;
    }
    if ("gate" in candidate) {
      const gate = candidate.gate;
      if (gate && typeof gate === "object" && !Array.isArray(gate)) {
        const gateRecord = gate as Record<string, unknown>;
        if (
          "gate_kind" in gateRecord &&
          !TraceGateKindSchema.safeParse(gateRecord.gate_kind).success
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

function hasMissingEdgeNode(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const record = input as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges)) {
    return false;
  }
  const nodeIds = new Set(
    record.nodes
      .map((node) =>
        node && typeof node === "object"
          ? (node as { node_id?: unknown }).node_id
          : null,
      )
      .filter((nodeId): nodeId is string => typeof nodeId === "string"),
  );
  return record.edges.some((edge) => {
    if (!edge || typeof edge !== "object") return false;
    const from = (edge as { from?: unknown }).from;
    const to = (edge as { to?: unknown }).to;
    return (
      (typeof from === "string" && !nodeIds.has(from)) ||
      (typeof to === "string" && !nodeIds.has(to))
    );
  });
}

function readBooleanField(input: unknown, field: string): boolean | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "boolean" ? value : undefined;
}

function readString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0
    ? input.trim().slice(0, 160)
    : undefined;
}

function readStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      ...TRACE_RECORD_EXECUTABLE_PAYLOAD_FIELDS,
      ...RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
    ];
  }
  return input
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 40);
}

function readNonnegativeInt(input: unknown): number | undefined {
  return typeof input === "number" && Number.isInteger(input) && input >= 0
    ? input
    : undefined;
}

function readOrigin(input: unknown): AuditTraceTimelineOrigin {
  return AuditTraceTimelineOriginSchema.safeParse(input).success
    ? (input as AuditTraceTimelineOrigin)
    : "router_decision";
}

function readNodeKind(input: unknown): AuditReplayNodeKind {
  return AuditReplayNodeKindSchema.safeParse(input).success
    ? (input as AuditReplayNodeKind)
    : "result";
}

function readLabelClass(input: unknown): AuditReplayLabelClass {
  return AuditReplayLabelClassSchema.safeParse(input).success
    ? (input as AuditReplayLabelClass)
    : "unknown";
}

function readSubsystemClass(input: unknown): AuditTraceSubsystemClass {
  return AuditTraceSubsystemClassSchema.safeParse(input).success
    ? (input as AuditTraceSubsystemClass)
    : "unknown";
}

function readStatusClass(input: unknown): AuditTraceStatusClass {
  return AuditTraceStatusClassSchema.safeParse(input).success
    ? (input as AuditTraceStatusClass)
    : "unknown";
}

function readMetadataSummaryClass(input: unknown): TraceMetadataSummaryClass {
  return TraceMetadataSummaryClassSchema.safeParse(input).success
    ? (input as TraceMetadataSummaryClass)
    : "metadata_only";
}

function readConfidenceBand(
  input: unknown,
): TraceMetadataConfidenceBand | undefined {
  return TraceMetadataConfidenceBandSchema.safeParse(input).success
    ? (input as TraceMetadataConfidenceBand)
    : undefined;
}

function readCountBin(input: unknown): TraceMetadataCountBin | undefined {
  return TraceMetadataCountBinSchema.safeParse(input).success
    ? (input as TraceMetadataCountBin)
    : undefined;
}

function readGateKind(input: unknown): TraceGateKind | undefined {
  return TraceGateKindSchema.safeParse(input).success
    ? (input as TraceGateKind)
    : undefined;
}

function readGateDecisionClass(input: unknown): AuditTraceGateDecisionClass {
  return AuditTraceGateDecisionClassSchema.safeParse(input).success
    ? (input as AuditTraceGateDecisionClass)
    : "unknown";
}

function readDroppedReasonClass(
  input: unknown,
): AuditReplayDroppedReasonClass | undefined {
  return AuditReplayDroppedReasonClassSchema.safeParse(input).success
    ? (input as AuditReplayDroppedReasonClass)
    : undefined;
}

function readRedactionStatus(input: unknown): TraceRecord["redaction_status"] {
  return CommandCenterObservabilityRedactionStatusSchema.safeParse(input)
    .success
    ? (input as TraceRecord["redaction_status"])
    : "metadata_only";
}
