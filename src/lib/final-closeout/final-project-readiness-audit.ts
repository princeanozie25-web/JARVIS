import { z } from "zod";

import {
  PHASE_20F_REQUIRED_AUDIT_IDS,
  SYSTEM_COMPLETION_AREA_IDS,
} from "../final-hardening";
import {
  ONBOARDING_RUNBOOK_AREA_IDS,
  PACKAGING_READINESS_AREA_IDS,
  PHASE_20G_AUDIT_IDS,
  PHASE_20G_DOCUMENTATION_AREA_IDS,
} from "../final-documentation";
import { summarizeDisabledFeaturePosture } from "../final-system-status";
import { summarizeDemoSurfaces } from "../portfolio-readiness";

export const FINAL_PROJECT_READINESS_AUDIT_VERSION = "20H.1" as const;

export const FINAL_PROJECT_READINESS_VERDICTS = [
  "pass_with_notes",
  "blocked",
] as const;

export const FINAL_PROJECT_COMPLETION_STATUSES = [
  "complete",
  "complete_with_notes",
  "blocked",
] as const;

export const FINAL_PROJECT_GOVERNANCE_STATUSES = [
  "governed",
  "governed_with_notes",
  "not_applicable",
] as const;

export const FINAL_PROJECT_BLOCKING_CLASSIFICATIONS = [
  "blocking_if_missing",
  "non_blocking_note",
] as const;

export const FINAL_PROJECT_READINESS_AREA_IDS = [
  "final-project-readiness:core-jarvis-os-roadmap-complete",
  "final-project-readiness:final-hardening-complete",
  "final-project-readiness:final-documentation-complete",
  "final-project-readiness:operationalization-systems-complete",
  "final-project-readiness:fortress-surfaces-complete",
  "final-project-readiness:visible-demo-surfaces-read-only",
  "final-project-readiness:governance-safety-boundaries-intact",
  "final-project-readiness:disabled-capabilities-remain-disabled",
  "final-project-readiness:cai-governed-non-executing",
  "final-project-readiness:expansion-era-future-only",
  "final-project-readiness:packaging-docs-ready",
  "final-project-readiness:no-premature-final-project-completion-claim",
  "final-project-readiness:no-source-material-exposure",
  "final-project-readiness:no-capability-expansion",
] as const;

export type FinalProjectReadinessVerdict =
  (typeof FINAL_PROJECT_READINESS_VERDICTS)[number];
export type FinalProjectCompletionStatus =
  (typeof FINAL_PROJECT_COMPLETION_STATUSES)[number];
export type FinalProjectGovernanceStatus =
  (typeof FINAL_PROJECT_GOVERNANCE_STATUSES)[number];
export type FinalProjectBlockingClassification =
  (typeof FINAL_PROJECT_BLOCKING_CLASSIFICATIONS)[number];
export type FinalProjectReadinessAreaId =
  (typeof FINAL_PROJECT_READINESS_AREA_IDS)[number];

export const FinalProjectReadinessVerdictSchema = z.enum(
  FINAL_PROJECT_READINESS_VERDICTS,
);
export const FinalProjectCompletionStatusSchema = z.enum(
  FINAL_PROJECT_COMPLETION_STATUSES,
);
export const FinalProjectGovernanceStatusSchema = z.enum(
  FINAL_PROJECT_GOVERNANCE_STATUSES,
);
export const FinalProjectBlockingClassificationSchema = z.enum(
  FINAL_PROJECT_BLOCKING_CLASSIFICATIONS,
);
export const FinalProjectReadinessAreaIdSchema = z.enum(
  FINAL_PROJECT_READINESS_AREA_IDS,
);

export const FinalProjectCloseoutPostureSchema = z.strictObject({
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  packaging_execution_enabled: z.literal(false),
  runtime_execution_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  database_inspection_enabled: z.literal(false),
  ui_route_created: z.literal(false),
  authority_creation_enabled: z.literal(false),
  approval_creation_enabled: z.literal(false),
  capability_expansion_enabled: z.literal(false),
  source_material_exposure_enabled: z.literal(false),
  final_project_closeout_claimed: z.literal(false),
});

