import type { GraphifyOverlay } from "../graphify";

export const PIPELINE_VISUALIZATION_VERSION = "phase21k.pipeline.v1" as const;

export const PIPELINE_STAGE_IDS = [
  "capture",
  "classify",
  "route",
  "human_gate",
  "execute",
  "audit",
] as const;

export const PIPELINE_EDGE_POLICIES = [
  "allowed",
  "gated",
  "forbidden",
] as const;

export const PIPELINE_DISCREPANCY_KINDS = [
  "designed_not_observed",
  "observed_not_designed",
  "forbidden_edge_detected",
  "unknown",
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGE_IDS)[number];
export type PipelineEdgePolicy = (typeof PIPELINE_EDGE_POLICIES)[number];
export type PipelineDiscrepancyKind =
  (typeof PIPELINE_DISCREPANCY_KINDS)[number];

export interface PipelineStage {
  stage_id: PipelineStageId;
  label: string;
  description: string;
  status: "enabled" | "gated" | "read_only" | "disabled";
  trust_class:
    | "observe_only"
    | "classification"
    | "routing"
    | "human_approval"
    | "restricted_execution"
    | "audit_only";
  authority_surface: boolean;
  metadata_only: true;
  read_only: true;
}

export interface PipelineTransition {
  transition_id: string;
  from_stage_id: PipelineStageId;
  to_stage_id: PipelineStageId;
  label: string;
  policy: PipelineEdgePolicy;
  boundary_id: string | null;
  governance_note: string;
  metadata_only: true;
  read_only: true;
  executable_action_enabled: false;
  approval_action_enabled: false;
  mutation_enabled: false;
  provider_call_enabled: false;
}

export interface PipelineBoundary {
  boundary_id: string;
  label: string;
  kind:
    | "approval_boundary"
    | "execution_boundary"
    | "audit_boundary"
    | "disabled_feature_boundary"
    | "read_only_boundary";
  stage_ids: PipelineStageId[];
  transition_ids: string[];
  description: string;
  metadata_only: true;
  read_only: true;
  authority_grant_enabled: false;
  execution_enabled: false;
  approval_decision_enabled: false;
}

export interface PipelineDisabledFeature {
  feature_id: string;
  label: string;
  reason: string;
  stage_ids: PipelineStageId[];
  transition_ids: string[];
  disabled: true;
  metadata_only: true;
  read_only: true;
}

export interface PipelineAuthoritySurface {
  surface_id: string;
  label: string;
  stage_id: PipelineStageId;
  trust_class: PipelineStage["trust_class"];
  authority_created_by_visualization: false;
  approval_boundary_visible: boolean;
  execution_boundary_visible: boolean;
  metadata_only: true;
  read_only: true;
}

export interface PipelineGovernanceOverlay {
  overlay_id: string;
  approval_lifecycle: string[];
  disabled_features: PipelineDisabledFeature[];
  trust_classes: Array<{
    stage_id: PipelineStageId;
    trust_class: PipelineStage["trust_class"];
    note: string;
  }>;
  authority_surfaces: PipelineAuthoritySurface[];
  governance_posture: "read_only_governance_visualization" | "needs_attention";
  graphify_governance_truth: false;
  metadata_only: true;
  read_only: true;
  authority_surface_created: false;
  governance_replaced: false;
}

export interface PipelineVisualizationSummary {
  stage_count: number;
  transition_count: number;
  allowed_transition_count: number;
  gated_transition_count: number;
  forbidden_transition_count: number;
  boundary_count: number;
  disabled_feature_count: number;
  governance_posture: PipelineGovernanceOverlay["governance_posture"];
  metadata_only: true;
  read_only: true;
}

