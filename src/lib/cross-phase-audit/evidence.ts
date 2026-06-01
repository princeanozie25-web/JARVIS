import { z } from "zod";

import {
  AuditDimensionIdSchema,
  AuditSurfaceIdSchema,
  CrossPhaseAuditPostureSchema,
  type AuditDimensionId,
  type AuditSurfaceId,
  type CrossPhaseAuditPosture,
} from "./contracts";
import { getCrossPhaseAuditContract } from "./registry";

export const CROSS_PHASE_AUDIT_EVIDENCE_VERSION = "20E.2" as const;

export const AUDIT_EVIDENCE_IDS = [
  "audit-evidence:phase-20a-readiness-governance-closeout",
  "audit-evidence:phase-20b-bootstrap-doctor-closeout",
  "audit-evidence:phase-20c-onboarding-move-in-closeout",
  "audit-evidence:phase-20d-portfolio-demo-closeout",
  "audit-evidence:final-system-status-registry",
  "audit-evidence:disabled-feature-matrix",
  "audit-evidence:authority-surface-inventory",
  "audit-evidence:governance-readiness-summary",
  "audit-evidence:bootstrap-doctor-report-path",
  "audit-evidence:onboarding-report-path",
  "audit-evidence:portfolio-report-path",
  "audit-evidence:architecture-graph",
  "audit-evidence:governance-visualizer",
  "audit-evidence:telemetry-cockpit",
  "audit-evidence:red-team-sandbox-cai-posture",
  "audit-evidence:approval-runtime-closeout",
  "audit-evidence:model-runtime-closeout",
  "audit-evidence:voice-runtime-closeout",
  "audit-evidence:vision-runtime-closeout",
  "audit-evidence:room-runtime-closeout",
  "audit-evidence:scheduler-closeout",
  "audit-evidence:persistence-closeout",
  "audit-evidence:command-center-closeout",
] as const;

export const AUDIT_EVIDENCE_TYPES = [
  "phase_closeout",
  "registry",
  "matrix",
  "inventory",
  "summary",
  "report_path",
  "architecture_graph",
  "visualizer",
  "observability_surface",
  "sandbox_posture",
  "runtime_closeout",
  "persistence_closeout",
  "command_center_closeout",
] as const;

export const AUDIT_EVIDENCE_CONFIDENCE_LEVELS = [
  "high",
  "medium",
  "low",
] as const;

export const AUDIT_EVIDENCE_SOURCE_POSTURES = [
  "static_metadata",
  "closeout_metadata",
  "report_metadata",
  "architecture_metadata",
  "governance_metadata",
  "observability_metadata",
  "sandbox_metadata",
  "runtime_metadata",
] as const;

export const AUDIT_EVIDENCE_PAYLOAD_POSTURES = [
  "raw_payload_not_allowed",
  "redacted_metadata_only",
  "synthetic_metadata_only",
  "metadata_reference_only",
] as const;

export const AUDIT_EVIDENCE_AUTHORITY_POSTURES = [
  "metadata_only",
  "read_only",
  "approval_gated_reference",
  "sandboxed_reference",
  "deferred_disabled_reference",
] as const;

export type AuditEvidenceId = (typeof AUDIT_EVIDENCE_IDS)[number];
export type AuditEvidenceType = (typeof AUDIT_EVIDENCE_TYPES)[number];
export type AuditEvidenceConfidence =
  (typeof AUDIT_EVIDENCE_CONFIDENCE_LEVELS)[number];
export type AuditEvidenceSourcePosture =
  (typeof AUDIT_EVIDENCE_SOURCE_POSTURES)[number];
export type AuditEvidencePayloadPosture =
  (typeof AUDIT_EVIDENCE_PAYLOAD_POSTURES)[number];
export type AuditEvidenceAuthorityPosture =
  (typeof AUDIT_EVIDENCE_AUTHORITY_POSTURES)[number];

export const AuditEvidenceIdSchema = z.enum(AUDIT_EVIDENCE_IDS);
export const AuditEvidenceTypeSchema = z.enum(AUDIT_EVIDENCE_TYPES);
export const AuditEvidenceConfidenceSchema = z.enum(
  AUDIT_EVIDENCE_CONFIDENCE_LEVELS,
);
export const AuditEvidenceSourcePostureSchema = z.enum(
  AUDIT_EVIDENCE_SOURCE_POSTURES,
);
export const AuditEvidencePayloadPostureSchema = z.enum(
  AUDIT_EVIDENCE_PAYLOAD_POSTURES,
);
export const AuditEvidenceAuthorityPostureSchema = z.enum(
  AUDIT_EVIDENCE_AUTHORITY_POSTURES,
);

