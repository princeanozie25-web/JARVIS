import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createWorkingProjectionViewModels } from "../../src/components/working/projection-adapter";
import { WORKING_DISABLED_AFFORDANCES } from "../../src/components/working/panel-registry";
import type {
  ObservabilityApi,
  ObservabilityResponse,
} from "../../src/lib/observability/contracts";
import type { RecentTracesProjection } from "../../src/store/projections/recent-traces";
import type { RoomStateProjection } from "../../src/store/projections/room-state";
import type { TelemetryRollupsProjection } from "../../src/store/projections/telemetry-rollups";

const ADAPTER_SOURCE_FILES = [
  "src/components/working/projection-adapter.ts",
  "src/components/working/types.ts",
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
      | "queryRoomState"
      | "queryTelemetryRollups"
      | "queryRecentTraces"
      | "queryWorkingPanelMetadata"
    >
  > = {},
): Pick<
  ObservabilityApi,
  | "queryRoomState"
  | "queryTelemetryRollups"
  | "queryRecentTraces"
  | "queryWorkingPanelMetadata"
> {
  return {
    queryRoomState: () =>
      response<RoomStateProjection>({
        projection_status: "ok",
        room_status: "known",
        stale: false,
        summaries: [
          {
            room_id: "bedroom-workspace",
            profile_id: "bedroom-workspace-default",
            adapter_id: "fake-room-adapter",
            status: "known",
            device_id: "desk_lamp",
            sensor_id: null,
            capability: "power.observe",
            latest_event_id: "event-1",
            latest_seen_at_ms: 1,
            stale: false,
            failure_class: null,
            metadata_only: true,
            raw_payload_included: false,
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
      }),
    queryTelemetryRollups: () =>
      response<TelemetryRollupsProjection>({
        projection_status: "ok",
        telemetry_by_scope: [{ key: "room", count: 2 }],
        telemetry_by_severity: [{ key: "info", count: 2 }],
        runtime_by_status: [{ key: "completed", count: 1 }],
        model_calls_by_provider: [{ key: "local-fake", count: 1 }],
        model_calls_by_aux_task: [{ key: "summary", count: 1 }],
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
    queryWorkingPanelMetadata: () =>
      response([
        {
          panel_id: "system_status",
          title: "System status",
          description: "System placeholder",
          source_phase: "12B.2",
          data_classification: "metadata_only",
          authority: "read_only",
          refresh_policy: "static_placeholder",
          disabled_affordances: WORKING_DISABLED_AFFORDANCES,
          placeholder_rows: [{ label: "Shell", value: "local" }],
          status: "placeholder",
          eyebrow: "Local shell",
          metadataOnly: true,
          localOnly: true,
          shellAuthority: "none",
          withheld: false,
        },
      ] as never),
    ...overrides,
  };
}

describe("Phase 12D.2 Working projection adapter", () => {
  it("maps valid Observability API responses to Working panel view models", () => {
    const panels = createWorkingProjectionViewModels(apiStub());

    expect(panels.map((panel) => panel.panel_id)).toEqual([
      "system_status",
      "room_state",
      "recent_activity",
      "model_router",
      "suggestions_inbox",
      "cost_usage",
      "safety_governance",
    ]);
    expect(
      panels.find((panel) => panel.panel_id === "room_state"),
    ).toMatchObject({
      status: "placeholder",
      withheld: false,
      projectionBacked: true,
      placeholder_rows: expect.arrayContaining([
        { label: "Room", value: "known" },
        { label: "Freshness", value: "current" },
        { label: "Summaries", value: "1" },
      ]),
    });
    expect(
      panels.find((panel) => panel.panel_id === "recent_activity"),
    ).toMatchObject({
      projectionBacked: true,
      placeholder_rows: expect.arrayContaining([
        { label: "Traces", value: "1" },
        { label: "Replay safe", value: "metadata only" },
      ]),
    });
    expect(
      panels.find((panel) => panel.panel_id === "cost_usage"),
    ).toMatchObject({
      projectionBacked: true,
      placeholder_rows: expect.arrayContaining([
        { label: "Model calls", value: "1" },
        { label: "Severity bands", value: "1" },
        { label: "Aux tasks", value: "1" },
      ]),
    });
  });

  it("fails closed to withheld placeholders when responses are unsafe or malformed", () => {
    const panels = createWorkingProjectionViewModels(
      apiStub({
        queryRoomState: () =>
          response<RoomStateProjection>(
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
      panels.find((panel) => panel.panel_id === "room_state"),
    ).toMatchObject({
      status: "withheld",
      withheld: true,
      projectionBacked: false,
      placeholder_rows: [{ label: "State", value: "withheld" }],
    });
    expect(
      panels.find((panel) => panel.panel_id === "system_status"),
    ).toMatchObject({
      status: "withheld",
      withheld: true,
      projectionBacked: false,
    });
    expect(JSON.stringify(panels)).not.toContain("sk-secret");
  });

  it("returns defensive copies", () => {
    const first = createWorkingProjectionViewModels(apiStub());
    (first as unknown as Array<{ title: string }>)[0]!.title = "mutated";
    (
      first[1]!.placeholder_rows as unknown as Array<{ value: string }>
    )[0]!.value = "mutated";

    const second = createWorkingProjectionViewModels(apiStub());

    expect(second[0]).toMatchObject({ title: "System status" });
    expect(
      second.find((panel) => panel.panel_id === "room_state"),
    ).toMatchObject({
      placeholder_rows: expect.arrayContaining([
        { label: "Room", value: "known" },
      ]),
    });
  });

  it("preserves disabled affordances and read-only metadata", () => {
    const panels = createWorkingProjectionViewModels(apiStub());

    for (const panel of panels) {
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
  });

  it("exposes no mutation or action model", async () => {
    const adapterModule =
      await import("../../src/components/working/projection-adapter");
    const exportedNames = Object.keys(adapterModule);

    expect(exportedNames).toEqual(["createWorkingProjectionViewModels"]);
    expect(
      exportedNames.some((name) =>
        /insert|update|delete|append|mutate|execute|approve|run|retry|schedule|action/i.test(
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
