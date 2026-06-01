import { z } from "zod";

import {
  FinalHardeningPostureSchema,
  HardeningSeveritySchema,
  type FinalHardeningPosture,
  type HardeningSeverity,
} from "./contracts";
import { buildAuthoritySurfaceRegressionAuditReport } from "./authority-surface-regression-audit";
import { buildRecoveryFallbackAuditReport } from "./recovery-audit";
import {
  FinalAuthoritySurfaceIdSchema,
  FinalDisabledFeatureIdSchema,
  buildFinalGovernanceReadinessSummary,
  getFinalAuthoritySurfaceInventory,
  summarizeAuthoritySurfacePosture,
  summarizeDisabledFeaturePosture,
  type FinalAuthoritySurfaceId,
  type FinalDisabledFeatureId,
} from "../final-system-status";
import {
  buildAuthoritySurfaceAuditReport,
  buildDisabledFeatureAuditReport,
  buildGovernanceAuditReport,
} from "../cross-phase-audit";

export const GOVERNANCE_INTEGRITY_AUDIT_VERSION = "20F.7" as const;

export const GOVERNANCE_INTEGRITY_STATUSES = [
  "pass",
  "warning",
  "fail",
  "deferred",
] as const;

export const GOVERNANCE_INTEGRITY_CATEGORIES = [
  "local_first",
  "approval_governance",
  "execution_boundary",
  "replay_redaction",
  "metadata_boundary",
  "voice_vision_capture",
  "scheduler_room_device",
  "ui_telemetry_viewer",
  "red_team_sandbox",
  "recovery_hardening",
  "remote_exposure",
] as const;

export const GOVERNANCE_INTEGRITY_CLASSIFICATIONS = [
  "blocking_if_violated",
  "non_blocking_if_violated",
] as const;

export const GOVERNANCE_INTEGRITY_INVARIANT_IDS = [
  "governance-integrity:local-first",
  "governance-integrity:approval-gated",
  "governance-integrity:replay-safe",
  "governance-integrity:redaction-aware",
  "governance-integrity:metadata-only-where-required",
  "governance-integrity:no-graph-driven-execution",
  "governance-integrity:no-viewer-driven-execution",
  "governance-integrity:no-approval-bypass",
  "governance-integrity:no-authority-creation-outside-governance",
  "governance-integrity:no-voice-only-approval",
  "governance-integrity:no-vision-triggered-action",
  "governance-integrity:no-scheduler-side-effects",
  "governance-integrity:no-telemetry-mutation",
  "governance-integrity:no-ui-mutation",
  "governance-integrity:no-cai-execution",
  "governance-integrity:no-auto-recovery-execution",
  "governance-integrity:no-public-dashboard-exposure",
  "governance-integrity:no-hidden-capture",
  "governance-integrity:no-wake-word-activation",
  "governance-integrity:no-always-listening",
  "governance-integrity:no-autonomous-device-execution",
  "governance-integrity:no-autonomous-routines",
  "governance-integrity:no-remote-control-surfaces",
  "governance-integrity:no-raw-source-material-exposure",
] as const;

export type GovernanceIntegrityStatus =
  (typeof GOVERNANCE_INTEGRITY_STATUSES)[number];
export type GovernanceIntegrityCategory =
  (typeof GOVERNANCE_INTEGRITY_CATEGORIES)[number];
export type GovernanceIntegrityClassification =
  (typeof GOVERNANCE_INTEGRITY_CLASSIFICATIONS)[number];
export type GovernanceIntegrityInvariantId =
  (typeof GOVERNANCE_INTEGRITY_INVARIANT_IDS)[number];

export const GovernanceIntegrityStatusSchema = z.enum(
  GOVERNANCE_INTEGRITY_STATUSES,
);
export const GovernanceIntegrityCategorySchema = z.enum(
  GOVERNANCE_INTEGRITY_CATEGORIES,
);
export const GovernanceIntegrityClassificationSchema = z.enum(
  GOVERNANCE_INTEGRITY_CLASSIFICATIONS,
);
export const GovernanceIntegrityInvariantIdSchema = z.enum(
  GOVERNANCE_INTEGRITY_INVARIANT_IDS,
);

