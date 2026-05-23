import { z } from "zod";

import {
  CommandCenterObservabilityRedactionStatusSchema,
  CommandCenterObservabilityResponseEnvelopeSchema,
} from "./observability-contract";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  validateObservabilityPayloadSafety,
} from "./observability-redaction";
import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const GOVERNANCE_BOUNDARY_SUBSYSTEM_CLASSES = [
  "voice",
  "router",
  "safety",
  "tool_registry",
  "approvals",
  "vision",
  "environment",
  "projects",
  "memory_bridge",
  "routines",
  "cloud_providers",
  "local_providers",
  "telemetry",
  "audit_db",
  "command_center",
] as const;
export const GOVERNANCE_BOUNDARY_LABEL_CLASSES = [
  "source",
  "policy_gate",
  "registry",
  "provider",
  "store",
  "viewer",
  "subsystem",
] as const;
export const GOVERNANCE_BOUNDARY_EDGE_POLICIES = [
  "allowed",
  "gated",
  "forbidden",
] as const;
export const GOVERNANCE_BOUNDARY_GATE_CLASSES = [
  "approval",
  "consent",
  "budget",
  "user_present",
  "kill_switch",
  "redaction",
  "read_only",
] as const;
export const GOVERNANCE_BOUNDARY_COUNT_BINS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const GOVERNANCE_BOUNDARY_INCIDENT_FLAG_CLASSES = [
  "none",
  "yellow",
  "red",
  "unknown",
] as const;
export const GOVERNANCE_BOUNDARY_VALIDATION_REASONS = [
  "governance_boundary_viewer_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "missing_edge_node",
  "not_non_executable",
] as const;

export const GovernanceBoundarySubsystemClassSchema = z.enum(
  GOVERNANCE_BOUNDARY_SUBSYSTEM_CLASSES,
);
export const GovernanceBoundaryLabelClassSchema = z.enum(
  GOVERNANCE_BOUNDARY_LABEL_CLASSES,
);
export const GovernanceBoundaryEdgePolicySchema = z.enum(
  GOVERNANCE_BOUNDARY_EDGE_POLICIES,
);
export const GovernanceBoundaryGateClassSchema = z.enum(
  GOVERNANCE_BOUNDARY_GATE_CLASSES,
);
export const GovernanceBoundaryCountBinSchema = z.enum(
  GOVERNANCE_BOUNDARY_COUNT_BINS,
);
export const GovernanceBoundaryIncidentFlagClassSchema = z.enum(
  GOVERNANCE_BOUNDARY_INCIDENT_FLAG_CLASSES,
);
export const GovernanceBoundaryValidationReasonSchema = z.enum(
  GOVERNANCE_BOUNDARY_VALIDATION_REASONS,
);

export const GovernanceBoundaryNodeSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.governance_boundary_node"),
    node_id: z.string().trim().min(1).max(160),
    subsystem_class: GovernanceBoundarySubsystemClassSchema,
    label_class: GovernanceBoundaryLabelClassSchema,
    render_safe: z.literal(true),
    metadata_only: z.literal(true),
    non_executable: z.literal(true),
    authority_surface: z.literal(false),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
  });

export const GovernanceBoundaryEdgeSchema = z.strictObject({
  from: z.string().trim().min(1).max(160),
  to: z.string().trim().min(1).max(160),
  policy: GovernanceBoundaryEdgePolicySchema,
  gate_class: GovernanceBoundaryGateClassSchema.optional(),
  observed_count_bin: GovernanceBoundaryCountBinSchema.optional(),
  incident_flag_class: GovernanceBoundaryIncidentFlagClassSchema,
  render_safe: z.literal(true),
  metadata_only: z.literal(true),
  non_executable: z.literal(true),
  authority_surface: z.literal(false),
});

export const GovernanceBoundaryViewerViewModelSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.governance_boundary_viewer_view_model"),
    phase: z.literal("9E3"),
    graph_id: z.string().trim().min(1).max(160),
    nodes: z.array(GovernanceBoundaryNodeSchema),
    edges: z.array(GovernanceBoundaryEdgeSchema),
    generated_at: z.number().int().nonnegative(),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    non_executable: z.literal(true),
    incident_count: z.number().int().nonnegative(),
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
    approve_affordance_allowed: z.literal(false),
    execute_affordance_allowed: z.literal(false),
    graph_execution_allowed: z.literal(false),
  });

export const GovernanceBoundaryViewerValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(GovernanceBoundaryValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    non_executable: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type GovernanceBoundarySubsystemClass = z.infer<
  typeof GovernanceBoundarySubsystemClassSchema
>;
export type GovernanceBoundaryLabelClass = z.infer<
  typeof GovernanceBoundaryLabelClassSchema
>;
export type GovernanceBoundaryEdgePolicy = z.infer<
  typeof GovernanceBoundaryEdgePolicySchema
>;
export type GovernanceBoundaryGateClass = z.infer<
  typeof GovernanceBoundaryGateClassSchema
>;
export type GovernanceBoundaryCountBin = z.infer<
  typeof GovernanceBoundaryCountBinSchema
>;
export type GovernanceBoundaryIncidentFlagClass = z.infer<
  typeof GovernanceBoundaryIncidentFlagClassSchema
>;
export type GovernanceBoundaryValidationReason = z.infer<
  typeof GovernanceBoundaryValidationReasonSchema
>;
export type GovernanceBoundaryNode = z.infer<
  typeof GovernanceBoundaryNodeSchema
>;
export type GovernanceBoundaryEdge = z.infer<
  typeof GovernanceBoundaryEdgeSchema
>;
export type GovernanceBoundaryViewerViewModel = z.infer<
  typeof GovernanceBoundaryViewerViewModelSchema
>;
export type GovernanceBoundaryViewerValidation = z.infer<
  typeof GovernanceBoundaryViewerValidationSchema
>;

export function createDefaultGovernanceBoundaryViewerViewModel(): GovernanceBoundaryViewerViewModel {
  return GovernanceBoundaryViewerViewModelSchema.parse({
    kind: "command_center.governance_boundary_viewer_view_model",
    phase: "9E3",
    graph_id: "governance_boundary:static_default",
    nodes: STATIC_GOVERNANCE_NODES.map((node) => createGovernanceNode(node)),
    edges: STATIC_GOVERNANCE_EDGES.map((edge) =>
      createGovernanceEdge({
        ...edge,
        observed_count_bin: "none",
        incident_flag_class: "none",
      }),
    ),
    generated_at: 0,
    redaction_status: "metadata_only",
    render_safe: true,
    non_executable: true,
    incident_count: 0,
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
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
    approve_affordance_allowed: false,
    execute_affordance_allowed: false,
    graph_execution_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateGovernanceBoundaryViewerViewModel(
  input: unknown,
): GovernanceBoundaryViewerValidation {
  const parsed = GovernanceBoundaryViewerViewModelSchema.safeParse(input);
  const scan = scanGovernanceBoundary(input, [], new WeakSet<object>());
  const reasons = new Set<GovernanceBoundaryValidationReason>();
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
  return GovernanceBoundaryViewerValidationSchema.parse({
    passed,
    reasons: passed ? ["governance_boundary_viewer_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes:
      notes.size > 0
        ? [...notes]
        : ["governance_boundary_viewer_metadata_only"],
    metadata_only: true,
    render_safe: passed,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function deriveGovernanceBoundaryViewerFromObservabilityResponse(
  input: unknown,
): GovernanceBoundaryViewerViewModel {
  if (!validateObservabilityPayloadSafety(input).passed) {
    return createDefaultGovernanceBoundaryViewerViewModel();
  }
  const envelope = readSafeGovernanceEnvelope(input);
  if (!envelope) return createDefaultGovernanceBoundaryViewerViewModel();

  const overlays = new Map(
    envelope.payload.map((item) => [
      edgeKeyFromItemId(item.item_id),
      {
        observed_count_bin: normalizeCountBin(item.count_band),
        incident_flag_class: incidentFlagForOverlay(
          policyForEdgeKey(edgeKeyFromItemId(item.item_id)),
          normalizeCountBin(item.count_band),
        ),
      },
    ]),
  );
  const edges = STATIC_GOVERNANCE_EDGES.map((edge) => {
    const overlay = overlays.get(edgeKey(edge.from, edge.to));
    return createGovernanceEdge({
      ...edge,
      observed_count_bin: overlay?.observed_count_bin ?? "none",
      incident_flag_class: overlay?.incident_flag_class ?? "none",
    });
  });

  return GovernanceBoundaryViewerViewModelSchema.parse({
    ...createDefaultGovernanceBoundaryViewerViewModel(),
    graph_id: "governance_boundary:observed_overlay",
    edges,
    generated_at: envelope.generated_at,
    redaction_status: envelope.redaction_status,
    incident_count: edges.filter((edge) => edge.incident_flag_class === "red")
      .length,
    withheld_fields:
      envelope.withheld_fields.length > 0
        ? envelope.withheld_fields
        : [...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES],
    truncated: envelope.truncated,
  });
}

function createGovernanceNode(input: {
  node_id: string;
  subsystem_class: GovernanceBoundarySubsystemClass;
  label_class: GovernanceBoundaryLabelClass;
}): GovernanceBoundaryNode {
  return GovernanceBoundaryNodeSchema.parse({
    kind: "command_center.governance_boundary_node",
    node_id: input.node_id,
    subsystem_class: input.subsystem_class,
    label_class: input.label_class,
    render_safe: true,
    metadata_only: true,
    non_executable: true,
    authority_surface: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function createGovernanceEdge(input: {
  from: string;
  to: string;
  policy: GovernanceBoundaryEdgePolicy;
  gate_class?: GovernanceBoundaryGateClass;
  observed_count_bin?: GovernanceBoundaryCountBin;
  incident_flag_class: GovernanceBoundaryIncidentFlagClass;
}): GovernanceBoundaryEdge {
  return GovernanceBoundaryEdgeSchema.parse({
    from: input.from,
    to: input.to,
    policy: input.policy,
    gate_class: input.gate_class,
    observed_count_bin: input.observed_count_bin,
    incident_flag_class: input.incident_flag_class,
    render_safe: true,
    metadata_only: true,
    non_executable: true,
    authority_surface: false,
  });
}

function readSafeGovernanceEnvelope(
  input: unknown,
): z.infer<typeof CommandCenterObservabilityResponseEnvelopeSchema> | null {
  const candidate = Array.isArray(input) ? input[0] : input;
  const parsed =
    CommandCenterObservabilityResponseEnvelopeSchema.safeParse(candidate);
  if (!parsed.success) return null;
  if (parsed.data.category !== "governance_boundaries") return null;
  if (!parsed.data.render_safe || parsed.data.raw_payloads_included)
    return null;
  if (!validateObservabilityPayloadSafety(parsed.data).passed) return null;
  return parsed.data;
}

function normalizeCountBin(input: unknown): GovernanceBoundaryCountBin {
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

function incidentFlagForOverlay(
  policy: GovernanceBoundaryEdgePolicy | undefined,
  observedCount: GovernanceBoundaryCountBin,
): GovernanceBoundaryIncidentFlagClass {
  if (policy === "forbidden" && observedCount !== "none") return "red";
  if (
    policy === "gated" &&
    (observedCount === "medium" || observedCount === "high")
  ) {
    return "yellow";
  }
  return "none";
}

function edgeKeyFromItemId(itemId: string): string {
  return itemId
    .replace(/^edge:/, "")
    .replace(":to:", "->")
    .replace(/:/g, "_");
}

function edgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function policyForEdgeKey(
  key: string,
): GovernanceBoundaryEdgePolicy | undefined {
  return STATIC_GOVERNANCE_EDGES.find(
    (edge) => edgeKey(edge.from, edge.to) === key,
  )?.policy;
}

function hasMissingEdgeNode(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const record = input as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(record.nodes) || !Array.isArray(record.edges))
    return false;
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

function hasNonExecutableDisabled(input: unknown): boolean {
  if (!input || typeof input !== "object") return true;
  return (input as { non_executable?: unknown }).non_executable !== true;
}

interface GovernanceBoundaryScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanGovernanceBoundary(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): GovernanceBoundaryScanResult {
  const result: GovernanceBoundaryScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("governance_boundary_missing");
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
    const child = scanGovernanceBoundary(value, [...path, key], seen);
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
    key === "approve_affordance_allowed" ||
    key === "execute_affordance_allowed" ||
    key === "graph_execution_allowed"
  ) {
    return value !== false;
  }
  return (
    [
      ...AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS,
      ...COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
      "approve_button",
      "retry_button",
      "run_button",
      "execute_button",
    ] as readonly string[]
  ).includes(key);
}

const STATIC_GOVERNANCE_NODES: ReadonlyArray<{
  node_id: string;
  subsystem_class: GovernanceBoundarySubsystemClass;
  label_class: GovernanceBoundaryLabelClass;
}> = [
  { node_id: "voice", subsystem_class: "voice", label_class: "source" },
  { node_id: "router", subsystem_class: "router", label_class: "subsystem" },
  { node_id: "safety", subsystem_class: "safety", label_class: "policy_gate" },
  {
    node_id: "tool_registry",
    subsystem_class: "tool_registry",
    label_class: "registry",
  },
  {
    node_id: "approvals",
    subsystem_class: "approvals",
    label_class: "policy_gate",
  },
  { node_id: "vision", subsystem_class: "vision", label_class: "subsystem" },
  {
    node_id: "environment",
    subsystem_class: "environment",
    label_class: "subsystem",
  },
  { node_id: "projects", subsystem_class: "projects", label_class: "store" },
  {
    node_id: "memory_bridge",
    subsystem_class: "memory_bridge",
    label_class: "store",
  },
  {
    node_id: "routines",
    subsystem_class: "routines",
    label_class: "subsystem",
  },
  {
    node_id: "cloud_providers",
    subsystem_class: "cloud_providers",
    label_class: "provider",
  },
  {
    node_id: "local_providers",
    subsystem_class: "local_providers",
    label_class: "provider",
  },
  {
    node_id: "telemetry",
    subsystem_class: "telemetry",
    label_class: "subsystem",
  },
  { node_id: "audit_db", subsystem_class: "audit_db", label_class: "store" },
  {
    node_id: "command_center",
    subsystem_class: "command_center",
    label_class: "viewer",
  },
];

const STATIC_GOVERNANCE_EDGES: ReadonlyArray<{
  from: string;
  to: string;
  policy: GovernanceBoundaryEdgePolicy;
  gate_class?: GovernanceBoundaryGateClass;
}> = [
  { from: "voice", to: "router", policy: "gated", gate_class: "consent" },
  { from: "router", to: "safety", policy: "gated", gate_class: "read_only" },
  {
    from: "router",
    to: "tool_registry",
    policy: "gated",
    gate_class: "approval",
  },
  {
    from: "tool_registry",
    to: "approvals",
    policy: "gated",
    gate_class: "approval",
  },
  {
    from: "vision",
    to: "safety",
    policy: "gated",
    gate_class: "redaction",
  },
  {
    from: "router",
    to: "environment",
    policy: "gated",
    gate_class: "user_present",
  },
  { from: "projects", to: "memory_bridge", policy: "forbidden" },
  { from: "routines", to: "tool_registry", policy: "forbidden" },
  {
    from: "cloud_providers",
    to: "router",
    policy: "gated",
    gate_class: "budget",
  },
  { from: "local_providers", to: "router", policy: "allowed" },
  {
    from: "telemetry",
    to: "command_center",
    policy: "gated",
    gate_class: "redaction",
  },
  {
    from: "audit_db",
    to: "command_center",
    policy: "gated",
    gate_class: "read_only",
  },
  { from: "command_center", to: "tool_registry", policy: "forbidden" },
];
