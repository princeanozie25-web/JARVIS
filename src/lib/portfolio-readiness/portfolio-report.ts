import { z } from "zod";

import {
  PortfolioReadinessPostureSchema,
  type PortfolioReadinessPosture,
  type PortfolioReadinessSummary,
} from "./contracts";
import {
  DemoFlowIdSchema,
  getDemoFlowRegistry,
  summarizeDemoFlows,
  type DemoFlowId,
  type DemoFlowSummary,
} from "./demo-flows";
import {
  DemoSurfaceIdSchema,
  getDemoSurfaceRegistry,
  summarizeDemoSurfaces,
  type DemoSurfaceId,
  type DemoSurfaceSummary,
} from "./demo-surfaces";
import {
  RecruiterNarrativeIdSchema,
  getFutureExpansionNarratives,
  getRecruiterNarrativeRegistry,
  summarizeRecruiterNarratives,
  type RecruiterNarrativeId,
  type RecruiterNarrativeSummary,
} from "./narratives";
import { summarizePortfolioReadiness } from "./registry";

export const PORTFOLIO_REPORT_VERSION = "20D.5" as const;

export const PORTFOLIO_REPORT_VERDICTS = [
  "portfolio_ready_metadata_only",
] as const;

export const PORTFOLIO_REPORT_SECTION_IDS = [
  "portfolio-report-section:overall-portfolio-verdict",
  "portfolio-report-section:recruiter-readiness-summary",
  "portfolio-report-section:demo-readiness-summary",
  "portfolio-report-section:architecture-visibility-summary",
  "portfolio-report-section:governance-visibility-summary",
  "portfolio-report-section:technical-complexity-summary",
  "portfolio-report-section:local-first-summary",
  "portfolio-report-section:observability-summary",
  "portfolio-report-section:red-team-summary",
  "portfolio-report-section:onboarding-move-in-readiness-summary",
  "portfolio-report-section:future-expansion-summary",
] as const;

export const PORTFOLIO_REPORT_SECTION_CATEGORIES = [
  "verdict",
  "recruiter_readiness",
  "demo_readiness",
  "architecture_visibility",
  "governance_visibility",
  "technical_complexity",
  "local_first",
  "observability",
  "red_team",
  "onboarding_move_in",
  "future_expansion",
] as const;

export const PORTFOLIO_READINESS_EVIDENCE_TYPES = [
  "portfolio_contract",
  "recruiter_narrative",
  "demo_surface",
  "demo_flow",
  "future_expansion",
] as const;

export const PORTFOLIO_REPORT_FUTURE_EXPANSION_TARGETS = [
  "GitNexus",
  "Graphify",
  "LLM Council",
  "Obsidian",
  "Security integrations",
] as const;

export type PortfolioReportVerdict = (typeof PORTFOLIO_REPORT_VERDICTS)[number];
export type PortfolioReportSectionId =
  (typeof PORTFOLIO_REPORT_SECTION_IDS)[number];
export type PortfolioReportSectionCategory =
  (typeof PORTFOLIO_REPORT_SECTION_CATEGORIES)[number];
export type PortfolioReadinessEvidenceType =
  (typeof PORTFOLIO_READINESS_EVIDENCE_TYPES)[number];
export type PortfolioReportFutureExpansionTarget =
  (typeof PORTFOLIO_REPORT_FUTURE_EXPANSION_TARGETS)[number];

export const PortfolioReportVerdictSchema = z.enum(PORTFOLIO_REPORT_VERDICTS);
export const PortfolioReportSectionIdSchema = z.enum(
  PORTFOLIO_REPORT_SECTION_IDS,
);
export const PortfolioReportSectionCategorySchema = z.enum(
  PORTFOLIO_REPORT_SECTION_CATEGORIES,
);
export const PortfolioReadinessEvidenceTypeSchema = z.enum(
  PORTFOLIO_READINESS_EVIDENCE_TYPES,
);
export const PortfolioReportFutureExpansionTargetSchema = z.enum(
  PORTFOLIO_REPORT_FUTURE_EXPANSION_TARGETS,
);

