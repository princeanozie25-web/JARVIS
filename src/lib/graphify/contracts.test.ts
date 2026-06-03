import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { getStaticArchitectureGraph } from "../architecture-graph";
import {
  GRAPHIFY_BASELINE_EDGE_KINDS,
  GRAPHIFY_NODE_KINDS,
  buildGraphifyOverlay,
  buildGraphifyOverlayCloseoutReport,
  normalizeGraphifyGraph,
  validateGraphifyGraph,
  type GraphifySource,
} from "./contracts";

const SOURCE: GraphifySource = {
  source_id: "jarvis-supplied-graph",
  source_kind: "graph_json",
  repo_path: "jarvis",
  generated_at: "2026-06-03T09:00:00.000Z",
  metadata_only: true,
  data_source_only: true,
};

function buildGraphifyFixture() {
  return {
    directed: true,
    multigraph: false,
    graph: {
      generated_by: "graphify",
      hyperedges: [
        {
          id: "hyperedge:command-model",
          nodes: ["Command Center", "Model Router"],
          relation: "groups",
        },
      ],
    },
    nodes: [
      {
        id: "Command Center",
        label: "Command Center",
        file_type: "code",
        source_file: "src/lib/command-center/index.ts",
      },
      {
        id: "Command Center",
        label: "Command Center",
        file_type: "code",
        source_file: "src/lib/command-center/index.ts",
      },
      {
        id: "Model Router",
        label: "Model Router",
        file_type: "code",
        source_file: "src/lib/models/router.ts",
      },
      {
        id: "Mystery Module",
        label: "Mystery Module",
        file_type: "strange-upstream-kind",
        source_file: "src/lib/mystery.ts",
      },
    ],
    edges: [
      {
        source: "Command Center",
        target: "Model Router",
        relation: "calls",
        confidence: "EXTRACTED",
        source_file: "src/lib/command-center/index.ts",
      },
      {
        source: "Command Center",
        target: "Model Router",
        relation: "calls",
        confidence: "EXTRACTED",
        source_file: "src/lib/command-center/index.ts",
      },
      {
        from: "Mystery Module",
        to: "Command Center",
        relation: "weird upstream relation",
        confidence: "ODD",
        source_file: "src/lib/mystery.ts",
      },
    ],
  };
}

