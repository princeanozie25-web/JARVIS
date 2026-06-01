import { z } from "zod";

import {
  AuditDimensionIdSchema,
  AuditSeveritySchema,
  AuditSurfaceIdSchema,
  CrossPhaseAuditPostureSchema,
  type AuditDimensionId,
  type AuditSeverity,
  type AuditSurfaceId,
  type CrossPhaseAuditPosture,
} from "./contracts";
import {
  AuditEvidenceIdSchema,
  CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY,
  type AuditEvidenceId,
} from "./evidence";
import { evaluateCrossPhaseAudit } from "./evaluator";
import { CrossPhaseAuditStatusSchema } from "./results";
import type { CrossPhaseAuditResult, CrossPhaseAuditStatus } from "./results";
import {
  FinalAuthoritySurfaceIdSchema,
  getFinalAuthoritySurfaceInventory,
  summarizeAuthoritySurfacePosture,
  type FinalAuthoritySurfaceId,
  type FinalAuthoritySurfaceRecord,
} from "../final-system-status";
import { buildGovernanceAuditReport } from "./governance-audit";
import { buildDisabledFeatureAuditReport } from "./disabled-feature-audit";

export const AUTHORITY_SURFACE_AUDIT_VERSION = "20E.7" as const;

export const AUTHORITY_SURFACE_AUDIT_FINDING_IDS = [
  "authority-surface-audit:model-runtime",
  "authority-surface-audit:local-providers",
  "authority-surface-audit:cloud-providers",
  "authority-surface-audit:voice-runtime",
  "authority-surface-audit:vision-runtime",
  "authority-surface-audit:room-adapter-runtime",
  "authority-surface-audit:scheduler-routines",
  "authority-surface-audit:approval-service",
  "authority-surface-audit:tool-runtime",
  "authority-surface-audit:command-center-ui",
  "authority-surface-audit:architecture-graph",
  "authority-surface-audit:telemetry-cockpit",
  "authority-surface-audit:governance-visualizer",
  "authority-surface-audit:red-team-sandbox-cai",
  "authority-surface-audit:event-store-persistence",
  "authority-surface-audit:project-intelligence",
  "authority-surface-audit:memory-bridge",
] as const;

export type AuthoritySurfaceAuditFindingId =
  (typeof AUTHORITY_SURFACE_AUDIT_FINDING_IDS)[number];
export type AuthoritySurfaceAuditSeverity = AuditSeverity;

export const AuthoritySurfaceAuditFindingIdSchema = z.enum(
  AUTHORITY_SURFACE_AUDIT_FINDING_IDS,
);
export const AuthoritySurfaceAuditSeveritySchema = AuditSeveritySchema;

export const AuthoritySurfaceAuditFindingSchema = z.strictObject({
  finding_id: AuthoritySurfaceAuditFindingIdSchema,
  title: z.string().trim().min(1).max(180),
  authority_surface_id: FinalAuthoritySurfaceIdSchema,
  severity: AuthoritySurfaceAuditSeveritySchema,
  status: CrossPhaseAuditStatusSchema,
  represented_in_inventory: z.boolean(),
  execution_governed: z.boolean(),
  network_governed: z.boolean(),
  ui_observability_read_only: z.boolean(),
  sandbox_whitelist_governed: z.boolean(),
  auto_approval_denied: z.boolean(),
  payload_exposure_denied: z.boolean(),
  deferred_surface_preserved: z.boolean(),
  audit_surface_ids: z.array(AuditSurfaceIdSchema).min(1),
  audit_dimension_ids: z.array(AuditDimensionIdSchema).min(1),
  evidence_ids: z.array(AuditEvidenceIdSchema).min(1),
  summary: z.string().trim().min(1).max(520),
  authority_posture: z.string().trim().min(1).max(520),
  remediation_hint: z.string().trim().min(1).max(420),
  blocking: z.boolean(),
  warning: z.boolean(),
  deferred_limitation_posture: z.string().trim().min(1).max(420),
  posture: CrossPhaseAuditPostureSchema,
});

