import { listWorkingPanels } from "./panel-registry";
import type {
  WorkingPanelId,
  WorkingPanelViewModel,
  WorkingPlaceholderRow,
} from "./types";
import type {
  ObservabilityApi,
  ObservabilityResponse,
} from "@/lib/observability/contracts";

type PanelMap = Record<WorkingPanelId, WorkingPanelViewModel>;

export function createWorkingProjectionViewModels(
  api: Pick<
    ObservabilityApi,
    | "queryRoomState"
    | "queryTelemetryRollups"
    | "queryRecentTraces"
    | "queryWorkingPanelMetadata"
  >,
): readonly WorkingPanelViewModel[] {
  const basePanels = safePanelMetadata(api.queryWorkingPanelMetadata());
  const panels = toPanelMap(basePanels);

  applyRows(panels, "room_state", rowsFromRoomState(api.queryRoomState()));
  const telemetryRows = rowsFromTelemetry(api.queryTelemetryRollups());
  applyRows(panels, "system_status", telemetryRows.system_status);
  applyRows(panels, "cost_usage", telemetryRows.cost_usage);
  applyRows(
    panels,
    "recent_activity",
    rowsFromRecentTraces(api.queryRecentTraces()),
  );

  return Object.freeze(
    listWorkingPanels().map((panel) => clone(panels[panel.panel_id] ?? panel)),
  );
}

function safePanelMetadata(
  response: ObservabilityResponse<readonly WorkingPanelViewModel[]>,
): readonly WorkingPanelViewModel[] {
  if (!isSafeResponse(response) || !Array.isArray(response.data)) {
    return listWorkingPanels().map(withheldPanel);
  }
  return response.data.map((panel) =>
    isSafePanel(panel) ? clone(panel) : withheldPanel(panel),
  );
}

function toPanelMap(panels: readonly WorkingPanelViewModel[]): PanelMap {
  return Object.fromEntries(
    listWorkingPanels().map((fallback) => {
      const panel =
        panels.find((candidate) => candidate.panel_id === fallback.panel_id) ??
        fallback;
      return [fallback.panel_id, clone(panel)];
    }),
  ) as PanelMap;
}

function applyRows(
  panels: PanelMap,
  panelId: WorkingPanelId,
  rows: readonly WorkingPlaceholderRow[] | null,
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

function rowsFromRoomState(
  response: ObservabilityResponse<{
    readonly room_status: string;
    readonly stale: boolean;
    readonly summaries: readonly {
      readonly status: string;
      readonly device_id: string | null;
      readonly sensor_id: string | null;
    }[];
  }>,
): readonly WorkingPlaceholderRow[] | null {
  if (!isSafeResponse(response) || !response.data) return null;
  return [
    { label: "Room", value: safeValue(response.data.room_status) },
    {
      label: "Freshness",
      value: response.data.stale ? "stale" : "current",
    },
    { label: "Summaries", value: String(response.data.summaries.length) },
    {
      label: "Known",
      value: String(
        response.data.summaries.filter((summary) => summary.status === "known")
          .length,
      ),
    },
  ];
}

function rowsFromRecentTraces(
  response: ObservabilityResponse<{
    readonly traces: readonly { readonly trace_kind: string }[];
  }>,
): readonly WorkingPlaceholderRow[] | null {
  if (!isSafeResponse(response) || !response.data) return null;
  return [
    { label: "Traces", value: String(response.data.traces.length) },
    {
      label: "Replay safe",
      value: response.replay_safe ? "metadata only" : "withheld",
    },
  ];
}

function rowsFromTelemetry(
  response: ObservabilityResponse<{
    readonly telemetry_by_scope: readonly unknown[];
    readonly telemetry_by_severity: readonly unknown[];
    readonly runtime_by_status: readonly unknown[];
    readonly model_calls_by_provider: readonly unknown[];
  }>,
): {
  readonly system_status: readonly WorkingPlaceholderRow[] | null;
  readonly cost_usage: readonly WorkingPlaceholderRow[] | null;
} {
  if (!isSafeResponse(response) || !response.data) {
    return { system_status: null, cost_usage: null };
  }
  return {
    system_status: [
      {
        label: "Telemetry",
        value: String(response.data.telemetry_by_scope.length),
      },
      {
        label: "Runtime",
        value: String(response.data.runtime_by_status.length),
      },
    ],
    cost_usage: [
      {
        label: "Model calls",
        value: String(response.data.model_calls_by_provider.length),
      },
      {
        label: "Severity bands",
        value: String(response.data.telemetry_by_severity.length),
      },
    ],
  };
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

function isSafePanel(panel: WorkingPanelViewModel): boolean {
  return (
    panel.data_classification === "metadata_only" &&
    panel.authority === "read_only" &&
    panel.metadataOnly === true &&
    panel.shellAuthority === "none" &&
    isSafeMetadataValue(panel)
  );
}

function withheldPanel(panel: WorkingPanelViewModel): WorkingPanelViewModel {
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
