import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkingShell } from "../../src/components/working/WorkingShell";
import {
  WORKING_DISABLED_AFFORDANCES,
  listWorkingPanels,
} from "../../src/components/working/panel-registry";
import type { WorkingPanelViewModel } from "../../src/components/working/types";

const WORKING_LIVE_SOURCE_FILES = [
  "src/components/working/WorkingShell.tsx",
  "src/components/working/types.ts",
] as const;

function sourceText() {
  return WORKING_LIVE_SOURCE_FILES.map((file) =>
    readFileSync(file, "utf8"),
  ).join("\n");
}

function projectionPanels(): WorkingPanelViewModel[] {
  return listWorkingPanels().map((panel) => ({
    ...panel,
    status: "placeholder",
    withheld: false,
    projectionBacked: true,
    placeholder_rows:
      panel.panel_id === "room_state"
        ? [
            { label: "Room", value: "known" },
            { label: "Freshness", value: "current" },
            { label: "Summaries", value: "2" },
          ]
        : [{ label: "Projection", value: panel.panel_id }],
  }));
}

describe("Phase 12E.1 Working screen live wiring", () => {
  it("keeps the default WorkingShell render on static registry placeholders", () => {
    const html = renderToStaticMarkup(<WorkingShell />);

    expect(html).toContain("Read-only cockpit shell");
    expect(html).toContain("Static placeholder regions only.");
    expect(html).toContain("Room state");
    expect(html).toContain("withheld");
    expect(html).not.toContain("Summaries");
  });

  it("renders explicitly supplied projection-backed panel view models", () => {
    const html = renderToStaticMarkup(
      <WorkingShell projectionPanels={projectionPanels()} />,
    );

    expect(html).toContain("Room state");
    expect(html).toContain("Room");
    expect(html).toContain("known");
    expect(html).toContain("Freshness");
    expect(html).toContain("current");
    expect(html).toContain("Summaries");
    expect(html).toContain("2");
    expect(html).toContain('data-panel-status="placeholder"');
  });

  it("renders unsafe or withheld supplied panels as withheld static fallback", () => {
    const panels = projectionPanels();
    panels[1] = {
      ...panels[1]!,
      withheld: true,
      status: "withheld",
      placeholder_rows: [{ label: "payload_json", value: "sk-secret" }],
    };

    const html = renderToStaticMarkup(
      <WorkingShell projectionPanels={panels} />,
    );

    expect(html).toContain('data-panel-id="room_state"');
    expect(html).toContain('data-panel-status="withheld"');
    expect(html).toContain("State");
    expect(html).toContain("withheld");
    expect(html).not.toContain("sk-secret");
    expect(html).not.toContain("payload_json");
  });

  it("preserves disabled affordances in supplied data without rendering controls", () => {
    const panels = projectionPanels();
    const html = renderToStaticMarkup(
      <WorkingShell projectionPanels={panels} />,
    );

    for (const panel of panels) {
      expect(panel.disabled_affordances).toEqual(WORKING_DISABLED_AFFORDANCES);
    }
    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).not.toMatch(
      /\b(approve|run|retry|execute|mutate|schedule)\b/i,
    );
  });

  it("does not add automatic fetching, polling, IPC, store access, or execution imports", () => {
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|setInterval|setTimeout|poll/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|createObservabilityApi|queryRoomState|queryTelemetryRollups/i,
    );
    expect(sourceText()).not.toMatch(
      /store\/|event-store|better-sqlite3|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db/i,
    );
    expect(sourceText()).not.toMatch(
      /provider runtime|model runtime|openai|anthropic|ollama|room\/adapters|fake-room-adapter|executeCommand|commandRoom/i,
    );
  });

  it("does not render raw payload language from projection-backed panels", () => {
    const panels = projectionPanels();
    panels[0] = {
      ...panels[0]!,
      placeholder_rows: [{ label: "Prompt", value: "hidden-token" }],
    };

    const html = renderToStaticMarkup(
      <WorkingShell projectionPanels={panels} />,
    );

    expect(html).toContain("State");
    expect(html).toContain("withheld");
    expect(html).not.toMatch(
      /raw_payload|prompt|model output|transcript|frame bytes|secret|token|hidden-token/i,
    );
  });
});
