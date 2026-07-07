import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PipelineDiagram } from "@/components/pipeline/PipelineDiagram";
import {
  PIPELINE_STAGE_IDS,
  buildPipelineViewModel,
} from "@/lib/pipeline-visualization";
import {
  PIPELINE_LANES,
  buildLaneViewModel,
} from "@/lib/pipeline-visualization/lane-registry";

/**
 * AP-J4 — the cockpit pipeline / operating-map surface speaks the AP-J1
 * language. Six invariants, mirroring the AP-J2 (Gate panel) and AP-J3
 * (WorkflowBox) language suites.
 */

const ROOT = process.cwd();
const CSS = readFileSync(
  join(ROOT, "src/components/pipeline/pipeline-map.css"),
  "utf8",
);
const SRC = readFileSync(
  join(ROOT, "src/components/pipeline/PipelineDiagram.tsx"),
  "utf8",
);

function html() {
  return renderToStaticMarkup(<PipelineDiagram />);
}

/** Naive-but-sufficient CSS block scan: selector text -> declaration text. */
function cssBlocks(): Array<{ selector: string; body: string }> {
  const blocks: Array<{ selector: string; body: string }> = [];
  // strip comments first so prose mentioning amber does not trip the law
  const css = CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    blocks.push({ selector: match[1].trim(), body: match[2] });
  }
  return blocks;
}

const AMBER_REFS = [
  "--jarvis-shell-gate",
  "--jarvis-color-review",
  "--jarvis-color-amber",
  "--jarvis-color-pipeline-human-gate",
];

