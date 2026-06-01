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
import type { CrossPhaseAuditResult } from "./results";
import {
  FinalDisabledFeatureIdSchema,
  getFinalDisabledFeatureMatrix,
  summarizeDisabledFeaturePosture,
  type FinalDisabledFeatureId,
  type FinalDisabledFeatureRecord,
} from "../final-system-status";
import {
  getDeferredMoveInChecklistItems,
  summarizeMoveInChecklist,
} from "../onboarding-readiness";

export const DISABLED_FEATURE_AUDIT_VERSION = "20E.6" as const;

export const DISABLED_FEATURE_AUDIT_FINDING_IDS = [
  "disabled-feature-audit:wake-word",
  "disabled-feature-audit:conversation-mode",
  "disabled-feature-audit:voice-authorisation-tiers",
  "disabled-feature-audit:always-listening",
  "disabled-feature-audit:hidden-background-capture",
  "disabled-feature-audit:autonomous-device-execution",
  "disabled-feature-audit:auto-approval",
  "disabled-feature-audit:voice-only-approval",
  "disabled-feature-audit:public-remote-dashboards",
  "disabled-feature-audit:graph-driven-execution",
  "disabled-feature-audit:payload-telemetry-ui-exposure",
  "disabled-feature-audit:ungoverned-provider-escalation",
  "disabled-feature-audit:cai-non-whitelisted-targets",
  "disabled-feature-audit:scheduler-side-effects",
  "disabled-feature-audit:routine-chaining",
  "disabled-feature-audit:unapproved-room-device-actions",
  "disabled-feature-audit:whole-home-multi-room",
] as const;

export const DISABLED_FEATURE_AUDIT_FEATURE_IDS = [
  ...FinalDisabledFeatureIdSchema.options,
  "disabled-feature:conversation-mode",
  "disabled-feature:voice-authorisation-tiers",
] as const;

export type DisabledFeatureAuditFindingId =
  (typeof DISABLED_FEATURE_AUDIT_FINDING_IDS)[number];
export type DisabledFeatureAuditFeatureId =
  (typeof DISABLED_FEATURE_AUDIT_FEATURE_IDS)[number];
export type DisabledFeatureAuditSeverity = AuditSeverity;

export const DisabledFeatureAuditFindingIdSchema = z.enum(
  DISABLED_FEATURE_AUDIT_FINDING_IDS,
);
export const DisabledFeatureAuditFeatureIdSchema = z.enum(
  DISABLED_FEATURE_AUDIT_FEATURE_IDS,
);
export const DisabledFeatureAuditSeveritySchema = AuditSeveritySchema;

export const DisabledFeatureAuditFindingSchema = z.strictObject({
  finding_id: DisabledFeatureAuditFindingIdSchema,
  title: z.string().trim().min(1).max(180),
  feature_ids: z.array(DisabledFeatureAuditFeatureIdSchema).min(1),
  severity: DisabledFeatureAuditSeveritySchema,
  status: CrossPhaseAuditStatusSchema,
  represented_as_disabled_or_deferred: z.boolean(),
  architecture_amendment_required: z.boolean(),
  audit_surface_ids: z.array(AuditSurfaceIdSchema).min(1),
  audit_dimension_ids: z.array(AuditDimensionIdSchema).min(1),
  evidence_ids: z.array(AuditEvidenceIdSchema).min(1),
  summary: z.string().trim().min(1).max(520),
  disabled_posture: z.string().trim().min(1).max(420),
  remediation_hint: z.string().trim().min(1).max(420),
  blocking: z.boolean(),
  deferred_limitation_posture: z.string().trim().min(1).max(420),
  posture: CrossPhaseAuditPostureSchema,
});

export const DisabledFeatureAuditSummarySchema = z.strictObject({
  report_version: z.literal(DISABLED_FEATURE_AUDIT_VERSION),
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
  architecture_amendment_required_count: z.number().int().nonnegative(),
  evidence_reference_count: z.number().int().nonnegative(),
  matrix_feature_count: z.number().int().nonnegative(),
  matrix_critical_feature_count: z.number().int().nonnegative(),
  deferred_move_in_item_count: z.number().int().nonnegative(),
  all_required_disabled_features_represented: z.boolean(),
  phase20e_disabled_feature_audit_metadata_only: z.literal(true),
  phase20e_capability_neutral: z.literal(true),
  posture: CrossPhaseAuditPostureSchema,
});

