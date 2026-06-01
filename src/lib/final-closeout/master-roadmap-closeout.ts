import { z } from "zod";

import {
  DEMO_PORTFOLIO_READINESS_AREA_IDS,
  PHASE_20F_REQUIRED_AUDIT_IDS,
  SYSTEM_COMPLETION_AREA_IDS,
} from "../final-hardening";
import { PHASE_20G_AUDIT_IDS } from "../final-documentation";
import {
  FINAL_PROJECT_READINESS_AREA_IDS,
  FinalProjectCloseoutPostureSchema,
  buildFinalProjectReadinessAuditReport,
  type FinalProjectCloseoutPosture,
} from "./final-project-readiness-audit";

export const MASTER_ROADMAP_CLOSEOUT_VERSION = "20H.2" as const;

export const MASTER_ROADMAP_CLOSEOUT_VERDICTS = [
  "pass_with_notes",
  "blocked",
] as const;

export const FINAL_DECLARATION_READINESS_STATUSES = [
  "ready_for_final_declaration",
  "blocked",
] as const;

export const MASTER_ROADMAP_SOURCE_AUDIT_IDS = [
  "master-roadmap:phase-20h1-final-project-readiness-audit",
  "master-roadmap:phase-20f-final-hardening-closeout",
  "master-roadmap:phase-20g-final-documentation-closeout",
  "master-roadmap:phase-20f-system-completion-audit",
  "master-roadmap:phase-20f-demo-portfolio-readiness-audit",
] as const;

export type MasterRoadmapCloseoutVerdict =
  (typeof MASTER_ROADMAP_CLOSEOUT_VERDICTS)[number];
export type FinalDeclarationReadinessStatus =
  (typeof FINAL_DECLARATION_READINESS_STATUSES)[number];
export type MasterRoadmapSourceAuditId =
  (typeof MASTER_ROADMAP_SOURCE_AUDIT_IDS)[number];

export const MasterRoadmapCloseoutVerdictSchema = z.enum(
  MASTER_ROADMAP_CLOSEOUT_VERDICTS,
);
export const FinalDeclarationReadinessStatusSchema = z.enum(
  FINAL_DECLARATION_READINESS_STATUSES,
);
export const MasterRoadmapSourceAuditIdSchema = z.enum(
  MASTER_ROADMAP_SOURCE_AUDIT_IDS,
);

export const MasterRoadmapSourceAuditSchema = z.strictObject({
  source_audit_id: MasterRoadmapSourceAuditIdSchema,
  title: z.string().trim().min(1).max(180),
  source_phase: z.string().trim().min(1).max(24),
  source_entrypoint: z.string().trim().min(1).max(120),
  verdict: MasterRoadmapCloseoutVerdictSchema,
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  evidence_summary: z.string().trim().min(1).max(760),
  blocking_issue_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  posture: FinalProjectCloseoutPostureSchema,
});

export const MasterRoadmapEvidenceSummarySchema = z.strictObject({
  final_project_readiness: z.string().trim().min(1).max(760),
  final_hardening: z.string().trim().min(1).max(760),
  final_documentation: z.string().trim().min(1).max(760),
  system_completion: z.string().trim().min(1).max(760),
  demo_portfolio_readiness: z.string().trim().min(1).max(760),
  disabled_capability_continuity: z.string().trim().min(1).max(760),
  expansion_era_boundary: z.string().trim().min(1).max(760),
  no_final_declaration_yet: z.string().trim().min(1).max(760),
});

export const MasterRoadmapCloseoutSummarySchema = z.strictObject({
  report_version: z.literal(MASTER_ROADMAP_CLOSEOUT_VERSION),
  source_audit_count: z.number().int().positive(),
  completed_phase_count: z.number().int().positive(),
  represented_core_roadmap_phase_count: z.number().int().positive(),
  core_roadmap_system_count: z.number().int().positive(),
  final_project_readiness_area_count: z.number().int().positive(),
  final_hardening_audit_count: z.number().int().positive(),
  final_documentation_audit_count: z.number().int().positive(),
  system_completion_area_count: z.number().int().positive(),
  demo_portfolio_readiness_area_count: z.number().int().positive(),
  blocking_issue_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  final_project_readiness_pass_with_notes: z.literal(true),
  final_hardening_complete: z.literal(true),
  final_documentation_complete: z.literal(true),
  disabled_capability_continuity: z.literal(true),
  cai_governed_non_executing: z.literal(true),
  expansion_era_future_only: z.literal(true),
  final_declaration_emitted: z.literal(false),
  source_material_exposure_count: z.literal(0),
  capability_expansion_count: z.literal(0),
  packaging_execution_count: z.literal(0),
  runtime_execution_count: z.literal(0),
  provider_call_count: z.literal(0),
  network_call_count: z.literal(0),
  authority_creation_count: z.literal(0),
  approval_creation_count: z.literal(0),
  master_roadmap_closeout_only: z.literal(true),
  phase20h_capability_neutral: z.literal(true),
  posture: FinalProjectCloseoutPostureSchema,
});

