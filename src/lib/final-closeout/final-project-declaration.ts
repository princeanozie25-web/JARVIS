import { z } from "zod";

import { buildMasterRoadmapCloseoutReport } from "./master-roadmap-closeout";

export const FINAL_PROJECT_DECLARATION_VERSION = "20H.3" as const;
export const FINAL_PROJECT_DECLARATION_VERSION_MARKER =
  "phase-20h3-final-project-declaration-v1" as const;
export const FINAL_PROJECT_DECLARATION_TOTAL_TEST_COUNT = 4297 as const;

export const FINAL_PROJECT_ROADMAP_STATUSES = ["phase_1_20_complete"] as const;

export const FINAL_PROJECT_COMPLETION_VERDICTS = ["pass"] as const;

export const FINAL_PROJECT_COMPLETED_SUBSYSTEM_IDS = [
  "complete:core-jarvis-os",
  "complete:governance",
  "complete:approval-system",
  "complete:room-os",
  "complete:voice",
  "complete:vision",
  "complete:architecture-graph",
  "complete:telemetry-cockpit",
  "complete:governance-visualizer",
  "complete:cai-governed-red-team-framework",
] as const;

export const FINAL_PROJECT_FUTURE_EXPANSION_IDS = [
  "future:obsidian-integration",
  "future:graphify-overlay",
  "future:llm-council",
  "future:hitnexus-integration",
  "future:llm-wiki",
  "future:future-research-systems",
  "future:real-cai-execution-enablement",
] as const;

export type FinalProjectRoadmapStatus =
  (typeof FINAL_PROJECT_ROADMAP_STATUSES)[number];
export type FinalProjectCompletionVerdict =
  (typeof FINAL_PROJECT_COMPLETION_VERDICTS)[number];
export type FinalProjectCompletedSubsystemId =
  (typeof FINAL_PROJECT_COMPLETED_SUBSYSTEM_IDS)[number];
export type FinalProjectFutureExpansionId =
  (typeof FINAL_PROJECT_FUTURE_EXPANSION_IDS)[number];

export const FinalProjectRoadmapStatusSchema = z.enum(
  FINAL_PROJECT_ROADMAP_STATUSES,
);
export const FinalProjectCompletionVerdictSchema = z.enum(
  FINAL_PROJECT_COMPLETION_VERDICTS,
);
export const FinalProjectCompletedSubsystemIdSchema = z.enum(
  FINAL_PROJECT_COMPLETED_SUBSYSTEM_IDS,
);
export const FinalProjectFutureExpansionIdSchema = z.enum(
  FINAL_PROJECT_FUTURE_EXPANSION_IDS,
);

export const FinalProjectDeclarationPostureSchema = z.strictObject({
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  runtime_execution_enabled: z.literal(false),
  packaging_execution_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  database_inspection_enabled: z.literal(false),
  ui_route_created: z.literal(false),
  authority_creation_enabled: z.literal(false),
  approval_creation_enabled: z.literal(false),
  capability_expansion_enabled: z.literal(false),
  source_material_exposure_enabled: z.literal(false),
  roadmap_completion_declared: z.literal(true),
});

export const FinalProjectCompletedSubsystemSchema = z.strictObject({
  subsystem_id: FinalProjectCompletedSubsystemIdSchema,
  title: z.string().trim().min(1).max(180),
  completion_statement: z.string().trim().min(1).max(560),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  posture: FinalProjectDeclarationPostureSchema,
});

export const FinalProjectFutureExpansionItemSchema = z.strictObject({
  future_expansion_id: FinalProjectFutureExpansionIdSchema,
  title: z.string().trim().min(1).max(180),
  future_statement: z.string().trim().min(1).max(560),
  not_complete_in_roadmap: z.literal(true),
  shipped_capability: z.literal(false),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  posture: FinalProjectDeclarationPostureSchema,
});

export const FinalProjectDeclarationEvidenceSummarySchema = z.strictObject({
  final_project_readiness_audit: z.string().trim().min(1).max(760),
  master_roadmap_closeout: z.string().trim().min(1).max(760),
  final_hardening_closeout: z.string().trim().min(1).max(760),
  documentation_closeout: z.string().trim().min(1).max(760),
  system_completion_audit: z.string().trim().min(1).max(760),
  complete_vs_future_boundary: z.string().trim().min(1).max(760),
});

