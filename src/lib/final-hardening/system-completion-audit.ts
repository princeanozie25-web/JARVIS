import { z } from "zod";

import {
  FinalHardeningPostureSchema,
  type FinalHardeningPosture,
} from "./contracts";
import { buildRecoveryFallbackAuditReport } from "./recovery-audit";
import { buildAuthoritySurfaceRegressionAuditReport } from "./authority-surface-regression-audit";
import { buildGovernanceIntegrityAuditReport } from "./governance-integrity-audit";
import { buildDemoPortfolioReadinessAuditReport } from "./demo-portfolio-readiness-audit";
import {
  FinalSystemPhaseIdSchema,
  buildFinalReadinessSummary,
  getFinalSystemPhaseStatus,
  summarizeDisabledFeaturePosture,
} from "../final-system-status";
import {
  buildAuthoritySurfaceAuditReport,
  buildDisabledFeatureAuditReport,
} from "../cross-phase-audit";
import {
  buildPhase20DCloseoutReport,
  summarizePortfolioReport,
} from "../portfolio-readiness";
import { buildPhase20BCloseoutReport } from "../bootstrap-readiness";
import { buildPhase20CCloseoutReport } from "../onboarding-readiness";

export const SYSTEM_COMPLETION_AUDIT_VERSION = "20F.9" as const;

export const SYSTEM_COMPLETION_VERDICTS = ["pass_with_notes"] as const;

export const SYSTEM_COMPLETION_AREA_GROUPS = [
  "operationalization_system",
  "hardening_system",
  "disabled_by_design",
  "expansion_era",
] as const;

export const SYSTEM_COMPLETION_STATUSES = [
  "complete",
  "complete_with_notes",
  "disabled_by_design",
  "future_expansion",
] as const;

export const SYSTEM_GOVERNANCE_STATUSES = [
  "approval_gated",
  "safety_gated",
  "audit_gated",
  "read_only_or_inert",
  "sandboxed_governed",
  "future_governance_required",
] as const;

export const SYSTEM_DEPLOYMENT_STATUSES = [
  "shipped_operational",
  "metadata_ready",
  "deferred_disabled",
  "future_not_shipped",
] as const;

export const SYSTEM_COMPLETION_BLOCKING_CLASSIFICATIONS = [
  "blocking_if_missing",
  "non_blocking_note",
] as const;

export const SYSTEM_COMPLETION_AREA_IDS = [
  "system-completion:room-os",
  "system-completion:persistence-layer",
  "system-completion:command-center",
  "system-completion:model-runtime",
  "system-completion:voice-runtime",
  "system-completion:vision-runtime",
  "system-completion:room-adapter-runtime",
  "system-completion:scheduled-assistance-runtime",
  "system-completion:approval-gated-execution-layer",
  "system-completion:architecture-graph",
  "system-completion:telemetry-cockpit",
  "system-completion:governance-boundary-visualizer",
  "system-completion:cai-governed-red-team-layer",
  "system-completion:safety-regression",
  "system-completion:disabled-capability-audit",
  "system-completion:recovery-audit",
  "system-completion:authority-regression-audit",
  "system-completion:governance-integrity-audit",
  "system-completion:demo-portfolio-readiness-audit",
  "system-completion:disabled-wake-word",
  "system-completion:disabled-always-listening",
  "system-completion:disabled-background-camera",
  "system-completion:disabled-graph-driven-execution",
  "system-completion:disabled-viewer-driven-execution",
  "system-completion:disabled-autonomous-device-execution",
  "system-completion:disabled-autonomous-routines",
  "system-completion:disabled-public-dashboards",
  "system-completion:disabled-voice-only-approval",
  "system-completion:disabled-auto-approval",
  "system-completion:disabled-cai-execution",
  "system-completion:disabled-cai-installation",
  "system-completion:disabled-external-red-team-targets",
  "system-completion:expansion-obsidian-integration",
  "system-completion:expansion-graphify-overlay",
  "system-completion:expansion-llm-council",
  "system-completion:expansion-hitnexus-integration",
  "system-completion:expansion-llm-wiki",
  "system-completion:expansion-security-knowledge-systems",
  "system-completion:expansion-future-research-systems",
] as const;

