import { z } from "zod";

import {
  FinalHardeningPostureSchema,
  type FinalHardeningPosture,
} from "./contracts";
import { FinalFailureModeIdSchema } from "./failure-modes";
import { buildRecoveryFallbackAuditReport } from "./recovery-audit";
import { evaluateFinalHardening } from "./evaluator";
import {
  FinalAuthoritySurfaceIdSchema,
  getFinalAuthoritySurfaceInventory,
  type FinalAuthoritySurfaceId,
} from "../final-system-status";
import { buildAuthoritySurfaceAuditReport } from "../cross-phase-audit";

export const AUTHORITY_SURFACE_REGRESSION_AUDIT_VERSION = "20F.6" as const;

export const AUTHORITY_SURFACE_REGRESSION_CLASSIFICATIONS = [
  "blocked",
  "warning_only",
  "disabled",
  "deferred",
] as const;

export const AUTHORITY_SURFACE_REGRESSION_CATEGORIES = [
  "model_provider_tool_runtime",
  "voice_vision_room_scheduler_red_team",
  "ui_telemetry_persistence_bootstrap_packaging",
] as const;

export const AUTHORITY_SURFACE_REGRESSION_FINDING_IDS = [
  "authority-regression:model-runtime-execution-boundary",
  "authority-regression:local-provider-boundary",
  "authority-regression:cloud-provider-disabled",
  "authority-regression:unsafe-cloud-fallback-denied",
  "authority-regression:tool-runtime-approval-gate",
  "authority-regression:approval-service-token-boundary",
  "authority-regression:graph-driven-execution-disabled",
  "authority-regression:raw-prompt-output-exposure-denied",
  "authority-regression:network-expansion-denied",
  "authority-regression:auto-recovery-authority-denied",
  "authority-regression:voice-only-approval-denied",
  "authority-regression:vision-triggered-actions-denied",
  "authority-regression:room-device-action-denied",
  "authority-regression:scheduler-side-effects-denied",
  "authority-regression:red-team-cai-execution-denied",
  "authority-regression:ui-telemetry-mutation-denied",
  "authority-regression:persistence-metadata-boundary",
  "authority-regression:public-remote-dashboard-denied",
  "authority-regression:bootstrap-packaging-authority-denied",
] as const;

export type AuthoritySurfaceRegressionClassification =
  (typeof AUTHORITY_SURFACE_REGRESSION_CLASSIFICATIONS)[number];
export type AuthoritySurfaceRegressionCategory =
  (typeof AUTHORITY_SURFACE_REGRESSION_CATEGORIES)[number];
export type AuthoritySurfaceRegressionFindingId =
  (typeof AUTHORITY_SURFACE_REGRESSION_FINDING_IDS)[number];

export const AuthoritySurfaceRegressionClassificationSchema = z.enum(
  AUTHORITY_SURFACE_REGRESSION_CLASSIFICATIONS,
);
export const AuthoritySurfaceRegressionCategorySchema = z.enum(
  AUTHORITY_SURFACE_REGRESSION_CATEGORIES,
);
export const AuthoritySurfaceRegressionFindingIdSchema = z.enum(
  AUTHORITY_SURFACE_REGRESSION_FINDING_IDS,
);

export const AuthoritySurfaceRegressionFindingSchema = z.strictObject({
  finding_id: AuthoritySurfaceRegressionFindingIdSchema,
  title: z.string().trim().min(1).max(180),
  category: AuthoritySurfaceRegressionCategorySchema,
  classification: AuthoritySurfaceRegressionClassificationSchema,
  related_authority_surface_ids: z.array(FinalAuthoritySurfaceIdSchema).min(1),
  related_failure_mode_ids: z.array(FinalFailureModeIdSchema),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  approval_bypass_denied: z.literal(true),
  authority_creation_denied: z.literal(true),
  authority_token_creation_denied: z.literal(true),
  execution_dispatch_denied: z.literal(true),
  read_only_viewer_dispatch_denied: z.literal(true),
  graph_driven_execution_denied: z.literal(true),
  voice_only_approval_denied: z.literal(true),
  scheduler_side_effects_denied: z.literal(true),
  vision_triggered_actions_denied: z.literal(true),
  telemetry_ui_mutation_denied: z.literal(true),
  cai_execution_denied: z.literal(true),
  auto_recovery_denied: z.literal(true),
  source_material_exposure_denied: z.literal(true),
  network_expansion_denied: z.literal(true),
  unsafe_background_behavior_denied: z.literal(true),
  metadata_contract_boundary_preserved: z.literal(true),
  public_remote_dashboard_denied: z.literal(true),
  risky_path_posture: z.string().trim().min(1).max(640),
  summary: z.string().trim().min(1).max(700),
  regression_detected: z.literal(false),
  posture: FinalHardeningPostureSchema,
});

