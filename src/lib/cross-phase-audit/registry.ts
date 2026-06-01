import {
  AUDIT_DIMENSION_IDS,
  AUDIT_EXPECTATION_IDS,
  CROSS_PHASE_AUDIT_CONTRACT_VERSION,
  AuditDimensionSchema,
  AuditExpectationSchema,
  AuditSurfaceSchema,
  CrossPhaseAuditContractSchema,
  CrossPhaseAuditSummarySchema,
  type AuditDimension,
  type AuditDimensionId,
  type AuditExpectation,
  type AuditExpectationId,
  type AuditPhaseId,
  type AuditSeverity,
  type AuditSurface,
  type AuditSurfaceId,
  type CrossPhaseAuditContract,
  type CrossPhaseAuditPosture,
  type CrossPhaseAuditSummary,
} from "./contracts";
import { buildPhase20DCloseoutReport } from "../portfolio-readiness";

const POSTURE: CrossPhaseAuditPosture = {
  contract_only: true,
  metadata_only: true,
  read_only: true,
  deterministic: true,
  audit_execution_enabled: false,
  filesystem_inspection_enabled: false,
  runtime_execution_enabled: false,
  provider_call_enabled: false,
  network_call_enabled: false,
  ui_route_created: false,
  approval_bypass_created: false,
  authority_surface_created: false,
  capability_created: false,
  source_material_exposure_enabled: false,
};

function expectation(
  expectationId: AuditExpectationId,
  dimensionId: AuditDimensionId,
  severity: AuditSeverity,
  expectationText: string,
  evidenceGuidance: readonly string[],
): AuditExpectation {
  return AuditExpectationSchema.parse({
    expectation_id: expectationId,
    dimension_id: dimensionId,
    severity,
    expectation: expectationText,
    evidence_guidance: [...evidenceGuidance],
    future_audit_only: true,
    posture: POSTURE,
  });
}

function dimension(
  dimensionId: AuditDimensionId,
  label: string,
  severity: AuditSeverity,
  auditGoal: string,
  expectationId: AuditExpectationId,
): AuditDimension {
  return AuditDimensionSchema.parse({
    dimension_id: dimensionId,
    label,
    audit_goal: auditGoal,
    severity,
    expectation_id: expectationId,
    posture: POSTURE,
  });
}

function surface(
  surfaceId: AuditSurfaceId,
  phaseId: AuditPhaseId,
  phaseLabel: string,
  auditScope: string,
  evidenceIds: readonly string[],
  closeoutSource: string,
  dimensionIds: readonly AuditDimensionId[] = AUDIT_DIMENSION_IDS,
): AuditSurface {
  return AuditSurfaceSchema.parse({
    surface_id: surfaceId,
    phase_id: phaseId,
    phase_label: phaseLabel,
    audit_scope: auditScope,
    dimension_ids: [...dimensionIds],
    expectation_ids: [...AUDIT_EXPECTATION_IDS],
    evidence_ids: [...evidenceIds],
    closeout_source: closeoutSource,
    posture: POSTURE,
  });
}

const DIMENSIONS = [
  dimension(
    "audit-dimension:governance",
    "Governance",
    "critical",
    "Verify each phase preserves governance-first architecture and closeout evidence.",
    "audit-expectation:governance",
  ),
  dimension(
    "audit-dimension:authority-surfaces",
    "Authority surfaces",
    "critical",
    "Verify authority-bearing and authority-adjacent surfaces remain inventoried and non-expanded.",
    "audit-expectation:authority-surfaces",
  ),
  dimension(
    "audit-dimension:disabled-features",
    "Disabled features",
    "critical",
    "Verify intentionally disabled risky features remain disabled across the final system.",
    "audit-expectation:disabled-features",
  ),
  dimension(
    "audit-dimension:approval-boundaries",
    "Approval boundaries",
    "critical",
    "Verify side-effect paths remain approval-gated and no bypass posture appears.",
    "audit-expectation:approval-boundaries",
  ),
  dimension(
    "audit-dimension:local-first-posture",
    "Local-first posture",
    "high",
    "Verify default local-first behavior and cloud-gated posture remain visible.",
    "audit-expectation:local-first-posture",
  ),
  dimension(
    "audit-dimension:provider-posture",
    "Provider posture",
    "high",
    "Verify provider calls and provider escalation remain absent or governed by explicit posture.",
    "audit-expectation:provider-posture",
  ),
  dimension(
    "audit-dimension:redaction-posture",
    "Redaction posture",
    "high",
    "Verify telemetry, UI, reports, and demo metadata avoid source-material exposure.",
    "audit-expectation:redaction-posture",
  ),
  dimension(
    "audit-dimension:replay-safety",
    "Replay safety",
    "medium",
    "Verify replay and audit timeline stories remain deterministic and non-mutating.",
    "audit-expectation:replay-safety",
  ),
  dimension(
    "audit-dimension:observability",
    "Observability",
    "medium",
    "Verify observability surfaces stay read-only and metadata-only.",
    "audit-expectation:observability",
  ),
  dimension(
    "audit-dimension:auditability",
    "Auditability",
    "high",
    "Verify phases can be traced through typed evidence and closeout metadata.",
    "audit-expectation:auditability",
  ),
  dimension(
    "audit-dimension:onboarding-readiness",
    "Onboarding readiness",
    "medium",
    "Verify fresh-machine, doctor, onboarding, and move-in metadata remains complete.",
    "audit-expectation:onboarding-readiness",
  ),
  dimension(
    "audit-dimension:portfolio-readiness",
    "Portfolio readiness",
    "medium",
    "Verify recruiter and demo readiness metadata remains complete without rendering or execution.",
    "audit-expectation:portfolio-readiness",
  ),
] satisfies readonly AuditDimension[];

