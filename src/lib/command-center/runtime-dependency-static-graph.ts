import { z } from "zod";

import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import {
  RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
  RuntimeDependencyCouplingRiskClassSchema,
  RuntimeDependencyEdgeClassSchema,
  RuntimeDependencyEdgeSchema,
  RuntimeDependencyLabelClassSchema,
  RuntimeDependencyModuleClassSchema,
  RuntimeDependencyNodeSchema,
  RuntimeDependencyViewerViewModelSchema,
  createDefaultRuntimeDependencyViewerViewModel,
  type RuntimeDependencyCouplingRiskClass,
  type RuntimeDependencyEdge,
  type RuntimeDependencyEdgeClass,
  type RuntimeDependencyLabelClass,
  type RuntimeDependencyModuleClass,
  type RuntimeDependencyNode,
  type RuntimeDependencyViewerViewModel,
} from "./audit-runtime-dependency";
import {
  CommandCenterObservabilitySourcePhaseSchema,
  type CommandCenterObservabilitySourcePhase,
} from "./observability-adapters";
import { CommandCenterObservabilityRedactionStatusSchema } from "./observability-contract";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const RUNTIME_DEPENDENCY_STATIC_GRAPH_SOURCE_KINDS = [
  "static_build_artifact",
] as const;
export const RUNTIME_DEPENDENCY_STATIC_GRAPH_VALIDATION_REASONS = [
  "runtime_dependency_static_graph_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "source_code_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "unknown_enum_value",
  "missing_edge_node",
  "invalid_source_kind",
  "render_not_safe",
  "not_non_executable",
  "source_code_exposed",
] as const;

export const RuntimeDependencyStaticGraphSourceKindSchema = z.enum(
  RUNTIME_DEPENDENCY_STATIC_GRAPH_SOURCE_KINDS,
);
export const RuntimeDependencyStaticGraphValidationReasonSchema = z.enum(
  RUNTIME_DEPENDENCY_STATIC_GRAPH_VALIDATION_REASONS,
);

export const RuntimeDependencyStaticGraphSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.runtime_dependency_static_graph"),
    phase: z.literal("9H1"),
    graph_id: z.string().trim().min(1).max(160),
    nodes: z.array(RuntimeDependencyNodeSchema),
    edges: z.array(RuntimeDependencyEdgeSchema),
    generated_at: z.number().int().nonnegative(),
    source_kind: z.literal("static_build_artifact"),
    render_safe: z.literal(true),
    non_executable: z.literal(true),
    source_code_exposed: z.literal(false),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    withheld_fields: z.array(z.string().trim().min(1).max(160)),
    truncated: z.boolean(),
    metadata_only: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    implementation_body_included: z.literal(false),
    authority_surface: z.literal(false),
    callbacks_allowed: z.literal(false),
    event_handlers_allowed: z.literal(false),
    run_affordance_allowed: z.literal(false),
    retry_affordance_allowed: z.literal(false),
    approve_affordance_allowed: z.literal(false),
    execute_affordance_allowed: z.literal(false),
    mutate_affordance_allowed: z.literal(false),
    graph_execution_allowed: z.literal(false),
    source_parsing_wired: z.literal(false),
    live_code_introspection_wired: z.literal(false),
    source_code_rendering_allowed: z.literal(false),
    graph_edges_executable: z.literal(false),
  });

export const RuntimeDependencyStaticGraphValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(RuntimeDependencyStaticGraphValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    non_executable: z.boolean(),
    source_code_exposed: z.boolean(),
    static_build_artifact_source: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    implementation_body_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type RuntimeDependencyStaticGraphSourceKind = z.infer<
  typeof RuntimeDependencyStaticGraphSourceKindSchema
>;
export type RuntimeDependencyStaticGraphValidationReason = z.infer<
  typeof RuntimeDependencyStaticGraphValidationReasonSchema
>;
export type RuntimeDependencyStaticGraph = z.infer<
  typeof RuntimeDependencyStaticGraphSchema
>;
export type RuntimeDependencyStaticGraphValidation = z.infer<
  typeof RuntimeDependencyStaticGraphValidationSchema
>;

export function createDefaultRuntimeDependencyStaticGraph(): RuntimeDependencyStaticGraph {
  return RuntimeDependencyStaticGraphSchema.parse({
    kind: "command_center.runtime_dependency_static_graph",
    phase: "9H1",
    graph_id: "runtime_dependency_static:build_artifact_default",
    nodes: STATIC_RUNTIME_DEPENDENCY_GRAPH_NODES.map((node) =>
      createStaticRuntimeDependencyNode(node),
    ),
    edges: STATIC_RUNTIME_DEPENDENCY_GRAPH_EDGES.map((edge) =>
      createStaticRuntimeDependencyEdge(edge),
    ),
    generated_at: 0,
    source_kind: "static_build_artifact",
    render_safe: true,
    non_executable: true,
    source_code_exposed: false,
    redaction_status: "metadata_only",
    withheld_fields: [
      ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
      ...RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
    ],
    truncated: false,
    metadata_only: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    implementation_body_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    run_affordance_allowed: false,
    retry_affordance_allowed: false,
    approve_affordance_allowed: false,
    execute_affordance_allowed: false,
    mutate_affordance_allowed: false,
    graph_execution_allowed: false,
    source_parsing_wired: false,
    live_code_introspection_wired: false,
    source_code_rendering_allowed: false,
    graph_edges_executable: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateRuntimeDependencyStaticGraph(
  input: unknown,
): RuntimeDependencyStaticGraphValidation {
  const parsed = RuntimeDependencyStaticGraphSchema.safeParse(input);
  const scan = scanRuntimeDependencyStaticGraph(
    input,
    [],
    new WeakSet<object>(),
  );
  const reasons = new Set<RuntimeDependencyStaticGraphValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.sourceCodeFields.length > 0)
    reasons.add("source_code_field_present");
  if (scan.executableFields.length > 0) {
    reasons.add("executable_affordance_present");
  }
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (hasUnknownEnumValues(input)) reasons.add("unknown_enum_value");
  if (hasMissingEdgeNode(input)) reasons.add("missing_edge_node");
  if (readField(input, "source_kind") !== "static_build_artifact") {
    reasons.add("invalid_source_kind");
  }
  if (readBooleanField(input, "render_safe") !== true)
    reasons.add("render_not_safe");
  if (readBooleanField(input, "non_executable") !== true)
    reasons.add("not_non_executable");
  if (readBooleanField(input, "source_code_exposed") !== false) {
    reasons.add("source_code_exposed");
  }

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.sourceCodeFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return RuntimeDependencyStaticGraphValidationSchema.parse({
    passed,
    reasons: passed ? ["runtime_dependency_static_graph_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes:
      notes.size > 0
        ? [...notes]
        : ["runtime_dependency_static_graph_build_artifact_only"],
    metadata_only: true,
    render_safe: passed,
    non_executable: passed,
    source_code_exposed:
      readBooleanField(input, "source_code_exposed") === true,
    static_build_artifact_source:
      readField(input, "source_kind") === "static_build_artifact",
    raw_payloads_included: false,
    exact_pii_included: false,
    implementation_body_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function projectRuntimeDependencyStaticGraphToAuditViewer(
  input: unknown,
): RuntimeDependencyViewerViewModel {
  const parsed = RuntimeDependencyStaticGraphSchema.safeParse(input);
  const validation = validateRuntimeDependencyStaticGraph(input);
  if (!parsed.success || !validation.passed) {
    return createDefaultRuntimeDependencyViewerViewModel();
  }
  const graph = parsed.data;
  return RuntimeDependencyViewerViewModelSchema.parse({
    ...createDefaultRuntimeDependencyViewerViewModel(),
    graph_id: graph.graph_id,
    nodes: graph.nodes,
    edges: graph.edges,
    generated_at: graph.generated_at,
    redaction_status: graph.redaction_status,
    withheld_fields: graph.withheld_fields,
    truncated: graph.truncated,
    non_executable: true,
    implementation_body_included: false,
    graph_execution_allowed: false,
  });
}

function createStaticRuntimeDependencyNode(input: {
  node_id: string;
  module_class: RuntimeDependencyModuleClass;
  label_class: RuntimeDependencyLabelClass;
  source_phase?: CommandCenterObservabilitySourcePhase;
}): RuntimeDependencyNode {
  return RuntimeDependencyNodeSchema.parse({
    kind: "command_center.runtime_dependency_node",
    node_id: input.node_id,
    module_class: input.module_class,
    label_class: input.label_class,
    source_phase: input.source_phase,
    render_safe: true,
    metadata_only: true,
    non_executable: true,
    authority_surface: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    implementation_body_included: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function createStaticRuntimeDependencyEdge(input: {
  from: string;
  to: string;
  edge_class: RuntimeDependencyEdgeClass;
  observed_count_bin?: RuntimeDependencyEdge["observed_count_bin"];
  coupling_risk_class: RuntimeDependencyCouplingRiskClass;
}): RuntimeDependencyEdge {
  return RuntimeDependencyEdgeSchema.parse({
    from: input.from,
    to: input.to,
    edge_class: input.edge_class,
    observed_count_bin: input.observed_count_bin,
    coupling_risk_class: input.coupling_risk_class,
    render_safe: true,
    metadata_only: true,
    non_executable: true,
    authority_surface: false,
  });
}

interface RuntimeDependencyStaticGraphScanResult {
  rawPayloadFields: string[];
  sourceCodeFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanRuntimeDependencyStaticGraph(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): RuntimeDependencyStaticGraphScanResult {
  const result: RuntimeDependencyStaticGraphScanResult = {
    rawPayloadFields: [],
    sourceCodeFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0)
      result.notes.push("runtime_dependency_static_graph_missing");
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
    if (isForbiddenSourceCodeField(key)) {
      result.sourceCodeFields.push([...path, key].join("."));
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push([...path, key].join("."));
    }
    const child = scanRuntimeDependencyStaticGraph(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.sourceCodeFields.push(...child.sourceCodeFields);
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
      "module_class" in candidate &&
      !RuntimeDependencyModuleClassSchema.safeParse(candidate.module_class)
        .success
    ) {
      return true;
    }
    if (
      "label_class" in candidate &&
      !RuntimeDependencyLabelClassSchema.safeParse(candidate.label_class)
        .success
    ) {
      return true;
    }
    if (
      "source_phase" in candidate &&
      candidate.source_phase !== undefined &&
      !CommandCenterObservabilitySourcePhaseSchema.safeParse(
        candidate.source_phase,
      ).success
    ) {
      return true;
    }
  }
  const edges = Array.isArray(record.edges) ? record.edges : [];
  for (const edge of edges) {
    if (!edge || typeof edge !== "object") continue;
    const candidate = edge as Record<string, unknown>;
    if (
      "edge_class" in candidate &&
      !RuntimeDependencyEdgeClassSchema.safeParse(candidate.edge_class).success
    ) {
      return true;
    }
    if (
      "coupling_risk_class" in candidate &&
      !RuntimeDependencyCouplingRiskClassSchema.safeParse(
        candidate.coupling_risk_class,
      ).success
    ) {
      return true;
    }
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

function isForbiddenSourceCodeField(key: string): boolean {
  return (
    RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS as readonly string[]
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
    key === "source_parsing_wired" ||
    key === "live_code_introspection_wired" ||
    key === "source_code_rendering_allowed" ||
    key === "graph_edges_executable"
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

const STATIC_RUNTIME_DEPENDENCY_GRAPH_NODES: ReadonlyArray<{
  node_id: string;
  module_class: RuntimeDependencyModuleClass;
  label_class: RuntimeDependencyLabelClass;
  source_phase?: CommandCenterObservabilitySourcePhase;
}> = [
  {
    node_id: "runtime_dependency_static_graph",
    module_class: "command_center",
    label_class: "projection",
    source_phase: "phase_runtime_dependencies",
  },
  {
    node_id: "command_center",
    module_class: "command_center",
    label_class: "viewer",
    source_phase: "phase_runtime_dependencies",
  },
  {
    node_id: "audit_runtime_viewer",
    module_class: "audit",
    label_class: "viewer",
    source_phase: "phase_runtime_dependencies",
  },
  {
    node_id: "observability_contract",
    module_class: "telemetry",
    label_class: "projection",
    source_phase: "phase_runtime_dependencies",
  },
  {
    node_id: "trace_record_contract",
    module_class: "audit",
    label_class: "projection",
    source_phase: "phase_traces",
  },
  {
    node_id: "governance_policy_graph",
    module_class: "governance",
    label_class: "policy",
    source_phase: "phase_governance",
  },
];

const STATIC_RUNTIME_DEPENDENCY_GRAPH_EDGES: ReadonlyArray<{
  from: string;
  to: string;
  edge_class: RuntimeDependencyEdgeClass;
  observed_count_bin?: RuntimeDependencyEdge["observed_count_bin"];
  coupling_risk_class: RuntimeDependencyCouplingRiskClass;
}> = [
  {
    from: "observability_contract",
    to: "runtime_dependency_static_graph",
    edge_class: "read_only_projection",
    observed_count_bin: "none",
    coupling_risk_class: "none",
  },
  {
    from: "runtime_dependency_static_graph",
    to: "command_center",
    edge_class: "read_only_projection",
    observed_count_bin: "none",
    coupling_risk_class: "none",
  },
  {
    from: "runtime_dependency_static_graph",
    to: "audit_runtime_viewer",
    edge_class: "static_import",
    observed_count_bin: "none",
    coupling_risk_class: "low",
  },
  {
    from: "trace_record_contract",
    to: "audit_runtime_viewer",
    edge_class: "static_import",
    observed_count_bin: "none",
    coupling_risk_class: "low",
  },
  {
    from: "governance_policy_graph",
    to: "command_center",
    edge_class: "policy_reference",
    observed_count_bin: "none",
    coupling_risk_class: "none",
  },
];
