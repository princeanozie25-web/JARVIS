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
  "src/components/command-center/CommandCenterNav.tsx",
  "src/components/command-center/RestCommandCenter.tsx",
  "src/components/working/WorkingShell.tsx",
  "src/components/audit/AuditCockpit.tsx",
  "src/components/audit/AuditShell.tsx",
] as const;

const COMMAND_CENTER_SAFE_HREFS = [
  "/",
  "/rest",
  "/working",
  "/audit",
  "/audit/pipeline",
] as readonly string[];

function sourceText(files: readonly string[]) {
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

function assertNoControls(html: string) {
  expect(html).not.toMatch(/<button\b/i);
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
  assertOnlySafeNavigationLinks(html);
  expect(html).not.toMatch(/\brole="button"/i);
  expect(html).not.toMatch(
    /data-(execute|approve|mutation)-affordance-present="true"/i,
  );
}

function assertOnlySafeNavigationLinks(html: string) {
  const hrefs = (html.match(/<a\b[^>]*>/gi) ?? []).map(
    (anchor) => anchor.match(/\bhref="([^"]+)"/i)?.[1] ?? "",
  );

  if (hrefs.length === 0) return;
  expect(hrefs.every((href) => COMMAND_CENTER_SAFE_HREFS.includes(href))).toBe(
    true,
  );
}

function buttonLabels(html: string): string[] {
  return Array.from(html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi))
    .map((match) =>
      match[1]!
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function assertWorkingGateControlsOnly(html: string) {
  expect(html).toContain('data-working-layout="approval-gated-cockpit"');
  expect(html).toContain('data-working-cockpit="working-cockpit"');
  expect(html).toContain('data-only-mutator="human-gate"');
  expect(html).toContain('data-only-path-to-side-effects="true"');
  expect(html.match(/data-human-gate-panel="true"/g)).toHaveLength(1);
  expect(html.match(/wc-gate-approve/g)).toHaveLength(1);
  expect(html.match(/wc-gate-deny/g)).toHaveLength(1);
  expect(html).toContain('data-read-only-context-panel="room"');
  expect(html).toContain("OBSERVABILITY");
  expect(buttonLabels(html).join(" ")).not.toMatch(
    /\b(run|retry|execute|mutate|schedule|replay_execute|graph_execute)\b/i,
  );
}

function assertAuditZeroMutation(html: string) {
  expect(html).not.toMatch(/<button\b/i);
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
  const hrefs = (html.match(/<a\b[^>]*>/gi) ?? []).map(
    (anchor) => anchor.match(/\bhref="([^"]+)"/i)?.[1] ?? "",
  );
  expect(hrefs).toEqual(
    expect.arrayContaining(["/rest", "/working", "/audit", "/audit/pipeline"]),
  );
  expect(hrefs.every((href) => href.startsWith("/"))).toBe(true);
  expect(html).not.toMatch(/\brole="button"/i);
  expect(html).not.toMatch(
    /\b(approve|run|retry|execute|schedule|replay_execute|graph_execute)\b/i,
  );
}

describe("Phase 12F.1 synthetic route-level projection wiring", () => {
  it("/rest route renders projection-backed synthetic orb metadata", () => {
    const html = renderToStaticMarkup(<RestPage />);

    expect(html).toContain(SYNTHETIC_OBSERVABILITY_MARKER);
    expect(html).toContain('data-command-center-shell="rest-liquid-glass"');
    expect(html).toContain('data-rest-mutating-affordances="0"');
    expect(html).toContain("SYSTEM STANDBY");
    assertNoControls(html);
  });

  it("/working route renders the approval-gated cockpit with gate-only controls", () => {
    const html = renderToStaticMarkup(<WorkingPage />);

    expect(html).toContain(SYNTHETIC_OBSERVABILITY_MARKER);
    expect(html).toContain("Project");
    expect(html).toContain("Research");
    expect(html).toContain("Build Monitor");
    expect(html).toContain("Morning Brief");
    expect(html).toContain("Human Gate");
    assertWorkingGateControlsOnly(html);
  });

  it("/audit route renders the living read-only audit fortress", () => {
    const html = renderToStaticMarkup(<AuditPage />);

    expect(html).toContain(SYNTHETIC_OBSERVABILITY_MARKER);
    expect(html).toContain("REPLAY VIEWER");
    expect(html).toContain("GOVERNANCE BOUNDARY");
    expect(html).toContain("DISABLED MATRIX");
    expect(html).toContain('data-audit-cockpit="read-only-fortress"');
    expect(html).toContain('data-replay-non-executable="true"');
    expect(html).toContain('data-tripwire-status="armed"');
    assertAuditZeroMutation(html);
    expect(html).not.toMatch(
      /replay execution|start replay|execute replay|graph execution|execute graph|graph-driven execution/i,
    );
  });

  it("keeps route and synthetic wiring free of store, network, IPC, timers, providers, room execution, and HTTP routes", () => {
    const source = sourceText(SYNTHETIC_ROUTE_SOURCE_FILES);

    expect(source).not.toMatch(
      /store\/|event-store|better-sqlite3|\b(SELECT|INSERT|UPDATE|DELETE)\s+(FROM|INTO|SET)?|raw sql|raw db|db\./i,
    );
    expect(source).not.toMatch(
      /initializeEventStore|readRoomStateProjection|readRecentTracesProjection|readTelemetryRollupsProjection/i,
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
      /event-store|better-sqlite3|\b(SELECT|INSERT|UPDATE|DELETE)\s+(FROM|INTO|SET)?|raw sql|raw db|db\./i,
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
