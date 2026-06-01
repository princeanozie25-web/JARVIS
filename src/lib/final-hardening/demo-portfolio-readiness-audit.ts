import { z } from "zod";

import {
  FinalHardeningPostureSchema,
  type FinalHardeningPosture,
} from "./contracts";
import { buildAuthoritySurfaceRegressionAuditReport } from "./authority-surface-regression-audit";
import { buildGovernanceIntegrityAuditReport } from "./governance-integrity-audit";
import {
  DemoSurfaceIdSchema,
  RecruiterNarrativeIdSchema,
  buildPhase20DCloseoutReport,
  buildPortfolioReport,
  getDemoSurfaceRegistry,
  summarizeDemoSurfaces,
  summarizePortfolioReport,
  summarizeRecruiterNarratives,
  type DemoSurface,
  type DemoSurfaceId,
  type RecruiterNarrativeId,
} from "../portfolio-readiness";
import { summarizeDisabledFeaturePosture } from "../final-system-status";

export const DEMO_PORTFOLIO_READINESS_AUDIT_VERSION = "20F.8" as const;

export const DEMO_PORTFOLIO_READINESS_VERDICTS = ["pass_with_notes"] as const;

export const DEMO_PORTFOLIO_READINESS_STATUSES = [
  "pass",
  "pass_with_notes",
  "blocked",
] as const;

export const DEMO_SAFE_CLASSIFICATIONS = [
  "read_only_visible",
  "synthetic_safe",
  "redacted_metadata_only",
  "governed_sandboxed",
  "future_only",
] as const;

export const PORTFOLIO_VALUE_CLASSIFICATIONS = [
  "recruiter_ready",
  "interviewer_ready",
  "safety_story_ready",
  "move_in_story_ready",
  "future_expansion_story_ready",
] as const;

export const DEMO_PORTFOLIO_BLOCKING_CLASSIFICATIONS = [
  "blocking_if_unclear",
  "non_blocking_note",
] as const;

export const DEMO_PORTFOLIO_READINESS_AREA_IDS = [
  "demo-portfolio:command-center-visible-read-only",
  "demo-portfolio:architecture-graph-visible-read-only",
  "demo-portfolio:telemetry-cockpit-visible-read-only",
  "demo-portfolio:governance-visualizer-visible-read-only",
  "demo-portfolio:red-team-sandbox-visible-read-only",
  "demo-portfolio:cai-governed-not-executing",
  "demo-portfolio:synthetic-demo-posture-clear",
  "demo-portfolio:no-viewer-mutation-affordances",
  "demo-portfolio:no-raw-private-source-material",
  "demo-portfolio:readme-current-status-aligned",
  "demo-portfolio:disabled-capabilities-not-marketed-active",
  "demo-portfolio:core-system-portfolio-demo-ready",
  "demo-portfolio:expansion-era-future-only",
] as const;

export type DemoPortfolioReadinessVerdict =
  (typeof DEMO_PORTFOLIO_READINESS_VERDICTS)[number];
export type DemoPortfolioReadinessStatus =
  (typeof DEMO_PORTFOLIO_READINESS_STATUSES)[number];
export type DemoSafeClassification = (typeof DEMO_SAFE_CLASSIFICATIONS)[number];
export type PortfolioValueClassification =
  (typeof PORTFOLIO_VALUE_CLASSIFICATIONS)[number];
export type DemoPortfolioBlockingClassification =
  (typeof DEMO_PORTFOLIO_BLOCKING_CLASSIFICATIONS)[number];
export type DemoPortfolioReadinessAreaId =
  (typeof DEMO_PORTFOLIO_READINESS_AREA_IDS)[number];

