import {
  ARCHITECTURE_GRAPH_CONTRACT_VERSION,
  ArchitectureGraphSchema,
  type ArchitectureGraph,
  type ArchitectureGraphActivitySummary,
  type ArchitectureGraphEdge,
  type ArchitectureGraphHealth,
  type ArchitectureGraphNode,
} from "./contracts";

const HEALTHY: ArchitectureGraphHealth = {
  status: "healthy",
  summary: "Designed static architecture metadata",
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

const STATIC_ARCHITECTURE_GRAPH = ArchitectureGraphSchema.parse({
  contract_version: ARCHITECTURE_GRAPH_CONTRACT_VERSION,
  graph_id: "architecture-graph:phase-19a-static-registry",
  generated_from: "static_fixture",
  created_at_source: "contract_metadata",
  layers: ["static_design", "observed_runtime", "governance", "discrepancy"],
  nodes: [
    node({
      node_id: "arch-node:phase-10-room-os-foundation",
      label: "Phase 10 Room OS Foundation",
      kind: "phase",
      layer: "static_design",
      phase_ref: "10",
    }),
    node({
      node_id: "arch-node:phase-11-persistence-event-store",
      label: "Phase 11 Persistence/Event Store",
      kind: "phase",
      layer: "static_design",
      phase_ref: "11",
    }),
    node({
      node_id: "arch-node:phase-12-command-center-ui",
      label: "Phase 12 Command Center UI",
      kind: "phase",
      layer: "static_design",
      phase_ref: "12",
    }),
    node({
      node_id: "arch-node:phase-13-model-runtime",
      label: "Phase 13 Model Runtime",
      kind: "phase",
      layer: "static_design",
      phase_ref: "13",
    }),
    node({
      node_id: "arch-node:phase-14-voice-runtime",
      label: "Phase 14 Voice Runtime",
      kind: "phase",
      layer: "static_design",
      phase_ref: "14",
    }),
    node({
      node_id: "arch-node:phase-15-vision-runtime",
      label: "Phase 15 Vision Runtime",
      kind: "phase",
      layer: "static_design",
      phase_ref: "15",
    }),
    node({
      node_id: "arch-node:phase-16-room-adapter-runtime",
      label: "Phase 16 Room Adapter Runtime",
      kind: "phase",
      layer: "static_design",
      phase_ref: "16",
    }),
    node({
      node_id: "arch-node:phase-17-scheduled-assistance-runtime",
      label: "Phase 17 Scheduled Assistance Runtime",
      kind: "phase",
      layer: "static_design",
      phase_ref: "17",
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
      node_id: "arch-node:read-only-projections",
      label: "Read-only Projections",
      kind: "store",
      layer: "static_design",
      phase_ref: "11",
    }),
    node({
      node_id: "arch-node:observability-api",
      label: "Observability API",
      kind: "module",
      layer: "static_design",
      phase_ref: "12",
    }),
    node({
      node_id: "arch-node:command-center",
      label: "Command Center",
      kind: "ui_surface",
      layer: "static_design",
      phase_ref: "12",
    }),
    node({
      node_id: "arch-node:model-router",
      label: "Model Router",
      kind: "module",
      layer: "static_design",
      phase_ref: "13",
    }),
    node({
      node_id: "arch-node:voice-runtime",
      label: "Voice Runtime",
      kind: "runtime_surface",
      layer: "static_design",
      phase_ref: "14",
    }),
    node({
      node_id: "arch-node:runtime-boundary",
      label: "Runtime Boundary",
      kind: "governance_boundary",
      layer: "governance",
      phase_ref: "18",
    }),
    node({
      node_id: "arch-node:vision-runtime",
      label: "Vision Runtime",
      kind: "runtime_surface",
      layer: "static_design",
      phase_ref: "15",
    }),
    node({
      node_id: "arch-node:room-registry",
      label: "Room Registry",
      kind: "module",
      layer: "static_design",
      phase_ref: "16",
    }),
    node({
      node_id: "arch-node:room-adapters",
      label: "Room Adapters",
      kind: "adapter",
      layer: "static_design",
      phase_ref: "16",
    }),
    node({
      node_id: "arch-node:scheduler",
      label: "Scheduler",
      kind: "module",
      layer: "static_design",
      phase_ref: "17",
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
      node_id: "arch-node:telemetry-redactor",
      label: "Telemetry Redactor",
      kind: "governance_boundary",
      layer: "governance",
      phase_ref: "12",
    }),
    node({
      node_id: "arch-node:audit-preview",
      label: "Audit Preview",
      kind: "module",
      layer: "governance",
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
      node_id: "arch-node:metadata-projection-surfaces",
      label: "Metadata Projection Surfaces",
      kind: "store",
      layer: "static_design",
      phase_ref: "19A",
    }),
    node({
      node_id: "arch-node:demo-observability-surfaces",
      label: "Demo/Observability Surfaces",
      kind: "ui_surface",
      layer: "static_design",
      phase_ref: "12",
    }),
  ],
  edges: [
    edge({
      edge_id: "arch-edge:command-center-reads-observability-api",
      from_node_id: "arch-node:command-center",
      to_node_id: "arch-node:observability-api",
      kind: "reads_from",
      layer: "static_design",
      label: "Command Center reads Observability API",
    }),
    edge({
      edge_id: "arch-edge:observability-api-reads-projections",
      from_node_id: "arch-node:observability-api",
      to_node_id: "arch-node:read-only-projections",
      kind: "reads_from",
      layer: "static_design",
      label: "Observability API reads read-only projections",
    }),
    edge({
      edge_id: "arch-edge:projections-read-event-store",
      from_node_id: "arch-node:read-only-projections",
      to_node_id: "arch-node:event-store",
      kind: "reads_from",
      layer: "static_design",
      label: "Read-only projections read Event Store",
    }),
    edge({
      edge_id: "arch-edge:model-router-writes-model-call-metadata",
      from_node_id: "arch-node:model-router",
      to_node_id: "arch-node:event-store",
      kind: "writes_to",
      layer: "static_design",
      label: "Model Router writes model-call metadata to Event Store",
    }),
    edge({
      edge_id: "arch-edge:voice-runtime-routes-text-runtime-boundary",
      from_node_id: "arch-node:voice-runtime",
      to_node_id: "arch-node:runtime-boundary",
      kind: "projects_to",
      layer: "static_design",
      label: "Voice Runtime routes text through existing runtime boundary",
    }),
    edge({
      edge_id: "arch-edge:vision-runtime-emits-metadata-observations",
      from_node_id: "arch-node:vision-runtime",
      to_node_id: "arch-node:event-store",
      kind: "writes_to",
      layer: "static_design",
      label: "Vision Runtime emits metadata-only observations",
    }),
    edge({
      edge_id: "arch-edge:room-adapters-emit-room-event-metadata",
      from_node_id: "arch-node:room-adapters",
      to_node_id: "arch-node:event-store",
      kind: "writes_to",
      layer: "static_design",
      label: "Room Adapters emit room-event metadata",
    }),
    edge({
      edge_id: "arch-edge:scheduler-emits-suggestion-metadata",
      from_node_id: "arch-node:scheduler",
      to_node_id: "arch-node:event-store",
      kind: "writes_to",
      layer: "static_design",
      label: "Scheduler emits suggestion metadata",
    }),
    edge({
      edge_id: "arch-edge:approval-runtime-gates-tool-runtime",
      from_node_id: "arch-node:approval-runtime",
      to_node_id: "arch-node:tool-runtime",
      kind: "gates",
      layer: "governance",
      label: "Approval Runtime gates Tool Runtime",
    }),
    edge({
      edge_id: "arch-edge:tool-runtime-requires-approval-runtime",
      from_node_id: "arch-node:tool-runtime",
      to_node_id: "arch-node:approval-runtime",
      kind: "depends_on",
      layer: "governance",
      label: "Tool Runtime requires Approval Runtime for side effects",
    }),
    edge({
      edge_id: "arch-edge:telemetry-redactor-gates-ui-projections",
      from_node_id: "arch-node:telemetry-redactor",
      to_node_id: "arch-node:read-only-projections",
      kind: "gates",
      layer: "governance",
      label: "Telemetry Redactor gates UI/projection payloads",
    }),
    edge({
      edge_id: "arch-edge:architecture-graph-reads-metadata-projections",
      from_node_id: "arch-node:architecture-graph",
      to_node_id: "arch-node:metadata-projection-surfaces",
      kind: "reads_from",
      layer: "static_design",
      label: "Architecture Graph reads metadata/projection surfaces only",
    }),
    edge({
      edge_id: "arch-edge:voice-runtime-forbidden-approve-actions",
      from_node_id: "arch-node:voice-runtime",
      to_node_id: "arch-node:approval-runtime",
      kind: "forbidden",
      layer: "governance",
      label: "Voice Runtime must not approve actions",
      forbidden_edge_tripwire_only: true,
    }),
    edge({
      edge_id: "arch-edge:vision-runtime-forbidden-room-actions",
      from_node_id: "arch-node:vision-runtime",
      to_node_id: "arch-node:room-adapters",
      kind: "forbidden",
      layer: "governance",
      label: "Vision Runtime must not trigger room actions",
      forbidden_edge_tripwire_only: true,
    }),
    edge({
      edge_id: "arch-edge:scheduler-forbidden-execute-tools",
      from_node_id: "arch-node:scheduler",
      to_node_id: "arch-node:tool-runtime",
      kind: "forbidden",
      layer: "governance",
      label: "Scheduler must not execute tools",
      forbidden_edge_tripwire_only: true,
    }),
    edge({
      edge_id: "arch-edge:command-center-forbidden-mutate-state",
      from_node_id: "arch-node:command-center",
      to_node_id: "arch-node:event-store",
      kind: "forbidden",
      layer: "governance",
      label: "Command Center must not mutate state",
      forbidden_edge_tripwire_only: true,
    }),
    edge({
      edge_id: "arch-edge:architecture-graph-forbidden-execute-traces",
      from_node_id: "arch-node:architecture-graph",
      to_node_id: "arch-node:tool-runtime",
      kind: "forbidden",
      layer: "governance",
      label: "Architecture Graph must not execute traces",
      forbidden_edge_tripwire_only: true,
    }),
    edge({
      edge_id: "arch-edge:observability-surfaces-forbidden-live-store-write",
      from_node_id: "arch-node:demo-observability-surfaces",
      to_node_id: "arch-node:event-store",
      kind: "forbidden",
      layer: "governance",
      label: "Demo/observability surfaces must not write to live store",
      forbidden_edge_tripwire_only: true,
    }),
  ],
  discrepancies: [],
  governance_boundaries: [
    {
      boundary_id: "arch-boundary:phase-18-approval-runtime",
      label: "Phase 18 Approval Runtime Boundary",
      kind: "approval_gate",
      governed_node_ids: [
        "arch-node:approval-runtime",
        "arch-node:tool-runtime",
      ],
      governed_edge_ids: [
        "arch-edge:approval-runtime-gates-tool-runtime",
        "arch-edge:tool-runtime-requires-approval-runtime",
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
    {
      boundary_id: "arch-boundary:phase-19a-read-only-graph",
      label: "Phase 19A Read-only Architecture Graph Boundary",
      kind: "read_only_boundary",
      governed_node_ids: ["arch-node:architecture-graph"],
      governed_edge_ids: [
        "arch-edge:architecture-graph-reads-metadata-projections",
        "arch-edge:architecture-graph-forbidden-execute-traces",
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

function copyGraph(): ArchitectureGraph {
  return ArchitectureGraphSchema.parse(
    JSON.parse(JSON.stringify(STATIC_ARCHITECTURE_GRAPH)),
  );
}

function copyNode(node: ArchitectureGraphNode): ArchitectureGraphNode {
  return ArchitectureGraphSchema.shape.nodes.element.parse(
    JSON.parse(JSON.stringify(node)),
  );
}

function copyEdge(edge: ArchitectureGraphEdge): ArchitectureGraphEdge {
  return ArchitectureGraphSchema.shape.edges.element.parse(
    JSON.parse(JSON.stringify(edge)),
  );
}

export function getStaticArchitectureGraph(): ArchitectureGraph {
  return copyGraph();
}

export function listArchitectureGraphNodes(): readonly ArchitectureGraphNode[] {
  return copyGraph().nodes;
}

export function listArchitectureGraphEdges(): readonly ArchitectureGraphEdge[] {
  return copyGraph().edges;
}

export function getArchitectureGraphNodeById(
  id: ArchitectureGraphNode["node_id"],
): ArchitectureGraphNode | null {
  const nodeResult = STATIC_ARCHITECTURE_GRAPH.nodes.find(
    (node) => node.node_id === id,
  );

  return nodeResult ? copyNode(nodeResult) : null;
}

export function getArchitectureGraphEdgesForNode(
  id: ArchitectureGraphNode["node_id"],
): readonly ArchitectureGraphEdge[] {
  return STATIC_ARCHITECTURE_GRAPH.edges
    .filter((edge) => edge.from_node_id === id || edge.to_node_id === id)
    .map(copyEdge);
}