export const AuditEvidenceRecordSchema = z.strictObject({
  evidence_id: AuditEvidenceIdSchema,
  title: z.string().trim().min(1).max(180),
  source_phase_module: z.string().trim().min(1).max(220),
  evidence_type: AuditEvidenceTypeSchema,
  audit_dimension_ids: z.array(AuditDimensionIdSchema).min(1),
  related_audit_surface_ids: z.array(AuditSurfaceIdSchema).min(1),
  confidence: AuditEvidenceConfidenceSchema,
  source_posture: AuditEvidenceSourcePostureSchema,
  payload_posture: AuditEvidencePayloadPostureSchema,
  authority_posture: AuditEvidenceAuthorityPostureSchema,
  limitations_deferred_posture: z.string().trim().min(1).max(420),
  final_audit_relevance: z.string().trim().min(1).max(420),
  posture: CrossPhaseAuditPostureSchema,
});

export const CrossPhaseAuditEvidenceRegistrySchema = z.strictObject({
  registry_version: z.literal(CROSS_PHASE_AUDIT_EVIDENCE_VERSION),
  source_contract_version: z.literal("20E.1"),
  registry_id: z.literal("phase-20e2-cross-phase-audit-evidence-registry"),
  phase: z.literal("20E.2"),
  evidence: z.array(AuditEvidenceRecordSchema),
  posture: CrossPhaseAuditPostureSchema,
});

export const CrossPhaseAuditEvidenceSummarySchema = z.strictObject({
  registry_version: z.literal(CROSS_PHASE_AUDIT_EVIDENCE_VERSION),
  evidence_count: z.number().int().positive(),
  high_confidence_count: z.number().int().nonnegative(),
  medium_confidence_count: z.number().int().nonnegative(),
  low_confidence_count: z.number().int().nonnegative(),
  evidence_type_counts: z.record(
    AuditEvidenceTypeSchema,
    z.number().int().nonnegative(),
  ),
  dimension_reference_count: z.number().int().positive(),
  surface_reference_count: z.number().int().positive(),
  metadata_safe_count: z.number().int().nonnegative(),
  phase20e_evidence_registry_only: z.literal(true),
  phase20e_capability_neutral: z.literal(true),
  posture: CrossPhaseAuditPostureSchema,
});

export type AuditEvidenceRecord = z.infer<typeof AuditEvidenceRecordSchema>;
export type CrossPhaseAuditEvidenceRegistry = z.infer<
  typeof CrossPhaseAuditEvidenceRegistrySchema
>;
export type CrossPhaseAuditEvidenceSummary = z.infer<
  typeof CrossPhaseAuditEvidenceSummarySchema
>;

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

function evidence(
  input: Omit<AuditEvidenceRecord, "posture">,
): AuditEvidenceRecord {
  return AuditEvidenceRecordSchema.parse({
    ...input,
    posture: POSTURE,
  });
}

const CORE_GOVERNANCE_DIMENSIONS = [
  "audit-dimension:governance",
  "audit-dimension:auditability",
] satisfies readonly AuditDimensionId[];

const SAFETY_DIMENSIONS = [
  "audit-dimension:governance",
  "audit-dimension:authority-surfaces",
  "audit-dimension:disabled-features",
  "audit-dimension:approval-boundaries",
] satisfies readonly AuditDimensionId[];

const LOCAL_PROVIDER_DIMENSIONS = [
  "audit-dimension:local-first-posture",
  "audit-dimension:provider-posture",
  "audit-dimension:redaction-posture",
] satisfies readonly AuditDimensionId[];

const OBSERVABILITY_DIMENSIONS = [
  "audit-dimension:redaction-posture",
  "audit-dimension:replay-safety",
  "audit-dimension:observability",
  "audit-dimension:auditability",
] satisfies readonly AuditDimensionId[];

