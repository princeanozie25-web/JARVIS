import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PipelineDiagram } from "@/components/pipeline/PipelineDiagram";
import PipelineVisualizationPage from "@/app/audit/pipeline/page";
import {
  PIPELINE_STAGE_IDS,
  buildPipelineViewModel,
} from "@/lib/pipeline-visualization";

function html() {
  return renderToStaticMarkup(<PipelineDiagram />);
}

function pageHtml() {
  return renderToStaticMarkup(<PipelineVisualizationPage />);
}

describe("UI.10 PipelineDiagram — stage rendering", () => {
  it("renders all six pipeline stages from the existing view model", () => {
    const markup = html();
    for (const stageId of PIPELINE_STAGE_IDS) {
      expect(markup).toContain(`data-pipeline-stage-id="${stageId}"`);
    }
  });

  it("emits the read-only contract markers", () => {
    const markup = html();
    expect(markup).toContain('data-pipeline-diagram="read-only"');
    expect(markup).toContain('data-execute-affordance-present="false"');
    expect(markup).toContain('data-approve-affordance-present="false"');
    expect(markup).toContain('data-mutation-affordance-present="false"');
  });

  it("labels every stage and surfaces stage descriptions", () => {
    const markup = html();
    const viewModel = buildPipelineViewModel();
    for (const stage of viewModel.stages) {
      expect(markup).toContain(stage.label);
      expect(markup).toContain(stage.description);
    }
  });

  it("surfaces authority / approval / execution boundary visibility per stage", () => {
    const markup = html();
    expect(markup).toContain('data-approval-gate-visible="true"');
    expect(markup).toContain('data-execution-boundary-visible="true"');
    expect(markup).toContain('data-approval-required="true"');
    expect(markup).toContain('data-execution-enabled="true"');
  });
});

describe("UI.10 PipelineDiagram — stage palette via tokens", () => {
  it("anchors every stage color to a --jarvis-color-pipeline-* token", () => {
    const markup = html();
    expect(markup).toContain("var(--jarvis-color-pipeline-capture)");
    expect(markup).toContain("var(--jarvis-color-pipeline-classify)");
    expect(markup).toContain("var(--jarvis-color-pipeline-route)");
    expect(markup).toContain("var(--jarvis-color-pipeline-human-gate)");
    expect(markup).toContain("var(--jarvis-color-pipeline-execute)");
    expect(markup).toContain("var(--jarvis-color-pipeline-audit)");
  });

  it("does not hardcode the violet hex literal in the rendered diagram", () => {
    const markup = html();
    expect(markup).not.toContain("#a78bfa");
  });
});

describe("UI.10 PipelineDiagram — Human Gate emphasis", () => {
  it("marks the Human Gate stage with primary emphasis and an approval badge", () => {
    const markup = html();
    expect(markup).toMatch(
      /data-pipeline-stage-id="human_gate"[^>]*data-emphasis="primary"|data-emphasis="primary"[^>]*data-pipeline-stage-id="human_gate"/,
    );
    expect(markup).toContain('data-emphasis-badge="human-gate"');
    expect(markup).toContain("Approval gate");
  });

  it("all non-gate stages render with secondary emphasis", () => {
    const markup = html();
    const nonGateStages = PIPELINE_STAGE_IDS.filter(
      (id) => id !== "human_gate",
    );
    for (const stageId of nonGateStages) {
      expect(markup).toMatch(
        new RegExp(
          `data-pipeline-stage-id="${stageId}"[^>]*data-emphasis="secondary"|data-emphasis="secondary"[^>]*data-pipeline-stage-id="${stageId}"`,
        ),
      );
    }
  });
});

describe("UI.10 PipelineDiagram — forbidden edges visible in red", () => {
  it("renders the forbidden transitions region with a BLOCKED label", () => {
    const markup = html();
    expect(markup).toContain('data-pipeline-region="transitions-forbidden"');
    expect(markup).toContain('aria-label="Forbidden transitions"');
    expect(markup).toContain("[ BLOCKED ]");
  });

  it("each forbidden edge carries data-forbidden + treatment=blocked", () => {
    const markup = html();
    const viewModel = buildPipelineViewModel();
    const forbidden = viewModel.edges.filter((e) => e.policy === "forbidden");
    expect(forbidden.length).toBeGreaterThan(0);
    for (const edge of forbidden) {
      expect(markup).toContain(`data-transition-id="${edge.transition_id}"`);
    }
    expect(markup).toContain('data-forbidden="true"');
    expect(markup).toContain('data-transition-treatment="blocked"');
  });

  it("colors forbidden edges through the pipeline-forbidden token (not raw hex)", () => {
    const markup = html();
    expect(markup).toContain("var(--jarvis-color-pipeline-forbidden)");
  });
});

describe("UI.10 PipelineDiagram — Graphify-compatible read-only invariant", () => {
  it("renders every designed transition from the existing view model", () => {
    const markup = html();
    const viewModel = buildPipelineViewModel();
    for (const edge of viewModel.edges) {
      expect(markup).toContain(`data-transition-id="${edge.transition_id}"`);
    }
  });

  it("renders every governance boundary from the existing view model", () => {
    const markup = html();
    const viewModel = buildPipelineViewModel();
    for (const boundary of viewModel.boundaries) {
      expect(markup).toContain(`data-boundary-id="${boundary.boundary_id}"`);
      expect(markup).toContain(boundary.label);
    }
  });

  it("surfaces Phase 22 voice activity as read-only metadata", () => {
    const markup = html();
    expect(markup).toContain('data-pipeline-region="voice-activity"');
    expect(markup).toContain(
      'data-voice-pipeline-authoritative-surface="/audit/pipeline"',
    );
    expect(markup).toContain('data-voice-pipeline-event="wake_event"');
    expect(markup).toContain('data-voice-pipeline-event="t2_proposal"');
    expect(markup).toContain('data-raw-audio-included="false"');
    expect(markup).toContain('data-transcript-included="false"');
    expect(markup).toContain('data-executable-payload-included="false"');
  });

  it("exposes no interactive controls (no buttons, forms, inputs, anchors)", () => {
    const markup = html();
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
    expect(markup).not.toMatch(/\brole="button"/i);
    // The diagram is a governance visualization — "approve", "execute", etc.
    // appear as labels by design. The read-only invariant is asserted via the
    // structural checks above and the data-*-affordance-present="false" flags.
    expect(markup).toContain('data-execute-affordance-present="false"');
    expect(markup).toContain('data-approve-affordance-present="false"');
    expect(markup).toContain('data-mutation-affordance-present="false"');
  });
});

describe("UI.10 /audit/pipeline route", () => {
  it("renders the diagram under a <main> landmark with a skip link", () => {
    const markup = pageHtml();
    expect(markup).toContain('data-audit-surface="pipeline"');
    expect(markup).toContain('id="pipeline-diagram"');
    expect(markup).toContain('class="jarvis-skip-link"');
    expect(markup).toContain('data-pipeline-diagram="read-only"');
  });

  it("the route surfaces every stage id from the contract", () => {
    const markup = pageHtml();
    for (const stageId of PIPELINE_STAGE_IDS) {
      expect(markup).toContain(`data-pipeline-stage-id="${stageId}"`);
    }
  });

  it("the route exposes no execution affordances at the page level", () => {
    const markup = pageHtml();
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
  });
});