export const DisabledFeatureAuditReportSchema = z.strictObject({
  report_version: z.literal(DISABLED_FEATURE_AUDIT_VERSION),
  report_id: z.literal("phase-20e6-disabled-feature-audit"),
  phase: z.literal("20E.6"),
  verdict: z.enum(["pass", "pass_with_deferred_notes", "blocked", "pending"]),
  findings: z.array(DisabledFeatureAuditFindingSchema),
  blocking_findings: z.array(DisabledFeatureAuditFindingSchema),
  deferred_findings: z.array(DisabledFeatureAuditFindingSchema),
  summary: DisabledFeatureAuditSummarySchema,
  posture: CrossPhaseAuditPostureSchema,
});

export type DisabledFeatureAuditFinding = z.infer<
  typeof DisabledFeatureAuditFindingSchema
>;
export type DisabledFeatureAuditSummary = z.infer<
  typeof DisabledFeatureAuditSummarySchema
>;
export type DisabledFeatureAuditReport = z.infer<
  typeof DisabledFeatureAuditReportSchema
>;

type DisabledFeatureAuditFocus = {
  finding_id: DisabledFeatureAuditFindingId;
  title: string;
  feature_ids: readonly DisabledFeatureAuditFeatureId[];
  matrix_feature_ids: readonly FinalDisabledFeatureId[];
  deferred_move_in_item_ids?: readonly string[];
  severity: DisabledFeatureAuditSeverity;
  audit_surface_ids: readonly AuditSurfaceId[];
  audit_dimension_ids: readonly AuditDimensionId[];
  evidence_ids: readonly AuditEvidenceId[];
  architecture_amendment_required: boolean;
  summary: string;
  disabled_posture: string;
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

const FOCUS: readonly DisabledFeatureAuditFocus[] = [
  {
    finding_id: "disabled-feature-audit:wake-word",
    title: "Wake word",
    feature_ids: ["disabled-feature:wake-word"],
    matrix_feature_ids: ["disabled-feature:wake-word"],
    deferred_move_in_item_ids: [
      "move-in:wake-word-conversation-mode-amendment-deferred",
    ],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-14-voice-runtime",
      "audit-surface:phase-20c-onboarding",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:voice-runtime-closeout",
      "audit-evidence:phase-20c-onboarding-move-in-closeout",
    ],
    architecture_amendment_required: true,
    summary:
      "Wake word remains disabled and amendment-deferred through the disabled-feature matrix and move-in posture.",
    disabled_posture:
      "No wake-word listener, always-on microphone path, or conversation trigger is enabled.",
    remediation_hint:
      "Keep wake word disabled until a future architecture amendment explicitly updates capture and consent posture.",
  },
  {
    finding_id: "disabled-feature-audit:conversation-mode",
    title: "Conversation mode",
    feature_ids: ["disabled-feature:conversation-mode"],
    matrix_feature_ids: [],
    deferred_move_in_item_ids: [
      "move-in:wake-word-conversation-mode-amendment-deferred",
    ],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-14-voice-runtime",
      "audit-surface:phase-20c-onboarding",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
    ],
    evidence_ids: [
      "audit-evidence:voice-runtime-closeout",
      "audit-evidence:phase-20c-onboarding-move-in-closeout",
    ],
    architecture_amendment_required: true,
    summary:
      "Conversation mode is represented as deferred pending a future architecture amendment.",
    disabled_posture:
      "No continuous conversation loop, implicit listening loop, or voice-session persistence is enabled.",
    remediation_hint:
      "Treat conversation mode as future architecture work only; do not infer it from voice readiness.",
  },
  {
    finding_id: "disabled-feature-audit:voice-authorisation-tiers",
    title: "Voice-authorisation tiers",
    feature_ids: ["disabled-feature:voice-authorisation-tiers"],
    matrix_feature_ids: [],
    deferred_move_in_item_ids: ["move-in:voice-authorisation-tiers-deferred"],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-14-voice-runtime",
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-20c-onboarding",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
      "audit-dimension:authority-surfaces",
    ],
    evidence_ids: [
      "audit-evidence:voice-runtime-closeout",
      "audit-evidence:approval-runtime-closeout",
      "audit-evidence:phase-20c-onboarding-move-in-closeout",
    ],
    architecture_amendment_required: true,
    summary:
      "Voice-authorisation tiers remain deferred and do not create voice-only or auto-approval authority.",
    disabled_posture:
      "No voice-only approval, auto-approval, or new voice authority tier is enabled.",
    remediation_hint:
      "Keep voice authorisation tiers deferred until architecture defines tiers, verification, and approval boundaries.",
  },
  {
    finding_id: "disabled-feature-audit:always-listening",
    title: "Always-listening",
    feature_ids: ["disabled-feature:always-listening"],
    matrix_feature_ids: ["disabled-feature:always-listening"],
    severity: "critical",
    audit_surface_ids: ["audit-surface:phase-14-voice-runtime"],
    audit_dimension_ids: ["audit-dimension:disabled-features"],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:voice-runtime-closeout",
    ],
    architecture_amendment_required: false,
    summary: "Always-listening remains disabled in the final matrix.",
    disabled_posture:
      "Voice capture stays explicit and bounded; ambient listening is not enabled.",
    remediation_hint:
      "Keep always-listening disabled unless a future architecture update redefines consent and capture.",
  },
  {
    finding_id: "disabled-feature-audit:hidden-background-capture",
    title: "Hidden and background capture",
    feature_ids: [
      "disabled-feature:hidden-capture",
      "disabled-feature:background-camera",
    ],
    matrix_feature_ids: [
      "disabled-feature:hidden-capture",
      "disabled-feature:background-camera",
    ],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-14-voice-runtime",
      "audit-surface:phase-15-vision-runtime",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:redaction-posture",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:voice-runtime-closeout",
      "audit-evidence:vision-runtime-closeout",
    ],
    architecture_amendment_required: false,
    summary:
      "Hidden audio capture and background camera capture remain disabled.",
    disabled_posture:
      "No hidden capture, background camera, or invisible capture posture is enabled.",
    remediation_hint:
      "Keep capture visible, explicit, and redacted in any future voice or vision work.",
  },
  {
    finding_id: "disabled-feature-audit:autonomous-device-execution",
    title: "Autonomous device execution",
    feature_ids: ["disabled-feature:autonomous-device-execution"],
    matrix_feature_ids: ["disabled-feature:autonomous-device-execution"],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-16-room-runtime",
      "audit-surface:phase-18-approval-runtime",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:room-runtime-closeout",
      "audit-evidence:approval-runtime-closeout",
    ],
    architecture_amendment_required: false,
    summary: "Autonomous room and device execution remains disabled.",
    disabled_posture:
      "Device actions require governed approval posture and are not autonomous.",
    remediation_hint:
      "Do not connect room/device adapters to autonomous execution paths.",
  },
  {
    finding_id: "disabled-feature-audit:auto-approval",
    title: "Auto-approval",
    feature_ids: ["disabled-feature:auto-approval"],
    matrix_feature_ids: ["disabled-feature:auto-approval"],
    severity: "critical",
    audit_surface_ids: ["audit-surface:phase-18-approval-runtime"],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:approval-runtime-closeout",
      "audit-evidence:governance-readiness-summary",
    ],
    architecture_amendment_required: false,
    summary: "Auto-approval remains forbidden.",
    disabled_posture:
      "Approval remains explicit, bounded, and reviewable; automatic approval is not enabled.",
    remediation_hint:
      "Reject any future posture that converts metadata review into automatic approval.",
  },
  {
    finding_id: "disabled-feature-audit:voice-only-approval",
    title: "Voice-only approval",
    feature_ids: ["disabled-feature:voice-only-approval"],
    matrix_feature_ids: ["disabled-feature:voice-only-approval"],
    deferred_move_in_item_ids: ["move-in:voice-authorisation-tiers-deferred"],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-14-voice-runtime",
      "audit-surface:phase-18-approval-runtime",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:voice-runtime-closeout",
      "audit-evidence:approval-runtime-closeout",
    ],
    architecture_amendment_required: true,
    summary:
      "Voice-only approval is captured as disabled with future voice-authorisation architecture deferred.",
    disabled_posture:
      "Voice transport cannot approve side effects or bypass the approval runtime.",
    remediation_hint:
      "Keep voice-only approval disabled unless future architecture defines governed authorisation tiers.",
  },
  {
    finding_id: "disabled-feature-audit:public-remote-dashboards",
    title: "Public or remote dashboards",
    feature_ids: ["disabled-feature:public-remote-dashboards"],
    matrix_feature_ids: ["disabled-feature:public-remote-dashboards"],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-12-command-center",
      "audit-surface:phase-20d-portfolio",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:observability",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:command-center-closeout",
      "audit-evidence:phase-20d-portfolio-demo-closeout",
    ],
    architecture_amendment_required: false,
    summary: "Public and remote dashboards remain disabled.",
    disabled_posture:
      "Command Center and demo surfaces remain local/read-only metadata and do not expose public dashboards.",
    remediation_hint:
      "Keep observability surfaces local and source-material-safe.",
  },
  {
    finding_id: "disabled-feature-audit:graph-driven-execution",
    title: "Graph-driven execution",
    feature_ids: ["disabled-feature:graph-driven-execution"],
    matrix_feature_ids: ["disabled-feature:graph-driven-execution"],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-19-fortress-layer",
      "audit-surface:phase-20d-portfolio",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:replay-safety",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:architecture-graph",
    ],
    architecture_amendment_required: false,
    summary: "Graph-driven execution remains disabled.",
    disabled_posture:
      "Architecture, runtime, governance, and replay graphs are visibility-only metadata surfaces.",
    remediation_hint:
      "Do not connect graph views to run, retry, mutation, or device-control paths.",
  },
  {
    finding_id: "disabled-feature-audit:payload-telemetry-ui-exposure",
    title: "Source material telemetry and UI exposure",
    feature_ids: ["disabled-feature:raw-payload-telemetry-ui-exposure"],
    matrix_feature_ids: ["disabled-feature:raw-payload-telemetry-ui-exposure"],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-12-command-center",
      "audit-surface:phase-19-fortress-layer",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:redaction-posture",
      "audit-dimension:observability",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:telemetry-cockpit",
      "audit-evidence:command-center-closeout",
    ],
    architecture_amendment_required: false,
    summary:
      "Source material exposure through telemetry or UI remains disabled.",
    disabled_posture:
      "Telemetry and UI evidence remain redacted metadata only and exclude sensitive source material.",
    remediation_hint:
      "Preserve redaction-first observability in future audit and demo surfaces.",
  },
  {
    finding_id: "disabled-feature-audit:ungoverned-provider-escalation",
    title: "Ungoverned provider escalation",
    feature_ids: [
      "disabled-feature:ungoverned-provider-escalation",
      "disabled-feature:remote-cloud-defaults",
    ],
    matrix_feature_ids: [
      "disabled-feature:ungoverned-provider-escalation",
      "disabled-feature:remote-cloud-defaults",
    ],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-13-model-runtime",
      "audit-surface:phase-20b-bootstrap",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:provider-posture",
      "audit-dimension:local-first-posture",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:model-runtime-closeout",
      "audit-evidence:bootstrap-doctor-report-path",
    ],
    architecture_amendment_required: false,
    summary:
      "Ungoverned provider escalation and remote/cloud defaults remain disabled or governance-deferred.",
    disabled_posture:
      "Local-first remains default; provider escalation requires explicit future governance.",
    remediation_hint:
      "Keep provider escalation opt-in, consent-gated, budget-aware, and governed.",
  },
  {
    finding_id: "disabled-feature-audit:cai-non-whitelisted-targets",
    title: "CAI non-whitelisted targets",
    feature_ids: ["disabled-feature:cai-non-whitelisted-targets"],
    matrix_feature_ids: ["disabled-feature:cai-non-whitelisted-targets"],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-19-fortress-layer",
      "audit-surface:phase-20d-portfolio",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:provider-posture",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:red-team-sandbox-cai-posture",
    ],
    architecture_amendment_required: false,
    summary: "CAI non-whitelisted targets remain disabled.",
    disabled_posture:
      "Red-team posture remains sandboxed and whitelist-bound; non-whitelisted targets are denied.",
    remediation_hint:
      "Keep CAI posture synthetic and whitelist-bound until explicit governed execution exists.",
  },
  {
    finding_id: "disabled-feature-audit:scheduler-side-effects",
    title: "Scheduler side effects",
    feature_ids: ["disabled-feature:scheduler-side-effects"],
    matrix_feature_ids: ["disabled-feature:scheduler-side-effects"],
    severity: "critical",
    audit_surface_ids: ["audit-surface:phase-17-scheduled-assistance"],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:scheduler-closeout",
    ],
    architecture_amendment_required: false,
    summary: "Scheduler side effects remain disabled.",
    disabled_posture:
      "Scheduled assistance can suggest or report but cannot trigger side effects.",
    remediation_hint:
      "Do not attach scheduler metadata to execution, routine, or device action paths.",
  },
  {
    finding_id: "disabled-feature-audit:routine-chaining",
    title: "Routine chaining",
    feature_ids: ["disabled-feature:routine-chaining"],
    matrix_feature_ids: ["disabled-feature:routine-chaining"],
    severity: "high",
    audit_surface_ids: ["audit-surface:phase-17-scheduled-assistance"],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:replay-safety",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:scheduler-closeout",
    ],
    architecture_amendment_required: false,
    summary: "Routine chaining remains disabled.",
    disabled_posture:
      "One routine suggestion cannot trigger another unattended routine.",
    remediation_hint:
      "Keep routine chains unavailable unless future approval and replay safety are defined.",
  },
  {
    finding_id: "disabled-feature-audit:unapproved-room-device-actions",
    title: "Unapproved room/device actions",
    feature_ids: ["disabled-feature:unapproved-room-device-actions"],
    matrix_feature_ids: ["disabled-feature:unapproved-room-device-actions"],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-16-room-runtime",
      "audit-surface:phase-18-approval-runtime",
      "audit-surface:phase-20c-onboarding",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:approval-boundaries",
      "audit-dimension:onboarding-readiness",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:room-runtime-closeout",
      "audit-evidence:approval-runtime-closeout",
      "audit-evidence:phase-20c-onboarding-move-in-closeout",
    ],
    architecture_amendment_required: false,
    summary: "Unapproved room and device actions remain disabled.",
    disabled_posture:
      "Room/device actions require approval lifecycle binding; real device onboarding remains deferred.",
    remediation_hint:
      "Preserve fake-room and approval-gated posture before any hardware path is considered.",
  },
  {
    finding_id: "disabled-feature-audit:whole-home-multi-room",
    title: "Whole-home and multi-room control",
    feature_ids: ["disabled-feature:whole-home-multi-room"],
    matrix_feature_ids: ["disabled-feature:whole-home-multi-room"],
    deferred_move_in_item_ids: ["move-in:real-hue-device-onboarding-deferred"],
    severity: "critical",
    audit_surface_ids: [
      "audit-surface:phase-16-room-runtime",
      "audit-surface:phase-20c-onboarding",
    ],
    audit_dimension_ids: [
      "audit-dimension:disabled-features",
      "audit-dimension:onboarding-readiness",
    ],
    evidence_ids: [
      "audit-evidence:disabled-feature-matrix",
      "audit-evidence:room-runtime-closeout",
      "audit-evidence:phase-20c-onboarding-move-in-closeout",
    ],
    architecture_amendment_required: true,
    summary: "Whole-home and multi-room control remain deferred.",
    disabled_posture:
      "Room scope remains limited; whole-home authority is deferred beyond Phase 20.",
    remediation_hint:
      "Keep multi-room control future-only until architecture, hardware, and approval scope are amended.",
  },
] as const;

