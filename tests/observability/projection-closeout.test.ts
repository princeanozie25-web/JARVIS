import { existsSync, readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RestPage from "../../src/app/rest/page";
import WorkingPage from "../../src/app/working/page";
import AuditPage from "../../src/app/audit/page";
import { createAuditProjectionViewModels } from "../../src/components/audit/projection-adapter";
import {
  AUDIT_DISABLED_AFFORDANCES,
  listAuditPanels,
} from "../../src/components/audit/panel-registry";
import { createOrbProjectionTokens } from "../../src/components/orb/projection-adapter";
import { IDLE_ORB_STATE } from "../../src/components/orb/state-tokens";
import { createWorkingProjectionViewModels } from "../../src/components/working/projection-adapter";
import {
  WORKING_DISABLED_AFFORDANCES,
  listWorkingPanels,
} from "../../src/components/working/panel-registry";
import { createObservabilityApi } from "../../src/lib/observability/api";
import type { OrbVisualState } from "../../src/components/orb/types";
import type {
  ObservabilityApi,
  ObservabilityResponse,
} from "../../src/lib/observability/contracts";

const OBSERVABILITY_FILES = [
  "src/lib/observability/api.ts",
  "src/lib/observability/contracts.ts",
] as const;

const UI_ADAPTER_FILES = [
  "src/components/orb/projection-adapter.ts",
  "src/components/working/projection-adapter.ts",
  "src/components/audit/projection-adapter.ts",
] as const;

const UI_SHELL_FILES = [
  "src/app/rest/page.tsx",
  "src/app/working/page.tsx",
  "src/app/audit/page.tsx",
  "src/components/orb/Orb.tsx",
  "src/components/working/WorkingCockpit.tsx",
  "src/components/working/WorkingShell.tsx",
  "src/components/audit/AuditCockpit.tsx",
  "src/components/audit/AuditShell.tsx",
] as const;

interface ProjectionPostureStub {
  readonly metadata_only: true;
  readonly raw_payload_included: false;
  readonly secrets_included: false;
  readonly executable_payload_included: false;
  readonly network_called: false;
  readonly ui_rendered: false;
}

const PROJECTION_POSTURE: ProjectionPostureStub = Object.freeze({
  metadata_only: true,
  raw_payload_included: false,
  secrets_included: false,
  executable_payload_included: false,
  network_called: false,
  ui_rendered: false,
});

function readFiles(files: readonly string[]) {
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
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
  expect(html.match(/data-human-gate-panel="true"/g)).toHaveLength(4);
  expect(html.match(/wc-gate-approve/g)).toHaveLength(4);
  expect(html.match(/wc-gate-deny/g)).toHaveLength(4);
  expect(html).toContain('data-read-only-context-panel="true"');
  expect(html).toContain("FAKE ADAPTER");
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
    expect.arrayContaining([
      "/rest",
      "/working",
      "/audit",
      "#audit-trace",
      "#audit-architecture",
      "#audit-telemetry",
      "#audit-governance",
    ]),
  );
  expect(
    hrefs.every((href) => href.startsWith("/") || href.startsWith("#")),
  ).toBe(true);
  expect(html).not.toMatch(/\brole="button"/i);
  expect(html).not.toMatch(
    /\b(approve|run|retry|execute|schedule|replay_execute|graph_execute)\b/i,
  );
}

function response<T>(
  data: T,
  options: Partial<ObservabilityResponse<T>> = {},
): ObservabilityResponse<T> {
  return {
    status: "ok",
    classification: "metadata_only",
    authority: "read_only",
    replay_safe: false,
    data,
    errors: [],
    withheld: false,
    redaction: {
      metadata_only: true,
      raw_payload_included: false,
      secrets_included: false,
      executable_payload_included: false,
      unsafe_payload_withheld: false,
    },
    ...options,
  };
}

