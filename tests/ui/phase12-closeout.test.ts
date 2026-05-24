import { existsSync, readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AuditPage from "../../src/app/audit/page";
import RestPage from "../../src/app/rest/page";
import WorkingPage from "../../src/app/working/page";
import { AuditShell } from "../../src/components/audit/AuditShell";
import { Orb } from "../../src/components/orb/Orb";
import { IDLE_ORB_STATE } from "../../src/components/orb/state-tokens";
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

type TauriConfig = {
  build?: { devUrl?: string; frontendDist?: string };
  app?: {
    windows?: Array<{ url?: string }>;
    security?: { csp?: string | null; capabilities?: string[] };
    withGlobalTauri?: boolean;
  };
  bundle?: { active?: boolean; createUpdaterArtifacts?: boolean };
  plugins?: Record<string, unknown>;
};

const TAURI_CONFIG_PATH = "src-tauri/tauri.conf.json";
const TAURI_MAIN_PATH = "src-tauri/src/main.rs";
const TAURI_CAPABILITY_PATH = "src-tauri/capabilities/default.json";

const UI_ROUTE_FILES = [
  "src/app/rest/page.tsx",
  "src/app/working/page.tsx",
  "src/app/audit/page.tsx",
] as const;

const UI_COMPONENT_FILES = [
  "src/components/orb/Orb.tsx",
  "src/components/working/WorkingShell.tsx",
  "src/components/audit/AuditShell.tsx",
] as const;

const SYNTHETIC_FILES = [
  "src/lib/observability/synthetic-data.ts",
  "src/lib/observability/demo-safety.ts",
] as const;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sourceText(files: readonly string[]) {
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

function commandCenterHtml() {
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
  expect(html).not.toMatch(/<a\b/i);
  expect(html).not.toMatch(/\brole="button"/i);
  expect(html).not.toMatch(
    /\b(run|retry|approve|execute|mutate|schedule|replay_execute|graph_execute)\b/i,
  );
}

function assertNoRawContent(html: string) {
  expect(html).not.toMatch(
    /raw_payload|payload_json|prompt body|prompt leaked|model output|ocr text|frame bytes|voice sample|project body|command value|sk-secret|hidden-token/i,
  );
}

function assertLocalUrl(urlText: string) {
  const url = new URL(urlText);
  expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
}

describe("Phase 12G.1 Command Center UI closeout guards", () => {
  it("keeps the Tauri shell bound to localhost or 127.0.0.1 with no public dashboard exposure", () => {
    const config = readJson<TauriConfig>(TAURI_CONFIG_PATH);
    const source = sourceText([
      TAURI_CONFIG_PATH,
      TAURI_MAIN_PATH,
      TAURI_CAPABILITY_PATH,
    ]);
    const urls = [
      config.build?.devUrl,
      config.build?.frontendDist,
      ...(config.app?.windows?.map((windowConfig) => windowConfig.url) ?? []),
      ...(config.app?.security?.csp?.match(/\b(?:http|ws):\/\/[^;\s']+/g) ??
        []),
    ].filter((value): value is string => typeof value === "string");

    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) assertLocalUrl(url);
    expect(source).not.toMatch(/0\.0\.0\.0|\[::\]|ngrok|tunnel|dashboard_url/i);
    expect(config.bundle).toMatchObject({
      active: false,
      createUpdaterArtifacts: false,
    });
    expect(config.plugins).toEqual({});
  });

  it("exposes no mutating Tauri IPC commands or device permissions", () => {
    const source = sourceText([TAURI_MAIN_PATH, TAURI_CAPABILITY_PATH]);
    const capability = readJson<{ permissions?: unknown[] }>(
      TAURI_CAPABILITY_PATH,
    );

    expect(source).not.toMatch(
      /#\[tauri::command\]|invoke_handler|generate_handler/i,
    );
    expect(JSON.stringify(capability.permissions)).toBe("[]");
    expect(source).not.toMatch(
      /approve|approval|execute|retry|mutate|write|device_action|room_command|provider_call|camera|microphone|screen|capture|global-hotkey|filesystem|serial|usb|hid/i,
    );
  });

  it("renders /rest, /working, and /audit with synthetic demo-safe metadata only", () => {
    const html = commandCenterHtml();

    expect(html).toContain(REQUIRED_DEMO_MARKER);
    expect(html).toContain("Synthetic demo-safe only");
    expect(html).toContain('data-orb-mode="working"');
    expect(html).toContain('data-panel-id="room_state"');
    expect(html).toContain('data-audit-panel-id="replay_timeline"');
    assertNoControls(html);
    assertNoRawContent(html);
  });

  it("keeps all route-level data synthetic/demo-safe unless explicitly supplied by tests", () => {
    const routeSource = sourceText(UI_ROUTE_FILES);

    expect(routeSource).toMatch(/synthetic-data/);
    expect(routeSource).not.toMatch(
      /createObservabilityApi|queryRoomState|queryRecentTraces|queryTelemetryRollups|queryOrbStateMetadata|initializeEventStore|readRoomStateProjection|readRecentTracesProjection|readTelemetryRollupsProjection/i,
    );
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
    expect(syntheticWorkingPanels().every((panel) => panel.metadataOnly)).toBe(
      true,
    );
    expect(syntheticAuditPanels().every((panel) => panel.metadataOnly)).toBe(
      true,
    );
  });

  it("adds no observability HTTP routes or public dashboard route for Phase 12 UI", () => {
    expect(existsSync("src/app/api/observability/route.ts")).toBe(false);
    expect(existsSync("app/api/observability/route.ts")).toBe(false);
    expect(existsSync("src/app/api/projections/route.ts")).toBe(false);
    expect(existsSync("app/api/projections/route.ts")).toBe(false);
    expect(existsSync("src/app/dashboard/page.tsx")).toBe(false);
    expect(existsSync("app/dashboard/page.tsx")).toBe(false);
  });

  it("keeps UI routes and components free of direct SQLite/store, network, IPC, provider, model, room, approval, replay, and graph execution paths", () => {
    const source = sourceText([...UI_ROUTE_FILES, ...UI_COMPONENT_FILES]);

    expect(source).not.toMatch(
      /store\/|event-store|better-sqlite3|sqlite|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db|db\./i,
    );
    expect(source).not.toMatch(
      /createObservabilityApi|fetch\(|XMLHttpRequest|WebSocket|EventSource|ReadableStream|setInterval|setTimeout|poll|node:http|node:https|createServer|listen\(/i,
    );
    expect(source).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|provider runtime|model runtime|openai|anthropic|ollama/i,
    );
    expect(source).not.toMatch(
      /room\/adapters|fake-room-adapter|executeCommand|commandRoom|approval service|executeReplay|executeGraph|runReplay|graphAction/i,
    );
    expect(source).not.toMatch(/<button|<form|onClick|onSubmit/i);
  });

  it("keeps synthetic and demo-safety modules pure, local, metadata-only, and non-authoritative", () => {
    const source = sourceText(SYNTHETIC_FILES);

    expect(source).toMatch(/live_data_access: false/);
    expect(source).toMatch(/persistence_access: false/);
    expect(source).toMatch(/authority: "read_only"/);
    expect(source).toMatch(/classification: "metadata_only"/);
    expect(source).not.toMatch(
      /store\/|event-store|better-sqlite3|fetch\(|WebSocket|EventSource|setInterval|setTimeout|invoke\(|@tauri-apps|openai|anthropic|ollama|room\/adapters|executeCommand|commandRoom/i,
    );
  });

  it("fails malformed or unsafe projection data closed across Rest, Working, and Audit surfaces", () => {
    const workingHtml = renderToStaticMarkup(
      createElement(WorkingShell, {
        projectionPanels: malformedSyntheticWorkingPanels(),
      }),
    );
    const auditPanels = syntheticAuditPanels().map((panel) =>
      panel.panel_id === "replay_timeline"
        ? {
            ...panel,
            withheld: true,
            status: "withheld" as const,
            placeholder_rows: [{ label: "payload_json", value: "sk-secret" }],
          }
        : panel,
    );
    const auditHtml = renderToStaticMarkup(
      createElement(AuditShell, { projectionPanels: auditPanels }),
    );
    const orbHtml = renderToStaticMarkup(
      createElement(Orb, {
        projectionState: {
          ...IDLE_ORB_STATE,
          label: "sk-secret-label",
          detailText: "hidden-token",
          withheld: true,
        },
      }),
    );
    const unsafeValidation = validateDemoSafety(
      createDemoSafetyEnvelope({ command_value: "turn on real light" }),
    );
    const html = [workingHtml, auditHtml, orbHtml].join("\n");

    expect(workingHtml).toContain('data-panel-status="withheld"');
    expect(auditHtml).toContain('data-panel-status="withheld"');
    expect(orbHtml).toContain('data-orb-mode="degraded"');
    expect(orbHtml).toContain('data-withheld="true"');
    expect(unsafeValidation).toMatchObject({
      ok: false,
      data: null,
      errors: ["unsafe_demo_payload"],
    });
    assertNoRawContent(html);
  });

  it("does not render action controls or disabled affordance names as controls anywhere in the Command Center routes", () => {
    const html = commandCenterHtml();

    assertNoControls(html);
    expect(html).not.toMatch(
      /replay execution|start replay|execute replay|graph execution|execute graph|graph-driven execution|dependency action|approval execution/i,
    );
  });
});
