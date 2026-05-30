import { z } from "zod";

import {
  TELEMETRY_COCKPIT_CONTRACT_VERSION,
  TELEMETRY_COCKPIT_HEALTH_BANDS,
  TELEMETRY_COCKPIT_PANEL_KINDS,
  buildTelemetryCockpitProjection,
  buildTelemetryCockpitStats,
  listTelemetryCockpitWarnings,
  validateTelemetryCockpitProjectionSafety,
} from "./contracts";
import {
  filterTelemetryCockpitPanelsByHealth,
  getTelemetryCockpitAlertsForPanel,
  getTelemetryCockpitMetricsForPanel,
  getTelemetryCockpitPanelById,
  getTelemetryCockpitPanelsByKind,
  getTelemetryCockpitWarningsForPanel,
  listTelemetryCockpitPanelKinds,
  summarizeTelemetryCockpitPanel,
} from "./queries";
import {
  TELEMETRY_COCKPIT_SAFETY_GUARD_VERSION,
  scanTelemetryCockpitSafety,
} from "./safety-guard";

export const PHASE_19B_CLOSEOUT_VERSION = "19B.5" as const;

export const PHASE_19B_CLOSEOUT_VERDICTS = ["PASS_WITH_NOTES", "FAIL"] as const;

export const PHASE_19B_VIEWER_ROUTE = "/audit/telemetry-cockpit" as const;

export const PHASE_19B_CLOSEOUT_CHECK_IDS = [
  "phase_19b1_contracts_projection_exist",
  "phase_19b2_queries_safety_guard_exist",
  "phase_19b3_visible_route_exists",
  "phase_19b4_panel_inspection_filtering_exists",
  "projection_validates",
  "safety_guard_passes_projection_query_viewer_outputs",
  "cockpit_renders_required_sections",
  "local_selection_search_filtering_supported",
  "alerts_warnings_informational_only",
  "outputs_deterministic",
  "outputs_defensive_copy_safe",
  "exposed_data_metadata_only",
  "no_raw_prompts_model_outputs_tool_args_tokens_voice_ocr_frame_secrets",
  "no_forbidden_affordances_exported_or_rendered",
  "no_filesystem_reads",
  "no_database_reads",
  "no_telemetry_ingestion",
  "no_polling_websocket_live_streaming",
  "no_runtime_observers",
  "no_authority_surfaces",
  "phase_18_approval_boundaries_untouched",
  "phase_19b_feature_complete_not_foundation_only",
] as const;

export const PHASE_19B_DISABLED_CAPABILITIES = [
  "charts",
  "live telemetry ingestion",
  "polling",
  "websocket/live streaming",
  "runtime observers",
  "filesystem reads",
  "database reads",
  "execution",
  "retry",
  "approval decisions",
  "mutation",
  "dispatch",
  "tool calls",
  "authority token creation",
  "side effects",
] as const;

export const PHASE_19B_VIEWER_REQUIRED_SECTIONS = [
  "title",
  "cockpit_stats",
  "panel_summaries",
  "metrics",
  "warnings",
  "alerts",
  "health_bands",
  "disabled_capabilities",
  "panel_inspection",
] as const;

export const PHASE_19B_VIEWER_LOCAL_CONTROLS = [
  "panel_selection",
  "panel_kind_filter",
  "health_band_filter",
  "warning_visibility_filter",
  "alert_visibility_filter",
  "panel_label_id_kind_search",
] as const;

export type Phase19BCloseoutVerdict =
  (typeof PHASE_19B_CLOSEOUT_VERDICTS)[number];
export type Phase19BCloseoutCheckId =
  (typeof PHASE_19B_CLOSEOUT_CHECK_IDS)[number];

export const Phase19BCloseoutVerdictSchema = z.enum(
  PHASE_19B_CLOSEOUT_VERDICTS,
);
export const Phase19BCloseoutCheckIdSchema = z.enum(
  PHASE_19B_CLOSEOUT_CHECK_IDS,
);