describe("I-APJ4-1 — amber marks Gate-touching pipeline state ONLY", () => {
  it("every CSS block referencing an amber token has a gate-scoped selector", () => {
    for (const block of cssBlocks()) {
      const usesAmber = AMBER_REFS.some((ref) => block.body.includes(ref));
      if (usesAmber) {
        expect(block.selector).toMatch(/gate/i);
      }
    }
  });

  it("no decorative per-stage color: capture/classify/route/execute/audit tokens are gone from the component", () => {
    expect(SRC).not.toContain("--jarvis-color-pipeline-capture");
    expect(SRC).not.toContain("--jarvis-color-pipeline-classify");
    expect(SRC).not.toContain("--jarvis-color-pipeline-route");
    expect(SRC).not.toContain("--jarvis-color-pipeline-execute");
    expect(SRC).not.toContain("--jarvis-color-pipeline-audit");
    expect(SRC).not.toContain("--jarvis-color-violet");
  });

  it("no raw amber values anywhere in the surface", () => {
    for (const text of [SRC, CSS]) {
      expect(text).not.toMatch(/#f59e0b/i);
      expect(text).not.toContain("rgba(245,158,11");
      expect(text).not.toContain("rgba(245, 158, 11");
    }
  });

  it("inline amber in markup is confined to the human_gate stage card", () => {
    const markup = html();
    const amberVar = "var(--jarvis-color-pipeline-human-gate)";
    const gateStart = markup.indexOf('data-pipeline-stage-id="human_gate"');
    const gateEnd = markup.indexOf('data-pipeline-stage-id="execute"');
    expect(gateStart).toBeGreaterThan(-1);
    expect(gateEnd).toBeGreaterThan(gateStart);
    let cursor = markup.indexOf(amberVar);
    expect(cursor).toBeGreaterThan(-1); // the gate DOES wear amber
    while (cursor !== -1) {
      expect(cursor).toBeGreaterThan(gateStart);
      expect(cursor).toBeLessThan(gateEnd);
      cursor = markup.indexOf(amberVar, cursor + 1);
    }
  });

  it("exactly one gated approach edge on the map — the hop into the Gate", () => {
    const markup = html();
    expect(markup.match(/data-map-edge-tone="gate"/g)).toHaveLength(1);
    expect(markup).toContain('data-map-edge="route--human_gate"');
    expect(markup).toContain('data-map-checkpoint="pending-approval"');
    expect(markup.match(/data-map-edge-tone="flow"/g)).toHaveLength(4);
  });

  it("flow rides the emerald->sky range; OK rows anchor to the emerald token", () => {
    expect(SRC).toContain("--jarvis-color-emerald-local");
    expect(SRC).toContain("--jarvis-color-sky-focus");
    expect(html()).toContain("url(#plm-flow)");
    expect(CSS).toMatch(/\.plm-row--ok\s*\{[^}]*--jarvis-color-local/);
  });
});

describe("I-APJ4-2 — legible registers", () => {
  it("ids/telemetry use the mono register; names use the display register", () => {
    expect(CSS).toMatch(/\.plm-mono\s*\{[^}]*var\(--jarvis-font-mono\)/);
    expect(CSS).toMatch(/\.plm-node-id\s*\{[^}]*var\(--jarvis-font-mono\)/);
    expect(CSS).toMatch(/\.plm-title\s*\{[^}]*var\(--jarvis-font-display\)/);
    expect(CSS).toMatch(
      /\.plm-node-label\s*\{[^}]*var\(--jarvis-font-display\)/,
    );
    expect(CSS).toMatch(/\.plm-data\s*\{[^}]*var\(--jarvis-font-display\)/);
  });

  it("no model-generated text on this surface, so no model-voice italics", () => {
    expect(CSS).not.toContain("font-style: italic");
    expect(SRC).not.toContain("model-voice");
  });
});

describe("I-APJ4-3 — SVG map with the no-affordance contracts", () => {
  it("the operating map is addressable SVG, never canvas", () => {
    const markup = html();
    expect(markup).toContain('data-pipeline-map="true"');
    expect(markup).toContain("<svg");
    expect(markup).not.toContain("<canvas");
    for (const stageId of PIPELINE_STAGE_IDS) {
      expect(markup).toContain(`data-map-stage="${stageId}"`);
    }
  });

  it("forbidden shortcuts are drawn on the map, severed from the spine", () => {
    const markup = html();
    const forbidden = buildPipelineViewModel().edges.filter(
      (edge) => edge.policy === "forbidden",
    );
    expect(forbidden.length).toBeGreaterThan(0);
    for (const edge of forbidden) {
      expect(markup).toContain(`data-map-forbidden="${edge.transition_id}"`);
    }
  });

  it("the three no-affordance contracts hold on the root and every lane", () => {
    const markup = html();
    expect(markup).toContain('data-pipeline-diagram="read-only"');
    for (const flag of [
      "data-execute-affordance-present",
      "data-approve-affordance-present",
      "data-mutation-affordance-present",
    ]) {
      expect(markup).not.toContain(`${flag}="true"`);
      // root + one per lane
      expect(markup.match(new RegExp(`${flag}="false"`, "g"))?.length).toBe(
        1 + PIPELINE_LANES.length,
      );
    }
    expect(markup).not.toMatch(/<button\b|<form\b|<input\b|<select\b|<a\b/i);
  });
});

describe("I-APJ4-4 — honest provenance, per panel, calm", () => {
  it("the topology is labelled as design, never as runtime traffic", () => {
    const markup = html();
    expect(markup).toContain('data-panel-provenance="synthetic-by-design"');
    expect(markup).toContain(
      "governance topology — the map of the rules, not runtime traffic",
    );
    expect(markup).toContain("not live traffic");
  });

  it("every lane carries an honest-state chip matching its fixture flag", () => {
    const markup = html();
    for (const lane of PIPELINE_LANES) {
      const vm = buildLaneViewModel(lane);
      expect(markup).toContain(
        `data-lane-synthetic-fixture="${String(vm.synthetic_fixture)}"`,
      );
    }
    const anySynthetic = PIPELINE_LANES.some(
      (lane) => buildLaneViewModel(lane).synthetic_fixture,
    );
    if (anySynthetic) {
      expect(markup).toContain(
        "synthetic — deterministic fixture, labelled by design",
      );
    }
  });

  it("honest chips use the shared family and are never error-styled", () => {
    const markup = html();
    const chips = markup.match(/class="[^"]*jcc-honest[^"]*"/g) ?? [];
    expect(chips.length).toBeGreaterThanOrEqual(2); // header + map caption
    for (const chip of chips) {
      expect(chip).not.toMatch(/blocked|rose|error/);
    }
    expect(markup).toMatch(/data-honest-state="(synthetic|live)"/);
    // EVERY honest-family block (base, state modifiers, descendants) must
    // stay calm: no blocked/error tokens, no error affordances.
    const honestBlocks = cssBlocks().filter((b) =>
      b.selector.includes("plm-honest"),
    );
    expect(honestBlocks.length).toBeGreaterThan(0);
    for (const block of honestBlocks) {
      expect(block.body).not.toMatch(
        /--jarvis-shell-blocked|--jarvis-color-blocked|--jarvis-color-rose|--jarvis-color-pipeline-forbidden|line-through|#f43f5e|red\b/,
      );
    }
  });
});

describe("I-APJ4-5 — motion is inherited, never invented", () => {
  it("no keyframes and no animation on this surface", () => {
    const css = CSS.replace(/\/\*[\s\S]*?\*\//g, ""); // prose may cite the law
    expect(css).not.toContain("@keyframes");
    const animations = css.match(/animation:[^;]+;/g) ?? [];
    for (const declaration of animations) {
      expect(declaration).toContain("none"); // reduced-motion kill switch only
    }
    expect(SRC).not.toMatch(/animate-|motion-safe:|cc-atmosphere/);
  });

  it("every transition rides the shared motion vocabulary", () => {
    const transitions = CSS.match(/transition:[^;]+;/g) ?? [];
    expect(transitions.length).toBeGreaterThan(0);
    for (const declaration of transitions) {
      if (declaration.includes("none")) continue; // kill switch
      expect(declaration).toContain("var(--jarvis-motion-vocab-");
    }
  });

  it("reduced-motion defense-in-depth block present", () => {
    expect(CSS).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("the old decorative chrome is gone", () => {
    expect(SRC).not.toContain("backdrop-blur");
    expect(SRC).not.toContain("hover:-translate");
    expect(SRC).not.toContain("animate-pulse");
  });
});

describe("I-APJ4-6 — display-only, no behavior change", () => {
  it("runtime.runTool call sites stay EXACTLY 2, both under src/lib/chat", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === "node_modules" || entry === ".next") continue;
          walk(full);
        } else if (
          /\.(ts|tsx)$/.test(entry) &&
          !/\.(test|d)\.tsx?$/.test(entry)
        ) {
          if (/\.runTool\s*\(/.test(readFileSync(full, "utf8"))) {
            hits.push(full.replaceAll("\\", "/"));
          }
        }
      }
    };
    walk(join(ROOT, "src"));
    expect(hits).toHaveLength(2);
    for (const hit of hits) {
      expect(hit).toContain("src/lib/chat/");
    }
  });

  it("the surface still consumes the frozen view models unchanged", () => {
    expect(SRC).toContain("buildPipelineViewModel()");
    expect(SRC).toContain("buildLaneViewModel(lane)");
    const markup = html();
    const viewModel = buildPipelineViewModel();
    for (const stage of viewModel.stages) {
      expect(markup).toContain(stage.label);
    }
    for (const edge of viewModel.edges) {
      expect(markup).toContain(`data-transition-id="${edge.transition_id}"`);
    }
  });
});
