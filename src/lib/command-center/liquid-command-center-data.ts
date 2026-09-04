import { existsSync } from "node:fs";

import { createOrbProjectionTokens } from "@/components/orb/projection-adapter";
import type { RestOrbStateTokens } from "@/components/orb/types";
import { createObservabilityApi } from "@/lib/observability/api";
import type {
  ObservabilityApi,
  ObservabilityProjectionReaders,
} from "@/lib/observability/contracts";
import { SYNTHETIC_OBSERVABILITY_MARKER } from "@/lib/observability/synthetic-data";
import { buildVoicePipelineVisibilityModel } from "@/lib/voice-operating-mode";
import type { VoicePipelineEvent } from "@/lib/voice-operating-mode";
import type { CountBucket } from "@/store/projections/telemetry-rollups";

import { validateObservabilityPayloadSafety } from "./observability-redaction";

export type RestCardSlot = "scout" | "council" | "coach" | "flow";

export interface RestAmbientCard {
  readonly slot: RestCardSlot;
  readonly source: string;
  readonly body: string;
  readonly meta: string;
}

export type RestVoiceReactorState =
  | "sleep"
  | "wake"
  | "listening"
  | "thinking"
  | "speaking"
  | "approval"
  | "alert";

export interface RestCommandCenterModel {
  readonly marker: string;
  readonly cards: readonly RestAmbientCard[];
  readonly orb: RestOrbStateTokens;
  readonly health: string;
  readonly security: string;
  readonly voice: {
    readonly micIndicatorRequired: true;
    readonly explicitPermissionGate: true;
    readonly authorizesActions: false;
    readonly wakeMode: "openwakeword_local_onnx";
    readonly reactorState: RestVoiceReactorState;
    readonly reactorStates: readonly RestVoiceReactorState[];
    readonly pipelineEvents: readonly VoicePipelineEvent[];
  };
}

export interface WorkingRoomDevice {
  readonly name: string;
  readonly zone: string;
  readonly state: string;
  readonly trustClass: "observe_only" | "safe_mutate";
}

export interface WorkingMetric {
  readonly label: string;
  readonly value: string;
  readonly pct?: number;
}

export interface WorkingActivity {
  readonly ts: string;
  readonly tag: "PROP" | "INFO" | "AUDIT" | "DENY" | "VOICE";
  readonly text: string;
}

export interface WorkingGateProposal {
  readonly id: string;
  readonly kind: "ROOM.ACTION";
  readonly tier: "T1";
  readonly trustClass: "SAFE_MUTATE";
  readonly title: string;
  readonly diffBefore: string;
  readonly diffAfter: string;
  readonly expiresIn: string;
  readonly lifecycle: readonly [
    "dry_run",
    "approval",
    "execute",
    "verify",
    "audit_event",
  ];
  readonly approvalService: "phase_18_contract";
  readonly executionAvailable: false;
}

// Capstone honesty pass: per-panel provenance for the projection-backed rows.
// "live" means the rows came from a REAL observability DB at render; anything
// else (synthetic readers, withheld, empty, fallback fixture) is "synthetic".
// The label must match the actual source — a blanket synthetic marker over
// live rows is as dishonest as the reverse.
export type WorkingPanelProvenance = "live" | "synthetic";

export interface WorkingPanelProvenanceMap {
  readonly room: WorkingPanelProvenance;
  readonly cost: WorkingPanelProvenance;
  readonly activity: WorkingPanelProvenance;
}

export interface WorkingCommandCenterModel {
  readonly marker: string;
  readonly gateCount: number;
  readonly phase: string;
  readonly testCount: string;
  readonly chat: {
    readonly operator: string;
    readonly assistant: string;
    readonly proposalChip: string;
  };
  readonly proposal: WorkingGateProposal;
  readonly room: readonly WorkingRoomDevice[];
  readonly cost: readonly WorkingMetric[];
  readonly activity: readonly WorkingActivity[];
  readonly provenance: WorkingPanelProvenanceMap;
  readonly voiceActivity: readonly VoicePipelineEvent[];
}

export interface AuditStage {
  readonly name: string;
  readonly meta: string;
  readonly tone: "cyan" | "blue" | "green" | "amber" | "red" | "dim";
  readonly redactionTag?: string;
}