export const PortfolioReadinessEvidenceSchema = z.strictObject({
  evidence_id: z.string().trim().min(1).max(180),
  evidence_type: PortfolioReadinessEvidenceTypeSchema,
  label: z.string().trim().min(1).max(180),
  source_module: z.string().trim().min(1).max(180),
  narrative_ids: z.array(RecruiterNarrativeIdSchema),
  demo_surface_ids: z.array(DemoSurfaceIdSchema),
  demo_flow_ids: z.array(DemoFlowIdSchema),
  future_expansion_targets: z.array(PortfolioReportFutureExpansionTargetSchema),
  metadata_only: z.literal(true),
});

export const PortfolioReportSectionSchema = z.strictObject({
  section_id: PortfolioReportSectionIdSchema,
  title: z.string().trim().min(1).max(180),
  category: PortfolioReportSectionCategorySchema,
  summary: z.string().trim().min(1).max(520),
  readiness_statement: z.string().trim().min(1).max(420),
  narrative_ids: z.array(RecruiterNarrativeIdSchema),
  demo_surface_ids: z.array(DemoSurfaceIdSchema),
  demo_flow_ids: z.array(DemoFlowIdSchema),
  evidence_ids: z.array(z.string().trim().min(1).max(180)).min(1),
  governance_notes: z.array(z.string().trim().min(1).max(320)).min(1),
  metadata_only: z.literal(true),
});

export const PortfolioReportSourceSummarySchema = z.strictObject({
  portfolio_contract: z.custom<PortfolioReadinessSummary>(),
  recruiter_narratives: z.custom<RecruiterNarrativeSummary>(),
  demo_surfaces: z.custom<DemoSurfaceSummary>(),
  demo_flows: z.custom<DemoFlowSummary>(),
});

export const PortfolioReportFutureExpansionSummarySchema = z.strictObject({
  targets: z.array(PortfolioReportFutureExpansionTargetSchema),
  future_narrative_count: z.number().int().nonnegative(),
  future_flow_count: z.number().int().nonnegative(),
  posture: z.literal("future_expansion_metadata_only_not_enabled"),
  metadata_only: z.literal(true),
});

export const PortfolioReportSchema = z.strictObject({
  report_version: z.literal(PORTFOLIO_REPORT_VERSION),
  report_id: z.literal("phase-20d5-portfolio-report"),
  phase: z.literal("20D.5"),
  verdict: PortfolioReportVerdictSchema,
  sections: z.array(PortfolioReportSectionSchema),
  evidence: z.array(PortfolioReadinessEvidenceSchema),
  source_summaries: PortfolioReportSourceSummarySchema,
  future_expansion_summary: PortfolioReportFutureExpansionSummarySchema,
  posture: PortfolioReadinessPostureSchema,
});

export const PortfolioReportSummarySchema = z.strictObject({
  report_version: z.literal(PORTFOLIO_REPORT_VERSION),
  verdict: PortfolioReportVerdictSchema,
  section_count: z.number().int().positive(),
  evidence_count: z.number().int().positive(),
  narrative_reference_count: z.number().int().nonnegative(),
  demo_surface_reference_count: z.number().int().nonnegative(),
  demo_flow_reference_count: z.number().int().nonnegative(),
  future_expansion_target_count: z.number().int().nonnegative(),
  phase20d_portfolio_report_only: z.literal(true),
  phase20d_capability_neutral: z.literal(true),
  posture: PortfolioReadinessPostureSchema,
});

export type PortfolioReadinessEvidence = z.infer<
  typeof PortfolioReadinessEvidenceSchema
>;
export type PortfolioReportSection = z.infer<
  typeof PortfolioReportSectionSchema
>;
export type PortfolioReportSourceSummary = z.infer<
  typeof PortfolioReportSourceSummarySchema
>;
export type PortfolioReportFutureExpansionSummary = z.infer<
  typeof PortfolioReportFutureExpansionSummarySchema
