import { z } from "zod";

import { buildPhase20FCloseoutReport } from "../final-hardening";
import { summarizeDisabledFeaturePosture } from "../final-system-status";
import {
  buildPhase20BCloseoutReport,
  summarizeDoctorCheckRegistry,
} from "../bootstrap-readiness";
import {
  buildPhase20CCloseoutReport,
  summarizeMoveInChecklist,
} from "../onboarding-readiness";
import {
  summarizeDemoSurfaces,
  summarizePortfolioReport,
} from "../portfolio-readiness";

export const PACKAGING_READINESS_AUDIT_VERSION = "20G.1" as const;

export const PACKAGING_READINESS_VERDICTS = [
  "pass_with_notes",
  "blocked",
] as const;

export const PACKAGING_READINESS_AREA_STATUSES = [
  "pass",
  "pass_with_notes",
  "blocked",
] as const;

export const PACKAGING_READINESS_BLOCKING_CLASSIFICATIONS = [
  "blocking_if_unclear",
  "non_blocking_note",
] as const;

export const PACKAGING_READINESS_AREA_IDS = [
  "packaging-readiness:readme-phase-20f-completion",
  "packaging-readiness:core-jarvis-os-status",
  "packaging-readiness:visible-demo-routes",
  "packaging-readiness:disabled-capabilities",
  "packaging-readiness:expansion-era-future-only",
  "packaging-readiness:cai-governed-not-executing",
  "packaging-readiness:setup-bootstrap-expectations",
  "packaging-readiness:test-command-documentation",
  "packaging-readiness:packaging-status",
  "packaging-readiness:move-in-readiness-status",
  "packaging-readiness:no-source-material-exposure",
  "packaging-readiness:no-disabled-capability-marketed-active",
  "packaging-readiness:no-premature-final-closeout",
] as const;

export type PackagingReadinessVerdict =
  (typeof PACKAGING_READINESS_VERDICTS)[number];
export type PackagingReadinessAreaStatus =
  (typeof PACKAGING_READINESS_AREA_STATUSES)[number];
export type PackagingReadinessBlockingClassification =
  (typeof PACKAGING_READINESS_BLOCKING_CLASSIFICATIONS)[number];
export type PackagingReadinessAreaId =
  (typeof PACKAGING_READINESS_AREA_IDS)[number];

export const PackagingReadinessVerdictSchema = z.enum(
  PACKAGING_READINESS_VERDICTS,
);
export const PackagingReadinessAreaStatusSchema = z.enum(
  PACKAGING_READINESS_AREA_STATUSES,
);
export const PackagingReadinessBlockingClassificationSchema = z.enum(
  PACKAGING_READINESS_BLOCKING_CLASSIFICATIONS,
);
export const PackagingReadinessAreaIdSchema = z.enum(
  PACKAGING_READINESS_AREA_IDS,
);