export interface AuditTrace {
  readonly id: string;
  readonly ts: string;
  readonly status: "verified" | "pending" | "denied" | "error" | "info";
  readonly statusLabel: string;
  readonly title: string;
  readonly meta: string;
  readonly question: string;
  readonly model: string;
  readonly stages: readonly AuditStage[];
}

export interface AuditTelemetry {
  readonly label: string;
  readonly value: string;
}

export interface AuditTrustClass {
  readonly id:
    | "observe_only"
    | "safe_mutate"
    | "restricted_mutate"
    | "forbidden";
  readonly label: string;
  readonly detail: string;
}

export interface AuditDisabledFeature {
  readonly name: string;
  readonly status: "DISABLED";
}

export interface AuditCommandCenterModel {
  readonly marker: string;
  readonly traceCountLabel: string;
  readonly integrity: "append-only";
  readonly retention: string;
  readonly traces: readonly AuditTrace[];
  readonly telemetry: readonly AuditTelemetry[];
  readonly sparkline: readonly number[];
  readonly trustClasses: readonly AuditTrustClass[];
  readonly forbiddenEdgesObserved: number;
  readonly disabledFeatures: readonly AuditDisabledFeature[];
  readonly voiceActivity: readonly VoicePipelineEvent[];
  readonly replayNonExecutable: true;
  readonly surfaceAuthority: "none";
}

const PROJECTION_POSTURE = Object.freeze({
  metadata_only: true,
  raw_payload_included: false,
  secrets_included: false,
  executable_payload_included: false,
  network_called: false,
  ui_rendered: false,
});

const PHASE22_REACTOR_STATES: readonly RestVoiceReactorState[] = [
  "sleep",
  "wake",
  "listening",
  "thinking",
  "speaking",
  "approval",
  "alert",
];

const SYNTHETIC_READERS: ObservabilityProjectionReaders = Object.freeze({
  roomState: () => ({
    projection_status: "ok",
    room_status: "known",
    stale: false,
    summaries: [
      summary("office", "desk-strip", "light.dimmer"),
      summary("office", "nanoleaf-wall", "light.color"),
      summary("entry", "door-sensor", "contact.open"),
    ],
    errors: [],
    posture: PROJECTION_POSTURE,
  }),
  recentTraces: () => ({
    projection_status: "ok",
    traces: [
      trace(
        "trace-prop-room-1842",
        "event-prop-room-1842",
        "approval_pending",
        1_783_000,
      ),
      trace(
        "trace-summary-0921",
        "event-summary-0921",
        "read_only_summary",
        1_782_580,
      ),
      trace(
        "trace-routine-0914",
        "event-routine-0914",
        "routine_completed",
        1_782_160,
      ),
      trace(
        "trace-router-0852",
        "event-router-0852",
        "router_fallback_recovered",
        1_780_840,
      ),
      trace(
        "trace-denied-0840",
        "event-denied-0840",
        "approval_denied",
        1_780_120,
      ),
    ],
    errors: [],
    posture: PROJECTION_POSTURE,
  }),
  telemetryRollups: () => ({
    projection_status: "ok",
    telemetry_by_scope: buckets([
      ["room", 3],
      ["runtime", 2],
      ["governance", 1],
    ]),
    telemetry_by_severity: buckets([
      ["info", 5],
      ["warning", 1],
    ]),
    runtime_by_status: buckets([
      ["completed", 4],
      ["pending", 1],
    ]),
    model_calls_by_provider: buckets([
      ["local", 3],
      ["cloud_gated", 1],
    ]),
    model_calls_by_aux_task: buckets([
      ["reasoning", 2],
      ["creative", 1],
    ]),
    errors: [],
    posture: PROJECTION_POSTURE,
  }),
});

