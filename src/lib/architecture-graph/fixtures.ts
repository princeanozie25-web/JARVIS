import {
  ARCHITECTURE_GRAPH_CONTRACT_VERSION,
  type ArchitectureGraph,
  type ArchitectureGraphActivitySummary,
  type ArchitectureGraphEdge,
  type ArchitectureGraphHealth,
  type ArchitectureGraphNode,
  ArchitectureGraphSchema,
} from "./contracts";

const HEALTHY: ArchitectureGraphHealth = {
  status: "healthy",
  summary: "Metadata contract fixture",
  metadata_only: true,
  read_only: true,
};

const EMPTY_ACTIVITY: ArchitectureGraphActivitySummary = {
  observed_call_count: 0,
  observed_write_count: 0,
  observed_dispatch_count: 0,
  observed_execution_count: 0,
  last_observed_at_ms: null,
  metadata_only: true,
  read_only: true,
  raw_event_payload_included: false,
  telemetry_ingested: false,
};

function node(input: {
  readonly node_id: ArchitectureGraphNode["node_id"];
  readonly label: string;
  readonly kind: ArchitectureGraphNode["kind"];
  readonly layer: ArchitectureGraphNode["layer"];
  readonly phase_ref?: string | null;
}): ArchitectureGraphNode {
  return {
    node_id: input.node_id,
    label: input.label,
    kind: input.kind,
    layer: input.layer,
    phase_ref: input.phase_ref ?? null,
    health: HEALTHY,
    activity_summary: EMPTY_ACTIVITY,
    metadata_only: true,
    read_only: true,
    executable_payload_included: false,
    tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_voice_transcript_included: false,
    raw_ocr_text_included: false,
    raw_frame_included: false,
    secret_material_included: false,
    authority_surface_created: false,
    execution_enabled: false,
    mutation_enabled: false,
  };
}

function edge(input: {
  readonly edge_id: ArchitectureGraphEdge["edge_id"];
  readonly from_node_id: ArchitectureGraphEdge["from_node_id"];
  readonly to_node_id: ArchitectureGraphEdge["to_node_id"];
  readonly kind: ArchitectureGraphEdge["kind"];
  readonly layer: ArchitectureGraphEdge["layer"];
  readonly label: string;
  readonly forbidden_edge_tripwire_only?: boolean;
}): ArchitectureGraphEdge {
  return {
    edge_id: input.edge_id,
    from_node_id: input.from_node_id,
    to_node_id: input.to_node_id,
    kind: input.kind,
    layer: input.layer,
    label: input.label,
    metadata_only: true,
    read_only: true,
    executable_action_enabled: false,
    dispatch_enabled: false,
    mutation_enabled: false,
    authority_grant_enabled: false,
    forbidden_edge_tripwire_only: input.forbidden_edge_tripwire_only ?? false,
    forbidden_edge_executes: false,
    raw_payload_included: false,
    tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_voice_transcript_included: false,
    raw_ocr_text_included: false,
    raw_frame_included: false,
    secret_material_included: false,
  };
}

