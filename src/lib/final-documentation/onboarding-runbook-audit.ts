import { z } from "zod";

import {
  DocumentationPackagingPostureSchema,
  type DocumentationPackagingPosture,
  buildPackagingReadinessAuditReport,
} from "./packaging-readiness-audit";
import { summarizeDisabledFeaturePosture } from "../final-system-status";
import {
  summarizeBootstrapReadiness,
  summarizeDoctorCheckRegistry,
} from "../bootstrap-readiness";
import {
  summarizeMoveInChecklist,
  summarizeOnboardingStepRegistry,
} from "../onboarding-readiness";
import {
  summarizeDemoSurfaces,
  summarizePortfolioReport,
} from "../portfolio-readiness";

export const ONBOARDING_RUNBOOK_AUDIT_VERSION = "20G.2" as const;

export const ONBOARDING_RUNBOOK_VERDICTS = [
  "pass_with_notes",
  "blocked",
] as const;

export const ONBOARDING_RUNBOOK_AREA_STATUSES = [
  "pass",
  "pass_with_notes",
  "blocked",
] as const;

export const ONBOARDING_RUNBOOK_BLOCKING_CLASSIFICATIONS = [
  "blocking_if_missing",
  "non_blocking_note",
] as const;

export const ONBOARDING_RUNBOOK_AREA_IDS = [
  "onboarding-runbook:project-purpose",
  "onboarding-runbook:core-jarvis-os-status",
  "onboarding-runbook:safe-local-first-setup",
  "onboarding-runbook:environment-safe-defaults",
  "onboarding-runbook:install-bootstrap-expectations",
  "onboarding-runbook:test-validation-commands",
  "onboarding-runbook:demo-routes",
  "onboarding-runbook:read-only-viewer-surfaces",
  "onboarding-runbook:disabled-capabilities",
  "onboarding-runbook:approval-gated-execution",
  "onboarding-runbook:cai-governed-non-executing",
  "onboarding-runbook:expansion-era-future-work",
  "onboarding-runbook:troubleshooting-known-warnings",
  "onboarding-runbook:contributor-extension-guidance",
  "onboarding-runbook:no-premature-final-completion",
  "onboarding-runbook:no-source-material-exposure",
] as const;

export type OnboardingRunbookVerdict =
  (typeof ONBOARDING_RUNBOOK_VERDICTS)[number];
export type OnboardingRunbookAreaStatus =
  (typeof ONBOARDING_RUNBOOK_AREA_STATUSES)[number];
export type OnboardingRunbookBlockingClassification =
  (typeof ONBOARDING_RUNBOOK_BLOCKING_CLASSIFICATIONS)[number];
export type OnboardingRunbookAreaId =
  (typeof ONBOARDING_RUNBOOK_AREA_IDS)[number];

export const OnboardingRunbookVerdictSchema = z.enum(
  ONBOARDING_RUNBOOK_VERDICTS,
);
export const OnboardingRunbookAreaStatusSchema = z.enum(
  ONBOARDING_RUNBOOK_AREA_STATUSES,
);
export const OnboardingRunbookBlockingClassificationSchema = z.enum(
  ONBOARDING_RUNBOOK_BLOCKING_CLASSIFICATIONS,
);
export const OnboardingRunbookAreaIdSchema = z.enum(
  ONBOARDING_RUNBOOK_AREA_IDS,
);

export const OnboardingRunbookAreaSchema = z.strictObject({
  runbook_area_id: OnboardingRunbookAreaIdSchema,
  title: z.string().trim().min(1).max(180),
  status: OnboardingRunbookAreaStatusSchema,
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  evidence_summary: z.string().trim().min(1).max(760),
  risk_if_missing: z.string().trim().min(1).max(560),
  blocking_classification: OnboardingRunbookBlockingClassificationSchema,
  blocking: z.boolean(),
  recommendation: z.string().trim().min(1).max(560),
  posture: DocumentationPackagingPostureSchema,
});