export interface PipelineVisualizationModel {
  model_id: string;
  version: typeof PIPELINE_VISUALIZATION_VERSION;
  stages: PipelineStage[];
  transitions: PipelineTransition[];
  boundaries: PipelineBoundary[];
  governance_overlay: PipelineGovernanceOverlay;
  summary: PipelineVisualizationSummary;
  metadata_only: true;
  read_only: true;
  graph_driven_execution_enabled: false;
  execution_surface_created: false;
  approval_surface_created: false;
  provider_call_enabled: false;
  network_call_enabled: false;
  filesystem_write_enabled: false;
  telemetry_write_enabled: false;
  authority_escalation_enabled: false;
}

export interface PipelineObservedTransition {
  observed_edge_id: string;
  from_stage_id: PipelineStageId | string;
  to_stage_id: PipelineStageId | string;
  policy?: PipelineEdgePolicy;
  source: "graphify" | "architecture_graph" | "manual_supplied";
  metadata_only: true;
  read_only: true;
}

export interface PipelineDiscrepancy {
  discrepancy_id: string;
  kind: PipelineDiscrepancyKind;
  transition_key: string;
  designed_transition_id: string | null;
  observed_edge_id: string | null;
  summary: string;
  metadata_only: true;
  read_only: true;
  remediation_executed: false;
}

export interface PipelineDiscrepancySummary {
  discrepancies: PipelineDiscrepancy[];
  designed_not_observed_count: number;
  observed_not_designed_count: number;
  forbidden_edge_detected_count: number;
  unknown_count: number;
  graphify_data_source_only: true;
  graphify_governance_truth: false;
  metadata_only: true;
  read_only: true;
}

export interface PipelineViewModel {
  title: "Governed Pipeline";
  subtitle: string;
  stages: Array<{
    stage_id: PipelineStageId;
    label: string;
    description: string;
    status: PipelineStage["status"];
    governance_notes: string[];
    approval_gate_visible: boolean;
    execution_boundary_visible: boolean;
    disabled_feature_notes: string[];
  }>;
  edges: Array<{
    transition_id: string;
    from_stage_id: PipelineStageId;
    to_stage_id: PipelineStageId;
    label: string;
    policy: PipelineEdgePolicy;
    visual_treatment: "normal" | "guarded" | "blocked";
    governance_note: string;
  }>;
  boundaries: Array<{
    boundary_id: string;
    label: string;
    kind: PipelineBoundary["kind"];
    description: string;
  }>;
  controls: never[];
  read_only: true;
  execute_affordance_present: false;
  approve_affordance_present: false;
  mutation_affordance_present: false;
}

export interface PipelineVisualizationCloseoutReport {
  closeout_version: typeof PIPELINE_VISUALIZATION_VERSION;
  title: "Pipeline visualization complete as a read-only governance surface";
  status: "complete";
  components: {
    pipeline_model_exists: true;
    governance_overlay_exists: true;
    graphify_integration_exists: true;
    discrepancy_model_exists: true;
    view_model_exists: true;
  };
  prohibited_capabilities: {
    execution_surface_created: false;
    approval_surface_created: false;
    provider_calls_enabled: false;
    network_calls_enabled: false;
    filesystem_writes_enabled: false;
    telemetry_writes_enabled: false;
    governance_replacement_enabled: false;
    authority_escalation_enabled: false;
    graphify_execution_enabled: false;
  };
  required_wording: "Pipeline visualization complete as a read-only governance surface";
  metadata_only: true;
  read_only: true;
}

function stage(input: Omit<PipelineStage, "metadata_only" | "read_only">) {
  return {
    ...input,
    metadata_only: true,
    read_only: true,
  } satisfies PipelineStage;
}

function transition(
  input: Omit<
    PipelineTransition,
    | "metadata_only"
    | "read_only"
    | "executable_action_enabled"
    | "approval_action_enabled"
    | "mutation_enabled"
    | "provider_call_enabled"
  >,
) {
  return {
    ...input,
    metadata_only: true,
    read_only: true,
    executable_action_enabled: false,
    approval_action_enabled: false,
    mutation_enabled: false,
    provider_call_enabled: false,
  } satisfies PipelineTransition;
}

