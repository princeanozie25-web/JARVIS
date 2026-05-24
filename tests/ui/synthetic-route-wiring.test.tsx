import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AuditPage from "../../src/app/audit/page";
import RestPage from "../../src/app/rest/page";
import WorkingPage from "../../src/app/working/page";
import { WorkingShell } from "../../src/components/working/WorkingShell";
import {
  SYNTHETIC_OBSERVABILITY_MARKER,
  malformedSyntheticWorkingPanels,
} from "../../src/lib/observability/synthetic-data";

const SYNTHETIC_ROUTE_SOURCE_FILES = [
  "src/lib/observability/synthetic-data.ts",
  "src/app/rest/page.tsx",
  "src/app/working/page.tsx",
  "src/app/audit/page.tsx",
] as const;

const COMPONENT_SOURCE_FILES = [
  "src/components/orb/Orb.tsx",
  "src/components/working/WorkingShell.tsx",
  "src/components/audit/AuditShell.tsx",
] as const;

function sourceText(files: readonly string[]) {
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

function assertNoControls(html: string) {
  expect(html).not.toMatch(/<button\b/i);
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
  expect(html).not.toMatch(/<a\b/i);
  expect(html).not.toMatch(/\brole="button"/i);
  expect(html).not.toMatch(
    /\b(approve|run|retry|execute|mutate|schedule|replay_execute|graph_execute)\b/i,
  );
}

describe("Phase 12F.1 synthetic route-level projection wiring", () => {
  it("/rest route renders projection-backed synthetic orb metadata", () => {
    const html = renderToStaticMarkup(<RestPage />);

    expect(html).toContain(SYNTHETIC_OBSERVABILITY_MARKER);
    expect(html).toContain("Synthetic demo-safe only");
    expect(html).toContain('data-orb-mode="working"');
    expect(html).toContain('data-load-band="active"');
    expect(html).toContain("JARVIS Room OS - Working Signal");
    expect(html).toContain("Routine completed.");
    assertNoControls(html);
  });

  it("/working route renders projection-backed synthetic panels", () => {
    const html = renderToStaticMarkup(<WorkingPage />);

    expect(html).toContain(SYNTHETIC_OBSERVABILITY_MARKER);
    expect(html).toContain("synthetic known");
    expect(html).toContain("demo current");
    expect(html).toContain("Synthetic demo-safe metadata");
    expect(html).toContain('data-panel-id="room_state"');
    expect(html).toContain('data-panel-status="placeholder"');
    assertNoControls(html);
  });

  it("/audit route renders projection-backed synthetic panels", () => {
    const html = renderToStaticMarkup(<AuditPage />);

    expect(html).toContain(SYNTHETIC_OBSERVABILITY_MARKER);
    expect(html).toContain("synthetic 3");
    expect(html).toContain("Replay path");
    expect(html).toContain("Graph path");
    expect(html).toContain('data-audit-panel-id="replay_timeline"');
    expect(html).toContain('data-panel-status="placeholder"');
    assertNoControls(html);
    expect(html).not.toMatch(
      /replay execution|start replay|execute replay|graph execution|execute graph|graph-driven execution/i,
    );
  });

  it("keeps route and synthetic wiring free of store, network, IPC, timers, providers, room execution, and HTTP routes", () => {
    const source = sourceText(SYNTHETIC_ROUTE_SOURCE_FILES);

    expect(source).not.toMatch(
      /store\/|event-store|better-sqlite3|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db|db\./i,
    );
    expect(source).not.toMatch(
      /createObservabilityApi|initializeEventStore|readRoomStateProjection|readRecentTracesProjection|readTelemetryRollupsProjection/i,
    );
    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|ReadableStream|setInterval|setTimeout|poll/i,
    );
    expect(source).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|provider runtime|model runtime|openai|anthropic|ollama/i,
    );
    expect(source).not.toMatch(
      /room\/adapters|fake-room-adapter|executeCommand|commandRoom|replay_execute|graph_execute|executeReplay|executeGraph/i,
    );
    expect(source).not.toMatch(
      /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/,
    );
  });

  it("keeps components free of direct store and SQLite imports", () => {
    expect(sourceText(COMPONENT_SOURCE_FILES)).not.toMatch(
      /store\/|event-store|better-sqlite3|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db|db\./i,
    );
  });

  it("malformed synthetic data still fails closed through component guards", () => {
    const html = renderToStaticMarkup(
      <WorkingShell projectionPanels={malformedSyntheticWorkingPanels()} />,
    );

    expect(html).toContain('data-panel-id="room_state"');
    expect(html).toContain('data-panel-status="withheld"');
    expect(html).toContain("State");
    expect(html).toContain("withheld");
    expect(html).not.toContain("sk-secret");
    expect(html).not.toContain("payload_json");
  });
});