export const OnboardingRunbookAuditSummarySchema = z.strictObject({
  report_version: z.literal(ONBOARDING_RUNBOOK_AUDIT_VERSION),
  runbook_area_count: z.number().int().positive(),
  pass_count: z.number().int().nonnegative(),
  pass_with_notes_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  blocking_area_count: z.number().int().nonnegative(),
  non_blocking_note_count: z.number().int().nonnegative(),
  phase20f_complete: z.literal(true),
  phase20g1_packaging_ready: z.literal(true),
  core_jarvis_os_complete: z.literal(true),
  bootstrap_requirement_count: z.number().int().positive(),
  doctor_check_count: z.number().int().positive(),
  onboarding_step_count: z.number().int().positive(),
  move_in_checklist_item_count: z.number().int().positive(),
  demo_surface_count: z.number().int().positive(),
  demo_safe_surface_count: z.number().int().positive(),
  portfolio_report_section_count: z.number().int().positive(),
  disabled_feature_count: z.number().int().positive(),
  expansion_era_count: z.number().int().nonnegative(),
  troubleshooting_note_count: z.number().int().positive(),
  contributor_guidance_count: z.number().int().positive(),
  packaging_execution_count: z.literal(0),
  final_completion_claim_count: z.literal(0),
  source_material_exposure_count: z.literal(0),
  phase20g_runbook_audit_only: z.literal(true),
  phase20g_capability_neutral: z.literal(true),
  posture: DocumentationPackagingPostureSchema,
});

export const OnboardingRunbookAuditReportSchema = z.strictObject({
  report_version: z.literal(ONBOARDING_RUNBOOK_AUDIT_VERSION),
  report_id: z.literal("phase-20g2-onboarding-runbook-readiness-audit"),
  phase: z.literal("20G.2"),
  verdict: OnboardingRunbookVerdictSchema,
  runbook_areas: z.array(OnboardingRunbookAreaSchema),
  blocking_areas: z.array(OnboardingRunbookAreaSchema),
  notes: z.array(OnboardingRunbookAreaSchema),
  summary: OnboardingRunbookAuditSummarySchema,
  final_runbook_statement: z.string().trim().min(1).max(760),
  posture: DocumentationPackagingPostureSchema,
});

export type OnboardingRunbookArea = z.infer<typeof OnboardingRunbookAreaSchema>;
export type OnboardingRunbookAuditSummary = z.infer<
  typeof OnboardingRunbookAuditSummarySchema
>;
export type OnboardingRunbookAuditReport = z.infer<
  typeof OnboardingRunbookAuditReportSchema
>;