describe("Graphify architecture overlay", () => {
  it("represents upstream-compatible node and edge concepts", () => {
    expect(GRAPHIFY_NODE_KINDS).toEqual([
      "code",
      "document",
      "paper",
      "image",
      "rationale",
      "concept",
      "unknown",
    ]);
    expect(GRAPHIFY_BASELINE_EDGE_KINDS).toEqual([
      "contains",
      "calls",
      "imports",
      "imports_from",
      "implements",
      "references",
      "uses",
      "instantiates",
      "method",
      "semantically_similar_to",
      "unknown",
    ]);
  });

  it("validates Graphify-compatible graph JSON and rejects malformed graphs", () => {
    expect(validateGraphifyGraph(buildGraphifyFixture())).toBe(true);
    expect(
      validateGraphifyGraph({
        nodes: [{ id: "A", label: "A", file_type: "code" }],
      }),
    ).toBe(false);
    expect(
      validateGraphifyGraph({
        nodes: [{ id: "A", label: "A", file_type: "code" }],
        edges: [{ source: "A", relation: "calls" }],
      }),
    ).toBe(false);
  });

  it("normalizes deterministically while deduplicating nodes and edges", () => {
    const normalized = normalizeGraphifyGraph({
      source: SOURCE,
      graph: buildGraphifyFixture(),
    });

    expect(normalized).toEqual(
      normalizeGraphifyGraph({ source: SOURCE, graph: buildGraphifyFixture() }),
    );
    expect(normalized.graph_id).toBe("graphify-graph:jarvis-supplied-graph");
    expect(normalized.metadata).toMatchObject({
      source_id: SOURCE.source_id,
      repo_path: "jarvis",
      graph_format: "networkx_node_link",
      data_source_only: true,
      runtime_execution_attempted: false,
      repository_mutation_attempted: false,
    });
    expect(normalized.nodes.map((node) => node.node_id)).toEqual([
      "command-center",
      "model-router",
      "mystery-module",
    ]);
    expect(normalized.edges.map((edge) => edge.edge_id)).toEqual([
      "graphify-edge:command-center:calls:model-router",
      "graphify-edge:mystery-module:weird_upstream_relation:command-center",
    ]);
    expect(normalized.hyperedges).toHaveLength(1);
    expect(normalized.summary).toEqual({
      node_count: 3,
      edge_count: 2,
      unknown_node_kind_count: 1,
      unknown_edge_kind_count: 1,
      extracted_edge_count: 1,
      inferred_edge_count: 0,
      ambiguous_edge_count: 0,
      metadata_only: true,
      read_only: true,
    });
  });

  it("marks unknown upstream node and edge kinds safely", () => {
    const normalized = normalizeGraphifyGraph({
      source: SOURCE,
      graph: buildGraphifyFixture(),
    });
    const mysteryNode = normalized.nodes.find(
      (node) => node.node_id === "mystery-module",
    );
    const mysteryEdge = normalized.edges.find((edge) =>
      edge.edge_id.includes("mystery-module"),
    );

    expect(mysteryNode).toMatchObject({
      node_kind: "unknown",
      raw_file_type: "strange-upstream-kind",
      unknown_kind: true,
      metadata_only: true,
      data_source_only: true,
    });
    expect(mysteryEdge).toMatchObject({
      relation: "weird upstream relation",
      normalized_relation: "weird_upstream_relation",
      confidence: "UNKNOWN",
      unknown_relation: true,
      metadata_only: true,
      data_source_only: true,
    });
  });

  it("builds a designed-vs-Graphify overlay and discrepancy summary", () => {
    const graphifyGraph = normalizeGraphifyGraph({
      source: SOURCE,
      graph: buildGraphifyFixture(),
    });
    const overlay = buildGraphifyOverlay({
      designedGraph: getStaticArchitectureGraph(),
      graphifyGraph,
      observedRuntime: {
        observed_node_ids: ["runtime-only-node"],
        observed_edge_ids: [],
      },
      coverage: [
        {
          node_id: "mystery-module",
          has_test_coverage: false,
          has_doc_coverage: false,
        },
      ],
    });

    expect(overlay).toEqual(
      buildGraphifyOverlay({
        designedGraph: getStaticArchitectureGraph(),
        graphifyGraph,
        observedRuntime: {
          observed_node_ids: ["runtime-only-node"],
          observed_edge_ids: [],
        },
        coverage: [
          {
            node_id: "mystery-module",
            has_test_coverage: false,
            has_doc_coverage: false,
          },
        ],
      }),
    );
    expect(overlay.graphify_is_governance_truth).toBe(false);
    expect(overlay.data_source_only).toBe(true);
    expect(overlay.execution_attempted).toBe(false);
    expect(overlay.mutation_attempted).toBe(false);
    expect(overlay.summary.designed_not_found_count).toBeGreaterThan(0);
    expect(overlay.summary.graphify_only_count).toBeGreaterThan(0);
    expect(overlay.summary.observed_not_designed_count).toBe(1);
    expect(overlay.summary.missing_test_coverage_count).toBe(1);
    expect(overlay.summary.undocumented_module_count).toBe(1);
    expect(overlay.discrepancies.map((item) => item.kind)).toEqual(
      expect.arrayContaining([
        "designed_not_found",
        "graphify_only",
        "observed_not_designed",
        "missing_test_coverage",
        "undocumented_module",
      ]),
    );
  });

  it("closes out as a read-only data source, not governance truth", () => {
    const report = buildGraphifyOverlayCloseoutReport();

    expect(report.title).toBe(
      "Graphify overlay complete as read-only architecture data source",
    );
    expect(report.components).toEqual([
      "graphify_source_contract",
      "graphify_normalization",
      "designed_vs_observed_overlay",
      "discrepancy_model",
    ]);
    expect(report.governance).toEqual({
      graphify_data_source_only: true,
      architecture_governance_truth_remains_authoritative: true,
      graphify_governance_truth: false,
      graphify_execution_supported: false,
      shell_execution_supported: false,
      repository_mutation_supported: false,
      filesystem_write_supported: false,
      database_write_supported: false,
      network_call_supported: false,
      provider_model_call_supported: false,
      telemetry_write_supported: false,
      ui_route_added: false,
      graph_driven_execution_supported: false,
      authority_escalation_supported: false,
    });
    expect(report.readme_safe_wording.join(" ")).toContain(
      "Graphify does not become governance truth",
    );
  });

  it("does not include execution, mutation, network, provider, telemetry, or UI affordances", () => {
    const source = readFileSync("src/lib/graphify/contracts.ts", "utf8");

    expect(source).not.toMatch(/from\s+["'](?:node:)?fs/);
    expect(source).not.toMatch(/from\s+["'](?:node:)?child_process/);
    expect(source).not.toMatch(
      /from\s+["'][^"']*(?:openai|anthropic|google|gemini|deepseek)/i,
    );
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\b(?:axios|WebSocket|XMLHttpRequest)\b/);
    expect(source).not.toMatch(/\b(?:exec|spawn|execa)\s*\(/);
    expect(source).not.toMatch(
      /\b(?:writeFile|appendFile|mkdir|rm|unlink)\s*\(/,
    );
    expect(source).not.toMatch(/\b(?:sqlite|better-sqlite3|db\.)\b/i);
    expect(source).not.toMatch(/\b(?:emit|record|write)Telemetry\b/i);
    expect(source).not.toMatch(/\b(?:route|page|GET|POST)\s*=/);
  });
});