export const FinalProjectDeclarationSummarySchema = z.strictObject({
  declaration_version: z.literal(FINAL_PROJECT_DECLARATION_VERSION),
  roadmap_status: FinalProjectRoadmapStatusSchema,
  completion_verdict: FinalProjectCompletionVerdictSchema,
  completed_phase_count: z.number().int().positive(),
  completed_subsystem_count: z.number().int().positive(),
  future_expansion_count: z.number().int().positive(),
  total_test_count: z.literal(FINAL_PROJECT_DECLARATION_TOTAL_TEST_COUNT),
  blocking_issue_count: z.literal(0),
  source_material_exposure_count: z.literal(0),
  capability_expansion_count: z.literal(0),
  final_hardening_complete: z.literal(true),
  documentation_complete: z.literal(true),
  final_readiness_complete: z.literal(true),
  fortress_layer_complete: z.literal(true),
  core_jarvis_os_complete: z.literal(true),
  no_complete_future_ambiguity: z.literal(true),
  posture: FinalProjectDeclarationPostureSchema,
});

export const FinalProjectDeclarationReportSchema = z.strictObject({
  declaration_version: z.literal(FINAL_PROJECT_DECLARATION_VERSION),
  report_id: z.literal("phase-20h3-final-project-declaration"),
  phase: z.literal("20H.3"),
  final_declaration_timestamp_surrogate: z.literal(
    FINAL_PROJECT_DECLARATION_VERSION_MARKER,
  ),
  roadmap_status: FinalProjectRoadmapStatusSchema,
  completion_verdict: FinalProjectCompletionVerdictSchema,
  completed_phase_count: z.number().int().positive(),
  completed_subsystem_count: z.number().int().positive(),
  total_test_count: z.literal(FINAL_PROJECT_DECLARATION_TOTAL_TEST_COUNT),
  completed_subsystems: z.array(FinalProjectCompletedSubsystemSchema),
  future_expansion_items: z.array(FinalProjectFutureExpansionItemSchema),
  evidence_summary: FinalProjectDeclarationEvidenceSummarySchema,
  future_expansion_summary: z.string().trim().min(1).max(860),
  final_declaration_statement: z.string().trim().min(1).max(1000),
  summary: FinalProjectDeclarationSummarySchema,
  posture: FinalProjectDeclarationPostureSchema,
});

export type FinalProjectDeclarationPosture = z.infer<
  typeof FinalProjectDeclarationPostureSchema
>;
export type FinalProjectCompletedSubsystem = z.infer<
  typeof FinalProjectCompletedSubsystemSchema
>;
export type FinalProjectFutureExpansionItem = z.infer<
  typeof FinalProjectFutureExpansionItemSchema
>;
export type FinalProjectDeclarationEvidenceSummary = z.infer<
  typeof FinalProjectDeclarationEvidenceSummarySchema
>;
export type FinalProjectDeclarationSummary = z.infer<
  typeof FinalProjectDeclarationSummarySchema
>;
export type FinalProjectDeclarationReport = z.infer<
  typeof FinalProjectDeclarationReportSchema
>;

type CompletedSubsystemFocus = {
  subsystem_id: FinalProjectCompletedSubsystemId;
  title: string;
  completion_statement: string;
  evidence_ids: readonly string[];
};

type FutureExpansionFocus = {
  future_expansion_id: FinalProjectFutureExpansionId;
  title: string;
  future_statement: string;
  evidence_ids: readonly string[];
};

const POSTURE: FinalProjectDeclarationPosture = {
  metadata_only: true,
  read_only: true,
  deterministic: true,
  runtime_execution_enabled: false,
  packaging_execution_enabled: false,
  provider_call_enabled: false,
  network_call_enabled: false,
  filesystem_inspection_enabled: false,
  database_inspection_enabled: false,
  ui_route_created: false,
  authority_creation_enabled: false,
  approval_creation_enabled: false,
  capability_expansion_enabled: false,
  source_material_exposure_enabled: false,
  roadmap_completion_declared: true,
};