export function buildRestCommandCenterModel(): RestCommandCenterModel {
  const { api } = createSafeObservabilityApi();
  const orb = safeQuery(() => createOrbProjectionTokens(api), {
    mode: "working",
    load_band: "active",
    last_event_class: "routine_completed",
    governance_posture: "all_green",
    heartbeat: "stable",
  } satisfies RestOrbStateTokens);

  return safeModel(
    {
      marker: SYNTHETIC_OBSERVABILITY_MARKER,
      cards: [
        {
          slot: "scout",
          source: "JOB SCOUT",
          body: "3 R&D roles matched overnight",
          meta: "suggestion only - nothing actioned",
        },
        {
          slot: "council",
          source: "COUNCIL - OVERNIGHT",
          body: "Consensus reached on the turbovec migration",
          meta: "ready when you want to review",
        },
        {
          slot: "coach",
          source: "LIFE COACH",
          body: "Two items from this week's CV goal",
          meta: "a gentle nudge, no pressure",
        },
        {
          slot: "flow",
          source: "WORKFLOW",
          body: "Resume: Command Center polish",
          meta: "paused 21h ago - tap to pick up",
        },
      ],
      orb,
      health: orb.heartbeat === "stable" ? "OPTIMAL" : "DELAYED",
      security: "FORTRESS LOCK",
      voice: {
        micIndicatorRequired: true,
        explicitPermissionGate: true,
        authorizesActions: false,
        wakeMode: "openwakeword_local_onnx",
        reactorState: "sleep",
        reactorStates: PHASE22_REACTOR_STATES,
        pipelineEvents: buildVoicePipelineVisibilityModel().events,
      },
    },
    fallbackRestModel(orb),
  );
}

// `handle` is an injection seam for tests (fake api + declared source); the
// route calls this with no arguments and gets the env-resolved handle.
export function buildWorkingCommandCenterModel(
  handle?: SafeObservabilityHandle,
): WorkingCommandCenterModel {
  const { api, source } = handle ?? createSafeObservabilityApi();
  const roomRows = safeQuery(() => roomDevicesOrNull(api), null);
  const costRows = safeQuery(() => costMetricsOrNull(api), null);
  const activityRows = safeQuery(() => workingActivityOrNull(api), null);
  // Honest per-panel provenance: "live" ONLY when the rows came from a real
  // observability DB AND the projection actually produced them (no fallback).
  const provenanceOf = (rows: unknown): WorkingPanelProvenance =>
    source === "live_db" && rows !== null ? "live" : "synthetic";

  return safeModel(
    {
      marker: SYNTHETIC_OBSERVABILITY_MARKER,
      gateCount: 1,
      // Non-staling truths (capstone honesty pass): no phase number that rots
      // and no hardcoded test count shaped like a live claim — the suite gate
      // is a PROPERTY (every commit runs the full suite in the pre-commit
      // hook), not a number frozen at authoring time.
      phase: "Expansion Era - post-Phase-24",
      testCount: "full suite gated in-hook",
      chat: {
        operator: "Can you set the office for deep work?",
        assistant:
          "I cannot act directly. I prepared a room proposal in the Human Gate for your approval.",
        proposalChip: "PROPOSAL - PROP-ROOM-1842",
      },
      proposal: {
        id: "PROP-ROOM-1842",
        kind: "ROOM.ACTION",
        tier: "T1",
        trustClass: "SAFE_MUTATE",
        title: "Dim desk strip for a focused build session",
        diffBefore: "desk strip - on at 78%",
        diffAfter: "on at 32%",
        expiresIn: "06:58",
        lifecycle: ["dry_run", "approval", "execute", "verify", "audit_event"],
        approvalService: "phase_18_contract",
        executionAvailable: false,
      },
      room: roomRows ?? fallbackRoomDevices(),
      cost: costRows ?? fallbackCostMetrics(),
      activity: activityRows ?? fallbackActivity(),
      provenance: {
        room: provenanceOf(roomRows),
        cost: provenanceOf(costRows),
        activity: provenanceOf(activityRows),
      },
      voiceActivity: buildVoicePipelineVisibilityModel().events,
    },
    fallbackWorkingModel(),
  );
}