export const DocumentationPackagingPostureSchema = z.strictObject({
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  packaging_execution_enabled: z.literal(false),
  install_script_execution_enabled: z.literal(false),
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

export const PackagingReadinessAreaSchema = z.strictObject({
  readiness_area_id: PackagingReadinessAreaIdSchema,
  title: z.string().trim().min(1).max(180),
  status: PackagingReadinessAreaStatusSchema,
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  evidence_summary: z.string().trim().min(1).max(760),
  blocking_classification: PackagingReadinessBlockingClassificationSchema,
  blocking: z.boolean(),
  recommendation: z.string().trim().min(1).max(560),
  packaging_readiness_verdict: PackagingReadinessVerdictSchema,
  posture: DocumentationPackagingPostureSchema,
});

export const PackagingReadinessAuditSummarySchema = z.strictObject({
  report_version: z.literal(PACKAGING_READINESS_AUDIT_VERSION),
  readiness_area_count: z.number().int().positive(),
  pass_count: z.number().int().nonnegative(),
  pass_with_notes_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  blocking_area_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  phase20f_complete: z.literal(true),
  core_jarvis_os_complete: z.literal(true),
  demo_surface_count: z.number().int().positive(),
  demo_safe_surface_count: z.number().int().positive(),
  portfolio_report_section_count: z.number().int().positive(),
  disabled_feature_count: z.number().int().positive(),
  expansion_era_count: z.number().int().nonnegative(),
  doctor_check_count: z.number().int().positive(),
  move_in_checklist_item_count: z.number().int().positive(),
  phase20b_complete: z.literal(true),
  phase20c_complete: z.literal(true),
  packaging_execution_count: z.literal(0),
  final_closeout_claim_count: z.literal(0),
  phase20g_documentation_audit_only: z.literal(true),
  phase20g_capability_neutral: z.literal(true),
  posture: DocumentationPackagingPostureSchema,
});

export const PackagingReadinessAuditReportSchema = z.strictObject({
  report_version: z.literal(PACKAGING_READINESS_AUDIT_VERSION),
  report_id: z.literal("phase-20g1-documentation-packaging-readiness-audit"),
  phase: z.literal("20G.1"),
  verdict: PackagingReadinessVerdictSchema,
  readiness_areas: z.array(PackagingReadinessAreaSchema),
  blocking_areas: z.array(PackagingReadinessAreaSchema),
  notes: z.array(PackagingReadinessAreaSchema),
  summary: PackagingReadinessAuditSummarySchema,
  final_readiness_statement: z.string().trim().min(1).max(760),
  posture: DocumentationPackagingPostureSchema,
});

export type DocumentationPackagingPosture = z.infer<
  typeof DocumentationPackagingPostureSchema
>;
export type PackagingReadinessArea = z.infer<
  typeof PackagingReadinessAreaSchema
>;
export type PackagingReadinessAuditSummary = z.infer<
  typeof PackagingReadinessAuditSummarySchema
>;
export type PackagingReadinessAuditReport = z.infer<
  typeof PackagingReadinessAuditReportSchema
>;

type PackagingReadinessFocus = {
  readiness_area_id: PackagingReadinessAreaId;
  title: string;
  status: PackagingReadinessAreaStatus;
  evidence_ids: readonly string[];
  evidence_summary: string;
  blocking_classification: PackagingReadinessBlockingClassification;
  recommendation: string;
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

const FOCUS: readonly PackagingReadinessFocus[] = [
  {
    readiness_area_id: "packaging-readiness:readme-phase-20f-completion",
    title: "README reflects Phase 20F completion",
    status: "pass",
    evidence_ids: [
      "README.md:current-status",
      "README.md:phase-20f-final-hardening",
      "phase-20f:final-hardening-closeout",
    ],
    evidence_summary:
      "README status and Phase 20F notes identify Phase 20F.10 as complete while keeping final project closeout separate.",
    blocking_classification: "blocking_if_unclear",
    recommendation:
      "Keep Phase 20F completion visible until the final project closeout slice supersedes it.",
  },
  {
    readiness_area_id: "packaging-readiness:core-jarvis-os-status",
    title: "Core JARVIS OS status is clear",
    status: "pass",
    evidence_ids: [
      "phase-20f:system-completion-audit",
      "phase-20f:final-hardening-closeout",
    ],
    evidence_summary:
      "System completion and Phase 20F closeout metadata affirm core JARVIS OS completion as roadmap-defined.",
    blocking_classification: "blocking_if_unclear",
    recommendation:
      "Use the system completion statement as the source of truth for final documentation wording.",
  },
  {
    readiness_area_id: "packaging-readiness:visible-demo-routes",
    title: "Visible demo routes and entrypoints are documented",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20d:demo-surface-registry",
      "phase-20f:demo-portfolio-readiness-audit",
    ],
    evidence_summary:
      "Demo surfaces list existing routes, CLI reports, modules, and metadata references without creating routes or executing demos.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Before final handoff, keep demo surface references grouped by existing route, CLI entrypoint, module, or metadata-only reference.",
  },
  {
    readiness_area_id: "packaging-readiness:disabled-capabilities",
    title: "Disabled capabilities are clearly documented",
    status: "pass",
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "README.md:current-status",
    ],
    evidence_summary:
      "Wake word, always-listening, hidden/background capture, auto-approval, public dashboards, graph execution, scheduler side effects, routine chaining, CAI target limits, and unapproved device actions are documented as disabled or deferred.",
    blocking_classification: "blocking_if_unclear",
    recommendation:
      "Do not soften disabled-feature wording in final packaging notes.",
  },
  {
    readiness_area_id: "packaging-readiness:expansion-era-future-only",
    title: "Expansion-era items are future-only",
    status: "pass",
    evidence_ids: [
      "phase-20d:portfolio-report",
      "phase-20f:system-completion-audit",
    ],
    evidence_summary:
      "GitNexus/HITNEXUS, Graphify, LLM Council, Obsidian, LLM Wiki, security knowledge systems, and future research systems are classified as expansion-era future work.",
    blocking_classification: "blocking_if_unclear",
    recommendation:
      "Preserve future-only wording so packaging does not imply shipped integration capability.",
  },
  {
    readiness_area_id: "packaging-readiness:cai-governed-not-executing",
    title: "CAI is governed/ready but not executing",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20f:demo-portfolio-readiness-audit",
      "phase-20f:governance-integrity-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "CAI and red-team posture are documented as governed, sandboxed, whitelist/deferred, and non-executing.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Phrase CAI as readiness and governance narrative, not live attack execution or installation.",
  },
  {
    readiness_area_id: "packaging-readiness:setup-bootstrap-expectations",
    title: "Setup and bootstrap expectations are clear",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20b:bootstrap-closeout",
      "phase-20b:doctor-check-registry",
      "README.md:getting-started",
    ],
    evidence_summary:
      "Bootstrap and doctor metadata define prerequisites and safe local checks; README retains basic clone, install, dev, test, and lint commands.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Final docs should keep bootstrap expectations descriptive and distinguish doctor reporting from install automation.",
  },
  {
    readiness_area_id: "packaging-readiness:test-command-documentation",
    title: "Test commands are documented",
    status: "pass",
    evidence_ids: ["README.md:getting-started", "phase-20b:doctor-report"],
    evidence_summary:
      "Required validation commands remain documented for handoff review: targeted tests, full tests, typecheck, lint, and diff hygiene.",
    blocking_classification: "blocking_if_unclear",
    recommendation:
      "Keep final handoff instructions explicit about `npm test`, `npx tsc --noEmit`, `npm run lint`, and `git diff --check`.",
  },
  {
    readiness_area_id: "packaging-readiness:packaging-status",
    title: "Packaging status is clear",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20f:final-hardening-closeout",
      "README.md:current-status",
    ],
    evidence_summary:
      "Packaging/deployment proof is explicitly outside Phase 20F completion and not claimed as shipped capability.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Treat this as readiness for packaging review, not packaging execution or release publication.",
  },
  {
    readiness_area_id: "packaging-readiness:move-in-readiness-status",
    title: "Move-in readiness status is clear",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20c:move-in-checklist",
      "phase-20c:onboarding-closeout",
    ],
    evidence_summary:
      "Move-in readiness is represented through metadata checklists and reports; real device onboarding, wake-word/conversation-mode, and voice-authorisation tiers remain deferred.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Keep move-in docs clear that fake-room/demo readiness is distinct from real hardware onboarding.",
  },
  {
    readiness_area_id: "packaging-readiness:no-source-material-exposure",
    title: "No raw/private/source material is exposed",
    status: "pass",
    evidence_ids: [
      "phase-20f:governance-integrity-audit",
      "phase-20f:authority-surface-regression-audit",
      "phase-20f:demo-portfolio-readiness-audit",
    ],
    evidence_summary:
      "Prompt, output, audio, OCR, frame, telemetry source, and private project-body material remain excluded from documentation and demo metadata.",
    blocking_classification: "blocking_if_unclear",
    recommendation:
      "Keep final documentation limited to metadata, summaries, and synthetic/demo-safe references.",
  },
  {
    readiness_area_id:
      "packaging-readiness:no-disabled-capability-marketed-active",
    title: "Disabled capabilities are not marketed as active",
    status: "pass",
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20f:demo-portfolio-readiness-audit",
      "phase-20f:system-completion-audit",
    ],
    evidence_summary:
      "Disabled-by-design and deferred capabilities are part of the safety story, not marketed as active shipped features.",
    blocking_classification: "blocking_if_unclear",
    recommendation:
      "Keep portfolio copy honest: disabled features prove governance maturity rather than missing feature work.",
  },
  {
    readiness_area_id: "packaging-readiness:no-premature-final-closeout",
    title: "Final project closeout is not claimed prematurely",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20f:final-hardening-closeout",
      "phase-20g:documentation-packaging-readiness-audit",
    ],
    evidence_summary:
      "Phase 20G.1 is a documentation/packaging readiness audit only and does not claim final project closeout.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Reserve final project completion language for the later final closeout slice.",
  },
] as const;