function validApi(): ObservabilityApi {
  return {
    queryRoomState: () =>
      response({
        projection_status: "ok",
        room_status: "known",
        stale: false,
        summaries: [],
        errors: [],
        posture: PROJECTION_POSTURE,
      }),
    queryRecentTraces: () =>
      response(
        {
          projection_status: "ok",
          traces: [
            {
              replay_trace_id: "trace-1",
              event_id: "event-1",
              trace_kind: "routine_completed",
              occurred_at_ms: 1,
              metadata_only: true,
              raw_payload_included: false,
              executable_payload_included: false,
              run_affordance: false,
              retry_affordance: false,
            },
          ],
          errors: [],
          posture: PROJECTION_POSTURE,
        },
        { replay_safe: true },
      ),
    queryTelemetryRollups: () =>
      response({
        projection_status: "ok",
        telemetry_by_scope: [{ key: "room", count: 1 }],
        telemetry_by_severity: [{ key: "info", count: 1 }],
        runtime_by_status: [{ key: "completed", count: 1 }],
        model_calls_by_provider: [{ key: "local", count: 1 }],
        model_calls_by_aux_task: [],
        errors: [],
        posture: PROJECTION_POSTURE,
      }),
    queryAuditPanelMetadata: () =>
      response(listAuditPanels(), { replay_safe: true }),
    queryOrbStateMetadata: () => response<OrbVisualState>(IDLE_ORB_STATE),
    queryWorkingPanelMetadata: () => response(listWorkingPanels()),
  };
}

function unsafeApi(): ObservabilityApi {
  const unsafe = {
    status: "withheld",
    classification: "metadata_only",
    authority: "read_only",
    replay_safe: false,
    data: null,
    errors: ["unsafe_projection_payload"],
    withheld: true,
    redaction: {
      metadata_only: true,
      raw_payload_included: false,
      secrets_included: false,
      executable_payload_included: false,
      unsafe_payload_withheld: true,
    },
  } as const;

  return {
    ...validApi(),
    queryRoomState: () => unsafe,
    queryRecentTraces: () => ({ ...unsafe, replay_safe: true }),
    queryTelemetryRollups: () =>
      ({
        status: "ok",
        classification: "public",
        authority: "write",
        data: { payload_json: "sk-secret" },
        redaction: { metadata_only: false },
      }) as never,
    queryAuditPanelMetadata: () => unsafe,
    queryOrbStateMetadata: () => unsafe,
    queryWorkingPanelMetadata: () => unsafe,
  };
}

