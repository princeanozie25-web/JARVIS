import { describe, expect, it } from "vitest";

import * as architectureGraph from "./index";
import {
  findArchitecturePath,
  getArchitectureNodeDependencies,
  getArchitectureNodeDependents,
  getArchitectureNodeForbiddenEdges,
  getArchitectureNodeGovernanceEdges,
  getArchitectureNodeInboundEdges,
  getArchitectureNodeOutboundEdges,
  getArchitectureNodeReadEdges,
  getArchitectureNodeWriteEdges,
  summarizeArchitectureNode,
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

describe("Phase 19A.3 architecture graph query helpers", () => {
  it("returns dependencies and dependents for known nodes", () => {
    expect(
      getArchitectureNodeDependencies("arch-node:command-center").map(
        (node) => node.node_id,
      ),
    ).toEqual(["arch-node:observability-api"]);
    expect(
      getArchitectureNodeDependents("arch-node:event-store").map(
        (node) => node.node_id,
      ),
    ).toEqual([
      "arch-node:read-only-projections",
      "arch-node:model-router",
      "arch-node:vision-runtime",
      "arch-node:room-adapters",
      "arch-node:scheduler",
    ]);
  });

  it("returns inbound and outbound edges in deterministic registry order", () => {
    expect(
      getArchitectureNodeOutboundEdges("arch-node:command-center").map(
        (edge) => edge.edge_id,
      ),
    ).toEqual([
      "arch-edge:command-center-reads-observability-api",
      "arch-edge:command-center-forbidden-mutate-state",
    ]);
    expect(
      getArchitectureNodeInboundEdges("arch-node:event-store").map(
        (edge) => edge.edge_id,
      ),
    ).toEqual([
      "arch-edge:projections-read-event-store",
      "arch-edge:model-router-writes-model-call-metadata",
      "arch-edge:vision-runtime-emits-metadata-observations",
      "arch-edge:room-adapters-emit-room-event-metadata",
      "arch-edge:scheduler-emits-suggestion-metadata",
      "arch-edge:command-center-forbidden-mutate-state",
      "arch-edge:observability-surfaces-forbidden-live-store-write",
    ]);
  });

  it("exposes forbidden edges as inert tripwire metadata", () => {
    const forbiddenEdges = getArchitectureNodeForbiddenEdges(
      "arch-node:voice-runtime",
    );

    expect(forbiddenEdges.map((edge) => edge.edge_id)).toEqual([
      "arch-edge:voice-runtime-forbidden-approve-actions",
    ]);
    expect(forbiddenEdges[0]).toMatchObject({
      kind: "forbidden",
      metadata_only: true,
      read_only: true,
      forbidden_edge_tripwire_only: true,
      forbidden_edge_executes: false,
      executable_action_enabled: false,
      dispatch_enabled: false,
      mutation_enabled: false,
      authority_grant_enabled: false,
    });
  });

  it("filters governance, read, and write edges", () => {
    expect(
      getArchitectureNodeGovernanceEdges("arch-node:approval-runtime").map(
        (edge) => edge.edge_id,
      ),
    ).toEqual([
      "arch-edge:approval-runtime-gates-tool-runtime",
      "arch-edge:tool-runtime-requires-approval-runtime",
      "arch-edge:voice-runtime-forbidden-approve-actions",
    ]);
    expect(
      getArchitectureNodeReadEdges("arch-node:observability-api").map(
        (edge) => edge.edge_id,
      ),
    ).toEqual([
      "arch-edge:command-center-reads-observability-api",
      "arch-edge:observability-api-reads-projections",
    ]);
    expect(
      getArchitectureNodeWriteEdges("arch-node:event-store").map(
        (edge) => edge.edge_id,
      ),
    ).toEqual([
      "arch-edge:model-router-writes-model-call-metadata",
      "arch-edge:vision-runtime-emits-metadata-observations",
      "arch-edge:room-adapters-emit-room-event-metadata",
      "arch-edge:scheduler-emits-suggestion-metadata",
    ]);
  });

  it("fails closed for unknown node IDs", () => {
    expect(getArchitectureNodeDependencies("arch-node:missing")).toEqual([]);
    expect(getArchitectureNodeDependents("arch-node:missing")).toEqual([]);
    expect(getArchitectureNodeInboundEdges("arch-node:missing")).toEqual([]);
    expect(getArchitectureNodeOutboundEdges("arch-node:missing")).toEqual([]);
    expect(getArchitectureNodeForbiddenEdges("arch-node:missing")).toEqual([]);
    expect(getArchitectureNodeGovernanceEdges("arch-node:missing")).toEqual([]);
    expect(getArchitectureNodeReadEdges("arch-node:missing")).toEqual([]);
    expect(getArchitectureNodeWriteEdges("arch-node:missing")).toEqual([]);
    expect(summarizeArchitectureNode("arch-node:missing")).toBeNull();
    expect(
      findArchitecturePath("arch-node:missing", "arch-node:event-store"),
    ).toMatchObject({
      found: false,
      node_ids: [],
      edge_ids: [],
      metadata_only: true,
      read_only: true,
      action_executed: false,
      dispatch_performed: false,
      mutation_performed: false,
    });
  });

  it("returned node and edge data is defensive-copy-safe", () => {
    const dependencies = getArchitectureNodeDependencies(
      "arch-node:command-center",
    );
    dependencies[0].label = "Mutated Dependency";
    expect(
      getArchitectureNodeDependencies("arch-node:command-center")[0],
    ).toMatchObject({
      node_id: "arch-node:observability-api",
      label: "Observability API",
    });

    const outboundEdges = getArchitectureNodeOutboundEdges(
      "arch-node:command-center",
    );
    outboundEdges[0].label = "Mutated Edge";
    expect(
      getArchitectureNodeOutboundEdges("arch-node:command-center")[0],
    ).toMatchObject({
      edge_id: "arch-edge:command-center-reads-observability-api",
      label: "Command Center reads Observability API",
    });
  });

  it("path finding excludes forbidden edges by default", () => {
    expect(
      findArchitecturePath(
        "arch-node:architecture-graph",
        "arch-node:tool-runtime",
      ),
    ).toMatchObject({
      found: false,
      node_ids: [],
      edge_ids: [],
      forbidden_edges_included: false,
      metadata_only: true,
      read_only: true,
      executable_payload_included: false,
    });

    expect(
      findArchitecturePath(
        "arch-node:architecture-graph",
        "arch-node:tool-runtime",
        { includeForbiddenEdges: true },
      ),
    ).toMatchObject({
      found: true,
      node_ids: ["arch-node:architecture-graph", "arch-node:tool-runtime"],
      edge_ids: ["arch-edge:architecture-graph-forbidden-execute-traces"],
      forbidden_edges_included: true,
      action_executed: false,
      dispatch_performed: false,
      mutation_performed: false,
      authority_surface_created: false,
    });
  });

  it("path finding remains bounded and deterministic", () => {
    expect(
      findArchitecturePath("arch-node:command-center", "arch-node:event-store"),
    ).toMatchObject({
      found: true,
      node_ids: [
        "arch-node:command-center",
        "arch-node:observability-api",
        "arch-node:read-only-projections",
        "arch-node:event-store",
      ],
      edge_ids: [
        "arch-edge:command-center-reads-observability-api",
        "arch-edge:observability-api-reads-projections",
        "arch-edge:projections-read-event-store",
      ],
      max_depth: 6,
      bounded: true,
    });
    expect(
      findArchitecturePath(
        "arch-node:command-center",
        "arch-node:event-store",
        { maxDepth: 1 },
      ),
    ).toMatchObject({
      found: false,
      node_ids: [],
      edge_ids: [],
      max_depth: 1,
    });
    expect(
      findArchitecturePath(
        "arch-node:command-center",
        "arch-node:event-store",
        { maxDepth: 99 },
      ).max_depth,
    ).toBe(8);
  });

  it("summary counts are stable and metadata-only", () => {
    expect(summarizeArchitectureNode("arch-node:command-center")).toMatchObject(
      {
        node: {
          node_id: "arch-node:command-center",
          label: "Command Center",
        },
        inbound_edge_count: 0,
        outbound_edge_count: 2,
        dependency_count: 1,
        dependent_count: 0,
        forbidden_edge_count: 1,
        governance_edge_count: 1,
        read_edge_count: 1,
        write_edge_count: 0,
        health: {
          metadata_only: true,
          read_only: true,
        },
        recent_activity_summary: {
          observed_write_count: 0,
          observed_dispatch_count: 0,
          observed_execution_count: 0,
          telemetry_ingested: false,
        },
        metadata_only: true,
        read_only: true,
        execution_inferred: false,
        action_executed: false,
        dispatch_performed: false,
        mutation_performed: false,
      },
    );
  });

  it("exports no execute/retry/approve/run/mutate/dispatch affordance names", () => {
    const exportedFunctionNames = Object.entries(architectureGraph)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
