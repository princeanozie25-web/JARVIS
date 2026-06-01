import { z } from "zod";

import {
  PortfolioReadinessPostureSchema,
  type PortfolioReadinessPosture,
} from "./contracts";
import {
  getPortfolioReadinessAreas,
  getPortfolioReadinessContract,
  summarizePortfolioReadiness,
} from "./registry";
import {
  getFutureExpansionNarratives,
  getRecruiterNarrativeRegistry,
  summarizeRecruiterNarratives,
} from "./narratives";
import { getDemoSurfaceRegistry, summarizeDemoSurfaces } from "./demo-surfaces";
import { getDemoFlowRegistry, summarizeDemoFlows } from "./demo-flows";
import {
  buildPortfolioReport,
  summarizePortfolioReport,
} from "./portfolio-report";

export const PHASE_20D_CLOSEOUT_VERSION = "20D.6" as const;

export const PHASE_20D_MODULE_IDS = [
  "portfolio-readiness-contract",
  "recruiter-narrative-registry",
  "demo-surface-registry",
  "demo-flow-registry",
  "portfolio-report-generator",
] as const;

export const PHASE_20D_CLOSEOUT_CHECK_IDS = [
  "phase-20d:portfolio-contract-present",
  "phase-20d:recruiter-narrative-registry-present",
  "phase-20d:demo-surface-registry-present",
  "phase-20d:demo-flow-registry-present",
  "phase-20d:portfolio-report-generator-present",
  "phase-20d:recruiter-facing-narratives-represented",
  "phase-20d:demo-surfaces-represented",
  "phase-20d:demo-flows-represented",
  "phase-20d:portfolio-report-composes-existing-metadata",
  "phase-20d:future-expansion-posture-represented",
  "phase-20d:architecture-visibility-represented",
  "phase-20d:governance-visibility-represented",
  "phase-20d:command-center-demo-visibility-represented",
  "phase-20d:local-first-safety-narrative-represented",
  "phase-20d:no-presentation-generation",
  "phase-20d:no-ui-route",
  "phase-20d:no-demo-execution",
  "phase-20d:no-automation",
  "phase-20d:no-shell-process-execution",
  "phase-20d:no-filesystem-mutation",
  "phase-20d:no-network-provider-calls",
  "phase-20d:no-runtime-execution",
  "phase-20d:no-approval-bypass",
  "phase-20d:no-authority-surface",
  "phase-20d:no-source-material-exposure",
  "phase-20d:phase-20e-ready",
] as const;

export const PHASE_20D_FUTURE_EXPANSION_TARGETS = [
  "GitNexus",
  "Graphify",
  "LLM Council",
  "Obsidian",
  "security project integration",
] as const;

export type Phase20DModuleId = (typeof PHASE_20D_MODULE_IDS)[number];
export type Phase20DCloseoutCheckId =
  (typeof PHASE_20D_CLOSEOUT_CHECK_IDS)[number];
export type Phase20DFutureExpansionTarget =
  (typeof PHASE_20D_FUTURE_EXPANSION_TARGETS)[number];

export const Phase20DModuleIdSchema = z.enum(PHASE_20D_MODULE_IDS);
export const Phase20DCloseoutCheckIdSchema = z.enum(
  PHASE_20D_CLOSEOUT_CHECK_IDS,
);
export const Phase20DFutureExpansionTargetSchema = z.enum(
  PHASE_20D_FUTURE_EXPANSION_TARGETS,
);

export const Phase20DCloseoutCheckSchema = z.strictObject({
  check_id: Phase20DCloseoutCheckIdSchema,
  label: z.string().trim().min(1).max(180),
  status: z.literal("passed"),
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  notes: z.string().trim().min(1).max(420),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
});

export const Phase20DModulePresenceSchema = z.strictObject({
  portfolio_readiness_contract: z.literal(true),
  recruiter_narrative_registry: z.literal(true),
  demo_surface_registry: z.literal(true),
  demo_flow_registry: z.literal(true),
  portfolio_report_generator: z.literal(true),
});

export const Phase20DRepresentationSummarySchema = z.strictObject({
  recruiter_narratives_represented: z.literal(true),
  demo_surfaces_represented: z.literal(true),
  demo_flows_represented: z.literal(true),
  portfolio_report_composes_existing_metadata: z.literal(true),
  architecture_visibility_represented: z.literal(true),
  governance_visibility_represented: z.literal(true),
  command_center_demo_visibility_represented: z.literal(true),
  local_first_safety_narrative_represented: z.literal(true),
});