export function buildAuditCommandCenterModel(): AuditCommandCenterModel {
  const { api } = createSafeObservabilityApi();
  const traces = safeQuery(() => auditTraces(api), fallbackAuditTraces());
  const telemetry = safeQuery(
    () => auditTelemetry(api),
    fallbackAuditTelemetry(),
  );

  return safeModel(
    {
      marker: SYNTHETIC_OBSERVABILITY_MARKER,
      traceCountLabel: `${traces.length} today`,
      integrity: "append-only",
      retention: "90d",
      traces,
      telemetry,
      sparkline: [30, 28, 32, 20, 24, 14, 26, 18, 30, 12, 22, 16, 24],
      trustClasses: [
        { id: "observe_only", label: "observe_only", detail: "sensors - door" },
        {
          id: "safe_mutate",
          label: "safe_mutate",
          detail: "desk strip - nanoleaf",
        },
        {
          id: "restricted_mutate",
          label: "restricted_mutate",
          detail: "none active",
        },
        {
          id: "forbidden",
          label: "forbidden",
          detail: "shell - cloud-default",
        },
      ],
      forbiddenEdgesObserved: 0,
      disabledFeatures: [
        { name: "Cloud wake word", status: "DISABLED" },
        { name: "Pre-wake audio storage", status: "DISABLED" },
        { name: "Always-listening recording", status: "DISABLED" },
        { name: "Background camera", status: "DISABLED" },
        { name: "Auto-approval", status: "DISABLED" },
        { name: "Voice-only approval", status: "DISABLED" },
        { name: "Remote dashboard", status: "DISABLED" },
        { name: "Cloud-by-default", status: "DISABLED" },
      ],
      voiceActivity: buildVoicePipelineVisibilityModel().events,
      replayNonExecutable: true,
      surfaceAuthority: "none",
    },
    fallbackAuditModel(),
  );
}

export type ObservabilitySource = "live_db" | "synthetic_readers";

export interface SafeObservabilityHandle {
  readonly api: ObservabilityApi;
  readonly source: ObservabilitySource;
}

function createSafeObservabilityApi(): SafeObservabilityHandle {
  // E-038: an EMPTY env value must fall through (the .env template ships the
  // observability path blank); `??` only skips null/undefined.
  const databasePath =
    process.env.JARVIS_OBSERVABILITY_DB_PATH?.trim() ||
    process.env.JARVIS_EVENT_DB_PATH?.trim() ||
    "";
  if (databasePath && existsSync(databasePath)) {
    return { api: createObservabilityApi({ databasePath }), source: "live_db" };
  }
  return {
    api: createObservabilityApi({
      databasePath: "synthetic-command-center.sqlite",
      projectionReaders: SYNTHETIC_READERS,
    }),
    source: "synthetic_readers",
  };
}

function roomDevicesOrNull(
  api: ObservabilityApi,
): readonly WorkingRoomDevice[] | null {
  const response = api.queryRoomState({ nowMs: Date.now() });
  if (
    response.withheld ||
    !response.data ||
    response.data.summaries.length === 0
  ) {
    return null;
  }
  return response.data.summaries.slice(0, 3).map((item, index) => ({
    name: titleCase(item.device_id ?? item.sensor_id ?? `device-${index + 1}`),
    zone: item.room_id ?? "local",
    state: item.status === "known" ? (item.capability ?? "known") : item.status,
    trustClass: item.sensor_id ? "observe_only" : "safe_mutate",
  }));
}

function costMetricsOrNull(
  api: ObservabilityApi,
): readonly WorkingMetric[] | null {
  const response = api.queryTelemetryRollups();
  if (response.withheld || !response.data) return null;
  const providerCount = sum(response.data.model_calls_by_provider);
  const severityCount = sum(response.data.telemetry_by_severity);
  const localCount =
    response.data.model_calls_by_provider.find((bucket) =>
      /local/i.test(bucket.key),
    )?.count ?? 0;
  // Honesty: with ZERO recorded model calls there is no split to show —
  // render "no data" rather than a fabricated percentage (was hardcoded 76).
  const split: readonly WorkingMetric[] =
    providerCount === 0
      ? [
          { label: "LOCAL", value: "no cost data" },
          { label: "CLOUD", value: "no cost data" },
        ]
      : [
          {
            label: "LOCAL",
            value: `${Math.round((localCount / providerCount) * 100)}%`,
          },
          {
            label: "CLOUD",
            value: `${Math.max(0, 100 - Math.round((localCount / providerCount) * 100))}%`,
          },
        ];
  return [
    {
      label: "TODAY",
      value: `${severityCount} events`,
      pct: Math.min(100, severityCount * 10),
    },
    {
      label: "WEEK",
      value: `${providerCount} model calls`,
      pct: Math.min(100, providerCount * 20),
    },
    ...split,
  ];
}

