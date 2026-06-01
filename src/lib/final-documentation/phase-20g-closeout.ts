import { z } from "zod";

import {
  DocumentationPackagingPostureSchema,
  type DocumentationPackagingPosture,
  PACKAGING_READINESS_AREA_IDS,
} from "./packaging-readiness-audit";
import { ONBOARDING_RUNBOOK_AREA_IDS } from "./onboarding-runbook-audit";

export const PHASE_20G_CLOSEOUT_VERSION = "20G.3" as const;

export const PHASE_20G_CLOSEOUT_VERDICTS = [
  "pass_with_notes",
  "blocked",
] as const;

export const PHASE_20G_AUDIT_IDS = [
  "phase-20g:packaging-readiness-audit",
  "phase-20g:onboarding-runbook-audit",
] as const;

export const PHASE_20G_DOCUMENTATION_AREA_IDS = [
  "phase-20g-closeout:project-purpose-documented",
  "phase-20g-closeout:roadmap-completion-status-documented",
  "phase-20g-closeout:core-jarvis-os-status-documented",
  "phase-20g-closeout:setup-bootstrap-guidance-documented",
  "phase-20g-closeout:test-validation-guidance-documented",
  "phase-20g-closeout:demo-route-guidance-documented",
  "phase-20g-closeout:read-only-viewer-guidance-documented",
  "phase-20g-closeout:approval-gated-execution-documented",
  "phase-20g-closeout:cai-governed-non-executing-documented",
  "phase-20g-closeout:disabled-capabilities-documented",
  "phase-20g-closeout:future-expansion-documented",
  "phase-20g-closeout:troubleshooting-documented",
  "phase-20g-closeout:contributor-guidance-documented",
  "phase-20g-closeout:no-source-material-exposure",
  "phase-20g-closeout:no-disabled-capability-marketed-active",
  "phase-20g-closeout:no-expansion-era-capability-marketed-complete",
  "phase-20g-closeout:no-premature-final-project-complete-claim",
] as const;

export const PHASE_20G_READINESS_STATUSES = [
  "ready",
  "ready_with_notes",
  "blocked",
] as const;

export const PHASE_20G_BLOCKING_CLASSIFICATIONS = [
  "blocking_if_missing",
  "non_blocking_note",
] as const;

export type Phase20GCloseoutVerdict =
  (typeof PHASE_20G_CLOSEOUT_VERDICTS)[number];
export type Phase20GAuditId = (typeof PHASE_20G_AUDIT_IDS)[number];
export type Phase20GDocumentationAreaId =
  (typeof PHASE_20G_DOCUMENTATION_AREA_IDS)[number];
export type Phase20GReadinessStatus =
  (typeof PHASE_20G_READINESS_STATUSES)[number];
export type Phase20GBlockingClassification =
  (typeof PHASE_20G_BLOCKING_CLASSIFICATIONS)[number];

export const Phase20GCloseoutVerdictSchema = z.enum(
  PHASE_20G_CLOSEOUT_VERDICTS,
);
export const Phase20GAuditIdSchema = z.enum(PHASE_20G_AUDIT_IDS);
export const Phase20GDocumentationAreaIdSchema = z.enum(
  PHASE_20G_DOCUMENTATION_AREA_IDS,
);
export const Phase20GReadinessStatusSchema = z.enum(
  PHASE_20G_READINESS_STATUSES,
);
export const Phase20GBlockingClassificationSchema = z.enum(
  PHASE_20G_BLOCKING_CLASSIFICATIONS,
);

export const Phase20GAuditAggregationSchema = z.strictObject({
  audit_id: Phase20GAuditIdSchema,
  phase: z.string().trim().min(1).max(24),
  title: z.string().trim().min(1).max(180),
  verdict: Phase20GCloseoutVerdictSchema,
  area_count: z.number().int().positive(),
  blocking_area_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  evidence_summary: z.string().trim().min(1).max(700),
  posture: DocumentationPackagingPostureSchema,
});

