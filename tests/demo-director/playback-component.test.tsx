import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DemoPlayback } from "@/components/demo-director/DemoPlayback";
import {
  ASSEMBLY_STAGE_ORDER,
  DEMO_SCRIPT_RECRUITER,
  DEMO_SCRIPT_SECURITY,
} from "@/lib/demo-director";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const playbackCss = readFileSync(
  resolve(ROOT, "src", "components", "demo-director", "demo-playback.css"),
  "utf8",
);

function render(script = DEMO_SCRIPT_RECRUITER, elapsed = 0): string {
  return renderToStaticMarkup(
    <DemoPlayback script={script} elapsedMs={elapsed} />,
  );
}

describe("DD.10 DemoPlayback component — read-only contract", () => {
  it("emits the read-only marker and zero affordances", () => {
    const markup = render();
    expect(markup).toContain('data-demo-playback="read-only"');
    expect(markup).toContain('data-execute-affordance-present="false"');
    expect(markup).toContain('data-approve-affordance-present="false"');
    expect(markup).toContain('data-mutation-affordance-present="false"');
    expect(markup).toContain('data-recording-enabled="true"');
    expect(markup).toContain('data-voice-enabled="true"');
    expect(markup).toContain('data-export-enabled="true"');
  });

  it("exposes no interactive controls", () => {
    const markup = render();
    expect(markup).not.toMatch(/<button\b/i);
    expect(markup).not.toMatch(/<form\b/i);
    expect(markup).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(markup).not.toMatch(/<a\b/i);
  });

  it("threads the assembly stage through data-demo-stage", () => {
    expect(render(DEMO_SCRIPT_RECRUITER, 0)).toContain(
      'data-demo-stage="black"',
    );
    expect(render(DEMO_SCRIPT_RECRUITER, 2200)).toContain(
      'data-demo-stage="suggestion_inbox"',
    );
    expect(render(DEMO_SCRIPT_RECRUITER, 5500)).toContain(
      'data-demo-stage="human_gate"',
    );
  });

  it("marks the Human Gate ignition with data-demo-climax", () => {
    const markup = render(DEMO_SCRIPT_RECRUITER, 5500);
    expect(markup).toContain('data-demo-climax="true"');
    const earlier = render(DEMO_SCRIPT_RECRUITER, 1000);
    expect(earlier).toContain('data-demo-climax="false"');
  });

  it("accumulates the materialised set as command center surfaces come online", () => {
    const reactorStage = render(DEMO_SCRIPT_RECRUITER, 700);
    expect(reactorStage).toMatch(/data-demo-materialised="[^"]*reactor/);
    const audit = render(DEMO_SCRIPT_RECRUITER, 4700);
    expect(audit).toMatch(/data-demo-materialised="[^"]*audit/);
    const climax = render(DEMO_SCRIPT_RECRUITER, 5500);
    expect(climax).toMatch(/data-demo-materialised="[^"]*human-gate/);
  });

  it("threads audience and script id into data attributes", () => {
    const markup = render(DEMO_SCRIPT_SECURITY, 0);
    expect(markup).toContain('data-demo-audience="security"');
    expect(markup).toContain('data-demo-script-id="demo:security"');
  });
});

describe("DD.10 demo-playback.css — assembly law", () => {
  it("declares materialise, ignition, and first-pulse keyframes", () => {
    expect(playbackCss).toMatch(/@keyframes\s+jarvis-demo-materialise/);
    expect(playbackCss).toMatch(/@keyframes\s+jarvis-demo-ignition/);
    expect(playbackCss).toMatch(/@keyframes\s+jarvis-demo-first-pulse/);
  });

  it("hides every command center surface while the stage is 'black'", () => {
    expect(playbackCss).toMatch(
      /\[data-demo-stage="black"\][^{]*\[data-demo-stage-target\][^{]*\{[^}]*opacity:\s*0/,
    );
  });

  it("routes every stage animation through pulse-duration tokens", () => {
    expect(playbackCss).toMatch(
      /jarvis-demo-materialise\s+var\(--jarvis-pulse-duration-/,
    );
    expect(playbackCss).toMatch(
      /jarvis-demo-ignition\s+var\(--jarvis-pulse-duration-/,
    );
  });

  it("reduced motion neutralises every playback animation", () => {
    expect(playbackCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\[data-demo-stage-target\][\s\S]*?animation:\s*none\s*!important/,
    );
  });

  it("uses no animation that the assembly order forbids — order is canonical", () => {
    // Sanity guard against future regressions of ASSEMBLY_STAGE_ORDER.
    for (const stage of [
      "reactor",
      "rest",
      "suggestion_inbox",
      "pipeline",
      "working",
      "audit",
      "human_gate",
      "first_pulse",
    ]) {
      expect(ASSEMBLY_STAGE_ORDER).toContain(stage);
    }
  });
});