export const FinalProjectReadinessAreaSchema = z.strictObject({
  readiness_area_id: FinalProjectReadinessAreaIdSchema,
  title: z.string().trim().min(1).max(180),
  completion_status: FinalProjectCompletionStatusSchema,
  governance_status: FinalProjectGovernanceStatusSchema,
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  evidence_summary: z.string().trim().min(1).max(860),
  blocking_classification: FinalProjectBlockingClassificationSchema,
  blocking: z.literal(false),
  final_closeout_readiness_verdict: FinalProjectReadinessVerdictSchema,
  posture: FinalProjectCloseoutPostureSchema,
});

export const FinalProjectReadinessAuditSummarySchema = z.strictObject({
  report_version: z.literal(FINAL_PROJECT_READINESS_AUDIT_VERSION),
  readiness_area_count: z.number().int().positive(),
  complete_count: z.number().int().nonnegative(),
  complete_with_notes_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  blocking_area_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  final_hardening_complete: z.literal(true),
  final_hardening_audit_count: z.number().int().positive(),
  final_documentation_complete: z.literal(true),
  final_documentation_audit_count: z.number().int().positive(),
  core_jarvis_os_complete: z.literal(true),
  operationalization_system_count: z.number().int().positive(),
  system_area_count: z.number().int().positive(),
  documentation_area_count: z.number().int().positive(),
  combined_documentation_readiness_area_count: z.number().int().positive(),
  demo_surface_count: z.number().int().positive(),
  demo_safe_surface_count: z.number().int().nonnegative(),
  disabled_feature_count: z.number().int().positive(),
  expansion_era_count: z.number().int().nonnegative(),
  cai_governed_non_executing: z.literal(true),
  disabled_capability_continuity: z.literal(true),
  expansion_era_future_only: z.literal(true),
  source_material_exposure_count: z.literal(0),
  premature_final_project_completion_claim_count: z.literal(0),
  capability_expansion_count: z.literal(0),
  packaging_execution_count: z.literal(0),
  runtime_execution_count: z.literal(0),
  provider_call_count: z.literal(0),
  network_call_count: z.literal(0),
  authority_creation_count: z.literal(0),
  approval_creation_count: z.literal(0),
  final_project_readiness_audit_only: z.literal(true),
  phase20h_capability_neutral: z.literal(true),
  posture: FinalProjectCloseoutPostureSchema,
});

export const FinalProjectReadinessAuditReportSchema = z.strictObject({
  report_version: z.literal(FINAL_PROJECT_READINESS_AUDIT_VERSION),
  report_id: z.literal("phase-20h1-final-project-readiness-audit"),
  phase: z.literal("20H.1"),
  verdict: FinalProjectReadinessVerdictSchema,
  readiness_areas: z.array(FinalProjectReadinessAreaSchema),
  blocking_areas: z.array(FinalProjectReadinessAreaSchema),
  notes: z.array(FinalProjectReadinessAreaSchema),
  summary: FinalProjectReadinessAuditSummarySchema,
  final_closeout_readiness_statement: z.string().trim().min(1).max(860),
  posture: FinalProjectCloseoutPostureSchema,
});

export type FinalProjectCloseoutPosture = z.infer<
  typeof FinalProjectCloseoutPostureSchema
>;
export type FinalProjectReadinessArea = z.infer<
  typeof FinalProjectReadinessAreaSchema
>;
export type FinalProjectReadinessAuditSummary = z.infer<
  typeof FinalProjectReadinessAuditSummarySchema
>;
export type FinalProjectReadinessAuditReport = z.infer<
  typeof FinalProjectReadinessAuditReportSchema
>;

type ReadinessAreaFocus = {
  readiness_area_id: FinalProjectReadinessAreaId;
  title: string;
  completion_status: FinalProjectCompletionStatus;
  governance_status: FinalProjectGovernanceStatus;
  evidence_ids: readonly string[];
  evidence_summary: string;
  blocking_classification: FinalProjectBlockingClassification;
};