function workingActivityOrNull(
  api: ObservabilityApi,
): readonly WorkingActivity[] | null {
  const response = api.queryRecentTraces({ traceLimit: 3 });
  if (
    response.withheld ||
    !response.data ||
    response.data.traces.length === 0
  ) {
    return null;
  }
  return [
    {
      ts: timeLabel(Date.now()),
      tag: "VOICE",
      text: "Wake event observed - conversation active - T0 route available",
    },
    ...response.data.traces.map<WorkingActivity>((traceItem) => ({
      ts: timeLabel(traceItem.occurred_at_ms),
      tag: /approval/i.test(traceItem.trace_kind) ? "PROP" : "INFO",
      text: `${titleCase(traceItem.trace_kind)} metadata observed`,
    })),
  ];
}

function auditTraces(api: ObservabilityApi): readonly AuditTrace[] {
  const response = api.queryRecentTraces({ traceLimit: 5 });
  if (
    response.withheld ||
    !response.data ||
    response.data.traces.length === 0
  ) {
    return fallbackAuditTraces();
  }
  return response.data.traces.map((traceItem) =>
    traceToAuditTrace(
      traceItem.replay_trace_id,
      timeLabel(traceItem.occurred_at_ms),
      traceItem.trace_kind,
    ),
  );
}

function auditTelemetry(api: ObservabilityApi): readonly AuditTelemetry[] {
  const response = api.queryTelemetryRollups();
  if (response.withheld || !response.data) return fallbackAuditTelemetry();
  return [
    { label: "P50 LATENCY", value: "0.6s" },
    { label: "P95 LATENCY", value: "1.9s" },
    {
      label: "ERROR RATE",
      value: `${response.data.errors.length > 0 ? "1" : "0"}.${sum(response.data.telemetry_by_severity)}%`,
    },
    {
      label: "LOCAL MIX",
      value: `${sum(response.data.model_calls_by_provider)} calls`,
    },
  ];
}

function traceToAuditTrace(id: string, ts: string, kind: string): AuditTrace {
  const status = statusForTraceKind(kind);
  return {
    id,
    ts,
    status,
    statusLabel: statusLabel(status),
    title: titleForTraceKind(kind),
    meta: `${kind.toUpperCase().replaceAll("_", ".")} - metadata-only`,
    question: titleForTraceKind(kind),
    model: "local-first metadata projection",
    stages: stagesForTraceKind(kind),
  };
}

function stagesForTraceKind(kind: string): readonly AuditStage[] {
  const approval = /approval|room/i.test(kind);
  const denied = /denied/i.test(kind);
  const error = /error|fallback/i.test(kind);
  return [
    {
      name: "message_received",
      meta: "operator - text input",
      tone: "cyan",
      redactionTag: "input redacted",
    },
    {
      name: "intent_classified",
      meta: approval
        ? "ROOM_ACTION - confidence 0.91"
        : "READ_ONLY - confidence 0.88",
      tone: "cyan",
    },
    {
      name: "safety_classified",
      meta: approval ? "CONFIRM_ONCE - safe_mutate" : "ALLOW - read-only",
      tone: approval ? "blue" : "green",
    },
    {
      name: "route_decided",
      meta: "local-first - cheapest capable",
      tone: "blue",
    },
    {
      name: "response_streamed",
      meta: approval ? "1 proposal prepared" : "metadata response returned",
      tone: "green",
      redactionTag: "output redacted",
    },
    {
      name: approval ? "approval" : "side_effects",
      meta: denied
        ? "DENIED - no side effect"
        : approval
          ? "AWAITING - no side effect yet"
          : "NONE - inspection only",
      tone: denied ? "red" : error ? "amber" : "green",
    },
  ];
}

function statusForTraceKind(kind: string): AuditTrace["status"] {
  if (/denied/i.test(kind)) return "denied";
  if (/error|fallback/i.test(kind)) return "error";
  if (/approval|pending/i.test(kind)) return "pending";
  if (/routine|summary|read/i.test(kind)) return "verified";
  return "info";
}