export const Phase20DFutureExpansionPostureSchema = z.strictObject({
  future_expansion_metadata_only_not_enabled: z.literal(true),
  targets: z.array(Phase20DFutureExpansionTargetSchema),
  report_target_label: z.literal("Security integrations"),
});

export const Phase20DSafetyPostureSummarySchema = z.strictObject({
  presentation_generation_absent: z.literal(true),
  ui_route_absent: z.literal(true),
  demo_execution_absent: z.literal(true),
  automation_absent: z.literal(true),
  shell_process_execution_absent: z.literal(true),
  filesystem_mutation_absent: z.literal(true),
  network_provider_calls_absent: z.literal(true),
  runtime_execution_absent: z.literal(true),
  approval_bypass_absent: z.literal(true),
  authority_surface_absent: z.literal(true),
  source_material_exposure_absent: z.literal(true),
  metadata_only: z.literal(true),
});

export const Phase20DCloseoutSummarySchema = z.strictObject({
  module_count: z.number().int().positive(),
  closeout_check_count: z.number().int().positive(),
  recruiter_narrative_count: z.number().int().positive(),
  demo_surface_count: z.number().int().positive(),
  demo_flow_count: z.number().int().positive(),
  portfolio_report_section_count: z.number().int().positive(),
  portfolio_report_evidence_count: z.number().int().positive(),
  future_expansion_target_count: z.number().int().positive(),
});

export const Phase20DCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(PHASE_20D_CLOSEOUT_VERSION),
  closeout_id: z.literal("phase-20d6-portfolio-readiness-closeout"),
  phase: z.literal("20D"),
  verdict: z.literal("passed"),
  phase_20d_complete: z.literal(true),
  phase_20e_ready: z.literal(true),
  module_ids: z.array(Phase20DModuleIdSchema),
  checks: z.array(Phase20DCloseoutCheckSchema),
  module_presence: Phase20DModulePresenceSchema,
  representation_summary: Phase20DRepresentationSummarySchema,
  future_expansion_posture: Phase20DFutureExpansionPostureSchema,
  safety_posture_summary: Phase20DSafetyPostureSummarySchema,
  summary: Phase20DCloseoutSummarySchema,
  next_phase_readiness_statement: z.string().trim().min(1).max(420),
  posture: PortfolioReadinessPostureSchema,
});

export type Phase20DCloseoutCheck = z.infer<typeof Phase20DCloseoutCheckSchema>;
export type Phase20DCloseoutReport = z.infer<
  typeof Phase20DCloseoutReportSchema
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

function closeoutCheck(
  checkId: Phase20DCloseoutCheckId,
  label: string,
  evidenceIds: readonly string[],
  notes: string,
): Phase20DCloseoutCheck {
  return Phase20DCloseoutCheckSchema.parse({
    check_id: checkId,
    label,
    status: "passed",
    evidence_ids: [...evidenceIds],
    notes,
    metadata_only: true,
    read_only: true,
    deterministic: true,
  });
}

function copyReport(report: Phase20DCloseoutReport): Phase20DCloseoutReport {
  return Phase20DCloseoutReportSchema.parse(JSON.parse(JSON.stringify(report)));
}

function assertPortfolioPosture(
  postures: readonly PortfolioReadinessPosture[],
): void {
  const intact = postures.every(
    (posture) =>
      posture.metadata_only &&
      posture.read_only &&
      posture.deterministic &&
      !posture.presentation_generation_enabled &&
      !posture.demo_execution_enabled &&
      !posture.ui_route_created &&
      !posture.automation_enabled &&
      !posture.shell_execution_enabled &&
      !posture.process_spawn_enabled &&
      !posture.filesystem_mutation_enabled &&
      !posture.network_call_enabled &&
      !posture.provider_call_enabled &&
      !posture.runtime_execution_enabled &&
      !posture.approval_bypass_created &&
      !posture.authority_surface_created &&
      !posture.capability_created &&
      !posture.source_material_exposure_enabled,
  );

  if (!intact) {
    throw new Error(
      "Phase 20D closeout detected non-neutral portfolio posture",
    );
  }
}

