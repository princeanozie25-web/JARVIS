import { z } from "zod";

import {
  CommandCenterObservabilityRedactionStatusSchema,
  CommandCenterObservabilityResponseEnvelopeSchema,
} from "./observability-contract";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  validateObservabilityPayloadSafety,
} from "./observability-redaction";
import {
  AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS,
  AUDIT_TRACE_GATE_DECISION_CLASSES,
  AUDIT_TRACE_STATUS_CLASSES,
  AUDIT_TRACE_SUBSYSTEM_CLASSES,
  AuditTraceGateDecisionClassSchema,
  AuditTraceStatusClassSchema,
  AuditTraceSubsystemClassSchema,
  type AuditTraceGateDecisionClass,
  type AuditTraceStatusClass,
  type AuditTraceSubsystemClass,
} from "./audit-trace-timeline";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const AUDIT_REPLAY_NODE_KINDS = [
  "origin",
  "provider",
  "confidence",
  "fallback_gate",
  "result",
  "action_gate",
  "approval_gate",
  "budget_gate",
  "safety_gate",
] as const;
export const AUDIT_REPLAY_LABEL_CLASSES = [
  "unknown",
  "source",
  "provider",
  "confidence",
  "gate",
  "result",
  "approval",
  "budget",
  "safety",
] as const;
export const AUDIT_REPLAY_METADATA_SUMMARY_CLASSES = [
  "empty",
  "metadata_only",
  "redacted",
  "withheld",
] as const;
export const AUDIT_REPLAY_DROPPED_REASON_CLASSES = [
  "none",
  "policy_gate",
  "safety_gate",
  "budget_gate",
  "redacted",
  "unknown",
] as const;
export const AUDIT_REPLAY_VIEWER_VALIDATION_REASONS = [
  "audit_replay_viewer_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "missing_edge_node",
  "not_non_executable",
] as const;

export const AuditReplayNodeKindSchema = z.enum(AUDIT_REPLAY_NODE_KINDS);
export const AuditReplayLabelClassSchema = z.enum(AUDIT_REPLAY_LABEL_CLASSES);
export const AuditReplayMetadataSummaryClassSchema = z.enum(
  AUDIT_REPLAY_METADATA_SUMMARY_CLASSES,
);
export const AuditReplayDroppedReasonClassSchema = z.enum(
  AUDIT_REPLAY_DROPPED_REASON_CLASSES,
);
export const AuditReplayViewerValidationReasonSchema = z.enum(
  AUDIT_REPLAY_VIEWER_VALIDATION_REASONS,
);

export const AuditReplayNodeSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: AuditReplayNodeKindSchema,
    node_id: z.string().trim().min(1).max(160),
    label_class: AuditReplayLabelClassSchema,
    subsystem_class: AuditTraceSubsystemClassSchema,
    status_class: AuditTraceStatusClassSchema,
    metadata_summary_class: AuditReplayMetadataSummaryClassSchema,
    gate_decision_class: AuditTraceGateDecisionClassSchema.optional(),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    metadata_only: z.literal(true),
    non_executable: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    authority_surface: z.literal(false),
  });

export const AuditReplayEdgeSchema = z.strictObject({
  from: z.string().trim().min(1).max(160),
  to: z.string().trim().min(1).max(160),
  gate_decision_class: AuditTraceGateDecisionClassSchema.optional(),
  dropped_reason_class: AuditReplayDroppedReasonClassSchema.optional(),
  render_safe: z.literal(true),
  metadata_only: z.literal(true),
  non_executable: z.literal(true),
  authority_surface: z.literal(false),
});

export const AuditReplayViewerViewModelSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.audit_replay_viewer_view_model"),
    phase: z.literal("9E2"),
    replay_id: z.string().trim().min(1).max(160),
    trace_id: z.string().trim().min(1).max(160),
    nodes: z.array(AuditReplayNodeSchema),
    edges: z.array(AuditReplayEdgeSchema),
    generated_at: z.number().int().nonnegative(),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    replay_safe: z.boolean(),
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    non_executable: z.literal(true),
    metadata_only: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    authority_surface: z.literal(false),
    callbacks_allowed: z.literal(false),
    event_handlers_allowed: z.literal(false),
    run_affordance_allowed: z.literal(false),
    retry_affordance_allowed: z.literal(false),
    replay_affordance_allowed: z.literal(false),
    execute_affordance_allowed: z.literal(false),
    graph_execution_allowed: z.literal(false),
    tool_actions_allowed: z.literal(false),
    routine_actions_allowed: z.literal(false),
    approval_actions_allowed: z.literal(false),
  });