>;
export type PortfolioReport = z.infer<typeof PortfolioReportSchema>;
export type PortfolioReportSummary = z.infer<
  typeof PortfolioReportSummarySchema
>;

const POSTURE: PortfolioReadinessPosture = {
  contract_only: true,
  metadata_only: true,
  read_only: true,
  deterministic: true,
  presentation_generation_enabled: false,
  demo_execution_enabled: false,
  ui_route_created: false,
  automation_enabled: false,
  shell_execution_enabled: false,
  process_spawn_enabled: false,
  filesystem_mutation_enabled: false,
  network_call_enabled: false,
  provider_call_enabled: false,
  runtime_execution_enabled: false,
  approval_bypass_created: false,
  authority_surface_created: false,
  capability_created: false,
  source_material_exposure_enabled: false,
};

function evidence(input: Omit<PortfolioReadinessEvidence, "metadata_only">) {
  return PortfolioReadinessEvidenceSchema.parse({
    ...input,
    metadata_only: true,
  });
}

function section(input: Omit<PortfolioReportSection, "metadata_only">) {
  return PortfolioReportSectionSchema.parse({
    ...input,
    metadata_only: true,
  });
}

const EVIDENCE = [
  evidence({
    evidence_id: "portfolio-report-evidence:portfolio-readiness-contract",
    evidence_type: "portfolio_contract",
    label: "Phase 20D.1 portfolio readiness contract",
    source_module: "src/lib/portfolio-readiness/registry.ts",
    narrative_ids: [],
    demo_surface_ids: [],
    demo_flow_ids: [],
    future_expansion_targets: [],
  }),
  evidence({
    evidence_id: "portfolio-report-evidence:recruiter-narratives",
    evidence_type: "recruiter_narrative",
    label: "Phase 20D.2 recruiter narrative registry",
    source_module: "src/lib/portfolio-readiness/narratives.ts",
    narrative_ids: [
      "recruiter-narrative:local-first-ai-operating-system",
      "recruiter-narrative:governance-first-architecture",
      "recruiter-narrative:approval-gated-execution",
      "recruiter-narrative:portfolio-value",
    ],
    demo_surface_ids: [],
    demo_flow_ids: [],
    future_expansion_targets: [],
  }),
  evidence({
    evidence_id: "portfolio-report-evidence:demo-surfaces",
    evidence_type: "demo_surface",
    label: "Phase 20D.3 demo surface registry",
    source_module: "src/lib/portfolio-readiness/demo-surfaces.ts",
    narrative_ids: [],
    demo_surface_ids: [
      "demo-surface:architecture-graph",
      "demo-surface:governance-boundary-visualizer",
      "demo-surface:telemetry-cockpit",
      "demo-surface:red-team-sandbox",
      "demo-surface:doctor-cli-report",
      "demo-surface:onboarding-report",
      "demo-surface:move-in-checklist",
    ],
    demo_flow_ids: [],
    future_expansion_targets: [],
  }),
  evidence({
    evidence_id: "portfolio-report-evidence:demo-flows",
    evidence_type: "demo_flow",
    label: "Phase 20D.4 demo flow registry",
    source_module: "src/lib/portfolio-readiness/demo-flows.ts",
    narrative_ids: [],
    demo_surface_ids: [],
    demo_flow_ids: [
      "demo-flow:sixty-second-recruiter",
      "demo-flow:three-minute-technical",
      "demo-flow:governance-first",
      "demo-flow:architecture-deep-dive",
      "demo-flow:voice-vision-room",
      "demo-flow:approval-runtime",
      "demo-flow:red-team-safety",
      "demo-flow:onboarding-move-in",
      "demo-flow:expansion-era",
    ],
    future_expansion_targets: [],
  }),
  evidence({
    evidence_id: "portfolio-report-evidence:future-expansion",
    evidence_type: "future_expansion",
    label: "Future expansion narratives remain metadata-only",
    source_module: "src/lib/portfolio-readiness/narratives.ts",
    narrative_ids: [
      "recruiter-narrative:future-gitnexus",
      "recruiter-narrative:future-graphify",
      "recruiter-narrative:future-llm-council",
      "recruiter-narrative:future-obsidian",
      "recruiter-narrative:future-security-project-integration",
    ],
    demo_surface_ids: [],
    demo_flow_ids: ["demo-flow:expansion-era"],
    future_expansion_targets: [
      "GitNexus",
      "Graphify",
      "LLM Council",
      "Obsidian",
      "Security integrations",
    ],
  }),
] satisfies readonly PortfolioReadinessEvidence[];

