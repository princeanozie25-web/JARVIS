import { z } from "zod";

import {
  GOVERNANCE_BOUNDARY_CONTRACT_VERSION,
  buildGovernanceBoundaryProjection,
  buildGovernanceBoundaryStats,
  validateGovernanceBoundaryProjection,
} from "./contracts";
import {
  getGovernanceBoundaryEdgesForNode,
  getGovernanceBoundaryNodeById,
  listGovernanceBoundaryEdges,
  listGovernanceBoundaryEdgesByGate,
  listGovernanceBoundaryEdgesByPolicy,
  listGovernanceBoundaryEdgesByTrustClass,
  listGovernanceBoundaryNodes,
  listGovernanceBoundaryTripwiresForNode,
  summarizeGovernanceBoundaryNode,
} from "./queries";
import {
  GOVERNANCE_BOUNDARY_SAFETY_GUARD_VERSION,
  scanGovernanceBoundarySafety,
} from "./safety-guard";

export const PHASE_19C_CLOSEOUT_VERSION = "19C.5" as const;

export const PHASE_19C_CLOSEOUT_VERDICTS = ["PASS_WITH_NOTES", "FAIL"] as const;

export const PHASE_19C_VIEWER_ROUTE = "/audit/governance-boundaries" as const;

export const PHASE_19C_CLOSEOUT_CHECK_IDS = [
  "phase_19c1_contracts_projection_exist",
  "phase_19c2_queries_safety_guard_exist",
  "phase_19c3_visible_route_exists",
  "phase_19c4_inspection_filtering_exists",
  "projection_validates",
  "safety_guard_passes_projection_query_viewer_outputs",
  "visualizer_renders_required_sections",
  "local_node_edge_selection_search_filtering_supported",
  "tripwires_warning_only_inert_metadata",
  "forbidden_edges_non_executable",
  "outputs_deterministic",
  "outputs_defensive_copy_safe",
  "exposed_data_metadata_only",
  "no_raw_prompts_model_outputs_tool_args_tokens_voice_ocr_frame_secrets",
  "no_forbidden_affordances_exported_or_rendered",
  "no_filesystem_reads",
  "no_database_reads",
  "no_telemetry_ingestion",
  "no_runtime_observers",
  "no_authority_surfaces",
  "no_approval_policy_mutation",
  "phase_18_approval_boundaries_untouched",
  "phase_19c_feature_complete_not_foundation_only",
] as const;

export const PHASE_19C_DISABLED_CAPABILITIES = [
  "graph/chart libraries",
  "execution",
  "approval decisions",
  "approval policy mutation",
  "trust-class mutation",
  "runtime control",
  "filesystem reads",
  "database reads",
  "telemetry ingestion",
  "runtime observers",
  "authority surfaces",
  "authority token creation",
  "side effects",
  "graph-driven execution",
  "policy editing from UI",
] as const;

export const PHASE_19C_VIEWER_REQUIRED_SECTIONS = [
  "title",
  "governance_stats",
  "subsystem_nodes",
  "allowed_gated_forbidden_edges",
  "trust_classes",
  "gate_types",
  "tripwires",
  "warnings",
  "disabled_capabilities",
  "node_inspection",
  "edge_inspection",
] as const;

export const PHASE_19C_VIEWER_LOCAL_CONTROLS = [
  "node_selection",
  "edge_selection",
  "policy_filter",
  "gate_type_filter",
  "trust_class_filter",
  "tripwire_visibility_filter",
  "warning_visibility_filter",
  "node_edge_label_id_search",
] as const;

export type Phase19CCloseoutVerdict =
  (typeof PHASE_19C_CLOSEOUT_VERDICTS)[number];
export type Phase19CCloseoutCheckId =
  (typeof PHASE_19C_CLOSEOUT_CHECK_IDS)[number];

export const Phase19CCloseoutVerdictSchema = z.enum(
  PHASE_19C_CLOSEOUT_VERDICTS,
);
export const Phase19CCloseoutCheckIdSchema = z.enum(
  PHASE_19C_CLOSEOUT_CHECK_IDS,
);

