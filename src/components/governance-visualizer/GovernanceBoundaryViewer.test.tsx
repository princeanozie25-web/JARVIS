import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  GovernanceBoundaryViewer,
  buildGovernanceBoundaryViewerModel,
  buildGovernanceBoundaryViewerState,
  filterGovernanceBoundaryViewerEdges,
  filterGovernanceBoundaryViewerNodes,
} from "./GovernanceBoundaryViewer";

const COMPONENT_SOURCE =
  "src/components/governance-visualizer/GovernanceBoundaryViewer.tsx";

const forbiddenRenderedAffordancePattern =
  /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i;

const forbiddenRenderedPayloadPattern =
  /raw_payload|tool_args|raw_prompt|model output|voice transcript|ocr text|frame bytes|secret|approval token/i;

function renderViewer() {
  return renderToStaticMarkup(<GovernanceBoundaryViewer />);
}

describe("Phase 19C.4 governance boundary inspection and filtering", () => {
  it("renders the visible read-only governance boundary surface", () => {
    const html = renderViewer();

    expect(html).toContain('data-governance-boundary-viewer="read-only"');
    expect(html).toContain('data-metadata-only="true"');
    expect(html).toContain('data-read-only="true"');
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain("Governance Boundaries");
    expect(html).toContain("Phase 19C visibility surface");
    expect(html).toContain("Find boundary");
    expect(html).toContain("Policy");
    expect(html).toContain("Gate type");
    expect(html).toContain("Trust class");
    expect(html).toContain("Show Tripwires");
    expect(html).toContain("Show Warnings");
    expect(html).not.toMatch(forbiddenRenderedAffordancePattern);
  });

  it("renders projection stats and disabled capabilities", () => {
    const html = renderViewer();

    expect(html).toContain("Nodes");
    expect(html).toContain("15");
    expect(html).toContain("Edges");
    expect(html).toContain("17");
    expect(html).toContain("Gated");
    expect(html).toContain("5");
    expect(html).toContain("Forbidden");
    expect(html).toContain("8");
    expect(html).toContain("Disabled features");
    expect(html).toContain("Authority surfaces");
    expect(html).toContain("none");
  });

  it("renders subsystem nodes, trust classes, and gate types", () => {
    const html = renderViewer();

    expect(html).toContain("Subsystem Nodes");
    expect(html).toContain("Voice Runtime");
    expect(html).toContain("Approval Runtime");
    expect(html).toContain("Telemetry Cockpit");
    expect(html).toContain("Trust Classes");
    expect(html).toContain("observe only");
    expect(html).toContain("safe change");
    expect(html).toContain("restricted change");
    expect(html).toContain("Gate Types");
    expect(html).toContain("approval");
    expect(html).toContain("budget");
    expect(html).toContain("disabled feature");
  });

  it("renders boundary edges and default inspection panels", () => {
    const html = renderViewer();

    expect(html).toContain("Boundary Edges");
    expect(html).toContain(
      "Command Center observes Observability API metadata",
    );
    expect(html).toContain("Approval Runtime gates Tool Runtime");
    expect(html).toContain("Voice to Tool Effect Path is forbidden");
    expect(html).toContain("Telemetry Cockpit to State Change is forbidden");
    expect(html).toContain('data-governance-node-detail="read-only"');
    expect(html).toContain("Node Inspection");
    expect(html).toContain("Node id");
    expect(html).toContain("Inbound Edges");
    expect(html).toContain("Outbound Edges");
    expect(html).toContain("Gated Paths");
    expect(html).toContain("Forbidden Paths");
    expect(html).toContain("Related Tripwires");
    expect(html).toContain("Related Warnings");
    expect(html).toContain('data-governance-edge-detail="read-only"');
    expect(html).toContain("Edge Inspection");
    expect(html).toContain("From");
    expect(html).toContain("To");
    expect(html).toContain("Tripwire status");
    expect(html).toContain("Rationale");
  });

  it("renders tripwires and warnings as warning-only metadata", () => {
    const html = renderViewer();

    expect(html).toContain("Tripwire Warnings");
    expect(html).toContain("Voice path must never grant approval authority");
    expect(html).toContain("Scheduler path must never decide approvals");
    expect(html).toContain("warning only");
    expect(html).toContain("Boundary Warnings");
    expect(html).toContain(
      "Forbidden paths are represented as metadata tripwires only",
    );
    expect(html).toContain("informational");
  });

  it("does not render raw payload fields or forbidden action affordances", () => {
    const html = renderViewer();

    expect(html).not.toMatch(forbiddenRenderedPayloadPattern);
    expect(html).not.toMatch(forbiddenRenderedAffordancePattern);
    expect(html).not.toMatch(/<form\b|<a\b/i);
  });

  it("builds selected node inspection metadata without mutating the source model", () => {
    const model = buildGovernanceBoundaryViewerModel();
    const before = JSON.stringify({ nodes: model.nodes, edges: model.edges });
    const state = buildGovernanceBoundaryViewerState(model, {
      selectedNodeId: "governance-node:scheduler",
    });

    expect(state.selected_node_detail.node.label).toBe("Scheduler");
    expect(state.selected_node_detail.inbound_edges).toHaveLength(0);
    expect(state.selected_node_detail.outbound_edges).toHaveLength(2);
    expect(state.selected_node_detail.forbidden_paths).toHaveLength(2);
    expect(state.selected_node_detail.tripwires).toHaveLength(2);
    expect(state.selected_node_detail.metadata_only).toBe(true);
    expect(state.selected_node_detail.read_only).toBe(true);
    expect(JSON.stringify({ nodes: model.nodes, edges: model.edges })).toBe(
      before,
    );
  });

  it("builds selected edge inspection metadata as warning-only tripwire detail", () => {
    const model = buildGovernanceBoundaryViewerModel();
    const state = buildGovernanceBoundaryViewerState(model, {
      selectedEdgeId: "governance-edge:voice-tool-execution-forbidden",
    });

    expect(state.selected_edge_detail.from_label).toBe("Voice Runtime");
    expect(state.selected_edge_detail.to_label).toBe("Tool Runtime");
    expect(state.selected_edge_detail.policy_label).toBe("forbidden");
    expect(state.selected_edge_detail.gate_label).toBe("disabled feature");
    expect(state.selected_edge_detail.trust_label).toBe("forbidden");
    expect(state.selected_edge_detail.severity).toBe("critical");
    expect(state.selected_edge_detail.tripwire_status).toBe("warning only");
    expect(state.selected_edge_detail.rationale).toBe(
      "Blocked path shown only as tripwire metadata.",
    );
    expect(state.selected_edge_detail.metadata_only).toBe(true);
    expect(state.selected_edge_detail.read_only).toBe(true);
  });

  it("filters policy, gate, trust, and tripwire visibility without mutating data", () => {
    const model = buildGovernanceBoundaryViewerModel();
    const before = JSON.stringify({ nodes: model.nodes, edges: model.edges });

    expect(
      filterGovernanceBoundaryViewerEdges(model, {
        policyFilter: "forbidden",
        gateFilter: "all",
        trustFilter: "all",
        showTripwires: true,
        searchQuery: "",
      }),
    ).toHaveLength(8);
    expect(
      filterGovernanceBoundaryViewerEdges(model, {
        policyFilter: "all",
        gateFilter: "approval",
        trustFilter: "all",
        showTripwires: true,
        searchQuery: "",
      }),
    ).toHaveLength(2);
    expect(
      filterGovernanceBoundaryViewerNodes(model, {
        trustFilter: "observe_only",
        searchQuery: "",
      }),
    ).toHaveLength(8);
    expect(
      filterGovernanceBoundaryViewerEdges(model, {
        policyFilter: "all",
        gateFilter: "all",
        trustFilter: "forbidden",
        showTripwires: true,
        searchQuery: "",
      }),
    ).toHaveLength(8);

    const state = buildGovernanceBoundaryViewerState(model, {
      showTripwires: false,
    });
    expect(
      state.visible_edges.every((edge) => edge.policy !== "forbidden"),
    ).toBe(true);
    expect(state.visible_tripwires).toHaveLength(0);
    expect(JSON.stringify({ nodes: model.nodes, edges: model.edges })).toBe(
      before,
    );
  });

  it("searches node labels and edge labels while preserving deterministic order", () => {
    const model = buildGovernanceBoundaryViewerModel();
    const state = buildGovernanceBoundaryViewerState(model, {
      searchQuery: "telemetry cockpit",
    });

    expect(state.visible_nodes.map((node) => node.label)).toEqual([
      "Telemetry Cockpit",
    ]);
    expect(state.visible_edges.map((edge) => edge.edge_id)).toEqual([
      "governance-edge:telemetry-cockpit-observes-observability-api",
      "governance-edge:telemetry-cockpit-mutation-forbidden",
    ]);
  });

  it("keeps forbidden tripwires visible as warnings only", () => {
    const model = buildGovernanceBoundaryViewerModel();
    const state = buildGovernanceBoundaryViewerState(model, {
      selectedNodeId: "governance-node:voice-runtime",
    });

    expect(state.selected_node_detail.tripwires).toHaveLength(2);
    expect(
      state.selected_node_detail.tripwires.every(
        (tripwire) =>
          tripwire.metadata_only &&
          tripwire.read_only &&
          tripwire.executes_response === false,
      ),
    ).toBe(true);
  });

  it("uses the governance safety guard before exposing the render model", () => {
    const model = buildGovernanceBoundaryViewerModel();
    const source = readFileSync(COMPONENT_SOURCE, "utf8");

    expect(model.projection_safety_checked).toBe(true);
    expect(model.metadata_only).toBe(true);
    expect(model.read_only).toBe(true);
    expect(model.forbidden_edges).toHaveLength(8);
    expect(model.tripwires).toHaveLength(8);
    expect(source).toContain("assertGovernanceBoundarySafe(projection)");
    expect(source).toContain("scanGovernanceBoundarySafety(projection");
  });
});
