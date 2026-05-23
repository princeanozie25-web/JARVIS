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
  CommandCenterObservabilitySourcePhaseSchema,
  type CommandCenterObservabilitySourcePhase,
} from "./observability-adapters";
import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const RUNTIME_DEPENDENCY_MODULE_CLASSES = [
  "governance",
  "router",
  "approvals",
  "tools",
  "telemetry",
  "audit",
  "voice",
  "projects",
  "environment",
  "vision",
  "routines",
  "command_center",
  "providers",
  "unknown_safe",
] as const;
export const RUNTIME_DEPENDENCY_LABEL_CLASSES = [
  "module",
  "policy",
  "adapter",
  "viewer",
  "provider",
  "projection",
  "unknown_safe",
] as const;
export const RUNTIME_DEPENDENCY_EDGE_CLASSES = [
  "static_import",
  "observed_call",
  "policy_reference",
  "read_only_projection",
] as const;
export const RUNTIME_DEPENDENCY_COUNT_BINS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const RUNTIME_DEPENDENCY_COUPLING_RISK_CLASSES = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS = [
  "source_code",
  "code_body",
  "file_body",
  "source_snippet",
  "raw_stack_trace",
] as const;
export const RUNTIME_DEPENDENCY_VIEWER_VALIDATION_REASONS = [
  "runtime_dependency_viewer_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "source_code_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "missing_edge_node",
  "not_non_executable",
] as const;

export const RuntimeDependencyModuleClassSchema = z.enum(
  RUNTIME_DEPENDENCY_MODULE_CLASSES,
);
export const RuntimeDependencyLabelClassSchema = z.enum(
  RUNTIME_DEPENDENCY_LABEL_CLASSES,
);
export const RuntimeDependencyEdgeClassSchema = z.enum(
  RUNTIME_DEPENDENCY_EDGE_CLASSES,
);
export const RuntimeDependencyCountBinSchema = z.enum(
  RUNTIME_DEPENDENCY_COUNT_BINS,
);
export const RuntimeDependencyCouplingRiskClassSchema = z.enum(
  RUNTIME_DEPENDENCY_COUPLING_RISK_CLASSES,
);
export const RuntimeDependencyForbiddenSourceFieldSchema = z.enum(
  RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
);
export const RuntimeDependencyViewerValidationReasonSchema = z.enum(
  RUNTIME_DEPENDENCY_VIEWER_VALIDATION_REASONS,
);

export const RuntimeDependencyNodeSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.runtime_dependency_node"),
    node_id: z.string().trim().min(1).max(160),
    module_class: RuntimeDependencyModuleClassSchema,
    label_class: RuntimeDependencyLabelClassSchema,
    source_phase: CommandCenterObservabilitySourcePhaseSchema.optional(),
    render_safe: z.literal(true),
    metadata_only: z.literal(true),
    non_executable: z.literal(true),
    authority_surface: z.literal(false),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    implementation_body_included: z.literal(false),
  });

export const RuntimeDependencyEdgeSchema = z.strictObject({
  from: z.string().trim().min(1).max(160),
  to: z.string().trim().min(1).max(160),
  edge_class: RuntimeDependencyEdgeClassSchema,
  observed_count_bin: RuntimeDependencyCountBinSchema.optional(),
  coupling_risk_class: RuntimeDependencyCouplingRiskClassSchema,
  render_safe: z.literal(true),
  metadata_only: z.literal(true),
  non_executable: z.literal(true),
  authority_surface: z.literal(false),
});

export const RuntimeDependencyViewerViewModelSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.runtime_dependency_viewer_view_model"),
    phase: z.literal("9E4"),
    graph_id: z.string().trim().min(1).max(160),
    nodes: z.array(RuntimeDependencyNodeSchema),
    edges: z.array(RuntimeDependencyEdgeSchema),
    generated_at: z.number().int().nonnegative(),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    non_executable: z.literal(true),
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
    execute_affordance_allowed: z.literal(false),
    graph_execution_allowed: z.literal(false),
  });

export const RuntimeDependencyViewerValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(RuntimeDependencyViewerValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    non_executable: z.literal(true),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    implementation_body_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type RuntimeDependencyModuleClass = z.infer<
  typeof RuntimeDependencyModuleClassSchema
>;
export type RuntimeDependencyLabelClass = z.infer<
  typeof RuntimeDependencyLabelClassSchema
>;
export type RuntimeDependencyEdgeClass = z.infer<
  typeof RuntimeDependencyEdgeClassSchema
>;
export type RuntimeDependencyCountBin = z.infer<
  typeof RuntimeDependencyCountBinSchema
>;
export type RuntimeDependencyCouplingRiskClass = z.infer<
  typeof RuntimeDependencyCouplingRiskClassSchema
>;
export type RuntimeDependencyForbiddenSourceField = z.infer<
  typeof RuntimeDependencyForbiddenSourceFieldSchema
>;
export type RuntimeDependencyViewerValidationReason = z.infer<
  typeof RuntimeDependencyViewerValidationReasonSchema
>;
export type RuntimeDependencyNode = z.infer<typeof RuntimeDependencyNodeSchema>;
export type RuntimeDependencyEdge = z.infer<typeof RuntimeDependencyEdgeSchema>;
export type RuntimeDependencyViewerViewModel = z.infer<
  typeof RuntimeDependencyViewerViewModelSchema
>;
export type RuntimeDependencyViewerValidation = z.infer<
  typeof RuntimeDependencyViewerValidationSchema
>;

export function createDefaultRuntimeDependencyViewerViewModel(): RuntimeDependencyViewerViewModel {
  return RuntimeDependencyViewerViewModelSchema.parse({
    kind: "command_center.runtime_dependency_viewer_view_model",
    phase: "9E4",
    graph_id: "runtime_dependency:static_default",
    nodes: STATIC_RUNTIME_DEPENDENCY_NODES.map((node) =>
      createRuntimeDependencyNode(node),
    ),
    edges: STATIC_RUNTIME_DEPENDENCY_EDGES.map((edge) =>
      createRuntimeDependencyEdge({
        ...edge,
        observed_count_bin: "none",
        coupling_risk_class: "none",
      }),
    ),
    generated_at: 0,
    redaction_status: "metadata_only",
    render_safe: true,
    non_executable: true,
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
    execute_affordance_allowed: false,
    graph_execution_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateRuntimeDependencyViewerViewModel(
  input: unknown,
): RuntimeDependencyViewerValidation {
  const parsed = RuntimeDependencyViewerViewModelSchema.safeParse(input);
  const scan = scanRuntimeDependency(input, [], new WeakSet<object>());
  const reasons = new Set<RuntimeDependencyViewerValidationReason>();
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
  if (hasMissingEdgeNode(input)) reasons.add("missing_edge_node");
  if (hasNonExecutableDisabled(input)) reasons.add("not_non_executable");
  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.sourceCodeFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return RuntimeDependencyViewerValidationSchema.parse({
    passed,
    reasons: passed ? ["runtime_dependency_viewer_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes:
      notes.size > 0 ? [...notes] : ["runtime_dependency_viewer_metadata_only"],
    metadata_only: true,
    render_safe: passed,
    non_executable: true,
    raw_payloads_included: false,
    exact_pii_included: false,
    implementation_body_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function deriveRuntimeDependencyViewerFromObservabilityResponse(
  input: unknown,
): RuntimeDependencyViewerViewModel {
  if (!validateObservabilityPayloadSafety(input).passed) {
    return createDefaultRuntimeDependencyViewerViewModel();
  }
  if (containsSourceCodeField(input)) {
    return createDefaultRuntimeDependencyViewerViewModel();
  }
  const envelope = readSafeRuntimeDependencyEnvelope(input);
  if (!envelope) return createDefaultRuntimeDependencyViewerViewModel();

  const defaultGraph = createDefaultRuntimeDependencyViewerViewModel();
  const nodeMap = new Map(
    defaultGraph.nodes.map((node) => [node.node_id, node]),
  );
  const edgeMap = new Map(
    defaultGraph.edges.map((edge) => [edgeKey(edge.from, edge.to), edge]),
  );

  for (const item of envelope.payload) {
    const parsedEdge = parseEdgeId(item.item_id);
    if (!parsedEdge) continue;
    if (!nodeMap.has(parsedEdge.from)) {
      nodeMap.set(
        parsedEdge.from,
        createRuntimeDependencyNode(nodeDescriptorForId(parsedEdge.from)),
      );
    }
    if (!nodeMap.has(parsedEdge.to)) {
      nodeMap.set(
        parsedEdge.to,
        createRuntimeDependencyNode(nodeDescriptorForId(parsedEdge.to)),
      );
    }
    const edgeClass = edgeClassFromItemClass(item.item_class);
    edgeMap.set(
      edgeKey(parsedEdge.from, parsedEdge.to),
      createRuntimeDependencyEdge({
        from: parsedEdge.from,
        to: parsedEdge.to,
        edge_class: edgeClass,
        observed_count_bin: normalizeCountBin(item.count_band),
        coupling_risk_class: couplingRiskFromStatusAndCount(
          item.status,
          normalizeCountBin(item.count_band),
        ),
      }),
    );
  }

  return RuntimeDependencyViewerViewModelSchema.parse({
    ...defaultGraph,
    graph_id: "runtime_dependency:observed_overlay",
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
    generated_at: envelope.generated_at,
    redaction_status: envelope.redaction_status,
    withheld_fields:
      envelope.withheld_fields.length > 0
        ? envelope.withheld_fields
        : [
            ...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
            ...RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
          ],
    truncated: envelope.truncated,
  });
}

function createRuntimeDependencyNode(input: {
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

function createRuntimeDependencyEdge(input: {
  from: string;
  to: string;
  edge_class: RuntimeDependencyEdgeClass;
  observed_count_bin?: RuntimeDependencyCountBin;
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

function readSafeRuntimeDependencyEnvelope(
  input: unknown,
): z.infer<typeof CommandCenterObservabilityResponseEnvelopeSchema> | null {
  const candidate = Array.isArray(input) ? input[0] : input;
  const parsed =
    CommandCenterObservabilityResponseEnvelopeSchema.safeParse(candidate);
  if (!parsed.success) return null;
  if (parsed.data.category !== "runtime_dependencies") return null;
  if (!parsed.data.render_safe || parsed.data.raw_payloads_included)
    return null;
  if (!validateObservabilityPayloadSafety(parsed.data).passed) return null;
  return parsed.data;
}

function parseEdgeId(itemId: string): { from: string; to: string } | null {
  const normalized = itemId.replace(/^edge:/, "");
  const parts = normalized.split(":to:");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { from: parts[0], to: parts[1] };
}

function edgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function edgeClassFromItemClass(itemClass: string): RuntimeDependencyEdgeClass {
  if (
    (RUNTIME_DEPENDENCY_EDGE_CLASSES as readonly string[]).includes(itemClass)
  ) {
    return itemClass as RuntimeDependencyEdgeClass;
  }
  return "observed_call";
}

function normalizeCountBin(input: unknown): RuntimeDependencyCountBin {
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

function couplingRiskFromStatusAndCount(
  status: unknown,
  count: RuntimeDependencyCountBin,
): RuntimeDependencyCouplingRiskClass {
  if (status === "high_risk" || status === "degraded") return "high";
  if (status === "medium_risk") return "medium";
  if (count === "high") return "medium";
  if (count === "medium") return "low";
  if (count === "low") return "low";
  return "none";
}

function nodeDescriptorForId(input: string): {
  node_id: string;
  module_class: RuntimeDependencyModuleClass;
  label_class: RuntimeDependencyLabelClass;
  source_phase?: CommandCenterObservabilitySourcePhase;
} {
  const moduleClass = moduleClassFromId(input);
  return {
    node_id: input,
    module_class: moduleClass,
    label_class: labelClassForModule(moduleClass),
    source_phase: sourcePhaseForModule(moduleClass),
  };
}

function moduleClassFromId(input: string): RuntimeDependencyModuleClass {
  if (input.includes("governance")) return "governance";
  if (input.includes("router")) return "router";
  if (input.includes("approval")) return "approvals";
  if (input.includes("tool")) return "tools";
  if (input.includes("telemetry")) return "telemetry";
  if (input.includes("audit")) return "audit";
  if (input.includes("voice")) return "voice";
  if (input.includes("project")) return "projects";
  if (input.includes("environment")) return "environment";
  if (input.includes("vision")) return "vision";
  if (input.includes("routine")) return "routines";
  if (input.includes("command_center")) return "command_center";
  if (input.includes("provider")) return "providers";
  return "unknown_safe";
}

function labelClassForModule(
  moduleClass: RuntimeDependencyModuleClass,
): RuntimeDependencyLabelClass {
  if (moduleClass === "command_center") return "viewer";
  if (moduleClass === "providers") return "provider";
  if (moduleClass === "governance") return "policy";
  if (moduleClass === "audit") return "projection";
  if (moduleClass === "unknown_safe") return "unknown_safe";
  return "module";
}

function sourcePhaseForModule(
  moduleClass: RuntimeDependencyModuleClass,
): CommandCenterObservabilitySourcePhase | undefined {
  const map: Partial<
    Record<RuntimeDependencyModuleClass, CommandCenterObservabilitySourcePhase>
  > = {
    router: "phase_router",
    approvals: "phase_approvals",
    tools: "phase_tools",
    telemetry: "phase_traces",
    audit: "phase_runtime_dependencies",
    voice: "phase_vision",
    projects: "phase_projects",
    environment: "phase_environment",
    vision: "phase_vision",
    routines: "phase_routines",
    command_center: "phase_runtime_dependencies",
    providers: "phase_runtime_dependencies",
    governance: "phase_governance",
  };
  return map[moduleClass];
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

interface RuntimeDependencyScanResult {
  rawPayloadFields: string[];
  sourceCodeFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanRuntimeDependency(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): RuntimeDependencyScanResult {
  const result: RuntimeDependencyScanResult = {
    rawPayloadFields: [],
    sourceCodeFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("runtime_dependency_missing");
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
    if (isForbiddenSourceCodeField(key)) {
      result.sourceCodeFields.push([...path, key].join("."));
    }
    if (isExecutableAffordanceKey(key, value)) {
      result.executableFields.push([...path, key].join("."));
    }
    const child = scanRuntimeDependency(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.sourceCodeFields.push(...child.sourceCodeFields);
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

function isForbiddenSourceCodeField(key: string): boolean {
  return (
    RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS as readonly string[]
  ).includes(key);
}

function containsSourceCodeField(input: unknown): boolean {
  return (
    scanRuntimeDependency(input, [], new WeakSet<object>()).sourceCodeFields
      .length > 0
  );
}

function isExecutableAffordanceKey(key: string, value: unknown): boolean {
  if (
    key === "run_affordance_allowed" ||
    key === "retry_affordance_allowed" ||
    key === "execute_affordance_allowed" ||
    key === "graph_execution_allowed"
  ) {
    return value !== false;
  }
  return (
    [
      ...AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS,
      ...COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
      "retry_button",
      "run_button",
      "execute_button",
    ] as readonly string[]
  ).includes(key);
}

const STATIC_RUNTIME_DEPENDENCY_NODES: ReadonlyArray<{
  node_id: string;
  module_class: RuntimeDependencyModuleClass;
  label_class: RuntimeDependencyLabelClass;
  source_phase?: CommandCenterObservabilitySourcePhase;
}> = [
  {
    node_id: "command_center",
    module_class: "command_center",
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
    node_id: "audit_viewers",
    module_class: "audit",
    label_class: "projection",
    source_phase: "phase_runtime_dependencies",
  },
];

const STATIC_RUNTIME_DEPENDENCY_EDGES: ReadonlyArray<{
  from: string;
  to: string;
  edge_class: RuntimeDependencyEdgeClass;
}> = [
  {
    from: "observability_contract",
    to: "command_center",
    edge_class: "read_only_projection",
  },
  {
    from: "audit_viewers",
    to: "command_center",
    edge_class: "static_import",
  },
];
