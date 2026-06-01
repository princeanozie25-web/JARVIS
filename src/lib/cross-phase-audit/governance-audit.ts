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
import { AuditEvidenceIdSchema, type AuditEvidenceId } from "./evidence";
import { evaluateCrossPhaseAudit } from "./evaluator";
import {
  CrossPhaseAuditStatusSchema,
  type CrossPhaseAuditResult,
  type CrossPhaseAuditStatus,
} from "./results";
import {
  buildFinalGovernanceReadinessSummary,
  buildPhase20ACloseoutReport,
} from "../final-system-status";
import { buildPhase20BCloseoutReport } from "../bootstrap-readiness";
import { buildPhase20CCloseoutReport } from "../onboarding-readiness";
import { buildPhase20DCloseoutReport } from "../portfolio-readiness";

export const GOVERNANCE_AUDIT_VERSION = "20E.5" as const;

export const GOVERNANCE_AUDIT_FINDING_IDS = [
  "governance-audit:approval-boundaries",
  "governance-audit:authority-surfaces",
  "governance-audit:execution-gating",
  "governance-audit:local-first-posture",
  "governance-audit:cloud-gated-posture",
  "governance-audit:governance-visualizer-posture",
  "governance-audit:approval-runtime-posture",
  "governance-audit:room-runtime-governance",
  "governance-audit:model-runtime-governance",
  "governance-audit:voice-governance",
  "governance-audit:vision-governance",
  "governance-audit:scheduler-governance",
  "governance-audit:red-team-governance",
  "governance-audit:bootstrap-onboarding-governance",
  "governance-audit:portfolio-demo-governance",
] as const;

export const GOVERNANCE_AUDIT_CATEGORIES = [
  "approval_boundaries",
  "authority_surfaces",
  "execution_gating",
  "local_first_posture",
  "cloud_gated_posture",
  "governance_visualizer_posture",
  "approval_runtime_posture",
  "room_runtime_governance",
  "model_runtime_governance",
  "voice_governance",
  "vision_governance",
  "scheduler_governance",
  "red_team_governance",
  "bootstrap_onboarding_governance",
  "portfolio_demo_governance",
] as const;

export type GovernanceAuditFindingId =
  (typeof GOVERNANCE_AUDIT_FINDING_IDS)[number];
export type GovernanceAuditCategory =
  (typeof GOVERNANCE_AUDIT_CATEGORIES)[number];
export type GovernanceAuditSeverity = AuditSeverity;

export const GovernanceAuditFindingIdSchema = z.enum(
  GOVERNANCE_AUDIT_FINDING_IDS,
);
export const GovernanceAuditCategorySchema = z.enum(
  GOVERNANCE_AUDIT_CATEGORIES,
);
export const GovernanceAuditSeveritySchema = AuditSeveritySchema;

export const GovernanceAuditFindingSchema = z.strictObject({
  finding_id: GovernanceAuditFindingIdSchema,
  title: z.string().trim().min(1).max(180),
  category: GovernanceAuditCategorySchema,
  severity: GovernanceAuditSeveritySchema,
  status: CrossPhaseAuditStatusSchema,
  audit_surface_ids: z.array(AuditSurfaceIdSchema).min(1),
  audit_dimension_ids: z.array(AuditDimensionIdSchema).min(1),
  evidence_ids: z.array(AuditEvidenceIdSchema).min(1),
  summary: z.string().trim().min(1).max(520),
  governance_posture: z.string().trim().min(1).max(420),
  remediation_hint: z.string().trim().min(1).max(420),
  blocking: z.boolean(),
  warning: z.boolean(),
  deferred_limitation_posture: z.string().trim().min(1).max(420),
  posture: CrossPhaseAuditPostureSchema,
});

export const GovernanceAuditSummarySchema = z.strictObject({
  report_version: z.literal(GOVERNANCE_AUDIT_VERSION),
  finding_count: z.number().int().nonnegative(),
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
  represented_surface_count: z.number().int().nonnegative(),
  represented_dimension_count: z.number().int().nonnegative(),
  evidence_reference_count: z.number().int().nonnegative(),
  governance_ready: z.boolean(),
  phase20e_governance_audit_metadata_only: z.literal(true),
  phase20e_capability_neutral: z.literal(true),
  posture: CrossPhaseAuditPostureSchema,
});