export function buildPhase19A1SampleArchitectureGraph(): ArchitectureGraph {
  return ArchitectureGraphSchema.parse({
    contract_version: ARCHITECTURE_GRAPH_CONTRACT_VERSION,
    graph_id: "architecture-graph:phase-19a1-sample",
    generated_from: "static_fixture",
    created_at_source: "contract_metadata",
    layers: ["static_design", "observed_runtime", "governance", "discrepancy"],
    nodes: [
      node({
        node_id: "arch-node:phase-11-event-store",
        label: "Phase 11 Event Store",
        kind: "phase",
        layer: "static_design",
        phase_ref: "11",
      }),
      node({
        node_id: "arch-node:phase-12-command-center",
        label: "Phase 12 Command Center",
        kind: "phase",
        layer: "static_design",
        phase_ref: "12",
      }),
      node({
        node_id: "arch-node:phase-18-approval-runtime",
        label: "Phase 18 Approval Runtime",
        kind: "phase",
        layer: "governance",
        phase_ref: "18",
      }),
      node({
        node_id: "arch-node:phase-19-architecture-graph",
        label: "Phase 19 Architecture Graph",
        kind: "phase",
        layer: "static_design",
        phase_ref: "19A",
      }),
      node({
        node_id: "arch-node:event-store",
        label: "Event Store",
        kind: "store",
        layer: "static_design",
        phase_ref: "11",
      }),
      node({
        node_id: "arch-node:command-center",
        label: "Command Center",
        kind: "ui_surface",
        layer: "static_design",
        phase_ref: "12",
      }),
      node({
        node_id: "arch-node:approval-runtime",
        label: "Approval Runtime",
        kind: "governance_boundary",
        layer: "governance",
        phase_ref: "18",
      }),
      node({
        node_id: "arch-node:tool-runtime",
        label: "Tool Runtime",
        kind: "runtime_surface",
        layer: "static_design",
        phase_ref: "18",
      }),
      node({
        node_id: "arch-node:architecture-graph",
        label: "Architecture Graph",
        kind: "module",
        layer: "static_design",
        phase_ref: "19A",
      }),
      node({
        node_id: "arch-node:metadata-projections",
        label: "Metadata Projections",
        kind: "store",
        layer: "observed_runtime",
        phase_ref: "19A",
      }),
    ],
    edges: [
      edge({
        edge_id: "arch-edge:phase-12-reads-phase-11",
        from_node_id: "arch-node:phase-12-command-center",
        to_node_id: "arch-node:phase-11-event-store",
        kind: "reads_from",
        layer: "static_design",
        label: "Command Center reads Event Store projections",
      }),
      edge({
        edge_id: "arch-edge:approval-runtime-gates-tool-runtime",
        from_node_id: "arch-node:approval-runtime",
        to_node_id: "arch-node:tool-runtime",
        kind: "gates",
        layer: "governance",
        label: "Approval Runtime gates Tool Runtime side effects",
      }),
      edge({
        edge_id: "arch-edge:architecture-graph-reads-metadata-projections",
        from_node_id: "arch-node:architecture-graph",
        to_node_id: "arch-node:metadata-projections",
        kind: "reads_from",
        layer: "static_design",
        label: "Architecture Graph reads metadata projections",
      }),
      edge({
        edge_id: "arch-edge:architecture-graph-forbidden-runtime-dispatch",
        from_node_id: "arch-node:architecture-graph",
        to_node_id: "arch-node:tool-runtime",
        kind: "forbidden",
        layer: "governance",
        label: "Architecture Graph must never dispatch to Tool Runtime",
        forbidden_edge_tripwire_only: true,
      }),
    ],
    discrepancies: [],
    governance_boundaries: [
      {
        boundary_id: "arch-boundary:phase-18-approval-gate",
        label: "Phase 18 Approval Gate",
        kind: "approval_gate",
        governed_node_ids: [
          "arch-node:approval-runtime",
          "arch-node:tool-runtime",
        ],
        governed_edge_ids: ["arch-edge:approval-runtime-gates-tool-runtime"],
        layer: "governance",
        metadata_only: true,
        read_only: true,
        approval_required_for_side_effects: true,
        authority_grant_enabled: false,
        execution_enabled: false,
        dispatch_enabled: false,
        mutation_enabled: false,
      },
      {
        boundary_id: "arch-boundary:phase-19-read-only-graph",
        label: "Phase 19 Architecture Graph Read-Only Boundary",
        kind: "read_only_boundary",
        governed_node_ids: ["arch-node:architecture-graph"],
        governed_edge_ids: [
          "arch-edge:architecture-graph-reads-metadata-projections",
          "arch-edge:architecture-graph-forbidden-runtime-dispatch",
        ],
        layer: "governance",
        metadata_only: true,
        read_only: true,
        approval_required_for_side_effects: true,
        authority_grant_enabled: false,
        execution_enabled: false,
        dispatch_enabled: false,
        mutation_enabled: false,
      },
    ],
    health: HEALTHY,
    activity_summary: EMPTY_ACTIVITY,
    metadata_only: true,
    read_only: true,
    source_imports_parsed: false,
    filesystem_read: false,
    database_read: false,
    telemetry_ingested: false,
    runtime_observers_created: false,
    ui_rendered: false,
    executable_payload_included: false,
    tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_voice_transcript_included: false,
    raw_ocr_text_included: false,
    raw_frame_included: false,
    secret_material_included: false,
    approval_boundary_weakened: false,
    authority_surface_created: false,
    execution_enabled: false,
    retry_enabled: false,
    approve_enabled: false,
    run_enabled: false,
    mutate_enabled: false,
    dispatch_enabled: false,
  });
}

export const PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH =
  buildPhase19A1SampleArchitectureGraph();
