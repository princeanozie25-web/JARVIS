import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "../../app/page";
import AuditPage from "../../src/app/audit/page";
import RestPage from "../../src/app/rest/page";
import WorkingPage from "../../src/app/working/page";
import { COMMAND_CENTER_ROUTES } from "../../src/components/command-center/CommandCenterNav";
import { RestCommandCenter } from "../../src/components/command-center/RestCommandCenter";
import { SYNTHETIC_OBSERVABILITY_MARKER } from "../../src/lib/observability/synthetic-data";

const COMMAND_CENTER_FILES = [
  "app/layout.tsx",
  "app/globals.css",
  "src/lib/design-tokens/tokens.css",
  "src/components/command-center/CommandCenterNav.tsx",
  "src/components/command-center/RestCommandCenter.tsx",
  "src/components/command-center/command-center.css",
  "src/components/orb/orb-states.css",
] as const;

function sourceText(files: readonly string[] = COMMAND_CENTER_FILES) {
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

describe("Command Center unification pass", () => {
  it("exposes the unified command center route registry", () => {
    expect(COMMAND_CENTER_ROUTES.map((route) => route.href)).toEqual([
      "/",
      "/rest",
      "/working",
      "/audit",
      "/audit/pipeline",
    ]);
  });

  it("renders the shared command center shell on root and rest", () => {
    const home = renderToStaticMarkup(<HomePage />);
    const rest = renderToStaticMarkup(<RestPage />);

    for (const html of [home, rest]) {
      expect(html).toContain('data-command-center-shell="pipeline-rest"');
      expect(html).toContain('data-command-center-nav="unified"');
      expect(html).toContain('data-rest-pipeline-surface="standing-by"');
      expect(html).toContain('data-pipeline-diagram="read-only"');
      expect(html).toContain('data-suggestion-inbox="pipeline-hud"');
    }
  });

  it("renders deterministic suggestion cards without execution affordances", () => {
    const html = renderToStaticMarkup(
      <RestCommandCenter
        activeRoute="rest"
        marker={SYNTHETIC_OBSERVABILITY_MARKER}
      />,
    );

    expect(html.match(/data-suggestion-card=/g)).toHaveLength(6);
    expect(html.match(/data-suggestion-executable="false"/g)).toHaveLength(6);
    expect(html).toContain("AI Daily Newsletter");
    expect(html).toContain("Job Scout Report");
    expect(html).toContain("Resume Jarvis UI work");
    expect(html).not.toMatch(/<button\b|<form\b|<input\b|onClick|onSubmit/i);
    expect(html).toContain('data-execute-affordance-present="false"');
    expect(html).toContain('data-approve-affordance-present="false"');
    expect(html).toContain('data-mutation-affordance-present="false"');
  });

  it("keeps working controls inside the Human Gate context only", () => {
    const html = renderToStaticMarkup(<WorkingPage />);

    expect(html).toContain('data-command-center-shell="working"');
    expect(html.match(/data-human-gate-panel="true"/g)).toHaveLength(4);
    expect(html.match(/wc-gate-approve/g)).toHaveLength(4);
    expect(html.match(/wc-gate-deny/g)).toHaveLength(4);
    expect(html).toContain('data-command-center-nav="unified"');
  });

  it("keeps audit read-only while sharing command center chrome", () => {
    const html = renderToStaticMarkup(<AuditPage />);

    expect(html).toContain('data-command-center-shell="audit"');
    expect(html).toContain('data-command-center-nav="unified"');
    expect(html).not.toMatch(
      /<button\b|<form\b|<input\b|<textarea\b|<select\b/i,
    );
  });

  it("uses Orbitron, Rajdhani, and JetBrains Mono as primary typography tokens", () => {
    const source = sourceText();

    expect(source).toContain("Orbitron");
    expect(source).toContain("Rajdhani");
    expect(source).toContain("JetBrains_Mono");
    expect(source).toMatch(
      /--jarvis-font-display:\s*var\(\s*--font-jarvis-display,\s*"Orbitron"/,
    );
    expect(source).toMatch(
      /--jarvis-font-body:\s*var\(\s*--font-jarvis-body,\s*"Rajdhani"/,
    );
    expect(source).not.toMatch(/--jarvis-font-(display|body):[^;]*Arial/i);
  });

  it("declares reduced-motion fallbacks for reactor and command center motion", () => {
    const source = sourceText([
      "src/components/command-center/command-center.css",
      "src/components/orb/orb-states.css",
    ]);

    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    expect(source).toContain(".cc-suggestion-card");
    expect(source).toContain("data-orb-reactor-layer");
  });
});
