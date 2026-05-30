import { z } from "zod";

import { buildArchitectureGraphProjectionStats } from "@/lib/architecture-graph";
import { createDefaultWorkingCockpitViewModel } from "@/lib/command-center/working-cockpit-view-models";

export const TELEMETRY_COCKPIT_CONTRACT_VERSION = "19B.1" as const;

export const TELEMETRY_COCKPIT_PANEL_KINDS = [
  "model_runtime",
  "router",
  "costs",
  "approval_runtime",
  "scheduler",
  "vision_runtime",
  "voice_runtime",
  "room_runtime",
  "event_store",
  "architecture_graph",
  "safety_governance",
] as const;

export const TELEMETRY_COCKPIT_METRIC_KINDS = [
  "counts",
  "latency_bands",
  "health_bands",
  "success_failure_ratios",
  "budget_cost_summaries",
  "activity_summaries",
] as const;

export const TELEMETRY_COCKPIT_HEALTH_BANDS = [
  "unknown",
  "healthy",
  "nominal",
  "degraded",
  "blocked",
] as const;

export const TELEMETRY_COCKPIT_TIME_WINDOWS = [
  "latest_metadata",
  "five_minutes",
  "one_hour",
  "one_day",
  "one_week",
  "one_month",
] as const;

export const TELEMETRY_COCKPIT_SEVERITIES = [
  "info",
  "notice",
  "warning",
] as const;

export const TELEMETRY_COCKPIT_BANDS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;

const CockpitIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^telemetry-[a-z]+:[a-z0-9._:-]+$/);

export const TelemetryCockpitPanelKindSchema = z.enum(
  TELEMETRY_COCKPIT_PANEL_KINDS,
);
export const TelemetryCockpitMetricKindSchema = z.enum(
  TELEMETRY_COCKPIT_METRIC_KINDS,
);
export const TelemetryCockpitHealthBandSchema = z.enum(
  TELEMETRY_COCKPIT_HEALTH_BANDS,
);
export const TelemetryCockpitTimeWindowSchema = z.enum(
  TELEMETRY_COCKPIT_TIME_WINDOWS,
);
export const TelemetryCockpitSeveritySchema = z.enum(
  TELEMETRY_COCKPIT_SEVERITIES,
);
export const TelemetryCockpitBandSchema = z.enum(TELEMETRY_COCKPIT_BANDS);

export const TelemetryCockpitDisabledCapabilityFlagsSchema = z.strictObject({
  execution_enabled: z.literal(false),
  retry_enabled: z.literal(false),
  approval_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  dispatch_enabled: z.literal(false),
  authority_surface_enabled: z.literal(false),
  telemetry_ingestion_enabled: z.literal(false),
  polling_enabled: z.literal(false),
  websocket_enabled: z.literal(false),
  runtime_observer_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
});

export const TelemetryCockpitMetricSchema = z.strictObject({
  metric_id: CockpitIdSchema,
  kind: TelemetryCockpitMetricKindSchema,
  label: z.string().trim().min(1).max(120),
  value_label: z.string().trim().min(1).max(120),
  count: z.number().int().nonnegative().nullable(),
  band: TelemetryCockpitBandSchema,
  health_band: TelemetryCockpitHealthBandSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  exact_event_payload_included: z.literal(false),
  raw_value_included: z.literal(false),
});

export const TelemetryCockpitAlertSchema = z.strictObject({
  alert_id: CockpitIdSchema,
  panel_kind: TelemetryCockpitPanelKindSchema,
  severity: TelemetryCockpitSeveritySchema,
  label: z.string().trim().min(1).max(160),
  health_band: TelemetryCockpitHealthBandSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_event_included: z.literal(false),
});