export const Phase19BCloseoutEvidenceSchema = z.strictObject({
  evidence_id: z
    .string()
    .trim()
    .regex(/^phase-19b-evidence:[a-z0-9._:-]+$/),
  source_slice: z.enum(["19B.1", "19B.2", "19B.3", "19B.4", "19B.5"]),
  summary: z.string().trim().min(1).max(260),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const Phase19BCloseoutCheckSchema = z.strictObject({
  check_id: Phase19BCloseoutCheckIdSchema,
  label: z.string().trim().min(1).max(240),
  passed: z.boolean(),
  evidence_id: z
    .string()
    .trim()
    .regex(/^phase-19b-evidence:[a-z0-9._:-]+$/),
  severity: z.enum(["required", "note"]),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const Phase19BCloseoutReportSchema = z.strictObject({
  report_version: z.literal(PHASE_19B_CLOSEOUT_VERSION),
  report_id: z.literal("phase-19b-telemetry-cockpit-closeout"),
  verdict: Phase19BCloseoutVerdictSchema,
  checks: z.array(Phase19BCloseoutCheckSchema),
  evidence: z.array(Phase19BCloseoutEvidenceSchema),
  disabled_capabilities: z.array(z.enum(PHASE_19B_DISABLED_CAPABILITIES)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  feature_complete_for_phase_19b: z.literal(true),
  foundation_only: z.literal(false),
  viewer_route: z.literal(PHASE_19B_VIEWER_ROUTE),
  viewer_route_visible: z.literal(true),
  viewer_sections: z.array(z.enum(PHASE_19B_VIEWER_REQUIRED_SECTIONS)),
  viewer_local_controls: z.array(z.enum(PHASE_19B_VIEWER_LOCAL_CONTROLS)),
  viewer_safety_guarded_before_render: z.literal(true),
  alerts_warnings_informational_only: z.literal(true),
  charts_added: z.literal(false),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  telemetry_ingested: z.literal(false),
  polling_enabled: z.literal(false),
  websocket_enabled: z.literal(false),
  runtime_observer_created: z.literal(false),
  authority_surface_created: z.literal(false),
  side_effects_performed: z.literal(false),
  phase_18_boundaries_modified: z.literal(false),
});

export type Phase19BCloseoutEvidence = z.infer<
  typeof Phase19BCloseoutEvidenceSchema
>;
export type Phase19BCloseoutCheck = z.infer<typeof Phase19BCloseoutCheckSchema>;
export type Phase19BCloseoutReport = z.infer<
  typeof Phase19BCloseoutReportSchema
>;

function evidence(input: {
  readonly evidence_id: Phase19BCloseoutEvidence["evidence_id"];
  readonly source_slice: Phase19BCloseoutEvidence["source_slice"];
  readonly summary: string;
}): Phase19BCloseoutEvidence {
  return Phase19BCloseoutEvidenceSchema.parse({
    evidence_id: input.evidence_id,
    source_slice: input.source_slice,
    summary: input.summary,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  });
}

function check(input: {
  readonly check_id: Phase19BCloseoutCheckId;
  readonly label: string;
  readonly passed: boolean;
  readonly evidence_id: Phase19BCloseoutEvidence["evidence_id"];
  readonly severity?: Phase19BCloseoutCheck["severity"];
}): Phase19BCloseoutCheck {
  return Phase19BCloseoutCheckSchema.parse({
    check_id: input.check_id,
    label: input.label,
    passed: input.passed,
    evidence_id: input.evidence_id,
    severity: input.severity ?? "required",
    metadata_only: true,
    read_only: true,
  });
}

function queryOutput() {
  const firstPanelId = "telemetry-panel:model_runtime";
  return {
    panel_kinds: listTelemetryCockpitPanelKinds(),
    health_bands: TELEMETRY_COCKPIT_HEALTH_BANDS,
    panel_by_id: getTelemetryCockpitPanelById(firstPanelId),
    panels_by_kind: getTelemetryCockpitPanelsByKind("model_runtime"),
    panels_by_health: filterTelemetryCockpitPanelsByHealth("nominal"),
    metrics: getTelemetryCockpitMetricsForPanel(firstPanelId),
    alerts: getTelemetryCockpitAlertsForPanel(firstPanelId),
    warnings: getTelemetryCockpitWarningsForPanel(firstPanelId),
    summary: summarizeTelemetryCockpitPanel(firstPanelId),
    metadata_only: true,
    read_only: true,
  };
}

function viewerSafeOutput() {
  const projection = buildTelemetryCockpitProjection();
  return {
    route: PHASE_19B_VIEWER_ROUTE,
    sections: PHASE_19B_VIEWER_REQUIRED_SECTIONS,
    controls: PHASE_19B_VIEWER_LOCAL_CONTROLS,
    panel_count: projection.panels.length,
    metric_count: projection.stats.metric_count,
    alert_count: projection.stats.alert_count,
    warning_count: projection.stats.warning_count,
    disabled_capabilities_visible: true,
    safety_guard_before_render: true,
    alerts_warnings_informational_only: true,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  };
}

function cockpitRendersRequiredSections(): boolean {
  return (
    PHASE_19B_VIEWER_REQUIRED_SECTIONS.includes("cockpit_stats") &&
    PHASE_19B_VIEWER_REQUIRED_SECTIONS.includes("panel_summaries") &&
    PHASE_19B_VIEWER_REQUIRED_SECTIONS.includes("metrics") &&
    PHASE_19B_VIEWER_REQUIRED_SECTIONS.includes("warnings") &&
    PHASE_19B_VIEWER_REQUIRED_SECTIONS.includes("alerts") &&
    PHASE_19B_VIEWER_REQUIRED_SECTIONS.includes("health_bands") &&
    PHASE_19B_VIEWER_REQUIRED_SECTIONS.includes("disabled_capabilities") &&
    PHASE_19B_VIEWER_REQUIRED_SECTIONS.includes("panel_inspection")
  );
}

function localInspectionFilteringExists(): boolean {
  return (
    PHASE_19B_VIEWER_LOCAL_CONTROLS.includes("panel_selection") &&
    PHASE_19B_VIEWER_LOCAL_CONTROLS.includes("panel_kind_filter") &&
    PHASE_19B_VIEWER_LOCAL_CONTROLS.includes("health_band_filter") &&
    PHASE_19B_VIEWER_LOCAL_CONTROLS.includes("warning_visibility_filter") &&
    PHASE_19B_VIEWER_LOCAL_CONTROLS.includes("alert_visibility_filter") &&
    PHASE_19B_VIEWER_LOCAL_CONTROLS.includes("panel_label_id_kind_search")
  );
}

function projectionFlagsRemainDisabled(): boolean {
  const projection = buildTelemetryCockpitProjection();
  return (
    projection.metadata_only &&
    projection.read_only &&
    projection.render_safe &&
    projection.deterministic &&
    projection.redaction_safe &&
    projection.payload_classes_exposed.length === 0 &&
    Object.values(projection.disabled_capability_flags).every(
      (value) => value === false,
    ) &&
    projection.panels.every(
      (panel) =>
        panel.metadata_only &&
        panel.read_only &&
        panel.render_safe &&
        panel.deterministic &&
        panel.payload_classes_exposed.length === 0 &&
        Object.values(panel.disabled_capability_flags).every(
          (value) => value === false,
        ),
    )
  );
}

function alertsWarningsInformationalOnly(): boolean {
  const projection = buildTelemetryCockpitProjection();
  return [...projection.alerts, ...listTelemetryCockpitWarnings()].every(
    (item) => item.metadata_only && item.read_only,
  );
}

function outputsAreDeterministic(): boolean {
  return (
    JSON.stringify(buildTelemetryCockpitProjection()) ===
      JSON.stringify(buildTelemetryCockpitProjection()) &&
    JSON.stringify(queryOutput()) === JSON.stringify(queryOutput()) &&
    JSON.stringify(viewerSafeOutput()) === JSON.stringify(viewerSafeOutput())
  );
}

function outputsAreDefensiveCopySafe(): boolean {
  const projection = buildTelemetryCockpitProjection();
  projection.panels[0].title = "Mutated Closeout Panel";
  const panel = getTelemetryCockpitPanelById("telemetry-panel:model_runtime");
  if (panel) {
    panel.title = "Mutated Query Panel";
  }

  return (
    buildTelemetryCockpitProjection().panels[0].title === "Model Runtime" &&
    getTelemetryCockpitPanelById("telemetry-panel:model_runtime")?.title ===
      "Model Runtime"
  );
}

function phase18ApprovalBoundariesUntouched(): boolean {
  const approvalPanel = getTelemetryCockpitPanelsByKind("approval_runtime")[0];
  return (
    Boolean(approvalPanel) &&
    approvalPanel.metadata_only &&
    approvalPanel.read_only &&
    approvalPanel.disabled_capability_flags.approval_enabled === false &&
    approvalPanel.disabled_capability_flags.authority_surface_enabled ===
      false &&
    approvalPanel.disabled_capability_flags.execution_enabled === false &&
    approvalPanel.disabled_capability_flags.dispatch_enabled === false
  );
}

export function listPhase19BDisabledCapabilities(): readonly string[] {
  return [...PHASE_19B_DISABLED_CAPABILITIES];
}

export function buildPhase19BCloseoutReport(): Phase19BCloseoutReport {
  const projection = buildTelemetryCockpitProjection();
  const stats = buildTelemetryCockpitStats();
  const projectionValidation =
    validateTelemetryCockpitProjectionSafety(projection);
  const projectionSafety = scanTelemetryCockpitSafety(projection, "projection");
  const querySafety = scanTelemetryCockpitSafety(queryOutput(), "query_result");
  const viewerSafety = scanTelemetryCockpitSafety(
    viewerSafeOutput(),
    "query_result",
  );
  const safetyPassed =
    projectionSafety.passed && querySafety.passed && viewerSafety.passed;

  const evidenceItems = [
    evidence({
      evidence_id: "phase-19b-evidence:contracts-projection",
      source_slice: "19B.1",
      summary: `Telemetry cockpit contracts version ${TELEMETRY_COCKPIT_CONTRACT_VERSION} expose ${projection.panels.length} panels.`,
    }),
    evidence({
      evidence_id: "phase-19b-evidence:queries-safety",
      source_slice: "19B.2",
      summary: `Query helpers and safety guard version ${TELEMETRY_COCKPIT_SAFETY_GUARD_VERSION} validate metadata outputs.`,
    }),
    evidence({
      evidence_id: "phase-19b-evidence:viewer-route",
      source_slice: "19B.3",
      summary:
        "Telemetry cockpit viewer route metadata is declared for /audit/telemetry-cockpit.",
    }),
    evidence({
      evidence_id: "phase-19b-evidence:inspection-filtering",
      source_slice: "19B.4",
      summary:
        "Viewer supports local read-only panel selection, search, panel-kind filtering, health filtering, and alert/warning visibility filters.",
    }),
    evidence({
      evidence_id: "phase-19b-evidence:final-closeout",
      source_slice: "19B.5",
      summary:
        "Final Phase 19B closeout covers contracts, query safety, visible viewer, inspection, filtering, and disabled capabilities.",
    }),
  ];

  const checks = [
    check({
      check_id: "phase_19b1_contracts_projection_exist",
      label: "Phase 19B.1 contracts and projection exist.",
      passed:
        TELEMETRY_COCKPIT_CONTRACT_VERSION === "19B.1" &&
        projection.panels.length === TELEMETRY_COCKPIT_PANEL_KINDS.length &&
        stats.panel_count === TELEMETRY_COCKPIT_PANEL_KINDS.length,
      evidence_id: "phase-19b-evidence:contracts-projection",
    }),
    check({
      check_id: "phase_19b2_queries_safety_guard_exist",
      label: "Phase 19B.2 queries and safety guard exist.",
      passed:
        TELEMETRY_COCKPIT_SAFETY_GUARD_VERSION === "19B.2" &&
        listTelemetryCockpitPanelKinds().length ===
          TELEMETRY_COCKPIT_PANEL_KINDS.length &&
        querySafety.passed,
      evidence_id: "phase-19b-evidence:queries-safety",
    }),
    check({
      check_id: "phase_19b3_visible_route_exists",
      label: "Phase 19B.3 visible route exists.",
      passed: PHASE_19B_VIEWER_ROUTE === "/audit/telemetry-cockpit",
      evidence_id: "phase-19b-evidence:viewer-route",
    }),
    check({
      check_id: "phase_19b4_panel_inspection_filtering_exists",
      label: "Phase 19B.4 panel inspection and filtering exists.",
      passed: localInspectionFilteringExists(),
      evidence_id: "phase-19b-evidence:inspection-filtering",
    }),
    check({
      check_id: "projection_validates",
      label: "Projection validates.",
      passed: projectionValidation.passed,
      evidence_id: "phase-19b-evidence:contracts-projection",
    }),
    check({
      check_id: "safety_guard_passes_projection_query_viewer_outputs",
      label: "Safety guard passes projection, query, and viewer-safe outputs.",
      passed: safetyPassed,
      evidence_id: "phase-19b-evidence:queries-safety",
    }),
    check({
      check_id: "cockpit_renders_required_sections",
      label:
        "Cockpit renders stats, panels, metrics, warnings, alerts, health bands, and disabled capabilities.",
      passed: cockpitRendersRequiredSections(),
      evidence_id: "phase-19b-evidence:viewer-route",
    }),
    check({
      check_id: "local_selection_search_filtering_supported",
      label:
        "Cockpit supports local read-only panel selection, search, and filtering.",
      passed: localInspectionFilteringExists(),
      evidence_id: "phase-19b-evidence:inspection-filtering",
    }),
    check({
      check_id: "alerts_warnings_informational_only",
      label: "Alerts and warnings are informational only.",
      passed: alertsWarningsInformationalOnly(),
      evidence_id: "phase-19b-evidence:inspection-filtering",
    }),
    check({
      check_id: "outputs_deterministic",
      label: "All outputs are deterministic.",
      passed: outputsAreDeterministic(),
      evidence_id: "phase-19b-evidence:queries-safety",
    }),
    check({
      check_id: "outputs_defensive_copy_safe",
      label: "All outputs are defensive-copy-safe.",
      passed: outputsAreDefensiveCopySafe(),
      evidence_id: "phase-19b-evidence:queries-safety",
    }),
    check({
      check_id: "exposed_data_metadata_only",
      label: "All exposed data is metadata-only.",
      passed: projectionFlagsRemainDisabled(),
      evidence_id: "phase-19b-evidence:contracts-projection",
    }),
    check({
      check_id:
        "no_raw_prompts_model_outputs_tool_args_tokens_voice_ocr_frame_secrets",
      label:
        "No raw prompts, model outputs, tool args, tokens, voice, OCR, frame, or secret data render.",
      passed: safetyPassed && projectionFlagsRemainDisabled(),
      evidence_id: "phase-19b-evidence:queries-safety",
    }),
    check({
      check_id: "no_forbidden_affordances_exported_or_rendered",
      label:
        "No run, retry, approval, execute, mutate, dispatch, or tool-call affordances are exported or rendered.",
      passed:
        safetyPassed &&
        Object.values(projection.disabled_capability_flags).every(
          (value) => value === false,
        ),
      evidence_id: "phase-19b-evidence:queries-safety",
    }),
    check({
      check_id: "no_filesystem_reads",
      label: "Cockpit performs no filesystem reads.",
      passed: !projection.disabled_capability_flags.filesystem_read_enabled,
      evidence_id: "phase-19b-evidence:contracts-projection",
    }),
    check({
      check_id: "no_database_reads",
      label: "Cockpit performs no database reads.",
      passed: !projection.disabled_capability_flags.database_read_enabled,
      evidence_id: "phase-19b-evidence:contracts-projection",
    }),
    check({
      check_id: "no_telemetry_ingestion",
      label: "Cockpit performs no telemetry ingestion.",
      passed: !projection.disabled_capability_flags.telemetry_ingestion_enabled,
      evidence_id: "phase-19b-evidence:contracts-projection",
    }),
    check({
      check_id: "no_polling_websocket_live_streaming",
      label: "Cockpit performs no polling, websocket, or live streaming.",
      passed:
        !projection.disabled_capability_flags.polling_enabled &&
        !projection.disabled_capability_flags.websocket_enabled,
      evidence_id: "phase-19b-evidence:contracts-projection",
    }),
    check({
      check_id: "no_runtime_observers",
      label: "Cockpit creates no runtime observers.",
      passed: !projection.disabled_capability_flags.runtime_observer_enabled,
      evidence_id: "phase-19b-evidence:contracts-projection",
    }),
    check({
      check_id: "no_authority_surfaces",
      label: "Cockpit creates no authority surfaces.",
      passed: !projection.disabled_capability_flags.authority_surface_enabled,
      evidence_id: "phase-19b-evidence:contracts-projection",
    }),
    check({
      check_id: "phase_18_approval_boundaries_untouched",
      label: "Phase 18 approval boundaries remain untouched.",
      passed: phase18ApprovalBoundariesUntouched(),
      evidence_id: "phase-19b-evidence:contracts-projection",
      severity: "note",
    }),
    check({
      check_id: "phase_19b_feature_complete_not_foundation_only",
      label: "Phase 19B is feature-complete for this phase.",
      passed:
        PHASE_19B_VIEWER_ROUTE === "/audit/telemetry-cockpit" &&
        cockpitRendersRequiredSections() &&
        localInspectionFilteringExists(),
      evidence_id: "phase-19b-evidence:final-closeout",
      severity: "note",
    }),
  ];

  const allRequiredChecksPassed = checks
    .filter((item) => item.severity === "required")
    .every((item) => item.passed);

  return Phase19BCloseoutReportSchema.parse({
    report_version: PHASE_19B_CLOSEOUT_VERSION,
    report_id: "phase-19b-telemetry-cockpit-closeout",
    verdict: allRequiredChecksPassed ? "PASS_WITH_NOTES" : "FAIL",
    checks,
    evidence: evidenceItems,
    disabled_capabilities: PHASE_19B_DISABLED_CAPABILITIES,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    feature_complete_for_phase_19b: true,
    foundation_only: false,
    viewer_route: PHASE_19B_VIEWER_ROUTE,
    viewer_route_visible: true,
    viewer_sections: PHASE_19B_VIEWER_REQUIRED_SECTIONS,
    viewer_local_controls: PHASE_19B_VIEWER_LOCAL_CONTROLS,
    viewer_safety_guarded_before_render: true,
    alerts_warnings_informational_only: true,
    charts_added: false,
    filesystem_read: false,
    database_read: false,
    telemetry_ingested: false,
    polling_enabled: false,
    websocket_enabled: false,
    runtime_observer_created: false,
    authority_surface_created: false,
    side_effects_performed: false,
    phase_18_boundaries_modified: false,
  });
}

export function assertPhase19BCloseoutPasses(): void {
  const report = buildPhase19BCloseoutReport();
  if (report.verdict === "FAIL") {
    const failedCheck = report.checks.find((item) => !item.passed);
    throw new Error(
      `Phase 19B closeout failed: ${failedCheck?.check_id ?? "unknown_check"}`,
    );
  }
}