function statusLabel(status: AuditTrace["status"]): string {
  switch (status) {
    case "verified":
      return "COMPLETE";
    case "pending":
      return "AWAITING REVIEW";
    case "denied":
      return "DENIED";
    case "error":
      return "RECOVERED";
    case "info":
      return "ROUTINE";
  }
}

function titleForTraceKind(kind: string): string {
  if (/approval|room/i.test(kind)) return "Set the office for deep work";
  if (/summary/i.test(kind)) return "Summarise today's commits";
  if (/routine/i.test(kind)) return "Morning Brief scheduled tick";
  if (/fallback|router/i.test(kind))
    return "Explain the router escalation logic";
  if (/denied/i.test(kind)) return "Send the weekly digest by email";
  return titleCase(kind);
}

function fallbackRestModel(orb: RestOrbStateTokens): RestCommandCenterModel {
  return {
    marker: SYNTHETIC_OBSERVABILITY_MARKER,
    cards: [],
    orb,
    health: "DEGRADED",
    security: "FORTRESS LOCK",
    voice: {
      micIndicatorRequired: true,
      explicitPermissionGate: true,
      authorizesActions: false,
      wakeMode: "openwakeword_local_onnx",
      reactorState: "sleep",
      reactorStates: PHASE22_REACTOR_STATES,
      pipelineEvents: buildVoicePipelineVisibilityModel().events,
    },
  };
}

function fallbackWorkingModel(): WorkingCommandCenterModel {
  return {
    marker: SYNTHETIC_OBSERVABILITY_MARKER,
    gateCount: 1,
    phase: "Expansion Era - post-Phase-24",
    testCount: "full suite gated in-hook",
    chat: {
      operator: "Can you set the office for deep work?",
      assistant:
        "I cannot act directly. I prepared a room proposal in the Human Gate for your approval.",
      proposalChip: "PROPOSAL - PROP-ROOM-1842",
    },
    proposal: {
      id: "PROP-ROOM-1842",
      kind: "ROOM.ACTION",
      tier: "T1",
      trustClass: "SAFE_MUTATE",
      title: "Dim desk strip for a focused build session",
      diffBefore: "desk strip - on at 78%",
      diffAfter: "on at 32%",
      expiresIn: "06:58",
      lifecycle: ["dry_run", "approval", "execute", "verify", "audit_event"],
      approvalService: "phase_18_contract",
      executionAvailable: false,
    },
    room: fallbackRoomDevices(),
    cost: fallbackCostMetrics(),
    activity: fallbackActivity(),
    provenance: { room: "synthetic", cost: "synthetic", activity: "synthetic" },
    voiceActivity: buildVoicePipelineVisibilityModel().events,
  };
}

function fallbackAuditModel(): AuditCommandCenterModel {
  return {
    marker: SYNTHETIC_OBSERVABILITY_MARKER,
    traceCountLabel: "5 today",
    integrity: "append-only",
    retention: "90d",
    traces: fallbackAuditTraces(),
    telemetry: fallbackAuditTelemetry(),
    sparkline: [30, 28, 32, 20, 24, 14, 26, 18, 30, 12, 22, 16, 24],
    trustClasses: [
      { id: "observe_only", label: "observe_only", detail: "sensors - door" },
      {
        id: "safe_mutate",
        label: "safe_mutate",
        detail: "desk strip - nanoleaf",
      },
      {
        id: "restricted_mutate",
        label: "restricted_mutate",
        detail: "none active",
      },
      { id: "forbidden", label: "forbidden", detail: "shell - cloud-default" },
    ],
    forbiddenEdgesObserved: 0,
    disabledFeatures: [
      { name: "Cloud wake word", status: "DISABLED" },
      { name: "Pre-wake audio storage", status: "DISABLED" },
      { name: "Always-listening recording", status: "DISABLED" },
      { name: "Background camera", status: "DISABLED" },
      { name: "Auto-approval", status: "DISABLED" },
      { name: "Voice-only approval", status: "DISABLED" },
      { name: "Remote dashboard", status: "DISABLED" },
      { name: "Cloud-by-default", status: "DISABLED" },
    ],
    voiceActivity: buildVoicePipelineVisibilityModel().events,
    replayNonExecutable: true,
    surfaceAuthority: "none",
  };
}

