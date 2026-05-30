import { z } from "zod";

import {
  ARCHITECTURE_GRAPH_CONTRACT_VERSION,
  validateArchitectureGraphMetadata,
} from "./contracts";
import {
  ARCHITECTURE_GRAPH_PROJECTION_CONTRACT_VERSION,
  ArchitectureGraphProjectionSchema,
  buildArchitectureGraphProjection,
} from "./projections";
import {
  ArchitectureGraphNodeSummarySchema,
  summarizeArchitectureNode,
} from "./queries";
import {
  getArchitectureGraphEdgesForNode,
  getStaticArchitectureGraph,
} from "./static-registry";
import {
  ARCHITECTURE_GRAPH_SAFETY_GUARD_VERSION,
  scanArchitectureGraphProjectionSafety,
  scanArchitectureGraphSafety,
} from "./safety-guard";

export const PHASE_19A_CLOSEOUT_VERSION = "19A.6" as const;

export const PHASE_19A_CLOSEOUT_VERDICTS = ["PASS_WITH_NOTES", "FAIL"] as const;

export const PHASE_19A_CLOSEOUT_CHECK_IDS = [
  "phase_19a1_contracts_exist",
  "phase_19a2_static_registry_exists",
  "phase_19a3_query_helpers_exist",
  "phase_19a4_projection_contracts_exist",
  "phase_19a5_safety_guard_exists",
  "static_graph_validates",
  "projections_validate",
  "safety_guard_passes_graph_query_projection",
  "forbidden_tripwire_edges_are_metadata_only",
  "all_graph_outputs_are_deterministic",
  "returned_outputs_are_defensive_copy_safe",
  "no_executable_payloads",
  "no_raw_prompts",
  "no_raw_model_outputs",
  "no_raw_tool_args",
  "no_raw_approval_tokens",
  "no_raw_voice_audio_ocr_frame_payloads",
  "no_secrets_api_keys_tokens",
  "no_action_affordances",
  "no_filesystem_reads",
  "no_database_reads",
  "no_telemetry_ingestion",
  "no_runtime_observers",
  "no_authority_surface",
  "phase_18_approval_boundaries_untouched",
] as const;

export const PHASE_19A_DISABLED_CAPABILITIES = [
  "UI rendering",
  "React Flow/D3 graph rendering",
  "source import parsing",
  "filesystem scanning",
  "database reads",
  "telemetry ingestion",
  "runtime observers",
  "observed runtime graph",
  "graph-driven execution",
  "run/retry/approve/execute/mutate/dispatch affordances",
  "tool calls",
  "approval decisions",
  "authority token creation",
  "side effects",
] as const;

export type Phase19ACloseoutVerdict =
  (typeof PHASE_19A_CLOSEOUT_VERDICTS)[number];
export type Phase19ACloseoutCheckId =
  (typeof PHASE_19A_CLOSEOUT_CHECK_IDS)[number];

export const Phase19ACloseoutVerdictSchema = z.enum(
  PHASE_19A_CLOSEOUT_VERDICTS,
);
export const Phase19ACloseoutCheckIdSchema = z.enum(
  PHASE_19A_CLOSEOUT_CHECK_IDS,
);