export const MasterRoadmapCloseoutReportSchema = z.strictObject({
  roadmap_id: z.literal("jarvis-operationalization-roadmap"),
  closeout_version: z.literal(MASTER_ROADMAP_CLOSEOUT_VERSION),
  report_id: z.literal("phase-20h2-master-roadmap-closeout-report"),
  phase: z.literal("20H.2"),
  aggregated_verdict: MasterRoadmapCloseoutVerdictSchema,
  source_audits: z.array(MasterRoadmapSourceAuditSchema),
  completed_phase_count: z.number().int().positive(),
  blocking_issue_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  evidence_summary: MasterRoadmapEvidenceSummarySchema,
  remaining_notes: z.array(z.string().trim().min(1).max(520)),
  summary: MasterRoadmapCloseoutSummarySchema,
  final_declaration_readiness: FinalDeclarationReadinessStatusSchema,
  final_declaration_readiness_statement: z.string().trim().min(1).max(860),
  posture: FinalProjectCloseoutPostureSchema,
});

export type MasterRoadmapSourceAudit = z.infer<
  typeof MasterRoadmapSourceAuditSchema
>;
export type MasterRoadmapEvidenceSummary = z.infer<
  typeof MasterRoadmapEvidenceSummarySchema
>;
export type MasterRoadmapCloseoutSummary = z.infer<
  typeof MasterRoadmapCloseoutSummarySchema
>;
export type MasterRoadmapCloseoutReport = z.infer<
  typeof MasterRoadmapCloseoutReportSchema
>;

