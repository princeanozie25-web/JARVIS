import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ArchitectureGraphViewer,
  buildArchitectureGraphViewerModel,
} from "./ArchitectureGraphViewer";

const COMPONENT_SOURCE =
  "src/components/architecture-graph/ArchitectureGraphViewer.tsx";

function renderViewer() {
  return renderToStaticMarkup(<ArchitectureGraphViewer />);
}

function assertNoControls(html: string) {
  expect(html).not.toMatch(/<button\b/i);
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
  expect(html).not.toMatch(/<a\b/i);
  expect(html).not.toMatch(/\brole="button"/i);
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
    assertNoControls(html);
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
    assertNoControls(html);
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
});