export const AuthoritySurfaceAuditSummarySchema = z.strictObject({
  report_version: z.literal(AUTHORITY_SURFACE_AUDIT_VERSION),
  finding_count: z.number().int().nonnegative(),
  represented_count: z.number().int().nonnegative(),
  pass_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  pending_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  fail_count: z.number().int().nonnegative(),
  blocking_count: z.number().int().nonnegative(),
  critical_count: z.number().int().nonnegative(),
  high_count: z.number().int().nonnegative(),
  medium_count: z.number().int().nonnegative(),
  low_count: z.number().int().nonnegative(),
  execution_governed_count: z.number().int().nonnegative(),
  network_governed_count: z.number().int().nonnegative(),
  read_only_ui_observability_count: z.number().int().nonnegative(),
  sandbox_whitelist_governed_count: z.number().int().nonnegative(),
  auto_approval_denied_count: z.number().int().nonnegative(),
  payload_exposure_denied_count: z.number().int().nonnegative(),
  evidence_reference_count: z.number().int().nonnegative(),
  inventory_surface_count: z.number().int().nonnegative(),
  inventory_executable_surface_count: z.number().int().nonnegative(),
  inventory_network_capable_surface_count: z.number().int().nonnegative(),
  governance_audit_blocking_count: z.number().int().nonnegative(),
  disabled_feature_audit_blocking_count: z.number().int().nonnegative(),
  all_authority_surfaces_governed: z.boolean(),
  phase20e_authority_audit_metadata_only: z.literal(true),
  phase20e_capability_neutral: z.literal(true),
  posture: CrossPhaseAuditPostureSchema,
});

export const AuthoritySurfaceAuditReportSchema = z.strictObject({
  report_version: z.literal(AUTHORITY_SURFACE_AUDIT_VERSION),
  report_id: z.literal("phase-20e7-authority-surface-audit"),
  phase: z.literal("20E.7"),
  verdict: z.enum(["pass", "pass_with_warnings", "blocked", "pending"]),
  findings: z.array(AuthoritySurfaceAuditFindingSchema),
  blocking_findings: z.array(AuthoritySurfaceAuditFindingSchema),
  warnings: z.array(AuthoritySurfaceAuditFindingSchema),
  deferred_findings: z.array(AuthoritySurfaceAuditFindingSchema),
  summary: AuthoritySurfaceAuditSummarySchema,
  posture: CrossPhaseAuditPostureSchema,
});

export type AuthoritySurfaceAuditFinding = z.infer<
  typeof AuthoritySurfaceAuditFindingSchema
>;
export type AuthoritySurfaceAuditSummary = z.infer<
  typeof AuthoritySurfaceAuditSummarySchema
>;
export type AuthoritySurfaceAuditReport = z.infer<
  typeof AuthoritySurfaceAuditReportSchema
>;

type AuthoritySurfaceAuditFocus = {
  finding_id: AuthoritySurfaceAuditFindingId;
  authority_surface_id: FinalAuthoritySurfaceId;
  severity: AuthoritySurfaceAuditSeverity;
  audit_surface_ids: readonly AuditSurfaceId[];
  audit_dimension_ids: readonly AuditDimensionId[];
  evidence_ids: readonly AuditEvidenceId[];
};

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

const READ_ONLY_OBSERVABILITY_SURFACES = new Set<FinalAuthoritySurfaceId>([
  "authority-surface:command-center-ui",
  "authority-surface:architecture-graph",
  "authority-surface:telemetry-cockpit",
  "authority-surface:governance-visualizer",
]);

const DEFERRED_OR_GATED_SURFACES = new Set<FinalAuthoritySurfaceId>([
  "authority-surface:cloud-providers",
  "authority-surface:voice-runtime",
  "authority-surface:scheduler-routines",
  "authority-surface:red-team-sandbox-cai",
]);