function boundary(
  input: Omit<
    PipelineBoundary,
    | "metadata_only"
    | "read_only"
    | "authority_grant_enabled"
    | "execution_enabled"
    | "approval_decision_enabled"
  >,
) {
  return {
    ...input,
    metadata_only: true,
    read_only: true,
    authority_grant_enabled: false,
    execution_enabled: false,
    approval_decision_enabled: false,
  } satisfies PipelineBoundary;
}

const PIPELINE_STAGES: PipelineStage[] = [
  stage({
    stage_id: "capture",
    label: "Capture",
    description:
      "Input arrives as text, voice transcript draft, or supplied metadata.",
    status: "read_only",
    trust_class: "observe_only",
    authority_surface: false,
  }),
  stage({
    stage_id: "classify",
    label: "Classify",
    description:
      "Intent, safety, privacy, authority, and capability class are determined.",
    status: "read_only",
    trust_class: "classification",
    authority_surface: false,
  }),
  stage({
    stage_id: "route",
    label: "Route",
    description:
      "The request is routed to allowed read-only paths or gated proposal paths.",
    status: "read_only",
    trust_class: "routing",
    authority_surface: false,
  }),
  stage({
    stage_id: "human_gate",
    label: "Human Gate",
    description:
      "Prince reviews gated side-effect proposals before execution can proceed.",
    status: "gated",
    trust_class: "human_approval",
    authority_surface: true,
  }),
  stage({
    stage_id: "execute",
    label: "Execute",
    description:
      "Existing approved execution surfaces remain outside this visualization.",
    status: "gated",
    trust_class: "restricted_execution",
    authority_surface: true,
  }),
  stage({
    stage_id: "audit",
    label: "Audit",
    description:
      "Audit metadata explains what happened without exposing raw payloads.",
    status: "read_only",
    trust_class: "audit_only",
    authority_surface: false,
  }),
];

const PIPELINE_TRANSITIONS: PipelineTransition[] = [
  transition({
    transition_id: "pipeline-transition:capture-to-classify",
    from_stage_id: "capture",
    to_stage_id: "classify",
    label: "Captured input enters classification",
    policy: "allowed",
    boundary_id: null,
    governance_note: "Allowed because this is metadata classification only.",
  }),
  transition({
    transition_id: "pipeline-transition:classify-to-route",
    from_stage_id: "classify",
    to_stage_id: "route",
    label: "Classified request enters routing",
    policy: "allowed",
    boundary_id: null,
    governance_note: "Allowed because no authority is granted by routing.",
  }),
  transition({
    transition_id: "pipeline-transition:route-to-human-gate",
    from_stage_id: "route",
    to_stage_id: "human_gate",
    label: "Gated action proposal enters human review",
    policy: "gated",
    boundary_id: "pipeline-boundary:approval",
    governance_note:
      "Gated because side-effect proposals require human approval.",
  }),
  transition({
    transition_id: "pipeline-transition:human-gate-to-execute",
    from_stage_id: "human_gate",
    to_stage_id: "execute",
    label: "Approved proposal may reach existing execution boundary",
    policy: "gated",
    boundary_id: "pipeline-boundary:execution",
    governance_note:
      "Gated because execution remains behind existing approval runtime.",
  }),
  transition({
    transition_id: "pipeline-transition:execute-to-audit",
    from_stage_id: "execute",
    to_stage_id: "audit",
    label: "Execution metadata enters audit",
    policy: "allowed",
    boundary_id: "pipeline-boundary:audit",
    governance_note:
      "Allowed as redacted audit metadata, not execution control.",
  }),
  transition({
    transition_id: "pipeline-transition:capture-to-execute-forbidden",
    from_stage_id: "capture",
    to_stage_id: "execute",
    label: "Captured input must not execute directly",
    policy: "forbidden",
    boundary_id: "pipeline-boundary:disabled-feature",
    governance_note:
      "Forbidden because capture cannot bypass classification, routing, or approval.",
  }),
  transition({
    transition_id: "pipeline-transition:classify-to-execute-forbidden",
    from_stage_id: "classify",
    to_stage_id: "execute",
    label: "Classification must not execute directly",
    policy: "forbidden",
    boundary_id: "pipeline-boundary:disabled-feature",
    governance_note:
      "Forbidden because classification is not an authority surface.",
  }),
  transition({
    transition_id: "pipeline-transition:route-to-execute-forbidden",
    from_stage_id: "route",
    to_stage_id: "execute",
    label: "Routing must not bypass the human gate",
    policy: "forbidden",
    boundary_id: "pipeline-boundary:disabled-feature",
    governance_note:
      "Forbidden because routed side-effect proposals require human review.",
  }),
  transition({
    transition_id: "pipeline-transition:graphify-to-execute-forbidden",
    from_stage_id: "audit",
    to_stage_id: "execute",
    label: "Graph or audit observations must not execute",
    policy: "forbidden",
    boundary_id: "pipeline-boundary:read-only",
    governance_note:
      "Forbidden because Graphify and audit surfaces are data sources only.",
  }),
];

