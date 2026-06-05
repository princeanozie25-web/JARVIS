import { existsSync, readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AuditPage from "../../src/app/audit/page";
import RestPage from "../../src/app/rest/page";
import WorkingPage from "../../src/app/working/page";
import { WorkingShell } from "../../src/components/working/WorkingShell";
import {
  REQUIRED_DEMO_MARKER,
  createDemoSafetyEnvelope,
  validateDemoSafety,
} from "../../src/lib/observability/demo-safety";
import {
  SYNTHETIC_REST_ORB_DATASET,
  malformedSyntheticWorkingPanels,
  syntheticAuditPanels,
  syntheticWorkingPanels,
} from "../../src/lib/observability/synthetic-data";

const ROUTE_AND_SYNTHETIC_FILES = [
  "src/app/rest/page.tsx",
  "src/app/working/page.tsx",
  "src/app/audit/page.tsx",
  "src/lib/observability/synthetic-data.ts",
  "src/lib/observability/demo-safety.ts",
] as const;

function sourceText(files: readonly string[]) {
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

function routeHtml() {
  return [
    renderToStaticMarkup(createElement(RestPage)),
    renderToStaticMarkup(createElement(WorkingPage)),
    renderToStaticMarkup(createElement(AuditPage)),
  ].join("\n");
}

function assertNoControls(html: string) {
  expect(html).not.toMatch(/<button\b/i);
  expect(html).not.toMatch(/<form\b/i);
  expect(html).not.toMatch(/<input\b|<textarea\b|<select\b/i);
  assertOnlySafeNavigationLinks(html);
  expect(html).not.toMatch(/\brole="button"/i);
  expect(html).not.toMatch(
    /\b(approve|run|retry|execute|mutate|schedule|replay_execute|graph_execute)\b/i,
  );
}

function assertOnlySafeNavigationLinks(html: string) {
  const anchors = html.match(/<a\b[^>]*>/gi) ?? [];
  expect(anchors.length).toBeLessThanOrEqual(1);
  if (anchors.length === 1) {
    expect(anchors[0]).toContain('href="/audit/gauntlet"');
    expect(anchors[0]).toContain(
      'data-audit-gauntlet-nav-link="cinematic-gauntlet"',
    );
  }
}

describe("Phase 12F.3 synthetic demo closeout guards", () => {
  it("renders /rest, /working, and /audit with synthetic demo-safe data only", () => {
    const html = routeHtml();

    expect(html).toContain(REQUIRED_DEMO_MARKER);
    expect(html).toContain("Synthetic demo-safe only");
    expect(html).toContain('data-orb-mode="working"');
    expect(html).toContain("synthetic known");
    expect(html).toContain("synthetic 3");
    assertNoControls(html);
  });

  it("keeps synthetic datasets marked read-only, metadata-only, local, and non-persistent", () => {
    expect(SYNTHETIC_REST_ORB_DATASET).toMatchObject({
      marker: REQUIRED_DEMO_MARKER,
      source: "synthetic",
      live_data_access: false,
      persistence_access: false,
      authority: "read_only",
      classification: "metadata_only",
    });
    expect(validateDemoSafety(SYNTHETIC_REST_ORB_DATASET)).toMatchObject({
      ok: true,
      errors: [],
    });
    for (const panel of syntheticWorkingPanels()) {
      expect(panel).toMatchObject({
        data_classification: "metadata_only",
        authority: "read_only",
        localOnly: true,
        shellAuthority: "none",
      });
    }
    for (const panel of syntheticAuditPanels()) {
      expect(panel).toMatchObject({
        data_classification: "metadata_only",
        authority: "read_only",
        localOnly: true,
        shellAuthority: "none",
      });
    }
  });

  it("has no Observability HTTP route or live projection route added", () => {
    expect(existsSync("src/app/api/observability/route.ts")).toBe(false);
    expect(existsSync("app/api/observability/route.ts")).toBe(false);
    expect(existsSync("src/app/api/projections/route.ts")).toBe(false);
    expect(existsSync("app/api/projections/route.ts")).toBe(false);
  });

  it("keeps route and synthetic source isolated from DB, stores, transports, IPC, providers, room execution, and approval/replay/graph execution", () => {
    const source = sourceText(ROUTE_AND_SYNTHETIC_FILES);

    expect(source).not.toMatch(
      /store\/|event-store|better-sqlite3|sqlite|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db|db\./i,
    );
    expect(source).not.toMatch(
      /createObservabilityApi|initializeEventStore|readRoomStateProjection|readRecentTracesProjection|readTelemetryRollupsProjection/i,
    );
    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|ReadableStream|setInterval|setTimeout|poll|node:http|node:https|createServer|listen\(/i,
    );
    expect(source).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|provider runtime|model runtime|openai|anthropic|ollama/i,
    );
    expect(source).not.toMatch(
      /room\/adapters|fake-room-adapter|executeCommand|commandRoom|approval service|executeReplay|executeGraph|runReplay|graphAction/i,
    );
  });

  it("keeps malformed or unsafe synthetic data fail-closed", () => {
    const unsafeValidation = validateDemoSafety(
      createDemoSafetyEnvelope({ payload_json: "sk-secret" }),
    );
    const html = renderToStaticMarkup(
      createElement(WorkingShell, {
        projectionPanels: malformedSyntheticWorkingPanels(),
      }),
    );

    expect(unsafeValidation).toMatchObject({
      ok: false,
      data: null,
      errors: ["unsafe_demo_payload"],
    });
    expect(html).toContain('data-panel-id="room_state"');
    expect(html).toContain('data-panel-status="withheld"');
    expect(html).toContain("State");
    expect(html).toContain("withheld");
    expect(html).not.toContain("sk-secret");
    expect(html).not.toContain("payload_json");
  });
});
