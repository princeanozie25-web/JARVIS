import { describe, expect, it } from "vitest";
import type { GraphifyOverlay } from "../graphify";
import {
  PIPELINE_STAGE_IDS,
  buildPipelineDiscrepancySummary,
  buildPipelineGovernanceOverlay,
  buildPipelineViewModel,
  buildPipelineVisualizationCloseoutReport,
  buildPipelineVisualizationModel,
  summarizePipelineVisualization,
  type PipelineObservedTransition,
} from "./index";

describe("Phase 21K governed pipeline visualization", () => {
  it("builds every required pipeline stage and validates transition policies", () => {
    const model = buildPipelineVisualizationModel();

    expect(model.stages.map((stage) => stage.stage_id)).toEqual([
      "capture",
      "classify",
      "route",
      "human_gate",
      "execute",
      "audit",
    ]);
    expect(model.stages).toHaveLength(PIPELINE_STAGE_IDS.length);
    expect(model.transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from_stage_id: "capture",
          to_stage_id: "classify",
          policy: "allowed",
        }),
        expect.objectContaining({
          from_stage_id: "route",
          to_stage_id: "human_gate",
          policy: "gated",
        }),
        expect.objectContaining({
          from_stage_id: "route",
          to_stage_id: "execute",
          policy: "forbidden",
        }),
      ]),
    );

    for (const transition of model.transitions) {
      expect(transition.metadata_only).toBe(true);
      expect(transition.read_only).toBe(true);
      expect(transition.executable_action_enabled).toBe(false);
      expect(transition.approval_action_enabled).toBe(false);
      expect(transition.mutation_enabled).toBe(false);
      expect(transition.provider_call_enabled).toBe(false);
    }
  });

  it("builds governance overlay metadata for approvals, disabled capabilities, trust classes, and authority surfaces", () => {
    const overlay = buildPipelineGovernanceOverlay();

    expect(overlay.approval_lifecycle).toEqual([
      "proposal",
      "review",
      "decision_record",
      "authority_token_metadata",
      "execution_plan_metadata",
      "verification_metadata",
      "audit_metadata",
    ]);
    expect(
      overlay.disabled_features.map((feature) => feature.feature_id),
    ).toEqual(
      expect.arrayContaining([
        "pipeline-disabled:auto-execute",
        "pipeline-disabled:graphify-execution",
        "pipeline-disabled:visualizer-approval-controls",
      ]),
    );
    expect(
      overlay.authority_surfaces.every(
        (surface) => surface.authority_created_by_visualization === false,
      ),
    ).toBe(true);
    expect(overlay.graphify_governance_truth).toBe(false);
    expect(overlay.governance_replaced).toBe(false);
  });

  it("summarizes the visualization model deterministically", () => {
    const model = buildPipelineVisualizationModel();
    const summary = summarizePipelineVisualization(model);

    expect(summary).toEqual({
      stage_count: 6,
      transition_count: 9,
      allowed_transition_count: 3,
      gated_transition_count: 2,
      forbidden_transition_count: 4,
      boundary_count: 5,
      disabled_feature_count: 3,
      governance_posture: "read_only_governance_visualization",
      metadata_only: true,
      read_only: true,
    });
    expect(model.summary).toEqual(summary);
  });

  it("compares designed and observed transitions and detects forbidden observed edges", () => {
    const observed: PipelineObservedTransition[] = [
      {
        observed_edge_id: "observed:capture-classify",
        from_stage_id: "capture",
        to_stage_id: "classify",
        source: "manual_supplied",
        metadata_only: true,
        read_only: true,
      },
      {
        observed_edge_id: "observed:route-execute",
        from_stage_id: "route",
        to_stage_id: "execute",
        source: "manual_supplied",
        metadata_only: true,
        read_only: true,
      },
      {
        observed_edge_id: "observed:classify-audit",
        from_stage_id: "classify",
        to_stage_id: "audit",
        source: "manual_supplied",
        metadata_only: true,
        read_only: true,
      },
    ];

    const summary = buildPipelineDiscrepancySummary({
      observedTransitions: observed,
    });

    expect(summary.graphify_data_source_only).toBe(true);
    expect(summary.graphify_governance_truth).toBe(false);
    expect(summary.forbidden_edge_detected_count).toBeGreaterThanOrEqual(1);
    expect(summary.observed_not_designed_count).toBeGreaterThanOrEqual(1);
    expect(summary.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "forbidden_edge_detected",
          transition_key: "route->execute",
          observed_edge_id: "observed:route-execute",
          remediation_executed: false,
        }),
        expect.objectContaining({
          kind: "observed_not_designed",
          transition_key: "classify->audit",
          observed_edge_id: "observed:classify-audit",
          remediation_executed: false,
        }),
      ]),
    );
  });

  it("uses Graphify overlay as data source only for observed pipeline metadata", () => {
    const graphifyOverlay = {
      edges: [
        {
          overlay_edge_id: "graphify-overlay-edge:capture-classify",
          label: "capture->classify",
          design_edge_id: null,
          graphify_edge_id: "graphify-edge:capture-classify",
          present_in_design: false,
          present_in_graphify: true,
          present_in_observed: true,
          metadata_only: true,
        },
        {
          overlay_edge_id: "graphify-overlay-edge:capture-execute",
          label: "capture->execute",
          design_edge_id: null,
          graphify_edge_id: "graphify-edge:capture-execute",
          present_in_design: false,
          present_in_graphify: true,
          present_in_observed: true,
          metadata_only: true,
        },
      ],
      discrepancies: [],
    } as Pick<GraphifyOverlay, "edges" | "discrepancies">;

    const summary = buildPipelineDiscrepancySummary({ graphifyOverlay });

    expect(summary.graphify_data_source_only).toBe(true);
    expect(summary.graphify_governance_truth).toBe(false);
    expect(summary.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "forbidden_edge_detected",
          transition_key: "capture->execute",
          observed_edge_id: "graphify-overlay-edge:capture-execute",
        }),
      ]),
    );
  });

  it("builds a presentation-ready read-only view model without execute or approve affordances", () => {
    const viewModel = buildPipelineViewModel();
    const serialized = JSON.stringify(viewModel);

    expect(viewModel.read_only).toBe(true);
    expect(viewModel.controls).toEqual([]);
    expect(viewModel.execute_affordance_present).toBe(false);
    expect(viewModel.approve_affordance_present).toBe(false);
    expect(viewModel.mutation_affordance_present).toBe(false);
    const humanGateStage = viewModel.stages.find(
      (stage) => stage.stage_id === "human_gate",
    );
    const executeStage = viewModel.stages.find(
      (stage) => stage.stage_id === "execute",
    );

    expect(humanGateStage?.approval_gate_visible).toBe(true);
    expect(executeStage?.execution_boundary_visible).toBe(true);
    expect(serialized).not.toContain("onClick");
    expect(serialized).not.toContain("executeButton");
    expect(serialized).not.toContain("approveButton");
  });

  it("builds a closeout report proving required components exist and prohibited capabilities are absent", () => {
    const report = buildPipelineVisualizationCloseoutReport();

    expect(report.title).toBe(
      "Pipeline visualization complete as a read-only governance surface",
    );
    expect(report.required_wording).toBe(
      "Pipeline visualization complete as a read-only governance surface",
    );
    expect(Object.values(report.components).every(Boolean)).toBe(true);
    expect(report.prohibited_capabilities).toEqual({
      execution_surface_created: false,
      approval_surface_created: false,
      provider_calls_enabled: false,
      network_calls_enabled: false,
      filesystem_writes_enabled: false,
      telemetry_writes_enabled: false,
      governance_replacement_enabled: false,
      authority_escalation_enabled: false,
      graphify_execution_enabled: false,
    });
    expect(report.metadata_only).toBe(true);
    expect(report.read_only).toBe(true);
  });

  it("globally exposes no provider, network, execution, mutation, or authority escalation paths", () => {
    const model = buildPipelineVisualizationModel();
    const viewModel = buildPipelineViewModel(model);
    const report = buildPipelineVisualizationCloseoutReport();
    const serialized = JSON.stringify({ model, viewModel, report });

    expect(serialized).not.toContain("fetch(");
    expect(serialized).not.toContain("provider.call");
    expect(serialized).not.toContain("execute(");
    expect(serialized).not.toContain("mutate(");
    expect(serialized).not.toContain('authority_escalation_enabled":true');
    expect(model.execution_surface_created).toBe(false);
    expect(model.approval_surface_created).toBe(false);
    expect(model.graph_driven_execution_enabled).toBe(false);
    expect(model.network_call_enabled).toBe(false);
    expect(model.filesystem_write_enabled).toBe(false);
    expect(model.telemetry_write_enabled).toBe(false);
  });
});
