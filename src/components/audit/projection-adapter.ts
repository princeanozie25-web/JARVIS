import { listAuditPanels } from "./panel-registry";
import type {
  AuditPanelId,
  AuditPanelViewModel,
  AuditPlaceholderRow,
} from "./types";
import type {
  ObservabilityApi,
  ObservabilityResponse,
} from "@/lib/observability/contracts";

type PanelMap = Record<AuditPanelId, AuditPanelViewModel>;

export function createAuditProjectionViewModels(
  api: Pick<
    ObservabilityApi,
    "queryRecentTraces" | "queryTelemetryRollups" | "queryAuditPanelMetadata"
  >,
): readonly AuditPanelViewModel[] {
  const basePanels = safePanelMetadata(api.queryAuditPanelMetadata());
  const panels = toPanelMap(basePanels);

  const traceRows = rowsFromRecentTraces(api.queryRecentTraces());
  applyRows(panels, "replay_timeline", traceRows.replay_timeline);
  applyRows(panels, "trace_viewer", traceRows.trace_viewer);

  const telemetryRows = rowsFromTelemetry(api.queryTelemetryRollups());
  applyRows(panels, "redaction_status", telemetryRows.redaction_status);
  applyRows(
    panels,
    "disabled_feature_matrix",
    rowsFromDisabledFeatureMetadata(panels.disabled_feature_matrix),
  );

  return Object.freeze(
    listAuditPanels().map((panel) => clone(panels[panel.panel_id] ?? panel)),
  );
}

function safePanelMetadata(
  response: ObservabilityResponse<readonly AuditPanelViewModel[]>,
): readonly AuditPanelViewModel[] {
  if (!isSafeResponse(response) || !Array.isArray(response.data)) {
    return listAuditPanels().map(withheldPanel);
  }
  return response.data.map((panel) =>
    isSafePanel(panel) ? clone(panel) : withheldPanel(panel),
  );
}

function toPanelMap(panels: readonly AuditPanelViewModel[]): PanelMap {
  return Object.fromEntries(
    listAuditPanels().map((fallback) => {
      const panel =
        panels.find((candidate) => candidate.panel_id === fallback.panel_id) ??
        fallback;
      return [fallback.panel_id, clone(panel)];
    }),
  ) as PanelMap;
}

function applyRows(
  panels: PanelMap,
  panelId: AuditPanelId,
  rows: readonly AuditPlaceholderRow[] | null,
): void {
  const panel = panels[panelId];
  panels[panelId] =
    rows && rows.length > 0
      ? {
          ...panel,
          placeholder_rows: clone(rows),
          status: "placeholder",
          withheld: false,
          projectionBacked: true,
        }
      : withheldPanel(panel);
}

function rowsFromRecentTraces(
  response: ObservabilityResponse<{
    readonly projection_status: string;
    readonly traces: readonly {
      readonly trace_kind: string;
      readonly occurred_at_ms: number;
    }[];
    readonly errors?: readonly string[];
  }>,
): {
  readonly replay_timeline: readonly AuditPlaceholderRow[] | null;
  readonly trace_viewer: readonly AuditPlaceholderRow[] | null;
} {
  if (!isSafeResponse(response) || !response.data) {
    return { replay_timeline: null, trace_viewer: null };
  }
  return {
    replay_timeline: [
      { label: "Traces", value: String(response.data.traces.length) },
      {
        label: "Replay safe",
        value: response.replay_safe ? "metadata only" : "withheld",
      },
    ],
    trace_viewer: [
      {
        label: "Latest kind",
        value: safeValue(response.data.traces[0]?.trace_kind ?? "none"),
      },
      {
        label: "Errors",
        value: String(response.data.errors?.length ?? 0),
      },
    ],
  };
}

function rowsFromTelemetry(
  response: ObservabilityResponse<{
    readonly telemetry_by_scope: readonly unknown[];
    readonly telemetry_by_severity: readonly unknown[];
    readonly runtime_by_status: readonly unknown[];
    readonly model_calls_by_provider: readonly unknown[];
  }>,
): {
  readonly redaction_status: readonly AuditPlaceholderRow[] | null;
} {
  if (!isSafeResponse(response) || !response.data) {
    return { redaction_status: null };
  }
  return {
    redaction_status: [
      {
        label: "Scopes",
        value: String(response.data.telemetry_by_scope.length),
      },
      {
        label: "Payloads",
        value: response.redaction.raw_payload_included ? "unsafe" : "withheld",
      },
      {
        label: "Secrets",
        value: response.redaction.secrets_included ? "unsafe" : "withheld",
      },
      {
        label: "Severity bands",
        value: String(response.data.telemetry_by_severity.length),
      },
    ],
  };
}

function rowsFromDisabledFeatureMetadata(
  panel: AuditPanelViewModel,
): readonly AuditPlaceholderRow[] | null {
  if (!isSafePanel(panel)) return null;
  return [
    { label: "Disabled", value: String(panel.disabled_affordances.length) },
    { label: "Replay path", value: "absent" },
    { label: "Graph path", value: "absent" },
  ];
}

function isSafeResponse<T>(
  response: ObservabilityResponse<T>,
): response is ObservabilityResponse<T> & { readonly data: T } {
  return (
    response.classification === "metadata_only" &&
    response.authority === "read_only" &&
    response.withheld === false &&
    response.data !== null &&
    response.redaction.metadata_only === true &&
    response.redaction.raw_payload_included === false &&
    response.redaction.secrets_included === false &&
    response.redaction.executable_payload_included === false &&
    response.redaction.unsafe_payload_withheld === false &&
    isSafeMetadataValue(response.data)
  );
}

function isSafePanel(panel: AuditPanelViewModel): boolean {
  return (
    panel.data_classification === "metadata_only" &&
    panel.authority === "read_only" &&
    panel.metadataOnly === true &&
    panel.shellAuthority === "none" &&
    isSafeMetadataValue(panel)
  );
}

function withheldPanel(panel: AuditPanelViewModel): AuditPanelViewModel {
  return {
    ...clone(panel),
    status: "withheld",
    withheld: true,
    projectionBacked: false,
    placeholder_rows: [{ label: "State", value: "withheld" }],
  };
}

function safeValue(value: unknown): string {
  return typeof value === "string" && !isSecretText(value) ? value : "withheld";
}

function isSafeMetadataValue(value: unknown): boolean {
  return !containsUnsafePayload(value, new Set());
}

function containsUnsafePayload(value: unknown, seen: Set<object>): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return isSecretText(value);
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafePayload(item, seen));
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (isUnsafeKeyValue(key, child)) return true;
    if (containsUnsafePayload(child, seen)) return true;
  }
  return false;
}

function isUnsafeKeyValue(key: string, value: unknown): boolean {
  if (
    /raw|payload_json|prompt|output|transcript|frame|secret|token/i.test(key)
  ) {
    if (value === null || value === false) return false;
    if (key === "raw_payload_included" && value === false) return false;
    return true;
  }
  return false;
}

function isSecretText(value: string): boolean {
  return /(api[_-]?key|password|secret|token|sk-)/i.test(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