export type SystemCompletionVerdict =
  (typeof SYSTEM_COMPLETION_VERDICTS)[number];
export type SystemCompletionAreaGroup =
  (typeof SYSTEM_COMPLETION_AREA_GROUPS)[number];
export type SystemCompletionStatus =
  (typeof SYSTEM_COMPLETION_STATUSES)[number];
export type SystemGovernanceStatus =
  (typeof SYSTEM_GOVERNANCE_STATUSES)[number];
export type SystemDeploymentStatus =
  (typeof SYSTEM_DEPLOYMENT_STATUSES)[number];
export type SystemCompletionBlockingClassification =
  (typeof SYSTEM_COMPLETION_BLOCKING_CLASSIFICATIONS)[number];
export type SystemCompletionAreaId =
  (typeof SYSTEM_COMPLETION_AREA_IDS)[number];

export const SystemCompletionVerdictSchema = z.enum(SYSTEM_COMPLETION_VERDICTS);
export const SystemCompletionAreaGroupSchema = z.enum(
  SYSTEM_COMPLETION_AREA_GROUPS,
);
export const SystemCompletionStatusSchema = z.enum(SYSTEM_COMPLETION_STATUSES);
export const SystemGovernanceStatusSchema = z.enum(SYSTEM_GOVERNANCE_STATUSES);
export const SystemDeploymentStatusSchema = z.enum(SYSTEM_DEPLOYMENT_STATUSES);
export const SystemCompletionBlockingClassificationSchema = z.enum(
  SYSTEM_COMPLETION_BLOCKING_CLASSIFICATIONS,
);
export const SystemCompletionAreaIdSchema = z.enum(SYSTEM_COMPLETION_AREA_IDS);

export const SystemCompletionAreaSchema = z.strictObject({
  system_area_id: SystemCompletionAreaIdSchema,
  title: z.string().trim().min(1).max(180),
  group: SystemCompletionAreaGroupSchema,
  completion_status: SystemCompletionStatusSchema,
  governance_status: SystemGovernanceStatusSchema,
  deployment_status: SystemDeploymentStatusSchema,
  related_phase_ids: z.array(FinalSystemPhaseIdSchema),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  rationale: z.string().trim().min(1).max(760),
  future_expansion: z.boolean(),
  blocking_classification: SystemCompletionBlockingClassificationSchema,
  blocking: z.boolean(),
  notes: z.array(z.string().trim().min(1).max(320)).min(1),
  posture: FinalHardeningPostureSchema,
});