const PIPELINE_BOUNDARIES: PipelineBoundary[] = [
  boundary({
    boundary_id: "pipeline-boundary:approval",
    label: "Approval Boundary",
    kind: "approval_boundary",
    stage_ids: ["human_gate"],
    transition_ids: ["pipeline-transition:route-to-human-gate"],
    description:
      "Shows where proposals become reviewable, without adding approval controls.",
  }),
  boundary({
    boundary_id: "pipeline-boundary:execution",
    label: "Execution Boundary",
    kind: "execution_boundary",
    stage_ids: ["execute"],
    transition_ids: ["pipeline-transition:human-gate-to-execute"],
    description:
      "Shows where approved work would enter existing execution runtime.",
  }),
  boundary({
    boundary_id: "pipeline-boundary:audit",
    label: "Audit Boundary",
    kind: "audit_boundary",
    stage_ids: ["audit"],
    transition_ids: ["pipeline-transition:execute-to-audit"],
    description: "Shows the redacted audit path after execution metadata.",
  }),
  boundary({
    boundary_id: "pipeline-boundary:disabled-feature",
    label: "Disabled Feature Boundary",
    kind: "disabled_feature_boundary",
    stage_ids: ["capture", "classify", "route", "execute"],
    transition_ids: [
      "pipeline-transition:capture-to-execute-forbidden",
      "pipeline-transition:classify-to-execute-forbidden",
      "pipeline-transition:route-to-execute-forbidden",
    ],
    description: "Shows bypasses that remain disabled and forbidden by design.",
  }),
  boundary({
    boundary_id: "pipeline-boundary:read-only",
    label: "Read-only Visualization Boundary",
    kind: "read_only_boundary",
    stage_ids: ["audit"],
    transition_ids: ["pipeline-transition:graphify-to-execute-forbidden"],
    description: "Shows that graph/audit visualization cannot drive execution.",
  }),
];