export function buildPhase20DCloseoutReport(): Phase20DCloseoutReport {
  const contract = getPortfolioReadinessContract();
  const contractSummary = summarizePortfolioReadiness();
  const portfolioAreas = getPortfolioReadinessAreas();
  const narrativeRegistry = getRecruiterNarrativeRegistry();
  const narrativeSummary = summarizeRecruiterNarratives();
  const futureNarratives = getFutureExpansionNarratives();
  const demoSurfaceRegistry = getDemoSurfaceRegistry();
  const demoSurfaceSummary = summarizeDemoSurfaces();
  const demoFlowRegistry = getDemoFlowRegistry();
  const demoFlowSummary = summarizeDemoFlows();
  const portfolioReport = buildPortfolioReport();
  const portfolioReportSummary = summarizePortfolioReport();

  const narrativeIds = new Set(
    narrativeRegistry.narratives.map((narrative) => narrative.narrative_id),
  );
  const surfaceIds = new Set(
    demoSurfaceRegistry.surfaces.map((surface) => surface.surface_id),
  );
  const flowIds = new Set(demoFlowRegistry.flows.map((flow) => flow.flow_id));
  const areaIds = new Set(portfolioAreas.map((area) => area.area_id));
  const reportSectionIds = new Set(
    portfolioReport.sections.map((section) => section.section_id),
  );
  const futureExpansionTargets = new Set(
    futureNarratives.flatMap((narrative) => narrative.future_expansion_targets),
  );

  const recruiterNarrativesRepresented =
    narrativeSummary.registry_version === "20D.2" &&
    narrativeSummary.narrative_count > 0 &&
    narrativeIds.has("recruiter-narrative:portfolio-value");
  const demoSurfacesRepresented =
    demoSurfaceSummary.registry_version === "20D.3" &&
    demoSurfaceSummary.surface_count > 0 &&
    surfaceIds.has("demo-surface:demo-mode-synthetic-dataset");
  const demoFlowsRepresented =
    demoFlowSummary.registry_version === "20D.4" &&
    demoFlowSummary.flow_count > 0 &&
    flowIds.has("demo-flow:sixty-second-recruiter");
  const portfolioReportComposesExistingMetadata =
    portfolioReport.report_version === "20D.5" &&
    portfolioReport.source_summaries.portfolio_contract.contract_version ===
      "20D.1" &&
    portfolioReport.source_summaries.recruiter_narratives.registry_version ===
      "20D.2" &&
    portfolioReport.source_summaries.demo_surfaces.registry_version ===
      "20D.3" &&
    portfolioReport.source_summaries.demo_flows.registry_version === "20D.4";
  const futureExpansionRepresented =
    PHASE_20D_FUTURE_EXPANSION_TARGETS.every((target) =>
      futureExpansionTargets.has(target),
    ) &&
    portfolioReport.future_expansion_summary.targets.includes(
      "Security integrations",
    ) &&
    flowIds.has("demo-flow:expansion-era");
  const architectureVisibilityRepresented =
    areaIds.has("portfolio-area:architecture-visibility") &&
    surfaceIds.has("demo-surface:architecture-graph") &&
    reportSectionIds.has(
      "portfolio-report-section:architecture-visibility-summary",
    );
  const governanceVisibilityRepresented =
    areaIds.has("portfolio-area:governance-visibility") &&
    surfaceIds.has("demo-surface:governance-boundary-visualizer") &&
    reportSectionIds.has(
      "portfolio-report-section:governance-visibility-summary",
    );
  const commandCenterDemoVisibilityRepresented =
    areaIds.has("portfolio-area:command-center-visibility") &&
    narrativeIds.has("recruiter-narrative:command-center-ui") &&
    surfaceIds.has("demo-surface:rest-orb") &&
    reportSectionIds.has("portfolio-report-section:demo-readiness-summary");
  const localFirstSafetyNarrativeRepresented =
    narrativeIds.has("recruiter-narrative:local-first-ai-operating-system") &&
    narrativeIds.has("recruiter-narrative:governance-first-architecture") &&
    areaIds.has("portfolio-area:governance-visibility") &&
    reportSectionIds.has("portfolio-report-section:local-first-summary");

  assertPortfolioPosture([
    contract.posture,
    contractSummary.posture,
    narrativeRegistry.posture,
    narrativeSummary.posture,
    demoSurfaceRegistry.posture,
    demoSurfaceSummary.posture,
    demoFlowRegistry.posture,
    demoFlowSummary.posture,
    portfolioReport.posture,
    portfolioReportSummary.posture,
    ...contract.portfolio_areas.map((area) => area.posture),
    ...contract.recruiter_narratives.map((narrative) => narrative.posture),
    ...contract.demo_surfaces.map((surface) => surface.posture),
    ...narrativeRegistry.narratives.map((narrative) => narrative.posture),
    ...demoSurfaceRegistry.surfaces.map((surface) => surface.posture),
    ...demoFlowRegistry.flows.map((flow) => flow.posture),
  ]);

  const checks = [
    closeoutCheck(
      "phase-20d:portfolio-contract-present",
      "Portfolio readiness contract exists",
      [contract.contract_id],
      "Phase 20D.1 portfolio readiness contract is present.",
    ),
    closeoutCheck(
      "phase-20d:recruiter-narrative-registry-present",
      "Recruiter narrative registry exists",
      [narrativeRegistry.registry_id],
      "Phase 20D.2 recruiter narrative registry is present.",
    ),
    closeoutCheck(
      "phase-20d:demo-surface-registry-present",
      "Demo surface registry exists",
      [demoSurfaceRegistry.registry_id],
      "Phase 20D.3 demo surface registry is present.",
    ),
    closeoutCheck(
      "phase-20d:demo-flow-registry-present",
      "Demo flow registry exists",
      [demoFlowRegistry.registry_id],
      "Phase 20D.4 demo flow registry is present.",
    ),
    closeoutCheck(
      "phase-20d:portfolio-report-generator-present",
      "Portfolio report generator exists",
      [portfolioReport.report_id],
      "Phase 20D.5 portfolio report generator is present.",
    ),
    closeoutCheck(
      "phase-20d:recruiter-facing-narratives-represented",
      "Recruiter-facing narratives are represented",
      ["recruiter-narrative:portfolio-value"],
      "Recruiter-facing portfolio value and supporting narratives are represented.",
    ),
    closeoutCheck(
      "phase-20d:demo-surfaces-represented",
      "Demo surfaces are represented",
      ["demo-surface:demo-mode-synthetic-dataset"],
      "Demo surfaces are present as metadata-only registry records.",
    ),
    closeoutCheck(
      "phase-20d:demo-flows-represented",
      "Demo flows are represented",
      ["demo-flow:sixty-second-recruiter"],
      "Demo flows are present as ordered metadata-only records.",
    ),
    closeoutCheck(
      "phase-20d:portfolio-report-composes-existing-metadata",
      "Portfolio report composes existing metadata",
      [portfolioReport.report_id],
      "The report source summaries point back to Phase 20D.1 through Phase 20D.4.",
    ),
    closeoutCheck(
      "phase-20d:future-expansion-posture-represented",
      "Future expansion posture is represented",
      [...PHASE_20D_FUTURE_EXPANSION_TARGETS],
      "GitNexus, Graphify, LLM Council, Obsidian, and security project integration remain future-only metadata.",
    ),
    closeoutCheck(
      "phase-20d:architecture-visibility-represented",
      "Architecture visibility is represented",
      [
        "portfolio-area:architecture-visibility",
        "demo-surface:architecture-graph",
      ],
      "Architecture visibility appears in the contract, demo surfaces, and portfolio report.",
    ),
    closeoutCheck(
      "phase-20d:governance-visibility-represented",
      "Governance visibility is represented",
      [
        "portfolio-area:governance-visibility",
        "demo-surface:governance-boundary-visualizer",
      ],
      "Governance visibility appears in the contract, demo surfaces, and portfolio report.",
    ),
    closeoutCheck(
      "phase-20d:command-center-demo-visibility-represented",
      "Command Center and demo visibility are represented",
      ["portfolio-area:command-center-visibility", "demo-surface:rest-orb"],
      "Command Center and demo readiness visibility are represented without a new route.",
    ),
    closeoutCheck(
      "phase-20d:local-first-safety-narrative-represented",
      "Local-first and safety narrative is represented",
      [
        "recruiter-narrative:local-first-ai-operating-system",
        "recruiter-narrative:governance-first-architecture",
      ],
      "Local-first and safety narratives are represented in existing metadata.",
    ),
    closeoutCheck(
      "phase-20d:no-presentation-generation",
      "No presentation generation exists",
      ["posture:presentation-generation=false"],
      "Phase 20D posture keeps presentation generation disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-ui-route",
      "No UI route exists",
      ["posture:ui-route=false"],
      "Phase 20D posture keeps UI route creation disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-demo-execution",
      "No demo execution exists",
      ["posture:demo-execution=false"],
      "Phase 20D posture keeps demo execution disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-automation",
      "No automation exists",
      ["posture:automation=false"],
      "Phase 20D posture keeps automation disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-shell-process-execution",
      "No shell or process execution exists",
      ["posture:shell=false", "posture:process=false"],
      "Phase 20D posture keeps shell and process execution disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-filesystem-mutation",
      "No filesystem mutation exists",
      ["posture:filesystem-mutation=false"],
      "Phase 20D posture keeps runtime filesystem mutation disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-network-provider-calls",
      "No network or provider calls exist",
      ["posture:network=false", "posture:provider=false"],
      "Phase 20D posture keeps network and provider calls disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-runtime-execution",
      "No runtime execution exists",
      ["posture:runtime-execution=false"],
      "Phase 20D posture keeps runtime execution disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-approval-bypass",
      "No approval bypass exists",
      ["posture:approval-bypass=false"],
      "Phase 20D posture keeps approval bypass creation disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-authority-surface",
      "No authority surface exists",
      ["posture:authority-surface=false"],
      "Phase 20D posture keeps new authority surface creation disabled.",
    ),
    closeoutCheck(
      "phase-20d:no-source-material-exposure",
      "No raw payload or source-material exposure exists",
      ["posture:source-material-exposure=false", "posture:raw-payload=false"],
      "Phase 20D posture keeps raw payload and source-material exposure disabled.",
    ),
    closeoutCheck(
      "phase-20d:phase-20e-ready",
      "Phase 20E ready",
      ["phase-20e:cross-phase-audit-sweep-ready"],
      "Phase 20D is complete and ready for the Phase 20E cross-phase audit sweep.",
    ),
  ];

  if (
    !recruiterNarrativesRepresented ||
    !demoSurfacesRepresented ||
    !demoFlowsRepresented ||
    !portfolioReportComposesExistingMetadata ||
    !futureExpansionRepresented ||
    !architectureVisibilityRepresented ||
    !governanceVisibilityRepresented ||
    !commandCenterDemoVisibilityRepresented ||
    !localFirstSafetyNarrativeRepresented
  ) {
    throw new Error("Phase 20D closeout representation checks failed");
  }

  return copyReport(
    Phase20DCloseoutReportSchema.parse({
      closeout_version: PHASE_20D_CLOSEOUT_VERSION,
      closeout_id: "phase-20d6-portfolio-readiness-closeout",
      phase: "20D",
      verdict: "passed",
      phase_20d_complete: true,
      phase_20e_ready: true,
      module_ids: [...PHASE_20D_MODULE_IDS],
      checks,
      module_presence: {
        portfolio_readiness_contract: true,
        recruiter_narrative_registry: true,
        demo_surface_registry: true,
        demo_flow_registry: true,
        portfolio_report_generator: true,
      },
      representation_summary: {
        recruiter_narratives_represented: true,
        demo_surfaces_represented: true,
        demo_flows_represented: true,
        portfolio_report_composes_existing_metadata: true,
        architecture_visibility_represented: true,
        governance_visibility_represented: true,
        command_center_demo_visibility_represented: true,
        local_first_safety_narrative_represented: true,
      },
      future_expansion_posture: {
        future_expansion_metadata_only_not_enabled: true,
        targets: [...PHASE_20D_FUTURE_EXPANSION_TARGETS],
        report_target_label: "Security integrations",
      },
      safety_posture_summary: {
        presentation_generation_absent: true,
        ui_route_absent: true,
        demo_execution_absent: true,
        automation_absent: true,
        shell_process_execution_absent: true,
        filesystem_mutation_absent: true,
        network_provider_calls_absent: true,
        runtime_execution_absent: true,
        approval_bypass_absent: true,
        authority_surface_absent: true,
        source_material_exposure_absent: true,
        metadata_only: true,
      },
      summary: {
        module_count: PHASE_20D_MODULE_IDS.length,
        closeout_check_count: PHASE_20D_CLOSEOUT_CHECK_IDS.length,
        recruiter_narrative_count: narrativeSummary.narrative_count,
        demo_surface_count: demoSurfaceSummary.surface_count,
        demo_flow_count: demoFlowSummary.flow_count,
        portfolio_report_section_count: portfolioReportSummary.section_count,
        portfolio_report_evidence_count: portfolioReportSummary.evidence_count,
        future_expansion_target_count:
          PHASE_20D_FUTURE_EXPANSION_TARGETS.length,
      },
      next_phase_readiness_statement:
        "Phase 20D portfolio/demo readiness is complete and ready for Phase 20E cross-phase audit sweep.",
      posture: POSTURE,
    }),
  );
}