export const GovernanceAuditSourceSummarySchema = z.strictObject({
  evaluator_version: z.literal("20E.4"),
  phase20a_complete: z.boolean(),
  phase20b_complete: z.boolean(),
  phase20c_complete: z.boolean(),
  phase20d_complete: z.boolean(),
  governance_ready_for_phase20_hardening: z.boolean(),
  metadata_only_sources: z.literal(true),
});

export const GovernanceAuditReportSchema = z.strictObject({
  report_version: z.literal(GOVERNANCE_AUDIT_VERSION),
  report_id: z.literal("phase-20e5-governance-boundary-audit"),
  phase: z.literal("20E.5"),
  verdict: z.enum(["pass", "pass_with_warnings", "blocked", "pending"]),
  findings: z.array(GovernanceAuditFindingSchema),
  blocking_findings: z.array(GovernanceAuditFindingSchema),
  warnings: z.array(GovernanceAuditFindingSchema),
  summary: GovernanceAuditSummarySchema,
  source_summary: GovernanceAuditSourceSummarySchema,
  posture: CrossPhaseAuditPostureSchema,
});

export type GovernanceAuditFinding = z.infer<
  typeof GovernanceAuditFindingSchema
>;
export type GovernanceAuditSummary = z.infer<
  typeof GovernanceAuditSummarySchema
>;
export type GovernanceAuditSourceSummary = z.infer<
  typeof GovernanceAuditSourceSummarySchema
>;
export type GovernanceAuditReport = z.infer<typeof GovernanceAuditReportSchema>;

