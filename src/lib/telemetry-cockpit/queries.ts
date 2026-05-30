import { z } from "zod";

import {
  TELEMETRY_COCKPIT_PANEL_KINDS,
  TelemetryCockpitAlertSchema,
  TelemetryCockpitHealthBandSchema,
  TelemetryCockpitMetricSchema,
  TelemetryCockpitPanelKindSchema,
  TelemetryCockpitPanelSchema,
  TelemetryCockpitWarningSchema,
  buildTelemetryCockpitProjection,
  type TelemetryCockpitAlert,
  type TelemetryCockpitMetric,
  type TelemetryCockpitPanel,
  type TelemetryCockpitPanelKind,
  type TelemetryCockpitWarning,
} from "./contracts";

const TelemetryCockpitPanelIdSchema = z
  .string()
  .trim()
  .regex(/^telemetry-panel:[a-z0-9._:-]+$/);

export const TelemetryCockpitPanelSummarySchema = z.strictObject({
  panel_id: TelemetryCockpitPanelIdSchema,
  kind: TelemetryCockpitPanelKindSchema,
  title: z.string().trim().min(1).max(120),
  health_band: TelemetryCockpitHealthBandSchema,
  time_window: z.string().trim().min(1).max(80),
  metric_count: z.number().int().nonnegative(),
  alert_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  source_ref_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  execution_inferred: z.literal(false),
  authority_surface_created: z.literal(false),
});

export type TelemetryCockpitPanelSummary = z.infer<
  typeof TelemetryCockpitPanelSummarySchema
>;

function copyPanel(panel: TelemetryCockpitPanel): TelemetryCockpitPanel {
  return TelemetryCockpitPanelSchema.parse(JSON.parse(JSON.stringify(panel)));
}

function copyMetric(metric: TelemetryCockpitMetric): TelemetryCockpitMetric {
  return TelemetryCockpitMetricSchema.parse(JSON.parse(JSON.stringify(metric)));
}

function copyAlert(alert: TelemetryCockpitAlert): TelemetryCockpitAlert {
  return TelemetryCockpitAlertSchema.parse(JSON.parse(JSON.stringify(alert)));
}

function copyWarning(
  warning: TelemetryCockpitWarning,
): TelemetryCockpitWarning {
  return TelemetryCockpitWarningSchema.parse(
    JSON.parse(JSON.stringify(warning)),
  );
}

function panels(): readonly TelemetryCockpitPanel[] {
  return buildTelemetryCockpitProjection().panels;
}

function panelById(id: string): TelemetryCockpitPanel | null {
  return panels().find((panel) => panel.panel_id === id) ?? null;
}

export function listTelemetryCockpitPanelKinds(): readonly TelemetryCockpitPanelKind[] {
  return [...TELEMETRY_COCKPIT_PANEL_KINDS];
}

export function getTelemetryCockpitPanelById(
  id: string,
): TelemetryCockpitPanel | null {
  const parsedId = TelemetryCockpitPanelIdSchema.safeParse(id);
  if (!parsedId.success) {
    return null;
  }

  const panel = panelById(parsedId.data);
  return panel ? copyPanel(panel) : null;
}

export function getTelemetryCockpitPanelsByKind(
  kind: string,
): readonly TelemetryCockpitPanel[] {
  const parsedKind = TelemetryCockpitPanelKindSchema.safeParse(kind);
  if (!parsedKind.success) {
    return [];
  }

  return panels()
    .filter((panel) => panel.kind === parsedKind.data)
    .map(copyPanel);
}

export function getTelemetryCockpitMetricsForPanel(
  panelId: string,
): readonly TelemetryCockpitMetric[] {
  const panel = getTelemetryCockpitPanelById(panelId);
  return panel ? panel.metrics.map(copyMetric) : [];
}

export function getTelemetryCockpitAlertsForPanel(
  panelId: string,
): readonly TelemetryCockpitAlert[] {
  const panel = getTelemetryCockpitPanelById(panelId);
  return panel ? panel.alerts.map(copyAlert) : [];
}

export function getTelemetryCockpitWarningsForPanel(
  panelId: string,
): readonly TelemetryCockpitWarning[] {
  const panel = getTelemetryCockpitPanelById(panelId);
  return panel ? panel.warnings.map(copyWarning) : [];
}

export function summarizeTelemetryCockpitPanel(
  panelId: string,
): TelemetryCockpitPanelSummary | null {
  const panel = getTelemetryCockpitPanelById(panelId);
  if (!panel) {
    return null;
  }

  return TelemetryCockpitPanelSummarySchema.parse({
    panel_id: panel.panel_id,
    kind: panel.kind,
    title: panel.title,
    health_band: panel.health_band,
    time_window: panel.time_window,
    metric_count: panel.metrics.length,
    alert_count: panel.alerts.length,
    warning_count: panel.warnings.length,
    source_ref_count: panel.source_refs.length,
    metadata_only: true,
    read_only: true,
    execution_inferred: false,
    authority_surface_created: false,
  });
}

export function filterTelemetryCockpitPanelsByHealth(
  healthBand: string,
): readonly TelemetryCockpitPanel[] {
  const parsedHealth = TelemetryCockpitHealthBandSchema.safeParse(healthBand);
  if (!parsedHealth.success) {
    return [];
  }

  return panels()
    .filter((panel) => panel.health_band === parsedHealth.data)
    .map(copyPanel);
}