export const AuditReplayViewerValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(AuditReplayViewerValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    replay_non_executable: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type AuditReplayNodeKind = z.infer<typeof AuditReplayNodeKindSchema>;
export type AuditReplayLabelClass = z.infer<typeof AuditReplayLabelClassSchema>;
export type AuditReplayMetadataSummaryClass = z.infer<
  typeof AuditReplayMetadataSummaryClassSchema
>;
export type AuditReplayDroppedReasonClass = z.infer<
  typeof AuditReplayDroppedReasonClassSchema
>;
export type AuditReplayViewerValidationReason = z.infer<
  typeof AuditReplayViewerValidationReasonSchema
>;
export type AuditReplayNode = z.infer<typeof AuditReplayNodeSchema>;
export type AuditReplayEdge = z.infer<typeof AuditReplayEdgeSchema>;
export type AuditReplayViewerViewModel = z.infer<
  typeof AuditReplayViewerViewModelSchema
>;
export type AuditReplayViewerValidation = z.infer<
  typeof AuditReplayViewerValidationSchema
>;

export function createDefaultAuditReplayViewerViewModel(): AuditReplayViewerViewModel {
  return AuditReplayViewerViewModelSchema.parse({
    kind: "command_center.audit_replay_viewer_view_model",
    phase: "9E2",
    replay_id: "audit_replay_viewer:default",
    trace_id: "trace:none",
    nodes: [],
    edges: [],
    generated_at: 0,
    redaction_status: "metadata_only",
    render_safe: true,
    replay_safe: false,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
    ],
    truncated: false,
    non_executable: true,
    metadata_only: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    run_affordance_allowed: false,
    retry_affordance_allowed: false,
    replay_affordance_allowed: false,
    execute_affordance_allowed: false,
    graph_execution_allowed: false,
    tool_actions_allowed: false,
    routine_actions_allowed: false,
    approval_actions_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateAuditReplayViewerViewModel(
  input: unknown,
): AuditReplayViewerValidation {
  const parsed = AuditReplayViewerViewModelSchema.safeParse(input);
  const scan = scanReplayViewer(input, [], new WeakSet<object>());
  const reasons = new Set<AuditReplayViewerValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.executableFields.length > 0) {
    reasons.add("executable_affordance_present");
  }
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (hasMissingEdgeNode(input)) reasons.add("missing_edge_node");
  if (hasNonExecutableDisabled(input)) reasons.add("not_non_executable");
  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return AuditReplayViewerValidationSchema.parse({
    passed,
    reasons: passed ? ["audit_replay_viewer_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["audit_replay_viewer_metadata_only"],
    metadata_only: true,
    render_safe: passed,
    replay_non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function deriveAuditReplayViewerFromTraceMetadata(
  input: unknown,
): AuditReplayViewerViewModel {
  if (!validateObservabilityPayloadSafety(input).passed) {
    return createDefaultAuditReplayViewerViewModel();
  }
  const envelope = readSafeTraceEnvelope(input);
  if (!envelope || envelope.payload.length === 0) {
    return createDefaultAuditReplayViewerViewModel();
  }
  const traceItem = envelope.payload[0];
  const traceId = traceItem.item_id;
  const statusClass = statusClassFromStatus(traceItem.status);
  const gateDecisionClass = gateDecisionFromStatus(traceItem.status);
  const subsystemClass = subsystemClassFromItemClass(traceItem.item_class);
  const nodes: AuditReplayNode[] = [
    createReplayNode({
      nodeId: `${traceId}:origin`,
      kind: "origin",
      labelClass: "source",
      subsystemClass,
      statusClass,
      metadataSummaryClass: "metadata_only",
      gateDecisionClass,
      redactionStatus: traceItem.redaction_status,
    }),
    createReplayNode({
      nodeId: `${traceId}:provider`,
      kind: "provider",
      labelClass: "provider",
      subsystemClass,
      statusClass,
      metadataSummaryClass: "metadata_only",
      redactionStatus: traceItem.redaction_status,
    }),
    createReplayNode({
      nodeId: `${traceId}:safety_gate`,
      kind: "safety_gate",
      labelClass: "safety",
      subsystemClass: "approvals",
      statusClass,
      metadataSummaryClass: "redacted",
      gateDecisionClass,
      redactionStatus: traceItem.redaction_status,
    }),
    createReplayNode({
      nodeId: `${traceId}:result`,
      kind: "result",
      labelClass: "result",
      subsystemClass,
      statusClass,
      metadataSummaryClass:
        envelope.redaction_status === "fully_withheld"
          ? "withheld"
          : "redacted",
      gateDecisionClass,
      redactionStatus: traceItem.redaction_status,
    }),
  ];
  const edges: AuditReplayEdge[] = [
    createReplayEdge({
      from: nodes[0].node_id,
      to: nodes[1].node_id,
      gateDecisionClass: "allowed",
    }),
    createReplayEdge({
      from: nodes[1].node_id,
      to: nodes[2].node_id,
      gateDecisionClass,
    }),
    createReplayEdge({
      from: nodes[2].node_id,
      to: nodes[3].node_id,
      gateDecisionClass,
      droppedReasonClass:
        gateDecisionClass === "blocked" ? "safety_gate" : "none",
    }),
  ];

  return AuditReplayViewerViewModelSchema.parse({
    ...createDefaultAuditReplayViewerViewModel(),
    replay_id: `audit_replay_viewer:${traceId}`,
    trace_id: traceId,
    nodes,
    edges,
    generated_at: envelope.generated_at,
    redaction_status: envelope.redaction_status,
    replay_safe: envelope.replay_safe && envelope.render_safe,
    withheld_fields:
      envelope.withheld_fields.length > 0
        ? envelope.withheld_fields
        : [...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES],
    truncated: envelope.truncated,
  });
}

function createReplayNode(input: {
  nodeId: string;
  kind: AuditReplayNodeKind;
  labelClass: AuditReplayLabelClass;
  subsystemClass: AuditTraceSubsystemClass;
  statusClass: AuditTraceStatusClass;
  metadataSummaryClass: AuditReplayMetadataSummaryClass;
  gateDecisionClass?: AuditTraceGateDecisionClass;
  redactionStatus: z.infer<
    typeof CommandCenterObservabilityRedactionStatusSchema
  >;
}): AuditReplayNode {
  return AuditReplayNodeSchema.parse({
    node_id: input.nodeId,
    kind: input.kind,
    label_class: input.labelClass,
    subsystem_class: input.subsystemClass,
    status_class: input.statusClass,
    metadata_summary_class: input.metadataSummaryClass,
    gate_decision_class: input.gateDecisionClass,
    redaction_status: input.redactionStatus,
    render_safe: true,
    metadata_only: true,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function createReplayEdge(input: {
  from: string;
  to: string;
  gateDecisionClass?: AuditTraceGateDecisionClass;
  droppedReasonClass?: AuditReplayDroppedReasonClass;
}): AuditReplayEdge {
  return AuditReplayEdgeSchema.parse({
    from: input.from,
    to: input.to,
    gate_decision_class: input.gateDecisionClass,
    dropped_reason_class: input.droppedReasonClass,
    render_safe: true,
    metadata_only: true,
    non_executable: true,
    authority_surface: false,
  });
}

function readSafeTraceEnvelope(
  input: unknown,
): z.infer<typeof CommandCenterObservabilityResponseEnvelopeSchema> | null {
  const candidate = Array.isArray(input) ? input[0] : input;
  const parsed =
    CommandCenterObservabilityResponseEnvelopeSchema.safeParse(candidate);
  if (!parsed.success) return null;
  if (parsed.data.category !== "traces") return null;
  if (!parsed.data.render_safe || parsed.data.raw_payloads_included)
    return null;
  if (!validateObservabilityPayloadSafety(parsed.data).passed) return null;
  return parsed.data;
}

function statusClassFromStatus(input: unknown): AuditTraceStatusClass {
  if ((AUDIT_TRACE_STATUS_CLASSES as readonly unknown[]).includes(input)) {
    return input as AuditTraceStatusClass;
  }
  if (input === "active") return "running";
  if (input === "ok" || input === "nominal") return "succeeded";
  if (input === "error") return "failed";
  return "unknown";
}

function gateDecisionFromStatus(input: unknown): AuditTraceGateDecisionClass {
  if (
    (AUDIT_TRACE_GATE_DECISION_CLASSES as readonly unknown[]).includes(input)
  ) {
    return input as AuditTraceGateDecisionClass;
  }
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

function subsystemClassFromItemClass(
  itemClass: string,
): AuditTraceSubsystemClass {
  if (itemClass.includes("tool")) return "tools";
  if (itemClass.includes("routine")) return "routines";
  if (itemClass.includes("vision")) return "vision";
  if (itemClass.includes("approval")) return "approvals";
  if (
    (AUDIT_TRACE_SUBSYSTEM_CLASSES as readonly string[]).includes(itemClass)
  ) {
    return itemClass as AuditTraceSubsystemClass;
  }
  return "router";
}

function hasMissingEdgeNode(input: unknown): boolean {
  const parsed = AuditReplayViewerViewModelSchema.safeParse(input);
  if (!parsed.success) {
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
  const nodeIds = new Set(parsed.data.nodes.map((node) => node.node_id));
  return parsed.data.edges.some(
    (edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to),
  );
}

function hasNonExecutableDisabled(input: unknown): boolean {
  if (!input || typeof input !== "object") return true;
  const record = input as { non_executable?: unknown };
  return record.non_executable !== true;
}

interface ReplayViewerScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanReplayViewer(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): ReplayViewerScanResult {
  const result: ReplayViewerScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("replay_viewer_missing");
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
    const child = scanReplayViewer(value, [...path, key], seen);
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
    key === "replay_affordance_allowed" ||
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
      "retry_button",
      "run_button",
      "replay_button",
    ] as readonly string[]
  ).includes(key);
}