export const Phase19ACloseoutEvidenceSchema = z.strictObject({
  evidence_id: z
    .string()
    .trim()
    .regex(/^phase-19a-evidence:[a-z0-9._:-]+$/),
  source_slice: z.enum(["19A.1", "19A.2", "19A.3", "19A.4", "19A.5"]),
  summary: z.string().trim().min(1).max(260),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const Phase19ACloseoutCheckSchema = z.strictObject({
  check_id: Phase19ACloseoutCheckIdSchema,
  label: z.string().trim().min(1).max(220),
  passed: z.boolean(),
  evidence_id: z
    .string()
    .trim()
    .regex(/^phase-19a-evidence:[a-z0-9._:-]+$/),
  severity: z.enum(["required", "note"]),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const Phase19ACloseoutReportSchema = z.strictObject({
  report_version: z.literal(PHASE_19A_CLOSEOUT_VERSION),
  report_id: z.literal("phase-19a-architecture-graph-closeout"),
  verdict: Phase19ACloseoutVerdictSchema,
  checks: z.array(Phase19ACloseoutCheckSchema),
  evidence: z.array(Phase19ACloseoutEvidenceSchema),
  disabled_capabilities: z.array(z.enum(PHASE_19A_DISABLED_CAPABILITIES)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  ready_for_future_ui_rendering: z.literal(true),
  ui_rendered: z.literal(false),
  react_flow_or_d3_added: z.literal(false),
  source_imports_parsed: z.literal(false),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  telemetry_ingested: z.literal(false),
  runtime_observer_created: z.literal(false),
  authority_surface_created: z.literal(false),
  side_effects_performed: z.literal(false),
  phase_18_boundaries_modified: z.literal(false),
});

export type Phase19ACloseoutEvidence = z.infer<
  typeof Phase19ACloseoutEvidenceSchema
>;
export type Phase19ACloseoutCheck = z.infer<typeof Phase19ACloseoutCheckSchema>;
export type Phase19ACloseoutReport = z.infer<
  typeof Phase19ACloseoutReportSchema
>;

function evidence(input: {
  readonly evidence_id: Phase19ACloseoutEvidence["evidence_id"];
  readonly source_slice: Phase19ACloseoutEvidence["source_slice"];
  readonly summary: string;
}): Phase19ACloseoutEvidence {
  return Phase19ACloseoutEvidenceSchema.parse({
    evidence_id: input.evidence_id,
    source_slice: input.source_slice,
    summary: input.summary,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  });
}

function check(input: {
  readonly check_id: Phase19ACloseoutCheckId;
  readonly label: string;
  readonly passed: boolean;
  readonly evidence_id: Phase19ACloseoutEvidence["evidence_id"];
  readonly severity?: Phase19ACloseoutCheck["severity"];
}): Phase19ACloseoutCheck {
  return Phase19ACloseoutCheckSchema.parse({
    check_id: input.check_id,
    label: input.label,
    passed: input.passed,
    evidence_id: input.evidence_id,
    severity: input.severity ?? "required",
    metadata_only: true,
    read_only: true,
  });
}

function forbiddenEdgesAreTripwireMetadata(): boolean {
  return getStaticArchitectureGraph()
    .edges.filter((edge) => edge.kind === "forbidden")
    .every(
      (edge) =>
        edge.metadata_only &&
        edge.read_only &&
        edge.forbidden_edge_tripwire_only &&
        !edge.forbidden_edge_executes &&
        !edge.executable_action_enabled &&
        !edge.dispatch_enabled &&
        !edge.mutation_enabled &&
        !edge.authority_grant_enabled,
    );
}

function graphOutputsAreDeterministic(): boolean {
  return (
    JSON.stringify(getStaticArchitectureGraph()) ===
      JSON.stringify(getStaticArchitectureGraph()) &&
    JSON.stringify(buildArchitectureGraphProjection()) ===
      JSON.stringify(buildArchitectureGraphProjection()) &&
    JSON.stringify(summarizeArchitectureNode("arch-node:command-center")) ===
      JSON.stringify(summarizeArchitectureNode("arch-node:command-center"))
  );
}

function outputsAreDefensiveCopySafe(): boolean {
  const graph = getStaticArchitectureGraph();
  graph.nodes[0].label = "Mutated Closeout Copy";
  const projection = buildArchitectureGraphProjection();
  projection.nodes[0].label = "Mutated Closeout Projection";
  const edges = getArchitectureGraphEdgesForNode("arch-node:command-center");
  edges[0].label = "Mutated Closeout Edge";

  return (
    getStaticArchitectureGraph().nodes[0].label ===
      "Phase 10 Room OS Foundation" &&
    buildArchitectureGraphProjection().nodes[0].label ===
      "Phase 10 Room OS Foundation" &&
    getArchitectureGraphEdgesForNode("arch-node:command-center")[0].label ===
      "Command Center reads Observability API"
  );
}

function phase18BoundaryUntouched(): boolean {
  const graph = getStaticArchitectureGraph();
  return (
    graph.governance_boundaries.some(
      (boundary) =>
        boundary.boundary_id === "arch-boundary:phase-18-approval-runtime" &&
        boundary.approval_required_for_side_effects &&
        !boundary.authority_grant_enabled &&
        !boundary.execution_enabled &&
        !boundary.dispatch_enabled &&
        !boundary.mutation_enabled,
    ) &&
    graph.edges.some(
      (edge) =>
        edge.edge_id === "arch-edge:approval-runtime-gates-tool-runtime" &&
        edge.kind === "gates" &&
        edge.layer === "governance",
    )
  );
}

export function listPhase19ADisabledCapabilities(): readonly string[] {
  return [...PHASE_19A_DISABLED_CAPABILITIES];
}

export function buildPhase19ACloseoutReport(): Phase19ACloseoutReport {
  const graph = getStaticArchitectureGraph();
  const projection = buildArchitectureGraphProjection();
  const querySummary = summarizeArchitectureNode("arch-node:command-center");
  const graphValidation = validateArchitectureGraphMetadata(graph);
  const projectionValidation =
    ArchitectureGraphProjectionSchema.safeParse(projection);
  const queryValidation =
    ArchitectureGraphNodeSummarySchema.safeParse(querySummary);
  const graphSafety = scanArchitectureGraphSafety(
    graph,
    "static_registry_output",
  );
  const projectionSafety = scanArchitectureGraphProjectionSafety(projection);
  const querySafety = scanArchitectureGraphSafety(querySummary, "query_output");
  const noUnsafeSafetyFindings =
    graphSafety.valid && projectionSafety.valid && querySafety.valid;
  const graphFlagsRemainDisabled =
    !graph.filesystem_read &&
    !graph.database_read &&
    !graph.telemetry_ingested &&
    !graph.runtime_observers_created &&
    !graph.authority_surface_created &&
    !graph.executable_payload_included &&
    !graph.tool_arguments_included &&
    !graph.raw_prompt_included &&
    !graph.raw_model_output_included &&
    !graph.raw_voice_transcript_included &&
    !graph.raw_ocr_text_included &&
    !graph.raw_frame_included &&
    !graph.secret_material_included;

  const evidenceItems = [
    evidence({
      evidence_id: "phase-19a-evidence:contracts",
      source_slice: "19A.1",
      summary: `Architecture graph contracts version ${ARCHITECTURE_GRAPH_CONTRACT_VERSION} are exported.`,
    }),
    evidence({
      evidence_id: "phase-19a-evidence:registry",
      source_slice: "19A.2",
      summary: `Static registry exposes ${graph.nodes.length} nodes and ${graph.edges.length} edges.`,
    }),
    evidence({
      evidence_id: "phase-19a-evidence:queries",
      source_slice: "19A.3",
      summary:
        "Query helpers return metadata-only node summaries and graph relationships.",
    }),
    evidence({
      evidence_id: "phase-19a-evidence:projection",
      source_slice: "19A.4",
      summary: `Projection contract version ${ARCHITECTURE_GRAPH_PROJECTION_CONTRACT_VERSION} validates.`,
    }),
    evidence({
      evidence_id: "phase-19a-evidence:safety",
      source_slice: "19A.5",
      summary: `Safety guard version ${ARCHITECTURE_GRAPH_SAFETY_GUARD_VERSION} passes registry, query, and projection outputs.`,
    }),
  ];

  const checks = [
    check({
      check_id: "phase_19a1_contracts_exist",
      label: "Phase 19A.1 graph contracts exist.",
      passed: ARCHITECTURE_GRAPH_CONTRACT_VERSION === "19A.1",
      evidence_id: "phase-19a-evidence:contracts",
    }),
    check({
      check_id: "phase_19a2_static_registry_exists",
      label: "Phase 19A.2 static registry exists.",
      passed: graph.nodes.length > 0 && graph.edges.length > 0,
      evidence_id: "phase-19a-evidence:registry",
    }),
    check({
      check_id: "phase_19a3_query_helpers_exist",
      label: "Phase 19A.3 query helpers exist.",
      passed: queryValidation.success && querySummary !== null,
      evidence_id: "phase-19a-evidence:queries",
    }),
    check({
      check_id: "phase_19a4_projection_contracts_exist",
      label: "Phase 19A.4 projection contracts and builders exist.",
      passed:
        ARCHITECTURE_GRAPH_PROJECTION_CONTRACT_VERSION === "19A.4" &&
        projectionValidation.success,
      evidence_id: "phase-19a-evidence:projection",
    }),
    check({
      check_id: "phase_19a5_safety_guard_exists",
      label: "Phase 19A.5 safety guard exists.",
      passed: ARCHITECTURE_GRAPH_SAFETY_GUARD_VERSION === "19A.5",
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "static_graph_validates",
      label: "Static graph validates.",
      passed: graphValidation.valid,
      evidence_id: "phase-19a-evidence:registry",
    }),
    check({
      check_id: "projections_validate",
      label: "Projection output validates.",
      passed: projectionValidation.success,
      evidence_id: "phase-19a-evidence:projection",
    }),
    check({
      check_id: "safety_guard_passes_graph_query_projection",
      label: "Safety guard passes graph, query, and projection outputs.",
      passed: noUnsafeSafetyFindings,
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "forbidden_tripwire_edges_are_metadata_only",
      label: "Forbidden/tripwire edges are metadata-only.",
      passed: forbiddenEdgesAreTripwireMetadata(),
      evidence_id: "phase-19a-evidence:registry",
    }),
    check({
      check_id: "all_graph_outputs_are_deterministic",
      label: "Graph outputs are deterministic.",
      passed: graphOutputsAreDeterministic(),
      evidence_id: "phase-19a-evidence:queries",
    }),
    check({
      check_id: "returned_outputs_are_defensive_copy_safe",
      label: "Returned outputs are defensive-copy-safe.",
      passed: outputsAreDefensiveCopySafe(),
      evidence_id: "phase-19a-evidence:registry",
    }),
    check({
      check_id: "no_executable_payloads",
      label: "Graph contains no executable payloads.",
      passed: noUnsafeSafetyFindings && graphFlagsRemainDisabled,
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "no_raw_prompts",
      label: "Graph contains no raw prompts.",
      passed: noUnsafeSafetyFindings && !graph.raw_prompt_included,
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "no_raw_model_outputs",
      label: "Graph contains no raw model outputs.",
      passed: noUnsafeSafetyFindings && !graph.raw_model_output_included,
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "no_raw_tool_args",
      label: "Graph contains no raw tool args.",
      passed: noUnsafeSafetyFindings && !graph.tool_arguments_included,
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "no_raw_approval_tokens",
      label: "Graph contains no raw approval tokens.",
      passed: noUnsafeSafetyFindings,
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "no_raw_voice_audio_ocr_frame_payloads",
      label: "Graph contains no raw voice, audio, OCR, or frame payloads.",
      passed:
        noUnsafeSafetyFindings &&
        !graph.raw_voice_transcript_included &&
        !graph.raw_ocr_text_included &&
        !graph.raw_frame_included,
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "no_secrets_api_keys_tokens",
      label: "Graph contains no secrets, API keys, or tokens.",
      passed: noUnsafeSafetyFindings && !graph.secret_material_included,
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "no_action_affordances",
      label: "Graph exposes no action affordances.",
      passed:
        !graph.retry_enabled &&
        !graph.approve_enabled &&
        !graph.run_enabled &&
        !graph.mutate_enabled &&
        !graph.dispatch_enabled,
      evidence_id: "phase-19a-evidence:safety",
    }),
    check({
      check_id: "no_filesystem_reads",
      label: "Graph performs no filesystem reads.",
      passed: !graph.filesystem_read,
      evidence_id: "phase-19a-evidence:registry",
    }),
    check({
      check_id: "no_database_reads",
      label: "Graph performs no database reads.",
      passed: !graph.database_read,
      evidence_id: "phase-19a-evidence:registry",
    }),
    check({
      check_id: "no_telemetry_ingestion",
      label: "Graph performs no telemetry ingestion.",
      passed: !graph.telemetry_ingested,
      evidence_id: "phase-19a-evidence:registry",
    }),
    check({
      check_id: "no_runtime_observers",
      label: "Graph creates no runtime observers.",
      passed: !graph.runtime_observers_created,
      evidence_id: "phase-19a-evidence:registry",
    }),
    check({
      check_id: "no_authority_surface",
      label: "Graph introduces no authority surface.",
      passed: !graph.authority_surface_created,
      evidence_id: "phase-19a-evidence:registry",
    }),
    check({
      check_id: "phase_18_approval_boundaries_untouched",
      label: "Phase 18 approval boundaries remain untouched.",
      passed: phase18BoundaryUntouched() && !graph.approval_boundary_weakened,
      evidence_id: "phase-19a-evidence:registry",
      severity: "note",
    }),
  ];

  const allRequiredChecksPassed = checks
    .filter((item) => item.severity === "required")
    .every((item) => item.passed);

  return Phase19ACloseoutReportSchema.parse({
    report_version: PHASE_19A_CLOSEOUT_VERSION,
    report_id: "phase-19a-architecture-graph-closeout",
    verdict: allRequiredChecksPassed ? "PASS_WITH_NOTES" : "FAIL",
    checks,
    evidence: evidenceItems,
    disabled_capabilities: PHASE_19A_DISABLED_CAPABILITIES,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    ready_for_future_ui_rendering: true,
    ui_rendered: false,
    react_flow_or_d3_added: false,
    source_imports_parsed: false,
    filesystem_read: false,
    database_read: false,
    telemetry_ingested: false,
    runtime_observer_created: false,
    authority_surface_created: false,
    side_effects_performed: false,
    phase_18_boundaries_modified: false,
  });
}

export function assertPhase19ACloseoutPasses(): void {
  const report = buildPhase19ACloseoutReport();
  if (report.verdict === "FAIL") {
    const failedCheck = report.checks.find((item) => !item.passed);
    throw new Error(
      `Phase 19A closeout failed: ${failedCheck?.check_id ?? "unknown_check"}`,
    );
  }
}