function buildArea(focus: PackagingReadinessFocus): PackagingReadinessArea {
  const status =
    focus.status === "blocked" &&
    focus.blocking_classification === "blocking_if_unclear"
      ? "blocked"
      : focus.status;

  return PackagingReadinessAreaSchema.parse({
    readiness_area_id: focus.readiness_area_id,
    title: focus.title,
    status,
    evidence_ids: [...focus.evidence_ids],
    evidence_summary: focus.evidence_summary,
    blocking_classification: focus.blocking_classification,
    blocking:
      status === "blocked" &&
      focus.blocking_classification === "blocking_if_unclear",
    recommendation: focus.recommendation,
    packaging_readiness_verdict: "pass_with_notes",
    posture: POSTURE,
  });
}

export function buildPackagingReadinessAuditReport(): PackagingReadinessAuditReport {
  const phase20fCloseout = buildPhase20FCloseoutReport();
  const demoSurfaceSummary = summarizeDemoSurfaces();
  const portfolioSummary = summarizePortfolioReport();
  const disabledFeatureSummary = summarizeDisabledFeaturePosture();
  const bootstrapCloseout = buildPhase20BCloseoutReport();
  const doctorSummary = summarizeDoctorCheckRegistry();
  const onboardingCloseout = buildPhase20CCloseoutReport();
  const moveInSummary = summarizeMoveInChecklist();
  const readinessAreas = FOCUS.map(buildArea);
  const blockingAreas = readinessAreas.filter((area) => area.blocking);
  const notes = readinessAreas.filter(
    (area) => area.status === "pass_with_notes",
  );

  return PackagingReadinessAuditReportSchema.parse({
    report_version: PACKAGING_READINESS_AUDIT_VERSION,
    report_id: "phase-20g1-documentation-packaging-readiness-audit",
    phase: "20G.1",
    verdict: "pass_with_notes",
    readiness_areas: readinessAreas,
    blocking_areas: blockingAreas,
    notes,
    summary: {
      report_version: PACKAGING_READINESS_AUDIT_VERSION,
      readiness_area_count: readinessAreas.length,
      pass_count: readinessAreas.filter((area) => area.status === "pass")
        .length,
      pass_with_notes_count: notes.length,
      blocked_count: readinessAreas.filter((area) => area.status === "blocked")
        .length,
      blocking_area_count: blockingAreas.length,
      non_blocking_note_count: notes.length,
      phase20f_complete:
        phase20fCloseout.final_hardening_status === "phase_20f_complete",
      core_jarvis_os_complete: phase20fCloseout.summary.core_jarvis_os_complete,
      demo_surface_count: demoSurfaceSummary.surface_count,
      demo_safe_surface_count: demoSurfaceSummary.demo_safe_count,
      portfolio_report_section_count: portfolioSummary.section_count,
      disabled_feature_count: disabledFeatureSummary.feature_count,
      expansion_era_count: phase20fCloseout.summary.expansion_era_count,
      doctor_check_count: doctorSummary.check_count,
      move_in_checklist_item_count: moveInSummary.item_count,
      phase20b_complete: bootstrapCloseout.phase_20b_complete,
      phase20c_complete: onboardingCloseout.phase_20c_complete,
      packaging_execution_count: 0,
      final_closeout_claim_count: 0,
      phase20g_documentation_audit_only: true,
      phase20g_capability_neutral: true,
      posture: POSTURE,
    },
    final_readiness_statement: `Phase 20G.1 passes with notes: final documentation, packaging, onboarding, and handoff review are ready to proceed from ${readinessAreas.length} metadata readiness areas, with Phase 20F complete, core JARVIS OS status clear, disabled and expansion-era posture preserved, and no premature final project closeout claimed.`,
    posture: POSTURE,
  });
}