const EXPECTATIONS = [
  expectation(
    "audit-expectation:governance",
    "audit-dimension:governance",
    "critical",
    "Every audited phase must preserve governance-first boundaries and link to existing closeout or readiness evidence.",
    ["phase closeout metadata", "Phase 20A governance summary"],
  ),
  expectation(
    "audit-expectation:authority-surfaces",
    "audit-dimension:authority-surfaces",
    "critical",
    "Authority-bearing surfaces must remain documented, approval-postured, and non-expanded by Phase 20E.",
    [
      "Phase 20A authority surface inventory",
      "Phase 18 approval runtime evidence",
    ],
  ),
  expectation(
    "audit-expectation:disabled-features",
    "audit-dimension:disabled-features",
    "critical",
    "Disabled features must remain disabled, with no wake word, hidden capture, auto-approval, graph execution, or unapproved device action enabled.",
    ["Phase 20A disabled-feature matrix", "Phase 20D closeout posture"],
  ),
  expectation(
    "audit-expectation:approval-boundaries",
    "audit-dimension:approval-boundaries",
    "critical",
    "Approval boundaries must remain explicit and no audited phase may introduce approval bypass or voice-only approval.",
    ["Phase 18 approval runtime", "Phase 20C move-in safety reminder"],
  ),
  expectation(
    "audit-expectation:local-first-posture",
    "audit-dimension:local-first-posture",
    "high",
    "Local-first posture must remain the default across runtime, bootstrap, onboarding, and portfolio metadata.",
    ["Phase 20B bootstrap readiness", "Phase 20D portfolio report"],
  ),
  expectation(
    "audit-expectation:provider-posture",
    "audit-dimension:provider-posture",
    "high",
    "Provider posture must remain disabled, local-first, cloud-gated, or explicitly whitelisted without provider calls during audit definition.",
    ["Phase 20A authority inventory", "Phase 20B doctor registry"],
  ),
  expectation(
    "audit-expectation:redaction-posture",
    "audit-dimension:redaction-posture",
    "high",
    "Redaction posture must exclude source material from telemetry, reports, UI metadata, and demo references.",
    ["Phase 19 fortress layer", "Phase 20D portfolio report"],
  ),
  expectation(
    "audit-expectation:replay-safety",
    "audit-dimension:replay-safety",
    "medium",
    "Replay-related surfaces must remain deterministic, read-only, and free of side-effect execution.",
    ["Phase 12 Command Center", "Phase 19 fortress layer"],
  ),
  expectation(
    "audit-expectation:observability",
    "audit-dimension:observability",
    "medium",
    "Observability surfaces must remain read-only, redaction-aware, and metadata-only.",
    ["telemetry cockpit posture", "audit timeline posture"],
  ),
  expectation(
    "audit-expectation:auditability",
    "audit-dimension:auditability",
    "high",
    "Each phase must remain auditable through typed records, summaries, and evidence identifiers.",
    ["Phase 20A final status registry", "Phase 20D closeout"],
  ),
  expectation(
    "audit-expectation:onboarding-readiness",
    "audit-dimension:onboarding-readiness",
    "medium",
    "Onboarding readiness must remain represented without installer automation, filesystem mutation, or runtime setup execution.",
    ["Phase 20B bootstrap closeout", "Phase 20C onboarding closeout"],
  ),
  expectation(
    "audit-expectation:portfolio-readiness",
    "audit-dimension:portfolio-readiness",
    "medium",
    "Portfolio readiness must remain represented without presentation generation, UI routes, demo execution, or report rendering.",
    ["Phase 20D portfolio report", "Phase 20D closeout"],
  ),
] satisfies readonly AuditExpectation[];