type GovernanceAuditFocus = {
  finding_id: GovernanceAuditFindingId;
  title: string;
  category: GovernanceAuditCategory;
  severity: GovernanceAuditSeverity;
  audit_surface_ids: readonly AuditSurfaceId[];
  audit_dimension_ids: readonly AuditDimensionId[];
  summary: string;
  governance_posture: string;
  remediation_hint: string;
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

const FOCUS: readonly GovernanceAuditFocus[] = [
  {
    finding_id: "governance-audit:approval-boundaries",
    title: "Approval boundaries",
    category: "approval_boundaries",
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-20a-readiness",
      "audit-surface:phase-20c-onboarding",
    ],
    audit_dimension_ids: [
      "audit-dimension:approval-boundaries",
      "audit-dimension:governance",
    ],
    summary:
      "Approval boundaries remain represented through approval runtime, governance readiness, and onboarding safety metadata.",
    governance_posture:
      "Side-effect paths stay approval-gated; no voice-only approval or approval bypass posture is introduced.",
    remediation_hint:
      "Keep approval lifecycle evidence linked before any future runtime or device action is treated as auditable.",
  },
  {
    finding_id: "governance-audit:authority-surfaces",
    title: "Authority surfaces",
    category: "authority_surfaces",
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-13-model-runtime",
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-20a-readiness",
    ],
    audit_dimension_ids: [
      "audit-dimension:authority-surfaces",
      "audit-dimension:provider-posture",
    ],
    summary:
      "Authority-bearing surfaces remain inventoried through final authority metadata and evaluator results.",
    governance_posture:
      "Authority posture is documented as metadata-only, read-only, approval-gated, sandboxed, or deferred.",
    remediation_hint:
      "Require explicit architecture amendment before any new authority-bearing surface can be added.",
  },
  {
    finding_id: "governance-audit:execution-gating",
    title: "Execution gating",
    category: "execution_gating",
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-17-scheduled-assistance",
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-19-fortress-layer",
    ],
    audit_dimension_ids: [
      "audit-dimension:approval-boundaries",
      "audit-dimension:disabled-features",
      "audit-dimension:replay-safety",
    ],
    summary:
      "Execution-related surfaces remain represented as gated, disabled, deferred, or replay-safe metadata.",
    governance_posture:
      "No graph-driven execution, routine chaining, scheduler side effects, or unapproved room/device actions are enabled.",
    remediation_hint:
      "Preserve execution gates and disabled-feature posture during future audit or packaging work.",
  },
  {
    finding_id: "governance-audit:local-first-posture",
    title: "Local-first posture",
    category: "local_first_posture",
    severity: "high",
    audit_surface_ids: [
      "audit-surface:phase-13-model-runtime",
      "audit-surface:phase-20b-bootstrap",
      "audit-surface:phase-20d-portfolio",
    ],
    audit_dimension_ids: [
      "audit-dimension:local-first-posture",
      "audit-dimension:provider-posture",
    ],
    summary:
      "Local-first posture remains visible across runtime, bootstrap, and portfolio metadata.",
    governance_posture:
      "Local-first remains the default; cloud behavior is not introduced by the audit layer.",
    remediation_hint:
      "Keep cloud/provider posture explicit and opt-in in any future operational audit output.",
  },
  {
    finding_id: "governance-audit:cloud-gated-posture",
    title: "Cloud-gated posture",
    category: "cloud_gated_posture",
    severity: "high",
    audit_surface_ids: [
      "audit-surface:phase-13-model-runtime",
      "audit-surface:phase-19-fortress-layer",
      "audit-surface:phase-20b-bootstrap",
    ],
    audit_dimension_ids: [
      "audit-dimension:provider-posture",
      "audit-dimension:local-first-posture",
      "audit-dimension:redaction-posture",
    ],
    summary:
      "Provider and cloud posture remains disabled, local-first, cloud-gated, or whitelisted in metadata.",
    governance_posture:
      "The governance audit does not call providers or reclassify cloud defaults.",
    remediation_hint:
      "Require consent, budget, redaction, and provider-governance evidence before future cloud use is audited as ready.",
  },
  {
    finding_id: "governance-audit:governance-visualizer-posture",
    title: "Governance visualizer posture",
    category: "governance_visualizer_posture",
    severity: "medium",
    audit_surface_ids: [
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-20d-portfolio",
    ],
    audit_dimension_ids: [
      "audit-dimension:governance",
      "audit-dimension:authority-surfaces",
      "audit-dimension:approval-boundaries",
    ],
    summary:
      "Governance visualization remains represented as metadata-only and non-routing evidence.",
    governance_posture:
      "Visualizer posture is evidence-only and does not create a new UI route or authority surface.",
    remediation_hint:
      "Keep governance visualization read-only until a future UI slice explicitly authorizes rendering.",
  },
  {
    finding_id: "governance-audit:approval-runtime-posture",
    title: "Approval runtime posture",
    category: "approval_runtime_posture",
    severity: "critical",
    audit_surface_ids: ["audit-surface:phase-18-approval-runtime"],
    audit_dimension_ids: [
      "audit-dimension:approval-boundaries",
      "audit-dimension:authority-surfaces",
      "audit-dimension:governance",
    ],
    summary:
      "Approval runtime posture remains the governed lifecycle anchor for side-effect boundaries.",
    governance_posture:
      "Approval evidence is metadata-only and does not execute approvals or mint usable authority.",
    remediation_hint:
      "Preserve approval runtime closeout evidence as the source of truth for future authority audits.",
  },
  {
    finding_id: "governance-audit:room-runtime-governance",
    title: "Room runtime governance",
    category: "room_runtime_governance",
    severity: "high",
    audit_surface_ids: [
      "audit-surface:phase-10-room-os",
      "audit-surface:phase-16-room-runtime",
      "audit-surface:phase-20c-onboarding",
    ],
    audit_dimension_ids: [
      "audit-dimension:approval-boundaries",
      "audit-dimension:disabled-features",
      "audit-dimension:onboarding-readiness",
    ],
    summary:
      "Room runtime governance remains fake-room/deferred-device oriented with approval safety represented.",
    governance_posture:
      "Real device onboarding and unapproved room/device actions remain deferred.",
    remediation_hint:
      "Keep hardware onboarding deferred until config, hardware, and approval governance are present.",
  },
  {
    finding_id: "governance-audit:model-runtime-governance",
    title: "Model runtime governance",
    category: "model_runtime_governance",
    severity: "high",
    audit_surface_ids: ["audit-surface:phase-13-model-runtime"],
    audit_dimension_ids: [
      "audit-dimension:local-first-posture",
      "audit-dimension:provider-posture",
      "audit-dimension:redaction-posture",
    ],
    summary:
      "Model runtime governance remains local-first with provider posture represented as metadata.",
    governance_posture:
      "The governance audit does not invoke local or cloud model runtimes.",
    remediation_hint:
      "Keep provider escalation and model invocation outside metadata-only audit slices.",
  },
  {
    finding_id: "governance-audit:voice-governance",
    title: "Voice governance",
    category: "voice_governance",
    severity: "high",
    audit_surface_ids: ["audit-surface:phase-14-voice-runtime"],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
      "audit-dimension:redaction-posture",
    ],
    summary:
      "Voice governance keeps wake word, always-listening, and voice-only approval disabled.",
    governance_posture:
      "Voice runtime evidence is redacted metadata only; no microphone or voice runtime execution occurs.",
    remediation_hint:
      "Preserve disabled voice posture until a future architecture amendment authorizes changes.",
  },
  {
    finding_id: "governance-audit:vision-governance",
    title: "Vision governance",
    category: "vision_governance",
    severity: "high",
    audit_surface_ids: ["audit-surface:phase-15-vision-runtime"],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:redaction-posture",
      "audit-dimension:local-first-posture",
    ],
    summary:
      "Vision governance keeps hidden capture, background camera, and provider-backed vision disabled.",
    governance_posture:
      "Vision evidence is redacted metadata only; no camera or vision runtime execution occurs.",
    remediation_hint:
      "Keep capture boundaries disabled unless future architecture explicitly updates them.",
  },
  {
    finding_id: "governance-audit:scheduler-governance",
    title: "Scheduler governance",
    category: "scheduler_governance",
    severity: "high",
    audit_surface_ids: ["audit-surface:phase-17-scheduled-assistance"],
    audit_dimension_ids: [
      "audit-dimension:approval-boundaries",
      "audit-dimension:disabled-features",
      "audit-dimension:replay-safety",
    ],
    summary:
      "Scheduler governance keeps side effects, routine chaining, and unapproved actions disabled.",
    governance_posture:
      "Scheduled assistance remains approval-gated metadata for audit purposes.",
    remediation_hint:
      "Keep scheduler execution out of audit reporting unless future governed runtime evidence is introduced.",
  },
  {
    finding_id: "governance-audit:red-team-governance",
    title: "Red-team governance",
    category: "red_team_governance",
    severity: "high",
    audit_surface_ids: [
      "audit-surface:phase-19-fortress-layer",
      "audit-surface:phase-20d-portfolio",
    ],
    audit_dimension_ids: [
      "audit-dimension:governance",
      "audit-dimension:provider-posture",
      "audit-dimension:disabled-features",
      "audit-dimension:redaction-posture",
    ],
    summary:
      "Red-team governance remains sandboxed, synthetic, and CAI target constrained.",
    governance_posture:
      "No attack execution, provider escalation, or non-whitelisted CAI target is enabled.",
    remediation_hint:
      "Keep red-team posture sandboxed and synthetic until an explicit governed test-runner exists.",
  },
  {
    finding_id: "governance-audit:bootstrap-onboarding-governance",
    title: "Bootstrap and onboarding governance",
    category: "bootstrap_onboarding_governance",
    severity: "medium",
    audit_surface_ids: [
      "audit-surface:phase-20b-bootstrap",
      "audit-surface:phase-20c-onboarding",
    ],
    audit_dimension_ids: [
      "audit-dimension:onboarding-readiness",
      "audit-dimension:local-first-posture",
      "audit-dimension:approval-boundaries",
    ],
    summary:
      "Bootstrap and onboarding governance remain represented without installer automation or runtime setup execution.",
    governance_posture:
      "Doctor, onboarding, and move-in paths remain read-only metadata unless safe local checks are explicitly in scope.",
    remediation_hint:
      "Keep onboarding and bootstrap audit output separate from installation, auto-fix, and mutation paths.",
  },
  {
    finding_id: "governance-audit:portfolio-demo-governance",
    title: "Portfolio and demo governance",
    category: "portfolio_demo_governance",
    severity: "medium",
    audit_surface_ids: ["audit-surface:phase-20d-portfolio"],
    audit_dimension_ids: [
      "audit-dimension:portfolio-readiness",
      "audit-dimension:governance",
      "audit-dimension:redaction-posture",
    ],
    summary:
      "Portfolio and demo governance remain recruiter-ready metadata without rendering or demo execution.",
    governance_posture:
      "Demo surfaces, flows, narratives, and reports remain source-material-safe and capability-neutral.",
    remediation_hint:
      "Keep portfolio/demo audit posture separated from presentation generation or live demo automation.",
  },
];