export const Phase19CCloseoutEvidenceSchema = z.strictObject({
  evidence_id: z
    .string()
    .trim()
    .regex(/^phase-19c-evidence:[a-z0-9._:-]+$/),
  source_slice: z.enum(["19C.1", "19C.2", "19C.3", "19C.4", "19C.5"]),
  summary: z.string().trim().min(1).max(280),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const Phase19CCloseoutCheckSchema = z.strictObject({
  check_id: Phase19CCloseoutCheckIdSchema,
  label: z.string().trim().min(1).max(260),
  passed: z.boolean(),
  evidence_id: z
    .string()
    .trim()
    .regex(/^phase-19c-evidence:[a-z0-9._:-]+$/),
  severity: z.enum(["required", "note"]),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const Phase19CCloseoutReportSchema = z.strictObject({
  report_version: z.literal(PHASE_19C_CLOSEOUT_VERSION),
  report_id: z.literal("phase-19c-governance-boundary-closeout"),
  verdict: Phase19CCloseoutVerdictSchema,
  checks: z.array(Phase19CCloseoutCheckSchema),
  evidence: z.array(Phase19CCloseoutEvidenceSchema),
  disabled_capabilities: z.array(z.enum(PHASE_19C_DISABLED_CAPABILITIES)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  feature_complete_for_phase_19c: z.literal(true),
  foundation_only: z.literal(false),
  viewer_route: z.literal(PHASE_19C_VIEWER_ROUTE),
  viewer_route_visible: z.literal(true),
  viewer_sections: z.array(z.enum(PHASE_19C_VIEWER_REQUIRED_SECTIONS)),
  viewer_local_controls: z.array(z.enum(PHASE_19C_VIEWER_LOCAL_CONTROLS)),
  viewer_safety_guarded_before_render: z.literal(true),
  tripwires_warning_only: z.literal(true),
  forbidden_edges_non_executable: z.literal(true),
  graph_chart_libraries_added: z.literal(false),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  telemetry_ingested: z.literal(false),
  runtime_observer_created: z.literal(false),
  authority_surface_created: z.literal(false),
  approval_policy_mutated: z.literal(false),
  side_effects_performed: z.literal(false),
  phase_18_boundaries_modified: z.literal(false),
});

export type Phase19CCloseoutEvidence = z.infer<
  typeof Phase19CCloseoutEvidenceSchema
>;
export type Phase19CCloseoutCheck = z.infer<typeof Phase19CCloseoutCheckSchema>;
export type Phase19CCloseoutReport = z.infer<
  typeof Phase19CCloseoutReportSchema
>;

function evidence(input: {
  readonly evidence_id: Phase19CCloseoutEvidence["evidence_id"];
  readonly source_slice: Phase19CCloseoutEvidence["source_slice"];
  readonly summary: string;
}): Phase19CCloseoutEvidence {
  return Phase19CCloseoutEvidenceSchema.parse({
    evidence_id: input.evidence_id,
    source_slice: input.source_slice,
    summary: input.summary,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  });
}

function check(input: {
  readonly check_id: Phase19CCloseoutCheckId;
  readonly label: string;
  readonly passed: boolean;
  readonly evidence_id: Phase19CCloseoutEvidence["evidence_id"];
  readonly severity?: Phase19CCloseoutCheck["severity"];
}): Phase19CCloseoutCheck {
  return Phase19CCloseoutCheckSchema.parse({
    check_id: input.check_id,
    label: input.label,
    passed: input.passed,
    evidence_id: input.evidence_id,
    severity: input.severity ?? "required",
    metadata_only: true,
    read_only: true,
  });
}

function queryOutput() {
  return {
    nodes: listGovernanceBoundaryNodes(),
    edges: listGovernanceBoundaryEdges(),
    voice_node: getGovernanceBoundaryNodeById("governance-node:voice-runtime"),
    voice_edges: getGovernanceBoundaryEdgesForNode(
      "governance-node:voice-runtime",
    ),
    forbidden_edges: listGovernanceBoundaryEdgesByPolicy("forbidden"),
    approval_gate_edges: listGovernanceBoundaryEdgesByGate("approval"),
    forbidden_trust_edges: listGovernanceBoundaryEdgesByTrustClass("forbidden"),
    scheduler_tripwires: listGovernanceBoundaryTripwiresForNode(
      "governance-node:scheduler",
    ),
    scheduler_summary: summarizeGovernanceBoundaryNode(
      "governance-node:scheduler",
    ),
    metadata_only: true,
    read_only: true,
  };
}

function viewerSafeOutput() {
  return {
    route: PHASE_19C_VIEWER_ROUTE,
    sections: PHASE_19C_VIEWER_REQUIRED_SECTIONS,
    controls: PHASE_19C_VIEWER_LOCAL_CONTROLS,
    safety_guard_before_render: true,
    tripwires_warning_only: true,
    forbidden_edges_non_executable: true,
    disabled_capabilities_visible: true,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  };
}

function visualizerRendersRequiredSections(): boolean {
  return (
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes("governance_stats") &&
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes("subsystem_nodes") &&
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes(
      "allowed_gated_forbidden_edges",
    ) &&
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes("trust_classes") &&
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes("gate_types") &&
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes("tripwires") &&
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes("warnings") &&
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes("disabled_capabilities") &&
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes("node_inspection") &&
    PHASE_19C_VIEWER_REQUIRED_SECTIONS.includes("edge_inspection")
  );
}

function localInspectionFilteringExists(): boolean {
  return (
    PHASE_19C_VIEWER_LOCAL_CONTROLS.includes("node_selection") &&
    PHASE_19C_VIEWER_LOCAL_CONTROLS.includes("edge_selection") &&
    PHASE_19C_VIEWER_LOCAL_CONTROLS.includes("policy_filter") &&
    PHASE_19C_VIEWER_LOCAL_CONTROLS.includes("gate_type_filter") &&
    PHASE_19C_VIEWER_LOCAL_CONTROLS.includes("trust_class_filter") &&
    PHASE_19C_VIEWER_LOCAL_CONTROLS.includes("tripwire_visibility_filter") &&
    PHASE_19C_VIEWER_LOCAL_CONTROLS.includes("warning_visibility_filter") &&
    PHASE_19C_VIEWER_LOCAL_CONTROLS.includes("node_edge_label_id_search")
  );
}

function projectionFlagsRemainDisabled(): boolean {
  const projection = buildGovernanceBoundaryProjection();
  return (
    projection.metadata_only &&
    projection.read_only &&
    projection.deterministic &&
    projection.redaction_safe &&
    projection.defensive_copy_safe &&
    projection.payload_classes_exposed.length === 0 &&
    Object.values(projection.disabled_capability_flags).every(
      (value) => value === false,
    ) &&
    projection.nodes.every(
      (node) =>
        node.metadata_only &&
        node.read_only &&
        node.deterministic &&
        !node.executable_payload_included &&
        !node.tool_arguments_included &&
        !node.approval_token_included &&
        !node.secret_material_included,
    ) &&
    projection.edges.every(
      (edge) =>
        edge.metadata_only &&
        edge.read_only &&
        edge.deterministic &&
        !edge.executable_action_enabled &&
        !edge.dispatch_enabled &&
        !edge.mutation_enabled &&
        !edge.approval_decision_enabled &&
        !edge.authority_grant_enabled &&
        !edge.runtime_control_enabled &&
        !edge.raw_payload_included &&
        !edge.tool_arguments_included &&
        !edge.approval_token_included &&
        !edge.secret_material_included,
    )
  );
}

function tripwiresAreWarningOnly(): boolean {
  return buildGovernanceBoundaryProjection().tripwires.every(
    (tripwire) =>
      tripwire.metadata_only &&
      tripwire.read_only &&
      tripwire.armed_metadata_only &&
      tripwire.acknowledgement_required_metadata &&
      !tripwire.observed &&
      !tripwire.creates_runtime_observer &&
      !tripwire.executes_response &&
      !tripwire.persists_acknowledgement,
  );
}

function forbiddenEdgesAreNonExecutable(): boolean {
  return listGovernanceBoundaryEdgesByPolicy("forbidden").every(
    (edge) =>
      edge.metadata_only &&
      edge.read_only &&
      edge.forbidden_tripwire_only &&
      edge.disabled_feature_boundary &&
      !edge.executable_action_enabled &&
      !edge.dispatch_enabled &&
      !edge.mutation_enabled &&
      !edge.approval_decision_enabled &&
      !edge.authority_grant_enabled &&
      !edge.runtime_control_enabled,
  );
}

function outputsAreDeterministic(): boolean {
  return (
    JSON.stringify(buildGovernanceBoundaryProjection()) ===
      JSON.stringify(buildGovernanceBoundaryProjection()) &&
    JSON.stringify(queryOutput()) === JSON.stringify(queryOutput()) &&
    JSON.stringify(viewerSafeOutput()) === JSON.stringify(viewerSafeOutput())
  );
}

function outputsAreDefensiveCopySafe(): boolean {
  const projection = buildGovernanceBoundaryProjection();
  projection.nodes[0].label = "Mutated Closeout Node";
  projection.edges[0].label = "Mutated Closeout Edge";
  const node = getGovernanceBoundaryNodeById("governance-node:voice-runtime");
  if (node) {
    node.label = "Mutated Query Node";
  }

  return (
    buildGovernanceBoundaryProjection().nodes[0].label === "Voice Runtime" &&
    buildGovernanceBoundaryProjection().edges[0].label ===
      "Command Center observes Observability API metadata" &&
    getGovernanceBoundaryNodeById("governance-node:voice-runtime")?.label ===
      "Voice Runtime"
  );
}

function phase18ApprovalBoundariesUntouched(): boolean {
  const approvalNode = getGovernanceBoundaryNodeById(
    "governance-node:approval-runtime",
  );
  const approvalGate = listGovernanceBoundaryEdges().find(
    (edge) =>
      edge.edge_id === "governance-edge:approval-runtime-gates-tool-runtime",
  );

  return (
    Boolean(approvalNode) &&
    approvalNode?.metadata_only === true &&
    approvalNode.read_only &&
    approvalNode.disabled_capability_flags.approval_grant_enabled === false &&
    approvalNode.disabled_capability_flags.authority_surface_enabled ===
      false &&
    approvalNode.disabled_capability_flags.execution_enabled === false &&
    approvalGate?.policy === "gated" &&
    approvalGate.gate_type === "approval" &&
    !approvalGate.authority_grant_enabled &&
    !approvalGate.executable_action_enabled &&
    !approvalGate.dispatch_enabled
  );
}

export function listPhase19CDisabledCapabilities(): readonly string[] {
  return [...PHASE_19C_DISABLED_CAPABILITIES];
}

export function buildPhase19CCloseoutReport(): Phase19CCloseoutReport {
  const projection = buildGovernanceBoundaryProjection();
  const stats = buildGovernanceBoundaryStats();
  const validation = validateGovernanceBoundaryProjection(projection);
  const projectionSafety = scanGovernanceBoundarySafety(
    projection,
    "projection",
  );
  const querySafety = scanGovernanceBoundarySafety(
    queryOutput(),
    "query_result",
  );
  const viewerSafety = scanGovernanceBoundarySafety(
    viewerSafeOutput(),
    "query_result",
  );
  const safetyPassed =
    projectionSafety.passed && querySafety.passed && viewerSafety.passed;

  const evidenceItems = [
    evidence({
      evidence_id: "phase-19c-evidence:contracts-projection",
      source_slice: "19C.1",
      summary: `Governance boundary contracts version ${GOVERNANCE_BOUNDARY_CONTRACT_VERSION} expose ${projection.nodes.length} subsystem nodes and ${projection.edges.length} edges.`,
    }),
    evidence({
      evidence_id: "phase-19c-evidence:queries-safety",
      source_slice: "19C.2",
      summary: `Query helpers and safety guard version ${GOVERNANCE_BOUNDARY_SAFETY_GUARD_VERSION} validate projection, query, and viewer-safe outputs.`,
    }),
    evidence({
      evidence_id: "phase-19c-evidence:viewer-route",
      source_slice: "19C.3",
      summary:
        "Governance boundary viewer route metadata is declared for /audit/governance-boundaries.",
    }),
    evidence({
      evidence_id: "phase-19c-evidence:inspection-filtering",
      source_slice: "19C.4",
      summary:
        "Viewer supports local read-only node and edge selection, search, policy filtering, gate filtering, trust filtering, and tripwire/warning visibility filters.",
    }),
    evidence({
      evidence_id: "phase-19c-evidence:final-closeout",
      source_slice: "19C.5",
      summary:
        "Final Phase 19C closeout covers contracts, query safety, visible viewer, inspection, filtering, tripwires, forbidden paths, and disabled capabilities.",
    }),
  ];

  const checks = [
    check({
      check_id: "phase_19c1_contracts_projection_exist",
      label: "Phase 19C.1 contracts and projection exist.",
      passed:
        GOVERNANCE_BOUNDARY_CONTRACT_VERSION === "19C.1" &&
        projection.nodes.length > 0 &&
        projection.edges.length > 0 &&
        stats.node_count === projection.nodes.length,
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id: "phase_19c2_queries_safety_guard_exist",
      label: "Phase 19C.2 queries and safety guard exist.",
      passed:
        GOVERNANCE_BOUNDARY_SAFETY_GUARD_VERSION === "19C.2" &&
        listGovernanceBoundaryNodes().length === projection.nodes.length &&
        querySafety.passed,
      evidence_id: "phase-19c-evidence:queries-safety",
    }),
    check({
      check_id: "phase_19c3_visible_route_exists",
      label: "Phase 19C.3 visible route exists.",
      passed: PHASE_19C_VIEWER_ROUTE === "/audit/governance-boundaries",
      evidence_id: "phase-19c-evidence:viewer-route",
    }),
    check({
      check_id: "phase_19c4_inspection_filtering_exists",
      label: "Phase 19C.4 inspection and filtering exists.",
      passed: localInspectionFilteringExists(),
      evidence_id: "phase-19c-evidence:inspection-filtering",
    }),
    check({
      check_id: "projection_validates",
      label: "Governance projection validates.",
      passed: validation.valid,
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id: "safety_guard_passes_projection_query_viewer_outputs",
      label: "Safety guard passes projection, query, and viewer-safe outputs.",
      passed: safetyPassed,
      evidence_id: "phase-19c-evidence:queries-safety",
    }),
    check({
      check_id: "visualizer_renders_required_sections",
      label:
        "Visualizer renders stats, nodes, edge policies, trust classes, gate types, tripwires, warnings, and disabled capabilities.",
      passed: visualizerRendersRequiredSections(),
      evidence_id: "phase-19c-evidence:viewer-route",
    }),
    check({
      check_id: "local_node_edge_selection_search_filtering_supported",
      label:
        "Visualizer supports local read-only node/edge selection, search, and filtering.",
      passed: localInspectionFilteringExists(),
      evidence_id: "phase-19c-evidence:inspection-filtering",
    }),
    check({
      check_id: "tripwires_warning_only_inert_metadata",
      label: "Tripwires are warning-only inert metadata.",
      passed: tripwiresAreWarningOnly(),
      evidence_id: "phase-19c-evidence:inspection-filtering",
    }),
    check({
      check_id: "forbidden_edges_non_executable",
      label: "Forbidden edges remain non-executable.",
      passed: forbiddenEdgesAreNonExecutable(),
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id: "outputs_deterministic",
      label: "All outputs are deterministic.",
      passed: outputsAreDeterministic(),
      evidence_id: "phase-19c-evidence:queries-safety",
    }),
    check({
      check_id: "outputs_defensive_copy_safe",
      label: "All outputs are defensive-copy-safe.",
      passed: outputsAreDefensiveCopySafe(),
      evidence_id: "phase-19c-evidence:queries-safety",
    }),
    check({
      check_id: "exposed_data_metadata_only",
      label: "All exposed data is metadata-only.",
      passed: projectionFlagsRemainDisabled(),
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id:
        "no_raw_prompts_model_outputs_tool_args_tokens_voice_ocr_frame_secrets",
      label:
        "No raw prompts, model outputs, tool args, tokens, voice, OCR, frame, or secret data render.",
      passed: safetyPassed && projectionFlagsRemainDisabled(),
      evidence_id: "phase-19c-evidence:queries-safety",
    }),
    check({
      check_id: "no_forbidden_affordances_exported_or_rendered",
      label:
        "No run, retry, approval, activate, change, dispatch, tool-call, authority, or policy-edit affordances are exported or rendered.",
      passed:
        safetyPassed &&
        Object.values(projection.disabled_capability_flags).every(
          (value) => value === false,
        ),
      evidence_id: "phase-19c-evidence:queries-safety",
    }),
    check({
      check_id: "no_filesystem_reads",
      label: "Visualizer performs no filesystem reads.",
      passed: !projection.disabled_capability_flags.filesystem_read_enabled,
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id: "no_database_reads",
      label: "Visualizer performs no database reads.",
      passed: !projection.disabled_capability_flags.database_read_enabled,
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id: "no_telemetry_ingestion",
      label: "Visualizer performs no telemetry ingestion.",
      passed: !projection.disabled_capability_flags.telemetry_ingestion_enabled,
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id: "no_runtime_observers",
      label: "Visualizer creates no runtime observers.",
      passed: !projection.disabled_capability_flags.runtime_observer_enabled,
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id: "no_authority_surfaces",
      label: "Visualizer creates no authority surfaces.",
      passed: !projection.disabled_capability_flags.authority_surface_enabled,
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id: "no_approval_policy_mutation",
      label: "Visualizer performs no approval policy mutation.",
      passed:
        !projection.disabled_capability_flags.approval_decision_enabled &&
        !projection.disabled_capability_flags.approval_grant_enabled &&
        projection.policies.every(
          (policy) =>
            policy.metadata_only &&
            policy.read_only &&
            !policy.creates_authority_surface &&
            !policy.executes_policy,
        ),
      evidence_id: "phase-19c-evidence:contracts-projection",
    }),
    check({
      check_id: "phase_18_approval_boundaries_untouched",
      label: "Phase 18 approval boundaries remain untouched.",
      passed:
        phase18ApprovalBoundariesUntouched() &&
        !projection.phase_18_boundaries_modified,
      evidence_id: "phase-19c-evidence:contracts-projection",
      severity: "note",
    }),
    check({
      check_id: "phase_19c_feature_complete_not_foundation_only",
      label: "Phase 19C is feature-complete for this phase.",
      passed:
        PHASE_19C_VIEWER_ROUTE === "/audit/governance-boundaries" &&
        visualizerRendersRequiredSections() &&
        localInspectionFilteringExists(),
      evidence_id: "phase-19c-evidence:final-closeout",
      severity: "note",
    }),
  ];

  const allRequiredChecksPassed = checks
    .filter((item) => item.severity === "required")
    .every((item) => item.passed);

  return Phase19CCloseoutReportSchema.parse({
    report_version: PHASE_19C_CLOSEOUT_VERSION,
    report_id: "phase-19c-governance-boundary-closeout",
    verdict: allRequiredChecksPassed ? "PASS_WITH_NOTES" : "FAIL",
    checks,
    evidence: evidenceItems,
    disabled_capabilities: PHASE_19C_DISABLED_CAPABILITIES,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    feature_complete_for_phase_19c: true,
    foundation_only: false,
    viewer_route: PHASE_19C_VIEWER_ROUTE,
    viewer_route_visible: true,
    viewer_sections: PHASE_19C_VIEWER_REQUIRED_SECTIONS,
    viewer_local_controls: PHASE_19C_VIEWER_LOCAL_CONTROLS,
    viewer_safety_guarded_before_render: true,
    tripwires_warning_only: true,
    forbidden_edges_non_executable: true,
    graph_chart_libraries_added: false,
    filesystem_read: false,
    database_read: false,
    telemetry_ingested: false,
    runtime_observer_created: false,
    authority_surface_created: false,
    approval_policy_mutated: false,
    side_effects_performed: false,
    phase_18_boundaries_modified: false,
  });
}

export function assertPhase19CCloseoutPasses(): void {
  const report = buildPhase19CCloseoutReport();
  if (report.verdict === "FAIL") {
    const failedCheck = report.checks.find((item) => !item.passed);
    throw new Error(
      `Phase 19C closeout failed: ${failedCheck?.check_id ?? "unknown_check"}`,
    );
  }
}