const FOCUS: readonly AuthoritySurfaceAuditFocus[] = [
  {
    finding_id: "authority-surface-audit:model-runtime",
    authority_surface_id: "authority-surface:model-runtime",
    severity: "high",
    audit_surface_ids: ["audit-surface:phase-13-model-runtime"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:local-first-posture",
      "audit-dimension:provider-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:model-runtime-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:local-providers",
    authority_surface_id: "authority-surface:local-providers",
    severity: "high",
    audit_surface_ids: ["audit-surface:phase-13-model-runtime"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:local-first-posture",
      "audit-dimension:provider-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:model-runtime-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:cloud-providers",
    authority_surface_id: "authority-surface:cloud-providers",
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-13-model-runtime",
      "audit-surface:phase-20b-bootstrap",
    ],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:provider-posture",
      "audit-dimension:local-first-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:model-runtime-closeout",
      "audit-evidence:bootstrap-doctor-report-path",
    ],
  },
  {
    finding_id: "authority-surface-audit:voice-runtime",
    authority_surface_id: "authority-surface:voice-runtime",
    severity: "critical",
    audit_surface_ids: ["audit-surface:phase-14-voice-runtime"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:approval-boundaries",
      "audit-dimension:redaction-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:voice-runtime-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:vision-runtime",
    authority_surface_id: "authority-surface:vision-runtime",
    severity: "high",
    audit_surface_ids: ["audit-surface:phase-15-vision-runtime"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:redaction-posture",
      "audit-dimension:local-first-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:vision-runtime-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:room-adapter-runtime",
    authority_surface_id: "authority-surface:room-adapter-runtime",
    severity: "critical",
    audit_surface_ids: ["audit-surface:phase-16-room-runtime"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:approval-boundaries",
      "audit-dimension:onboarding-readiness",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:room-runtime-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:scheduler-routines",
    authority_surface_id: "authority-surface:scheduler-routines",
    severity: "high",
    audit_surface_ids: ["audit-surface:phase-17-scheduled-assistance"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:approval-boundaries",
      "audit-dimension:replay-safety",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:scheduler-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:approval-service",
    authority_surface_id: "authority-surface:approval-service",
    severity: "critical",
    audit_surface_ids: ["audit-surface:phase-18-approval-runtime"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:approval-boundaries",
      "audit-dimension:governance",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:approval-runtime-closeout",
      "audit-evidence:governance-readiness-summary",
    ],
  },
  {
    finding_id: "authority-surface-audit:tool-runtime",
    authority_surface_id: "authority-surface:tool-runtime",
    severity: "critical",
    audit_surface_ids: ["audit-surface:phase-18-approval-runtime"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:approval-boundaries",
      "audit-dimension:governance",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:approval-runtime-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:command-center-ui",
    authority_surface_id: "authority-surface:command-center-ui",
    severity: "medium",
    audit_surface_ids: ["audit-surface:phase-12-command-center"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:observability",
      "audit-dimension:redaction-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:command-center-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:architecture-graph",
    authority_surface_id: "authority-surface:architecture-graph",
    severity: "medium",
    audit_surface_ids: ["audit-surface:phase-19-fortress-layer"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:replay-safety",
      "audit-dimension:auditability",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:architecture-graph",
    ],
  },
  {
    finding_id: "authority-surface-audit:telemetry-cockpit",
    authority_surface_id: "authority-surface:telemetry-cockpit",
    severity: "medium",
    audit_surface_ids: [
      "audit-surface:phase-12-command-center",
      "audit-surface:phase-19-fortress-layer",
    ],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:observability",
      "audit-dimension:redaction-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:telemetry-cockpit",
    ],
  },
  {
    finding_id: "authority-surface-audit:governance-visualizer",
    authority_surface_id: "authority-surface:governance-visualizer",
    severity: "medium",
    audit_surface_ids: [
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-20d-portfolio",
    ],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:approval-boundaries",
      "audit-dimension:governance",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:governance-visualizer",
    ],
  },
  {
    finding_id: "authority-surface-audit:red-team-sandbox-cai",
    authority_surface_id: "authority-surface:red-team-sandbox-cai",
    severity: "critical",
    audit_surface_ids: ["audit-surface:phase-19-fortress-layer"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:provider-posture",
      "audit-dimension:disabled-features",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:red-team-sandbox-cai-posture",
    ],
  },
  {
    finding_id: "authority-surface-audit:event-store-persistence",
    authority_surface_id: "authority-surface:event-store-persistence",
    severity: "medium",
    audit_surface_ids: ["audit-surface:phase-11-persistence"],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:replay-safety",
      "audit-dimension:redaction-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:persistence-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:project-intelligence",
    authority_surface_id: "authority-surface:project-intelligence",
    severity: "medium",
    audit_surface_ids: [
      "audit-surface:phase-10-room-os",
      "audit-surface:phase-11-persistence",
      "audit-surface:phase-12-command-center",
    ],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:auditability",
      "audit-dimension:redaction-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:final-system-status-registry",
      "audit-evidence:command-center-closeout",
    ],
  },
  {
    finding_id: "authority-surface-audit:memory-bridge",
    authority_surface_id: "authority-surface:memory-bridge",
    severity: "medium",
    audit_surface_ids: [
      "audit-surface:phase-11-persistence",
      "audit-surface:phase-13-model-runtime",
    ],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:redaction-posture",
      "audit-dimension:provider-posture",
    ],
    evidence_ids: [
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:persistence-closeout",
      "audit-evidence:model-runtime-closeout",
    ],
  },
] as const;

function inventoryById(): Map<
  FinalAuthoritySurfaceId,
  FinalAuthoritySurfaceRecord
> {
  return new Map(
    getFinalAuthoritySurfaceInventory().map((surface) => [
      surface.surface_id,
      surface,
    ]),
  );
}

function evidenceIdsKnown(evidenceIds: readonly AuditEvidenceId[]): boolean {
  const knownEvidenceIds = new Set(
    CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence.map(
      (record) => record.evidence_id,
    ),
  );

  return evidenceIds.every((evidenceId) => knownEvidenceIds.has(evidenceId));
}

function hasExecutionAuthority(surface: FinalAuthoritySurfaceRecord): boolean {
  return !["none", "cloud_runtime_disabled"].includes(
    surface.execute_authority,
  );
}

function isNetworkPostureGoverned(
  surface: FinalAuthoritySurfaceRecord,
): boolean {
  return [
    "none",
    "local_only",
    "lan_local_only",
    "cloud_disabled_by_default",
    "cloud_opt_in_gated",
    "sandbox_whitelist_only",
  ].includes(surface.network_posture);
}

function isExecutionGoverned(surface: FinalAuthoritySurfaceRecord): boolean {
  if (!hasExecutionAuthority(surface)) {
    return true;
  }

  return surface.approval_requirement !== "disabled_no_approval_path";
}

function isUiObservabilityReadOnly(
  surface: FinalAuthoritySurfaceRecord,
): boolean {
  if (!READ_ONLY_OBSERVABILITY_SURFACES.has(surface.surface_id)) {
    return true;
  }

  return (
    surface.write_authority === "none" &&
    surface.execute_authority === "none" &&
    surface.final_phase20_posture === "read_only_metadata_inventory"
  );
}

function isSandboxWhitelisted(surface: FinalAuthoritySurfaceRecord): boolean {
  if (surface.surface_id !== "authority-surface:red-team-sandbox-cai") {
    return true;
  }

  return (
    surface.execute_authority === "sandbox_dry_run_only" &&
    surface.network_posture === "sandbox_whitelist_only" &&
    surface.approval_requirement === "approval_required_for_red_team_classes"
  );
}

function isDeferredPreserved(surface: FinalAuthoritySurfaceRecord): boolean {
  if (!DEFERRED_OR_GATED_SURFACES.has(surface.surface_id)) {
    return true;
  }

  return surface.final_phase20_posture === "remains_disabled_or_gated";
}

function evaluatorSupports(
  focus: AuthoritySurfaceAuditFocus,
  evaluatedResults: readonly CrossPhaseAuditResult[],
): boolean {
  const surfaceIds = new Set(focus.audit_surface_ids);
  const dimensionIds = new Set(focus.audit_dimension_ids);

  return evaluatedResults
    .filter(
      (result) =>
        surfaceIds.has(result.audit_surface_id) &&
        dimensionIds.has(result.audit_dimension_id),
    )
    .every((result) => result.status !== "fail");
}

function determineStatus(
  surface: FinalAuthoritySurfaceRecord | undefined,
  valid: boolean,
): CrossPhaseAuditStatus {
  if (!surface || !valid) {
    return "fail";
  }

  if (DEFERRED_OR_GATED_SURFACES.has(surface.surface_id)) {
    return "deferred";
  }

  if (READ_ONLY_OBSERVABILITY_SURFACES.has(surface.surface_id)) {
    return "warning";
  }

  return "pass";
}

function buildFinding(
  focus: AuthoritySurfaceAuditFocus,
  surfacesById: Map<FinalAuthoritySurfaceId, FinalAuthoritySurfaceRecord>,
  evaluatedResults: readonly CrossPhaseAuditResult[],
): AuthoritySurfaceAuditFinding {
  const surface = surfacesById.get(focus.authority_surface_id);
  const represented = !!surface;
  const executionGoverned = represented && isExecutionGoverned(surface);
  const networkGoverned = represented && isNetworkPostureGoverned(surface);
  const readOnly = represented && isUiObservabilityReadOnly(surface);
  const sandboxed = represented && isSandboxWhitelisted(surface);
  const autoApprovalDenied = represented && !surface.auto_approval_allowed;
  const payloadDenied =
    represented && surface.raw_payload_posture !== "raw_forbidden"
      ? surface.raw_payload_posture === "metadata_only_redacted" ||
        surface.raw_payload_posture === "in_memory_only_redacted_boundary"
      : represented;
  const deferredPreserved = represented && isDeferredPreserved(surface);
  const valid =
    represented &&
    executionGoverned &&
    networkGoverned &&
    readOnly &&
    sandboxed &&
    autoApprovalDenied &&
    payloadDenied &&
    deferredPreserved &&
    evidenceIdsKnown(focus.evidence_ids) &&
    evaluatorSupports(focus, evaluatedResults) &&
    surface.metadata_only &&
    surface.read_only &&
    surface.deterministic &&
    surface.inventory_only &&
    !surface.creates_new_authority_surface &&
    !surface.reclassifies_existing_surface &&
    !surface.weakens_disabled_feature_matrix &&
    !surface.provider_call_performed &&
    !surface.network_call_performed &&
    !surface.runtime_filesystem_mutation_performed &&
    !surface.room_device_action_performed &&
    !surface.raw_payload_field_included;
  const status = determineStatus(surface, valid);
  const blocking =
    status === "fail" &&
    (focus.severity === "critical" || focus.severity === "high");

  return AuthoritySurfaceAuditFindingSchema.parse({
    finding_id: focus.finding_id,
    title: surface?.label ?? focus.authority_surface_id,
    authority_surface_id: focus.authority_surface_id,
    severity: focus.severity,
    status,
    represented_in_inventory: represented,
    execution_governed: executionGoverned,
    network_governed: networkGoverned,
    ui_observability_read_only: readOnly,
    sandbox_whitelist_governed: sandboxed,
    auto_approval_denied: autoApprovalDenied,
    payload_exposure_denied: payloadDenied,
    deferred_surface_preserved: deferredPreserved,
    audit_surface_ids: [...focus.audit_surface_ids],
    audit_dimension_ids: [...focus.audit_dimension_ids],
    evidence_ids: [...new Set(focus.evidence_ids)],
    summary: represented
      ? `${surface.label} remains represented in the Phase 20A authority inventory with bounded metadata-only posture.`
      : `${focus.authority_surface_id} is not represented in the Phase 20A authority inventory.`,
    authority_posture: represented
      ? `read=${surface.read_authority}; write=${surface.write_authority}; execute=${surface.execute_authority}; approval=${surface.approval_requirement}; network=${surface.network_posture}; payload=${surface.raw_payload_posture}; final=${surface.final_phase20_posture}.`
      : "Authority posture is unavailable because the surface is missing from inventory.",
    remediation_hint: represented
      ? "Preserve inventory-only posture; require explicit architecture amendment before reclassification or enablement."
      : "Add metadata-only inventory coverage before treating this authority surface as audited.",
    blocking,
    warning: status === "warning",
    deferred_limitation_posture:
      status === "deferred"
        ? "Surface remains disabled or gated by existing authority and disabled-feature posture."
        : "Surface is audited from existing metadata only; no live authority or runtime inspection occurred.",
    posture: POSTURE,
  });
}

function summarizeFindings(
  findings: readonly AuthoritySurfaceAuditFinding[],
): AuthoritySurfaceAuditSummary {
  const authoritySummary = summarizeAuthoritySurfacePosture();
  const governance = buildGovernanceAuditReport();
  const disabledFeature = buildDisabledFeatureAuditReport();

  return AuthoritySurfaceAuditSummarySchema.parse({
    report_version: AUTHORITY_SURFACE_AUDIT_VERSION,
    finding_count: findings.length,
    represented_count: findings.filter(
      (finding) => finding.represented_in_inventory,
    ).length,
    pass_count: findings.filter((finding) => finding.status === "pass").length,
    warning_count: findings.filter((finding) => finding.status === "warning")
      .length,
    pending_count: findings.filter((finding) => finding.status === "pending")
      .length,
    deferred_count: findings.filter((finding) => finding.status === "deferred")
      .length,
    fail_count: findings.filter((finding) => finding.status === "fail").length,
    blocking_count: findings.filter((finding) => finding.blocking).length,
    critical_count: findings.filter(
      (finding) => finding.severity === "critical",
    ).length,
    high_count: findings.filter((finding) => finding.severity === "high")
      .length,
    medium_count: findings.filter((finding) => finding.severity === "medium")
      .length,
    low_count: findings.filter((finding) => finding.severity === "low").length,
    execution_governed_count: findings.filter(
      (finding) => finding.execution_governed,
    ).length,
    network_governed_count: findings.filter(
      (finding) => finding.network_governed,
    ).length,
    read_only_ui_observability_count: findings.filter(
      (finding) => finding.ui_observability_read_only,
    ).length,
    sandbox_whitelist_governed_count: findings.filter(
      (finding) => finding.sandbox_whitelist_governed,
    ).length,
    auto_approval_denied_count: findings.filter(
      (finding) => finding.auto_approval_denied,
    ).length,
    payload_exposure_denied_count: findings.filter(
      (finding) => finding.payload_exposure_denied,
    ).length,
    evidence_reference_count: findings.reduce(
      (count, finding) => count + finding.evidence_ids.length,
      0,
    ),
    inventory_surface_count: authoritySummary.surface_count,
    inventory_executable_surface_count:
      authoritySummary.executable_surface_count,
    inventory_network_capable_surface_count:
      authoritySummary.network_capable_surface_count,
    governance_audit_blocking_count: governance.summary.blocking_count,
    disabled_feature_audit_blocking_count:
      disabledFeature.summary.blocking_count,
    all_authority_surfaces_governed: findings.every(
      (finding) =>
        finding.represented_in_inventory &&
        finding.execution_governed &&
        finding.network_governed &&
        finding.auto_approval_denied &&
        finding.payload_exposure_denied &&
        !finding.blocking,
    ),
    phase20e_authority_audit_metadata_only: true,
    phase20e_capability_neutral: true,
    posture: POSTURE,
  });
}

function determineVerdict(
  summary: AuthoritySurfaceAuditSummary,
): AuthoritySurfaceAuditReport["verdict"] {
  if (summary.blocking_count > 0 || summary.fail_count > 0) {
    return "blocked";
  }

  if (summary.pending_count > 0) {
    return "pending";
  }

  if (summary.warning_count > 0 || summary.deferred_count > 0) {
    return "pass_with_warnings";
  }

  return "pass";
}

export function buildAuthoritySurfaceAuditReport(): AuthoritySurfaceAuditReport {
  const surfacesById = inventoryById();
  const evaluation = evaluateCrossPhaseAudit();
  const findings = FOCUS.map((focus) =>
    buildFinding(focus, surfacesById, evaluation.results),
  );
  const summary = summarizeFindings(findings);

  return AuthoritySurfaceAuditReportSchema.parse({
    report_version: AUTHORITY_SURFACE_AUDIT_VERSION,
    report_id: "phase-20e7-authority-surface-audit",
    phase: "20E.7",
    verdict: determineVerdict(summary),
    findings,
    blocking_findings: findings.filter((finding) => finding.blocking),
    warnings: findings.filter((finding) => finding.warning),
    deferred_findings: findings.filter(
      (finding) => finding.status === "deferred",
    ),
    summary,
    posture: POSTURE,
  });
}
