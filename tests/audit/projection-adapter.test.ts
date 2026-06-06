import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createAuditProjectionViewModels } from "../../src/components/audit/projection-adapter";
import { AUDIT_DISABLED_AFFORDANCES } from "../../src/components/audit/panel-registry";
import type {
  ObservabilityApi,
  ObservabilityResponse,
} from "../../src/lib/observability/contracts";
import type { RecentTracesProjection } from "../../src/store/projections/recent-traces";
import type { TelemetryRollupsProjection } from "../../src/store/projections/telemetry-rollups";

const ADAPTER_SOURCE_FILES = [
  "src/components/audit/projection-adapter.ts",
  "src/components/audit/types.ts",
] as const;

function sourceText() {
  return ADAPTER_SOURCE_FILES.map((file) => readFileSync(file, "utf8")).join(
    "\n",
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

function apiStub(
  overrides: Partial<
    Pick<
      ObservabilityApi,
      "queryRecentTraces" | "queryTelemetryRollups" | "queryAuditPanelMetadata"
    >
  > = {},
): Pick<
  ObservabilityApi,
  "queryRecentTraces" | "queryTelemetryRollups" | "queryAuditPanelMetadata"
> {
  return {
    queryRecentTraces: () =>
      response<RecentTracesProjection>(
        {
          projection_status: "ok",
          traces: [
            {
              replay_trace_id: "trace-1",
              event_id: "event-1",
              trace_kind: "room-event",
              occurred_at_ms: 1,
              metadata_only: true,
              raw_payload_included: false,
              executable_payload_included: false,
              run_affordance: false,
              retry_affordance: false,
            },
          ],
          errors: [],
          posture: {
            metadata_only: true,
            raw_payload_included: false,
            secrets_included: false,
            executable_payload_included: false,
            network_called: false,
            ui_rendered: false,
          },
        },
        { replay_safe: true },
      ),
    queryTelemetryRollups: () =>
      response<TelemetryRollupsProjection>({
        projection_status: "ok",
        telemetry_by_scope: [{ key: "redaction", count: 2 }],
        telemetry_by_severity: [{ key: "info", count: 2 }],
        runtime_by_status: [{ key: "completed", count: 1 }],
        model_calls_by_provider: [{ key: "local-fake", count: 1 }],
        model_calls_by_aux_task: [],
        errors: [],
        posture: {
          metadata_only: true,
          raw_payload_included: false,
          secrets_included: false,
          executable_payload_included: false,
          network_called: false,
          ui_rendered: false,
        },
      }),
    queryAuditPanelMetadata: () =>
      response([
        {
          panel_id: "replay_timeline",
          title: "Replay timeline",
          description: "Replay placeholder",
          source_phase: "12C.2",
          data_classification: "metadata_only",
          authority: "read_only",
          refresh_policy: "static_placeholder",
          disabled_affordances: AUDIT_DISABLED_AFFORDANCES,
          placeholder_rows: [{ label: "Timeline", value: "static" }],
          eyebrow: "Forensics",
          status: "placeholder",
          posture: "inspection_only",
          metadataOnly: true,
          localOnly: true,
          shellAuthority: "none",
          withheld: false,
        },
      ] as never),
    ...overrides,
  };
}

describe("Phase 12D.3 Audit projection adapter", () => {
  it("maps valid Observability API responses to Audit panel view models", () => {
    const panels = createAuditProjectionViewModels(apiStub());

    expect(panels.map((panel) => panel.panel_id)).toEqual([
      "replay_timeline",
      "trace_viewer",
      "governance_boundary",
      "runtime_dependency",
      "redaction_status",
      "disabled_feature_matrix",
    ]);
    expect(
      panels.find((panel) => panel.panel_id === "replay_timeline"),
    ).toMatchObject({
      status: "placeholder",
      withheld: false,
      projectionBacked: true,
      placeholder_rows: expect.arrayContaining([
        { label: "Traces", value: "1" },
        { label: "Replay safe", value: "metadata only" },
      ]),
    });
    expect(
      panels.find((panel) => panel.panel_id === "trace_viewer"),
    ).toMatchObject({
      projectionBacked: true,
      placeholder_rows: expect.arrayContaining([
        { label: "Latest kind", value: "room-event" },
        { label: "Errors", value: "0" },
      ]),
    });
    expect(
      panels.find((panel) => panel.panel_id === "redaction_status"),
    ).toMatchObject({
      projectionBacked: true,
      placeholder_rows: expect.arrayContaining([
        { label: "Scopes", value: "1" },
        { label: "Payloads", value: "withheld" },
        { label: "Secrets", value: "withheld" },
      ]),
    });
    expect(
      panels.find((panel) => panel.panel_id === "disabled_feature_matrix"),
    ).toMatchObject({
      projectionBacked: true,
      placeholder_rows: expect.arrayContaining([
        { label: "Disabled", value: "8" },
        { label: "Replay path", value: "absent" },
        { label: "Graph path", value: "absent" },
      ]),
    });
  });

  it("keeps governance and runtime dependency panels static unless safe metadata exists", () => {
    const panels = createAuditProjectionViewModels(apiStub());
    const governancePanel = panels.find(
      (panel) => panel.panel_id === "governance_boundary",
    );
    const runtimePanel = panels.find(
      (panel) => panel.panel_id === "runtime_dependency",
    );

    expect(governancePanel).toMatchObject({
      placeholder_rows: expect.arrayContaining([
        { label: "Boundary", value: "visible" },
      ]),
    });
    expect(runtimePanel).toMatchObject({
      placeholder_rows: expect.arrayContaining([
        { label: "Graph", value: "placeholder" },
      ]),
    });
    expect(governancePanel).not.toHaveProperty("projectionBacked");
    expect(runtimePanel).not.toHaveProperty("projectionBacked");
  });

  it("fails closed to withheld placeholders when responses are unsafe or malformed", () => {
    const panels = createAuditProjectionViewModels(
      apiStub({
        queryRecentTraces: () =>
          response<RecentTracesProjection>(
            {
              projection_status: "ok",
              payload_json: "sk-secret",
            } as never,
            {
              status: "withheld",
              data: null,
              withheld: true,
              errors: ["unsafe_projection_payload"],
              redaction: {
                metadata_only: true,
                raw_payload_included: false,
                secrets_included: false,
                executable_payload_included: false,
                unsafe_payload_withheld: true,
              },
            },
          ),
        queryTelemetryRollups: () =>
          ({
            status: "ok",
            classification: "public",
            authority: "write",
            data: { unsafe: true },
            redaction: { metadata_only: false },
          }) as never,
      }),
    );

    expect(
      panels.find((panel) => panel.panel_id === "replay_timeline"),
    ).toMatchObject({
      status: "withheld",
      withheld: true,
      projectionBacked: false,
      placeholder_rows: [{ label: "State", value: "withheld" }],
    });
    expect(
      panels.find((panel) => panel.panel_id === "redaction_status"),
    ).toMatchObject({
      status: "withheld",
      withheld: true,
      projectionBacked: false,
    });
    expect(JSON.stringify(panels)).not.toContain("sk-secret");
  });

  it("returns defensive copies", () => {
    const first = createAuditProjectionViewModels(apiStub());
    (first as unknown as Array<{ title: string }>)[0]!.title = "mutated";
    (
      first[0]!.placeholder_rows as unknown as Array<{ value: string }>
    )[0]!.value = "mutated";

    const second = createAuditProjectionViewModels(apiStub());

    expect(second[0]).toMatchObject({ title: "Replay timeline" });
    expect(second[0]).toMatchObject({
      placeholder_rows: expect.arrayContaining([
        { label: "Traces", value: "1" },
      ]),
    });
  });

  it("preserves disabled affordances including replay and graph execution", () => {
    const panels = createAuditProjectionViewModels(apiStub());

    for (const panel of panels) {
      expect(panel).toMatchObject({
        data_classification: "metadata_only",
        authority: "read_only",
        refresh_policy: "static_placeholder",
        metadataOnly: true,
        localOnly: true,
        shellAuthority: "none",
      });
      expect(panel.disabled_affordances).toEqual(AUDIT_DISABLED_AFFORDANCES);
      expect(panel.disabled_affordances).toEqual(
        expect.arrayContaining(["replay_execute", "graph_execute"]),
      );
    }
  });

  it("exposes no mutation, action, replay-execute, or graph-execute model", async () => {
    const adapterModule =
      await import("../../src/components/audit/projection-adapter");
    const exportedNames = Object.keys(adapterModule);

    expect(exportedNames).toEqual(["createAuditProjectionViewModels"]);
    expect(
      exportedNames.some((name) =>
        /insert|update|delete|append|mutate|execute|approve|run|retry|schedule|action|replay|graph/i.test(
          name,
        ),
      ),
    ).toBe(false);
  });

  it("does not import store, DB, network, provider, room execution, or Tauri IPC APIs", () => {
    expect(sourceText()).not.toMatch(
      /store\/|event-store|better-sqlite3|SELECT|INSERT|UPDATE|DELETE|raw sql|raw db/i,
    );
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|node:net|node:http|node:https|setInterval|setTimeout|poll/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|openai|anthropic|ollama|provider runtime|model runtime/i,
    );
    expect(sourceText()).not.toMatch(
      /room\/adapters|fake-room-adapter|executeCommand|commandRoom/i,
    );
  });
});