export function buildPipelineGovernanceOverlay(): PipelineGovernanceOverlay {
  const disabled_features: PipelineDisabledFeature[] = [
    {
      feature_id: "pipeline-disabled:auto-execute",
      label: "Auto-execution from captured input",
      reason: "Capture, classify, and route cannot bypass the human gate.",
      stage_ids: ["capture", "classify", "route", "execute"],
      transition_ids: [
        "pipeline-transition:capture-to-execute-forbidden",
        "pipeline-transition:classify-to-execute-forbidden",
        "pipeline-transition:route-to-execute-forbidden",
      ],
      disabled: true,
      metadata_only: true,
      read_only: true,
    },
    {
      feature_id: "pipeline-disabled:graphify-execution",
      label: "Graphify-driven execution",
      reason: "Graphify remains a data source only and never governance truth.",
      stage_ids: ["audit", "execute"],
      transition_ids: ["pipeline-transition:graphify-to-execute-forbidden"],
      disabled: true,
      metadata_only: true,
      read_only: true,
    },
    {
      feature_id: "pipeline-disabled:visualizer-approval-controls",
      label: "Approval controls inside visualization",
      reason:
        "Approval decisions remain in the existing approval lifecycle, not this surface.",
      stage_ids: ["human_gate"],
      transition_ids: [],
      disabled: true,
      metadata_only: true,
      read_only: true,
    },
  ];

  return {
    overlay_id: "pipeline-governance-overlay:phase-21k",
    approval_lifecycle: [
      "proposal",
      "review",
      "decision_record",
      "authority_token_metadata",
      "execution_plan_metadata",
      "verification_metadata",
      "audit_metadata",
    ],
    disabled_features,
    trust_classes: PIPELINE_STAGES.map((item) => ({
      stage_id: item.stage_id,
      trust_class: item.trust_class,
      note: `${item.label} is represented as ${item.trust_class}.`,
    })),
    authority_surfaces: PIPELINE_STAGES.map((item) => ({
      surface_id: `pipeline-authority-surface:${item.stage_id}`,
      label: item.label,
      stage_id: item.stage_id,
      trust_class: item.trust_class,
      authority_created_by_visualization: false,
      approval_boundary_visible: item.stage_id === "human_gate",
      execution_boundary_visible: item.stage_id === "execute",
      metadata_only: true,
      read_only: true,
    })),
    governance_posture: "read_only_governance_visualization",
    graphify_governance_truth: false,
    metadata_only: true,
    read_only: true,
    authority_surface_created: false,
    governance_replaced: false,
  };
}

export function summarizePipelineVisualization(
  model: Pick<
    PipelineVisualizationModel,
    "stages" | "transitions" | "boundaries" | "governance_overlay"
  >,
): PipelineVisualizationSummary {
  return {
    stage_count: model.stages.length,
    transition_count: model.transitions.length,
    allowed_transition_count: model.transitions.filter(
      (item) => item.policy === "allowed",
    ).length,
    gated_transition_count: model.transitions.filter(
      (item) => item.policy === "gated",
    ).length,
    forbidden_transition_count: model.transitions.filter(
      (item) => item.policy === "forbidden",
    ).length,
    boundary_count: model.boundaries.length,
    disabled_feature_count: model.governance_overlay.disabled_features.length,
    governance_posture: model.governance_overlay.governance_posture,
    metadata_only: true,
    read_only: true,
  };
}

export function buildPipelineVisualizationModel(): PipelineVisualizationModel {
  const governance_overlay = buildPipelineGovernanceOverlay();
  const base = {
    model_id: "pipeline-visualization:phase-21k",
    version: PIPELINE_VISUALIZATION_VERSION,
    stages: copy(PIPELINE_STAGES),
    transitions: copy(PIPELINE_TRANSITIONS),
    boundaries: copy(PIPELINE_BOUNDARIES),
    governance_overlay,
    metadata_only: true,
    read_only: true,
    graph_driven_execution_enabled: false,
    execution_surface_created: false,
    approval_surface_created: false,
    provider_call_enabled: false,
    network_call_enabled: false,
    filesystem_write_enabled: false,
    telemetry_write_enabled: false,
    authority_escalation_enabled: false,
  } satisfies Omit<PipelineVisualizationModel, "summary">;

  return {
    ...base,
    summary: summarizePipelineVisualization(base),
  };
}