export const Phase20GDocumentationAreaSchema = z.strictObject({
  documentation_area_id: Phase20GDocumentationAreaIdSchema,
  title: z.string().trim().min(1).max(180),
  readiness_status: Phase20GReadinessStatusSchema,
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  evidence_summary: z.string().trim().min(1).max(760),
  blocking_classification: Phase20GBlockingClassificationSchema,
  blocking: z.literal(false),
  remaining_notes: z.array(z.string().trim().min(1).max(420)),
  posture: DocumentationPackagingPostureSchema,
});

export const Phase20GCloseoutSummarySchema = z.strictObject({
  report_version: z.literal(PHASE_20G_CLOSEOUT_VERSION),
  aggregated_audit_count: z.number().int().positive(),
  documentation_area_count: z.number().int().positive(),
  ready_count: z.number().int().nonnegative(),
  ready_with_notes_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  blocking_area_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  packaging_readiness_area_count: z.number().int().positive(),
  runbook_area_count: z.number().int().positive(),
  combined_readiness_area_count: z.number().int().positive(),
  disabled_capability_continuity: z.literal(true),
  expansion_era_continuity: z.literal(true),
  source_material_exposure_count: z.literal(0),
  disabled_capability_market_active_count: z.literal(0),
  expansion_era_market_complete_count: z.literal(0),
  premature_final_project_complete_claim_count: z.literal(0),
  packaging_execution_count: z.literal(0),
  install_execution_count: z.literal(0),
  runtime_execution_count: z.literal(0),
  provider_call_count: z.literal(0),
  network_call_count: z.literal(0),
  authority_creation_count: z.literal(0),
  approval_creation_count: z.literal(0),
  capability_expansion_count: z.literal(0),
  phase20g_closeout_only: z.literal(true),
  phase20g_capability_neutral: z.literal(true),
  posture: DocumentationPackagingPostureSchema,
});

export const Phase20GCloseoutReportSchema = z.strictObject({
  report_version: z.literal(PHASE_20G_CLOSEOUT_VERSION),
  report_id: z.literal("phase-20g3-final-documentation-closeout"),
  phase: z.literal("20G.3"),
  verdict: Phase20GCloseoutVerdictSchema,
  audits: z.array(Phase20GAuditAggregationSchema),
  documentation_areas: z.array(Phase20GDocumentationAreaSchema),
  blocking_areas: z.array(Phase20GDocumentationAreaSchema),
  notes: z.array(Phase20GDocumentationAreaSchema),
  summary: Phase20GCloseoutSummarySchema,
  final_documentation_readiness_statement: z.string().trim().min(1).max(760),
  posture: DocumentationPackagingPostureSchema,
});

export type Phase20GAuditAggregation = z.infer<
  typeof Phase20GAuditAggregationSchema
>;
export type Phase20GDocumentationArea = z.infer<
  typeof Phase20GDocumentationAreaSchema
>;
export type Phase20GCloseoutSummary = z.infer<
  typeof Phase20GCloseoutSummarySchema
>;
export type Phase20GCloseoutReport = z.infer<
  typeof Phase20GCloseoutReportSchema
>;

type DocumentationAreaFocus = {
  documentation_area_id: Phase20GDocumentationAreaId;
  title: string;
  readiness_status: Phase20GReadinessStatus;
  evidence_ids: readonly string[];
  evidence_summary: string;
  blocking_classification: Phase20GBlockingClassification;
  remaining_notes: readonly string[];
};