const SURFACES = [
  surface(
    "audit-surface:phase-10-room-os",
    "phase-10",
    "Phase 10 Room OS",
    "Audit Room OS foundation, fake-room posture, and device-action boundaries.",
    ["phase-10:room-os-foundation", "phase-20c:fake-room-readiness"],
    "Phase 20A final system status registry",
  ),
  surface(
    "audit-surface:phase-11-persistence",
    "phase-11",
    "Phase 11 Persistence",
    "Audit persistence, event-store, replay, and mutation boundaries.",
    ["phase-11:persistence-layer", "phase-20a:final-readiness-report"],
    "Phase 20A final system status registry",
  ),
  surface(
    "audit-surface:phase-12-command-center",
    "phase-12",
    "Phase 12 Command Center",
    "Audit Command Center visibility, UI affordance boundaries, replay safety, and redaction posture.",
    ["phase-12:command-center-ui", "phase-20d:demo-surface-registry"],
    "Phase 20D portfolio readiness closeout",
  ),
  surface(
    "audit-surface:phase-13-model-runtime",
    "phase-13",
    "Phase 13 Model Runtime",
    "Audit local model runtime, provider posture, cloud gating, and execution boundaries.",
    ["phase-13:model-runtime", "phase-20b:bootstrap-readiness-contract"],
    "Phase 20A final authority surface inventory",
  ),
  surface(
    "audit-surface:phase-14-voice-runtime",
    "phase-14",
    "Phase 14 Voice Runtime",
    "Audit voice runtime posture, wake-word disablement, always-listening disablement, and approval boundaries.",
    ["phase-14:voice-runtime", "phase-20c:voice-authorisation-deferred"],
    "Phase 20A final disabled-feature matrix",
  ),
  surface(
    "audit-surface:phase-15-vision-runtime",
    "phase-15",
    "Phase 15 Vision Runtime",
    "Audit vision runtime posture, hidden capture disablement, background camera disablement, and redaction posture.",
    ["phase-15:vision-runtime", "phase-20d:vision-demo-surface"],
    "Phase 20A final disabled-feature matrix",
  ),
  surface(
    "audit-surface:phase-16-room-runtime",
    "phase-16",
    "Phase 16 Room Runtime",
    "Audit room adapter runtime, fake-room posture, deferred hardware onboarding, and unapproved device-action boundaries.",
    ["phase-16:room-adapter-runtime", "phase-20c:move-in-readiness-checklist"],
    "Phase 20C onboarding readiness closeout",
  ),
  surface(
    "audit-surface:phase-17-scheduled-assistance",
    "phase-17",
    "Phase 17 Scheduled Assistance",
    "Audit scheduled assistance, routine chaining disablement, scheduler side-effect posture, and approval boundaries.",
    [
      "phase-17:scheduled-assistance-runtime",
      "phase-20d:scheduled-assistance-demo-surface",
    ],
    "Phase 20A final disabled-feature matrix",
  ),
  surface(
    "audit-surface:phase-18-approval-runtime",
    "phase-18",
    "Phase 18 Approval Runtime",
    "Audit approval lifecycle, authority token metadata, side-effect gates, and bypass prevention.",
    [
      "phase-18:approval-gated-execution-layer",
      "phase-20d:approval-runtime-demo-flow",
    ],
    "Phase 20A final governance readiness summary",
  ),
  surface(
    "audit-surface:phase-19-fortress-layer",
    "phase-19",
    "Phase 19 Fortress Layer",
    "Audit fortress hardening, observability, red-team posture, architecture graph boundaries, and redaction posture.",
    ["phase-19:fortress-upgrades", "phase-19a:architecture-graph"],
    "Phase 20D portfolio readiness closeout",
  ),
  surface(
    "audit-surface:phase-20a-readiness",
    "phase-20a",
    "Phase 20A Readiness",
    "Audit final system status, readiness report, disabled-feature matrix, authority inventory, governance summary, and closeout.",
    ["phase-20a6:final-readiness-layer-closeout"],
    "Phase 20A closeout",
  ),
  surface(
    "audit-surface:phase-20b-bootstrap",
    "phase-20b",
    "Phase 20B Bootstrap",
    "Audit bootstrap contract, doctor registry, doctor result contracts, dry-run evaluator, report generator, safe runtime, CLI adapter, and closeout.",
    ["phase-20b8:bootstrap-readiness-closeout"],
    "Phase 20B closeout",
  ),
  surface(
    "audit-surface:phase-20c-onboarding",
    "phase-20c",
    "Phase 20C Onboarding",
    "Audit onboarding contract, step registry, progress model, onboarding report, move-in checklist, deferred hardware posture, and closeout.",
    ["phase-20c6:onboarding-readiness-closeout"],
    "Phase 20C closeout",
  ),
  surface(
    "audit-surface:phase-20d-portfolio",
    "phase-20d",
    "Phase 20D Portfolio",
    "Audit portfolio contract, recruiter narratives, demo surfaces, demo flows, portfolio report, future expansion posture, and closeout.",
    ["phase-20d6:portfolio-readiness-closeout"],
    "Phase 20D closeout",
  ),
] satisfies readonly AuditSurface[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyContract(
  contract: CrossPhaseAuditContract,
): CrossPhaseAuditContract {
  return CrossPhaseAuditContractSchema.parse(
    JSON.parse(JSON.stringify(contract)),
  );
}

function copySurface(auditSurface: AuditSurface): AuditSurface {
  return AuditSurfaceSchema.parse(JSON.parse(JSON.stringify(auditSurface)));
}

function copyDimension(dimensionRecord: AuditDimension): AuditDimension {
  return AuditDimensionSchema.parse(
    JSON.parse(JSON.stringify(dimensionRecord)),
  );
}

function copyExpectation(
  expectationRecord: AuditExpectation,
): AuditExpectation {
  return AuditExpectationSchema.parse(
    JSON.parse(JSON.stringify(expectationRecord)),
  );
}

function assertAlignedWithPhase20DCloseout(): void {
  const closeout = buildPhase20DCloseoutReport();

  if (!closeout.phase_20d_complete || !closeout.phase_20e_ready) {
    throw new Error(
      "Phase 20D closeout is not ready for Phase 20E audit contract",
    );
  }
}

export const CROSS_PHASE_AUDIT_CONTRACT = deepFreeze(
  CrossPhaseAuditContractSchema.parse({
    contract_version: CROSS_PHASE_AUDIT_CONTRACT_VERSION,
    contract_id: "phase-20e1-cross-phase-audit-contract",
    phase: "20E.1",
    summary:
      "Metadata-only final cross-phase audit contract defining audit surfaces, dimensions, and expectations across Phases 10 through 20D without executing audits or inspecting runtime state.",
    surfaces: SURFACES,
    dimensions: DIMENSIONS,
    expectations: EXPECTATIONS,
    posture: POSTURE,
  }),
);

export function getCrossPhaseAuditContract(): CrossPhaseAuditContract {
  assertAlignedWithPhase20DCloseout();
  return copyContract(CROSS_PHASE_AUDIT_CONTRACT);
}

export function getAuditSurfaces(): readonly AuditSurface[] {
  return CROSS_PHASE_AUDIT_CONTRACT.surfaces.map(copySurface);
}

export function getAuditDimensions(): readonly AuditDimension[] {
  return CROSS_PHASE_AUDIT_CONTRACT.dimensions.map(copyDimension);
}

export function getAuditExpectations(): readonly AuditExpectation[] {
  return CROSS_PHASE_AUDIT_CONTRACT.expectations.map(copyExpectation);
}

export function summarizeCrossPhaseAuditContract(): CrossPhaseAuditSummary {
  const surfaces = CROSS_PHASE_AUDIT_CONTRACT.surfaces;
  const expectations = CROSS_PHASE_AUDIT_CONTRACT.expectations;
  const representedPhaseIds = new Set(
    surfaces.map((surfaceRecord) => surfaceRecord.phase_id),
  );

  return CrossPhaseAuditSummarySchema.parse({
    contract_version: CROSS_PHASE_AUDIT_CONTRACT_VERSION,
    surface_count: surfaces.length,
    dimension_count: CROSS_PHASE_AUDIT_CONTRACT.dimensions.length,
    expectation_count: expectations.length,
    represented_phase_count: representedPhaseIds.size,
    critical_expectation_count: expectations.filter(
      (expectationRecord) => expectationRecord.severity === "critical",
    ).length,
    high_expectation_count: expectations.filter(
      (expectationRecord) => expectationRecord.severity === "high",
    ).length,
    medium_expectation_count: expectations.filter(
      (expectationRecord) => expectationRecord.severity === "medium",
    ).length,
    low_expectation_count: expectations.filter(
      (expectationRecord) => expectationRecord.severity === "low",
    ).length,
    phase20e_contract_only: true,
    phase20e_capability_neutral: true,
    posture: POSTURE,
  });
}