type OnboardingRunbookFocus = {
  runbook_area_id: OnboardingRunbookAreaId;
  title: string;
  status: OnboardingRunbookAreaStatus;
  evidence_ids: readonly string[];
  evidence_summary: string;
  risk_if_missing: string;
  blocking_classification: OnboardingRunbookBlockingClassification;
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

const FOCUS: readonly OnboardingRunbookFocus[] = [
  {
    runbook_area_id: "onboarding-runbook:project-purpose",
    title: "Project purpose",
    status: "pass",
    evidence_ids: ["README.md:what-this-is", "phase-20d:portfolio-report"],
    evidence_summary:
      "README and portfolio metadata describe JARVIS as a governed, local-first AI operating environment rather than a chatbot wrapper.",
    risk_if_missing:
      "A fresh reader may mistake the project for a prompt demo instead of a governed OS-style architecture.",
    blocking_classification: "blocking_if_missing",
    recommendation:
      "Keep the project-purpose section at the top of final handoff docs.",
  },
  {
    runbook_area_id: "onboarding-runbook:core-jarvis-os-status",
    title: "Core JARVIS OS status",
    status: "pass",
    evidence_ids: [
      "phase-20f:system-completion-audit",
      "phase-20f:final-hardening-closeout",
    ],
    evidence_summary:
      "Phase 20F metadata affirms the roadmap-defined core JARVIS OS is complete while final project closeout remains separate.",
    risk_if_missing:
      "A fresh maintainer may not know which systems are complete, deferred, or future-only.",
    blocking_classification: "blocking_if_missing",
    recommendation:
      "Use Phase 20F completion wording as the source for runbook status.",
  },
  {
    runbook_area_id: "onboarding-runbook:safe-local-first-setup",
    title: "Safe local-first setup",
    status: "pass",
    evidence_ids: [
      "README.md:getting-started",
      "phase-20b:bootstrap-readiness-contract",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Setup guidance and bootstrap metadata keep JARVIS local-first with cloud/provider behavior disabled or gated by default.",
    risk_if_missing:
      "A fresh user may assume cloud/provider defaults or unsafe remote setup paths.",
    blocking_classification: "blocking_if_missing",
    recommendation:
      "Keep local-first and disabled-provider expectations explicit in setup docs.",
  },
  {
    runbook_area_id: "onboarding-runbook:environment-safe-defaults",
    title: "Environment variables and safe defaults",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20b:bootstrap-readiness-contract",
      "phase-20b:doctor-check-registry",
      "phase-20f:failure-mode-registry",
    ],
    evidence_summary:
      "Bootstrap and hardening metadata describe required env/config posture, missing/invalid configuration handling, and safe defaults without exposing secrets.",
    risk_if_missing:
      "A fresh setup could confuse missing config with permission to infer secrets, providers, or device targets.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Final runbook docs should keep env examples descriptive and never include secrets or raw private values.",
  },
  {
    runbook_area_id: "onboarding-runbook:install-bootstrap-expectations",
    title: "Install and bootstrap expectations",
    status: "pass_with_notes",
    evidence_ids: [
      "README.md:getting-started",
      "phase-20b:bootstrap-closeout",
      "phase-20g:documentation-packaging-readiness-audit",
    ],
    evidence_summary:
      "Getting Started and bootstrap closeout metadata document clone/install/dev expectations while distinguishing them from installer automation.",
    risk_if_missing:
      "A fresh developer may expect a one-click installer or auto-fix bootstrap path that does not exist.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Keep bootstrap docs clear that install commands are user-run, not executed by the audit layer.",
  },
  {
    runbook_area_id: "onboarding-runbook:test-validation-commands",
    title: "Test and validation commands",
    status: "pass",
    evidence_ids: [
      "README.md:getting-started",
      "phase-20g:documentation-packaging-readiness-audit",
    ],
    evidence_summary:
      "Runbook readiness includes targeted tests, full tests, typecheck, lint, and diff hygiene commands for validation.",
    risk_if_missing:
      "A maintainer may be unable to reproduce confidence checks before handoff or extension work.",
    blocking_classification: "blocking_if_missing",
    recommendation:
      "Keep validation commands explicit in final handoff and contributor notes.",
  },
  {
    runbook_area_id: "onboarding-runbook:demo-routes",
    title: "Demo routes and entrypoints",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20d:demo-surface-registry",
      "phase-20f:demo-portfolio-readiness-audit",
      "phase-20g:documentation-packaging-readiness-audit",
    ],
    evidence_summary:
      "Demo surface metadata documents existing routes, CLI report paths, modules, and metadata references without creating routes or executing demos.",
    risk_if_missing:
      "A portfolio viewer may not know which visible surfaces are inspectable or demo-safe.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Keep route and entrypoint references grouped by existing surface and mark metadata-only surfaces clearly.",
  },
  {
    runbook_area_id: "onboarding-runbook:read-only-viewer-surfaces",
    title: "Read-only viewer surfaces",
    status: "pass",
    evidence_ids: [
      "phase-20d:demo-surface-registry",
      "phase-20f:authority-surface-regression-audit",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Architecture graph, telemetry cockpit, governance visualizer, red-team sandbox, and related viewers remain read-only and non-mutating.",
    risk_if_missing:
      "A fresh user may mistake viewers for controls that can execute, approve, retry, mutate, or dispatch.",
    blocking_classification: "blocking_if_missing",
    recommendation:
      "Keep read-only viewer posture beside demo surface descriptions.",
  },
  {
    runbook_area_id: "onboarding-runbook:disabled-capabilities",
    title: "Disabled capabilities",
    status: "pass",
    evidence_ids: [
      "README.md:current-status",
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
    ],
    evidence_summary:
      "Wake word, always-listening, hidden/background capture, auto-approval, graph execution, public dashboards, scheduler side effects, routine chaining, CAI target limits, and unapproved device actions remain documented as disabled/deferred.",
    risk_if_missing:
      "A fresh user may try to enable intentionally disabled features or market them as active.",
    blocking_classification: "blocking_if_missing",
    recommendation:
      "Treat disabled capabilities as safety guarantees in the runbook.",
  },
  {
    runbook_area_id: "onboarding-runbook:approval-gated-execution",
    title: "Approval-gated execution posture",
    status: "pass",
    evidence_ids: [
      "phase-18:approval-runtime",
      "phase-20e:governance-boundary-audit",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Runbook evidence preserves Phase 18 as the side-effect authority boundary and blocks approval bypass, auto-approval, and voice-only approval.",
    risk_if_missing:
      "Contributors may accidentally route side-effect-capable work outside governance.",
    blocking_classification: "blocking_if_missing",
    recommendation:
      "Keep approval-gated execution as a mandatory extension rule.",
  },
  {
    runbook_area_id: "onboarding-runbook:cai-governed-non-executing",
    title: "CAI governed and non-executing posture",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20f:demo-portfolio-readiness-audit",
      "phase-20f:authority-surface-regression-audit",
      "phase-20g:documentation-packaging-readiness-audit",
    ],
    evidence_summary:
      "CAI is documented as governed, sandboxed, whitelist/deferred, non-executing, and portfolio-ready for explanation, not live execution or installation.",
    risk_if_missing:
      "CAI-ready wording could be misread as active exploit execution or external target contact.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Keep CAI language explicitly governed, non-executing, and synthetic-safe.",
  },
  {
    runbook_area_id: "onboarding-runbook:expansion-era-future-work",
    title: "Expansion-era future work",
    status: "pass",
    evidence_ids: [
      "phase-20d:portfolio-report",
      "phase-20f:system-completion-audit",
      "phase-20g:documentation-packaging-readiness-audit",
    ],
    evidence_summary:
      "GitNexus/HITNEXUS, Graphify, LLM Council, Obsidian, LLM Wiki, security knowledge systems, and future research systems remain future-only.",
    risk_if_missing:
      "A recruiter or maintainer could mistake roadmap narrative for shipped capability.",
    blocking_classification: "blocking_if_missing",
    recommendation:
      "Keep expansion-era work in a future-work section, not setup or demo instructions.",
  },
  {
    runbook_area_id: "onboarding-runbook:troubleshooting-known-warnings",
    title: "Troubleshooting and known warnings",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20f:failure-mode-registry",
      "phase-20f:recovery-fallback-audit",
      "phase-20g:documentation-packaging-readiness-audit",
    ],
    evidence_summary:
      "Failure-mode and recovery metadata document unavailable runtimes, provider/configuration failures, unsupported environments, resource constraints, packaging/build failures, and manual-only recovery guidance.",
    risk_if_missing:
      "A fresh developer may treat expected setup warnings or missing runtime prerequisites as unexplained breakage.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Convert final hardening failure modes into a concise known warnings and troubleshooting section during final docs polish.",
  },
  {
    runbook_area_id: "onboarding-runbook:contributor-extension-guidance",
    title: "Contributor and extension guidance",
    status: "pass_with_notes",
    evidence_ids: [
      "README.md:architecture-decisions",
      "phase-20f:governance-integrity-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Architecture decisions and final hardening audits document governance-before-capability, read-only viewers, local-first providers, approval-gated side effects, and metadata-only audit boundaries.",
    risk_if_missing:
      "Future contributors could add authority, network, UI, or execution behavior without preserving governance boundaries.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Add future extension notes that require local-first, approval-gated, replay-safe, redaction-aware, metadata-only boundaries where applicable.",
  },
  {
    runbook_area_id: "onboarding-runbook:no-premature-final-completion",
    title: "No premature final completion claim",
    status: "pass_with_notes",
    evidence_ids: [
      "phase-20f:final-hardening-closeout",
      "phase-20g:documentation-packaging-readiness-audit",
      "phase-20g:onboarding-runbook-readiness-audit",
    ],
    evidence_summary:
      "Phase 20G.2 proves runbook readiness after Phase 20F but does not claim final project closeout.",
    risk_if_missing:
      "Documentation could overclaim final project completion before the final closeout slice.",
    blocking_classification: "non_blocking_note",
    recommendation:
      "Reserve final completion language for the actual final project closeout.",
  },
  {
    runbook_area_id: "onboarding-runbook:no-source-material-exposure",
    title: "No raw/private/source material exposure",
    status: "pass",
    evidence_ids: [
      "phase-20f:governance-integrity-audit",
      "phase-20f:authority-surface-regression-audit",
      "phase-20g:documentation-packaging-readiness-audit",
    ],
    evidence_summary:
      "Runbook guidance remains limited to metadata, summaries, synthetic/demo-safe references, and redacted posture; prompts, outputs, audio, OCR, frames, telemetry source, and project bodies remain excluded.",
    risk_if_missing:
      "Final docs or examples could accidentally expose private/source material.",
    blocking_classification: "blocking_if_missing",
    recommendation:
      "Keep runbook examples synthetic, redacted, or metadata-only.",
  },
] as const;

function buildArea(focus: OnboardingRunbookFocus): OnboardingRunbookArea {
  const status =
    focus.status === "blocked" &&
    focus.blocking_classification === "blocking_if_missing"
      ? "blocked"
      : focus.status;

  return OnboardingRunbookAreaSchema.parse({
    runbook_area_id: focus.runbook_area_id,
    title: focus.title,
    status,
    evidence_ids: [...focus.evidence_ids],
    evidence_summary: focus.evidence_summary,
    risk_if_missing: focus.risk_if_missing,
    blocking_classification: focus.blocking_classification,
    blocking:
      status === "blocked" &&
      focus.blocking_classification === "blocking_if_missing",
    recommendation: focus.recommendation,
    posture: POSTURE,
  });
}

export function buildOnboardingRunbookAuditReport(): OnboardingRunbookAuditReport {
  const packagingReadiness = buildPackagingReadinessAuditReport();
  const bootstrapSummary = summarizeBootstrapReadiness();
  const doctorSummary = summarizeDoctorCheckRegistry();
  const onboardingStepSummary = summarizeOnboardingStepRegistry();
  const moveInSummary = summarizeMoveInChecklist();
  const demoSurfaceSummary = summarizeDemoSurfaces();
  const portfolioSummary = summarizePortfolioReport();
  const disabledFeatureSummary = summarizeDisabledFeaturePosture();
  const runbookAreas = FOCUS.map(buildArea);
  const blockingAreas = runbookAreas.filter((area) => area.blocking);
  const notes = runbookAreas.filter(
    (area) => area.status === "pass_with_notes",
  );

  return OnboardingRunbookAuditReportSchema.parse({
    report_version: ONBOARDING_RUNBOOK_AUDIT_VERSION,
    report_id: "phase-20g2-onboarding-runbook-readiness-audit",
    phase: "20G.2",
    verdict: "pass_with_notes",
    runbook_areas: runbookAreas,
    blocking_areas: blockingAreas,
    notes,
    summary: {
      report_version: ONBOARDING_RUNBOOK_AUDIT_VERSION,
      runbook_area_count: runbookAreas.length,
      pass_count: runbookAreas.filter((area) => area.status === "pass").length,
      pass_with_notes_count: notes.length,
      blocked_count: runbookAreas.filter((area) => area.status === "blocked")
        .length,
      blocking_area_count: blockingAreas.length,
      non_blocking_note_count: notes.length,
      phase20f_complete: packagingReadiness.summary.phase20f_complete,
      phase20g1_packaging_ready:
        packagingReadiness.verdict === "pass_with_notes" &&
        packagingReadiness.summary.blocking_area_count === 0,
      core_jarvis_os_complete:
        packagingReadiness.summary.core_jarvis_os_complete,
      bootstrap_requirement_count: bootstrapSummary.requirement_count,
      doctor_check_count: doctorSummary.check_count,
      onboarding_step_count: onboardingStepSummary.step_count,
      move_in_checklist_item_count: moveInSummary.item_count,
      demo_surface_count: demoSurfaceSummary.surface_count,
      demo_safe_surface_count: demoSurfaceSummary.demo_safe_count,
      portfolio_report_section_count: portfolioSummary.section_count,
      disabled_feature_count: disabledFeatureSummary.feature_count,
      expansion_era_count: packagingReadiness.summary.expansion_era_count,
      troubleshooting_note_count: runbookAreas.filter((area) =>
        area.runbook_area_id.includes("troubleshooting"),
      ).length,
      contributor_guidance_count: runbookAreas.filter((area) =>
        area.runbook_area_id.includes("contributor"),
      ).length,
      packaging_execution_count: 0,
      final_completion_claim_count: 0,
      source_material_exposure_count: 0,
      phase20g_runbook_audit_only: true,
      phase20g_capability_neutral: true,
      posture: POSTURE,
    },
    final_runbook_statement: `Phase 20G.2 passes with notes: onboarding and runbook guidance is ready for a fresh developer/user across ${runbookAreas.length} metadata areas, covering purpose, setup, validation, demo/read-only surfaces, disabled and governed boundaries, troubleshooting, extension guidance, and no premature final completion claim.`,
    posture: POSTURE,
  });
}