function uniqueEvidenceIds(
  values: readonly AuditEvidenceId[],
): AuditEvidenceId[] {
  return [...new Set(values)];
}

function deriveStatus(
  statuses: readonly CrossPhaseAuditStatus[],
): GovernanceAuditFinding["status"] {
  if (statuses.includes("fail")) {
    return "fail";
  }

  if (statuses.includes("pending")) {
    return "pending";
  }

  if (statuses.includes("warning")) {
    return "warning";
  }

  if (statuses.includes("deferred")) {
    return "deferred";
  }

  return "pass";
}

function buildFinding(
  focus: GovernanceAuditFocus,
  evaluatedResults: readonly CrossPhaseAuditResult[],
): GovernanceAuditFinding {
  const surfaceIds = new Set(focus.audit_surface_ids);
  const dimensionIds = new Set(focus.audit_dimension_ids);
  const matchingResults = evaluatedResults.filter(
    (result) =>
      surfaceIds.has(result.audit_surface_id) &&
      dimensionIds.has(result.audit_dimension_id),
  );
  const status = deriveStatus(matchingResults.map((result) => result.status));
  const evidenceIds = uniqueEvidenceIds(
    matchingResults.flatMap((result) => result.evidence_ids),
  );
  const blocking =
    status === "fail" &&
    (focus.severity === "critical" || focus.severity === "high");

  return GovernanceAuditFindingSchema.parse({
    finding_id: focus.finding_id,
    title: focus.title,
    category: focus.category,
    severity: focus.severity,
    status,
    audit_surface_ids: [...focus.audit_surface_ids],
    audit_dimension_ids: [...focus.audit_dimension_ids],
    evidence_ids: evidenceIds,
    summary: focus.summary,
    governance_posture: focus.governance_posture,
    remediation_hint: focus.remediation_hint,
    blocking,
    warning: status === "warning",
    deferred_limitation_posture:
      status === "deferred"
        ? "Finding is deferred because existing governance metadata intentionally keeps the risky surface disabled or future-only."
        : "Finding is derived from existing metadata and does not include live runtime observations.",
    posture: POSTURE,
  });
}