const COMPLETED_SUBSYSTEMS: readonly CompletedSubsystemFocus[] = [
  {
    subsystem_id: "complete:core-jarvis-os",
    title: "Core JARVIS OS",
    completion_statement:
      "The roadmap-defined core local-first AI operating system is complete.",
    evidence_ids: [
      "phase-20f:system-completion-audit",
      "phase-20h2-master-roadmap-closeout-report",
    ],
  },
  {
    subsystem_id: "complete:governance",
    title: "Governance",
    completion_statement:
      "Governance invariants remain local-first, approval-gated, replay-safe, redaction-aware, and metadata-only where required.",
    evidence_ids: [
      "phase-20f:governance-integrity-audit",
      "phase-20h1-final-project-readiness-audit",
    ],
  },
  {
    subsystem_id: "complete:approval-system",
    title: "Approval system",
    completion_statement:
      "The approval-gated execution layer is the only represented side-effect path.",
    evidence_ids: [
      "phase-18:approval-gated-execution-layer",
      "phase-20f:authority-surface-regression-audit",
    ],
  },
  {
    subsystem_id: "complete:room-os",
    title: "Room OS",
    completion_statement:
      "Room OS and room adapter posture are complete within governed and approval-bounded scope.",
    evidence_ids: [
      "phase-10:room-os-foundation",
      "phase-16:room-adapter-runtime",
    ],
  },
  {
    subsystem_id: "complete:voice",
    title: "Voice",
    completion_statement:
      "Voice runtime contracts and governance are complete while wake word, always-listening, and voice-only approval remain disabled.",
    evidence_ids: [
      "phase-14:voice-runtime",
      "phase-20a:disabled-feature-matrix",
    ],
  },
  {
    subsystem_id: "complete:vision",
    title: "Vision",
    completion_statement:
      "Vision runtime contracts and governance are complete while hidden/background capture and vision-triggered actions remain disabled.",
    evidence_ids: [
      "phase-15:vision-runtime",
      "phase-20f:governance-integrity-audit",
    ],
  },
  {
    subsystem_id: "complete:architecture-graph",
    title: "Architecture Graph",
    completion_statement:
      "Architecture graph visibility is complete as a read-only explanatory surface, not an execution driver.",
    evidence_ids: [
      "phase-19:architecture-graph",
      "phase-20f:demo-portfolio-readiness-audit",
    ],
  },
  {
    subsystem_id: "complete:telemetry-cockpit",
    title: "Telemetry Cockpit",
    completion_statement:
      "Telemetry cockpit visibility is complete as read-only, redacted, and source-material-safe observability.",
    evidence_ids: [
      "phase-19:telemetry-cockpit",
      "phase-20h1-final-project-readiness-audit",
    ],
  },
  {
    subsystem_id: "complete:governance-visualizer",
    title: "Governance Visualizer",
    completion_statement:
      "Governance visualizer posture is complete as read-only boundary explanation.",
    evidence_ids: [
      "phase-19:governance-boundary-visualizer",
      "phase-20f:demo-portfolio-readiness-audit",
    ],
  },
  {
    subsystem_id: "complete:cai-governed-red-team-framework",
    title: "CAI-governed Red-Team Framework",
    completion_statement:
      "CAI red-team posture is complete as governed, sandboxed, whitelisted, and non-executing.",
    evidence_ids: [
      "phase-19:cai-governed-red-team-layer",
      "phase-20h1-final-project-readiness-audit",
    ],
  },
] as const;

