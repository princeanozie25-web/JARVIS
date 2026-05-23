import { z } from "zod";

import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import {
  RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS,
  RuntimeDependencyCountBinSchema,
  RuntimeDependencyCouplingRiskClassSchema,
  RuntimeDependencyViewerViewModelSchema,
  createDefaultRuntimeDependencyViewerViewModel,
  type RuntimeDependencyViewerViewModel,
} from "./audit-runtime-dependency";
import { CommandCenterObservabilityRedactionStatusSchema } from "./observability-contract";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";
import {
  RuntimeDependencyStaticGraphSchema,
  createDefaultRuntimeDependencyStaticGraph,
  validateRuntimeDependencyStaticGraph,
} from "./runtime-dependency-static-graph";

export const RUNTIME_DEPENDENCY_OBSERVED_LAST_SEEN_BANDS = [
  "unknown",
  "latest",
  "recent",
  "session",
] as const;

export const RUNTIME_DEPENDENCY_OBSERVED_OVERLAY_VALIDATION_REASONS = [
  "runtime_dependency_observed_overlay_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "source_code_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "unknown_enum_value",
  "render_not_safe",
  "not_non_executable",
  "source_code_exposed",
] as const;

export const PHASE_9H_RUNTIME_DEPENDENCY_CLOSEOUT_GUARDS = [
  "no_graph_execution",
  "no_static_graph_mutation_from_overlay",
  "no_observed_edge_authority",
  "no_source_code_rendering",
  "no_live_code_introspection",
  "no_source_parsing_runtime",
  "no_approve_or_execute_affordance",
  "no_run_or_retry_affordance",
  "no_raw_payload_overlay",
  "no_live_telemetry_read",
  "no_db_read_or_write",
  "no_remote_dashboard",
] as const;

export const PHASE_9H_RUNTIME_DEPENDENCY_FORBIDDEN_CAPABILITY_FIELDS = [
  "graph_execution_enabled",
  "static_graph_mutation_from_overlay_enabled",
  "observed_edge_authority_enabled",
  "source_code_rendering_enabled",
  "live_code_introspection_enabled",
  "source_parsing_runtime_enabled",
  "approve_or_execute_affordance_enabled",
  "run_or_retry_affordance_enabled",
  "raw_payload_overlay_enabled",
  "live_telemetry_read_enabled",
  "db_read_or_write_enabled",
  "remote_dashboard_enabled",
] as const;

export const PHASE_9H_RUNTIME_DEPENDENCY_CLOSEOUT_VERDICTS = [
  "pass",
  "fail",
] as const;

export const RuntimeDependencyObservedLastSeenBandSchema = z.enum(
  RUNTIME_DEPENDENCY_OBSERVED_LAST_SEEN_BANDS,
);
export const RuntimeDependencyObservedOverlayValidationReasonSchema = z.enum(
  RUNTIME_DEPENDENCY_OBSERVED_OVERLAY_VALIDATION_REASONS,
);
export const Phase9HRuntimeDependencyCloseoutGuardSchema = z.enum(
  PHASE_9H_RUNTIME_DEPENDENCY_CLOSEOUT_GUARDS,
);
export const Phase9HRuntimeDependencyForbiddenCapabilityFieldSchema = z.enum(
  PHASE_9H_RUNTIME_DEPENDENCY_FORBIDDEN_CAPABILITY_FIELDS,
);
export const Phase9HRuntimeDependencyCloseoutVerdictSchema = z.enum(
  PHASE_9H_RUNTIME_DEPENDENCY_CLOSEOUT_VERDICTS,
);

export const RuntimeDependencyObservedEdgeSchema = z.strictObject({
  from: z.string().trim().min(1).max(160),
  to: z.string().trim().min(1).max(160),
  observed_count_bin: RuntimeDependencyCountBinSchema,
  last_seen_band: RuntimeDependencyObservedLastSeenBandSchema.optional(),
  coupling_risk_class: RuntimeDependencyCouplingRiskClassSchema,
  render_safe: z.literal(true),
  metadata_only: z.literal(true),
  non_executable: z.literal(true),
  authority_surface: z.literal(false),
  source_code_exposed: z.literal(false),
  static_graph_mutation_allowed: z.literal(false),
  edge_executable: z.literal(false),
});

export const RuntimeDependencyObservedOverlaySchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.runtime_dependency_observed_overlay"),
    phase: z.literal("9H2"),
    overlay_id: z.string().trim().min(1).max(160),
    generated_at: z.number().int().nonnegative(),
    source_category: z.literal("runtime_dependencies"),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    non_executable: z.literal(true),
    source_code_exposed: z.literal(false),
    observed_edges: z.array(RuntimeDependencyObservedEdgeSchema),
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
    static_graph_mutation_allowed: z.literal(false),
    observed_edge_authority_allowed: z.literal(false),
    source_code_rendering_allowed: z.literal(false),
    live_code_introspection_wired: z.literal(false),
    source_parsing_wired: z.literal(false),
    live_telemetry_read_allowed: z.literal(false),
    db_read_allowed: z.literal(false),
    db_write_allowed: z.literal(false),
    remote_dashboard_allowed: z.literal(false),
  });

export const RuntimeDependencyObservedOverlayValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(RuntimeDependencyObservedOverlayValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    non_executable: z.boolean(),
    source_code_exposed: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    implementation_body_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export const Phase9HRuntimeDependencyGuardStateSchema = z.strictObject({
  graph_execution_enabled: z.literal(false),
  static_graph_mutation_from_overlay_enabled: z.literal(false),
  observed_edge_authority_enabled: z.literal(false),
  source_code_rendering_enabled: z.literal(false),
  live_code_introspection_enabled: z.literal(false),
  source_parsing_runtime_enabled: z.literal(false),
  approve_or_execute_affordance_enabled: z.literal(false),
  run_or_retry_affordance_enabled: z.literal(false),
  raw_payload_overlay_enabled: z.literal(false),
  live_telemetry_read_enabled: z.literal(false),
  db_read_or_write_enabled: z.literal(false),
  remote_dashboard_enabled: z.literal(false),
});

export const Phase9HRuntimeDependencyCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9h_runtime_dependency_closeout_report"),
  verdict: Phase9HRuntimeDependencyCloseoutVerdictSchema,
  checked_guards: z.array(Phase9HRuntimeDependencyCloseoutGuardSchema),
  failed_guards: z.array(Phase9HRuntimeDependencyCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9h_runtime_dependency_visualizer_scaffold"),
  metadata_only: z.literal(true),
  render_safe: z.boolean(),
  non_executable: z.literal(true),
  static_graph_source_of_truth: z.literal(true),
  overlay_read_only: z.literal(true),
  source_code_exposed: z.literal(false),
  graph_execution_allowed: z.literal(false),
  static_graph_mutation_allowed: z.literal(false),
  observed_edge_authority_allowed: z.literal(false),
  source_code_rendering_allowed: z.literal(false),
  live_code_introspection_allowed: z.literal(false),
  source_parsing_runtime_allowed: z.literal(false),
  raw_payload_overlay_allowed: z.literal(false),
  live_telemetry_read_allowed: z.literal(false),
  db_read_allowed: z.literal(false),
  db_write_allowed: z.literal(false),
  remote_dashboard_allowed: z.literal(false),
  authority_surface: z.literal(false),
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

export type RuntimeDependencyObservedLastSeenBand = z.infer<
  typeof RuntimeDependencyObservedLastSeenBandSchema
>;
export type RuntimeDependencyObservedOverlayValidationReason = z.infer<
  typeof RuntimeDependencyObservedOverlayValidationReasonSchema
>;
export type RuntimeDependencyObservedEdge = z.infer<
  typeof RuntimeDependencyObservedEdgeSchema
>;
export type RuntimeDependencyObservedOverlay = z.infer<
  typeof RuntimeDependencyObservedOverlaySchema
>;
export type RuntimeDependencyObservedOverlayValidation = z.infer<
  typeof RuntimeDependencyObservedOverlayValidationSchema
>;
export type Phase9HRuntimeDependencyCloseoutGuard = z.infer<
  typeof Phase9HRuntimeDependencyCloseoutGuardSchema
>;
export type Phase9HRuntimeDependencyForbiddenCapabilityField = z.infer<
  typeof Phase9HRuntimeDependencyForbiddenCapabilityFieldSchema
>;
export type Phase9HRuntimeDependencyCloseoutVerdict = z.infer<
  typeof Phase9HRuntimeDependencyCloseoutVerdictSchema
>;
export type Phase9HRuntimeDependencyGuardState = z.infer<
  typeof Phase9HRuntimeDependencyGuardStateSchema
>;
export type Phase9HRuntimeDependencyCloseoutReport = z.infer<
  typeof Phase9HRuntimeDependencyCloseoutReportSchema
>;

export interface Phase9HRuntimeDependencyCloseoutInput {
  staticGraph?: unknown;
  overlay?: unknown;
  guardState?: unknown;
}

export const DEFAULT_PHASE_9H_RUNTIME_DEPENDENCY_GUARD_STATE: Phase9HRuntimeDependencyGuardState =
  Phase9HRuntimeDependencyGuardStateSchema.parse({
    graph_execution_enabled: false,
    static_graph_mutation_from_overlay_enabled: false,
    observed_edge_authority_enabled: false,
    source_code_rendering_enabled: false,
    live_code_introspection_enabled: false,
    source_parsing_runtime_enabled: false,
    approve_or_execute_affordance_enabled: false,
    run_or_retry_affordance_enabled: false,
    raw_payload_overlay_enabled: false,
    live_telemetry_read_enabled: false,
    db_read_or_write_enabled: false,
    remote_dashboard_enabled: false,
  });

export function createDefaultRuntimeDependencyObservedOverlay(): RuntimeDependencyObservedOverlay {
  return RuntimeDependencyObservedOverlaySchema.parse({
    kind: "command_center.runtime_dependency_observed_overlay",
    phase: "9H2",
    overlay_id: "runtime_dependency_overlay:empty",
    generated_at: 0,
    source_category: "runtime_dependencies",
    redaction_status: "metadata_only",
    render_safe: true,
    non_executable: true,
    source_code_exposed: false,
    observed_edges: [],
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
    static_graph_mutation_allowed: false,
    observed_edge_authority_allowed: false,
    source_code_rendering_allowed: false,
    live_code_introspection_wired: false,
    source_parsing_wired: false,
    live_telemetry_read_allowed: false,
    db_read_allowed: false,
    db_write_allowed: false,
    remote_dashboard_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateRuntimeDependencyObservedOverlay(
  input: unknown,
): RuntimeDependencyObservedOverlayValidation {
  const parsed = RuntimeDependencyObservedOverlaySchema.safeParse(input);
  const scan = scanRuntimeDependencyObservedOverlay(
    input,
    [],
    new WeakSet<object>(),
  );
  const reasons = new Set<RuntimeDependencyObservedOverlayValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.sourceCodeFields.length > 0)
    reasons.add("source_code_field_present");
  if (scan.executableFields.length > 0)
    reasons.add("executable_affordance_present");
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (hasUnknownOverlayEnums(input)) reasons.add("unknown_enum_value");
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
  return RuntimeDependencyObservedOverlayValidationSchema.parse({
    passed,
    reasons: passed
      ? ["runtime_dependency_observed_overlay_valid"]
      : [...reasons],
    withheld_fields: [...withheldFields],
    notes:
      notes.size > 0
        ? [...notes]
        : ["runtime_dependency_observed_overlay_empty"],
    metadata_only: true,
    render_safe: passed,
    non_executable: passed,
    source_code_exposed:
      readBooleanField(input, "source_code_exposed") === true,
    raw_payloads_included: false,
    exact_pii_included: false,
    implementation_body_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function applyRuntimeDependencyObservedOverlayToStaticGraph(
  staticGraph: unknown,
  overlay: unknown,
): RuntimeDependencyViewerViewModel {
  const graphParsed = RuntimeDependencyStaticGraphSchema.safeParse(staticGraph);
  const overlayParsed =
    RuntimeDependencyObservedOverlaySchema.safeParse(overlay);
  if (
    !graphParsed.success ||
    !overlayParsed.success ||
    !validateRuntimeDependencyStaticGraph(staticGraph).passed ||
    !validateRuntimeDependencyObservedOverlay(overlay).passed
  ) {
    return createDefaultRuntimeDependencyViewerViewModel();
  }

  const graph = graphParsed.data;
  const overlayByEdge = new Map(
    overlayParsed.data.observed_edges.map((edge) => [
      edgeKey(edge.from, edge.to),
      edge,
    ]),
  );
  const staticEdgeKeys = new Set(
    graph.edges.map((edge) => edgeKey(edge.from, edge.to)),
  );
  const withheldUnknownEdges = overlayParsed.data.observed_edges
    .filter((edge) => !staticEdgeKeys.has(edgeKey(edge.from, edge.to)))
    .map((edge) => `observed_edges:${edge.from}->${edge.to}`);
  const edges = graph.edges.map((edge) => {
    const observed = overlayByEdge.get(edgeKey(edge.from, edge.to));
    if (!observed) return edge;
    return {
      ...edge,
      observed_count_bin: observed.observed_count_bin,
      coupling_risk_class: observed.coupling_risk_class,
      render_safe: true,
      metadata_only: true,
      non_executable: true,
      authority_surface: false,
    };
  });

  return RuntimeDependencyViewerViewModelSchema.parse({
    ...createDefaultRuntimeDependencyViewerViewModel(),
    graph_id: graph.graph_id,
    nodes: graph.nodes,
    edges,
    generated_at: Math.max(graph.generated_at, overlayParsed.data.generated_at),
    redaction_status: overlayParsed.data.redaction_status,
    withheld_fields: [
      ...overlayParsed.data.withheld_fields,
      ...withheldUnknownEdges,
    ],
    truncated: graph.truncated || overlayParsed.data.truncated,
    implementation_body_included: false,
    graph_execution_allowed: false,
  });
}

export function createPhase9HRuntimeDependencyCloseoutReport(
  input: Phase9HRuntimeDependencyCloseoutInput = {},
): Phase9HRuntimeDependencyCloseoutReport {
  const failedGuards = new Set<Phase9HRuntimeDependencyCloseoutGuard>();
  const notes = new Set<string>();
  const staticGraph =
    input.staticGraph ?? createDefaultRuntimeDependencyStaticGraph();
  const overlay =
    input.overlay ?? createDefaultRuntimeDependencyObservedOverlay();

  evaluateStaticGraph(staticGraph, failedGuards, notes);
  evaluateObservedOverlay(overlay, failedGuards, notes);
  evaluateOverlayApplication(staticGraph, overlay, failedGuards, notes);
  evaluateNoSourceCodeGuarantee(staticGraph, overlay, failedGuards, notes);
  evaluateGuardState(
    input.guardState ?? DEFAULT_PHASE_9H_RUNTIME_DEPENDENCY_GUARD_STATE,
    failedGuards,
    notes,
  );

  if (failedGuards.size === 0) {
    notes.add("phase_9h_runtime_dependency_scaffold_is_static_overlay_only");
  }

  return Phase9HRuntimeDependencyCloseoutReportSchema.parse({
    kind: "command_center.phase_9h_runtime_dependency_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9H_RUNTIME_DEPENDENCY_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    notes: [...notes],
    generated_from: "phase_9h_runtime_dependency_visualizer_scaffold",
    metadata_only: true,
    render_safe: failedGuards.size === 0,
    non_executable: true,
    static_graph_source_of_truth: true,
    overlay_read_only: true,
    source_code_exposed: false,
    graph_execution_allowed: false,
    static_graph_mutation_allowed: false,
    observed_edge_authority_allowed: false,
    source_code_rendering_allowed: false,
    live_code_introspection_allowed: false,
    source_parsing_runtime_allowed: false,
    raw_payload_overlay_allowed: false,
    live_telemetry_read_allowed: false,
    db_read_allowed: false,
    db_write_allowed: false,
    remote_dashboard_allowed: false,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function evaluateStaticGraph(
  staticGraph: unknown,
  failedGuards: Set<Phase9HRuntimeDependencyCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateRuntimeDependencyStaticGraph(staticGraph);
  if (!validation.passed) {
    failedGuards.add("no_static_graph_mutation_from_overlay");
    notes.add("runtime_dependency_static_graph_validation_failed");
    if (validation.source_code_exposed)
      failedGuards.add("no_source_code_rendering");
  }
}

function evaluateObservedOverlay(
  overlay: unknown,
  failedGuards: Set<Phase9HRuntimeDependencyCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateRuntimeDependencyObservedOverlay(overlay);
  if (!validation.passed) {
    notes.add("runtime_dependency_observed_overlay_validation_failed");
    for (const reason of validation.reasons) {
      if (
        reason === "raw_payload_field_present" ||
        reason === "source_code_field_present"
      ) {
        failedGuards.add("no_raw_payload_overlay");
      }
      if (reason === "source_code_exposed")
        failedGuards.add("no_source_code_rendering");
      if (reason === "executable_affordance_present") {
        failedGuards.add("no_approve_or_execute_affordance");
        failedGuards.add("no_run_or_retry_affordance");
        failedGuards.add("no_graph_execution");
      }
      if (reason === "not_non_executable") {
        failedGuards.add("no_observed_edge_authority");
      }
    }
  }
}

function evaluateOverlayApplication(
  staticGraph: unknown,
  overlay: unknown,
  failedGuards: Set<Phase9HRuntimeDependencyCloseoutGuard>,
  notes: Set<string>,
): void {
  const graphParsed = RuntimeDependencyStaticGraphSchema.safeParse(staticGraph);
  const viewer = applyRuntimeDependencyObservedOverlayToStaticGraph(
    staticGraph,
    overlay,
  );
  if (!graphParsed.success) return;
  if (viewer.graph_id !== graphParsed.data.graph_id) {
    failedGuards.add("no_static_graph_mutation_from_overlay");
    notes.add("runtime_overlay_application_fell_back_or_changed_graph_id");
    return;
  }
  if (
    viewer.nodes.map((node) => node.node_id).join("|") !==
    graphParsed.data.nodes.map((node) => node.node_id).join("|")
  ) {
    failedGuards.add("no_static_graph_mutation_from_overlay");
    notes.add("runtime_overlay_changed_static_nodes");
  }
  if (viewer.edges.length !== graphParsed.data.edges.length) {
    failedGuards.add("no_static_graph_mutation_from_overlay");
    notes.add("runtime_overlay_changed_static_edge_count");
  }
  for (const edge of viewer.edges) {
    const staticEdge = graphParsed.data.edges.find(
      (candidate) => candidate.from === edge.from && candidate.to === edge.to,
    );
    if (!staticEdge) {
      failedGuards.add("no_static_graph_mutation_from_overlay");
      notes.add("runtime_overlay_created_new_edge");
      continue;
    }
    if (edge.edge_class !== staticEdge.edge_class) {
      failedGuards.add("no_static_graph_mutation_from_overlay");
      notes.add("runtime_overlay_changed_static_edge_class");
    }
    if (edge.non_executable !== true || edge.authority_surface !== false) {
      failedGuards.add("no_observed_edge_authority");
      notes.add("runtime_overlay_edge_authority_detected");
    }
  }
}

function evaluateNoSourceCodeGuarantee(
  staticGraph: unknown,
  overlay: unknown,
  failedGuards: Set<Phase9HRuntimeDependencyCloseoutGuard>,
  notes: Set<string>,
): void {
  const viewer = applyRuntimeDependencyObservedOverlayToStaticGraph(
    staticGraph,
    overlay,
  );
  const keys = collectObjectKeys(viewer);
  const sourceFieldsPresent = RUNTIME_DEPENDENCY_FORBIDDEN_SOURCE_FIELDS.some(
    (field) => keys.includes(field),
  );
  if (sourceFieldsPresent) {
    failedGuards.add("no_source_code_rendering");
    notes.add("runtime_projection_exposed_source_code_field");
  }
}

function evaluateGuardState(
  guardState: unknown,
  failedGuards: Set<Phase9HRuntimeDependencyCloseoutGuard>,
  notes: Set<string>,
): void {
  if (Phase9HRuntimeDependencyGuardStateSchema.safeParse(guardState).success)
    return;
  if (!guardState || typeof guardState !== "object") {
    for (const [, guard] of CAPABILITY_FIELD_TO_GUARD) failedGuards.add(guard);
    notes.add("runtime_dependency_guard_state_invalid");
    return;
  }
  const record = guardState as Partial<
    Record<Phase9HRuntimeDependencyForbiddenCapabilityField, unknown>
  >;
  for (const [field, guard] of CAPABILITY_FIELD_TO_GUARD) {
    if (record[field] !== false) {
      failedGuards.add(guard);
      notes.add(`forbidden_runtime_dependency_capability_enabled:${field}`);
    }
  }
}

interface RuntimeDependencyObservedOverlayScanResult {
  rawPayloadFields: string[];
  sourceCodeFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanRuntimeDependencyObservedOverlay(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): RuntimeDependencyObservedOverlayScanResult {
  const result: RuntimeDependencyObservedOverlayScanResult = {
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
      result.notes.push("runtime_dependency_overlay_missing");
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
    const child = scanRuntimeDependencyObservedOverlay(
      value,
      [...path, key],
      seen,
    );
    result.rawPayloadFields.push(...child.rawPayloadFields);
    result.sourceCodeFields.push(...child.sourceCodeFields);
    result.executableFields.push(...child.executableFields);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }
  return result;
}

function hasUnknownOverlayEnums(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const record = input as { observed_edges?: unknown };
  const observedEdges = Array.isArray(record.observed_edges)
    ? record.observed_edges
    : [];
  return observedEdges.some((edge) => {
    if (!edge || typeof edge !== "object") return false;
    const candidate = edge as Record<string, unknown>;
    return (
      ("observed_count_bin" in candidate &&
        !RuntimeDependencyCountBinSchema.safeParse(candidate.observed_count_bin)
          .success) ||
      ("last_seen_band" in candidate &&
        !RuntimeDependencyObservedLastSeenBandSchema.safeParse(
          candidate.last_seen_band,
        ).success) ||
      ("coupling_risk_class" in candidate &&
        !RuntimeDependencyCouplingRiskClassSchema.safeParse(
          candidate.coupling_risk_class,
        ).success)
    );
  });
}

function collectObjectKeys(input: unknown): string[] {
  if (!input || typeof input !== "object") return [];
  if (Array.isArray(input))
    return input.flatMap((item) => collectObjectKeys(item));
  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectObjectKeys(value),
  ]);
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
    key === "static_graph_mutation_allowed" ||
    key === "observed_edge_authority_allowed" ||
    key === "source_code_rendering_allowed" ||
    key === "live_code_introspection_wired" ||
    key === "source_parsing_wired" ||
    key === "edge_executable" ||
    key === "live_telemetry_read_allowed" ||
    key === "db_read_allowed" ||
    key === "db_write_allowed" ||
    key === "remote_dashboard_allowed"
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

function readBooleanField(input: unknown, field: string): boolean | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>)[field];
  return typeof value === "boolean" ? value : undefined;
}

function edgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}

const CAPABILITY_FIELD_TO_GUARD: ReadonlyArray<
  [
    Phase9HRuntimeDependencyForbiddenCapabilityField,
    Phase9HRuntimeDependencyCloseoutGuard,
  ]
> = [
  ["graph_execution_enabled", "no_graph_execution"],
  [
    "static_graph_mutation_from_overlay_enabled",
    "no_static_graph_mutation_from_overlay",
  ],
  ["observed_edge_authority_enabled", "no_observed_edge_authority"],
  ["source_code_rendering_enabled", "no_source_code_rendering"],
  ["live_code_introspection_enabled", "no_live_code_introspection"],
  ["source_parsing_runtime_enabled", "no_source_parsing_runtime"],
  ["approve_or_execute_affordance_enabled", "no_approve_or_execute_affordance"],
  ["run_or_retry_affordance_enabled", "no_run_or_retry_affordance"],
  ["raw_payload_overlay_enabled", "no_raw_payload_overlay"],
  ["live_telemetry_read_enabled", "no_live_telemetry_read"],
  ["db_read_or_write_enabled", "no_db_read_or_write"],
  ["remote_dashboard_enabled", "no_remote_dashboard"],
];