type SourceAuditFocus = {
  source_audit_id: MasterRoadmapSourceAuditId;
  title: string;
  source_phase: string;
  source_entrypoint: string;
  evidence_ids: readonly string[];
  evidence_summary: string;
  non_blocking_note_count: number;
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

const SOURCE_AUDITS: readonly SourceAuditFocus[] = [
  {
    source_audit_id: "master-roadmap:phase-20h1-final-project-readiness-audit",
    title: "Phase 20H.1 final project readiness audit",
    source_phase: "20H.1",
    source_entrypoint: "buildFinalProjectReadinessAuditReport",
    evidence_ids: ["phase-20h1-final-project-readiness-audit"],
    evidence_summary:
      "Final project readiness passes with notes and aggregates hardening, documentation, core system, fortress/demo, disabled-feature, CAI, and expansion-era posture.",
    non_blocking_note_count: 6,
  },
  {
    source_audit_id: "master-roadmap:phase-20f-final-hardening-closeout",
    title: "Phase 20F final hardening closeout",
    source_phase: "20F.10",
    source_entrypoint: "buildPhase20FCloseoutReport",
    evidence_ids: ["phase-20f10-final-hardening-closeout"],
    evidence_summary:
      "Final hardening is complete across hardening contract, validation, safety regression, disabled capability, recovery, authority, governance, demo/portfolio, and system completion closeout evidence.",
    non_blocking_note_count: 3,
  },
  {
    source_audit_id: "master-roadmap:phase-20g-final-documentation-closeout",
    title: "Phase 20G final documentation closeout",
    source_phase: "20G.3",
    source_entrypoint: "buildPhase20GCloseoutReport",
    evidence_ids: ["phase-20g3-final-documentation-closeout"],
    evidence_summary:
      "Final documentation is complete enough for final project closeout review, with packaging guidance, onboarding/runbook guidance, disabled capability clarity, and no final project completion claim.",
    non_blocking_note_count: 7,
  },
  {
    source_audit_id: "master-roadmap:phase-20f-system-completion-audit",
    title: "Phase 20F system completion audit",
    source_phase: "20F.9",
    source_entrypoint: "buildSystemCompletionAuditReport",
    evidence_ids: ["phase-20f:system-completion-audit"],
    evidence_summary:
      "The roadmap-defined core JARVIS OS is complete, intentionally disabled capabilities remain disabled by design, and expansion-era work remains future-only.",
    non_blocking_note_count: 1,
  },
  {
    source_audit_id: "master-roadmap:phase-20f-demo-portfolio-readiness-audit",
    title: "Phase 20F demo and portfolio readiness audit",
    source_phase: "20F.8",
    source_entrypoint: "buildDemoPortfolioReadinessAuditReport",
    evidence_ids: ["phase-20f:demo-portfolio-readiness-audit"],
    evidence_summary:
      "Demo and portfolio posture is read-only, synthetic-safe or redacted where required, clear about disabled capabilities, and safe for recruiter/interviewer review.",
    non_blocking_note_count: 1,
  },
] as const;

const REMAINING_NOTES = [
  "The final project completion declaration is reserved for the next Phase 20H slice.",
  "Expansion-era work remains explicitly future-only and is not part of the shipped core OS.",
  "This master report is metadata-only and does not execute packaging, runtime checks, demos, providers, network calls, approvals, or authority creation.",
] as const;

function buildSourceAudit(focus: SourceAuditFocus): MasterRoadmapSourceAudit {
  return MasterRoadmapSourceAuditSchema.parse({
    source_audit_id: focus.source_audit_id,
    title: focus.title,
    source_phase: focus.source_phase,
    source_entrypoint: focus.source_entrypoint,
    verdict: "pass_with_notes",
    evidence_ids: [...focus.evidence_ids],
    evidence_summary: focus.evidence_summary,
    blocking_issue_count: 0,
    non_blocking_note_count: focus.non_blocking_note_count,
    posture: POSTURE,
  });
}

function sumNotes(sourceAudits: readonly MasterRoadmapSourceAudit[]): number {
  return sourceAudits.reduce(
    (total, audit) => total + audit.non_blocking_note_count,
    0,
  );
}

export function buildMasterRoadmapCloseoutReport(): MasterRoadmapCloseoutReport {
  const finalProjectReadiness = buildFinalProjectReadinessAuditReport();
  const sourceAudits = SOURCE_AUDITS.map(buildSourceAudit);
  const completedPhaseCount = 20;
  const nonBlockingNoteCount = sumNotes(sourceAudits);

  return MasterRoadmapCloseoutReportSchema.parse({
    roadmap_id: "jarvis-operationalization-roadmap",
    closeout_version: MASTER_ROADMAP_CLOSEOUT_VERSION,
    report_id: "phase-20h2-master-roadmap-closeout-report",
    phase: "20H.2",
    aggregated_verdict: "pass_with_notes",
    source_audits: sourceAudits,
    completed_phase_count: completedPhaseCount,
    blocking_issue_count: 0,
    non_blocking_note_count: nonBlockingNoteCount,
    evidence_summary: {
      final_project_readiness:
        "Phase 20H.1 final project readiness is pass_with_notes and ready for final roadmap closeout review.",
      final_hardening:
        "Phase 20F final hardening is complete and represented by all required hardening audits.",
      final_documentation:
        "Phase 20G documentation closeout is complete enough for handoff, packaging guidance, onboarding, and portfolio review.",
      system_completion:
        "System completion evidence represents all core operationalization systems, disabled-by-design capabilities, and future expansion boundaries.",
      demo_portfolio_readiness:
        "Demo and portfolio readiness evidence keeps visible surfaces read-only, synthetic-safe or redacted where required, and free of demo execution.",
      disabled_capability_continuity:
        "Disabled capability continuity remains intact across the final disabled-feature matrix, disabled-feature audit, final hardening, and documentation closeouts.",
      expansion_era_boundary:
        "Expansion-era work remains future-only and is not included in the shipped core roadmap completion claim.",
      no_final_declaration_yet:
        "This master closeout report prepares final declaration readiness but intentionally does not emit the final project completion declaration.",
    },
    remaining_notes: [...REMAINING_NOTES],
    summary: {
      report_version: MASTER_ROADMAP_CLOSEOUT_VERSION,
      source_audit_count: sourceAudits.length,
      completed_phase_count: completedPhaseCount,
      represented_core_roadmap_phase_count: completedPhaseCount,
      core_roadmap_system_count:
        finalProjectReadiness.summary.operationalization_system_count,
      final_project_readiness_area_count:
        FINAL_PROJECT_READINESS_AREA_IDS.length,
      final_hardening_audit_count: PHASE_20F_REQUIRED_AUDIT_IDS.length,
      final_documentation_audit_count: PHASE_20G_AUDIT_IDS.length,
      system_completion_area_count: SYSTEM_COMPLETION_AREA_IDS.length,
      demo_portfolio_readiness_area_count:
        DEMO_PORTFOLIO_READINESS_AREA_IDS.length,
      blocking_issue_count: 0,
      non_blocking_note_count: nonBlockingNoteCount,
      final_project_readiness_pass_with_notes:
        finalProjectReadiness.verdict === "pass_with_notes",
      final_hardening_complete:
        finalProjectReadiness.summary.final_hardening_complete,
      final_documentation_complete:
        finalProjectReadiness.summary.final_documentation_complete,
      disabled_capability_continuity:
        finalProjectReadiness.summary.disabled_capability_continuity,
      cai_governed_non_executing:
        finalProjectReadiness.summary.cai_governed_non_executing,
      expansion_era_future_only:
        finalProjectReadiness.summary.expansion_era_future_only,
      final_declaration_emitted: false,
      source_material_exposure_count: 0,
      capability_expansion_count: 0,
      packaging_execution_count: 0,
      runtime_execution_count: 0,
      provider_call_count: 0,
      network_call_count: 0,
      authority_creation_count: 0,
      approval_creation_count: 0,
      master_roadmap_closeout_only: true,
      phase20h_capability_neutral: true,
      posture: POSTURE,
    },
    final_declaration_readiness: "ready_for_final_declaration",
    final_declaration_readiness_statement:
      "The master roadmap closeout report passes with notes and is ready for the final declaration slice: all core roadmap systems are represented, final hardening and final documentation are complete, Phase 20H.1 readiness is pass_with_notes, no blocking issues remain, disabled capabilities remain disabled, CAI remains governed and non-executing, expansion-era work remains future-only, and no final declaration has been emitted yet.",
    posture: POSTURE,
  });
}
