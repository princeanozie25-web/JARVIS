import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ArchitectureGraphViewer,
  buildArchitectureGraphViewerModel,
  buildArchitectureGraphViewerState,
} from "./ArchitectureGraphViewer";

const COMPONENT_SOURCE =
  "src/components/architecture-graph/ArchitectureGraphViewer.tsx";

function renderViewer() {
  return renderToStaticMarkup(<ArchitectureGraphViewer />);
}

function assertNoForbiddenAffordances(html: string) {
  expect(html).not.toMatch(
    /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i,
  );
}

describe("Phase 19A.7 architecture graph viewer surface", () => {
  it("renders the read-only architecture graph surface", () => {
    const html = renderViewer();

    expect(html).toContain('data-architecture-graph-viewer="read-only"');
    expect(html).toContain('data-metadata-only="true"');
    expect(html).toContain('data-read-only="true"');
    expect(html).toContain("Architecture Graph");
    expect(html).toContain("Phase 19A visibility surface");
    expect(html).toContain("Read-only subsystem map");
    expect(html).toContain('data-architecture-graph-controls="safe-read-only"');
    assertNoForbiddenAffordances(html);
  });

  it("renders projection stats and graph data", () => {
    const html = renderViewer();

    expect(html).toContain("Nodes");
    expect(html).toContain("28");
    expect(html).toContain("Edges");
    expect(html).toContain("18");
    expect(html).toContain("Tripwires");
    expect(html).toContain("6");
    expect(html).toContain("Command Center");
    expect(html).toContain("Event Store");
    expect(html).toContain("Approval Runtime gates Tool Runtime");
  });

  it("renders node groups, edges, legend, and dependency summaries", () => {
    const html = renderViewer();

    expect(html).toContain("Phases");
    expect(html).toContain("Governance");
    expect(html).toContain("Surfaces");
    expect(html).toContain("Legend");
    expect(html).toContain("Read path");
    expect(html).toContain("Projection path");
    expect(html).toContain("Tripwire Warnings");
    expect(html).toContain("Dependency");
    expect(html).toContain("Used by");
    expect(html).toContain("Find node");
    expect(html).toContain("Edge path");
    expect(html).toContain("Show tripwires");
  });

  it("renders the selected node detail panel", () => {
    const html = renderViewer();

    expect(html).toContain("Selected node");
    expect(html).toContain(
      'data-selected-node-id="arch-node:approval-runtime"',
    );
    expect(html).toContain("Inbound edges");
    expect(html).toContain("Outbound edges");
    expect(html).toContain("Governance edges");
    expect(html).toContain("Tripwire edges");
  });

  it("renders warning tripwires as warnings only", () => {
    const html = renderViewer();

    expect(html).toContain("Voice Runtime approval tripwire");
    expect(html).toContain("Scheduler side-effect tripwire");
    expect(html).toContain("Architecture Graph trace tripwire");
    expect(html).toContain("warning only");
    expect(html).not.toContain("Voice Runtime must not approve actions");
    expect(html).not.toContain("Scheduler must not execute tools");
    expect(html).not.toContain("Architecture Graph must not execute traces");
    assertNoForbiddenAffordances(html);
  });

  it("does not render raw payload fields or sensitive content classes", () => {
    const html = renderViewer();

    expect(html).not.toMatch(
      /raw_payload|tool_args|tool_arguments|raw_prompt|prompt body|model output|voice transcript|ocr text|frame bytes|secret|api key|approval token/i,
    );
  });

  it("uses the projection safety guard before exposing the render model", () => {
    const model = buildArchitectureGraphViewerModel();
    const source = readFileSync(COMPONENT_SOURCE, "utf8");

    expect(model.projection_safety_checked).toBe(true);
    expect(model.metadata_only).toBe(true);
    expect(model.read_only).toBe(true);
    expect(source).toContain(
      "assertArchitectureGraphProjectionSafe(projection)",
    );
  });

  it("selects a node and exposes dependencies and dependents in detail metadata", () => {
    const model = buildArchitectureGraphViewerModel();
    const state = buildArchitectureGraphViewerState(model, {
      selectedNodeId: "arch-node:command-center",
    });

    expect(state.selected_node_id).toBe("arch-node:command-center");
    expect(state.selected_detail.node.label).toBe("Command Center");
    expect(state.selected_detail.dependencies).toContain("Observability API");
    expect(state.selected_detail.inbound_edges).toEqual([]);
    expect(
      state.selected_detail.tripwire_edges.map((edge) => edge.label),
    ).toEqual(["Command Center state-change tripwire"]);
  });

  it("filters nodes and edges without mutating projection data", () => {
    const model = buildArchitectureGraphViewerModel();
    const before = JSON.stringify(model.projection);
    const state = buildArchitectureGraphViewerState(model, {
      groupFilter: "governance",
      edgeFilter: "gate",
    });

    expect(
      state.visible_nodes.every((node) => node.display_group === "governance"),
    ).toBe(true);
    expect(state.visible_edges.every((edge) => edge.kind === "gates")).toBe(
      true,
    );
    expect(JSON.stringify(model.projection)).toBe(before);
  });

  it("searches by node label and id", () => {
    const model = buildArchitectureGraphViewerModel();
    const byLabel = buildArchitectureGraphViewerState(model, {
      searchQuery: "voice",
    });
    const byId = buildArchitectureGraphViewerState(model, {
      searchQuery: "metadata-projection-surfaces",
    });

    expect(byLabel.visible_nodes.map((node) => node.label)).toEqual([
      "Phase 14 Voice Runtime",
      "Voice Runtime",
    ]);
    expect(byId.visible_nodes.map((node) => node.id)).toEqual([
      "arch-node:metadata-projection-surfaces",
    ]);
  });

  it("hides forbidden tripwire edges without changing source metadata", () => {
    const model = buildArchitectureGraphViewerModel();
    const state = buildArchitectureGraphViewerState(model, {
      showTripwires: false,
    });

    expect(state.visible_warnings).toEqual([]);
    expect(state.visible_edges.some((edge) => edge.tripwire)).toBe(false);
    expect(model.warnings.length).toBe(6);
  });
});