const SECTIONS = [
  section({
    section_id: "portfolio-report-section:overall-portfolio-verdict",
    title: "Overall portfolio verdict",
    category: "verdict",
    summary:
      "JARVIS is portfolio-ready as a metadata-only local-first AI OS story with recruiter narratives, demo surfaces, and demo flows represented.",
    readiness_statement:
      "Ready for recruiter/demo explanation without generating presentations, routes, or executable demos.",
    narrative_ids: ["recruiter-narrative:portfolio-value"],
    demo_surface_ids: ["demo-surface:architecture-graph"],
    demo_flow_ids: ["demo-flow:sixty-second-recruiter"],
    evidence_ids: [
      "portfolio-report-evidence:portfolio-readiness-contract",
      "portfolio-report-evidence:demo-flows",
    ],
    governance_notes: [
      "Report generation composes existing metadata and does not create a new surface.",
    ],
  }),
  section({
    section_id: "portfolio-report-section:recruiter-readiness-summary",
    title: "Recruiter readiness summary",
    category: "recruiter_readiness",
    summary:
      "Recruiter-facing narratives cover project identity, portfolio value, safety posture, and local-first product framing.",
    readiness_statement:
      "Recruiter review can follow a 60-second story or expand into technical proof points.",
    narrative_ids: [
      "recruiter-narrative:local-first-ai-operating-system",
      "recruiter-narrative:portfolio-value",
      "recruiter-narrative:bootstrap-onboarding-readiness",
    ],
    demo_surface_ids: [
      "demo-surface:rest-orb",
      "demo-surface:move-in-checklist",
      "demo-surface:demo-mode-synthetic-dataset",
    ],
    demo_flow_ids: ["demo-flow:sixty-second-recruiter"],
    evidence_ids: [
      "portfolio-report-evidence:recruiter-narratives",
      "portfolio-report-evidence:demo-flows",
    ],
    governance_notes: [
      "Recruiter material stays descriptive and does not render a presentation artifact.",
    ],
  }),
  section({
    section_id: "portfolio-report-section:demo-readiness-summary",
    title: "Demo readiness summary",
    category: "demo_readiness",
    summary:
      "Demo readiness is represented through existing surfaces and ordered demo flows backed by synthetic or redacted metadata posture.",
    readiness_statement:
      "Demo storyboarding is ready while actual demo execution remains out of scope.",
    narrative_ids: [
      "recruiter-narrative:command-center-ui",
      "recruiter-narrative:room-os",
    ],
    demo_surface_ids: [
      "demo-surface:working-cockpit",
      "demo-surface:fake-room-room-os",
      "demo-surface:demo-mode-synthetic-dataset",
    ],
    demo_flow_ids: [
      "demo-flow:three-minute-technical",
      "demo-flow:voice-vision-room",
    ],
    evidence_ids: [
      "portfolio-report-evidence:demo-surfaces",
      "portfolio-report-evidence:demo-flows",
    ],
    governance_notes: [
      "No flow step invokes its referenced surface.",
      "Synthetic and redacted postures remain explicit.",
    ],
  }),
  section({
    section_id: "portfolio-report-section:architecture-visibility-summary",
    title: "Architecture visibility summary",
    category: "architecture_visibility",
    summary:
      "Architecture visibility connects the architecture graph, runtime dependency graph, and deep-dive demo flow.",
    readiness_statement:
      "Architecture is explainable through metadata ids without graph-driven execution.",
    narrative_ids: [
      "recruiter-narrative:architecture-graph",
      "recruiter-narrative:local-first-ai-operating-system",
    ],
    demo_surface_ids: [
      "demo-surface:architecture-graph",
      "demo-surface:runtime-dependency-graph",
    ],
    demo_flow_ids: ["demo-flow:architecture-deep-dive"],
    evidence_ids: [
      "portfolio-report-evidence:demo-surfaces",
      "portfolio-report-evidence:demo-flows",
    ],
    governance_notes: [
      "Architecture graph visibility remains read-only and cannot route execution.",
    ],
  }),
  section({
    section_id: "portfolio-report-section:governance-visibility-summary",
    title: "Governance visibility summary",
    category: "governance_visibility",
    summary:
      "Governance visibility covers disabled features, approval boundaries, authority posture, and audit evidence through existing metadata surfaces.",
    readiness_statement:
      "Governance-first explanation is ready without enabling approval, action, or bypass behavior.",
    narrative_ids: [
      "recruiter-narrative:governance-first-architecture",
      "recruiter-narrative:approval-gated-execution",
      "recruiter-narrative:governance-visualizer",
    ],
    demo_surface_ids: [
      "demo-surface:governance-boundary-visualizer",
      "demo-surface:approval-lifecycle",
      "demo-surface:audit-timeline",
    ],
    demo_flow_ids: ["demo-flow:governance-first", "demo-flow:approval-runtime"],
    evidence_ids: [
      "portfolio-report-evidence:recruiter-narratives",
      "portfolio-report-evidence:demo-surfaces",
    ],
    governance_notes: [
      "No auto-approval, voice-only approval, or unapproved execution posture is introduced.",
    ],
  }),
  section({
    section_id: "portfolio-report-section:technical-complexity-summary",
    title: "Technical complexity summary",
    category: "technical_complexity",
    summary:
      "Technical complexity is represented through local model, voice, vision, scheduler, approval, telemetry, and architecture surfaces.",
    readiness_statement:
      "Technical depth is reviewable as proof-point metadata rather than runtime execution.",
    narrative_ids: [
      "recruiter-narrative:local-model-runtime",
      "recruiter-narrative:voice-runtime",
      "recruiter-narrative:vision-runtime",
    ],
    demo_surface_ids: [
      "demo-surface:model-runtime",
      "demo-surface:voice-runtime",
      "demo-surface:vision-runtime",
      "demo-surface:scheduled-assistance",
    ],
    demo_flow_ids: [
      "demo-flow:three-minute-technical",
      "demo-flow:voice-vision-room",
    ],
    evidence_ids: [
      "portfolio-report-evidence:recruiter-narratives",
      "portfolio-report-evidence:demo-flows",
    ],
    governance_notes: [
      "Model, voice, vision, and scheduler runtimes are not invoked by this report.",
    ],
  }),
  section({
    section_id: "portfolio-report-section:local-first-summary",
    title: "Local-first summary",
    category: "local_first",
    summary:
      "Local-first posture is visible through model runtime, doctor readiness, onboarding, fake room, and cloud-gated narratives.",
    readiness_statement:
      "Local-first story is ready while provider and network defaults stay disabled or gated.",
    narrative_ids: [
      "recruiter-narrative:local-first-ai-operating-system",
      "recruiter-narrative:local-model-runtime",
    ],
    demo_surface_ids: [
      "demo-surface:model-runtime",
      "demo-surface:doctor-cli-report",
      "demo-surface:fake-room-room-os",
    ],
    demo_flow_ids: [
      "demo-flow:onboarding-move-in",
      "demo-flow:voice-vision-room",
    ],
    evidence_ids: [
      "portfolio-report-evidence:portfolio-readiness-contract",
      "portfolio-report-evidence:demo-surfaces",
    ],
    governance_notes: [
      "Provider calls, network calls, and cloud defaults are not enabled.",
    ],
  }),
  section({
    section_id: "portfolio-report-section:observability-summary",
    title: "Observability summary",
    category: "observability",
    summary:
      "Observability readiness is represented through telemetry cockpit and audit timeline surfaces with redacted metadata posture.",
    readiness_statement:
      "Observability is explainable without exposing source material or raw event bodies.",
    narrative_ids: ["recruiter-narrative:telemetry-cockpit"],
    demo_surface_ids: [
      "demo-surface:telemetry-cockpit",
      "demo-surface:audit-timeline",
    ],
    demo_flow_ids: [
      "demo-flow:three-minute-technical",
      "demo-flow:red-team-safety",
    ],
    evidence_ids: ["portfolio-report-evidence:demo-surfaces"],
    governance_notes: ["Telemetry stays redacted and metadata-only."],
  }),
  section({
    section_id: "portfolio-report-section:red-team-summary",
    title: "Red-team summary",
    category: "red_team",
    summary:
      "Red-team readiness is represented as synthetic and sandboxed safety narrative metadata.",
    readiness_statement:
      "Safety value is demonstrable without scanners, exploit execution, target contact, or provider escalation.",
    narrative_ids: ["recruiter-narrative:red-team-sandbox"],
    demo_surface_ids: [
      "demo-surface:red-team-sandbox",
      "demo-surface:governance-boundary-visualizer",
    ],
    demo_flow_ids: ["demo-flow:red-team-safety"],
    evidence_ids: [
      "portfolio-report-evidence:recruiter-narratives",
      "portfolio-report-evidence:demo-flows",
    ],
    governance_notes: [
      "CAI non-whitelisted targets and ungoverned provider escalation remain disabled.",
    ],
  }),
  section({
    section_id: "portfolio-report-section:onboarding-move-in-readiness-summary",
    title: "Onboarding and move-in readiness summary",
    category: "onboarding_move_in",
    summary:
      "Onboarding and move-in readiness connect doctor reporting, onboarding report, move-in checklist, and fake-room rehearsal.",
    readiness_statement:
      "Fresh-machine to first-safe-run explanation is ready without executing setup.",
    narrative_ids: [
      "recruiter-narrative:bootstrap-onboarding-readiness",
      "recruiter-narrative:room-os",
    ],
    demo_surface_ids: [
      "demo-surface:doctor-cli-report",
      "demo-surface:onboarding-report",
      "demo-surface:move-in-checklist",
      "demo-surface:fake-room-room-os",
    ],
    demo_flow_ids: ["demo-flow:onboarding-move-in"],
    evidence_ids: [
      "portfolio-report-evidence:demo-surfaces",
      "portfolio-report-evidence:demo-flows",
    ],
    governance_notes: [
      "No installer automation, shell execution, or real device onboarding is created.",
    ],
  }),
  section({
    section_id: "portfolio-report-section:future-expansion-summary",
    title: "Future expansion summary",
    category: "future_expansion",
    summary:
      "Future expansion covers GitNexus, Graphify, LLM Council, Obsidian, and security integrations as explicit future-only posture.",
    readiness_statement:
      "Expansion-era story is portfolio-ready as roadmap metadata, not current capability.",
    narrative_ids: [
      "recruiter-narrative:future-gitnexus",
      "recruiter-narrative:future-graphify",
      "recruiter-narrative:future-llm-council",
      "recruiter-narrative:future-obsidian",
      "recruiter-narrative:future-security-project-integration",
    ],
    demo_surface_ids: [
      "demo-surface:architecture-graph",
      "demo-surface:governance-boundary-visualizer",
      "demo-surface:telemetry-cockpit",
      "demo-surface:demo-mode-synthetic-dataset",
    ],
    demo_flow_ids: ["demo-flow:expansion-era"],
    evidence_ids: ["portfolio-report-evidence:future-expansion"],
    governance_notes: [
      "Future expansion remains metadata-only and not enabled.",
    ],
  }),
] satisfies readonly PortfolioReportSection[];