export const SystemCompletionAuditSummarySchema = z.strictObject({
  report_version: z.literal(SYSTEM_COMPLETION_AUDIT_VERSION),
  system_area_count: z.number().int().positive(),
  operationalization_system_count: z.number().int().positive(),
  hardening_system_count: z.number().int().positive(),
  disabled_by_design_count: z.number().int().positive(),
  expansion_era_count: z.number().int().positive(),
  complete_count: z.number().int().nonnegative(),
  complete_with_notes_count: z.number().int().nonnegative(),
  disabled_by_design_status_count: z.number().int().nonnegative(),
  future_expansion_status_count: z.number().int().nonnegative(),
  shipped_operational_count: z.number().int().nonnegative(),
  metadata_ready_count: z.number().int().nonnegative(),
  deferred_disabled_count: z.number().int().nonnegative(),
  future_not_shipped_count: z.number().int().nonnegative(),
  blocking_count: z.number().int().nonnegative(),
  represented_core_phase_count: z.number().int().positive(),
  final_status_blocked_or_missing_count: z.number().int().nonnegative(),
  disabled_feature_count: z.number().int().positive(),
  portfolio_report_section_count: z.number().int().positive(),
  phase20b_complete: z.literal(true),
  phase20c_complete: z.literal(true),
  phase20d_complete: z.literal(true),
  disabled_feature_audit_blocking_count: z.number().int().nonnegative(),
  authority_surface_audit_blocking_count: z.number().int().nonnegative(),
  recovery_auto_recovery_count: z.literal(0),
  authority_regression_count: z.literal(0),
  governance_integrity_pass: z.literal(true),
  demo_portfolio_blocking_count: z.number().int().nonnegative(),
  core_jarvis_os_complete: z.literal(true),
  phase20f_system_completion_audit_only: z.literal(true),
  phase20f_capability_neutral: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export const SystemCompletionAuditReportSchema = z.strictObject({
  report_version: z.literal(SYSTEM_COMPLETION_AUDIT_VERSION),
  report_id: z.literal("phase-20f9-system-completion-audit"),
  phase: z.literal("20F.9"),
  verdict: SystemCompletionVerdictSchema,
  answers: z.strictObject({
    what_is_implemented: z.string().trim().min(1).max(760),
    what_is_complete: z.string().trim().min(1).max(760),
    what_is_intentionally_disabled: z.string().trim().min(1).max(760),
    what_is_future_expansion: z.string().trim().min(1).max(760),
    is_core_jarvis_os_complete: z.literal(true),
  }),
  system_areas: z.array(SystemCompletionAreaSchema),
  blocking_areas: z.array(SystemCompletionAreaSchema),
  summary: SystemCompletionAuditSummarySchema,
  final_completion_statement: z.string().trim().min(1).max(760),
  posture: FinalHardeningPostureSchema,
});

export type SystemCompletionArea = z.infer<typeof SystemCompletionAreaSchema>;
export type SystemCompletionAuditSummary = z.infer<
  typeof SystemCompletionAuditSummarySchema
>;
export type SystemCompletionAuditReport = z.infer<
  typeof SystemCompletionAuditReportSchema
>;

type SystemCompletionFocus = Omit<SystemCompletionArea, "posture">;

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

function operational(
  systemAreaId: SystemCompletionAreaId,
  title: string,
  phaseId: z.infer<typeof FinalSystemPhaseIdSchema>,
  completionStatus: SystemCompletionStatus,
  governanceStatus: SystemGovernanceStatus,
  rationale: string,
): SystemCompletionFocus {
  return {
    system_area_id: systemAreaId,
    title,
    group: "operationalization_system",
    completion_status: completionStatus,
    governance_status: governanceStatus,
    deployment_status:
      completionStatus === "complete"
        ? "shipped_operational"
        : "metadata_ready",
    related_phase_ids: [phaseId],
    evidence_ids: [`${phaseId}:final-system-status`],
    rationale,
    future_expansion: false,
    blocking_classification: "blocking_if_missing",
    blocking: false,
    notes: [
      "Completed core roadmap system represented by final status metadata.",
    ],
  };
}

function hardening(
  systemAreaId: SystemCompletionAreaId,
  title: string,
  evidenceIds: readonly string[],
  rationale: string,
): SystemCompletionFocus {
  return {
    system_area_id: systemAreaId,
    title,
    group: "hardening_system",
    completion_status: "complete",
    governance_status: "audit_gated",
    deployment_status: "metadata_ready",
    related_phase_ids: [],
    evidence_ids: [...evidenceIds],
    rationale,
    future_expansion: false,
    blocking_classification: "blocking_if_missing",
    blocking: false,
    notes: [
      "Final hardening/audit system represented as deterministic metadata.",
    ],
  };
}

function disabled(
  systemAreaId: SystemCompletionAreaId,
  title: string,
  evidenceIds: readonly string[],
  rationale: string,
): SystemCompletionFocus {
  return {
    system_area_id: systemAreaId,
    title,
    group: "disabled_by_design",
    completion_status: "disabled_by_design",
    governance_status: "future_governance_required",
    deployment_status: "deferred_disabled",
    related_phase_ids: [],
    evidence_ids: [...evidenceIds],
    rationale,
    future_expansion: false,
    blocking_classification: "non_blocking_note",
    blocking: false,
    notes: [
      "Disabled by design; absence is intentional completion, not missing work.",
    ],
  };
}

function expansion(
  systemAreaId: SystemCompletionAreaId,
  title: string,
  evidenceIds: readonly string[],
  rationale: string,
): SystemCompletionFocus {
  return {
    system_area_id: systemAreaId,
    title,
    group: "expansion_era",
    completion_status: "future_expansion",
    governance_status: "future_governance_required",
    deployment_status: "future_not_shipped",
    related_phase_ids: [],
    evidence_ids: [...evidenceIds],
    rationale,
    future_expansion: true,
    blocking_classification: "non_blocking_note",
    blocking: false,
    notes: [
      "Expansion-era roadmap item; not part of core JARVIS OS completion.",
    ],
  };
}

const FOCUS: readonly SystemCompletionFocus[] = [
  operational(
    "system-completion:room-os",
    "Room OS",
    "phase-10",
    "complete_with_notes",
    "safety_gated",
    "Room OS foundation, fake room, and local room profile metadata are complete with final packaging proof still noted separately.",
  ),
  operational(
    "system-completion:persistence-layer",
    "Persistence Layer",
    "phase-11",
    "complete",
    "audit_gated",
    "SQLite, append-only event store, projections, retention, and local persistence closeout are complete.",
  ),
  operational(
    "system-completion:command-center",
    "Command Center",
    "phase-12",
    "complete",
    "read_only_or_inert",
    "Command Center rest/working/audit surfaces are complete as local read-only observability surfaces.",
  ),
  operational(
    "system-completion:model-runtime",
    "Model Runtime",
    "phase-13",
    "complete",
    "safety_gated",
    "Local-first model runtime, registry, resolver, provider contracts, and closeout are complete.",
  ),
  operational(
    "system-completion:voice-runtime",
    "Voice Runtime",
    "phase-14",
    "complete",
    "safety_gated",
    "Voice runtime is complete as bounded transport with wake word, always-listening, and voice-only approval disabled.",
  ),
  operational(
    "system-completion:vision-runtime",
    "Vision Runtime",
    "phase-15",
    "complete",
    "safety_gated",
    "Vision runtime is complete as advisory, user-initiated, redacted metadata with no triggered actions.",
  ),
  operational(
    "system-completion:room-adapter-runtime",
    "Room Adapter Runtime",
    "phase-16",
    "complete",
    "approval_gated",
    "Room adapter runtime is complete with fake room, Hue dry-run, local boundaries, and approval-gated execution.",
  ),
  operational(
    "system-completion:scheduled-assistance-runtime",
    "Scheduled Assistance Runtime",
    "phase-17",
    "complete",
    "safety_gated",
    "Scheduled assistance is complete as foreground, killable, suggestion-only, and non-authoritative.",
  ),
  operational(
    "system-completion:approval-gated-execution-layer",
    "Approval-Gated Execution Layer",
    "phase-18",
    "complete",
    "approval_gated",
    "Approval runtime is complete as the governed authority boundary for side-effect-capable execution.",
  ),
  operational(
    "system-completion:architecture-graph",
    "Architecture Graph",
    "phase-19",
    "complete_with_notes",
    "read_only_or_inert",
    "Architecture graph is complete as Phase 19 read-only visibility; graph-driven execution remains disabled.",
  ),
  operational(
    "system-completion:telemetry-cockpit",
    "Telemetry Cockpit",
    "phase-19",
    "complete_with_notes",
    "read_only_or_inert",
    "Telemetry cockpit is complete as redacted metadata visibility with no live telemetry mutation.",
  ),
  operational(
    "system-completion:governance-boundary-visualizer",
    "Governance Boundary Visualizer",
    "phase-19",
    "complete_with_notes",
    "read_only_or_inert",
    "Governance visualizer is complete as explanatory metadata and cannot edit policy or approval state.",
  ),
  operational(
    "system-completion:cai-governed-red-team-layer",
    "CAI-Governed Red-Team Layer",
    "phase-19",
    "complete_with_notes",
    "sandboxed_governed",
    "Red-team layer is complete as governed, sandboxed, whitelist-bound readiness; CAI execution remains disabled.",
  ),
  hardening(
    "system-completion:safety-regression",
    "Safety Regression",
    [
      "phase-20f:authority-surface-regression-audit",
      "phase-20f:governance-integrity-audit",
    ],
    "Safety regression is complete through final authority-surface and governance integrity checks.",
  ),
  hardening(
    "system-completion:disabled-capability-audit",
    "Disabled Capability Audit",
    ["phase-20e:disabled-feature-audit", "phase-20a:disabled-feature-matrix"],
    "Disabled capability audit is complete and preserves wake, capture, dashboard, approval, scheduler, CAI, and device-control disabled posture.",
  ),
  hardening(
    "system-completion:recovery-audit",
    "Recovery Audit",
    ["phase-20f:recovery-fallback-audit"],
    "Recovery audit is complete and proves fallback/remediation remains manual, metadata-only, and non-executing.",
  ),
  hardening(
    "system-completion:authority-regression-audit",
    "Authority Regression Audit",
    ["phase-20f:authority-surface-regression-audit"],
    "Authority regression audit is complete and proves no new dispatch, approval bypass, authority creation, network expansion, or source exposure.",
  ),
  hardening(
    "system-completion:governance-integrity-audit",
    "Governance Integrity Audit",
    ["phase-20f:governance-integrity-audit"],
    "Governance integrity audit is complete and verifies Phase 1-20 local-first, approval-gated, replay-safe, redaction-aware invariants.",
  ),
  hardening(
    "system-completion:demo-portfolio-readiness-audit",
    "Demo Portfolio Readiness Audit",
    ["phase-20f:demo-portfolio-readiness-audit"],
    "Demo portfolio readiness audit is complete and proves portfolio/demo narrative is safe, coherent, and non-executing.",
  ),
  disabled(
    "system-completion:disabled-wake-word",
    "Wake word",
    ["disabled-feature:wake-word"],
    "Wake-word activation is intentionally disabled until future architecture and governance updates.",
  ),
  disabled(
    "system-completion:disabled-always-listening",
    "Always listening",
    ["disabled-feature:always-listening"],
    "Always-listening audio is intentionally disabled to preserve explicit capture and consent boundaries.",
  ),
  disabled(
    "system-completion:disabled-background-camera",
    "Background camera",
    ["disabled-feature:background-camera", "disabled-feature:hidden-capture"],
    "Background or hidden camera capture is intentionally disabled.",
  ),
  disabled(
    "system-completion:disabled-graph-driven-execution",
    "Graph-driven execution",
    ["disabled-feature:graph-driven-execution"],
    "Graph surfaces are intentionally inert and cannot route or dispatch execution.",
  ),
  disabled(
    "system-completion:disabled-viewer-driven-execution",
    "Viewer-driven execution",
    ["disabled-feature:ui-run-retry-mutate-affordances"],
    "Viewer surfaces intentionally omit execute, retry, approve, mutate, dispatch, or tool-call controls.",
  ),
  disabled(
    "system-completion:disabled-autonomous-device-execution",
    "Autonomous device execution",
    [
      "disabled-feature:autonomous-device-execution",
      "disabled-feature:unapproved-room-device-actions",
    ],
    "Autonomous real-world device execution is intentionally disabled and remains approval-gated.",
  ),
  disabled(
    "system-completion:disabled-autonomous-routines",
    "Autonomous routines",
    [
      "disabled-feature:scheduler-side-effects",
      "disabled-feature:routine-chaining",
    ],
    "Autonomous routines and chained scheduled side effects are intentionally disabled.",
  ),
  disabled(
    "system-completion:disabled-public-dashboards",
    "Public dashboards",
    ["disabled-feature:public-remote-dashboards"],
    "Public and remote dashboards are intentionally disabled; visibility remains local/read-only.",
  ),
  disabled(
    "system-completion:disabled-voice-only-approval",
    "Voice-only approval",
    ["disabled-feature:voice-only-approval"],
    "Voice-only approval is intentionally disabled; approval remains governed outside the voice channel.",
  ),
  disabled(
    "system-completion:disabled-auto-approval",
    "Auto approval",
    ["disabled-feature:auto-approval"],
    "Auto approval is intentionally disabled; approvals remain explicit, bounded, and reviewable.",
  ),
  disabled(
    "system-completion:disabled-cai-execution",
    "CAI execution",
    ["disabled-feature:cai-non-whitelisted-targets"],
    "CAI execution is intentionally not shipped; red-team posture remains sandboxed and readiness-only.",
  ),
  disabled(
    "system-completion:disabled-cai-installation",
    "CAI installation",
    ["phase-20f:governance-integrity-audit"],
    "CAI installation or sidecar enablement is intentionally outside core completion and requires future governance.",
  ),
  disabled(
    "system-completion:disabled-external-red-team-targets",
    "External red-team targets",
    ["disabled-feature:cai-non-whitelisted-targets"],
    "External/non-whitelisted red-team targets are intentionally disabled.",
  ),
  expansion(
    "system-completion:expansion-obsidian-integration",
    "Obsidian integration",
    ["recruiter-narrative:future-obsidian"],
    "Obsidian integration is expansion-era roadmap metadata, not shipped core capability.",
  ),
  expansion(
    "system-completion:expansion-graphify-overlay",
    "Graphify overlay",
    ["recruiter-narrative:future-graphify"],
    "Graphify overlay is expansion-era roadmap metadata, not shipped core capability.",
  ),
  expansion(
    "system-completion:expansion-llm-council",
    "LLM Council",
    ["recruiter-narrative:future-llm-council"],
    "LLM Council is expansion-era roadmap metadata, not shipped core capability.",
  ),
  expansion(
    "system-completion:expansion-hitnexus-integration",
    "HITNEXUS integration",
    ["recruiter-narrative:future-gitnexus"],
    "HITNEXUS/GitNexus integration is expansion-era roadmap metadata, not shipped core capability.",
  ),
  expansion(
    "system-completion:expansion-llm-wiki",
    "LLM Wiki",
    ["phase-20d:future-expansion-posture"],
    "LLM Wiki is future research/product expansion, not part of core JARVIS OS completion.",
  ),
  expansion(
    "system-completion:expansion-security-knowledge-systems",
    "Security knowledge systems",
    ["recruiter-narrative:future-security-project-integration"],
    "Security knowledge systems are expansion-era integrations, not shipped core capability.",
  ),
  expansion(
    "system-completion:expansion-future-research-systems",
    "Future research systems",
    ["phase-20d:future-expansion-posture"],
    "Future research systems remain future roadmap metadata outside core JARVIS OS completion.",
  ),
] as const;

function buildArea(focus: SystemCompletionFocus): SystemCompletionArea {
  return SystemCompletionAreaSchema.parse({
    ...focus,
    posture: POSTURE,
  });
}

function countBy<T extends string>(values: readonly T[], value: T): number {
  return values.filter((entry) => entry === value).length;
}

export function buildSystemCompletionAuditReport(): SystemCompletionAuditReport {
  const finalReadiness = buildFinalReadinessSummary();
  const disabledFeatureSummary = summarizeDisabledFeaturePosture();
  const phase20bCloseout = buildPhase20BCloseoutReport();
  const phase20cCloseout = buildPhase20CCloseoutReport();
  const phase20dCloseout = buildPhase20DCloseoutReport();
  const portfolioReport = summarizePortfolioReport();
  const disabledFeatureAudit = buildDisabledFeatureAuditReport();
  const authoritySurfaceAudit = buildAuthoritySurfaceAuditReport();
  const recoveryAudit = buildRecoveryFallbackAuditReport();
  const authorityRegression = buildAuthoritySurfaceRegressionAuditReport();
  const governanceIntegrity = buildGovernanceIntegrityAuditReport();
  const demoPortfolio = buildDemoPortfolioReadinessAuditReport();
  const systemAreas = FOCUS.map(buildArea);
  const groups = systemAreas.map((area) => area.group);
  const completionStatuses = systemAreas.map((area) => area.completion_status);
  const deploymentStatuses = systemAreas.map((area) => area.deployment_status);

  for (const phaseId of finalReadiness.represented_phase_ids) {
    if (!getFinalSystemPhaseStatus(phaseId)) {
      throw new Error(`Missing final system status for ${phaseId}`);
    }
  }

  return SystemCompletionAuditReportSchema.parse({
    report_version: SYSTEM_COMPLETION_AUDIT_VERSION,
    report_id: "phase-20f9-system-completion-audit",
    phase: "20F.9",
    verdict: "pass_with_notes",
    answers: {
      what_is_implemented:
        "Core JARVIS OS operationalization systems through Room OS, persistence, Command Center, model/voice/vision runtimes, room adapters, scheduled assistance, approval-gated execution, and Phase 19 fortress visibility are represented as complete metadata.",
      what_is_complete:
        "The core OS plus Phase 20A-20F readiness, audit, portfolio, governance, recovery, and regression layers are complete for the roadmap-defined local-first JARVIS OS.",
      what_is_intentionally_disabled:
        "Wake word, always-listening, background capture, graph/viewer execution, autonomous device/routine behavior, public dashboards, voice-only approval, auto-approval, CAI execution/installation, and external red-team targets are disabled by design.",
      what_is_future_expansion:
        "Obsidian, Graphify, LLM Council, HITNEXUS/GitNexus, LLM Wiki, security knowledge systems, and future research systems remain expansion-era roadmap metadata.",
      is_core_jarvis_os_complete: true,
    },
    system_areas: systemAreas,
    blocking_areas: systemAreas.filter((area) => area.blocking),
    summary: {
      report_version: SYSTEM_COMPLETION_AUDIT_VERSION,
      system_area_count: systemAreas.length,
      operationalization_system_count: countBy(
        groups,
        "operationalization_system",
      ),
      hardening_system_count: countBy(groups, "hardening_system"),
      disabled_by_design_count: countBy(groups, "disabled_by_design"),
      expansion_era_count: countBy(groups, "expansion_era"),
      complete_count: countBy(completionStatuses, "complete"),
      complete_with_notes_count: countBy(
        completionStatuses,
        "complete_with_notes",
      ),
      disabled_by_design_status_count: countBy(
        completionStatuses,
        "disabled_by_design",
      ),
      future_expansion_status_count: countBy(
        completionStatuses,
        "future_expansion",
      ),
      shipped_operational_count: countBy(
        deploymentStatuses,
        "shipped_operational",
      ),
      metadata_ready_count: countBy(deploymentStatuses, "metadata_ready"),
      deferred_disabled_count: countBy(deploymentStatuses, "deferred_disabled"),
      future_not_shipped_count: countBy(
        deploymentStatuses,
        "future_not_shipped",
      ),
      blocking_count: systemAreas.filter((area) => area.blocking).length,
      represented_core_phase_count: finalReadiness.phase_count,
      final_status_blocked_or_missing_count:
        finalReadiness.blocked_or_missing_count,
      disabled_feature_count: disabledFeatureSummary.feature_count,
      portfolio_report_section_count: portfolioReport.section_count,
      phase20b_complete: phase20bCloseout.phase_20b_complete,
      phase20c_complete: phase20cCloseout.phase_20c_complete,
      phase20d_complete: phase20dCloseout.phase_20d_complete,
      disabled_feature_audit_blocking_count:
        disabledFeatureAudit.summary.blocking_count,
      authority_surface_audit_blocking_count:
        authoritySurfaceAudit.summary.blocking_count,
      recovery_auto_recovery_count:
        recoveryAudit.summary.unsafe_auto_recovery_count,
      authority_regression_count: authorityRegression.summary.regression_count,
      governance_integrity_pass:
        governanceIntegrity.summary.governance_integrity_pass,
      demo_portfolio_blocking_count: demoPortfolio.summary.blocking_area_count,
      core_jarvis_os_complete: true,
      phase20f_system_completion_audit_only: true,
      phase20f_capability_neutral: true,
      posture: POSTURE,
    },
    final_completion_statement:
      "Core JARVIS OS is complete as defined by the Phase 1-20 Operationalization Roadmap: completed systems are represented, governed surfaces remain bounded, disabled capabilities remain intentionally inactive, and expansion-era work is clearly future-only.",
    posture: POSTURE,
  });
}