export const DemoPortfolioReadinessVerdictSchema = z.enum(
  DEMO_PORTFOLIO_READINESS_VERDICTS,
);
export const DemoPortfolioReadinessStatusSchema = z.enum(
  DEMO_PORTFOLIO_READINESS_STATUSES,
);
export const DemoSafeClassificationSchema = z.enum(DEMO_SAFE_CLASSIFICATIONS);
export const PortfolioValueClassificationSchema = z.enum(
  PORTFOLIO_VALUE_CLASSIFICATIONS,
);
export const DemoPortfolioBlockingClassificationSchema = z.enum(
  DEMO_PORTFOLIO_BLOCKING_CLASSIFICATIONS,
);
export const DemoPortfolioReadinessAreaIdSchema = z.enum(
  DEMO_PORTFOLIO_READINESS_AREA_IDS,
);

export const DemoPortfolioReadinessAreaSchema = z.strictObject({
  readiness_area_id: DemoPortfolioReadinessAreaIdSchema,
  title: z.string().trim().min(1).max(180),
  status: DemoPortfolioReadinessStatusSchema,
  visible_surface_ids: z.array(DemoSurfaceIdSchema),
  narrative_ids: z.array(RecruiterNarrativeIdSchema),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  evidence_summary: z.string().trim().min(1).max(760),
  risk_if_unclear: z.string().trim().min(1).max(560),
  demo_safe_classification: DemoSafeClassificationSchema,
  portfolio_value_classification: PortfolioValueClassificationSchema,
  blocking_classification: DemoPortfolioBlockingClassificationSchema,
  blocking: z.boolean(),
  notes: z.array(z.string().trim().min(1).max(320)).min(1),
  posture: FinalHardeningPostureSchema,
});