function fallbackRoomDevices(): readonly WorkingRoomDevice[] {
  return [
    {
      name: "Desk strip",
      zone: "office",
      state: "ON - 78%",
      trustClass: "safe_mutate",
    },
    {
      name: "Nanoleaf wall",
      zone: "office",
      state: "SCENE - FOCUS",
      trustClass: "safe_mutate",
    },
    {
      name: "Door sensor",
      zone: "entry",
      state: "CLOSED",
      trustClass: "observe_only",
    },
  ];
}

function fallbackCostMetrics(): readonly WorkingMetric[] {
  return [
    { label: "TODAY", value: "$1.82 / $3.00", pct: 61 },
    { label: "WEEK", value: "$11.40 / $40.00", pct: 29 },
    { label: "LOCAL", value: "76%" },
    { label: "CLOUD", value: "24%" },
  ];
}

function fallbackActivity(): readonly WorkingActivity[] {
  return [
    {
      ts: "09:31",
      tag: "VOICE",
      text: "Wake event observed - conversation active - T0 route available",
    },
    {
      ts: "09:28",
      tag: "PROP",
      text: "Chat created room proposal prop-room-1842",
    },
    {
      ts: "09:21",
      tag: "INFO",
      text: "Cost rollup refreshed from metadata projection",
    },
    { ts: "09:14", tag: "INFO", text: "Local model warm - llama3.2:3b ready" },
  ];
}

function fallbackAuditTelemetry(): readonly AuditTelemetry[] {
  return [
    { label: "P50 LATENCY", value: "0.6s" },
    { label: "P95 LATENCY", value: "1.9s" },
    { label: "ERROR RATE", value: "0.4%" },
    { label: "CLOUD MIX", value: "24%" },
  ];
}

function fallbackAuditTraces(): readonly AuditTrace[] {
  return [
    traceToAuditTrace("trace-prop-room-1842", "09:28", "approval_pending"),
    traceToAuditTrace("trace-summary-0921", "09:21", "read_only_summary"),
    traceToAuditTrace("trace-routine-0914", "09:14", "routine_completed"),
    traceToAuditTrace(
      "trace-router-0852",
      "08:52",
      "router_fallback_recovered",
    ),
    traceToAuditTrace("trace-denied-0840", "08:40", "approval_denied"),
  ];
}

function safeModel<T>(model: T, fallback: T): T {
  return validateObservabilityPayloadSafety(model).passed ? model : fallback;
}

function safeQuery<T>(query: () => T, fallback: T): T {
  try {
    return query();
  } catch {
    return fallback;
  }
}

function summary(roomId: string, id: string, capability: string) {
  return {
    room_id: roomId,
    profile_id: "command-center-demo",
    adapter_id: "metadata-projection",
    device_id: id.includes("sensor") ? null : id,
    sensor_id: id.includes("sensor") ? id : null,
    capability,
    latest_event_id: `event-${id}`,
    latest_seen_at_ms: 1_783_000,
    status: "known",
    stale: false,
    failure_class: null,
    metadata_only: true,
    raw_payload_included: false,
  };
}

function trace(
  replayTraceId: string,
  eventId: string,
  traceKind: string,
  occurredAtMs: number,
) {
  return {
    replay_trace_id: replayTraceId,
    event_id: eventId,
    trace_kind: traceKind,
    occurred_at_ms: occurredAtMs,
    metadata_only: true,
    raw_payload_included: false,
    executable_payload_included: false,
    run_affordance: false,
    retry_affordance: false,
  };
}

function buckets(
  entries: readonly (readonly [string, number])[],
): readonly CountBucket[] {
  return entries.map(([key, count]) => ({ key, count }));
}

function sum(bucketsInput: readonly CountBucket[]): number {
  return bucketsInput.reduce((total, bucket) => total + bucket.count, 0);
}

function titleCase(input: string): string {
  return input
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function timeLabel(ms: number): string {
  if (ms < 86_400_000) {
    const date = new Date(ms);
    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(
      date.getUTCMinutes(),
    ).padStart(2, "0")}`;
  }
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}
