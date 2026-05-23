import {
  AuditReplayEdgeSchema,
  AuditReplayNodeSchema,
  AuditReplayViewerViewModelSchema,
  createDefaultAuditReplayViewerViewModel,
  type AuditReplayEdge,
  type AuditReplayNode,
  type AuditReplayViewerViewModel,
} from "./audit-replay-viewer";
import {
  AuditTraceTimelineItemSchema,
  AuditTraceTimelineViewModelSchema,
  createDefaultAuditTraceTimelineViewModel,
  type AuditTraceDurationBand,
  type AuditTraceGateDecisionClass,
  type AuditTraceSubsystemClass,
  type AuditTraceTimelineItem,
  type AuditTraceTimelineViewModel,
  type AuditTraceTimestampBand,
} from "./audit-trace-timeline";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import {
  TraceRecordSchema,
  validateTraceRecord,
  type TraceEdge,
  type TraceNode,
  type TraceRecord,
} from "./trace-record";

const TRACE_PROJECTION_WITHHELD_FIELDS = [
  ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  "executable_payload",
  "invalid_trace_record",
] as const;

export function projectTraceRecordToTimelineItem(
  traceRecord: TraceRecord | unknown,
): AuditTraceTimelineItem {
  const parsed = TraceRecordSchema.safeParse(traceRecord);
  const validation = validateTraceRecord(traceRecord);
  if (!parsed.success || !validation.passed) {
    return createWithheldTimelineItem(validation.withheld_fields);
  }
  const record = parsed.data;
  const primaryNode = record.nodes[0];

  return AuditTraceTimelineItemSchema.parse({
    kind: "command_center.audit_trace_timeline_item",
    phase: "9E1",
    trace_id: record.trace_id,
    origin: record.origin,
    timestamp_band: timestampBandFromTrace(record),
    duration_band: durationBandFromTrace(record),
    status_class: primaryNode?.metadata.status_class ?? "unknown",
    gate_decision_class:
      primaryNode?.gate?.gate_decision_class ?? edgeGateDecision(record.edges),
    subsystem_class:
      primaryNode?.subsystem_class ?? subsystemFromOrigin(record),
    redaction_status: record.redaction_status,
    replay_safe: record.replay_safe && validation.passed,
    render_safe: true,
    withheld_fields: record.withheld_fields,
    truncated: record.truncated,
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

export function projectTraceRecordToReplayViewer(
  traceRecord: TraceRecord | unknown,
): AuditReplayViewerViewModel {
  const parsed = TraceRecordSchema.safeParse(traceRecord);
  const validation = validateTraceRecord(traceRecord);
  if (!parsed.success || !validation.passed || !parsed.data.non_executable) {
    return createDefaultAuditReplayViewerViewModel();
  }
  const record = parsed.data;
  const nodeIds = new Set(record.nodes.map((node) => node.node_id));
  const nodes = record.nodes.map(projectTraceNodeToReplayNode);
  const edges = record.edges
    .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .map(projectTraceEdgeToReplayEdge);

  return AuditReplayViewerViewModelSchema.parse({
    ...createDefaultAuditReplayViewerViewModel(),
    replay_id: `audit_replay_viewer:${record.trace_id}`,
    trace_id: record.trace_id,
    nodes,
    edges,
    generated_at: record.ts_end,
    redaction_status: record.redaction_status,
    replay_safe: record.replay_safe,
    withheld_fields: record.withheld_fields,
    truncated: record.truncated,
  });
}

export function projectTraceRecordsToTimelineViewModel(
  traceRecords: readonly unknown[],
): AuditTraceTimelineViewModel {
  const orderedRecords = traceRecords
    .map((traceRecord, index) => ({ traceRecord, index }))
    .sort((left, right) => {
      const leftTime = readTraceStart(left.traceRecord);
      const rightTime = readTraceStart(right.traceRecord);
      if (leftTime !== rightTime) return leftTime - rightTime;
      return left.index - right.index;
    });
  const items: AuditTraceTimelineItem[] = [];
  const withheldFields = new Set<string>();
  let unsafeTraceCount = 0;

  for (const { traceRecord } of orderedRecords) {
    const validation = validateTraceRecord(traceRecord);
    if (!validation.passed) {
      unsafeTraceCount += 1;
      for (const field of validation.withheld_fields) withheldFields.add(field);
      continue;
    }
    const item = projectTraceRecordToTimelineItem(traceRecord);
    items.push(item);
    for (const field of item.withheld_fields) withheldFields.add(field);
  }

  if (unsafeTraceCount > 0) {
    withheldFields.add(`unsafe_trace_count:${unsafeTraceCount}`);
  }

  return AuditTraceTimelineViewModelSchema.parse({
    ...createDefaultAuditTraceTimelineViewModel(),
    timeline_id: "audit_trace_timeline:trace_records",
    items,
    generated_at: maxTraceEnd(items.length > 0 ? orderedRecords : []),
    redaction_status: items.some((item) => item.redaction_status === "redacted")
      ? "redacted"
      : "metadata_only",
    replay_safe_count: items.filter((item) => item.replay_safe).length,
    withheld_fields:
      withheldFields.size > 0
        ? [...withheldFields]
        : [...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES],
    truncated: unsafeTraceCount > 0 || items.some((item) => item.truncated),
  });
}

function projectTraceNodeToReplayNode(node: TraceNode): AuditReplayNode {
  return AuditReplayNodeSchema.parse({
    kind: node.kind,
    node_id: node.node_id,
    label_class: node.label_class,
    subsystem_class: node.subsystem_class,
    status_class: node.metadata.status_class,
    metadata_summary_class: node.metadata.summary_class,
    gate_decision_class: node.gate?.gate_decision_class,
    redaction_status: "metadata_only",
    render_safe: true,
    metadata_only: true,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function projectTraceEdgeToReplayEdge(edge: TraceEdge): AuditReplayEdge {
  return AuditReplayEdgeSchema.parse({
    from: edge.from,
    to: edge.to,
    gate_decision_class: edge.gate_decision_class,
    dropped_reason_class: edge.dropped_reason_class,
    render_safe: true,
    metadata_only: true,
    non_executable: true,
    authority_surface: false,
  });
}

function createWithheldTimelineItem(
  withheldFields: readonly string[],
): AuditTraceTimelineItem {
  return AuditTraceTimelineItemSchema.parse({
    kind: "command_center.audit_trace_timeline_item",
    phase: "9E1",
    trace_id: "trace:withheld",
    origin: "router_decision",
    timestamp_band: "unknown",
    duration_band: "unknown",
    status_class: "blocked",
    gate_decision_class: "withheld",
    subsystem_class: "unknown",
    redaction_status: "fully_withheld",
    replay_safe: false,
    render_safe: true,
    withheld_fields:
      withheldFields.length > 0
        ? [...withheldFields]
        : [...TRACE_PROJECTION_WITHHELD_FIELDS],
    truncated: true,
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

function timestampBandFromTrace(record: TraceRecord): AuditTraceTimestampBand {
  if (record.ts_start === 0) return "unknown";
  if (record.session_id) return "session";
  return "latest";
}

function durationBandFromTrace(record: TraceRecord): AuditTraceDurationBand {
  if (record.ts_end <= record.ts_start) return "none";
  const duration = record.ts_end - record.ts_start;
  if (duration <= 50) return "low";
  if (duration <= 500) return "medium";
  return "high";
}

function edgeGateDecision(
  edges: readonly TraceEdge[],
): AuditTraceGateDecisionClass {
  return (
    edges.find((edge) => edge.gate_decision_class)?.gate_decision_class ??
    "unknown"
  );
}

function subsystemFromOrigin(record: TraceRecord): AuditTraceSubsystemClass {
  if (record.origin === "tool_call") return "tools";
  if (record.origin === "routine_run") return "routines";
  if (record.origin === "vision_event") return "vision";
  if (record.origin === "approval_flow") return "approvals";
  return "router";
}

function readTraceStart(input: unknown): number {
  const parsed = TraceRecordSchema.safeParse(input);
  return parsed.success ? parsed.data.ts_start : Number.MAX_SAFE_INTEGER;
}

function maxTraceEnd(records: readonly { traceRecord: unknown }[]): number {
  return records.reduce((max, item) => {
    const parsed = TraceRecordSchema.safeParse(item.traceRecord);
    return parsed.success ? Math.max(max, parsed.data.ts_end) : max;
  }, 0);
}