export function buildPipelineDiscrepancySummary(
  input: {
    designedTransitions?: readonly PipelineTransition[];
    observedTransitions?: readonly PipelineObservedTransition[];
    graphifyOverlay?: Pick<GraphifyOverlay, "edges" | "discrepancies">;
  } = {},
): PipelineDiscrepancySummary {
  const designedTransitions =
    input.designedTransitions ?? buildPipelineVisualizationModel().transitions;
  const observedTransitions = [
    ...(input.observedTransitions ?? []),
    ...observedTransitionsFromGraphify(input.graphifyOverlay),
  ];
  const designedByKey = new Map(
    designedTransitions.map((item) => [transitionKey(item), item]),
  );
  const observedByKey = new Map(
    observedTransitions.map((item) => [observedTransitionKey(item), item]),
  );
  const discrepancies: PipelineDiscrepancy[] = [];

  for (const transitionItem of designedTransitions) {
    const key = transitionKey(transitionItem);
    const observed = observedByKey.get(key);
    if (!observed) {
      discrepancies.push(
        discrepancy({
          kind: "designed_not_observed",
          transitionKey: key,
          designedTransitionId: transitionItem.transition_id,
          observedEdgeId: null,
          summary: `Designed transition '${transitionItem.label}' was not present in observed metadata.`,
        }),
      );
    }
    if (observed && transitionItem.policy === "forbidden") {
      discrepancies.push(
        discrepancy({
          kind: "forbidden_edge_detected",
          transitionKey: key,
          designedTransitionId: transitionItem.transition_id,
          observedEdgeId: observed.observed_edge_id,
          summary: `Observed metadata matched forbidden transition '${transitionItem.label}'.`,
        }),
      );
    }
  }

  for (const observed of observedTransitions) {
    const key = observedTransitionKey(observed);
    if (!designedByKey.has(key)) {
      discrepancies.push(
        discrepancy({
          kind:
            observed.policy === "forbidden"
              ? "forbidden_edge_detected"
              : "observed_not_designed",
          transitionKey: key,
          designedTransitionId: null,
          observedEdgeId: observed.observed_edge_id,
          summary: `Observed transition '${key}' is not represented in the designed pipeline.`,
        }),
      );
    }
  }

  return {
    discrepancies: discrepancies.sort((left, right) =>
      left.discrepancy_id.localeCompare(right.discrepancy_id),
    ),
    designed_not_observed_count: discrepancies.filter(
      (item) => item.kind === "designed_not_observed",
    ).length,
    observed_not_designed_count: discrepancies.filter(
      (item) => item.kind === "observed_not_designed",
    ).length,
    forbidden_edge_detected_count: discrepancies.filter(
      (item) => item.kind === "forbidden_edge_detected",
    ).length,
    unknown_count: discrepancies.filter((item) => item.kind === "unknown")
      .length,
    graphify_data_source_only: true,
    graphify_governance_truth: false,
    metadata_only: true,
    read_only: true,
  };
}

export function buildPipelineViewModel(
  model = buildPipelineVisualizationModel(),
): PipelineViewModel {
  return {
    title: "Governed Pipeline",
    subtitle: "Capture -> Classify -> Route -> Human Gate -> Execute -> Audit",
    stages: model.stages.map((item) => {
      const boundaries = model.boundaries.filter((boundaryItem) =>
        boundaryItem.stage_ids.includes(item.stage_id),
      );
      const disabled = model.governance_overlay.disabled_features.filter(
        (feature) => feature.stage_ids.includes(item.stage_id),
      );
      return {
        stage_id: item.stage_id,
        label: item.label,
        description: item.description,
        status: item.status,
        governance_notes: [
          `${item.label} trust class: ${item.trust_class}.`,
          ...boundaries.map((boundaryItem) => boundaryItem.label),
        ],
        approval_gate_visible: boundaries.some(
          (boundaryItem) => boundaryItem.kind === "approval_boundary",
        ),
        execution_boundary_visible: boundaries.some(
          (boundaryItem) => boundaryItem.kind === "execution_boundary",
        ),
        disabled_feature_notes: disabled.map((feature) => feature.label),
      };
    }),
    edges: model.transitions.map((item) => ({
      transition_id: item.transition_id,
      from_stage_id: item.from_stage_id,
      to_stage_id: item.to_stage_id,
      label: item.label,
      policy: item.policy,
      visual_treatment:
        item.policy === "forbidden"
          ? "blocked"
          : item.policy === "gated"
            ? "guarded"
            : "normal",
      governance_note: item.governance_note,
    })),
    boundaries: model.boundaries.map((item) => ({
      boundary_id: item.boundary_id,
      label: item.label,
      kind: item.kind,
      description: item.description,
    })),
    controls: [],
    read_only: true,
    execute_affordance_present: false,
    approve_affordance_present: false,
    mutation_affordance_present: false,
  };
}