const FUTURE_EXPANSION_ITEMS: readonly FutureExpansionFocus[] = [
  {
    future_expansion_id: "future:obsidian-integration",
    title: "Obsidian integration",
    future_statement:
      "Obsidian integration remains future expansion and is not part of the completed Phase 1-20 roadmap.",
    evidence_ids: ["phase-20f:system-completion-audit"],
  },
  {
    future_expansion_id: "future:graphify-overlay",
    title: "Graphify overlay",
    future_statement:
      "Graphify overlay remains future expansion and is not shipped as current graph capability.",
    evidence_ids: ["phase-20f:system-completion-audit"],
  },
  {
    future_expansion_id: "future:llm-council",
    title: "LLM Council",
    future_statement:
      "LLM Council remains future expansion and is not represented as current multi-agent runtime capability.",
    evidence_ids: ["phase-20d:portfolio-readiness-closeout"],
  },
  {
    future_expansion_id: "future:hitnexus-integration",
    title: "HITNEXUS integration",
    future_statement:
      "HITNEXUS integration remains future expansion and is not part of the completed core OS.",
    evidence_ids: ["phase-20f:system-completion-audit"],
  },
  {
    future_expansion_id: "future:llm-wiki",
    title: "LLM Wiki",
    future_statement:
      "LLM Wiki remains future expansion and is not shipped as current knowledge-system capability.",
    evidence_ids: ["phase-20f:system-completion-audit"],
  },
  {
    future_expansion_id: "future:future-research-systems",
    title: "Future research systems",
    future_statement:
      "Future research systems remain future expansion and are not included in the completion declaration.",
    evidence_ids: ["phase-20h2-master-roadmap-closeout-report"],
  },
  {
    future_expansion_id: "future:real-cai-execution-enablement",
    title: "Real CAI execution enablement",
    future_statement:
      "Real CAI execution enablement remains future work; the completed roadmap includes governed CAI readiness, not CAI execution.",
    evidence_ids: [
      "phase-20h1-final-project-readiness-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
  },
] as const;

function buildCompletedSubsystem(
  focus: CompletedSubsystemFocus,
): FinalProjectCompletedSubsystem {
  return FinalProjectCompletedSubsystemSchema.parse({
    subsystem_id: focus.subsystem_id,
    title: focus.title,
    completion_statement: focus.completion_statement,
    evidence_ids: [...focus.evidence_ids],
    posture: POSTURE,
  });
}

function buildFutureExpansionItem(
  focus: FutureExpansionFocus,
): FinalProjectFutureExpansionItem {
  return FinalProjectFutureExpansionItemSchema.parse({
    future_expansion_id: focus.future_expansion_id,
    title: focus.title,
    future_statement: focus.future_statement,
    not_complete_in_roadmap: true,
    shipped_capability: false,
    evidence_ids: [...focus.evidence_ids],
    posture: POSTURE,
  });
}

export function buildFinalProjectDeclarationReport(): FinalProjectDeclarationReport {
  const masterRoadmapCloseout = buildMasterRoadmapCloseoutReport();
  const completedSubsystems = COMPLETED_SUBSYSTEMS.map(buildCompletedSubsystem);
  const futureExpansionItems = FUTURE_EXPANSION_ITEMS.map(
    buildFutureExpansionItem,
  );

  return FinalProjectDeclarationReportSchema.parse({
    declaration_version: FINAL_PROJECT_DECLARATION_VERSION,
    report_id: "phase-20h3-final-project-declaration",
    phase: "20H.3",
    final_declaration_timestamp_surrogate:
      FINAL_PROJECT_DECLARATION_VERSION_MARKER,
    roadmap_status: "phase_1_20_complete",
    completion_verdict: "pass",
    completed_phase_count: masterRoadmapCloseout.completed_phase_count,
    completed_subsystem_count: completedSubsystems.length,
    total_test_count: FINAL_PROJECT_DECLARATION_TOTAL_TEST_COUNT,
    completed_subsystems: completedSubsystems,
    future_expansion_items: futureExpansionItems,
    evidence_summary: {
      final_project_readiness_audit:
        "Phase 20H.1 proves final project readiness with notes and no blockers.",
      master_roadmap_closeout:
        "Phase 20H.2 proves the master roadmap closeout is ready for final declaration.",
      final_hardening_closeout:
        "Phase 20F final hardening is complete across recovery, authority, governance, demo/portfolio, and system completion posture.",
      documentation_closeout:
        "Phase 20G final documentation is complete enough for setup, runbook, handoff, packaging guidance, and portfolio review.",
      system_completion_audit:
        "Phase 20F system completion audit affirms the roadmap-defined core JARVIS OS is complete.",
      complete_vs_future_boundary:
        "Completed core subsystems are explicitly separated from Obsidian, Graphify, LLM Council, HITNEXUS, LLM Wiki, future research systems, and real CAI execution enablement.",
    },
    future_expansion_summary:
      "Future expansion remains outside the completed Phase 1-20 roadmap: Obsidian integration, Graphify overlay, LLM Council, HITNEXUS integration, LLM Wiki, future research systems, and real CAI execution enablement are not complete and are not shipped capabilities.",
    final_declaration_statement:
      "The Phase 1-20 JARVIS Operationalization Roadmap is complete. Core JARVIS OS, governance, approval system, Room OS, voice, vision, Architecture Graph, Telemetry Cockpit, Governance Visualizer, CAI-governed Red-Team Framework, fortress layer, final hardening, final documentation, and final readiness are complete. Future expansion items remain explicitly not complete and outside this declaration.",
    summary: {
      declaration_version: FINAL_PROJECT_DECLARATION_VERSION,
      roadmap_status: "phase_1_20_complete",
      completion_verdict: "pass",
      completed_phase_count: masterRoadmapCloseout.completed_phase_count,
      completed_subsystem_count: completedSubsystems.length,
      future_expansion_count: futureExpansionItems.length,
      total_test_count: FINAL_PROJECT_DECLARATION_TOTAL_TEST_COUNT,
      blocking_issue_count: 0,
      source_material_exposure_count: 0,
      capability_expansion_count: 0,
      final_hardening_complete: true,
      documentation_complete: true,
      final_readiness_complete: true,
      fortress_layer_complete: true,
      core_jarvis_os_complete: true,
      no_complete_future_ambiguity: true,
      posture: POSTURE,
    },
    posture: POSTURE,
  });
}