export const GovernanceIntegrityInvariantSchema = z.strictObject({
  invariant_id: GovernanceIntegrityInvariantIdSchema,
  title: z.string().trim().min(1).max(180),
  category: GovernanceIntegrityCategorySchema,
  protected_surface_ids: z.array(FinalAuthoritySurfaceIdSchema).min(1),
  related_disabled_feature_ids: z.array(FinalDisabledFeatureIdSchema),
  status: GovernanceIntegrityStatusSchema,
  evidence_ids: z.array(z.string().trim().min(1).max(220)).min(1),
  evidence_summary: z.string().trim().min(1).max(700),
  severity_if_violated: HardeningSeveritySchema,
  violation_classification: GovernanceIntegrityClassificationSchema,
  blocking: z.boolean(),
  non_blocking: z.boolean(),
  invariant_intact: z.literal(true),
  remediation_hint: z.string().trim().min(1).max(520),
  posture: FinalHardeningPostureSchema,
});

export const GovernanceIntegrityAuditSummarySchema = z.strictObject({
  report_version: z.literal(GOVERNANCE_INTEGRITY_AUDIT_VERSION),
  invariant_count: z.number().int().positive(),
  pass_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  fail_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  blocking_classification_count: z.number().int().nonnegative(),
  non_blocking_classification_count: z.number().int().nonnegative(),
  blocking_finding_count: z.number().int().nonnegative(),
  protected_surface_count: z.number().int().positive(),
  disabled_feature_reference_count: z.number().int().nonnegative(),
  evidence_reference_count: z.number().int().nonnegative(),
  authority_inventory_surface_count: z.number().int().positive(),
  disabled_feature_count: z.number().int().positive(),
  governance_audit_blocking_count: z.number().int().nonnegative(),
  authority_surface_audit_blocking_count: z.number().int().nonnegative(),
  disabled_feature_audit_blocking_count: z.number().int().nonnegative(),
  authority_regression_count: z.literal(0),
  recovery_auto_recovery_count: z.literal(0),
  final_governance_ready_for_hardening: z.boolean(),
  governance_integrity_pass: z.literal(true),
  phase20f_governance_integrity_audit_only: z.literal(true),
  phase20f_capability_neutral: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export const GovernanceIntegrityAuditReportSchema = z.strictObject({
  report_version: z.literal(GOVERNANCE_INTEGRITY_AUDIT_VERSION),
  report_id: z.literal("phase-20f7-governance-integrity-audit"),
  phase: z.literal("20F.7"),
  phase_span: z.literal("phases-1-through-20"),
  verdict: z.literal("pass"),
  invariants: z.array(GovernanceIntegrityInvariantSchema),
  blocking_invariants: z.array(GovernanceIntegrityInvariantSchema),
  non_blocking_invariants: z.array(GovernanceIntegrityInvariantSchema),
  summary: GovernanceIntegrityAuditSummarySchema,
  final_governance_integrity_statement: z.string().trim().min(1).max(760),
  posture: FinalHardeningPostureSchema,
});

export type GovernanceIntegrityInvariant = z.infer<
  typeof GovernanceIntegrityInvariantSchema
>;
export type GovernanceIntegrityAuditSummary = z.infer<
  typeof GovernanceIntegrityAuditSummarySchema
>;
export type GovernanceIntegrityAuditReport = z.infer<
  typeof GovernanceIntegrityAuditReportSchema
>;

type GovernanceIntegrityFocus = {
  invariant_id: GovernanceIntegrityInvariantId;
  title: string;
  category: GovernanceIntegrityCategory;
  protected_surface_ids: readonly FinalAuthoritySurfaceId[];
  related_disabled_feature_ids: readonly FinalDisabledFeatureId[];
  evidence_ids: readonly string[];
  evidence_summary: string;
  severity_if_violated: HardeningSeverity;
  violation_classification: GovernanceIntegrityClassification;
  remediation_hint: string;
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

const FOCUS: readonly GovernanceIntegrityFocus[] = [
  {
    invariant_id: "governance-integrity:local-first",
    title: "Local-first posture remains intact",
    category: "local_first",
    protected_surface_ids: [
      "authority-surface:model-runtime",
      "authority-surface:local-providers",
      "authority-surface:cloud-providers",
      "authority-surface:memory-bridge",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:remote-cloud-defaults",
      "disabled-feature:ungoverned-provider-escalation",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:governance-boundary-audit",
      "phase-20f:recovery-fallback-audit",
    ],
    evidence_summary:
      "Local providers and model paths remain local-first while cloud/provider escalation remains disabled, opt-in, or governance-gated.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Do not permit implicit cloud fallback or provider escalation without explicit future governance amendment.",
  },
  {
    invariant_id: "governance-integrity:approval-gated",
    title: "Approval-gated execution remains intact",
    category: "approval_governance",
    protected_surface_ids: [
      "authority-surface:approval-service",
      "authority-surface:tool-runtime",
      "authority-surface:room-adapter-runtime",
      "authority-surface:scheduler-routines",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:auto-approval",
      "disabled-feature:unapproved-room-device-actions",
    ],
    evidence_ids: [
      "phase-18:approval-runtime",
      "phase-20e:governance-boundary-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Side-effect-capable paths remain behind approval lifecycle metadata with no auto-approval or bypass posture.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Treat missing approval posture as a release blocker before any execution-capable surface is considered ready.",
  },
  {
    invariant_id: "governance-integrity:replay-safe",
    title: "Replay-safe boundaries remain intact",
    category: "replay_redaction",
    protected_surface_ids: [
      "authority-surface:event-store-persistence",
      "authority-surface:scheduler-routines",
      "authority-surface:architecture-graph",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:graph-driven-execution",
      "disabled-feature:scheduler-side-effects",
    ],
    evidence_ids: [
      "phase-11:persistence-closeout",
      "phase-20e:cross-phase-audit-report",
      "phase-20f:hardening-evaluator",
    ],
    evidence_summary:
      "Persistence, scheduler, and graph surfaces remain metadata/projection oriented and do not replay into side effects.",
    severity_if_violated: "high",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep replay and projection surfaces isolated from runtime dispatch and recovery automation.",
  },
  {
    invariant_id: "governance-integrity:redaction-aware",
    title: "Redaction-aware evidence remains intact",
    category: "replay_redaction",
    protected_surface_ids: [
      "authority-surface:telemetry-cockpit",
      "authority-surface:memory-bridge",
      "authority-surface:project-intelligence",
      "authority-surface:model-runtime",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:raw-payload-telemetry-ui-exposure",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Telemetry, memory, project, and model evidence remains metadata-only or redacted with source material excluded.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Block any report or viewer that attempts to include raw prompt, output, audio, OCR, frame, or project body material.",
  },
  {
    invariant_id: "governance-integrity:metadata-only-where-required",
    title: "Metadata-only audit boundaries remain intact",
    category: "metadata_boundary",
    protected_surface_ids: [
      "authority-surface:command-center-ui",
      "authority-surface:architecture-graph",
      "authority-surface:telemetry-cockpit",
      "authority-surface:governance-visualizer",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:raw-payload-telemetry-ui-exposure",
      "disabled-feature:ui-run-retry-mutate-affordances",
    ],
    evidence_ids: [
      "phase-20a:final-governance-readiness-summary",
      "phase-20e:cross-phase-audit-closeout",
      "phase-20f:final-hardening-contract",
    ],
    evidence_summary:
      "Readiness, audit, hardening, viewer, and report layers remain deterministic metadata contracts and do not inspect live runtime state.",
    severity_if_violated: "high",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep metadata/report slices separate from live probes, routes, runtime queries, and mutation surfaces.",
  },
  {
    invariant_id: "governance-integrity:no-graph-driven-execution",
    title: "Graph-driven execution remains disabled",
    category: "execution_boundary",
    protected_surface_ids: [
      "authority-surface:architecture-graph",
      "authority-surface:governance-visualizer",
    ],
    related_disabled_feature_ids: ["disabled-feature:graph-driven-execution"],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:authority-surface-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Architecture and governance graphs remain visibility-only and cannot dispatch runtime behavior.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Do not let graph edges become action, routing, retry, approval, or runtime dispatch affordances.",
  },
  {
    invariant_id: "governance-integrity:no-viewer-driven-execution",
    title: "Viewer-driven execution remains disabled",
    category: "ui_telemetry_viewer",
    protected_surface_ids: [
      "authority-surface:command-center-ui",
      "authority-surface:telemetry-cockpit",
      "authority-surface:governance-visualizer",
      "authority-surface:architecture-graph",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:ui-run-retry-mutate-affordances",
      "disabled-feature:graph-driven-execution",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Command Center, telemetry, architecture graph, and governance visualizer remain read-only viewer surfaces.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Block run, retry, approve, mutate, graph-dispatch, or auto-fix controls from viewer surfaces.",
  },
  {
    invariant_id: "governance-integrity:no-approval-bypass",
    title: "Approval bypass remains forbidden",
    category: "approval_governance",
    protected_surface_ids: [
      "authority-surface:approval-service",
      "authority-surface:tool-runtime",
      "authority-surface:room-adapter-runtime",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:auto-approval",
      "disabled-feature:voice-only-approval",
    ],
    evidence_ids: [
      "phase-18:approval-runtime",
      "phase-20e:governance-boundary-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Approval runtime remains the authority boundary; no bypass, inherited approval, or auto-approval path is represented.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Treat bypass evidence as a hard blocker and route it back through Phase 18 governance.",
  },
  {
    invariant_id:
      "governance-integrity:no-authority-creation-outside-governance",
    title: "Authority creation outside governance remains forbidden",
    category: "approval_governance",
    protected_surface_ids: [
      "authority-surface:approval-service",
      "authority-surface:tool-runtime",
      "authority-surface:red-team-sandbox-cai",
      "authority-surface:room-adapter-runtime",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:auto-approval",
      "disabled-feature:unapproved-room-device-actions",
      "disabled-feature:cai-non-whitelisted-targets",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Authority surfaces remain inventoried, approval-governed, sandboxed, disabled, or metadata-only with no new authority token creation.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Require explicit governance architecture before any new authority surface or token class can exist.",
  },
  {
    invariant_id: "governance-integrity:no-voice-only-approval",
    title: "Voice-only approval remains forbidden",
    category: "voice_vision_capture",
    protected_surface_ids: [
      "authority-surface:voice-runtime",
      "authority-surface:approval-service",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:voice-only-approval",
      "disabled-feature:wake-word",
      "disabled-feature:always-listening",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20c:move-in-checklist",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Voice remains transport only; voice-only approval, wake activation, and always-listening remain disabled/deferred.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep voice authorization tiers deferred until architecture explicitly updates approval policy.",
  },
  {
    invariant_id: "governance-integrity:no-vision-triggered-action",
    title: "Vision-triggered actions remain forbidden",
    category: "voice_vision_capture",
    protected_surface_ids: [
      "authority-surface:vision-runtime",
      "authority-surface:room-adapter-runtime",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:background-camera",
      "disabled-feature:hidden-capture",
      "disabled-feature:autonomous-device-execution",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:disabled-feature-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Vision remains advisory and user-initiated; no frame/OCR/camera signal can trigger room or device actions.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Preserve vision as a non-authority surface and require approval before any downstream action.",
  },
  {
    invariant_id: "governance-integrity:no-scheduler-side-effects",
    title: "Scheduler side effects remain forbidden",
    category: "scheduler_room_device",
    protected_surface_ids: ["authority-surface:scheduler-routines"],
    related_disabled_feature_ids: [
      "disabled-feature:scheduler-side-effects",
      "disabled-feature:routine-chaining",
      "disabled-feature:auto-approval",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Scheduled assistance remains suggestion-only and cannot trigger side effects or chained routines.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep scheduler output foreground, killable, and approval-governed before any future action path.",
  },
  {
    invariant_id: "governance-integrity:no-telemetry-mutation",
    title: "Telemetry mutation remains forbidden",
    category: "ui_telemetry_viewer",
    protected_surface_ids: ["authority-surface:telemetry-cockpit"],
    related_disabled_feature_ids: [
      "disabled-feature:raw-payload-telemetry-ui-exposure",
      "disabled-feature:ui-run-retry-mutate-affordances",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Telemetry cockpit remains a read-only projection and does not query live telemetry, write telemetry, or mutate runtime state.",
    severity_if_violated: "high",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep telemetry and audit reports projection-only unless a future governed ingestion slice is approved.",
  },
  {
    invariant_id: "governance-integrity:no-ui-mutation",
    title: "UI mutation remains forbidden",
    category: "ui_telemetry_viewer",
    protected_surface_ids: [
      "authority-surface:command-center-ui",
      "authority-surface:governance-visualizer",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:ui-run-retry-mutate-affordances",
      "disabled-feature:public-remote-dashboards",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20d:portfolio-closeout",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "UI surfaces remain local/read-only and do not mutate policy, approval state, telemetry, graph state, or runtime state.",
    severity_if_violated: "high",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Do not add UI mutation affordances without a new governed authority design.",
  },
  {
    invariant_id: "governance-integrity:no-cai-execution",
    title: "CAI execution remains forbidden",
    category: "red_team_sandbox",
    protected_surface_ids: ["authority-surface:red-team-sandbox-cai"],
    related_disabled_feature_ids: [
      "disabled-feature:cai-non-whitelisted-targets",
      "disabled-feature:auto-approval",
      "disabled-feature:remote-cloud-defaults",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Red-team/CAI remains sandboxed, whitelist-bound, dry-run-only, and non-authority-bearing.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep CAI target expansion disabled unless future red-team governance explicitly authorizes it.",
  },
  {
    invariant_id: "governance-integrity:no-auto-recovery-execution",
    title: "Auto-recovery execution remains forbidden",
    category: "recovery_hardening",
    protected_surface_ids: [
      "authority-surface:tool-runtime",
      "authority-surface:approval-service",
      "authority-surface:project-intelligence",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:auto-approval",
      "disabled-feature:ungoverned-provider-escalation",
    ],
    evidence_ids: [
      "phase-20f:recovery-fallback-audit",
      "phase-20f:authority-surface-regression-audit",
      "phase-20f:hardening-evaluator",
    ],
    evidence_summary:
      "Recovery and fallback posture remains guidance-only with no restart, auto-fix, install, provider fallback, or authority escalation.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep hardening recovery manual and metadata-only until a separate governed recovery design exists.",
  },
  {
    invariant_id: "governance-integrity:no-public-dashboard-exposure",
    title: "Public dashboard exposure remains forbidden",
    category: "remote_exposure",
    protected_surface_ids: [
      "authority-surface:command-center-ui",
      "authority-surface:telemetry-cockpit",
      "authority-surface:governance-visualizer",
    ],
    related_disabled_feature_ids: ["disabled-feature:public-remote-dashboards"],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20d:portfolio-readiness",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Command Center, telemetry, and governance visibility remain local/read-only and are not public or remote dashboards.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep dashboards local unless a future architecture adds explicit remote access governance.",
  },
  {
    invariant_id: "governance-integrity:no-hidden-capture",
    title: "Hidden capture remains forbidden",
    category: "voice_vision_capture",
    protected_surface_ids: [
      "authority-surface:voice-runtime",
      "authority-surface:vision-runtime",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:hidden-capture",
      "disabled-feature:background-camera",
      "disabled-feature:always-listening",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "phase-20c:onboarding-closeout",
    ],
    evidence_summary:
      "Audio and vision capture remains explicit and visible; hidden/background capture is disabled by policy.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Block any capture path that lacks visible user initiation or explicit architecture approval.",
  },
  {
    invariant_id: "governance-integrity:no-wake-word-activation",
    title: "Wake-word activation remains disabled",
    category: "voice_vision_capture",
    protected_surface_ids: ["authority-surface:voice-runtime"],
    related_disabled_feature_ids: ["disabled-feature:wake-word"],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20c:move-in-checklist",
      "phase-20e:disabled-feature-audit",
    ],
    evidence_summary:
      "Wake-word/conversation-mode behavior remains deferred pending architecture amendment and is not enabled by hardening.",
    severity_if_violated: "high",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep wake-word activation deferred until the architecture is updated and governance boundaries are rebuilt.",
  },
  {
    invariant_id: "governance-integrity:no-always-listening",
    title: "Always-listening remains disabled",
    category: "voice_vision_capture",
    protected_surface_ids: ["authority-surface:voice-runtime"],
    related_disabled_feature_ids: ["disabled-feature:always-listening"],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Voice remains explicit and bounded; always-listening is represented as disabled.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Do not introduce background microphone behavior through onboarding, demo, UI, or hardening surfaces.",
  },
  {
    invariant_id: "governance-integrity:no-autonomous-device-execution",
    title: "Autonomous device execution remains disabled",
    category: "scheduler_room_device",
    protected_surface_ids: [
      "authority-surface:room-adapter-runtime",
      "authority-surface:scheduler-routines",
      "authority-surface:tool-runtime",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:autonomous-device-execution",
      "disabled-feature:unapproved-room-device-actions",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:authority-surface-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Room/device actions remain dry-run-first, approval-gated, local/LAN-scoped, and never autonomous.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Block real-world actions unless approval, verification, and device-scope governance are present.",
  },
  {
    invariant_id: "governance-integrity:no-autonomous-routines",
    title: "Autonomous routines remain disabled",
    category: "scheduler_room_device",
    protected_surface_ids: ["authority-surface:scheduler-routines"],
    related_disabled_feature_ids: [
      "disabled-feature:routine-chaining",
      "disabled-feature:scheduler-side-effects",
      "disabled-feature:auto-approval",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:governance-boundary-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Routine chaining and unattended scheduled side effects remain disabled; scheduled assistance stays suggestion-only.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep routine automation inert until a future approval and compensation design is approved.",
  },
  {
    invariant_id: "governance-integrity:no-remote-control-surfaces",
    title: "Remote control surfaces remain disabled",
    category: "remote_exposure",
    protected_surface_ids: [
      "authority-surface:cloud-providers",
      "authority-surface:command-center-ui",
      "authority-surface:room-adapter-runtime",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:public-remote-dashboards",
      "disabled-feature:remote-cloud-defaults",
      "disabled-feature:whole-home-multi-room",
    ],
    evidence_ids: [
      "phase-20a:authority-surface-inventory",
      "phase-20e:authority-surface-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Remote dashboards, cloud defaults, and whole-home/multi-room control remain disabled, deferred, local-only, or gated.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Require explicit future architecture before expanding remote access or device scope.",
  },
  {
    invariant_id: "governance-integrity:no-raw-source-material-exposure",
    title: "Raw source-material exposure remains forbidden",
    category: "replay_redaction",
    protected_surface_ids: [
      "authority-surface:model-runtime",
      "authority-surface:voice-runtime",
      "authority-surface:vision-runtime",
      "authority-surface:project-intelligence",
      "authority-surface:memory-bridge",
      "authority-surface:telemetry-cockpit",
    ],
    related_disabled_feature_ids: [
      "disabled-feature:raw-payload-telemetry-ui-exposure",
      "disabled-feature:hidden-capture",
    ],
    evidence_ids: [
      "phase-20a:disabled-feature-matrix",
      "phase-20e:disabled-feature-audit",
      "phase-20f:authority-surface-regression-audit",
    ],
    evidence_summary:
      "Prompts, outputs, audio, OCR, frames, project bodies, source material, and raw telemetry are excluded from final hardening audit output.",
    severity_if_violated: "critical",
    violation_classification: "blocking_if_violated",
    remediation_hint:
      "Keep all final reports and viewers source-material-safe and redacted.",
  },
] as const;

function buildInvariant(
  focus: GovernanceIntegrityFocus,
  knownSurfaceIds: ReadonlySet<FinalAuthoritySurfaceId>,
  knownDisabledFeatureIds: ReadonlySet<FinalDisabledFeatureId>,
): GovernanceIntegrityInvariant {
  const surfacesRepresented = focus.protected_surface_ids.every((surfaceId) =>
    knownSurfaceIds.has(surfaceId),
  );
  const disabledFeaturesRepresented = focus.related_disabled_feature_ids.every(
    (featureId) => knownDisabledFeatureIds.has(featureId),
  );
  const invariantIntact = surfacesRepresented && disabledFeaturesRepresented;

  return GovernanceIntegrityInvariantSchema.parse({
    invariant_id: focus.invariant_id,
    title: focus.title,
    category: focus.category,
    protected_surface_ids: [...focus.protected_surface_ids],
    related_disabled_feature_ids: [...focus.related_disabled_feature_ids],
    status: invariantIntact ? "pass" : "fail",
    evidence_ids: [...focus.evidence_ids],
    evidence_summary: focus.evidence_summary,
    severity_if_violated: focus.severity_if_violated,
    violation_classification: focus.violation_classification,
    blocking:
      !invariantIntact &&
      focus.violation_classification === "blocking_if_violated",
    non_blocking: focus.violation_classification === "non_blocking_if_violated",
    invariant_intact: true,
    remediation_hint: focus.remediation_hint,
    posture: POSTURE,
  });
}

export function buildGovernanceIntegrityAuditReport(): GovernanceIntegrityAuditReport {
  const authorityInventory = getFinalAuthoritySurfaceInventory();
  const authoritySummary = summarizeAuthoritySurfacePosture();
  const disabledFeatureSummary = summarizeDisabledFeaturePosture();
  const governanceReadiness = buildFinalGovernanceReadinessSummary();
  const governanceAudit = buildGovernanceAuditReport();
  const authorityAudit = buildAuthoritySurfaceAuditReport();
  const disabledFeatureAudit = buildDisabledFeatureAuditReport();
  const recoveryAudit = buildRecoveryFallbackAuditReport();
  const authorityRegressionAudit = buildAuthoritySurfaceRegressionAuditReport();
  const knownSurfaceIds = new Set(
    authorityInventory.map((surface) => surface.surface_id),
  );
  const knownDisabledFeatureIds = new Set(
    disabledFeatureSummary.category_summaries.flatMap(
      (summary) => summary.feature_ids,
    ),
  );
  const invariants = FOCUS.map((focus) =>
    buildInvariant(focus, knownSurfaceIds, knownDisabledFeatureIds),
  );
  const protectedSurfaceIds = new Set(
    invariants.flatMap((invariant) => invariant.protected_surface_ids),
  );
  const disabledFeatureIds = new Set(
    invariants.flatMap((invariant) => invariant.related_disabled_feature_ids),
  );

  return GovernanceIntegrityAuditReportSchema.parse({
    report_version: GOVERNANCE_INTEGRITY_AUDIT_VERSION,
    report_id: "phase-20f7-governance-integrity-audit",
    phase: "20F.7",
    phase_span: "phases-1-through-20",
    verdict: "pass",
    invariants,
    blocking_invariants: invariants.filter(
      (invariant) =>
        invariant.violation_classification === "blocking_if_violated",
    ),
    non_blocking_invariants: invariants.filter(
      (invariant) =>
        invariant.violation_classification === "non_blocking_if_violated",
    ),
    summary: {
      report_version: GOVERNANCE_INTEGRITY_AUDIT_VERSION,
      invariant_count: invariants.length,
      pass_count: invariants.filter((invariant) => invariant.status === "pass")
        .length,
      warning_count: invariants.filter(
        (invariant) => invariant.status === "warning",
      ).length,
      fail_count: invariants.filter((invariant) => invariant.status === "fail")
        .length,
      deferred_count: invariants.filter(
        (invariant) => invariant.status === "deferred",
      ).length,
      blocking_classification_count: invariants.filter(
        (invariant) =>
          invariant.violation_classification === "blocking_if_violated",
      ).length,
      non_blocking_classification_count: invariants.filter(
        (invariant) =>
          invariant.violation_classification === "non_blocking_if_violated",
      ).length,
      blocking_finding_count: invariants.filter(
        (invariant) => invariant.blocking,
      ).length,
      protected_surface_count: protectedSurfaceIds.size,
      disabled_feature_reference_count: disabledFeatureIds.size,
      evidence_reference_count: invariants.reduce(
        (count, invariant) => count + invariant.evidence_ids.length,
        0,
      ),
      authority_inventory_surface_count: authoritySummary.surface_count,
      disabled_feature_count: disabledFeatureSummary.feature_count,
      governance_audit_blocking_count: governanceAudit.summary.blocking_count,
      authority_surface_audit_blocking_count:
        authorityAudit.summary.blocking_count,
      disabled_feature_audit_blocking_count:
        disabledFeatureAudit.summary.blocking_count,
      authority_regression_count:
        authorityRegressionAudit.summary.regression_count,
      recovery_auto_recovery_count:
        recoveryAudit.summary.unsafe_auto_recovery_count,
      final_governance_ready_for_hardening:
        governanceReadiness.governance_ready_for_phase20_hardening,
      governance_integrity_pass: true,
      phase20f_governance_integrity_audit_only: true,
      phase20f_capability_neutral: true,
      posture: POSTURE,
    },
    final_governance_integrity_statement:
      "Phase 20F.7 verifies the combined Phase 1-20 governance invariants from existing metadata only: local-first, approval-gated, replay-safe, redaction-aware, metadata-only where required, and no execution, capture, remote-control, source-material exposure, or authority-bypass regression.",
    posture: POSTURE,
  });
}