export function buildPipelineVisualizationCloseoutReport(): PipelineVisualizationCloseoutReport {
  const model = buildPipelineVisualizationModel();
  const discrepancySummary = buildPipelineDiscrepancySummary();
  const viewModel = buildPipelineViewModel(model);
  const componentChecks = {
    pipeline_model_exists: model.stages.length === PIPELINE_STAGE_IDS.length,
    governance_overlay_exists: model.governance_overlay.read_only,
    graphify_integration_exists: discrepancySummary.graphify_data_source_only,
    discrepancy_model_exists: discrepancySummary.read_only,
    view_model_exists: viewModel.read_only,
  };

  if (!Object.values(componentChecks).every(Boolean)) {
    throw new Error("Pipeline visualization closeout verification failed.");
  }

  return {
    closeout_version: PIPELINE_VISUALIZATION_VERSION,
    title: "Pipeline visualization complete as a read-only governance surface",
    status: "complete",
    components: {
      pipeline_model_exists: true,
      governance_overlay_exists: true,
      graphify_integration_exists: true,
      discrepancy_model_exists: true,
      view_model_exists: true,
    },
    prohibited_capabilities: {
      execution_surface_created: model.execution_surface_created,
      approval_surface_created: model.approval_surface_created,
      provider_calls_enabled: model.provider_call_enabled,
      network_calls_enabled: model.network_call_enabled,
      filesystem_writes_enabled: model.filesystem_write_enabled,
      telemetry_writes_enabled: model.telemetry_write_enabled,
      governance_replacement_enabled:
        model.governance_overlay.governance_replaced,
      authority_escalation_enabled: model.authority_escalation_enabled,
      graphify_execution_enabled: model.graph_driven_execution_enabled,
    },
    required_wording:
      "Pipeline visualization complete as a read-only governance surface",
    metadata_only: true,
    read_only: true,
  };
}

function observedTransitionsFromGraphify(
  overlay?: Pick<GraphifyOverlay, "edges" | "discrepancies">,
): PipelineObservedTransition[] {
  if (!overlay) return [];

  return overlay.edges.flatMap((edge) => {
    const parsed = parsePipelineKey(edge.label);
    if (!parsed) return [];
    return [
      {
        observed_edge_id: edge.overlay_edge_id,
        from_stage_id: parsed.from,
        to_stage_id: parsed.to,
        source: "graphify",
        metadata_only: true,
        read_only: true,
      },
    ];
  });
}

function transitionKey(transitionItem: PipelineTransition): string {
  return `${transitionItem.from_stage_id}->${transitionItem.to_stage_id}`;
}

function observedTransitionKey(transitionItem: PipelineObservedTransition) {
  return `${transitionItem.from_stage_id}->${transitionItem.to_stage_id}`;
}

function parsePipelineKey(
  value: string,
): { from: PipelineStageId; to: PipelineStageId } | null {
  const [from, to] = value.split("->").map((item) => item.trim());
  if (isPipelineStageId(from) && isPipelineStageId(to)) {
    return { from, to };
  }
  return null;
}

function isPipelineStageId(value: string): value is PipelineStageId {
  return (PIPELINE_STAGE_IDS as readonly string[]).includes(value);
}

function discrepancy(input: {
  kind: PipelineDiscrepancyKind;
  transitionKey: string;
  designedTransitionId: string | null;
  observedEdgeId: string | null;
  summary: string;
}): PipelineDiscrepancy {
  return {
    discrepancy_id: `pipeline-discrepancy:${slug(input.kind)}:${slug(input.transitionKey)}`,
    kind: input.kind,
    transition_key: input.transitionKey,
    designed_transition_id: input.designedTransitionId,
    observed_edge_id: input.observedEdgeId,
    summary: input.summary,
    metadata_only: true,
    read_only: true,
    remediation_executed: false,
  };
}

function slug(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function copy<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}
