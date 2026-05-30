import { describe, expect, it } from "vitest";

import * as architectureGraph from "./index";
import {
  getArchitectureGraphEdgesForNode,
  getArchitectureGraphNodeById,
  getStaticArchitectureGraph,
  listArchitectureGraphEdges,
  listArchitectureGraphNodes,
  validateArchitectureGraphMetadata,
} from "./index";

const REQUIRED_SUBSYSTEM_NODE_IDS = [
  "arch-node:phase-10-room-os-foundation",
  "arch-node:phase-11-persistence-event-store",
  "arch-node:phase-12-command-center-ui",
  "arch-node:phase-13-model-runtime",
  "arch-node:phase-14-voice-runtime",
  "arch-node:phase-15-vision-runtime",
  "arch-node:phase-16-room-adapter-runtime",
  "arch-node:phase-17-scheduled-assistance-runtime",
  "arch-node:phase-18-approval-runtime",
  "arch-node:phase-19-architecture-graph",
] as const;

const REQUIRED_CORE_NODE_IDS = [
  "arch-node:event-store",
  "arch-node:read-only-projections",
  "arch-node:observability-api",
  "arch-node:command-center",
  "arch-node:model-router",
  "arch-node:voice-runtime",
  "arch-node:vision-runtime",
  "arch-node:room-registry",
  "arch-node:room-adapters",
  "arch-node:scheduler",
  "arch-node:approval-runtime",
  "arch-node:tool-runtime",
  "arch-node:telemetry-redactor",
  "arch-node:audit-preview",
  "arch-node:architecture-graph",
] as const;

const REQUIRED_DESIGNED_EDGE_IDS = [
  "arch-edge:command-center-reads-observability-api",
  "arch-edge:observability-api-reads-projections",
  "arch-edge:projections-read-event-store",
  "arch-edge:model-router-writes-model-call-metadata",
  "arch-edge:voice-runtime-routes-text-runtime-boundary",
  "arch-edge:vision-runtime-emits-metadata-observations",
  "arch-edge:room-adapters-emit-room-event-metadata",
  "arch-edge:scheduler-emits-suggestion-metadata",
  "arch-edge:approval-runtime-gates-tool-runtime",
  "arch-edge:tool-runtime-requires-approval-runtime",
  "arch-edge:telemetry-redactor-gates-ui-projections",
  "arch-edge:architecture-graph-reads-metadata-projections",
] as const;

const REQUIRED_FORBIDDEN_EDGE_IDS = [
  "arch-edge:voice-runtime-forbidden-approve-actions",
  "arch-edge:vision-runtime-forbidden-room-actions",
  "arch-edge:scheduler-forbidden-execute-tools",
  "arch-edge:command-center-forbidden-mutate-state",
  "arch-edge:architecture-graph-forbidden-execute-traces",
  "arch-edge:observability-surfaces-forbidden-live-store-write",
] as const;

const FORBIDDEN_EXPORT_NAMES = [
  "approve",
  "retry",
  "run",
  "mutate",
  "dispatch",
  "execute",
  "callTool",
] as const;

function ids(
  values: readonly { readonly node_id?: string; readonly edge_id?: string }[],
) {
  return values.map((value) => value.node_id ?? value.edge_id);
}

describe("Phase 19A.2 static architecture graph registry", () => {
  it("static graph validates through Phase 19A.1 graph validation", () => {
    expect(
      validateArchitectureGraphMetadata(getStaticArchitectureGraph()),
    ).toMatchObject({
      valid: true,
      reason: "valid_architecture_graph_metadata",
      metadata_only: true,
      read_only: true,
      filesystem_read: false,
      database_read: false,
      telemetry_ingested: false,
      runtime_observer_created: false,
      action_executed: false,
      dispatch_performed: false,
      mutation_performed: false,
      authority_surface_created: false,
    });
  });

  it("includes expected major subsystem and core module nodes", () => {
    const nodeIds = listArchitectureGraphNodes().map((node) => node.node_id);

    for (const nodeId of [
      ...REQUIRED_SUBSYSTEM_NODE_IDS,
      ...REQUIRED_CORE_NODE_IDS,
    ]) {
      expect(nodeIds).toContain(nodeId);
    }
  });

  it("includes expected designed static edges", () => {
    const edgeIds = listArchitectureGraphEdges().map((edge) => edge.edge_id);

    for (const edgeId of REQUIRED_DESIGNED_EDGE_IDS) {
      expect(edgeIds).toContain(edgeId);
    }
  });

  it("represents forbidden edges as inert metadata tripwires only", () => {
    const forbiddenEdges = listArchitectureGraphEdges().filter(
      (edge) => edge.kind === "forbidden",
    );
    expect(forbiddenEdges.map((edge) => edge.edge_id)).toEqual(
      REQUIRED_FORBIDDEN_EDGE_IDS,
    );

    for (const edge of forbiddenEdges) {
      expect(edge).toMatchObject({
        metadata_only: true,
        read_only: true,
        forbidden_edge_tripwire_only: true,
        forbidden_edge_executes: false,
        executable_action_enabled: false,
        dispatch_enabled: false,
        mutation_enabled: false,
        authority_grant_enabled: false,
      });
    }
  });

  it("uses deterministic graph ordering and IDs", () => {
    expect(ids(getStaticArchitectureGraph().nodes)).toEqual(
      ids(getStaticArchitectureGraph().nodes),
    );
    expect(ids(getStaticArchitectureGraph().edges)).toEqual(
      ids(getStaticArchitectureGraph().edges),
    );
    expect(JSON.stringify(getStaticArchitectureGraph())).toBe(
      JSON.stringify(getStaticArchitectureGraph()),
    );
  });

  it("registry node lookup returns defensive-copy-safe data", () => {
    const node = getArchitectureGraphNodeById("arch-node:command-center");
    expect(node).toMatchObject({
      node_id: "arch-node:command-center",
      label: "Command Center",
      metadata_only: true,
      read_only: true,
    });

    if (node) {
      node.label = "Mutated By Test";
    }

    expect(
      getArchitectureGraphNodeById("arch-node:command-center"),
    ).toMatchObject({
      node_id: "arch-node:command-center",
      label: "Command Center",
    });
    expect(getArchitectureGraphNodeById("arch-node:missing")).toBeNull();
  });

  it("registry graph and edge lookups return defensive-copy-safe data", () => {
    const graph = getStaticArchitectureGraph();
    graph.nodes[0].label = "Mutated Graph Copy";

    expect(getStaticArchitectureGraph().nodes[0]).toMatchObject({
      node_id: "arch-node:phase-10-room-os-foundation",
      label: "Phase 10 Room OS Foundation",
    });

    const commandCenterEdges = getArchitectureGraphEdgesForNode(
      "arch-node:command-center",
    );
    expect(commandCenterEdges.map((edge) => edge.edge_id)).toEqual([
      "arch-edge:command-center-reads-observability-api",
      "arch-edge:command-center-forbidden-mutate-state",
    ]);
    commandCenterEdges[0].label = "Mutated Edge Copy";

    expect(
      getArchitectureGraphEdgesForNode("arch-node:command-center")[0],
    ).toMatchObject({
      edge_id: "arch-edge:command-center-reads-observability-api",
      label: "Command Center reads Observability API",
    });
  });

  it("does not introduce filesystem, database, telemetry, or runtime observer dependency metadata", () => {
    expect(getStaticArchitectureGraph()).toMatchObject({
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
  });

  it("exports no executable or action affordance names", () => {
    const exportedFunctionNames = Object.entries(architectureGraph)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
