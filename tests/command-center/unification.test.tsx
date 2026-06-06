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
  "src/components/command-center/liquid-command-center.css",
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
      expect(html).toContain('data-command-center-shell="rest-liquid-glass"');
      expect(html).toContain('data-rest-authority="none"');
      expect(html).toContain('data-rest-mutating-affordances="0"');
      expect(html).toContain('data-voice-authorizes-actions="false"');
      expect(html).toContain("JARVIS");
      expect(html).toContain("SYSTEM STANDBY");
    }
  });

  it("renders deterministic suggestion cards without execution affordances", () => {
    const html = renderToStaticMarkup(
      <RestCommandCenter
        activeRoute="rest"
        marker={SYNTHETIC_OBSERVABILITY_MARKER}
      />,
    );

    expect(html.match(/data-suggestion-card=/g)).toHaveLength(4);
    expect(html.match(/data-suggestion-executable="false"/g)).toHaveLength(4);
    expect(html).toContain("JOB SCOUT");
    expect(html).toContain("COUNCIL - OVERNIGHT");
    expect(html).toContain("LIFE COACH");
    expect(html).toContain("WORKFLOW");
    expect(html).not.toMatch(/<button\b|<form\b|<input\b|onSubmit/i);
  });

  it("keeps working controls inside the Human Gate context only", () => {
    const html = renderToStaticMarkup(<WorkingPage />);

    expect(html).toContain('data-command-center-shell="working-liquid-glass"');
    expect(html.match(/data-human-gate-panel="true"/g)).toHaveLength(1);
    expect(html.match(/wc-gate-approve/g)).toHaveLength(1);
    expect(html.match(/wc-gate-deny/g)).toHaveLength(1);
    expect(html).toContain('data-command-center-nav="unified"');
  });

  it("keeps audit read-only while sharing command center chrome", () => {
    const html = renderToStaticMarkup(<AuditPage />);

    expect(html).toContain('data-command-center-shell="audit-liquid-glass"');
    expect(html).toContain('data-command-center-nav="unified"');
    expect(html).not.toMatch(
      /<button\b|<form\b|<input\b|<textarea\b|<select\b/i,
    );
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).toContain('data-replay-non-executable="true"');
  });

  it("uses local-first Fraunces and JetBrains Mono tokens", () => {
    const source = sourceText();

    expect(source).toContain("Fraunces");
    expect(source).toContain("JetBrains Mono");
    expect(source).toContain("next/font/local");
    expect(source).not.toContain("next/font/google");
    expect(source).toMatch(
      /--jarvis-font-display:\s*var\(\s*--font-jarvis-display/,
    );
    expect(source).toMatch(
      /--jarvis-font-body:\s*var\(\s*--font-jarvis-display/,
    );
    expect(source).not.toMatch(/--jarvis-font-(display|body):[^;]*Arial/i);
  });

  it("declares reduced-motion fallbacks for reactor and command center motion", () => {
    const source = sourceText([
      "src/components/command-center/command-center.css",
      "src/components/command-center/liquid-command-center.css",
      "src/components/orb/orb-states.css",
    ]);

    expect(source).toContain("@media (prefers-reduced-motion: reduce)");
    expect(source).toContain(".jcc-card");
    expect(source).toContain("data-orb-reactor-layer");
  });
});