const POSTURE: FinalProjectCloseoutPosture = {
  metadata_only: true,
  read_only: true,
  deterministic: true,
  packaging_execution_enabled: false,
  runtime_execution_enabled: false,
  provider_call_enabled: false,
  network_call_enabled: false,
  filesystem_inspection_enabled: false,
  database_inspection_enabled: false,
  ui_route_created: false,
  authority_creation_enabled: false,
  approval_creation_enabled: false,
  capability_expansion_enabled: false,
  source_material_exposure_enabled: false,
  final_project_closeout_claimed: false,
};

const AREAS: readonly ReadinessAreaFocus[] = [
  {
    readiness_area_id:
      "final-project-readiness:core-jarvis-os-roadmap-complete",
    title: "Core JARVIS OS roadmap-complete",
    completion_status: "complete",
    governance_status: "governed",
    evidence_ids: [
      "phase-20f:system-completion-audit",
      "phase-20f-closeout:core-system-completion-affirmed",
    ],
    evidence_summary:
      "Phase 20F system completion affirms the roadmap-defined core JARVIS OS while preserving final closeout review as a separate step.",
    blocking_classification: "blocking_if_missing",
  },
  {
    readiness_area_id: "final-project-readiness:final-hardening-complete",
    title: "Final hardening complete",
    completion_status: "complete",
    governance_status: "governed",
    evidence_ids: [
      "phase-20f10-final-hardening-closeout",
      "phase-20f-closeout:final-hardening-status-complete",
    ],
    evidence_summary:
      "Phase 20F closeout aggregates contract, validation, safety regression, disabled capability, recovery, authority, governance, demo/portfolio, and system completion evidence with no blockers.",
    blocking_classification: "blocking_if_missing",
  },
  {
    readiness_area_id: "final-project-readiness:final-documentation-complete",
    title: "Final documentation complete",
    completion_status: "complete",
    governance_status: "governed_with_notes",
    evidence_ids: [
      "phase-20g3-final-documentation-closeout",
      "phase-20g-closeout:no-premature-final-project-complete-claim",
    ],
    evidence_summary:
      "Phase 20G closeout aggregates packaging readiness and onboarding runbook readiness into documentation ready for final review, with final project completion still unclaimed.",
    blocking_classification: "blocking_if_missing",
  },
  {
    readiness_area_id:
      "final-project-readiness:operationalization-systems-complete",
    title: "Operationalization systems complete",
    completion_status: "complete",
    governance_status: "governed",
    evidence_ids: [
      "phase-20f:system-completion-audit",
      "phase-20a:final-system-status-registry",
    ],
    evidence_summary:
      "Room OS, persistence, Command Center, model, voice, vision, room runtime, scheduler, approval runtime, graph, telemetry, governance visualizer, and CAI-governed red-team layers are represented as completed core systems.",
    blocking_classification: "blocking_if_missing",
  },
  {
    readiness_area_id: "final-project-readiness:fortress-surfaces-complete",
    title: "Fortress surfaces complete",
    completion_status: "complete_with_notes",
    governance_status: "governed",
    evidence_ids: [
      "phase-20f:authority-surface-regression-audit",
      "phase-20f:governance-integrity-audit",
      "phase-19:fortress-layer",
    ],
    evidence_summary:
      "Fortress-era governance, telemetry, architecture, red-team, disabled-feature, and authority boundaries remain represented and bounded; any expansion remains future-only.",
    blocking_classification: "non_blocking_note",
  },
  {
    readiness_area_id:
      "final-project-readiness:visible-demo-surfaces-read-only",
    title: "Visible demo surfaces are read-only",
    completion_status: "complete_with_notes",
    governance_status: "governed_with_notes",
    evidence_ids: [
      "phase-20d3-demo-surface-registry",
      "phase-20f:demo-portfolio-readiness-audit",
      "phase-20g-closeout:demo-route-guidance-documented",
    ],
    evidence_summary:
      "Portfolio/demo surfaces are represented as existing routes, modules, CLI reports, or metadata references; viewer posture remains read-only, gated, sandboxed, or deferred.",
    blocking_classification: "non_blocking_note",
  },
  {
    readiness_area_id:
      "final-project-readiness:governance-safety-boundaries-intact",
    title: "Governance and safety boundaries intact",
    completion_status: "complete",
    governance_status: "governed",
    evidence_ids: [
      "phase-20f:governance-integrity-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Local-first, approval-gated, replay-safe, redaction-aware, metadata-only, no-bypass, no-viewer-execution, and no-authority-creation invariants remain intact.",
    blocking_classification: "blocking_if_missing",
  },
  {
    readiness_area_id:
      "final-project-readiness:disabled-capabilities-remain-disabled",
    title: "Disabled capabilities remain disabled",
    completion_status: "complete",
    governance_status: "governed",
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "phase-20f-closeout:disabled-capability-continuity",
    ],
    evidence_summary:
      "Wake word, always-listening, background camera, autonomous execution, auto approval, public dashboards, graph execution, CAI execution, and related risky paths remain disabled or deferred.",
    blocking_classification: "blocking_if_missing",
  },
  {
    readiness_area_id: "final-project-readiness:cai-governed-non-executing",
    title: "CAI governed and non-executing",
    completion_status: "complete_with_notes",
    governance_status: "governed",
    evidence_ids: [
      "phase-20g-closeout:cai-governed-non-executing-documented",
      "phase-20f:authority-surface-regression-audit",
      "phase-20f:demo-portfolio-readiness-audit",
    ],
    evidence_summary:
      "CAI is represented as governed, sandboxed, whitelisted, and portfolio-ready for explanation, while execution and installation remain disabled.",
    blocking_classification: "non_blocking_note",
  },
  {
    readiness_area_id: "final-project-readiness:expansion-era-future-only",
    title: "Expansion-era work remains future-only",
    completion_status: "complete_with_notes",
    governance_status: "governed_with_notes",
    evidence_ids: [
      "phase-20f:system-completion-audit",
      "phase-20g-closeout:future-expansion-documented",
    ],
    evidence_summary:
      "GitNexus/HITNEXUS, Graphify, LLM Council, Obsidian, LLM Wiki, security knowledge systems, and future research systems remain future-only and outside shipped capability.",
    blocking_classification: "non_blocking_note",
  },
  {
    readiness_area_id: "final-project-readiness:packaging-docs-ready",
    title: "Packaging and docs ready for closeout review",
    completion_status: "complete_with_notes",
    governance_status: "governed_with_notes",
    evidence_ids: [
      "phase-20g:packaging-readiness-audit",
      "phase-20g:onboarding-runbook-audit",
    ],
    evidence_summary:
      "Packaging, bootstrap, doctor, onboarding, runbook, move-in, demo, validation, and handoff guidance is ready for final closeout review without executing packaging.",
    blocking_classification: "non_blocking_note",
  },
  {
    readiness_area_id:
      "final-project-readiness:no-premature-final-project-completion-claim",
    title: "No premature final project completion claim",
    completion_status: "complete_with_notes",
    governance_status: "governed",
    evidence_ids: [
      "phase-20g-closeout:no-premature-final-project-complete-claim",
      "phase-20h1-final-project-readiness-audit",
    ],
    evidence_summary:
      "This audit declares readiness for final roadmap closeout review, not final project completion; the final project closeout remains a later Phase 20H step.",
    blocking_classification: "non_blocking_note",
  },
  {
    readiness_area_id: "final-project-readiness:no-source-material-exposure",
    title: "No raw/private/source material exposure",
    completion_status: "complete",
    governance_status: "governed",
    evidence_ids: [
      "phase-20f-closeout:no-source-material-exposure",
      "phase-20g-closeout:no-source-material-exposure",
    ],
    evidence_summary:
      "Final hardening and documentation closeouts both preserve zero raw/private/source-material exposure.",
    blocking_classification: "blocking_if_missing",
  },
  {
    readiness_area_id: "final-project-readiness:no-capability-expansion",
    title: "No capability expansion",
    completion_status: "complete",
    governance_status: "governed",
    evidence_ids: [
      "phase-20f-closeout:no-new-capability-surfaces",
      "phase-20g-closeout:no-premature-final-project-complete-claim",
    ],
    evidence_summary:
      "Phase 20H.1 composes existing closeout metadata only and introduces no packaging execution, runtime behavior, provider calls, UI routes, authority, approvals, or new capability surfaces.",
    blocking_classification: "blocking_if_missing",
  },
] as const;