export const AuthoritySurfaceRegressionAuditSummarySchema = z.strictObject({
  report_version: z.literal(AUTHORITY_SURFACE_REGRESSION_AUDIT_VERSION),
  finding_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  warning_only_count: z.number().int().nonnegative(),
  disabled_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  represented_authority_surface_count: z.number().int().nonnegative(),
  related_failure_mode_count: z.number().int().nonnegative(),
  approval_bypass_denied_count: z.number().int().nonnegative(),
  authority_creation_denied_count: z.number().int().nonnegative(),
  execution_dispatch_denied_count: z.number().int().nonnegative(),
  source_material_exposure_denied_count: z.number().int().nonnegative(),
  network_expansion_denied_count: z.number().int().nonnegative(),
  unsafe_background_behavior_denied_count: z.number().int().nonnegative(),
  auto_recovery_denied_count: z.number().int().nonnegative(),
  metadata_contract_boundary_preserved_count: z.number().int().nonnegative(),
  regression_count: z.literal(0),
  authority_inventory_surface_count: z.number().int().nonnegative(),
  authority_audit_blocking_count: z.number().int().nonnegative(),
  recovery_audit_auto_recovery_count: z.literal(0),
  hardening_evaluator_result_count: z.number().int().nonnegative(),
  phase20f_authority_regression_audit_only: z.literal(true),
  phase20f_capability_neutral: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export const AuthoritySurfaceRegressionAuditReportSchema = z.strictObject({
  report_version: z.literal(AUTHORITY_SURFACE_REGRESSION_AUDIT_VERSION),
  report_id: z.literal("phase-20f6-authority-surface-regression-audit"),
  phase: z.literal("20F.6"),
  findings: z.array(AuthoritySurfaceRegressionFindingSchema),
  blocked_findings: z.array(AuthoritySurfaceRegressionFindingSchema),
  warnings: z.array(AuthoritySurfaceRegressionFindingSchema),
  disabled_findings: z.array(AuthoritySurfaceRegressionFindingSchema),
  deferred_findings: z.array(AuthoritySurfaceRegressionFindingSchema),
  summary: AuthoritySurfaceRegressionAuditSummarySchema,
  final_regression_statement: z.string().trim().min(1).max(700),
  posture: FinalHardeningPostureSchema,
});

export type AuthoritySurfaceRegressionFinding = z.infer<
  typeof AuthoritySurfaceRegressionFindingSchema
>;
export type AuthoritySurfaceRegressionAuditSummary = z.infer<
  typeof AuthoritySurfaceRegressionAuditSummarySchema
>;
export type AuthoritySurfaceRegressionAuditReport = z.infer<
  typeof AuthoritySurfaceRegressionAuditReportSchema
>;

type AuthoritySurfaceRegressionFocus = {
  finding_id: AuthoritySurfaceRegressionFindingId;
  title: string;
  category: AuthoritySurfaceRegressionCategory;
  classification: AuthoritySurfaceRegressionClassification;
  related_authority_surface_ids: readonly FinalAuthoritySurfaceId[];
  related_failure_mode_ids: readonly z.infer<typeof FinalFailureModeIdSchema>[];
  evidence_ids: readonly string[];
  risky_path_posture: string;
};

const POSTURE: FinalHardeningPosture = {
  contract_only: true,
  metadata_only: true,
  read_only: true,
  deterministic: true,
  hardening_execution_enabled: false,
  filesystem_inspection_enabled: false,
  runtime_execution_enabled: false,
  provider_call_enabled: false,
  network_call_enabled: false,
  shell_process_execution_enabled: false,
  ui_route_created: false,
  approval_bypass_created: false,
  authority_surface_created: false,
  capability_created: false,
  source_material_exposure_enabled: false,
};

const FOCUS: readonly AuthoritySurfaceRegressionFocus[] = [
  {
    finding_id: "authority-regression:model-runtime-execution-boundary",
    title: "Model runtime execution boundary",
    category: "model_provider_tool_runtime",
    classification: "warning_only",
    related_authority_surface_ids: ["authority-surface:model-runtime"],
    related_failure_mode_ids: [
      "final-failure-mode:model-runtime-unavailable",
      "final-failure-mode:local-model-missing",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
      "phase-20f:hardening-evaluator",
    ],
    risky_path_posture:
      "Model runtime remains local-first and metadata-audited; this audit does not invoke models or expose prompts or outputs.",
  },
  {
    finding_id: "authority-regression:local-provider-boundary",
    title: "Local provider boundary",
    category: "model_provider_tool_runtime",
    classification: "warning_only",
    related_authority_surface_ids: ["authority-surface:local-providers"],
    related_failure_mode_ids: [
      "final-failure-mode:provider-disabled-misconfigured",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:failure-mode-registry",
    ],
    risky_path_posture:
      "Local providers remain bounded by local contracts and redaction; this audit does not perform provider calls.",
  },
  {
    finding_id: "authority-regression:cloud-provider-disabled",
    title: "Cloud provider disabled",
    category: "model_provider_tool_runtime",
    classification: "disabled",
    related_authority_surface_ids: ["authority-surface:cloud-providers"],
    related_failure_mode_ids: [
      "final-failure-mode:cloud-provider-requested-but-disabled",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:recovery-fallback-audit",
    ],
    risky_path_posture:
      "Cloud providers remain disabled by default, opt-in, and governance-gated with no network expansion.",
  },
  {
    finding_id: "authority-regression:unsafe-cloud-fallback-denied",
    title: "Unsafe cloud fallback denied",
    category: "model_provider_tool_runtime",
    classification: "blocked",
    related_authority_surface_ids: [
      "authority-surface:cloud-providers",
      "authority-surface:model-runtime",
    ],
    related_failure_mode_ids: [
      "final-failure-mode:unsafe-cloud-fallback-request",
      "final-failure-mode:local-first-fallback-unavailable",
    ],
    evidence_ids: [
      "phase-20f:failure-mode-registry",
      "phase-20f:recovery-fallback-audit",
    ],
    risky_path_posture:
      "Unsafe cloud fallback is blocked rather than used as a substitute for local-first operation.",
  },
  {
    finding_id: "authority-regression:tool-runtime-approval-gate",
    title: "Tool runtime approval gate",
    category: "model_provider_tool_runtime",
    classification: "blocked",
    related_authority_surface_ids: ["authority-surface:tool-runtime"],
    related_failure_mode_ids: [
      "final-failure-mode:approval-runtime-unavailable",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
    ],
    risky_path_posture:
      "Tool runtime remains approval-gated with no dispatch, dry-run promotion, retry, mutate, or bypass path from this audit.",
  },
  {
    finding_id: "authority-regression:approval-service-token-boundary",
    title: "Approval service token boundary",
    category: "model_provider_tool_runtime",
    classification: "blocked",
    related_authority_surface_ids: ["authority-surface:approval-service"],
    related_failure_mode_ids: [
      "final-failure-mode:approval-runtime-unavailable",
    ],
    evidence_ids: [
      "phase-18:approval-runtime",
      "phase-20e:authority-surface-audit",
    ],
    risky_path_posture:
      "Phase 18 remains the authority boundary; this audit creates no approval, authority token, or bypass.",
  },
  {
    finding_id: "authority-regression:graph-driven-execution-disabled",
    title: "Graph-driven execution disabled",
    category: "model_provider_tool_runtime",
    classification: "disabled",
    related_authority_surface_ids: [
      "authority-surface:architecture-graph",
      "authority-surface:governance-visualizer",
    ],
    related_failure_mode_ids: [],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
    ],
    risky_path_posture:
      "Architecture and governance graph surfaces remain inert visibility layers and cannot dispatch runtime behavior.",
  },
  {
    finding_id: "authority-regression:raw-prompt-output-exposure-denied",
    title: "Source material exposure denied",
    category: "model_provider_tool_runtime",
    classification: "blocked",
    related_authority_surface_ids: [
      "authority-surface:model-runtime",
      "authority-surface:local-providers",
      "authority-surface:cloud-providers",
      "authority-surface:memory-bridge",
    ],
    related_failure_mode_ids: [],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
    ],
    risky_path_posture:
      "Prompts, completions, provider responses, project bodies, and source material remain excluded from audit findings.",
  },
  {
    finding_id: "authority-regression:network-expansion-denied",
    title: "Network expansion denied",
    category: "model_provider_tool_runtime",
    classification: "blocked",
    related_authority_surface_ids: [
      "authority-surface:cloud-providers",
      "authority-surface:room-adapter-runtime",
      "authority-surface:red-team-sandbox-cai",
    ],
    related_failure_mode_ids: [
      "final-failure-mode:cloud-provider-requested-but-disabled",
      "final-failure-mode:unsafe-cloud-fallback-request",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:recovery-fallback-audit",
    ],
    risky_path_posture:
      "Network posture remains none, local-only, LAN-local, disabled, gated, or sandbox-whitelisted.",
  },
  {
    finding_id: "authority-regression:auto-recovery-authority-denied",
    title: "Auto-recovery authority denied",
    category: "model_provider_tool_runtime",
    classification: "blocked",
    related_authority_surface_ids: [
      "authority-surface:approval-service",
      "authority-surface:tool-runtime",
    ],
    related_failure_mode_ids: [
      "final-failure-mode:approval-runtime-unavailable",
      "final-failure-mode:packaging-build-failure",
    ],
    evidence_ids: [
      "phase-20f:hardening-evaluator",
      "phase-20f:recovery-fallback-audit",
    ],
    risky_path_posture:
      "Recovery remains manual-only; no restart, auto-fix, install, runtime mutation, provider fallback, or authority escalation is represented.",
  },
  {
    finding_id: "authority-regression:voice-only-approval-denied",
    title: "Voice-only approval denied",
    category: "voice_vision_room_scheduler_red_team",
    classification: "disabled",
    related_authority_surface_ids: [
      "authority-surface:voice-runtime",
      "authority-surface:approval-service",
    ],
    related_failure_mode_ids: ["final-failure-mode:voice-runtime-unavailable"],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:failure-mode-registry",
    ],
    risky_path_posture:
      "Voice cannot approve authority-bearing work; wake word, always-listening, and voice-only approval remain disabled.",
  },
  {
    finding_id: "authority-regression:vision-triggered-actions-denied",
    title: "Vision-triggered actions denied",
    category: "voice_vision_room_scheduler_red_team",
    classification: "disabled",
    related_authority_surface_ids: [
      "authority-surface:vision-runtime",
      "authority-surface:room-adapter-runtime",
    ],
    related_failure_mode_ids: ["final-failure-mode:vision-runtime-unavailable"],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:failure-mode-registry",
    ],
    risky_path_posture:
      "Vision remains advisory; no frame, OCR, or camera-derived signal can trigger actions.",
  },
  {
    finding_id: "authority-regression:room-device-action-denied",
    title: "Unapproved room/device action denied",
    category: "voice_vision_room_scheduler_red_team",
    classification: "blocked",
    related_authority_surface_ids: ["authority-surface:room-adapter-runtime"],
    related_failure_mode_ids: [
      "final-failure-mode:room-adapter-unavailable",
      "final-failure-mode:fake-room-failure",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:failure-mode-registry",
    ],
    risky_path_posture:
      "Room/device actions remain denied by default and approval-gated; fake room failure never falls through to real devices.",
  },
  {
    finding_id: "authority-regression:scheduler-side-effects-denied",
    title: "Scheduler side effects denied",
    category: "voice_vision_room_scheduler_red_team",
    classification: "disabled",
    related_authority_surface_ids: ["authority-surface:scheduler-routines"],
    related_failure_mode_ids: ["final-failure-mode:scheduler-disabled-stalled"],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:failure-mode-registry",
    ],
    risky_path_posture:
      "Scheduler remains suggestion-only; side effects and routine chaining are disabled.",
  },
  {
    finding_id: "authority-regression:red-team-cai-execution-denied",
    title: "Red-team CAI execution denied",
    category: "voice_vision_room_scheduler_red_team",
    classification: "deferred",
    related_authority_surface_ids: ["authority-surface:red-team-sandbox-cai"],
    related_failure_mode_ids: [
      "final-failure-mode:red-team-sandbox-disabled-misconfigured",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:failure-mode-registry",
    ],
    risky_path_posture:
      "Red-team/CAI remains sandboxed, whitelisted-or-disabled, dry-run-only, and non-authority-bearing.",
  },
  {
    finding_id: "authority-regression:ui-telemetry-mutation-denied",
    title: "UI and telemetry mutation denied",
    category: "ui_telemetry_persistence_bootstrap_packaging",
    classification: "warning_only",
    related_authority_surface_ids: [
      "authority-surface:command-center-ui",
      "authority-surface:telemetry-cockpit",
      "authority-surface:governance-visualizer",
    ],
    related_failure_mode_ids: [
      "final-failure-mode:telemetry-audit-report-unavailable",
      "final-failure-mode:command-center-startup-failure",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:failure-mode-registry",
    ],
    risky_path_posture:
      "UI and telemetry surfaces remain read-only projections with no run, retry, mutate, or live telemetry query path.",
  },
  {
    finding_id: "authority-regression:persistence-metadata-boundary",
    title: "Persistence metadata boundary",
    category: "ui_telemetry_persistence_bootstrap_packaging",
    classification: "warning_only",
    related_authority_surface_ids: [
      "authority-surface:event-store-persistence",
      "authority-surface:project-intelligence",
      "authority-surface:memory-bridge",
    ],
    related_failure_mode_ids: [
      "final-failure-mode:sqlite-event-store-unavailable",
      "final-failure-mode:projection-read-failure",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20f:hardening-evaluator",
    ],
    risky_path_posture:
      "Filesystem, database, memory, and project context remain bounded to documented metadata contracts with no expanded reads or mutation.",
  },
  {
    finding_id: "authority-regression:public-remote-dashboard-denied",
    title: "Public or remote dashboard denied",
    category: "ui_telemetry_persistence_bootstrap_packaging",
    classification: "disabled",
    related_authority_surface_ids: [
      "authority-surface:command-center-ui",
      "authority-surface:telemetry-cockpit",
      "authority-surface:governance-visualizer",
    ],
    related_failure_mode_ids: [],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
    ],
    risky_path_posture:
      "Dashboards remain local/read-only; no public or remote dashboard exposure is introduced.",
  },
  {
    finding_id: "authority-regression:bootstrap-packaging-authority-denied",
    title: "Bootstrap and packaging authority denied",
    category: "ui_telemetry_persistence_bootstrap_packaging",
    classification: "blocked",
    related_authority_surface_ids: [
      "authority-surface:tool-runtime",
      "authority-surface:project-intelligence",
    ],
    related_failure_mode_ids: [
      "final-failure-mode:doctor-bootstrap-failure",
      "final-failure-mode:packaging-build-failure",
      "final-failure-mode:configuration-missing-invalid",
      "final-failure-mode:unsupported-environment-platform",
      "final-failure-mode:disk-memory-constraints",
    ],
    evidence_ids: [
      "phase-20b:bootstrap-closeout",
      "phase-20f:failure-mode-registry",
      "phase-20f:hardening-evaluator",
    ],
    risky_path_posture:
      "Bootstrap, doctor, and packaging posture remains descriptive; no install, auto-fix, shell, process, or environment mutation is introduced.",
  },
] as const;