export const TelemetryCockpitWarningSchema = z.strictObject({
  warning_id: CockpitIdSchema,
  panel_kind: TelemetryCockpitPanelKindSchema.nullable(),
  severity: TelemetryCockpitSeveritySchema,
  label: z.string().trim().min(1).max(180),
  recommendation: z.string().trim().min(1).max(220),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const TelemetryCockpitPanelSchema = z.strictObject({
  panel_id: CockpitIdSchema,
  kind: TelemetryCockpitPanelKindSchema,
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(220),
  health_band: TelemetryCockpitHealthBandSchema,
  time_window: TelemetryCockpitTimeWindowSchema,
  source_refs: z.array(z.string().trim().min(1).max(140)),
  metrics: z.array(TelemetryCockpitMetricSchema).min(1),
  alerts: z.array(TelemetryCockpitAlertSchema),
  warnings: z.array(TelemetryCockpitWarningSchema),
  disabled_capability_flags: TelemetryCockpitDisabledCapabilityFlagsSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  render_safe: z.literal(true),
  deterministic: z.literal(true),
  payload_classes_exposed: z.array(z.never()),
});

export const TelemetryCockpitStatsSchema = z.strictObject({
  panel_count: z.number().int().nonnegative(),
  metric_count: z.number().int().nonnegative(),
  alert_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  healthy_panel_count: z.number().int().nonnegative(),
  degraded_panel_count: z.number().int().nonnegative(),
  blocked_panel_count: z.number().int().nonnegative(),
  metadata_source_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const TelemetryCockpitProjectionSchema = z.strictObject({
  projection_id: z.literal("telemetry-cockpit:phase-19b1-projection"),
  contract_version: z.literal(TELEMETRY_COCKPIT_CONTRACT_VERSION),
  generated_from: z.literal("deterministic_existing_projection_metadata"),
  time_window: TelemetryCockpitTimeWindowSchema,
  panels: z
    .array(TelemetryCockpitPanelSchema)
    .length(TELEMETRY_COCKPIT_PANEL_KINDS.length),
  stats: TelemetryCockpitStatsSchema,
  alerts: z.array(TelemetryCockpitAlertSchema),
  warnings: z.array(TelemetryCockpitWarningSchema),
  disabled_capability_flags: TelemetryCockpitDisabledCapabilityFlagsSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  render_safe: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  payload_classes_exposed: z.array(z.never()),
});

export const TelemetryCockpitSafetyValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(
    z.enum([
      "telemetry_cockpit_projection_safe",
      "schema_rejected",
      "forbidden_field_name",
      "forbidden_affordance_name",
      "secret_pattern_detected",
      "executable_payload_detected",
      "disabled_capability_enabled",
    ]),
  ),
  violation_paths: z.array(z.string().trim().min(1).max(260)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  diagnostics_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export type TelemetryCockpitPanelKind = z.infer<
  typeof TelemetryCockpitPanelKindSchema
>;
export type TelemetryCockpitMetricKind = z.infer<
  typeof TelemetryCockpitMetricKindSchema
>;
export type TelemetryCockpitHealthBand = z.infer<
  typeof TelemetryCockpitHealthBandSchema
>;
export type TelemetryCockpitTimeWindow = z.infer<
  typeof TelemetryCockpitTimeWindowSchema
>;
export type TelemetryCockpitMetric = z.infer<
  typeof TelemetryCockpitMetricSchema
>;
export type TelemetryCockpitAlert = z.infer<typeof TelemetryCockpitAlertSchema>;
export type TelemetryCockpitWarning = z.infer<
  typeof TelemetryCockpitWarningSchema
>;
export type TelemetryCockpitPanel = z.infer<typeof TelemetryCockpitPanelSchema>;
export type TelemetryCockpitStats = z.infer<typeof TelemetryCockpitStatsSchema>;
export type TelemetryCockpitProjection = z.infer<
  typeof TelemetryCockpitProjectionSchema
>;
export type TelemetryCockpitSafetyValidation = z.infer<
  typeof TelemetryCockpitSafetyValidationSchema
>;

const DISABLED_CAPABILITY_FLAGS =
  TelemetryCockpitDisabledCapabilityFlagsSchema.parse({
    execution_enabled: false,
    retry_enabled: false,
    approval_enabled: false,
    mutation_enabled: false,
    dispatch_enabled: false,
    authority_surface_enabled: false,
    telemetry_ingestion_enabled: false,
    polling_enabled: false,
    websocket_enabled: false,
    runtime_observer_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
    network_call_enabled: false,
  });

const PANEL_TITLES: Record<TelemetryCockpitPanelKind, string> = {
  model_runtime: "Model Runtime",
  router: "Router",
  costs: "Costs",
  approval_runtime: "Approval Runtime",
  scheduler: "Scheduler",
  vision_runtime: "Vision Runtime",
  voice_runtime: "Voice Runtime",
  room_runtime: "Room Runtime",
  event_store: "Event Store",
  architecture_graph: "Architecture Graph",
  safety_governance: "Safety/Governance",
};

const PANEL_SUMMARIES: Record<TelemetryCockpitPanelKind, string> = {
  model_runtime:
    "Model activity metadata summarized from existing runtime contracts.",
  router:
    "Routing metadata summarized through the existing working cockpit model.",
  costs: "Cost and budget bands summarized as redaction-safe metadata.",
  approval_runtime:
    "Approval lifecycle posture summarized without creating approvals.",
  scheduler: "Routine and suggestion activity summarized without scheduling.",
  vision_runtime: "Vision observations represented as metadata bands only.",
  voice_runtime:
    "Voice runtime posture represented without audio or transcripts.",
  room_runtime: "Room adapter activity represented without device actions.",
  event_store:
    "Persistence health represented through projection-safe metadata.",
  architecture_graph:
    "Architecture graph stats summarized from Phase 19A projection.",
  safety_governance:
    "Safety boundary posture summarized without authority surfaces.",
};

const PANEL_SOURCE_REFS: Record<TelemetryCockpitPanelKind, readonly string[]> =
  {
    model_runtime: ["command-center:working-cockpit:model-runtime"],
    router: ["command-center:working-cockpit:router"],
    costs: ["command-center:working-cockpit:costs"],
    approval_runtime: ["approval-runtime:phase-18-final-closeout"],
    scheduler: ["command-center:working-cockpit:routines"],
    vision_runtime: ["command-center:working-cockpit:vision"],
    voice_runtime: ["voice-runtime:metadata-contracts"],
    room_runtime: ["command-center:working-cockpit:environment"],
    event_store: ["observability:projection-contracts"],
    architecture_graph: ["architecture-graph:phase-19a-projection"],
    safety_governance: ["command-center:observability-safety-contracts"],
  };

function copyProjection<T>(schema: z.ZodType<T>, value: T): T {
  return schema.parse(JSON.parse(JSON.stringify(value)));
}

function metric(input: {
  readonly panelKind: TelemetryCockpitPanelKind;
  readonly kind: TelemetryCockpitMetricKind;
  readonly slug: string;
  readonly label: string;
  readonly valueLabel: string;
  readonly count?: number | null;
  readonly band?: z.infer<typeof TelemetryCockpitBandSchema>;
  readonly healthBand?: TelemetryCockpitHealthBand;
}): TelemetryCockpitMetric {
  return TelemetryCockpitMetricSchema.parse({
    metric_id: `telemetry-metric:${input.panelKind}:${input.slug}`,
    kind: input.kind,
    label: input.label,
    value_label: input.valueLabel,
    count: input.count ?? null,
    band: input.band ?? "unknown",
    health_band: input.healthBand ?? "unknown",
    metadata_only: true,
    read_only: true,
    exact_event_payload_included: false,
    raw_value_included: false,
  });
}

function warning(input: {
  readonly panelKind: TelemetryCockpitPanelKind | null;
  readonly slug: string;
  readonly label: string;
  readonly recommendation: string;
  readonly severity?: z.infer<typeof TelemetryCockpitSeveritySchema>;
}): TelemetryCockpitWarning {
  return TelemetryCockpitWarningSchema.parse({
    warning_id: `telemetry-warning:${input.panelKind ?? "global"}:${input.slug}`,
    panel_kind: input.panelKind,
    severity: input.severity ?? "notice",
    label: input.label,
    recommendation: input.recommendation,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  });
}

function alert(input: {
  readonly panelKind: TelemetryCockpitPanelKind;
  readonly slug: string;
  readonly label: string;
  readonly healthBand?: TelemetryCockpitHealthBand;
  readonly severity?: z.infer<typeof TelemetryCockpitSeveritySchema>;
}): TelemetryCockpitAlert {
  return TelemetryCockpitAlertSchema.parse({
    alert_id: `telemetry-alert:${input.panelKind}:${input.slug}`,
    panel_kind: input.panelKind,
    severity: input.severity ?? "info",
    label: input.label,
    health_band: input.healthBand ?? "nominal",
    metadata_only: true,
    read_only: true,
    raw_event_included: false,
  });
}

function metricsForPanel(
  kind: TelemetryCockpitPanelKind,
): TelemetryCockpitMetric[] {
  const architectureStats = buildArchitectureGraphProjectionStats();
  const workingCockpit = createDefaultWorkingCockpitViewModel();
  const workingPanelCount = workingCockpit.panel_order.length;

  if (kind === "architecture_graph") {
    return [
      metric({
        panelKind: kind,
        kind: "counts",
        slug: "node-count",
        label: "Graph nodes",
        valueLabel: `${architectureStats.node_count} metadata nodes`,
        count: architectureStats.node_count,
        band: "medium",
        healthBand: "healthy",
      }),
      metric({
        panelKind: kind,
        kind: "counts",
        slug: "tripwire-count",
        label: "Tripwire edges",
        valueLabel: `${architectureStats.forbidden_edge_count} warning tripwires`,
        count: architectureStats.forbidden_edge_count,
        band: "low",
        healthBand: "nominal",
      }),
    ];
  }

  if (kind === "costs") {
    return [
      metric({
        panelKind: kind,
        kind: "budget_cost_summaries",
        slug: "cost-band",
        label: "Cost band",
        valueLabel: "unknown cost band",
        band: "unknown",
      }),
      metric({
        panelKind: kind,
        kind: "activity_summaries",
        slug: "source-panels",
        label: "Projection panels",
        valueLabel: `${workingPanelCount} existing panel descriptors`,
        count: workingPanelCount,
        band: "medium",
      }),
    ];
  }

  return [
    metric({
      panelKind: kind,
      kind: "counts",
      slug: "activity-count",
      label: "Activity count band",
      valueLabel: "metadata count band",
      band: "unknown",
    }),
    metric({
      panelKind: kind,
      kind: "latency_bands",
      slug: "latency",
      label: "Latency band",
      valueLabel: "metadata latency band",
      band: "unknown",
    }),
    metric({
      panelKind: kind,
      kind: "health_bands",
      slug: "health",
      label: "Health band",
      valueLabel: "nominal metadata posture",
      band: "low",
      healthBand: "nominal",
    }),
    metric({
      panelKind: kind,
      kind: "success_failure_ratios",
      slug: "success-failure",
      label: "Success/failure ratio",
      valueLabel: "ratio withheld to metadata band",
      band: "unknown",
    }),
  ];
}

function panel(kind: TelemetryCockpitPanelKind): TelemetryCockpitPanel {
  const panelWarnings =
    kind === "event_store"
      ? [
          warning({
            panelKind: kind,
            slug: "no-direct-store-read",
            label: "Event Store panel uses projection metadata only",
            recommendation:
              "Keep direct database reads disabled for Phase 19B.1.",
          }),
        ]
      : [];

  return TelemetryCockpitPanelSchema.parse({
    panel_id: `telemetry-panel:${kind}`,
    kind,
    title: PANEL_TITLES[kind],
    summary: PANEL_SUMMARIES[kind],
    health_band: kind === "event_store" ? "nominal" : "unknown",
    time_window: "latest_metadata",
    source_refs: [...PANEL_SOURCE_REFS[kind]],
    metrics: metricsForPanel(kind),
    alerts:
      kind === "safety_governance"
        ? [
            alert({
              panelKind: kind,
              slug: "read-only-posture",
              label: "Safety cockpit remains read-only",
              healthBand: "healthy",
            }),
          ]
        : [],
    warnings: panelWarnings,
    disabled_capability_flags: DISABLED_CAPABILITY_FLAGS,
    metadata_only: true,
    read_only: true,
    render_safe: true,
    deterministic: true,
    payload_classes_exposed: [],
  });
}

function statsForPanels(
  panels: readonly TelemetryCockpitPanel[],
  warnings: readonly TelemetryCockpitWarning[],
): TelemetryCockpitStats {
  return TelemetryCockpitStatsSchema.parse({
    panel_count: panels.length,
    metric_count: panels.reduce(
      (count, item) => count + item.metrics.length,
      0,
    ),
    alert_count: panels.reduce((count, item) => count + item.alerts.length, 0),
    warning_count:
      warnings.length +
      panels.reduce((count, item) => count + item.warnings.length, 0),
    healthy_panel_count: panels.filter((item) => item.health_band === "healthy")
      .length,
    degraded_panel_count: panels.filter(
      (item) => item.health_band === "degraded",
    ).length,
    blocked_panel_count: panels.filter((item) => item.health_band === "blocked")
      .length,
    metadata_source_count: new Set(panels.flatMap((item) => item.source_refs))
      .size,
    metadata_only: true,
    read_only: true,
  });
}

function globalWarnings(): TelemetryCockpitWarning[] {
  return [
    warning({
      panelKind: null,
      slug: "projection-only",
      label: "Phase 19B.1 uses deterministic projection metadata only",
      recommendation:
        "Keep ingestion, polling, observers, and direct store reads out of this slice.",
      severity: "info",
    }),
  ];
}

export function buildTelemetryCockpitProjection(): TelemetryCockpitProjection {
  const panels = TELEMETRY_COCKPIT_PANEL_KINDS.map(panel);
  const warnings = globalWarnings();
  const projection = TelemetryCockpitProjectionSchema.parse({
    projection_id: "telemetry-cockpit:phase-19b1-projection",
    contract_version: TELEMETRY_COCKPIT_CONTRACT_VERSION,
    generated_from: "deterministic_existing_projection_metadata",
    time_window: "latest_metadata",
    panels,
    stats: statsForPanels(panels, warnings),
    alerts: panels.flatMap((item) => item.alerts),
    warnings,
    disabled_capability_flags: DISABLED_CAPABILITY_FLAGS,
    metadata_only: true,
    read_only: true,
    render_safe: true,
    deterministic: true,
    redaction_safe: true,
    payload_classes_exposed: [],
  });

  return copyProjection(TelemetryCockpitProjectionSchema, projection);
}

export function buildTelemetryCockpitStats(): TelemetryCockpitStats {
  return copyProjection(
    TelemetryCockpitStatsSchema,
    buildTelemetryCockpitProjection().stats,
  );
}

export function listTelemetryCockpitPanels(): readonly TelemetryCockpitPanel[] {
  return buildTelemetryCockpitProjection().panels.map((item) =>
    copyProjection(TelemetryCockpitPanelSchema, item),
  );
}

export function listTelemetryCockpitWarnings(): readonly TelemetryCockpitWarning[] {
  const projection = buildTelemetryCockpitProjection();
  return [
    ...projection.warnings,
    ...projection.panels.flatMap((item) => item.warnings),
  ].map((item) => copyProjection(TelemetryCockpitWarningSchema, item));
}

const FORBIDDEN_FIELD_NAMES = new Set([
  "prompt",
  "prompts",
  "raw_prompt",
  "model_output",
  "raw_model_output",
  "tool_args",
  "tool_arguments",
  "raw_tool_arguments",
  "ocr_text",
  "raw_ocr_text",
  "screenshot",
  "raw_screenshot",
  "frame",
  "frames",
  "raw_frame",
  "audio",
  "raw_audio",
  "secret",
  "secrets",
  "api_key",
  "approval_token",
  "raw_approval_token",
  "executable_payload",
  "command",
  "script",
]);

const FORBIDDEN_AFFORDANCE_NAMES = new Set([
  "execute",
  "retry",
  "approve",
  "mutate",
  "dispatch",
  "run",
  "tool_call",
  "call_tool",
]);

const SECRET_PATTERNS = [
  /\bsk-[a-z0-9_-]{10,}\b/i,
  /\bapi[_-]?key\s*[:=]\s*['"]?[a-z0-9_-]{10,}/i,
  /\bbearer\s+[a-z0-9._-]{12,}/i,
] as const;

const EXECUTABLE_PATTERNS = [
  /^\s*function\s+[a-z0-9_$]*\s*\(/i,
  /^\s*(async\s+)?\([^)]*\)\s*=>/i,
  /^\s*(rm\s+-rf|curl\s+https?:\/\/|wget\s+https?:\/\/|powershell\s+-|bash\s+-c|cmd\s+\/c)\b/i,
] as const;

function collectSafetyViolations(
  input: unknown,
  path: string,
  violations: Map<string, string>,
): void {
  if (typeof input === "string") {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(input))) {
      violations.set(path, "secret_pattern_detected");
    }
    if (EXECUTABLE_PATTERNS.some((pattern) => pattern.test(input))) {
      violations.set(path, "executable_payload_detected");
    }
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      collectSafetyViolations(item, `${path}[${index}]`, violations);
    });
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    const normalized = key.trim().toLowerCase();
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_FIELD_NAMES.has(normalized)) {
      violations.set(childPath, "forbidden_field_name");
      continue;
    }
    if (FORBIDDEN_AFFORDANCE_NAMES.has(normalized)) {
      violations.set(childPath, "forbidden_affordance_name");
      continue;
    }
    collectSafetyViolations(value, childPath, violations);
  }
}

function enabledDisabledCapability(input: unknown): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }
  if (Array.isArray(input)) {
    return input.some(enabledDisabledCapability);
  }
  for (const [key, value] of Object.entries(input)) {
    if (key.endsWith("_enabled") && key !== "metadata_only" && value === true) {
      return true;
    }
    if (enabledDisabledCapability(value)) {
      return true;
    }
  }
  return false;
}

export function validateTelemetryCockpitProjectionSafety(
  input: unknown,
): TelemetryCockpitSafetyValidation {
  const parsed = TelemetryCockpitProjectionSchema.safeParse(input);
  const violations = new Map<string, string>();
  collectSafetyViolations(input, "$", violations);
  if (enabledDisabledCapability(input)) {
    violations.set("$", "disabled_capability_enabled");
  }
  if (!parsed.success) {
    violations.set("$", "schema_rejected");
  }

  const reasons = [...new Set(violations.values())] as z.infer<
    typeof TelemetryCockpitSafetyValidationSchema
  >["reasons"];

  return TelemetryCockpitSafetyValidationSchema.parse({
    passed: violations.size === 0,
    reasons:
      violations.size === 0 ? ["telemetry_cockpit_projection_safe"] : reasons,
    violation_paths: [...violations.keys()].sort(),
    metadata_only: true,
    read_only: true,
    diagnostics_only: true,
    raw_value_included: false,
  });
}
