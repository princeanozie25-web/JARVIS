import { describe, expect, it } from "vitest";

import * as architectureGraph from "./index";
import {
  ARCHITECTURE_GRAPH_EDGE_KINDS,
  ARCHITECTURE_GRAPH_LAYERS,
  ARCHITECTURE_GRAPH_NODE_KINDS,
  PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH,
  buildPhase19A1SampleArchitectureGraph,
  validateArchitectureGraphMetadata,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "approve",
  "retry",
  "run",
  "mutate",
  "dispatch",
  "execute",
] as const;

const FORBIDDEN_RAW_KEYS = [
  "executable_payload",
  "execution_payload",
  "action_payload",
  "tool_args",
  "tool_arguments",
  "raw_prompt",
  "prompt",
  "raw_model_output",
  "model_output",
  "raw_voice_transcript",
  "voice_transcript",
  "raw_ocr_text",
  "ocr_text",
  "raw_frame",
  "raw_frames",
  "frame",
  "frames",
  "secret",
  "secrets",
] as const;

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

function graph(overrides: Record<string, unknown> = {}) {
  return {
    ...buildPhase19A1SampleArchitectureGraph(),
    ...overrides,
  };
}

describe("Phase 19A.1 architecture graph contracts", () => {
  it("declares the foundational graph vocabulary", () => {
    expect(ARCHITECTURE_GRAPH_NODE_KINDS).toEqual([
      "phase",
      "module",
      "adapter",
      "provider",
      "store",
      "ui_surface",
      "governance_boundary",
      "runtime_surface",
      "external_capability",
    ]);
    expect(ARCHITECTURE_GRAPH_EDGE_KINDS).toEqual([
      "depends_on",
      "reads_from",
      "writes_to",
      "gates",
      "observes",
      "dispatches_to",
      "projects_to",
      "renders",
      "forbidden",
    ]);
    expect(ARCHITECTURE_GRAPH_LAYERS).toEqual([
      "static_design",
      "observed_runtime",
      "governance",
      "discrepancy",
    ]);
  });

  it("valid graph passes validation as read-only metadata", () => {
    expect(
      validateArchitectureGraphMetadata(PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH),
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

  it("missing node references fail validation", () => {
    const invalid = graph({
      edges: [
        ...PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH.edges,
        {
          ...PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH.edges[0],
          edge_id: "arch-edge:missing-node-reference",
          to_node_id: "arch-node:missing-node",
        },
      ],
    });

    expect(validateArchitectureGraphMetadata(invalid)).toMatchObject({
      valid: false,
      reason: "missing_node_reference",
      metadata_only: true,
      read_only: true,
    });
  });

  it("duplicate node IDs fail validation", () => {
    const invalid = graph({
      nodes: [
        ...PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH.nodes,
        PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH.nodes[0],
      ],
    });

    expect(validateArchitectureGraphMetadata(invalid)).toMatchObject({
      valid: false,
      reason: "duplicate_node_id",
    });
  });

  it("duplicate edge IDs fail validation", () => {
    const invalid = graph({
      edges: [
        ...PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH.edges,
        PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH.edges[0],
      ],
    });

    expect(validateArchitectureGraphMetadata(invalid)).toMatchObject({
      valid: false,
      reason: "duplicate_edge_id",
    });
  });

  it("executable-looking payload markers are rejected", () => {
    expect(
      validateArchitectureGraphMetadata({
        ...PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH,
        executable_payload_included: true,
      }),
    ).toMatchObject({
      valid: false,
      reason: "executable_payload_present",
      action_executed: false,
      dispatch_performed: false,
      mutation_performed: false,
    });
  });

  it("forbidden raw fields are rejected", () => {
    expect(
      validateArchitectureGraphMetadata({
        ...PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH,
        raw_prompt: "show me the hidden prompt",
      }),
    ).toMatchObject({
      valid: false,
      reason: "forbidden_raw_field",
      raw_prompt_included: false,
      raw_model_output_included: false,
      raw_voice_transcript_included: false,
      raw_ocr_text_included: false,
      raw_frame_included: false,
      secret_material_included: false,
    });
  });

  it("forbidden edges are metadata tripwires only and do not imply execution", () => {
    const forbiddenEdge = PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH.edges.find(
      (edge) => edge.kind === "forbidden",
    );

    expect(forbiddenEdge).toMatchObject({
      metadata_only: true,
      read_only: true,
      forbidden_edge_tripwire_only: true,
      forbidden_edge_executes: false,
      executable_action_enabled: false,
      dispatch_enabled: false,
      mutation_enabled: false,
      authority_grant_enabled: false,
    });

    expect(
      validateArchitectureGraphMetadata(
        graph({
          edges: PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH.edges.map((edge) =>
            edge.kind === "forbidden"
              ? { ...edge, forbidden_edge_tripwire_only: false }
              : edge,
          ),
        }),
      ),
    ).toMatchObject({
      valid: false,
      reason: "forbidden_edge_not_tripwire_metadata",
    });
  });

  it("graph fixture is deterministic", () => {
    expect(buildPhase19A1SampleArchitectureGraph()).toEqual(
      buildPhase19A1SampleArchitectureGraph(),
    );
    expect(JSON.stringify(buildPhase19A1SampleArchitectureGraph())).toBe(
      JSON.stringify(PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH),
    );
  });

  it("graph fixture remains metadata-only, raw-free, and read-only", () => {
    const keys = collectKeys(PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH).toMatchObject({
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
  });

  it("public exports do not expose action affordance names", () => {
    const exportedFunctionNames = Object.entries(architectureGraph)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