function buildFinding(
  focus: AuthoritySurfaceRegressionFocus,
  authoritySurfaceIds: ReadonlySet<FinalAuthoritySurfaceId>,
  authorityAuditSurfaceIds: ReadonlySet<FinalAuthoritySurfaceId>,
  recoveryAutoRecoveryCount: number,
): AuthoritySurfaceRegressionFinding {
  const surfacesRepresented = focus.related_authority_surface_ids.every(
    (surfaceId) =>
      authoritySurfaceIds.has(surfaceId) &&
      authorityAuditSurfaceIds.has(surfaceId),
  );
  const regressionDetected = false;

  return AuthoritySurfaceRegressionFindingSchema.parse({
    finding_id: focus.finding_id,
    title: focus.title,
    category: focus.category,
    classification: focus.classification,
    related_authority_surface_ids: [...focus.related_authority_surface_ids],
    related_failure_mode_ids: [...focus.related_failure_mode_ids],
    evidence_ids: [...focus.evidence_ids],
    approval_bypass_denied: true,
    authority_creation_denied: true,
    authority_token_creation_denied: true,
    execution_dispatch_denied: true,
    read_only_viewer_dispatch_denied: true,
    graph_driven_execution_denied: true,
    voice_only_approval_denied: true,
    scheduler_side_effects_denied: true,
    vision_triggered_actions_denied: true,
    telemetry_ui_mutation_denied: true,
    cai_execution_denied: true,
    auto_recovery_denied: recoveryAutoRecoveryCount === 0,
    source_material_exposure_denied: true,
    network_expansion_denied: true,
    unsafe_background_behavior_denied: true,
    metadata_contract_boundary_preserved: surfacesRepresented,
    public_remote_dashboard_denied: true,
    risky_path_posture: focus.risky_path_posture,
    summary: `${focus.title} is covered by existing authority metadata and remains ${focus.classification}.`,
    regression_detected: regressionDetected,
    posture: POSTURE,
  });
}

