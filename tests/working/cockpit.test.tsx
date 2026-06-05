import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import WorkingPage from "../../src/app/working/page";
import { WorkingCockpit } from "../../src/components/working/WorkingCockpit";

const ALL_PANEL_IDS = [
  "system_status",
  "suggestions_inbox",
  "cost_usage",
  "room_state",
  "recent_activity",
  "model_router",
  "safety_governance",
] as const;

const REGION_MARKERS = [
  "header",
  "panels",
  "status",
  "situation",
  "operations",
  "command-bar",
] as const;

function renderWorkingPage() {
  return renderToStaticMarkup(<WorkingPage />);
}

describe("UI.8 /working cockpit — mission-control composition", () => {
  it("emits the mission-control cockpit marker on the shell", () => {
    const html = renderWorkingPage();
    expect(html).toContain('data-working-shell="read-only"');
    expect(html).toContain('data-working-cockpit="mission-control"');
    expect(html).toContain('data-working-layout-style="mission-control"');
  });

  it("declares every mission-control region by data-cockpit-region", () => {
    const html = renderWorkingPage();
    for (const region of REGION_MARKERS) {
      expect(html).toContain(`data-cockpit-region="${region}"`);
    }
  });

  it("renders every panel from the registry — no functionality loss", () => {
    const html = renderWorkingPage();
    for (const panelId of ALL_PANEL_IDS) {
      expect(html).toContain(`data-panel-id="${panelId}"`);
    }
  });

  it("preserves the pre-existing route + shell contract attributes", () => {
    const html = renderWorkingPage();
    expect(html).toContain('data-working-layout="read-only-cockpit"');
    expect(html).toContain("JARVIS Room OS");
    expect(html).toContain("Working Mode");
    expect(html).toContain("Command Center Cockpit");
    expect(html).toContain("Read-only cockpit shell");
    expect(html).toContain('aria-label="Working shell metadata badges"');
    expect(html).toContain('aria-label="Working panel registry layout"');
    expect(html).toContain('data-local-only="true"');
    expect(html).toContain('data-metadata-only="true"');
    expect(html).toContain('data-authority="none"');
  });

  it("renders a presentational Command Bar pane", () => {
    const html = renderWorkingPage();
    expect(html).toContain('aria-label="Command bar"');
    expect(html).toContain("Command bar");
    expect(html).toContain("read only");
    expect(html).toContain("local only");
    expect(html).toContain("metadata only");
  });

  it("drops the legacy max-width dashboard chrome", () => {
    const html = renderWorkingPage();
    const pageSource = readFileSync("src/app/working/page.tsx", "utf8");
    expect(pageSource).not.toContain("max-w-7xl");
    expect(html).not.toContain("max-w-7xl");
  });

  it("exposes no interactive controls (read-only contract)", () => {
    const html = renderWorkingPage();
    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).not.toMatch(
      /\b(approve|run|retry|execute|mutate|schedule|replay_execute|graph_execute)\b/i,
    );
  });

  it("uses JARVIS semantic tokens for the cockpit, not raw slate utilities", () => {
    const cockpitSource = readFileSync(
      "src/components/working/WorkingCockpit.tsx",
      "utf8",
    );
    expect(cockpitSource).toContain("bg-panel");
    expect(cockpitSource).toContain("border-border-subtle");
    expect(cockpitSource).toContain("text-ink");
    expect(cockpitSource).toContain("text-signal");
    expect(cockpitSource).toContain("shadow-cockpit-depth");
    expect(cockpitSource).not.toContain("bg-slate-950/62");
    expect(cockpitSource).not.toContain("text-slate-300/72");
  });

  it("keeps the projection-backed synthetic contract intact", () => {
    const html = renderWorkingPage();
    expect(html).toContain("Synthetic demo-safe metadata");
    expect(html).toContain('data-panel-id="room_state"');
    expect(html).toContain('data-panel-status="placeholder"');
  });
});

describe("UI.8 WorkingCockpit — direct render", () => {
  it("renders without props and lists all registry panels", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    for (const panelId of ALL_PANEL_IDS) {
      expect(html).toContain(`data-panel-id="${panelId}"`);
    }
  });

  it("emits the cockpit marker even without a route wrapper", () => {
    const html = renderToStaticMarkup(<WorkingCockpit />);
    expect(html).toContain('data-working-cockpit="mission-control"');
  });
});