function sourceSummary(): GovernanceAuditSourceSummary {
  const phase20a = buildPhase20ACloseoutReport();
  const phase20b = buildPhase20BCloseoutReport();
  const phase20c = buildPhase20CCloseoutReport();
  const phase20d = buildPhase20DCloseoutReport();
  const governance = buildFinalGovernanceReadinessSummary();

  return GovernanceAuditSourceSummarySchema.parse({
    evaluator_version: "20E.4",
    phase20a_complete: phase20a.phase20a_complete,
    phase20b_complete: phase20b.phase_20b_complete,
    phase20c_complete: phase20c.phase_20c_complete,
    phase20d_complete: phase20d.phase_20d_complete,
    governance_ready_for_phase20_hardening:
      governance.governance_ready_for_phase20_hardening,
    metadata_only_sources: true,
  });
}

function summarizeFindings(
  findings: readonly GovernanceAuditFinding[],
): GovernanceAuditSummary {
  return GovernanceAuditSummarySchema.parse({
    report_version: GOVERNANCE_AUDIT_VERSION,
    finding_count: findings.length,
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
    represented_surface_count: new Set(
      findings.flatMap((finding) => finding.audit_surface_ids),
    ).size,
    represented_dimension_count: new Set(
      findings.flatMap((finding) => finding.audit_dimension_ids),
    ).size,
    evidence_reference_count: findings.reduce(
      (count, finding) => count + finding.evidence_ids.length,
      0,
    ),
    governance_ready: findings.every((finding) => !finding.blocking),
    phase20e_governance_audit_metadata_only: true,
    phase20e_capability_neutral: true,
    posture: POSTURE,
  });
}

function determineVerdict(
  summary: GovernanceAuditSummary,
): GovernanceAuditReport["verdict"] {
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

export function buildGovernanceAuditReport(): GovernanceAuditReport {
  const evaluation = evaluateCrossPhaseAudit();
  const findings = FOCUS.map((focus) =>
    buildFinding(focus, evaluation.results),
  );
  const summary = summarizeFindings(findings);

  return GovernanceAuditReportSchema.parse({
    report_version: GOVERNANCE_AUDIT_VERSION,
    report_id: "phase-20e5-governance-boundary-audit",
    phase: "20E.5",
    verdict: determineVerdict(summary),
    findings,
    blocking_findings: findings.filter((finding) => finding.blocking),
    warnings: findings.filter((finding) => finding.warning),
    summary,
    source_summary: sourceSummary(),
    posture: POSTURE,
  });
}