function uniqueEvidenceIds(
  values: readonly AuditEvidenceId[],
): AuditEvidenceId[] {
  return [...new Set(values)];
}

function matrixFeaturesById(): Map<
  FinalDisabledFeatureId,
  FinalDisabledFeatureRecord
> {
  return new Map(
    getFinalDisabledFeatureMatrix().map((feature) => [
      feature.feature_id,
      feature,
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

function deferredItemsPresent(itemIds: readonly string[] = []): boolean {
  if (itemIds.length === 0) {
    return true;
  }

  const deferredIds = new Set(
    getDeferredMoveInChecklistItems().map((item) => item.item_id),
  ) as Set<string>;

  return itemIds.every((itemId) => deferredIds.has(itemId));
}

function matrixPostureHolds(
  focus: DisabledFeatureAuditFocus,
  featuresById: Map<FinalDisabledFeatureId, FinalDisabledFeatureRecord>,
): boolean {
  return focus.matrix_feature_ids.every((featureId) => {
    const feature = featuresById.get(featureId);

    return (
      !!feature &&
      feature.metadata_only &&
      feature.read_only &&
      feature.deterministic &&
      !feature.creates_new_capability &&
      !feature.creates_new_authority &&
      !feature.adds_user_affordance &&
      !feature.performs_side_effect &&
      !feature.calls_provider &&
      !feature.calls_network &&
      !feature.includes_sensitive_material &&
      (feature.final_phase20_posture === "remains_disabled" ||
        feature.final_phase20_posture ===
          "remains_disabled_until_future_governance")
    );
  });
}

function evaluatorPostureSupports(
  focus: DisabledFeatureAuditFocus,
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

function determineFindingStatus(
  focus: DisabledFeatureAuditFocus,
  represented: boolean,
): DisabledFeatureAuditFinding["status"] {
  if (!represented || !evidenceIdsKnown(focus.evidence_ids)) {
    return "fail";
  }

  if (focus.architecture_amendment_required) {
    return "deferred";
  }

  return "pass";
}

function buildFinding(
  focus: DisabledFeatureAuditFocus,
  featuresById: Map<FinalDisabledFeatureId, FinalDisabledFeatureRecord>,
  evaluatedResults: readonly CrossPhaseAuditResult[],
): DisabledFeatureAuditFinding {
  const matrixHolds = matrixPostureHolds(focus, featuresById);
  const deferredHolds = deferredItemsPresent(focus.deferred_move_in_item_ids);
  const evaluatorSupports = evaluatorPostureSupports(focus, evaluatedResults);
  const represented =
    matrixHolds &&
    deferredHolds &&
    evaluatorSupports &&
    evidenceIdsKnown(focus.evidence_ids);
  const status = determineFindingStatus(focus, represented);
  const blocking =
    status === "fail" &&
    (focus.severity === "critical" || focus.severity === "high");

  return DisabledFeatureAuditFindingSchema.parse({
    finding_id: focus.finding_id,
    title: focus.title,
    feature_ids: [...focus.feature_ids],
    severity: focus.severity,
    status,
    represented_as_disabled_or_deferred: represented,
    architecture_amendment_required: focus.architecture_amendment_required,
    audit_surface_ids: [...focus.audit_surface_ids],
    audit_dimension_ids: [...focus.audit_dimension_ids],
    evidence_ids: uniqueEvidenceIds(focus.evidence_ids),
    summary: focus.summary,
    disabled_posture: focus.disabled_posture,
    remediation_hint: focus.remediation_hint,
    blocking,
    deferred_limitation_posture:
      status === "deferred"
        ? "Feature remains disabled or deferred pending explicit future architecture/governance amendment."
        : "Feature is represented as disabled by existing metadata; no runtime check was executed.",
    posture: POSTURE,
  });
}

function summarizeFindings(
  findings: readonly DisabledFeatureAuditFinding[],
): DisabledFeatureAuditSummary {
  const matrixSummary = summarizeDisabledFeaturePosture();
  const moveInSummary = summarizeMoveInChecklist();

  return DisabledFeatureAuditSummarySchema.parse({
    report_version: DISABLED_FEATURE_AUDIT_VERSION,
    finding_count: findings.length,
    represented_count: findings.filter(
      (finding) => finding.represented_as_disabled_or_deferred,
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
    architecture_amendment_required_count: findings.filter(
      (finding) => finding.architecture_amendment_required,
    ).length,
    evidence_reference_count: findings.reduce(
      (count, finding) => count + finding.evidence_ids.length,
      0,
    ),
    matrix_feature_count: matrixSummary.feature_count,
    matrix_critical_feature_count: matrixSummary.critical_feature_count,
    deferred_move_in_item_count: moveInSummary.deferred_item_count,
    all_required_disabled_features_represented: findings.every(
      (finding) => finding.represented_as_disabled_or_deferred,
    ),
    phase20e_disabled_feature_audit_metadata_only: true,
    phase20e_capability_neutral: true,
    posture: POSTURE,
  });
}

function determineVerdict(
  summary: DisabledFeatureAuditSummary,
): DisabledFeatureAuditReport["verdict"] {
  if (summary.blocking_count > 0 || summary.fail_count > 0) {
    return "blocked";
  }

  if (summary.pending_count > 0) {
    return "pending";
  }

  if (summary.deferred_count > 0 || summary.warning_count > 0) {
    return "pass_with_deferred_notes";
  }

  return "pass";
}

export function buildDisabledFeatureAuditReport(): DisabledFeatureAuditReport {
  const featuresById = matrixFeaturesById();
  const evaluation = evaluateCrossPhaseAudit();
  const findings = FOCUS.map((focus) =>
    buildFinding(focus, featuresById, evaluation.results),
  );
  const summary = summarizeFindings(findings);

  return DisabledFeatureAuditReportSchema.parse({
    report_version: DISABLED_FEATURE_AUDIT_VERSION,
    report_id: "phase-20e6-disabled-feature-audit",
    phase: "20E.6",
    verdict: determineVerdict(summary),
    findings,
    blocking_findings: findings.filter((finding) => finding.blocking),
    deferred_findings: findings.filter(
      (finding) => finding.status === "deferred",
    ),
    summary,
    posture: POSTURE,
  });
}
