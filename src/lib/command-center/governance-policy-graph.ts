import { z } from "zod";

import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import {
  GovernanceBoundaryEdgeSchema,
  GovernanceBoundaryLabelClassSchema,
  GovernanceBoundaryNodeSchema,
  GovernanceBoundarySubsystemClassSchema,
  GovernanceBoundaryViewerViewModelSchema,
  createDefaultGovernanceBoundaryViewerViewModel,
  type GovernanceBoundaryEdge,
  type GovernanceBoundaryEdgePolicy,
  type GovernanceBoundaryGateClass,
  type GovernanceBoundaryIncidentFlagClass,
  type GovernanceBoundaryLabelClass,
  type GovernanceBoundaryNode,
  type GovernanceBoundarySubsystemClass,
  type GovernanceBoundaryViewerViewModel,
} from "./audit-governance-boundary";
import { CommandCenterObservabilityRedactionStatusSchema } from "./observability-contract";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const GOVERNANCE_POLICY_GRAPH_SOURCE_OF_TRUTH_VALUES = [
  "static_policy",
] as const;
export const GOVERNANCE_POLICY_GRAPH_VALIDATION_REASONS = [
  "governance_policy_graph_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "unknown_enum_value",
  "missing_edge_node",
  "invalid_source_of_truth",
  "render_not_safe",
  "not_non_executable",
] as const;

export const GovernancePolicyGraphSourceOfTruthSchema = z.enum(
  GOVERNANCE_POLICY_GRAPH_SOURCE_OF_TRUTH_VALUES,
);
export const GovernancePolicyGraphValidationReasonSchema = z.enum(
  GOVERNANCE_POLICY_GRAPH_VALIDATION_REASONS,
);

export const GovernancePolicyGraphSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.governance_policy_graph"),
    phase: z.literal("9G1"),
    graph_id: z.string().trim().min(1).max(160),
    nodes: z.array(GovernanceBoundaryNodeSchema),
    edges: z.array(GovernanceBoundaryEdgeSchema),
    generated_at: z.number().int().nonnegative(),
    source_of_truth: z.literal("static_policy"),
    render_safe: z.literal(true),
    non_executable: z.literal(true),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
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
    mutate_affordance_allowed: z.literal(false),
    graph_execution_allowed: z.literal(false),
    policy_edges_executable: z.literal(false),
  });