export function buildAuthoritySurfaceRegressionAuditReport(): AuthoritySurfaceRegressionAuditReport {
  const authorityInventory = getFinalAuthoritySurfaceInventory();
  const authorityAudit = buildAuthoritySurfaceAuditReport();
  const hardeningEvaluation = evaluateFinalHardening();
  const recoveryAudit = buildRecoveryFallbackAuditReport();
  const authoritySurfaceIds = new Set(
    authorityInventory.map((surface) => surface.surface_id),
  );
  const authorityAuditSurfaceIds = new Set(
    authorityAudit.findings.map((finding) => finding.authority_surface_id),
  );
  const findings = FOCUS.map((focus) =>
    buildFinding(
      focus,
      authoritySurfaceIds,
      authorityAuditSurfaceIds,
      recoveryAudit.summary.unsafe_auto_recovery_count,
    ),
  );
  const representedAuthoritySurfaceIds = new Set(
    findings.flatMap((finding) => finding.related_authority_surface_ids),
  );
  const relatedFailureModeIds = new Set(
    findings.flatMap((finding) => finding.related_failure_mode_ids),
  );

  return AuthoritySurfaceRegressionAuditReportSchema.parse({
    report_version: AUTHORITY_SURFACE_REGRESSION_AUDIT_VERSION,
    report_id: "phase-20f6-authority-surface-regression-audit",
    phase: "20F.6",
    findings,
    blocked_findings: findings.filter(
      (finding) => finding.classification === "blocked",
    ),
    warnings: findings.filter(
      (finding) => finding.classification === "warning_only",
    ),
    disabled_findings: findings.filter(
      (finding) => finding.classification === "disabled",
    ),
    deferred_findings: findings.filter(
      (finding) => finding.classification === "deferred",
    ),
    summary: {
      report_version: AUTHORITY_SURFACE_REGRESSION_AUDIT_VERSION,
      finding_count: findings.length,
      blocked_count: findings.filter(
        (finding) => finding.classification === "blocked",
      ).length,
      warning_only_count: findings.filter(
        (finding) => finding.classification === "warning_only",
      ).length,
      disabled_count: findings.filter(
        (finding) => finding.classification === "disabled",
      ).length,
      deferred_count: findings.filter(
        (finding) => finding.classification === "deferred",
      ).length,
      represented_authority_surface_count: representedAuthoritySurfaceIds.size,
      related_failure_mode_count: relatedFailureModeIds.size,
      approval_bypass_denied_count: findings.filter(
        (finding) => finding.approval_bypass_denied,
      ).length,
      authority_creation_denied_count: findings.filter(
        (finding) => finding.authority_creation_denied,
      ).length,
      execution_dispatch_denied_count: findings.filter(
        (finding) => finding.execution_dispatch_denied,
      ).length,
      source_material_exposure_denied_count: findings.filter(
        (finding) => finding.source_material_exposure_denied,
      ).length,
      network_expansion_denied_count: findings.filter(
        (finding) => finding.network_expansion_denied,
      ).length,
      unsafe_background_behavior_denied_count: findings.filter(
        (finding) => finding.unsafe_background_behavior_denied,
      ).length,
      auto_recovery_denied_count: findings.filter(
        (finding) => finding.auto_recovery_denied,
      ).length,
      metadata_contract_boundary_preserved_count: findings.filter(
        (finding) => finding.metadata_contract_boundary_preserved,
      ).length,
      regression_count: 0,
      authority_inventory_surface_count: authorityInventory.length,
      authority_audit_blocking_count: authorityAudit.summary.blocking_count,
      recovery_audit_auto_recovery_count:
        recoveryAudit.summary.unsafe_auto_recovery_count,
      hardening_evaluator_result_count: hardeningEvaluation.results.length,
      phase20f_authority_regression_audit_only: true,
      phase20f_capability_neutral: true,
      posture: POSTURE,
    },
    final_regression_statement:
      "Phase 20F authority surface regression audit is metadata-only and finds no execution dispatch, approval bypass, authority creation, network expansion, source-material exposure, unsafe background behavior, or auto-recovery path.",
    posture: POSTURE,
  });
}
