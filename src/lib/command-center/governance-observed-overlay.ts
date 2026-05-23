import { z } from "zod";

import { AUDIT_TRACE_EXECUTABLE_AFFORDANCE_KEYS } from "./audit-trace-timeline";
import {
  GovernanceBoundaryCountBinSchema,
  GovernanceBoundaryIncidentFlagClassSchema,
  GovernanceBoundaryViewerViewModelSchema,
  createDefaultGovernanceBoundaryViewerViewModel,
  type GovernanceBoundaryViewerViewModel,
} from "./audit-governance-boundary";
import { CommandCenterObservabilityRedactionStatusSchema } from "./observability-contract";
import { COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES } from "./observability-redaction";
import { COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS } from "./screens";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";
import {
  GovernancePolicyGraphSchema,
  createDefaultGovernancePolicyGraph,
  validateGovernancePolicyGraph,
} from "./governance-policy-graph";

export const GOVERNANCE_OBSERVED_LAST_SEEN_BANDS = [
  "unknown",
  "latest",
  "recent",
  "session",
] as const;

export const GOVERNANCE_OBSERVED_OVERLAY_VALIDATION_REASONS = [
  "governance_observed_overlay_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "executable_affordance_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "unknown_enum_value",
  "render_not_safe",
  "not_non_executable",
] as const;

export const PHASE_9G_GOVERNANCE_BOUNDARY_CLOSEOUT_GUARDS = [
  "no_graph_execution",
  "no_policy_mutation_from_overlay",
  "no_observed_edge_authority",
  "no_approve_or_execute_affordance",
  "no_run_or_retry_affordance",
  "no_raw_payload_overlay",
  "no_live_telemetry_read",
  "no_db_read_or_write",
  "no_remote_dashboard",
] as const;

export const PHASE_9G_GOVERNANCE_BOUNDARY_FORBIDDEN_CAPABILITY_FIELDS = [
  "graph_execution_enabled",
  "policy_mutation_from_overlay_enabled",
  "observed_edge_authority_enabled",
  "approve_or_execute_affordance_enabled",
  "run_or_retry_affordance_enabled",
  "raw_payload_overlay_enabled",
  "live_telemetry_read_enabled",
  "db_read_or_write_enabled",
  "remote_dashboard_enabled",
] as const;

export const PHASE_9G_GOVERNANCE_BOUNDARY_CLOSEOUT_VERDICTS = [
  "pass",
  "fail",
] as const;

export const GovernanceObservedLastSeenBandSchema = z.enum(
  GOVERNANCE_OBSERVED_LAST_SEEN_BANDS,
);
export const GovernanceObservedOverlayValidationReasonSchema = z.enum(
  GOVERNANCE_OBSERVED_OVERLAY_VALIDATION_REASONS,
);
export const Phase9GGovernanceBoundaryCloseoutGuardSchema = z.enum(
  PHASE_9G_GOVERNANCE_BOUNDARY_CLOSEOUT_GUARDS,
);
export const Phase9GGovernanceBoundaryForbiddenCapabilityFieldSchema = z.enum(
  PHASE_9G_GOVERNANCE_BOUNDARY_FORBIDDEN_CAPABILITY_FIELDS,
);
export const Phase9GGovernanceBoundaryCloseoutVerdictSchema = z.enum(
  PHASE_9G_GOVERNANCE_BOUNDARY_CLOSEOUT_VERDICTS,
);

export const GovernanceObservedEdgeSchema = z.strictObject({
  from: z.string().trim().min(1).max(160),
  to: z.string().trim().min(1).max(160),
  observed_count_bin: GovernanceBoundaryCountBinSchema,
  last_seen_band: GovernanceObservedLastSeenBandSchema.optional(),
  incident_flag_class: GovernanceBoundaryIncidentFlagClassSchema,
  render_safe: z.literal(true),
  metadata_only: z.literal(true),
  non_executable: z.literal(true),
  authority_surface: z.literal(false),
  policy_mutation_allowed: z.literal(false),
  edge_executable: z.literal(false),
});

export const GovernanceObservedOverlaySchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.governance_observed_overlay"),
    phase: z.literal("9G2"),
    overlay_id: z.string().trim().min(1).max(160),
    generated_at: z.number().int().nonnegative(),
    source_category: z.literal("governance_boundaries"),
    redaction_status: CommandCenterObservabilityRedactionStatusSchema,
    render_safe: z.literal(true),
    non_executable: z.literal(true),
    observed_edges: z.array(GovernanceObservedEdgeSchema),
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
    policy_mutation_allowed: z.literal(false),
    observed_edge_authority_allowed: z.literal(false),
    live_telemetry_read_allowed: z.literal(false),
    db_read_allowed: z.literal(false),
    db_write_allowed: z.literal(false),
    remote_dashboard_allowed: z.literal(false),
  });

export const GovernanceObservedOverlayValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(GovernanceObservedOverlayValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    non_executable: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export const Phase9GGovernanceBoundaryGuardStateSchema = z.strictObject({
  graph_execution_enabled: z.literal(false),
  policy_mutation_from_overlay_enabled: z.literal(false),
  observed_edge_authority_enabled: z.literal(false),
  approve_or_execute_affordance_enabled: z.literal(false),
  run_or_retry_affordance_enabled: z.literal(false),
  raw_payload_overlay_enabled: z.literal(false),
  live_telemetry_read_enabled: z.literal(false),
  db_read_or_write_enabled: z.literal(false),
  remote_dashboard_enabled: z.literal(false),
});

export const Phase9GGovernanceBoundaryCloseoutReportSchema = z.strictObject({
  kind: z.literal(
    "command_center.phase_9g_governance_boundary_closeout_report",
  ),
  verdict: Phase9GGovernanceBoundaryCloseoutVerdictSchema,
  checked_guards: z.array(Phase9GGovernanceBoundaryCloseoutGuardSchema),
  failed_guards: z.array(Phase9GGovernanceBoundaryCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9g_governance_boundary_visualizer_scaffold"),
  metadata_only: z.literal(true),
  render_safe: z.boolean(),
  non_executable: z.literal(true),
  static_policy_source_of_truth: z.literal(true),
  overlay_read_only: z.literal(true),
  graph_execution_allowed: z.literal(false),
  policy_mutation_allowed: z.literal(false),
  observed_edge_authority_allowed: z.literal(false),
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

export type GovernanceObservedLastSeenBand = z.infer<
  typeof GovernanceObservedLastSeenBandSchema
>;
export type GovernanceObservedOverlayValidationReason = z.infer<
  typeof GovernanceObservedOverlayValidationReasonSchema
>;
export type GovernanceObservedEdge = z.infer<
  typeof GovernanceObservedEdgeSchema
>;
export type GovernanceObservedOverlay = z.infer<
  typeof GovernanceObservedOverlaySchema
>;
export type GovernanceObservedOverlayValidation = z.infer<
  typeof GovernanceObservedOverlayValidationSchema
>;
export type Phase9GGovernanceBoundaryCloseoutGuard = z.infer<
  typeof Phase9GGovernanceBoundaryCloseoutGuardSchema
>;
export type Phase9GGovernanceBoundaryForbiddenCapabilityField = z.infer<
  typeof Phase9GGovernanceBoundaryForbiddenCapabilityFieldSchema
>;
export type Phase9GGovernanceBoundaryCloseoutVerdict = z.infer<
  typeof Phase9GGovernanceBoundaryCloseoutVerdictSchema
>;
export type Phase9GGovernanceBoundaryGuardState = z.infer<
  typeof Phase9GGovernanceBoundaryGuardStateSchema
>;
export type Phase9GGovernanceBoundaryCloseoutReport = z.infer<
  typeof Phase9GGovernanceBoundaryCloseoutReportSchema
>;

export interface Phase9GGovernanceBoundaryCloseoutInput {
  policyGraph?: unknown;
  overlay?: unknown;
  guardState?: unknown;
}

export const DEFAULT_PHASE_9G_GOVERNANCE_BOUNDARY_GUARD_STATE: Phase9GGovernanceBoundaryGuardState =
  Phase9GGovernanceBoundaryGuardStateSchema.parse({
    graph_execution_enabled: false,
    policy_mutation_from_overlay_enabled: false,
    observed_edge_authority_enabled: false,
    approve_or_execute_affordance_enabled: false,
    run_or_retry_affordance_enabled: false,
    raw_payload_overlay_enabled: false,
    live_telemetry_read_enabled: false,
    db_read_or_write_enabled: false,
    remote_dashboard_enabled: false,
  });

export function createDefaultGovernanceObservedOverlay(): GovernanceObservedOverlay {
  return GovernanceObservedOverlaySchema.parse({
    kind: "command_center.governance_observed_overlay",
    phase: "9G2",
    overlay_id: "governance_overlay:empty",
    generated_at: 0,
    source_category: "governance_boundaries",
    redaction_status: "metadata_only",
    render_safe: true,
    non_executable: true,
    observed_edges: [],
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
    policy_mutation_allowed: false,
    observed_edge_authority_allowed: false,
    live_telemetry_read_allowed: false,
    db_read_allowed: false,
    db_write_allowed: false,
    remote_dashboard_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateGovernanceObservedOverlay(
  input: unknown,
): GovernanceObservedOverlayValidation {
  const parsed = GovernanceObservedOverlaySchema.safeParse(input);
  const scan = scanGovernanceObservedOverlay(input, [], new WeakSet<object>());
  const reasons = new Set<GovernanceObservedOverlayValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();

  if (!parsed.success) reasons.add("schema_rejected");
  if (scan.rawPayloadFields.length > 0)
    reasons.add("raw_payload_field_present");
  if (scan.executableFields.length > 0)
    reasons.add("executable_affordance_present");
  if (scan.nonSerializable) reasons.add("non_serializable_value");
  if (scan.unsafeShape) reasons.add("unsafe_payload_shape");
  if (hasUnknownOverlayEnums(input)) reasons.add("unknown_enum_value");
  if (readBooleanField(input, "render_safe") !== true)
    reasons.add("render_not_safe");
  if (readBooleanField(input, "non_executable") !== true)
    reasons.add("not_non_executable");

  for (const field of scan.rawPayloadFields) withheldFields.add(field);
  for (const field of scan.executableFields) withheldFields.add(field);
  for (const note of scan.notes) notes.add(note);

  const passed = reasons.size === 0;
  return GovernanceObservedOverlayValidationSchema.parse({
    passed,
    reasons: passed ? ["governance_observed_overlay_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["governance_observed_overlay_empty"],
    metadata_only: true,
    render_safe: passed,
    non_executable: passed,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function applyGovernanceObservedOverlayToPolicyGraph(
  policyGraph: unknown,
  overlay: unknown,
): GovernanceBoundaryViewerViewModel {
  const policyParsed = GovernancePolicyGraphSchema.safeParse(policyGraph);
  const overlayParsed = GovernanceObservedOverlaySchema.safeParse(overlay);
  if (
    !policyParsed.success ||
    !overlayParsed.success ||
    !validateGovernancePolicyGraphSafe(policyGraph) ||
    !validateGovernanceObservedOverlay(overlay).passed
  ) {
    return createDefaultGovernanceBoundaryViewerViewModel();
  }

  const graph = policyParsed.data;
  const overlayByEdge = new Map(
    overlayParsed.data.observed_edges.map((edge) => [
      edgeKey(edge.from, edge.to),
      edge,
    ]),
  );
  const edges = graph.edges.map((edge) => {
    const observed = overlayByEdge.get(edgeKey(edge.from, edge.to));
    if (!observed) return edge;
    const observedCount = observed.observed_count_bin;
    return {
      ...edge,
      observed_count_bin: observedCount,
      incident_flag_class:
        edge.policy === "forbidden" && observedCount !== "none"
          ? "red"
          : observed.incident_flag_class,
      render_safe: true,
      metadata_only: true,
      non_executable: true,
      authority_surface: false,
    };
  });

  return GovernanceBoundaryViewerViewModelSchema.parse({
    ...createDefaultGovernanceBoundaryViewerViewModel(),
    graph_id: graph.graph_id,
    nodes: graph.nodes,
    edges,
    generated_at: Math.max(graph.generated_at, overlayParsed.data.generated_at),
    redaction_status: overlayParsed.data.redaction_status,
    incident_count: edges.filter((edge) => edge.incident_flag_class === "red")
      .length,
    withheld_fields:
      overlayParsed.data.withheld_fields.length > 0
        ? overlayParsed.data.withheld_fields
        : graph.withheld_fields,
    truncated: graph.truncated || overlayParsed.data.truncated,
  });
}

export function createPhase9GGovernanceBoundaryCloseoutReport(
  input: Phase9GGovernanceBoundaryCloseoutInput = {},
): Phase9GGovernanceBoundaryCloseoutReport {
  const failedGuards = new Set<Phase9GGovernanceBoundaryCloseoutGuard>();
  const notes = new Set<string>();
  const policyGraph = input.policyGraph ?? createDefaultGovernancePolicyGraph();
  const overlay = input.overlay ?? createDefaultGovernanceObservedOverlay();

  evaluatePolicyGraph(policyGraph, failedGuards, notes);
  evaluateObservedOverlay(overlay, failedGuards, notes);
  evaluateOverlayApplication(policyGraph, overlay, failedGuards, notes);
  evaluateForbiddenEdgeTripwire(failedGuards, notes);
  evaluateGuardState(
    input.guardState ?? DEFAULT_PHASE_9G_GOVERNANCE_BOUNDARY_GUARD_STATE,
    failedGuards,
    notes,
  );

  if (failedGuards.size === 0) {
    notes.add("phase_9g_governance_boundary_scaffold_is_static_policy_overlay");
  }

  return Phase9GGovernanceBoundaryCloseoutReportSchema.parse({
    kind: "command_center.phase_9g_governance_boundary_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9G_GOVERNANCE_BOUNDARY_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    notes: [...notes],
    generated_from: "phase_9g_governance_boundary_visualizer_scaffold",
    metadata_only: true,
    render_safe: failedGuards.size === 0,
    non_executable: true,
    static_policy_source_of_truth: true,
    overlay_read_only: true,
    graph_execution_allowed: false,
    policy_mutation_allowed: false,
    observed_edge_authority_allowed: false,
    raw_payload_overlay_allowed: false,
    live_telemetry_read_allowed: false,
    db_read_allowed: false,
    db_write_allowed: false,
    remote_dashboard_allowed: false,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function validateGovernancePolicyGraphSafe(input: unknown): boolean {
  return validateGovernancePolicyGraph(input).passed;
}

function evaluatePolicyGraph(
  policyGraph: unknown,
  failedGuards: Set<Phase9GGovernanceBoundaryCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateGovernancePolicyGraph(policyGraph);
  if (!validation.passed) {
    failedGuards.add("no_policy_mutation_from_overlay");
    notes.add("governance_policy_graph_validation_failed");
  }
}

function evaluateObservedOverlay(
  overlay: unknown,
  failedGuards: Set<Phase9GGovernanceBoundaryCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateGovernanceObservedOverlay(overlay);
  if (!validation.passed) {
    notes.add("governance_observed_overlay_validation_failed");
    for (const reason of validation.reasons) {
      if (reason === "raw_payload_field_present")
        failedGuards.add("no_raw_payload_overlay");
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
  policyGraph: unknown,
  overlay: unknown,
  failedGuards: Set<Phase9GGovernanceBoundaryCloseoutGuard>,
  notes: Set<string>,
): void {
  const policyParsed = GovernancePolicyGraphSchema.safeParse(policyGraph);
  const viewer = applyGovernanceObservedOverlayToPolicyGraph(
    policyGraph,
    overlay,
  );
  if (!policyParsed.success) return;
  if (viewer.graph_id !== policyParsed.data.graph_id) {
    failedGuards.add("no_policy_mutation_from_overlay");
    notes.add("overlay_application_fell_back_or_mutated_graph_identity");
    return;
  }
  for (const edge of viewer.edges) {
    const policyEdge = policyParsed.data.edges.find(
      (candidate) => candidate.from === edge.from && candidate.to === edge.to,
    );
    if (!policyEdge) {
      failedGuards.add("no_policy_mutation_from_overlay");
      notes.add("overlay_created_new_policy_edge");
      continue;
    }
    if (
      edge.policy !== policyEdge.policy ||
      edge.gate_class !== policyEdge.gate_class
    ) {
      failedGuards.add("no_policy_mutation_from_overlay");
      notes.add("overlay_changed_static_policy");
    }
    if (edge.non_executable !== true || edge.authority_surface !== false) {
      failedGuards.add("no_observed_edge_authority");
      notes.add("overlay_edge_authority_detected");
    }
  }
}

function evaluateForbiddenEdgeTripwire(
  failedGuards: Set<Phase9GGovernanceBoundaryCloseoutGuard>,
  notes: Set<string>,
): void {
  const graph = createDefaultGovernancePolicyGraph();
  const overlay = GovernanceObservedOverlaySchema.parse({
    ...createDefaultGovernanceObservedOverlay(),
    overlay_id: "governance_overlay:tripwire",
    observed_edges: [
      {
        from: "command_center",
        to: "tool_registry",
        observed_count_bin: "low",
        incident_flag_class: "none",
        render_safe: true,
        metadata_only: true,
        non_executable: true,
        authority_surface: false,
        policy_mutation_allowed: false,
        edge_executable: false,
      },
    ],
  });
  const viewer = applyGovernanceObservedOverlayToPolicyGraph(graph, overlay);
  const tripwire = viewer.edges.find(
    (edge) => edge.from === "command_center" && edge.to === "tool_registry",
  );
  if (tripwire?.incident_flag_class !== "red") {
    failedGuards.add("no_policy_mutation_from_overlay");
    notes.add("forbidden_edge_tripwire_failed");
  }
}

function evaluateGuardState(
  guardState: unknown,
  failedGuards: Set<Phase9GGovernanceBoundaryCloseoutGuard>,
  notes: Set<string>,
): void {
  if (Phase9GGovernanceBoundaryGuardStateSchema.safeParse(guardState).success)
    return;
  if (!guardState || typeof guardState !== "object") {
    for (const [, guard] of CAPABILITY_FIELD_TO_GUARD) failedGuards.add(guard);
    notes.add("governance_boundary_guard_state_invalid");
    return;
  }
  const record = guardState as Partial<
    Record<Phase9GGovernanceBoundaryForbiddenCapabilityField, unknown>
  >;
  for (const [field, guard] of CAPABILITY_FIELD_TO_GUARD) {
    if (record[field] !== false) {
      failedGuards.add(guard);
      notes.add(`forbidden_governance_boundary_capability_enabled:${field}`);
    }
  }
}

interface GovernanceObservedOverlayScanResult {
  rawPayloadFields: string[];
  executableFields: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanGovernanceObservedOverlay(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): GovernanceObservedOverlayScanResult {
  const result: GovernanceObservedOverlayScanResult = {
    rawPayloadFields: [],
    executableFields: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("governance_overlay_missing");
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
    const child = scanGovernanceObservedOverlay(value, [...path, key], seen);
    result.rawPayloadFields.push(...child.rawPayloadFields);
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
        !GovernanceBoundaryCountBinSchema.safeParse(
          candidate.observed_count_bin,
        ).success) ||
      ("last_seen_band" in candidate &&
        !GovernanceObservedLastSeenBandSchema.safeParse(
          candidate.last_seen_band,
        ).success) ||
      ("incident_flag_class" in candidate &&
        !GovernanceBoundaryIncidentFlagClassSchema.safeParse(
          candidate.incident_flag_class,
        ).success)
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
    key === "policy_mutation_allowed" ||
    key === "observed_edge_authority_allowed" ||
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
    Phase9GGovernanceBoundaryForbiddenCapabilityField,
    Phase9GGovernanceBoundaryCloseoutGuard,
  ]
> = [
  ["graph_execution_enabled", "no_graph_execution"],
  ["policy_mutation_from_overlay_enabled", "no_policy_mutation_from_overlay"],
  ["observed_edge_authority_enabled", "no_observed_edge_authority"],
  ["approve_or_execute_affordance_enabled", "no_approve_or_execute_affordance"],
  ["run_or_retry_affordance_enabled", "no_run_or_retry_affordance"],
  ["raw_payload_overlay_enabled", "no_raw_payload_overlay"],
  ["live_telemetry_read_enabled", "no_live_telemetry_read"],
  ["db_read_or_write_enabled", "no_db_read_or_write"],
  ["remote_dashboard_enabled", "no_remote_dashboard"],
];