describe("Phase 12D.5 projection adapter closeout guards", () => {
  it("keeps the Observability API query-only with no mutation method surface", () => {
    const api = createObservabilityApi({
      databasePath: "unused.sqlite",
      projectionReaders: {
        roomState: () => ({ projection_status: "ok", errors: [] }),
        recentTraces: () => ({ projection_status: "ok", errors: [] }),
        telemetryRollups: () => ({ projection_status: "ok", errors: [] }),
      },
    });
    const methodNames = Object.keys(api);

    expect(methodNames).toEqual([
      "queryRoomState",
      "queryRecentTraces",
      "queryTelemetryRollups",
      "queryAuditPanelMetadata",
      "queryOrbStateMetadata",
      "queryWorkingPanelMetadata",
    ]);
    expect(methodNames.every((name) => name.startsWith("query"))).toBe(true);
    expect(
      methodNames.some((name) =>
        /insert|update|delete|append|mutate|execute|approve|retry|run|schedule|raw|sql|db|handle/i.test(
          name,
        ),
      ),
    ).toBe(false);
  });

  it("does not add Observability HTTP routes, websocket, streaming, polling, or Tauri IPC", () => {
    expect(existsSync("src/app/api/observability/route.ts")).toBe(false);
    expect(existsSync("app/api/observability/route.ts")).toBe(false);

    const source = readFiles([...OBSERVABILITY_FILES, ...UI_ADAPTER_FILES]);
    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|ReadableStream|stream\(|setInterval|setTimeout|poll/i,
    );
    expect(source).not.toMatch(
      /node:http|node:https|createServer|listen\(|invoke\(|@tauri-apps|tauri::command/i,
    );
  });

  it("keeps UI projection adapters disconnected from direct DB, store, provider, model, and room execution imports", () => {
    const source = readFiles(UI_ADAPTER_FILES);

    expect(source).not.toMatch(
      /store\/|event-store|better-sqlite3|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db|rawDb|db\./i,
    );
    expect(source).not.toMatch(
      /openai|anthropic|ollama|provider runtime|model runtime|room\/adapters|fake-room-adapter|executeCommand|commandRoom/i,
    );
  });

  it("exposes no approval, suggestion, replay, graph, button, form, or action affordance model from adapters", async () => {
    const modules = [
      await import("../../src/components/orb/projection-adapter"),
      await import("../../src/components/working/projection-adapter"),
      await import("../../src/components/audit/projection-adapter"),
    ];
    const exportNames = modules.flatMap((module) => Object.keys(module));
    const source = readFiles(UI_ADAPTER_FILES);

    expect(exportNames).toEqual([
      "createOrbProjectionTokens",
      "createWorkingProjectionViewModels",
      "createAuditProjectionViewModels",
    ]);
    expect(
      exportNames.some((name) =>
        /insert|update|delete|append|mutate|execute|approve|retry|run|schedule|action|capture|record|listen/i.test(
          name,
        ),
      ),
    ).toBe(false);
    expect(source).not.toMatch(
      /<button|<form|<input|role=["']button|onClick|onSubmit|suggestionAction|approvalAction|replay_execute|graph_execute|executeReplay|executeGraph|runReplay|graphAction/i,
    );
  });

  it("fails all projection adapters closed on malformed or unsafe Observability responses", () => {
    const api = unsafeApi();
    const orbTokens = createOrbProjectionTokens(api);
    const workingPanels = createWorkingProjectionViewModels(api);
    const auditPanels = createAuditProjectionViewModels(api);

    expect(orbTokens).toEqual({
      mode: "degraded",
      load_band: "idle",
      last_event_class: "error",
      governance_posture: "gated_active",
      heartbeat: "unavailable",
    });
    expect(workingPanels.every((panel) => panel.withheld)).toBe(true);
    expect(auditPanels.every((panel) => panel.withheld)).toBe(true);
    expect(
      JSON.stringify({ orbTokens, workingPanels, auditPanels }),
    ).not.toContain("sk-secret");
  });

  it("keeps adapter outputs metadata-only, read-only, disabled-affordance preserving, and defensive", () => {
    const api = validApi();
    const firstOrb = createOrbProjectionTokens(api);
    const firstWorking = createWorkingProjectionViewModels(api);
    const firstAudit = createAuditProjectionViewModels(api);

    (firstOrb as { mode: string }).mode = "mutated";
    (firstWorking as unknown as Array<{ title: string }>)[0]!.title = "mutated";
    (firstAudit as unknown as Array<{ title: string }>)[0]!.title = "mutated";

    const secondOrb = createOrbProjectionTokens(api);
    const secondWorking = createWorkingProjectionViewModels(api);
    const secondAudit = createAuditProjectionViewModels(api);

    expect(secondOrb).toMatchObject({
      mode: "working",
      governance_posture: "all_green",
    });
    for (const panel of secondWorking) {
      expect(panel).toMatchObject({
        data_classification: "metadata_only",
        authority: "read_only",
        refresh_policy: "static_placeholder",
        metadataOnly: true,
        localOnly: true,
        shellAuthority: "none",
      });
      expect(panel.disabled_affordances).toEqual(WORKING_DISABLED_AFFORDANCES);
    }
    for (const panel of secondAudit) {
      expect(panel).toMatchObject({
        data_classification: "metadata_only",
        authority: "read_only",
        refresh_policy: "static_placeholder",
        metadataOnly: true,
        localOnly: true,
        shellAuthority: "none",
      });
      expect(panel.disabled_affordances).toEqual(AUDIT_DISABLED_AFFORDANCES);
    }
  });

  it("keeps Rest, Working, and Audit routes free of projection adapters and live transports", () => {
    const source = readFiles(UI_SHELL_FILES);
    const restHtml = renderToStaticMarkup(createElement(RestPage));
    const workingHtml = renderToStaticMarkup(createElement(WorkingPage));
    const auditHtml = renderToStaticMarkup(createElement(AuditPage));

    expect(source).not.toMatch(
      /projection-adapter|createOrbProjectionTokens|createWorkingProjectionViewModels|createAuditProjectionViewModels|createObservabilityApi|queryRoomState|queryRecentTraces|queryTelemetryRollups|queryOrbStateMetadata/i,
    );
    expect(source).not.toMatch(
      /setInterval|setTimeout|poll|fetch\(|WebSocket|EventSource|invoke\(/i,
    );
    expect(restHtml).toContain("Synthetic demo-safe only");
    expect(workingHtml).toContain("Working Cockpit");
    expect(workingHtml).toContain("Human Gate");
    expect(auditHtml).toContain("Audit Mode");
    expect(auditHtml).toContain('data-audit-cockpit="read-only-fortress"');
    assertWorkingGateControlsOnly(workingHtml);
    assertAuditZeroMutation(auditHtml);
    expect([restHtml, auditHtml].join("\n")).not.toMatch(
      /<button\b|<form\b|<input\b|<textarea\b|<select\b|role="button"/i,
    );
  });
});