function copyReport(report: PortfolioReport): PortfolioReport {
  return PortfolioReportSchema.parse(JSON.parse(JSON.stringify(report)));
}

function copyEvidence(
  item: PortfolioReadinessEvidence,
): PortfolioReadinessEvidence {
  return PortfolioReadinessEvidenceSchema.parse(
    JSON.parse(JSON.stringify(item)),
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function buildFutureExpansionSummary(): PortfolioReportFutureExpansionSummary {
  return PortfolioReportFutureExpansionSummarySchema.parse({
    targets: [...PORTFOLIO_REPORT_FUTURE_EXPANSION_TARGETS],
    future_narrative_count: getFutureExpansionNarratives().length,
    future_flow_count: summarizeDemoFlows().future_expansion_flow_count,
    posture: "future_expansion_metadata_only_not_enabled",
    metadata_only: true,
  });
}

function assertReportReferencesKnownMetadata(report: PortfolioReport): void {
  const narrativeIds = new Set<RecruiterNarrativeId>(
    getRecruiterNarrativeRegistry().narratives.map(
      (narrative) => narrative.narrative_id,
    ),
  );
  const surfaceIds = new Set<DemoSurfaceId>(
    getDemoSurfaceRegistry().surfaces.map((surface) => surface.surface_id),
  );
  const flowIds = new Set<DemoFlowId>(
    getDemoFlowRegistry().flows.map((flowRecord) => flowRecord.flow_id),
  );

  for (const sectionRecord of report.sections) {
    for (const narrativeId of sectionRecord.narrative_ids) {
      if (!narrativeIds.has(narrativeId)) {
        throw new Error(`Unknown portfolio report narrative: ${narrativeId}`);
      }
    }

    for (const surfaceId of sectionRecord.demo_surface_ids) {
      if (!surfaceIds.has(surfaceId)) {
        throw new Error(`Unknown portfolio report demo surface: ${surfaceId}`);
      }
    }

    for (const flowId of sectionRecord.demo_flow_ids) {
      if (!flowIds.has(flowId)) {
        throw new Error(`Unknown portfolio report demo flow: ${flowId}`);
      }
    }
  }
}

function createPortfolioReport(): PortfolioReport {
  const report = PortfolioReportSchema.parse({
    report_version: PORTFOLIO_REPORT_VERSION,
    report_id: "phase-20d5-portfolio-report",
    phase: "20D.5",
    verdict: "portfolio_ready_metadata_only",
    sections: SECTIONS,
    evidence: EVIDENCE,
    source_summaries: {
      portfolio_contract: summarizePortfolioReadiness(),
      recruiter_narratives: summarizeRecruiterNarratives(),
      demo_surfaces: summarizeDemoSurfaces(),
      demo_flows: summarizeDemoFlows(),
    },
    future_expansion_summary: buildFutureExpansionSummary(),
    posture: POSTURE,
  });

  assertReportReferencesKnownMetadata(report);
  return report;
}

export const PORTFOLIO_REPORT = deepFreeze(createPortfolioReport());

export function buildPortfolioReport(): PortfolioReport {
  return copyReport(PORTFOLIO_REPORT);
}

export function getPortfolioReadinessEvidence(): readonly PortfolioReadinessEvidence[] {
  return EVIDENCE.map(copyEvidence);
}

export function summarizePortfolioReport(): PortfolioReportSummary {
  const report = PORTFOLIO_REPORT;

  return PortfolioReportSummarySchema.parse({
    report_version: PORTFOLIO_REPORT_VERSION,
    verdict: report.verdict,
    section_count: report.sections.length,
    evidence_count: report.evidence.length,
    narrative_reference_count: report.sections.reduce(
      (count, sectionRecord) => count + sectionRecord.narrative_ids.length,
      0,
    ),
    demo_surface_reference_count: report.sections.reduce(
      (count, sectionRecord) => count + sectionRecord.demo_surface_ids.length,
      0,
    ),
    demo_flow_reference_count: report.sections.reduce(
      (count, sectionRecord) => count + sectionRecord.demo_flow_ids.length,
      0,
    ),
    future_expansion_target_count:
      report.future_expansion_summary.targets.length,
    phase20d_portfolio_report_only: true,
    phase20d_capability_neutral: true,
    posture: POSTURE,
  });
}