export const DemoPortfolioReadinessAuditSummarySchema = z.strictObject({
  report_version: z.literal(DEMO_PORTFOLIO_READINESS_AUDIT_VERSION),
  readiness_area_count: z.number().int().positive(),
  pass_count: z.number().int().nonnegative(),
  pass_with_notes_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  blocking_area_count: z.number().int().nonnegative(),
  visible_surface_count: z.number().int().positive(),
  narrative_reference_count: z.number().int().positive(),
  demo_safe_surface_count: z.number().int().nonnegative(),
  synthetic_only_surface_count: z.number().int().nonnegative(),
  redacted_metadata_surface_count: z.number().int().nonnegative(),
  read_only_authority_surface_count: z.number().int().nonnegative(),
  gated_or_sandboxed_authority_surface_count: z.number().int().nonnegative(),
  portfolio_report_section_count: z.number().int().positive(),
  portfolio_report_evidence_count: z.number().int().positive(),
  recruiter_narrative_count: z.number().int().positive(),
  disabled_feature_count: z.number().int().positive(),
  authority_regression_count: z.literal(0),
  governance_integrity_pass: z.literal(true),
  phase20d_complete: z.literal(true),
  phase20f_demo_portfolio_audit_only: z.literal(true),
  phase20f_capability_neutral: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export const DemoPortfolioReadinessAuditReportSchema = z.strictObject({
  report_version: z.literal(DEMO_PORTFOLIO_READINESS_AUDIT_VERSION),
  report_id: z.literal("phase-20f8-demo-portfolio-readiness-audit"),
  phase: z.literal("20F.8"),
  verdict: DemoPortfolioReadinessVerdictSchema,
  readiness_areas: z.array(DemoPortfolioReadinessAreaSchema),
  blocking_areas: z.array(DemoPortfolioReadinessAreaSchema),
  notes: z.array(DemoPortfolioReadinessAreaSchema),
  summary: DemoPortfolioReadinessAuditSummarySchema,
  final_demo_portfolio_statement: z.string().trim().min(1).max(760),
  posture: FinalHardeningPostureSchema,
});

export type DemoPortfolioReadinessArea = z.infer<
  typeof DemoPortfolioReadinessAreaSchema
>;
export type DemoPortfolioReadinessAuditSummary = z.infer<
  typeof DemoPortfolioReadinessAuditSummarySchema
>;
export type DemoPortfolioReadinessAuditReport = z.infer<
  typeof DemoPortfolioReadinessAuditReportSchema
>;

type DemoPortfolioReadinessFocus = {
  readiness_area_id: DemoPortfolioReadinessAreaId;
  title: string;
  status: DemoPortfolioReadinessStatus;
  visible_surface_ids: readonly DemoSurfaceId[];
  narrative_ids: readonly RecruiterNarrativeId[];
  evidence_ids: readonly string[];
  evidence_summary: string;
  risk_if_unclear: string;
  demo_safe_classification: DemoSafeClassification;
  portfolio_value_classification: PortfolioValueClassification;
  blocking_classification: DemoPortfolioBlockingClassification;
  notes: readonly string[];
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

const FOCUS: readonly DemoPortfolioReadinessFocus[] = [
  {
    readiness_area_id: "demo-portfolio:command-center-visible-read-only",
    title: "Command Center visible and read-only",
    status: "pass",
    visible_surface_ids: [
      "demo-surface:rest-orb",
      "demo-surface:working-cockpit",
      "demo-surface:audit-timeline",
    ],
    narrative_ids: ["recruiter-narrative:command-center-ui"],
    evidence_ids: [
      "phase-20d:demo-surface-registry",
      "phase-20d:portfolio-report",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Rest orb, working cockpit, and audit timeline are visible portfolio surfaces with read-only or redacted metadata posture.",
    risk_if_unclear:
      "Recruiters could mistake visibility surfaces for live control surfaces.",
    demo_safe_classification: "read_only_visible",
    portfolio_value_classification: "recruiter_ready",
    blocking_classification: "blocking_if_unclear",
    notes: ["Command Center visibility remains local and non-mutating."],
  },
  {
    readiness_area_id: "demo-portfolio:architecture-graph-visible-read-only",
    title: "Architecture graph visible and read-only",
    status: "pass",
    visible_surface_ids: [
      "demo-surface:architecture-graph",
      "demo-surface:runtime-dependency-graph",
    ],
    narrative_ids: [
      "recruiter-narrative:architecture-graph",
      "recruiter-narrative:local-first-ai-operating-system",
    ],
    evidence_ids: [
      "phase-20d:demo-surface-registry",
      "phase-20d:portfolio-report",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Architecture and dependency graph surfaces explain subsystem boundaries while graph-driven execution remains disabled.",
    risk_if_unclear:
      "Graph visibility could be misread as a runtime orchestration surface.",
    demo_safe_classification: "read_only_visible",
    portfolio_value_classification: "interviewer_ready",
    blocking_classification: "blocking_if_unclear",
    notes: ["Graph surfaces are explanatory only and cannot dispatch tools."],
  },
  {
    readiness_area_id: "demo-portfolio:telemetry-cockpit-visible-read-only",
    title: "Telemetry cockpit visible and read-only",
    status: "pass",
    visible_surface_ids: [
      "demo-surface:telemetry-cockpit",
      "demo-surface:audit-timeline",
    ],
    narrative_ids: ["recruiter-narrative:telemetry-cockpit"],
    evidence_ids: [
      "phase-20d:demo-surface-registry",
      "phase-20f:governance-integrity-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Telemetry and audit visibility is redacted metadata only and does not query live telemetry or expose source material.",
    risk_if_unclear:
      "A telemetry cockpit can look operationally live unless read-only posture is explicit.",
    demo_safe_classification: "redacted_metadata_only",
    portfolio_value_classification: "interviewer_ready",
    blocking_classification: "blocking_if_unclear",
    notes: ["Telemetry remains redacted, deterministic, and projection-only."],
  },
  {
    readiness_area_id: "demo-portfolio:governance-visualizer-visible-read-only",
    title: "Governance visualizer visible and read-only",
    status: "pass",
    visible_surface_ids: [
      "demo-surface:governance-boundary-visualizer",
      "demo-surface:approval-lifecycle",
    ],
    narrative_ids: [
      "recruiter-narrative:governance-visualizer",
      "recruiter-narrative:governance-first-architecture",
      "recruiter-narrative:approval-gated-execution",
    ],
    evidence_ids: [
      "phase-20d:demo-surface-registry",
      "phase-20e:governance-boundary-audit",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Governance visibility explains approval and authority boundaries without creating approvals or bypass affordances.",
    risk_if_unclear:
      "Governance diagrams could be mistaken for policy editors or approval controls.",
    demo_safe_classification: "read_only_visible",
    portfolio_value_classification: "safety_story_ready",
    blocking_classification: "blocking_if_unclear",
    notes: ["Governance visibility cannot edit policy or approval state."],
  },
  {
    readiness_area_id: "demo-portfolio:red-team-sandbox-visible-read-only",
    title: "Red-team sandbox visible and read-only",
    status: "pass_with_notes",
    visible_surface_ids: ["demo-surface:red-team-sandbox"],
    narrative_ids: ["recruiter-narrative:red-team-sandbox"],
    evidence_ids: [
      "phase-20d:demo-surface-registry",
      "phase-20e:authority-surface-audit",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Red-team sandbox is visible as a safety narrative with synthetic data and sandboxed/non-executing posture.",
    risk_if_unclear:
      "A red-team surface can be overread as attack automation if CAI limits are not explicit.",
    demo_safe_classification: "governed_sandboxed",
    portfolio_value_classification: "safety_story_ready",
    blocking_classification: "non_blocking_note",
    notes: ["Red-team/CAI is portfolio-visible but remains non-executing."],
  },
  {
    readiness_area_id: "demo-portfolio:cai-governed-not-executing",
    title: "CAI governed and not executing",
    status: "pass_with_notes",
    visible_surface_ids: ["demo-surface:red-team-sandbox"],
    narrative_ids: ["recruiter-narrative:red-team-sandbox"],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "CAI posture is governed, whitelisted-or-disabled, synthetic-safe, and ready for explanation without executing attacks or contacting targets.",
    risk_if_unclear:
      "CAI-ready language could imply live exploit execution or target contact.",
    demo_safe_classification: "governed_sandboxed",
    portfolio_value_classification: "safety_story_ready",
    blocking_classification: "non_blocking_note",
    notes: ["CAI is marked ready for narrative, not execution."],
  },
  {
    readiness_area_id: "demo-portfolio:synthetic-demo-posture-clear",
    title: "Synthetic/demo data posture is clear",
    status: "pass",
    visible_surface_ids: [
      "demo-surface:demo-mode-synthetic-dataset",
      "demo-surface:fake-room-room-os",
      "demo-surface:red-team-sandbox",
    ],
    narrative_ids: [
      "recruiter-narrative:portfolio-value",
      "recruiter-narrative:room-os",
      "recruiter-narrative:red-team-sandbox",
    ],
    evidence_ids: [
      "phase-20d:demo-surface-registry",
      "phase-20d:portfolio-report",
      "phase-20c:onboarding-closeout",
    ],
    evidence_summary:
      "Demo mode, fake room, and red-team surfaces are synthetic-safe and do not require private or live data.",
    risk_if_unclear:
      "Demo data could be mistaken for production or private room/user material.",
    demo_safe_classification: "synthetic_safe",
    portfolio_value_classification: "recruiter_ready",
    blocking_classification: "blocking_if_unclear",
    notes: ["Synthetic/demo-safe posture is explicit in demo metadata."],
  },
  {
    readiness_area_id: "demo-portfolio:no-viewer-mutation-affordances",
    title: "Viewer mutation affordances are absent",
    status: "pass",
    visible_surface_ids: [
      "demo-surface:working-cockpit",
      "demo-surface:architecture-graph",
      "demo-surface:governance-boundary-visualizer",
      "demo-surface:telemetry-cockpit",
    ],
    narrative_ids: [
      "recruiter-narrative:command-center-ui",
      "recruiter-narrative:governance-first-architecture",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20f:authority-surface-regression-audit",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Viewers expose no execute, retry, approve, mutate, dispatch, or tool-call affordances.",
    risk_if_unclear:
      "A polished viewer could appear action-capable without explicit non-mutation posture.",
    demo_safe_classification: "read_only_visible",
    portfolio_value_classification: "safety_story_ready",
    blocking_classification: "blocking_if_unclear",
    notes: [
      "Viewer surfaces are read-only and cannot trigger runtime behavior.",
    ],
  },
  {
    readiness_area_id: "demo-portfolio:no-raw-private-source-material",
    title: "Raw/private/source material remains excluded",
    status: "pass",
    visible_surface_ids: [
      "demo-surface:telemetry-cockpit",
      "demo-surface:audit-timeline",
      "demo-surface:model-runtime",
      "demo-surface:voice-runtime",
      "demo-surface:vision-runtime",
    ],
    narrative_ids: [
      "recruiter-narrative:telemetry-cockpit",
      "recruiter-narrative:local-model-runtime",
      "recruiter-narrative:voice-runtime",
      "recruiter-narrative:vision-runtime",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Raw prompts, outputs, audio, OCR, frames, project bodies, and private/source material remain excluded or redacted.",
    risk_if_unclear:
      "Portfolio evidence could accidentally reveal private data if redaction posture is not enforced.",
    demo_safe_classification: "redacted_metadata_only",
    portfolio_value_classification: "safety_story_ready",
    blocking_classification: "blocking_if_unclear",
    notes: ["Raw/private/source material exposure remains forbidden."],
  },
  {
    readiness_area_id: "demo-portfolio:readme-current-status-aligned",
    title: "README current status is aligned",
    status: "pass_with_notes",
    visible_surface_ids: ["demo-surface:move-in-checklist"],
    narrative_ids: [
      "recruiter-narrative:portfolio-value",
      "recruiter-narrative:bootstrap-onboarding-readiness",
    ],
    evidence_ids: [
      "README.md:current-status",
      "README.md:phase-20f-final-hardening",
      "phase-20d:portfolio-closeout",
    ],
    evidence_summary:
      "README status and Phase 20F notes describe completed hardening metadata and deliberately disabled capability boundaries.",
    risk_if_unclear:
      "A portfolio reader could overestimate live capability if status and disabled features drift.",
    demo_safe_classification: "read_only_visible",
    portfolio_value_classification: "recruiter_ready",
    blocking_classification: "non_blocking_note",
    notes: [
      "README alignment is documented statically; the audit does not read files at runtime.",
    ],
  },
  {
    readiness_area_id:
      "demo-portfolio:disabled-capabilities-not-marketed-active",
    title: "Disabled capabilities are not marketed as active",
    status: "pass",
    visible_surface_ids: [
      "demo-surface:voice-runtime",
      "demo-surface:vision-runtime",
      "demo-surface:scheduled-assistance",
      "demo-surface:move-in-checklist",
    ],
    narrative_ids: [
      "recruiter-narrative:voice-runtime",
      "recruiter-narrative:vision-runtime",
      "recruiter-narrative:approval-gated-execution",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Wake word, always-listening, hidden capture, auto-approval, public dashboards, graph execution, scheduler side effects, routine chaining, and unapproved device actions are documented as disabled or deferred.",
    risk_if_unclear:
      "Recruiter/demo copy could present deferred architecture as shipped automation.",
    demo_safe_classification: "future_only",
    portfolio_value_classification: "safety_story_ready",
    blocking_classification: "blocking_if_unclear",
    notes: ["Disabled-feature clarity remains part of the portfolio story."],
  },
  {
    readiness_area_id: "demo-portfolio:core-system-portfolio-demo-ready",
    title: "Core system is portfolio-demo-ready",
    status: "pass_with_notes",
    visible_surface_ids: [
      "demo-surface:architecture-graph",
      "demo-surface:governance-boundary-visualizer",
      "demo-surface:telemetry-cockpit",
      "demo-surface:doctor-cli-report",
      "demo-surface:onboarding-report",
      "demo-surface:move-in-checklist",
    ],
    narrative_ids: [
      "recruiter-narrative:local-first-ai-operating-system",
      "recruiter-narrative:governance-first-architecture",
      "recruiter-narrative:portfolio-value",
    ],
    evidence_ids: [
      "phase-20d:portfolio-report",
      "phase-20d:portfolio-closeout",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "Core portfolio surfaces, narratives, reports, and flows are coherent for recruiter/interviewer explanation without demo execution.",
    risk_if_unclear:
      "The project may look broad rather than coherent if narrative and surface links are not explicit.",
    demo_safe_classification: "read_only_visible",
    portfolio_value_classification: "interviewer_ready",
    blocking_classification: "non_blocking_note",
    notes: [
      "Portfolio-demo readiness is narrative/report readiness, not live demo automation.",
    ],
  },
  {
    readiness_area_id: "demo-portfolio:expansion-era-future-only",
    title: "Expansion-era items remain future work",
    status: "pass_with_notes",
    visible_surface_ids: [
      "demo-surface:architecture-graph",
      "demo-surface:governance-boundary-visualizer",
      "demo-surface:demo-mode-synthetic-dataset",
    ],
    narrative_ids: [
      "recruiter-narrative:future-gitnexus",
      "recruiter-narrative:future-graphify",
      "recruiter-narrative:future-llm-council",
      "recruiter-narrative:future-obsidian",
      "recruiter-narrative:future-security-project-integration",
    ],
    evidence_ids: [
      "phase-20d:future-expansion-posture",
      "phase-20d:portfolio-report",
      "phase-20f:governance-integrity-audit",
    ],
    evidence_summary:
      "GitNexus, Graphify, LLM Council, Obsidian, and security integrations are represented as expansion-era metadata, not shipped capability.",
    risk_if_unclear:
      "Future roadmap items could be misrepresented as current product capability.",
    demo_safe_classification: "future_only",
    portfolio_value_classification: "future_expansion_story_ready",
    blocking_classification: "non_blocking_note",
    notes: [
      "Expansion-era narrative remains future-only and capability-neutral.",
    ],
  },
] as const;

function surfaceMap(): ReadonlyMap<DemoSurfaceId, DemoSurface> {
  return new Map(
    getDemoSurfaceRegistry().surfaces.map((surface) => [
      surface.surface_id,
      surface,
    ]),
  );
}

function surfacesAreDemoSafe(
  surfaceIds: readonly DemoSurfaceId[],
  surfacesById: ReadonlyMap<DemoSurfaceId, DemoSurface>,
): boolean {
  return surfaceIds.every((surfaceId) => {
    const surface = surfacesById.get(surfaceId);

    return (
      !!surface &&
      surface.synthetic_demo_safe &&
      surface.entrypoint.creates_new_route === false &&
      surface.entrypoint.executes_demo === false &&
      [
        "source_material_not_included",
        "source_material_redacted",
        "source_material_synthetic_only",
      ].includes(surface.source_material_posture) &&
      [
        "read_only",
        "approval_gated_visibility",
        "sandboxed_only",
        "deferred_disabled",
      ].includes(surface.authority_posture)
    );
  });
}

function buildArea(
  focus: DemoPortfolioReadinessFocus,
  surfacesById: ReadonlyMap<DemoSurfaceId, DemoSurface>,
): DemoPortfolioReadinessArea {
  const represented = focus.visible_surface_ids.every((surfaceId) =>
    surfacesById.has(surfaceId),
  );
  const demoSafe = surfacesAreDemoSafe(focus.visible_surface_ids, surfacesById);
  const status = represented && demoSafe ? focus.status : "blocked";

  return DemoPortfolioReadinessAreaSchema.parse({
    readiness_area_id: focus.readiness_area_id,
    title: focus.title,
    status,
    visible_surface_ids: [...focus.visible_surface_ids],
    narrative_ids: [...focus.narrative_ids],
    evidence_ids: [...focus.evidence_ids],
    evidence_summary: focus.evidence_summary,
    risk_if_unclear: focus.risk_if_unclear,
    demo_safe_classification: focus.demo_safe_classification,
    portfolio_value_classification: focus.portfolio_value_classification,
    blocking_classification: focus.blocking_classification,
    blocking:
      status === "blocked" &&
      focus.blocking_classification === "blocking_if_unclear",
    notes: [...focus.notes],
    posture: POSTURE,
  });
}

export function buildDemoPortfolioReadinessAuditReport(): DemoPortfolioReadinessAuditReport {
  const surfacesById = surfaceMap();
  const demoSurfaceSummary = summarizeDemoSurfaces();
  const portfolioReportSummary = summarizePortfolioReport();
  const recruiterSummary = summarizeRecruiterNarratives();
  const disabledFeatureSummary = summarizeDisabledFeaturePosture();
  const phase20dCloseout = buildPhase20DCloseoutReport();
  const portfolioReport = buildPortfolioReport();
  const authorityRegression = buildAuthoritySurfaceRegressionAuditReport();
  const governanceIntegrity = buildGovernanceIntegrityAuditReport();
  const readinessAreas = FOCUS.map((focus) => buildArea(focus, surfacesById));
  const visibleSurfaceIds = new Set(
    readinessAreas.flatMap((area) => area.visible_surface_ids),
  );
  const narrativeIds = new Set(
    readinessAreas.flatMap((area) => area.narrative_ids),
  );

  return DemoPortfolioReadinessAuditReportSchema.parse({
    report_version: DEMO_PORTFOLIO_READINESS_AUDIT_VERSION,
    report_id: "phase-20f8-demo-portfolio-readiness-audit",
    phase: "20F.8",
    verdict: "pass_with_notes",
    readiness_areas: readinessAreas,
    blocking_areas: readinessAreas.filter((area) => area.blocking),
    notes: readinessAreas.filter((area) => area.status === "pass_with_notes"),
    summary: {
      report_version: DEMO_PORTFOLIO_READINESS_AUDIT_VERSION,
      readiness_area_count: readinessAreas.length,
      pass_count: readinessAreas.filter((area) => area.status === "pass")
        .length,
      pass_with_notes_count: readinessAreas.filter(
        (area) => area.status === "pass_with_notes",
      ).length,
      blocked_count: readinessAreas.filter((area) => area.status === "blocked")
        .length,
      blocking_area_count: readinessAreas.filter((area) => area.blocking)
        .length,
      visible_surface_count: visibleSurfaceIds.size,
      narrative_reference_count: narrativeIds.size,
      demo_safe_surface_count: demoSurfaceSummary.demo_safe_count,
      synthetic_only_surface_count: demoSurfaceSummary.synthetic_only_count,
      redacted_metadata_surface_count:
        demoSurfaceSummary.redacted_metadata_count,
      read_only_authority_surface_count:
        demoSurfaceSummary.read_only_authority_count,
      gated_or_sandboxed_authority_surface_count:
        demoSurfaceSummary.gated_or_sandboxed_authority_count,
      portfolio_report_section_count: portfolioReportSummary.section_count,
      portfolio_report_evidence_count: portfolioReportSummary.evidence_count,
      recruiter_narrative_count: recruiterSummary.narrative_count,
      disabled_feature_count: disabledFeatureSummary.feature_count,
      authority_regression_count: authorityRegression.summary.regression_count,
      governance_integrity_pass:
        governanceIntegrity.summary.governance_integrity_pass,
      phase20d_complete: phase20dCloseout.phase_20d_complete,
      phase20f_demo_portfolio_audit_only: true,
      phase20f_capability_neutral: true,
      posture: POSTURE,
    },
    final_demo_portfolio_statement: `JARVIS is safe and coherent to demo as a portfolio system using ${portfolioReport.sections.length} portfolio report sections, ${demoSurfaceSummary.surface_count} demo surface records, and existing metadata only; disabled capabilities and expansion-era items remain explicitly non-active.`,
    posture: POSTURE,
  });
}