const EVIDENCE = [
  evidence({
    evidence_id: "audit-evidence:phase-20a-readiness-governance-closeout",
    title: "Phase 20A readiness/governance closeout",
    source_phase_module: "src/lib/final-system-status/phase-20a-closeout.ts",
    evidence_type: "phase_closeout",
    audit_dimension_ids: [...SAFETY_DIMENSIONS],
    related_audit_surface_ids: ["audit-surface:phase-20a-readiness"],
    confidence: "high",
    source_posture: "closeout_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "metadata_only",
    limitations_deferred_posture:
      "Closeout evidence only; does not execute final audits or inspect runtime state.",
    final_audit_relevance:
      "Anchors final readiness, disabled-feature, authority, and governance audit coverage.",
  }),
  evidence({
    evidence_id: "audit-evidence:phase-20b-bootstrap-doctor-closeout",
    title: "Phase 20B bootstrap/doctor closeout",
    source_phase_module: "src/lib/bootstrap-readiness/phase-20b-closeout.ts",
    evidence_type: "phase_closeout",
    audit_dimension_ids: [
      "audit-dimension:local-first-posture",
      "audit-dimension:provider-posture",
      "audit-dimension:onboarding-readiness",
      "audit-dimension:auditability",
    ],
    related_audit_surface_ids: ["audit-surface:phase-20b-bootstrap"],
    confidence: "high",
    source_posture: "closeout_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "read_only",
    limitations_deferred_posture:
      "Doctor closeout evidence does not install, mutate, auto-fix, or execute unsupported checks.",
    final_audit_relevance:
      "Supports bootstrap, doctor, provider, local-first, and fresh-machine audit coverage.",
  }),
  evidence({
    evidence_id: "audit-evidence:phase-20c-onboarding-move-in-closeout",
    title: "Phase 20C onboarding/move-in closeout",
    source_phase_module: "src/lib/onboarding-readiness/phase-20c-closeout.ts",
    evidence_type: "phase_closeout",
    audit_dimension_ids: [
      "audit-dimension:onboarding-readiness",
      "audit-dimension:approval-boundaries",
      "audit-dimension:local-first-posture",
      "audit-dimension:auditability",
    ],
    related_audit_surface_ids: ["audit-surface:phase-20c-onboarding"],
    confidence: "high",
    source_posture: "closeout_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "deferred_disabled_reference",
    limitations_deferred_posture:
      "Real device, wake-word, conversation mode, and voice-authorisation tiers remain deferred.",
    final_audit_relevance:
      "Supports onboarding, move-in, approval safety, and deferred hardware audit coverage.",
  }),
  evidence({
    evidence_id: "audit-evidence:phase-20d-portfolio-demo-closeout",
    title: "Phase 20D portfolio/demo closeout",
    source_phase_module: "src/lib/portfolio-readiness/phase-20d-closeout.ts",
    evidence_type: "phase_closeout",
    audit_dimension_ids: [
      "audit-dimension:portfolio-readiness",
      "audit-dimension:governance",
      "audit-dimension:redaction-posture",
      "audit-dimension:auditability",
    ],
    related_audit_surface_ids: ["audit-surface:phase-20d-portfolio"],
    confidence: "high",
    source_posture: "closeout_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "metadata_only",
    limitations_deferred_posture:
      "Portfolio closeout does not render reports, create presentation artifacts, or execute demos.",
    final_audit_relevance:
      "Supports final portfolio/demo readiness and future expansion posture audit coverage.",
  }),
  evidence({
    evidence_id: "audit-evidence:final-system-status-registry",
    title: "Final system status registry",
    source_phase_module: "src/lib/final-system-status/registry.ts",
    evidence_type: "registry",
    audit_dimension_ids: [...CORE_GOVERNANCE_DIMENSIONS],
    related_audit_surface_ids: [
      "audit-surface:phase-20a-readiness",
      "audit-surface:phase-19-fortress-layer",
    ],
    confidence: "high",
    source_posture: "static_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "metadata_only",
    limitations_deferred_posture:
      "Status registry summarizes metadata only and does not re-run phase checks.",
    final_audit_relevance:
      "Provides phase coverage evidence for the cross-phase audit sweep.",
  }),
  evidence({
    evidence_id: "audit-evidence:disabled-feature-matrix",
    title: "Final disabled-feature matrix",
    source_phase_module:
      "src/lib/final-system-status/disabled-feature-matrix.ts",
    evidence_type: "matrix",
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
      "audit-dimension:governance",
    ],
    related_audit_surface_ids: [
      "audit-surface:phase-14-voice-runtime",
      "audit-surface:phase-15-vision-runtime",
      "audit-surface:phase-17-scheduled-assistance",
      "audit-surface:phase-20a-readiness",
    ],
    confidence: "high",
    source_posture: "static_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "metadata_only",
    limitations_deferred_posture:
      "Matrix records disabled posture only and does not enforce or toggle features.",
    final_audit_relevance:
      "Supports wake-word, hidden capture, auto-approval, graph execution, and device-action audit checks.",
  }),
  evidence({
    evidence_id: "audit-evidence:authority-surface-inventory",
    title: "Final authority surface inventory",
    source_phase_module:
      "src/lib/final-system-status/authority-surface-inventory.ts",
    evidence_type: "inventory",
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:approval-boundaries",
      "audit-dimension:provider-posture",
    ],
    related_audit_surface_ids: [
      "audit-surface:phase-13-model-runtime",
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-20a-readiness",
    ],
    confidence: "high",
    source_posture: "governance_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "approval_gated_reference",
    limitations_deferred_posture:
      "Authority inventory documents posture only and creates no new authority surface.",
    final_audit_relevance:
      "Supports authority-bearing surface and approval-governance audit checks.",
  }),
  evidence({
    evidence_id: "audit-evidence:governance-readiness-summary",
    title: "Final governance readiness summary",
    source_phase_module:
      "src/lib/final-system-status/governance-readiness-summary.ts",
    evidence_type: "summary",
    audit_dimension_ids: [...SAFETY_DIMENSIONS],
    related_audit_surface_ids: [
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-20a-readiness",
    ],
    confidence: "high",
    source_posture: "governance_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "metadata_only",
    limitations_deferred_posture:
      "Summary is derived from Phase 20A metadata and does not perform audit execution.",
    final_audit_relevance:
      "Supports final governance-ready verdict evidence for cross-phase audit planning.",
  }),
  evidence({
    evidence_id: "audit-evidence:bootstrap-doctor-report-path",
    title: "Bootstrap doctor report path",
    source_phase_module: "src/lib/bootstrap-readiness/doctor-report.ts",
    evidence_type: "report_path",
    audit_dimension_ids: [
      "audit-dimension:onboarding-readiness",
      "audit-dimension:local-first-posture",
      "audit-dimension:provider-posture",
    ],
    related_audit_surface_ids: ["audit-surface:phase-20b-bootstrap"],
    confidence: "high",
    source_posture: "report_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "read_only",
    limitations_deferred_posture:
      "Report path consumes supplied results or safe runtime output; this evidence registry does not execute it.",
    final_audit_relevance:
      "Supports fresh-machine, doctor, and local-first readiness audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:onboarding-report-path",
    title: "Onboarding report path",
    source_phase_module: "src/lib/onboarding-readiness/report.ts",
    evidence_type: "report_path",
    audit_dimension_ids: [
      "audit-dimension:onboarding-readiness",
      "audit-dimension:approval-boundaries",
      "audit-dimension:auditability",
    ],
    related_audit_surface_ids: ["audit-surface:phase-20c-onboarding"],
    confidence: "high",
    source_posture: "report_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "read_only",
    limitations_deferred_posture:
      "Onboarding report path does not execute onboarding steps or inspect the machine.",
    final_audit_relevance:
      "Supports onboarding, deferred hardware, and first-safe-run readiness audit checks.",
  }),
  evidence({
    evidence_id: "audit-evidence:portfolio-report-path",
    title: "Portfolio report path",
    source_phase_module: "src/lib/portfolio-readiness/portfolio-report.ts",
    evidence_type: "report_path",
    audit_dimension_ids: [
      "audit-dimension:portfolio-readiness",
      "audit-dimension:redaction-posture",
      "audit-dimension:observability",
    ],
    related_audit_surface_ids: ["audit-surface:phase-20d-portfolio"],
    confidence: "high",
    source_posture: "report_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "metadata_only",
    limitations_deferred_posture:
      "Portfolio report path builds metadata only and does not render a report or create a route.",
    final_audit_relevance:
      "Supports recruiter/demo and source-material safety evidence for final audit planning.",
  }),
  evidence({
    evidence_id: "audit-evidence:architecture-graph",
    title: "Architecture graph",
    source_phase_module: "src/lib/architecture-graph",
    evidence_type: "architecture_graph",
    audit_dimension_ids: [
      "audit-dimension:governance",
      "audit-dimension:auditability",
      "audit-dimension:replay-safety",
    ],
    related_audit_surface_ids: [
      "audit-surface:phase-19-fortress-layer",
      "audit-surface:phase-20d-portfolio",
    ],
    confidence: "high",
    source_posture: "architecture_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "read_only",
    limitations_deferred_posture:
      "Architecture graph remains visibility-only and cannot drive execution.",
    final_audit_relevance:
      "Supports subsystem-boundary, forbidden-edge, and auditability evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:governance-visualizer",
    title: "Governance visualizer",
    source_phase_module: "src/lib/governance-visualizer",
    evidence_type: "visualizer",
    audit_dimension_ids: [
      "audit-dimension:governance",
      "audit-dimension:authority-surfaces",
      "audit-dimension:approval-boundaries",
    ],
    related_audit_surface_ids: [
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-20d-portfolio",
    ],
    confidence: "medium",
    source_posture: "governance_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "approval_gated_reference",
    limitations_deferred_posture:
      "Visualizer evidence is metadata-only and does not create or operate a new route.",
    final_audit_relevance:
      "Supports governance-boundary and approval visualization audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:telemetry-cockpit",
    title: "Telemetry cockpit",
    source_phase_module: "src/lib/telemetry-cockpit",
    evidence_type: "observability_surface",
    audit_dimension_ids: [...OBSERVABILITY_DIMENSIONS],
    related_audit_surface_ids: [
      "audit-surface:phase-12-command-center",
      "audit-surface:phase-19-fortress-layer",
      "audit-surface:phase-20d-portfolio",
    ],
    confidence: "medium",
    source_posture: "observability_metadata",
    payload_posture: "redacted_metadata_only",
    authority_posture: "read_only",
    limitations_deferred_posture:
      "Telemetry cockpit evidence remains redacted and does not expose source material.",
    final_audit_relevance:
      "Supports observability, replay safety, and redaction audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:red-team-sandbox-cai-posture",
    title: "Red-team sandbox and CAI posture",
    source_phase_module: "src/lib/red-team-sandbox",
    evidence_type: "sandbox_posture",
    audit_dimension_ids: [
      "audit-dimension:governance",
      "audit-dimension:provider-posture",
      "audit-dimension:disabled-features",
      "audit-dimension:redaction-posture",
    ],
    related_audit_surface_ids: [
      "audit-surface:phase-19-fortress-layer",
      "audit-surface:phase-20d-portfolio",
    ],
    confidence: "medium",
    source_posture: "sandbox_metadata",
    payload_posture: "synthetic_metadata_only",
    authority_posture: "sandboxed_reference",
    limitations_deferred_posture:
      "CAI non-whitelisted targets, provider escalation, and attack execution remain disabled.",
    final_audit_relevance:
      "Supports red-team, CAI posture, provider, and disabled-feature audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:approval-runtime-closeout",
    title: "Approval runtime closeout",
    source_phase_module: "src/lib/approval-runtime",
    evidence_type: "runtime_closeout",
    audit_dimension_ids: [
      "audit-dimension:approval-boundaries",
      "audit-dimension:authority-surfaces",
      "audit-dimension:governance",
    ],
    related_audit_surface_ids: ["audit-surface:phase-18-approval-runtime"],
    confidence: "high",
    source_posture: "runtime_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "approval_gated_reference",
    limitations_deferred_posture:
      "Approval runtime closeout evidence references authority posture only and does not execute approvals.",
    final_audit_relevance:
      "Supports approval boundary and authority lifecycle audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:model-runtime-closeout",
    title: "Model runtime closeout",
    source_phase_module: "src/lib/models",
    evidence_type: "runtime_closeout",
    audit_dimension_ids: [...LOCAL_PROVIDER_DIMENSIONS],
    related_audit_surface_ids: ["audit-surface:phase-13-model-runtime"],
    confidence: "medium",
    source_posture: "runtime_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "read_only",
    limitations_deferred_posture:
      "Model runtime evidence does not invoke local or cloud models.",
    final_audit_relevance:
      "Supports local-first, provider posture, and model runtime audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:voice-runtime-closeout",
    title: "Voice runtime closeout",
    source_phase_module: "src/lib/voice-runtime",
    evidence_type: "runtime_closeout",
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
      "audit-dimension:redaction-posture",
    ],
    related_audit_surface_ids: ["audit-surface:phase-14-voice-runtime"],
    confidence: "medium",
    source_posture: "runtime_metadata",
    payload_posture: "redacted_metadata_only",
    authority_posture: "deferred_disabled_reference",
    limitations_deferred_posture:
      "Wake word, always-listening, and voice-only approval remain disabled.",
    final_audit_relevance:
      "Supports voice runtime, disabled-feature, and approval-boundary audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:vision-runtime-closeout",
    title: "Vision runtime closeout",
    source_phase_module: "src/lib/vision-runtime",
    evidence_type: "runtime_closeout",
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:redaction-posture",
      "audit-dimension:local-first-posture",
    ],
    related_audit_surface_ids: ["audit-surface:phase-15-vision-runtime"],
    confidence: "medium",
    source_posture: "runtime_metadata",
    payload_posture: "redacted_metadata_only",
    authority_posture: "deferred_disabled_reference",
    limitations_deferred_posture:
      "Hidden capture, background camera, and provider-backed vision execution remain disabled.",
    final_audit_relevance:
      "Supports vision runtime, capture boundary, and redaction audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:room-runtime-closeout",
    title: "Room runtime closeout",
    source_phase_module: "src/lib/environment",
    evidence_type: "runtime_closeout",
    audit_dimension_ids: [
      "audit-dimension:approval-boundaries",
      "audit-dimension:disabled-features",
      "audit-dimension:onboarding-readiness",
    ],
    related_audit_surface_ids: [
      "audit-surface:phase-10-room-os",
      "audit-surface:phase-16-room-runtime",
    ],
    confidence: "medium",
    source_posture: "runtime_metadata",
    payload_posture: "synthetic_metadata_only",
    authority_posture: "deferred_disabled_reference",
    limitations_deferred_posture:
      "Real Hue/device onboarding remains deferred until hardware, config, and governance are present.",
    final_audit_relevance:
      "Supports Room OS, room adapter, fake-room, and unapproved device-action audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:scheduler-closeout",
    title: "Scheduler closeout",
    source_phase_module: "src/lib/routines",
    evidence_type: "runtime_closeout",
    audit_dimension_ids: [
      "audit-dimension:approval-boundaries",
      "audit-dimension:disabled-features",
      "audit-dimension:replay-safety",
    ],
    related_audit_surface_ids: ["audit-surface:phase-17-scheduled-assistance"],
    confidence: "medium",
    source_posture: "runtime_metadata",
    payload_posture: "metadata_reference_only",
    authority_posture: "approval_gated_reference",
    limitations_deferred_posture:
      "Scheduler side effects, routine chaining, and unapproved room/device actions remain disabled.",
    final_audit_relevance:
      "Supports scheduled assistance and routine boundary audit evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:persistence-closeout",
    title: "Persistence closeout",
    source_phase_module: "src/lib/db",
    evidence_type: "persistence_closeout",
    audit_dimension_ids: [
      "audit-dimension:replay-safety",
      "audit-dimension:auditability",
      "audit-dimension:redaction-posture",
    ],
    related_audit_surface_ids: ["audit-surface:phase-11-persistence"],
    confidence: "medium",
    source_posture: "static_metadata",
    payload_posture: "redacted_metadata_only",
    authority_posture: "read_only",
    limitations_deferred_posture:
      "Persistence evidence is a metadata reference and does not inspect database files.",
    final_audit_relevance:
      "Supports persistence, event-store, replay, and auditability evidence.",
  }),
  evidence({
    evidence_id: "audit-evidence:command-center-closeout",
    title: "Command Center closeout",
    source_phase_module: "src/lib/command-center",
    evidence_type: "command_center_closeout",
    audit_dimension_ids: [
      "audit-dimension:observability",
      "audit-dimension:replay-safety",
      "audit-dimension:redaction-posture",
      "audit-dimension:portfolio-readiness",
    ],
    related_audit_surface_ids: [
      "audit-surface:phase-12-command-center",
      "audit-surface:phase-20d-portfolio",
    ],
    confidence: "medium",
    source_posture: "observability_metadata",
    payload_posture: "redacted_metadata_only",
    authority_posture: "read_only",
    limitations_deferred_posture:
      "Command Center evidence does not create UI routes or expose run/retry/mutate affordances.",
    final_audit_relevance:
      "Supports Command Center, observability, redaction, replay, and portfolio demo evidence.",
  }),
] satisfies readonly AuditEvidenceRecord[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyRecord(record: AuditEvidenceRecord): AuditEvidenceRecord {
  return AuditEvidenceRecordSchema.parse(JSON.parse(JSON.stringify(record)));
}

function copyRegistry(
  registry: CrossPhaseAuditEvidenceRegistry,
): CrossPhaseAuditEvidenceRegistry {
  return CrossPhaseAuditEvidenceRegistrySchema.parse(
    JSON.parse(JSON.stringify(registry)),
  );
}

function assertAlignedWithAuditContract(): void {
  const contract = getCrossPhaseAuditContract();
  const dimensionIds = new Set(
    contract.dimensions.map((dimension) => dimension.dimension_id),
  );
  const surfaceIds = new Set(
    contract.surfaces.map((surface) => surface.surface_id),
  );

  for (const record of CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence) {
    for (const dimensionId of record.audit_dimension_ids) {
      if (!dimensionIds.has(dimensionId)) {
        throw new Error(`Unknown audit dimension for evidence: ${dimensionId}`);
      }
    }

    for (const surfaceId of record.related_audit_surface_ids) {
      if (!surfaceIds.has(surfaceId)) {
        throw new Error(`Unknown audit surface for evidence: ${surfaceId}`);
      }
    }
  }
}

export const CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY = deepFreeze(
  CrossPhaseAuditEvidenceRegistrySchema.parse({
    registry_version: CROSS_PHASE_AUDIT_EVIDENCE_VERSION,
    source_contract_version: "20E.1",
    registry_id: "phase-20e2-cross-phase-audit-evidence-registry",
    phase: "20E.2",
    evidence: EVIDENCE,
    posture: POSTURE,
  }),
);

export function getCrossPhaseAuditEvidenceRegistry(): CrossPhaseAuditEvidenceRegistry {
  assertAlignedWithAuditContract();
  return copyRegistry(CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY);
}

export function getAuditEvidenceByDimension(
  dimensionId: AuditDimensionId,
): readonly AuditEvidenceRecord[] {
  return CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence
    .filter((record) => record.audit_dimension_ids.includes(dimensionId))
    .map(copyRecord);
}

export function getAuditEvidenceBySurfaceId(
  surfaceId: AuditSurfaceId,
): readonly AuditEvidenceRecord[] {
  return CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence
    .filter((record) => record.related_audit_surface_ids.includes(surfaceId))
    .map(copyRecord);
}

export function getHighConfidenceAuditEvidence(): readonly AuditEvidenceRecord[] {
  return CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence
    .filter((record) => record.confidence === "high")
    .map(copyRecord);
}

export function summarizeCrossPhaseAuditEvidence(): CrossPhaseAuditEvidenceSummary {
  const evidenceRecords = CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence;
  const evidenceTypeCounts = Object.fromEntries(
    AUDIT_EVIDENCE_TYPES.map((evidenceType) => [
      evidenceType,
      evidenceRecords.filter((record) => record.evidence_type === evidenceType)
        .length,
    ]),
  ) as Record<AuditEvidenceType, number>;

  return CrossPhaseAuditEvidenceSummarySchema.parse({
    registry_version: CROSS_PHASE_AUDIT_EVIDENCE_VERSION,
    evidence_count: evidenceRecords.length,
    high_confidence_count: evidenceRecords.filter(
      (record) => record.confidence === "high",
    ).length,
    medium_confidence_count: evidenceRecords.filter(
      (record) => record.confidence === "medium",
    ).length,
    low_confidence_count: evidenceRecords.filter(
      (record) => record.confidence === "low",
    ).length,
    evidence_type_counts: evidenceTypeCounts,
    dimension_reference_count: evidenceRecords.reduce(
      (count, record) => count + record.audit_dimension_ids.length,
      0,
    ),
    surface_reference_count: evidenceRecords.reduce(
      (count, record) => count + record.related_audit_surface_ids.length,
      0,
    ),
    metadata_safe_count: evidenceRecords.filter(
      (record) =>
        record.posture.metadata_only &&
        record.posture.source_material_exposure_enabled === false,
    ).length,
    phase20e_evidence_registry_only: true,
    phase20e_capability_neutral: true,
    posture: POSTURE,
  });
}
