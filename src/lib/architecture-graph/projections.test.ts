import { describe, expect, it } from "vitest";

import * as architectureGraph from "./index";
import {
  ArchitectureGraphProjectionSchema,
  buildArchitectureGraphProjection,
  buildArchitectureGraphProjectionForNode,
  buildArchitectureGraphProjectionStats,
  listArchitectureGraphProjectionWarnings,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "execute",
  "retry",
  "approve",
  "run",
  "mutate",
  "dispatch",
  "callTool",
] as const;

const FORBIDDEN_OUTPUT_KEYS = [
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
  "execute",
  "retry",
  "approve",
  "run",
  "mutate",
  "dispatch",
  "callTool",
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

describe("Phase 19A.4 architecture graph projection contract", () => {
  it("builds and validates the full projection", () => {
    const projection = buildArchitectureGraphProjection();

    expect(
      ArchitectureGraphProjectionSchema.safeParse(projection).success,
    ).toBe(true);
    expect(projection).toMatchObject({
      contract_version: "19A.4",
      projection_id: "architecture-graph-projection:static-full",
      scope: "full_graph",
      focus_node_id: null,
      metadata_only: true,
      read_only: true,
      ui_safe: true,
      underlying_graph_validated: true,
      raw_fields_exposed: false,
      action_affordances_exposed: false,
    });
  });

  it("contains expected projection groups", () => {
    expect(
      buildArchitectureGraphProjection().groups.map((group) => group.id),
    ).toEqual([
      "phases",
      "data",
      "runtime",
      "governance",
      "surfaces",
      "modules",
      "adapters",
    ]);
  });

  it("projection stats are stable", () => {
    expect(buildArchitectureGraphProjectionStats()).toEqual({
      node_count: 28,
      edge_count: 18,
      forbidden_edge_count: 6,
      governance_edge_count: 9,
      read_edge_count: 4,
      write_edge_count: 4,
      static_edge_count: 9,
      observed_edge_count: 0,
      discrepancy_count: 0,
      metadata_only: true,
      read_only: true,
    });
  });

  it("projection warnings include forbidden tripwire edges", () => {
    expect(
      listArchitectureGraphProjectionWarnings().map((warning) => warning.id),
    ).toEqual([
      "arch-warning:voice-runtime-forbidden-approve-actions",
      "arch-warning:vision-runtime-forbidden-room-actions",
      "arch-warning:scheduler-forbidden-execute-tools",
      "arch-warning:command-center-forbidden-mutate-state",
      "arch-warning:architecture-graph-forbidden-execute-traces",
      "arch-warning:observability-surfaces-forbidden-live-store-write",
    ]);

    for (const warning of listArchitectureGraphProjectionWarnings()) {
      expect(warning).toMatchObject({
        policy_status: "tripwire",
        severity: "warning",
        tripwire: true,
        metadata_only: true,
        read_only: true,
      });
    }
  });

  it("node-specific projection scopes to the focus neighborhood", () => {
    const projection = buildArchitectureGraphProjectionForNode(
      "arch-node:command-center",
    );

    expect(projection).toMatchObject({
      scope: "node_focus",
      focus_node_id: "arch-node:command-center",
      stats: {
        node_count: 3,
        edge_count: 2,
        forbidden_edge_count: 1,
        governance_edge_count: 1,
        read_edge_count: 1,
        write_edge_count: 0,
      },
    });
    expect(projection?.nodes.map((node) => node.id)).toEqual([
      "arch-node:event-store",
      "arch-node:observability-api",
      "arch-node:command-center",
    ]);
    expect(projection?.edges.map((edge) => edge.id)).toEqual([
      "arch-edge:command-center-reads-observability-api",
      "arch-edge:command-center-forbidden-mutate-state",
    ]);
  });

  it("unknown node-specific projection fails closed", () => {
    expect(
      buildArchitectureGraphProjectionForNode("arch-node:missing"),
    ).toBeNull();
  });

  it("projection output is deterministic", () => {
    expect(JSON.stringify(buildArchitectureGraphProjection())).toBe(
      JSON.stringify(buildArchitectureGraphProjection()),
    );
    expect(
      JSON.stringify(
        buildArchitectureGraphProjectionForNode("arch-node:command-center"),
      ),
    ).toBe(
      JSON.stringify(
        buildArchitectureGraphProjectionForNode("arch-node:command-center"),
      ),
    );
  });

  it("projection output is defensive-copy-safe", () => {
    const projection = buildArchitectureGraphProjection();
    projection.nodes[0].label = "Mutated Projection Node";
    projection.edges[0].label = "Mutated Projection Edge";
    projection.warnings[0].label = "Mutated Warning";

    const freshProjection = buildArchitectureGraphProjection();
    expect(freshProjection.nodes[0]).toMatchObject({
      id: "arch-node:phase-10-room-os-foundation",
      label: "Phase 10 Room OS Foundation",
    });
    expect(freshProjection.edges[0]).toMatchObject({
      id: "arch-edge:command-center-reads-observability-api",
      label: "Command Center reads Observability API",
    });
    expect(freshProjection.warnings[0]).toMatchObject({
      id: "arch-warning:voice-runtime-forbidden-approve-actions",
      label: "Voice Runtime must not approve actions",
    });
  });

  it("projection output contains no executable-looking or raw fields", () => {
    const keys = collectKeys(buildArchitectureGraphProjection());

    for (const key of FORBIDDEN_OUTPUT_KEYS) {
      expect(keys).not.toContain(key);
    }
  });

  it("projection exports no execute/retry/approve/run/mutate/dispatch/tool-call affordance names", () => {
    const exportedFunctionNames = Object.entries(architectureGraph)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