const POSTURE: DocumentationPackagingPosture = {
  metadata_only: true,
  read_only: true,
  deterministic: true,
  packaging_execution_enabled: false,
  install_script_execution_enabled: false,
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

const AREAS: readonly DocumentationAreaFocus[] = [
  {
    documentation_area_id: "phase-20g-closeout:project-purpose-documented",
    title: "Project purpose documented",
    readiness_status: "ready",
    evidence_ids: ["onboarding-runbook:project-purpose"],
    evidence_summary:
      "Runbook metadata documents JARVIS as a governed, local-first AI operating environment.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:roadmap-completion-status-documented",
    title: "Roadmap completion status documented",
    readiness_status: "ready_with_notes",
    evidence_ids: [
      "packaging-readiness:readme-phase-20f-completion",
      "onboarding-runbook:no-premature-final-completion",
    ],
    evidence_summary:
      "Phase 20F completion is documented while final project closeout remains explicitly unclaimed.",
    blocking_classification: "non_blocking_note",
    remaining_notes: ["Final project closeout remains a later phase."],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:core-jarvis-os-status-documented",
    title: "Core JARVIS OS status documented",
    readiness_status: "ready",
    evidence_ids: [
      "packaging-readiness:core-jarvis-os-status",
      "onboarding-runbook:core-jarvis-os-status",
    ],
    evidence_summary:
      "Core JARVIS OS completion is documented through Phase 20F system completion and closeout evidence.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:setup-bootstrap-guidance-documented",
    title: "Setup and bootstrap guidance documented",
    readiness_status: "ready_with_notes",
    evidence_ids: [
      "packaging-readiness:setup-bootstrap-expectations",
      "onboarding-runbook:safe-local-first-setup",
      "onboarding-runbook:install-bootstrap-expectations",
    ],
    evidence_summary:
      "Setup guidance covers local-first setup, bootstrap expectations, and user-run install commands without automation.",
    blocking_classification: "non_blocking_note",
    remaining_notes: ["Final docs can further polish env/config examples."],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:test-validation-guidance-documented",
    title: "Test and validation guidance documented",
    readiness_status: "ready",
    evidence_ids: [
      "packaging-readiness:test-command-documentation",
      "onboarding-runbook:test-validation-commands",
    ],
    evidence_summary:
      "Validation guidance covers targeted tests, full tests, typecheck, lint, and diff hygiene.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id: "phase-20g-closeout:demo-route-guidance-documented",
    title: "Demo route guidance documented",
    readiness_status: "ready_with_notes",
    evidence_ids: [
      "packaging-readiness:visible-demo-routes",
      "onboarding-runbook:demo-routes",
    ],
    evidence_summary:
      "Demo route and entrypoint guidance is represented as existing routes, CLI report paths, modules, and metadata references.",
    blocking_classification: "non_blocking_note",
    remaining_notes: ["Demo guidance remains descriptive and non-executing."],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:read-only-viewer-guidance-documented",
    title: "Read-only viewer guidance documented",
    readiness_status: "ready",
    evidence_ids: ["onboarding-runbook:read-only-viewer-surfaces"],
    evidence_summary:
      "Read-only viewer guidance covers architecture, telemetry, governance, red-team, and related non-mutating surfaces.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:approval-gated-execution-documented",
    title: "Approval-gated execution documented",
    readiness_status: "ready",
    evidence_ids: ["onboarding-runbook:approval-gated-execution"],
    evidence_summary:
      "Approval-gated execution is documented as the mandatory side-effect boundary.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:cai-governed-non-executing-documented",
    title: "CAI governed and non-executing documented",
    readiness_status: "ready_with_notes",
    evidence_ids: [
      "packaging-readiness:cai-governed-not-executing",
      "onboarding-runbook:cai-governed-non-executing",
    ],
    evidence_summary:
      "CAI posture is documented as governed, sandboxed, non-executing, and portfolio-ready for explanation.",
    blocking_classification: "non_blocking_note",
    remaining_notes: ["CAI wording should remain explicitly non-executing."],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:disabled-capabilities-documented",
    title: "Disabled capabilities documented",
    readiness_status: "ready",
    evidence_ids: [
      "packaging-readiness:disabled-capabilities",
      "onboarding-runbook:disabled-capabilities",
    ],
    evidence_summary:
      "Disabled capabilities remain documented as disabled/deferred safety posture, not active feature work.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id: "phase-20g-closeout:future-expansion-documented",
    title: "Future expansion documented",
    readiness_status: "ready",
    evidence_ids: [
      "packaging-readiness:expansion-era-future-only",
      "onboarding-runbook:expansion-era-future-work",
    ],
    evidence_summary:
      "Expansion-era work remains documented as future-only and not shipped capability.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id: "phase-20g-closeout:troubleshooting-documented",
    title: "Troubleshooting documented",
    readiness_status: "ready_with_notes",
    evidence_ids: ["onboarding-runbook:troubleshooting-known-warnings"],
    evidence_summary:
      "Troubleshooting coverage references final hardening failure modes, known warnings, and manual-only recovery guidance.",
    blocking_classification: "non_blocking_note",
    remaining_notes: [
      "Final docs can turn metadata into a concise human runbook.",
    ],
  },
  {
    documentation_area_id: "phase-20g-closeout:contributor-guidance-documented",
    title: "Contributor guidance documented",
    readiness_status: "ready_with_notes",
    evidence_ids: ["onboarding-runbook:contributor-extension-guidance"],
    evidence_summary:
      "Contributor guidance preserves governance-before-capability, local-first, approval-gated, replay-safe, redaction-aware, and metadata-only extension posture.",
    blocking_classification: "non_blocking_note",
    remaining_notes: [
      "Contributor guidance can be expanded during docs polish.",
    ],
  },
  {
    documentation_area_id: "phase-20g-closeout:no-source-material-exposure",
    title: "No source-material exposure",
    readiness_status: "ready",
    evidence_ids: [
      "packaging-readiness:no-source-material-exposure",
      "onboarding-runbook:no-source-material-exposure",
    ],
    evidence_summary:
      "Final documentation readiness preserves zero raw/private/source-material exposure.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:no-disabled-capability-marketed-active",
    title: "No disabled capability marketed as active",
    readiness_status: "ready",
    evidence_ids: [
      "packaging-readiness:no-disabled-capability-marketed-active",
      "onboarding-runbook:disabled-capabilities",
    ],
    evidence_summary:
      "Disabled capabilities remain documented as safety posture and are not marketed as active shipped features.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:no-expansion-era-capability-marketed-complete",
    title: "No expansion-era capability marketed complete",
    readiness_status: "ready",
    evidence_ids: [
      "packaging-readiness:expansion-era-future-only",
      "onboarding-runbook:expansion-era-future-work",
    ],
    evidence_summary:
      "Expansion-era work remains future-only and is not described as complete shipped capability.",
    blocking_classification: "blocking_if_missing",
    remaining_notes: [],
  },
  {
    documentation_area_id:
      "phase-20g-closeout:no-premature-final-project-complete-claim",
    title: "No premature final-project-complete claim",
    readiness_status: "ready_with_notes",
    evidence_ids: [
      "packaging-readiness:no-premature-final-closeout",
      "onboarding-runbook:no-premature-final-completion",
    ],
    evidence_summary:
      "Phase 20G documentation readiness does not claim final project completion before the final closeout.",
    blocking_classification: "non_blocking_note",
    remaining_notes: ["Final project completion language remains reserved."],
  },
] as const;

function buildArea(focus: DocumentationAreaFocus): Phase20GDocumentationArea {
  return Phase20GDocumentationAreaSchema.parse({
    documentation_area_id: focus.documentation_area_id,
    title: focus.title,
    readiness_status: focus.readiness_status,
    evidence_ids: [...focus.evidence_ids],
    evidence_summary: focus.evidence_summary,
    blocking_classification: focus.blocking_classification,
    blocking: false,
    remaining_notes: [...focus.remaining_notes],
    posture: POSTURE,
  });
}

function aggregateAudit(
  auditId: Phase20GAuditId,
  phase: string,
  title: string,
  areaCount: number,
  blockingAreaCount: number,
  nonBlockingNoteCount: number,
  evidenceSummary: string,
): Phase20GAuditAggregation {
  return Phase20GAuditAggregationSchema.parse({
    audit_id: auditId,
    phase,
    title,
    verdict: "pass_with_notes",
    area_count: areaCount,
    blocking_area_count: blockingAreaCount,
    non_blocking_note_count: nonBlockingNoteCount,
    evidence_summary: evidenceSummary,
    posture: POSTURE,
  });
}

function countStatus(
  areas: readonly Phase20GDocumentationArea[],
  status: Phase20GReadinessStatus,
): number {
  return areas.filter((area) => area.readiness_status === status).length;
}

export function buildPhase20GCloseoutReport(): Phase20GCloseoutReport {
  const documentationAreas = AREAS.map(buildArea);
  const blockingAreas = documentationAreas.filter((area) => area.blocking);
  const notes = documentationAreas.filter(
    (area) => area.readiness_status === "ready_with_notes",
  );
  const audits = [
    aggregateAudit(
      "phase-20g:packaging-readiness-audit",
      "20G.1",
      "Packaging Readiness Audit",
      PACKAGING_READINESS_AREA_IDS.length,
      0,
      5,
      "Packaging, documentation, onboarding, handoff, disabled capability, expansion, CAI, setup/test, packaging, move-in, and source-material posture are ready with notes.",
    ),
    aggregateAudit(
      "phase-20g:onboarding-runbook-audit",
      "20G.2",
      "Onboarding Runbook Audit",
      ONBOARDING_RUNBOOK_AREA_IDS.length,
      0,
      6,
      "Runbook guidance for purpose, setup, validation, demo, read-only viewers, safety boundaries, troubleshooting, and extension posture is ready with notes.",
    ),
  ] as const;

  return Phase20GCloseoutReportSchema.parse({
    report_version: PHASE_20G_CLOSEOUT_VERSION,
    report_id: "phase-20g3-final-documentation-closeout",
    phase: "20G.3",
    verdict: "pass_with_notes",
    audits,
    documentation_areas: documentationAreas,
    blocking_areas: blockingAreas,
    notes,
    summary: {
      report_version: PHASE_20G_CLOSEOUT_VERSION,
      aggregated_audit_count: audits.length,
      documentation_area_count: documentationAreas.length,
      ready_count: countStatus(documentationAreas, "ready"),
      ready_with_notes_count: countStatus(
        documentationAreas,
        "ready_with_notes",
      ),
      blocked_count: countStatus(documentationAreas, "blocked"),
      blocking_area_count: blockingAreas.length,
      non_blocking_note_count: notes.length,
      packaging_readiness_area_count: PACKAGING_READINESS_AREA_IDS.length,
      runbook_area_count: ONBOARDING_RUNBOOK_AREA_IDS.length,
      combined_readiness_area_count:
        PACKAGING_READINESS_AREA_IDS.length +
        ONBOARDING_RUNBOOK_AREA_IDS.length,
      disabled_capability_continuity: true,
      expansion_era_continuity: true,
      source_material_exposure_count: 0,
      disabled_capability_market_active_count: 0,
      expansion_era_market_complete_count: 0,
      premature_final_project_complete_claim_count: 0,
      packaging_execution_count: 0,
      install_execution_count: 0,
      runtime_execution_count: 0,
      provider_call_count: 0,
      network_call_count: 0,
      authority_creation_count: 0,
      approval_creation_count: 0,
      capability_expansion_count: 0,
      phase20g_closeout_only: true,
      phase20g_capability_neutral: true,
      posture: POSTURE,
    },
    final_documentation_readiness_statement:
      "Phase 20G documentation readiness passes with notes: documentation, onboarding, handoff, packaging guidance, and portfolio-facing material are complete enough for final project closeout review while preserving disabled capability, future-expansion, source-material, and no-premature-closeout safety boundaries.",
    posture: POSTURE,
  });
}
