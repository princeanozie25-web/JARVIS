import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuditShell } from "../../src/components/audit/AuditShell";
import {
  AUDIT_DISABLED_AFFORDANCES,
  listAuditPanels,
} from "../../src/components/audit/panel-registry";
import type { AuditPanelViewModel } from "../../src/components/audit/types";

const AUDIT_LIVE_SOURCE_FILES = [
  "src/components/audit/AuditShell.tsx",
  "src/components/audit/types.ts",
] as const;

function sourceText() {
  return AUDIT_LIVE_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
  );
}

function projectionPanels(): AuditPanelViewModel[] {
  return listAuditPanels().map((panel) => ({
    ...panel,
    status: "placeholder",
    withheld: false,
    projectionBacked: true,
    placeholder_rows:
      panel.panel_id === "replay_timeline"
        ? [
            { label: "Traces", value: "3" },
            { label: "Replay safe", value: "metadata only" },
          ]
        : [{ label: "Projection", value: panel.panel_id }],
  }));
}

describe("Phase 12E.2 Audit screen live wiring", () => {
  it("keeps the default AuditShell render on static registry placeholders", () => {
    const html = renderToStaticMarkup(<AuditShell />);

    expect(html).toContain("Read-only forensics shell");
    expect(html).toContain("Static placeholder regions only.");
    expect(html).toContain("Replay timeline");
    expect(html).toContain("Timeline");
    expect(html).toContain("static");
    expect(html).not.toContain("Traces");
  });

  it("renders explicitly supplied projection-backed audit panel view models", () => {
    const html = renderToStaticMarkup(
      <AuditShell projectionPanels={projectionPanels()} />,
    );

    expect(html).toContain("Replay timeline");
    expect(html).toContain("Traces");
    expect(html).toContain("3");
    expect(html).toContain("Replay safe");
    expect(html).toContain("metadata only");
    expect(html).toContain('data-panel-status="placeholder"');
  });

  it("renders unsafe or withheld supplied panels as withheld static fallback", () => {
    const panels = projectionPanels();
    panels[0] = {
      ...panels[0]!,
      withheld: true,
      status: "withheld",
      placeholder_rows: [{ label: "payload_json", value: "sk-secret" }],
    };

    const html = renderToStaticMarkup(<AuditShell projectionPanels={panels} />);

    expect(html).toContain('data-audit-panel-id="replay_timeline"');
    expect(html).toContain('data-panel-status="withheld"');
    expect(html).toContain("State");
    expect(html).toContain("withheld");
    expect(html).not.toContain("sk-secret");
    expect(html).not.toContain("payload_json");
  });

  it("preserves disabled affordances in supplied data without rendering controls", () => {
    const panels = projectionPanels();
    const html = renderToStaticMarkup(<AuditShell projectionPanels={panels} />);

    for (const panel of panels) {
      expect(panel.disabled_affordances).toEqual(AUDIT_DISABLED_AFFORDANCES);
      expect(panel.disabled_affordances).toEqual(
        expect.arrayContaining(["replay_execute", "graph_execute"]),
      );
    }
    expect(html).not.toMatch(/<button\b/i);
    expect(html).not.toMatch(/<form\b/i);
    expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
    expect(html).not.toMatch(/<a\b/i);
    expect(html).not.toMatch(/\brole="button"/i);
    expect(html).not.toMatch(
      /\b(approve|run|retry|execute|mutate|schedule|replay_execute|graph_execute)\b/i,
    );
  });

  it("does not expose replay or graph execution affordances", () => {
    const html = renderToStaticMarkup(
      <AuditShell projectionPanels={projectionPanels()} />,
    );

    expect(html).not.toMatch(
      /replay execution|start replay|rerun|graph execution|graph-driven execution|dependency action|execute replay|execute graph/i,
    );
  });

  it("does not add automatic fetching, polling, IPC, store access, or execution imports", () => {
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|setInterval|setTimeout|poll/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|createObservabilityApi|queryRecentTraces|queryTelemetryRollups/i,
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
    panels[1] = {
      ...panels[1]!,
      placeholder_rows: [{ label: "Prompt", value: "hidden-token" }],
    };

    const html = renderToStaticMarkup(<AuditShell projectionPanels={panels} />);

    expect(html).toContain("State");
    expect(html).toContain("withheld");
    expect(html).not.toMatch(
      /raw_payload|prompt|model output|transcript|frame bytes|secret|token|hidden-token/i,
    );
  });
});
