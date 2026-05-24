import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createOrbProjectionTokens } from "../../src/components/orb/projection-adapter";
import {
  IDLE_ORB_STATE,
  restOrbTokensToViewModel,
} from "../../src/components/orb/state-tokens";
import type {
  OrbVisualState,
  RestOrbStateTokens,
} from "../../src/components/orb/types";
import type {
  ObservabilityApi,
  ObservabilityResponse,
} from "../../src/lib/observability/contracts";

const ADAPTER_SOURCE_FILES = [
  "src/components/orb/projection-adapter.ts",
] as const;

type OrbAdapterApi = Pick<
  ObservabilityApi,
  "queryOrbStateMetadata" | "queryTelemetryRollups" | "queryRecentTraces"
>;

interface TraceProjectionStub {
  readonly projection_status: "ok" | "degraded";
  readonly traces: readonly {
    readonly replay_trace_id: string;
    readonly event_id: string;
    readonly trace_kind: string;
    readonly occurred_at_ms: number;
    readonly metadata_only: true;
    readonly raw_payload_included: false;
    readonly executable_payload_included: false;
    readonly run_affordance: false;
    readonly retry_affordance: false;
  }[];
  readonly errors: readonly string[];
  readonly posture: ProjectionPostureStub;
}

interface TelemetryProjectionStub {
  readonly projection_status: "ok" | "degraded";
  readonly telemetry_by_scope: readonly CountBucketStub[];
  readonly telemetry_by_severity: readonly CountBucketStub[];
  readonly runtime_by_status: readonly CountBucketStub[];
  readonly model_calls_by_provider: readonly CountBucketStub[];
  readonly errors: readonly string[];
  readonly posture: ProjectionPostureStub;
}

interface CountBucketStub {
  readonly key: string;
  readonly count: number;
}

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

function trace(traceKind: string) {
  return {
    replay_trace_id: `trace-${traceKind}`,
    event_id: `event-${traceKind}`,
    trace_kind: traceKind,
    occurred_at_ms: 1,
    metadata_only: true,
    raw_payload_included: false,
    executable_payload_included: false,
    run_affordance: false,
    retry_affordance: false,
  } as const;
}

function bucket(key: string) {
  return { key, count: 1 } as const;
}

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

function apiStub(overrides: Partial<OrbAdapterApi> = {}): OrbAdapterApi {
  return {
    queryOrbStateMetadata: () => response<OrbVisualState>(IDLE_ORB_STATE),
    queryTelemetryRollups: () =>
      response<TelemetryProjectionStub>({
        projection_status: "ok",
        telemetry_by_scope: [bucket("room")],
        telemetry_by_severity: [bucket("info")],
        runtime_by_status: [bucket("completed")],
        model_calls_by_provider: [bucket("local")],
        errors: [],
        posture: PROJECTION_POSTURE,
      }),
    queryRecentTraces: () =>
      response<TraceProjectionStub>(
        {
          projection_status: "ok",
          traces: [trace("routine_completed")],
          errors: [],
          posture: PROJECTION_POSTURE,
        },
        { replay_safe: true },
      ),
    ...overrides,
  };
}