export const GovernancePolicyGraphValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(GovernancePolicyGraphValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    non_executable: z.boolean(),
    static_policy_source_of_truth: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type GovernancePolicyGraphSourceOfTruth = z.infer<
  typeof GovernancePolicyGraphSourceOfTruthSchema
>;
export type GovernancePolicyGraphValidationReason = z.infer<
  typeof GovernancePolicyGraphValidationReasonSchema
>;
export type GovernancePolicyGraph = z.infer<typeof GovernancePolicyGraphSchema>;
export type GovernancePolicyGraphValidation = z.infer<
  typeof GovernancePolicyGraphValidationSchema
>;

export function createDefaultGovernancePolicyGraph(): GovernancePolicyGraph {
  return GovernancePolicyGraphSchema.parse({
    kind: "command_center.governance_policy_graph",
    phase: "9G1",
    graph_id: "governance_policy:static_default",
    nodes: STATIC_GOVERNANCE_POLICY_NODES.map((node) => createPolicyNode(node)),
    edges: STATIC_GOVERNANCE_POLICY_EDGES.map((edge) =>
      createPolicyEdge({
        ...edge,
        observed_count_bin: "none",
        incident_flag_class: "none",
      }),
    ),
    generated_at: 0,
    source_of_truth: "static_policy",
    render_safe: true,
    non_executable: true,
    redaction_status: "metadata_only",
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
    mutate_affordance_allowed: false,
    graph_execution_allowed: false,
    policy_edges_executable: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateGovernancePolicyGraph(
  input: unknown,
): GovernancePolicyGraphValidation {
  const parsed = GovernancePolicyGraphSchema.safeParse(input);
  const scan = scanGovernancePolicyGraph(input, [], new WeakSet<object>());
  const reasons = new Set<GovernancePolicyGraphValidationReason>();
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
  if (hasUnknownEnumValues(input)) reasons.add("unknown_enum_value");
  if (hasMissingEdgeNode(input)) reasons.add("missing_edge_node");
  if (readField(input, "source_of_truth") !== "static_policy") {
    reasons.add("invalid_source_of_truth");
  }
  if (readBooleanField(input, "render_safe") !== true)
    reasons.add("render_not_safe");
  if (readBooleanField(input, "non_executable") !== true)
    reasons.add("not_non_executable");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return GovernancePolicyGraphValidationSchema.parse({
    passed,
    reasons: passed ? ["governance_policy_graph_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["governance_policy_graph_static"],
    metadata_only: true,
    render_safe: passed,
    non_executable: passed,
    static_policy_source_of_truth:
      readField(input, "source_of_truth") === "static_policy",
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function projectGovernancePolicyGraphToAuditViewer(
  input: unknown,
): GovernanceBoundaryViewerViewModel {
  const parsed = GovernancePolicyGraphSchema.safeParse(input);
  const validation = validateGovernancePolicyGraph(input);
  if (!parsed.success || !validation.passed) {
    return createDefaultGovernanceBoundaryViewerViewModel();
  }
  const graph = parsed.data;
  return GovernanceBoundaryViewerViewModelSchema.parse({
    ...createDefaultGovernanceBoundaryViewerViewModel(),
    graph_id: graph.graph_id,
    nodes: graph.nodes,
    edges: graph.edges,
    generated_at: graph.generated_at,
    redaction_status: graph.redaction_status,
    incident_count: graph.edges.filter(
      (edge) => edge.incident_flag_class === "red",
    ).length,
    withheld_fields: graph.withheld_fields,
    truncated: graph.truncated,
  });
}

function createPolicyNode(input: {
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

function createPolicyEdge(input: {
  from: string;
  to: string;
  policy: GovernanceBoundaryEdgePolicy;
  gate_class?: GovernanceBoundaryGateClass;
  observed_count_bin?: GovernanceBoundaryEdge["observed_count_bin"];
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

interface GovernancePolicyGraphScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanGovernancePolicyGraph(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): GovernancePolicyGraphScanResult {
  const result: GovernancePolicyGraphScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("governance_policy_graph_missing");
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
    if (isForbiddenRawPayloadField(key)) {
      result.rawPayloadFields.push([...path, key].join("."));
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push([...path, key].join("."));
    }
    const child = scanGovernancePolicyGraph(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function hasUnknownEnumValues(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  const nodes = Array.isArray(record.nodes) ? record.nodes : [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const candidate = node as Record<string, unknown>;
    if (
      "subsystem_class" in candidate &&
      !GovernanceBoundarySubsystemClassSchema.safeParse(
        candidate.subsystem_class,
      ).success
    ) {
      return true;
    }
    if (
      "label_class" in candidate &&
      !GovernanceBoundaryLabelClassSchema.safeParse(candidate.label_class)
        .success
    ) {
      return true;
    }
  }
  const edges = Array.isArray(record.edges) ? record.edges : [];
  for (const edge of edges) {
    if (!edge || typeof edge !== "object") continue;
    if (!GovernanceBoundaryEdgeSchema.safeParse(edge).success) return true;
  }
  return false;
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
    key === "mutate_affordance_allowed" ||
    key === "graph_execution_allowed" ||
    key === "policy_edges_executable"
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
      "mutate_button",
      "graph_execute",
    ] as readonly string[]
  ).includes(key);
}

function readField(input: unknown, field: string): unknown {
  if (!input || typeof input !== "object") return undefined;
  return (input as Record<string, unknown>)[field];
}

function readBooleanField(input: unknown, field: string): boolean | undefined {
  const value = readField(input, field);
  return typeof value === "boolean" ? value : undefined;
}

const STATIC_GOVERNANCE_POLICY_NODES: ReadonlyArray<{
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

const STATIC_GOVERNANCE_POLICY_EDGES: ReadonlyArray<{
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
  { from: "command_center", to: "approvals", policy: "forbidden" },
  { from: "command_center", to: "environment", policy: "forbidden" },
];