function buildArea(focus: ReadinessAreaFocus): FinalProjectReadinessArea {
  return FinalProjectReadinessAreaSchema.parse({
    readiness_area_id: focus.readiness_area_id,
    title: focus.title,
    completion_status: focus.completion_status,
    governance_status: focus.governance_status,
    evidence_ids: [...focus.evidence_ids],
    evidence_summary: focus.evidence_summary,
    blocking_classification: focus.blocking_classification,
    blocking: false,
    final_closeout_readiness_verdict: "pass_with_notes",
    posture: POSTURE,
  });
}

function countStatus(
  areas: readonly FinalProjectReadinessArea[],
  status: FinalProjectCompletionStatus,
): number {
  return areas.filter((area) => area.completion_status === status).length;
}

export function buildFinalProjectReadinessAuditReport(): FinalProjectReadinessAuditReport {
  const demoSurfaceSummary = summarizeDemoSurfaces();
  const disabledFeatureSummary = summarizeDisabledFeaturePosture();
  const readinessAreas = AREAS.map(buildArea);
  const blockingAreas = readinessAreas.filter((area) => area.blocking);
  const notes = readinessAreas.filter(
    (area) => area.completion_status === "complete_with_notes",
  );

  return FinalProjectReadinessAuditReportSchema.parse({
    report_version: FINAL_PROJECT_READINESS_AUDIT_VERSION,
    report_id: "phase-20h1-final-project-readiness-audit",
    phase: "20H.1",
    verdict: "pass_with_notes",
    readiness_areas: readinessAreas,
    blocking_areas: blockingAreas,
    notes,
    summary: {
      report_version: FINAL_PROJECT_READINESS_AUDIT_VERSION,
      readiness_area_count: readinessAreas.length,
      complete_count: countStatus(readinessAreas, "complete"),
      complete_with_notes_count: countStatus(
        readinessAreas,
        "complete_with_notes",
      ),
      blocked_count: countStatus(readinessAreas, "blocked"),
      blocking_area_count: blockingAreas.length,
      non_blocking_note_count: notes.length,
      final_hardening_complete: true,
      final_hardening_audit_count: PHASE_20F_REQUIRED_AUDIT_IDS.length,
      final_documentation_complete: true,
      final_documentation_audit_count: PHASE_20G_AUDIT_IDS.length,
      core_jarvis_os_complete: true,
      operationalization_system_count: 13,
      system_area_count: SYSTEM_COMPLETION_AREA_IDS.length,
      documentation_area_count: PHASE_20G_DOCUMENTATION_AREA_IDS.length,
      combined_documentation_readiness_area_count:
        PACKAGING_READINESS_AREA_IDS.length +
        ONBOARDING_RUNBOOK_AREA_IDS.length,
      demo_surface_count: demoSurfaceSummary.surface_count,
      demo_safe_surface_count: demoSurfaceSummary.demo_safe_count,
      disabled_feature_count: disabledFeatureSummary.feature_count,
      expansion_era_count: 7,
      cai_governed_non_executing: true,
      disabled_capability_continuity: true,
      expansion_era_future_only: true,
      source_material_exposure_count: 0,
      premature_final_project_completion_claim_count: 0,
      capability_expansion_count: 0,
      packaging_execution_count: 0,
      runtime_execution_count: 0,
      provider_call_count: 0,
      network_call_count: 0,
      authority_creation_count: 0,
      approval_creation_count: 0,
      final_project_readiness_audit_only: true,
      phase20h_capability_neutral: true,
      posture: POSTURE,
    },
    final_closeout_readiness_statement:
      "Phase 20H.1 passes with notes: JARVIS is ready for final roadmap closeout review based on completed Phase 20F hardening, completed Phase 20G documentation, core operationalization completion, bounded fortress/demo surfaces, disabled capability continuity, CAI governed-but-non-executing posture, and future-only expansion boundaries. This audit does not claim final project closeout.",
    posture: POSTURE,
  });
}