describe("Phase 12D.4 Orb projection adapter", () => {
  it("maps valid Observability API responses to orb token sets", () => {
    const tokens = createOrbProjectionTokens(apiStub());

    expect(tokens).toEqual({
      mode: "working",
      load_band: "active",
      last_event_class: "routine_completed",
      governance_posture: "all_green",
      heartbeat: "stable",
    } satisfies RestOrbStateTokens);
    expect(restOrbTokensToViewModel(tokens)).toMatchObject({
      mode: "working",
      withheld: false,
      metadataOnly: true,
      rawPayloadIncluded: false,
      authority: "none",
    });
  });

  it("maps safe telemetry pressure to load band and heartbeat", () => {
    const tokens = createOrbProjectionTokens(
      apiStub({
        queryTelemetryRollups: () =>
          response<TelemetryProjectionStub>({
            projection_status: "degraded",
            telemetry_by_scope: [bucket("a"), bucket("b"), bucket("c")],
            telemetry_by_severity: [bucket("a"), bucket("b")],
            runtime_by_status: [bucket("a"), bucket("b")],
            model_calls_by_provider: [bucket("a"), bucket("b")],
            errors: ["metadata_gap"],
            posture: PROJECTION_POSTURE,
          }),
      }),
    );

    expect(tokens).toMatchObject({
      mode: "working",
      load_band: "busy",
      heartbeat: "delayed",
    });
  });

  it("maps recent traces to last event class when safe", () => {
    const approval = createOrbProjectionTokens(
      apiStub({
        queryRecentTraces: () =>
          response<TraceProjectionStub>({
            projection_status: "ok",
            traces: [trace("approval_pending")],
            errors: [],
            posture: PROJECTION_POSTURE,
          }),
      }),
    );
    const vision = createOrbProjectionTokens(
      apiStub({
        queryRecentTraces: () =>
          response<TraceProjectionStub>({
            projection_status: "ok",
            traces: [trace("vision_degraded")],
            errors: [],
            posture: PROJECTION_POSTURE,
          }),
      }),
    );

    expect(approval.last_event_class).toBe("approval_pending");
    expect(vision.last_event_class).toBe("vision_degraded");
  });

  it("fails closed when responses are unsafe or malformed", () => {
    const tokens = createOrbProjectionTokens(
      apiStub({
        queryRecentTraces: () =>
          response<TraceProjectionStub>(
            {
              projection_status: "ok",
              traces: [],
              errors: [],
              posture: PROJECTION_POSTURE,
            },
            {
              status: "withheld",
              data: null,
              withheld: true,
              errors: ["unsafe_payload"],
              redaction: {
                metadata_only: true,
                raw_payload_included: false,
                secrets_included: false,
                executable_payload_included: false,
                unsafe_payload_withheld: true,
              },
            },
          ),
      }),
    );

    expect(tokens).toEqual({
      mode: "degraded",
      load_band: "idle",
      last_event_class: "error",
      governance_posture: "gated_active",
      heartbeat: "unavailable",
    });
    expect(restOrbTokensToViewModel(tokens)).toMatchObject({
      mode: "degraded",
      metadataOnly: true,
      rawPayloadIncluded: false,
      authority: "none",
    });
  });

  it("maps withheld Observability metadata to degraded visual tokens", () => {
    const tokens = createOrbProjectionTokens(
      apiStub({
        queryOrbStateMetadata: () =>
          response<OrbVisualState>(IDLE_ORB_STATE, {
            status: "withheld",
            data: null,
            withheld: true,
            redaction: {
              metadata_only: true,
              raw_payload_included: false,
              secrets_included: false,
              executable_payload_included: false,
              unsafe_payload_withheld: true,
            },
          }),
      }),
    );

    expect(tokens).toMatchObject({
      mode: "degraded",
      governance_posture: "gated_active",
      heartbeat: "unavailable",
    });
  });

  it("maps kill switch metadata to visual-only kill switch state", () => {
    const tokens = createOrbProjectionTokens(
      apiStub({
        queryOrbStateMetadata: () =>
          response<OrbVisualState>({
            ...IDLE_ORB_STATE,
            mode: "kill_switch",
            loadBand: "idle",
            lastEventClass: "error",
            governancePosture: "kill_switch_on",
            heartbeat: "unavailable",
            label: "JARVIS Room OS - Kill Switch Signal",
            statusText: "Authority remains unavailable.",
            withheld: false,
          }),
      }),
    );

    expect(tokens).toEqual({
      mode: "kill_switch",
      load_band: "idle",
      last_event_class: "error",
      governance_posture: "kill_switch_on",
      heartbeat: "unavailable",
    });
    expect(restOrbTokensToViewModel(tokens)).toMatchObject({
      mode: "kill_switch",
      authority: "none",
      metadataOnly: true,
      rawPayloadIncluded: false,
    });
  });

  it("returns defensive copies", () => {
    const first = createOrbProjectionTokens(apiStub());
    (first as { mode: string }).mode = "mutated";

    expect(createOrbProjectionTokens(apiStub())).toMatchObject({
      mode: "working",
      load_band: "active",
    });
  });

  it("exposes no mutation, action, capture, or execution model", async () => {
    const exported =
      await import("../../src/components/orb/projection-adapter");

    expect(Object.keys(exported)).toEqual(["createOrbProjectionTokens"]);
    expect(
      Object.keys(exported).some((name) =>
        /mutate|execute|capture|record|listen|approve|retry|run|action/i.test(
          name,
        ),
      ),
    ).toBe(false);
  });

  it("does not import store, DB, network, Tauri IPC, provider, room execution, or capture APIs", () => {
    expect(sourceText()).not.toMatch(
      /better-sqlite3|sqlite|raw SQL|rawDb|db\.|from ["']@\/store|from ["']\.\.\/\.\.\/src\/store/i,
    );
    expect(sourceText()).not.toMatch(
      /fetch\(|XMLHttpRequest|WebSocket|EventSource|http\.|https\.|net\.|socket/i,
    );
    expect(sourceText()).not.toMatch(
      /invoke\(|@tauri-apps|tauri::command|openai|anthropic|ollama|provider runtime|model runtime/i,
    );
    expect(sourceText()).not.toMatch(
      /room\/adapters|fake-room-adapter|executeCommand|commandRoom/i,
    );
    expect(sourceText()).not.toMatch(
      /getUserMedia|getDisplayMedia|mediaDevices|AudioContext|microphone|camera|screen capture|global-hotkey/i,
    );
  });
});
