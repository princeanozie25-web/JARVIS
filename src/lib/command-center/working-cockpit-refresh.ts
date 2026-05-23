import { z } from "zod";

import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import {
  DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
  WORKING_COCKPIT_PANEL_IDS,
  WorkingCockpitPanelIdSchema,
  WorkingCockpitUpdateCadenceBandSchema,
  listWorkingCockpitPanels,
  validateWorkingCockpitPanelRegistry,
  type WorkingCockpitPanelId,
  type WorkingCockpitPanelRegistry,
  type WorkingCockpitUpdateCadenceBand,
} from "./working-cockpit-panels";
import {
  createDefaultWorkingCockpitViewModel,
  validateWorkingCockpitViewModel,
} from "./working-cockpit-view-models";

export const WORKING_COCKPIT_PRODUCER_RATE_LIMIT_BANDS = [
  "manual",
  "low",
  "medium",
] as const;
export const WORKING_COCKPIT_STALE_AFTER_BANDS = [
  "none",
  "short",
  "medium",
  "long",
] as const;
export const WORKING_COCKPIT_BACKOFF_POLICY_CLASSES = [
  "none",
  "manual_only",
  "linear_metadata",
  "capped_metadata",
] as const;
export const WORKING_COCKPIT_REFRESH_POLICY_VALIDATION_REASONS = [
  "refresh_policy_valid",
  "schema_rejected",
  "unknown_panel",
  "cadence_exceeds_producer_rate",
  "live_stream_enabled",
  "remote_sync_enabled",
  "network_fetch_enabled",
  "max_items_exceeds_panel_cap",
] as const;
export const WORKING_COCKPIT_REFRESH_POLICY_REGISTRY_VALIDATION_REASONS = [
  ...WORKING_COCKPIT_REFRESH_POLICY_VALIDATION_REASONS,
  "duplicate_policy",
  "missing_policy",
] as const;
export const WORKING_COCKPIT_REFRESH_DECISIONS = [
  "allowed",
  "clamped",
  "blocked",
] as const;
export const WORKING_COCKPIT_REFRESH_DECISION_REASONS = [
  "requested_cadence_allowed",
  "requested_cadence_clamped_to_producer_rate",
  "unknown_panel",
  "schema_rejected",
] as const;
export const PHASE_9D_WORKING_COCKPIT_CLOSEOUT_GUARDS = [
  "no_interactive_panels",
  "no_mutating_affordances",
  "no_approval_affordances",
  "no_routine_mutation_affordances",
  "no_tool_execution_affordances",
  "no_device_environment_affordances",
  "no_cloud_fallback_toggles",
  "no_raw_payload_rendering",
  "no_live_stream_remote_dashboard_path",
  "all_panels_have_safe_view_models",
  "all_panels_have_safe_refresh_policies",
] as const;
export const PHASE_9D_WORKING_COCKPIT_FORBIDDEN_AFFORDANCE_FIELDS = [
  "interactive_panels_enabled",
  "mutating_affordances_enabled",
  "approval_affordances_enabled",
  "routine_mutation_affordances_enabled",
  "tool_execution_affordances_enabled",
  "device_environment_affordances_enabled",
  "cloud_fallback_toggles_enabled",
  "raw_payload_rendering_enabled",
  "live_stream_enabled",
  "remote_dashboard_enabled",
] as const;
export const PHASE_9D_WORKING_COCKPIT_CLOSEOUT_VERDICTS = [
  "pass",
  "fail",
] as const;

export const WorkingCockpitProducerRateLimitBandSchema = z.enum(
  WORKING_COCKPIT_PRODUCER_RATE_LIMIT_BANDS,
);
export const WorkingCockpitStaleAfterBandSchema = z.enum(
  WORKING_COCKPIT_STALE_AFTER_BANDS,
);
export const WorkingCockpitBackoffPolicyClassSchema = z.enum(
  WORKING_COCKPIT_BACKOFF_POLICY_CLASSES,
);
export const WorkingCockpitRefreshPolicyValidationReasonSchema = z.enum(
  WORKING_COCKPIT_REFRESH_POLICY_VALIDATION_REASONS,
);
export const WorkingCockpitRefreshPolicyRegistryValidationReasonSchema = z.enum(
  WORKING_COCKPIT_REFRESH_POLICY_REGISTRY_VALIDATION_REASONS,
);
export const WorkingCockpitRefreshDecisionSchema = z.enum(
  WORKING_COCKPIT_REFRESH_DECISIONS,
);
export const WorkingCockpitRefreshDecisionReasonSchema = z.enum(
  WORKING_COCKPIT_REFRESH_DECISION_REASONS,
);
export const Phase9DWorkingCockpitCloseoutGuardSchema = z.enum(
  PHASE_9D_WORKING_COCKPIT_CLOSEOUT_GUARDS,
);
export const Phase9DWorkingCockpitForbiddenAffordanceFieldSchema = z.enum(
  PHASE_9D_WORKING_COCKPIT_FORBIDDEN_AFFORDANCE_FIELDS,
);
export const Phase9DWorkingCockpitCloseoutVerdictSchema = z.enum(
  PHASE_9D_WORKING_COCKPIT_CLOSEOUT_VERDICTS,
);

export const WorkingCockpitRefreshPolicySchema = z.strictObject({
  kind: z.literal("command_center.working_cockpit_refresh_policy"),
  phase: z.literal("9D3"),
  panel_id: WorkingCockpitPanelIdSchema,
  update_cadence_band: WorkingCockpitUpdateCadenceBandSchema,
  producer_rate_limit_band: WorkingCockpitProducerRateLimitBandSchema,
  stale_after_band: WorkingCockpitStaleAfterBandSchema,
  backoff_policy_class: WorkingCockpitBackoffPolicyClassSchema,
  max_items: z.number().int().min(1).max(50),
  live_stream_allowed: z.literal(false),
  remote_sync_allowed: z.literal(false),
  remote_dashboard_allowed: z.literal(false),
  network_fetch_allowed: z.literal(false),
  starts_timer: z.literal(false),
  installs_subscription: z.literal(false),
  polling_wired: z.literal(false),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  read_only: z.literal(true),
  descriptor_only: z.literal(true),
  authority_surface: z.literal(false),
});

export const WorkingCockpitRefreshPolicyRegistrySchema = z.strictObject({
  kind: z.literal("command_center.working_cockpit_refresh_policy_registry"),
  phase: z.literal("9D3"),
  policies: z.array(WorkingCockpitRefreshPolicySchema),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  read_only: z.literal(true),
  descriptor_only: z.literal(true),
  live_stream_allowed: z.literal(false),
  remote_sync_allowed: z.literal(false),
  authority_surface: z.literal(false),
});

export const WorkingCockpitRefreshPolicyValidationSchema = z.strictObject({
  passed: z.boolean(),
  reasons: z.array(WorkingCockpitRefreshPolicyValidationReasonSchema),
  panel_id: WorkingCockpitPanelIdSchema.nullable(),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  read_only: z.literal(true),
  descriptor_only: z.literal(true),
  live_stream_allowed: z.literal(false),
  remote_sync_allowed: z.literal(false),
  remote_dashboard_allowed: z.literal(false),
  network_fetch_allowed: z.literal(false),
  starts_timer: z.literal(false),
  polling_wired: z.literal(false),
  authority_surface: z.literal(false),
});

export const WorkingCockpitRefreshPolicyRegistryValidationSchema =
  z.strictObject({
    passed: z.boolean(),
    reasons: z.array(WorkingCockpitRefreshPolicyRegistryValidationReasonSchema),
    policy_count: z.number().int().nonnegative(),
    missing_panel_ids: z.array(WorkingCockpitPanelIdSchema),
    duplicate_panel_ids: z.array(WorkingCockpitPanelIdSchema),
    invalid_panel_ids: z.array(WorkingCockpitPanelIdSchema),
    metadata_only: z.literal(true),
    redaction_required: z.literal(true),
    read_only: z.literal(true),
    descriptor_only: z.literal(true),
    live_stream_allowed: z.literal(false),
    remote_sync_allowed: z.literal(false),
    remote_dashboard_allowed: z.literal(false),
    network_fetch_allowed: z.literal(false),
    starts_timer: z.literal(false),
    polling_wired: z.literal(false),
    authority_surface: z.literal(false),
  });

export const WorkingCockpitRefreshPolicyLookupSchema = z.strictObject({
  found: z.boolean(),
  panel_id: WorkingCockpitPanelIdSchema.nullable(),
  policy: WorkingCockpitRefreshPolicySchema.nullable(),
  reason: WorkingCockpitRefreshPolicyValidationReasonSchema,
  descriptor_only: z.literal(true),
});

export const WorkingCockpitRefreshDecisionResultSchema = z.strictObject({
  kind: z.literal("command_center.working_cockpit_refresh_decision"),
  panel_id: WorkingCockpitPanelIdSchema.nullable(),
  requested_cadence_band: WorkingCockpitUpdateCadenceBandSchema.nullable(),
  resolved_cadence_band: WorkingCockpitUpdateCadenceBandSchema.nullable(),
  producer_rate_limit_band:
    WorkingCockpitProducerRateLimitBandSchema.nullable(),
  decision: WorkingCockpitRefreshDecisionSchema,
  reason: WorkingCockpitRefreshDecisionReasonSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  descriptor_only: z.literal(true),
  starts_timer: z.literal(false),
  polling_wired: z.literal(false),
  network_called: z.literal(false),
  authority_surface: z.literal(false),
});

export const Phase9DWorkingCockpitAffordanceStateSchema = z.strictObject({
  interactive_panels_enabled: z.literal(false),
  mutating_affordances_enabled: z.literal(false),
  approval_affordances_enabled: z.literal(false),
  routine_mutation_affordances_enabled: z.literal(false),
  tool_execution_affordances_enabled: z.literal(false),
  device_environment_affordances_enabled: z.literal(false),
  cloud_fallback_toggles_enabled: z.literal(false),
  raw_payload_rendering_enabled: z.literal(false),
  live_stream_enabled: z.literal(false),
  remote_dashboard_enabled: z.literal(false),
});

export const Phase9DWorkingCockpitCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9d_working_cockpit_closeout_report"),
  verdict: Phase9DWorkingCockpitCloseoutVerdictSchema,
  checked_guards: z.array(Phase9DWorkingCockpitCloseoutGuardSchema),
  failed_guards: z.array(Phase9DWorkingCockpitCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9d_working_cockpit_scaffold"),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  read_only: z.literal(true),
  render_safe: z.boolean(),
  display_only: z.literal(true),
  authority_surface: z.literal(false),
  live_stream_allowed: z.literal(false),
  remote_dashboard_allowed: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  routine_scheduled: z.literal(false),
  routine_triggered: z.literal(false),
  memory_written: z.literal(false),
  project_written: z.literal(false),
  device_action_triggered: z.literal(false),
  cloud_fallback_triggered: z.literal(false),
  db_write_performed: z.literal(false),
  network_called: z.literal(false),
  audio_capture_started: z.literal(false),
  video_capture_started: z.literal(false),
});

export type WorkingCockpitProducerRateLimitBand = z.infer<
  typeof WorkingCockpitProducerRateLimitBandSchema
>;
export type WorkingCockpitStaleAfterBand = z.infer<
  typeof WorkingCockpitStaleAfterBandSchema
>;
export type WorkingCockpitBackoffPolicyClass = z.infer<
  typeof WorkingCockpitBackoffPolicyClassSchema
>;
export type WorkingCockpitRefreshPolicyValidationReason = z.infer<
  typeof WorkingCockpitRefreshPolicyValidationReasonSchema
>;
export type WorkingCockpitRefreshPolicyRegistryValidationReason = z.infer<
  typeof WorkingCockpitRefreshPolicyRegistryValidationReasonSchema
>;
export type WorkingCockpitRefreshDecision = z.infer<
  typeof WorkingCockpitRefreshDecisionSchema
>;
export type WorkingCockpitRefreshDecisionReason = z.infer<
  typeof WorkingCockpitRefreshDecisionReasonSchema
>;
export type Phase9DWorkingCockpitCloseoutGuard = z.infer<
  typeof Phase9DWorkingCockpitCloseoutGuardSchema
>;
export type Phase9DWorkingCockpitForbiddenAffordanceField = z.infer<
  typeof Phase9DWorkingCockpitForbiddenAffordanceFieldSchema
>;
export type Phase9DWorkingCockpitCloseoutVerdict = z.infer<
  typeof Phase9DWorkingCockpitCloseoutVerdictSchema
>;
export type WorkingCockpitRefreshPolicy = z.infer<
  typeof WorkingCockpitRefreshPolicySchema
>;
export type WorkingCockpitRefreshPolicyRegistry = z.infer<
  typeof WorkingCockpitRefreshPolicyRegistrySchema
>;
export type WorkingCockpitRefreshPolicyValidation = z.infer<
  typeof WorkingCockpitRefreshPolicyValidationSchema
>;
export type WorkingCockpitRefreshPolicyRegistryValidation = z.infer<
  typeof WorkingCockpitRefreshPolicyRegistryValidationSchema
>;
export type WorkingCockpitRefreshPolicyLookup = z.infer<
  typeof WorkingCockpitRefreshPolicyLookupSchema
>;
export type WorkingCockpitRefreshDecisionResult = z.infer<
  typeof WorkingCockpitRefreshDecisionResultSchema
>;
export type Phase9DWorkingCockpitAffordanceState = z.infer<
  typeof Phase9DWorkingCockpitAffordanceStateSchema
>;
export type Phase9DWorkingCockpitCloseoutReport = z.infer<
  typeof Phase9DWorkingCockpitCloseoutReportSchema
>;

export interface Phase9DWorkingCockpitCloseoutInput {
  panelRegistry?: WorkingCockpitPanelRegistry | unknown;
  viewModel?: unknown;
  refreshPolicyRegistry?: WorkingCockpitRefreshPolicyRegistry | unknown;
  affordanceState?: unknown;
}

export const DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY: WorkingCockpitRefreshPolicyRegistry =
  WorkingCockpitRefreshPolicyRegistrySchema.parse({
    kind: "command_center.working_cockpit_refresh_policy_registry",
    phase: "9D3",
    policies: listWorkingCockpitPanels().map((panel) =>
      createRefreshPolicyForPanel(panel.panel_id),
    ),
    metadata_only: true,
    redaction_required: true,
    read_only: true,
    descriptor_only: true,
    live_stream_allowed: false,
    remote_sync_allowed: false,
    authority_surface: false,
  });

export const DEFAULT_PHASE_9D_WORKING_COCKPIT_AFFORDANCE_STATE: Phase9DWorkingCockpitAffordanceState =
  Phase9DWorkingCockpitAffordanceStateSchema.parse({
    interactive_panels_enabled: false,
    mutating_affordances_enabled: false,
    approval_affordances_enabled: false,
    routine_mutation_affordances_enabled: false,
    tool_execution_affordances_enabled: false,
    device_environment_affordances_enabled: false,
    cloud_fallback_toggles_enabled: false,
    raw_payload_rendering_enabled: false,
    live_stream_enabled: false,
    remote_dashboard_enabled: false,
  });

export function listWorkingCockpitRefreshPolicies(
  registry: WorkingCockpitRefreshPolicyRegistry = DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY,
): WorkingCockpitRefreshPolicy[] {
  return [
    ...WorkingCockpitRefreshPolicyRegistrySchema.parse(registry).policies,
  ];
}

export function findWorkingCockpitRefreshPolicy(
  panelIdInput: unknown,
  registry: WorkingCockpitRefreshPolicyRegistry = DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY,
): WorkingCockpitRefreshPolicyLookup {
  const panelId = WorkingCockpitPanelIdSchema.safeParse(panelIdInput);
  if (!panelId.success) {
    return WorkingCockpitRefreshPolicyLookupSchema.parse({
      found: false,
      panel_id: null,
      policy: null,
      reason: "unknown_panel",
      descriptor_only: true,
    });
  }
  const policy = WorkingCockpitRefreshPolicyRegistrySchema.parse(
    registry,
  ).policies.find((item) => item.panel_id === panelId.data);
  return WorkingCockpitRefreshPolicyLookupSchema.parse({
    found: policy !== undefined,
    panel_id: panelId.data,
    policy: policy ?? null,
    reason: policy ? "refresh_policy_valid" : "unknown_panel",
    descriptor_only: true,
  });
}

export function validateWorkingCockpitRefreshPolicy(
  input: unknown,
  panelRegistry: WorkingCockpitPanelRegistry = DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
): WorkingCockpitRefreshPolicyValidation {
  const parsed = WorkingCockpitRefreshPolicySchema.safeParse(input);
  const partial = readPartialPolicy(input);
  const reasons = new Set<WorkingCockpitRefreshPolicyValidationReason>();
  const panel = partial.panel_id
    ? listWorkingCockpitPanels(panelRegistry).find(
        (item) => item.panel_id === partial.panel_id,
      )
    : undefined;

  if (!parsed.success) reasons.add("schema_rejected");
  if (!partial.panel_id || !panel) reasons.add("unknown_panel");
  if (
    partial.update_cadence_band &&
    partial.producer_rate_limit_band &&
    cadenceRank(partial.update_cadence_band) >
      cadenceRank(partial.producer_rate_limit_band)
  ) {
    reasons.add("cadence_exceeds_producer_rate");
  }
  if (partial.live_stream_allowed !== false) reasons.add("live_stream_enabled");
  if (
    partial.remote_sync_allowed !== false ||
    partial.remote_dashboard_allowed !== false
  ) {
    reasons.add("remote_sync_enabled");
  }
  if (partial.network_fetch_allowed !== false)
    reasons.add("network_fetch_enabled");
  if (
    typeof partial.max_items === "number" &&
    panel &&
    partial.max_items > panel.max_items
  ) {
    reasons.add("max_items_exceeds_panel_cap");
  }

  return WorkingCockpitRefreshPolicyValidationSchema.parse({
    passed: reasons.size === 0,
    reasons: reasons.size === 0 ? ["refresh_policy_valid"] : [...reasons],
    panel_id: partial.panel_id,
    metadata_only: true,
    redaction_required: true,
    read_only: true,
    descriptor_only: true,
    live_stream_allowed: false,
    remote_sync_allowed: false,
    remote_dashboard_allowed: false,
    network_fetch_allowed: false,
    starts_timer: false,
    polling_wired: false,
    authority_surface: false,
  });
}

export function validateWorkingCockpitRefreshPolicyRegistry(
  input: unknown = DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY,
  panelRegistry: WorkingCockpitPanelRegistry = DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY,
): WorkingCockpitRefreshPolicyRegistryValidation {
  const parsed = WorkingCockpitRefreshPolicyRegistrySchema.safeParse(input);
  const policies = readPolicies(input);
  const reasons =
    new Set<WorkingCockpitRefreshPolicyRegistryValidationReason>();
  const seen = new Set<WorkingCockpitPanelId>();
  const duplicates = new Set<WorkingCockpitPanelId>();
  const invalid = new Set<WorkingCockpitPanelId>();

  if (!parsed.success) reasons.add("schema_rejected");
  for (const policy of policies) {
    const validation = validateWorkingCockpitRefreshPolicy(
      policy,
      panelRegistry,
    );
    if (!validation.passed) {
      validation.reasons.forEach((reason) => {
        if (reason !== "refresh_policy_valid") reasons.add(reason);
      });
      if (validation.panel_id) invalid.add(validation.panel_id);
    }
    if (validation.panel_id) {
      if (seen.has(validation.panel_id)) {
        duplicates.add(validation.panel_id);
        reasons.add("duplicate_policy");
      }
      seen.add(validation.panel_id);
    }
  }
  const missing = WORKING_COCKPIT_PANEL_IDS.filter(
    (panelId) => !seen.has(panelId),
  );
  if (missing.length > 0) reasons.add("missing_policy");

  return WorkingCockpitRefreshPolicyRegistryValidationSchema.parse({
    passed: reasons.size === 0,
    reasons: reasons.size === 0 ? ["refresh_policy_valid"] : [...reasons],
    policy_count: policies.length,
    missing_panel_ids: missing,
    duplicate_panel_ids: [...duplicates],
    invalid_panel_ids: [...invalid],
    metadata_only: true,
    redaction_required: true,
    read_only: true,
    descriptor_only: true,
    live_stream_allowed: false,
    remote_sync_allowed: false,
    remote_dashboard_allowed: false,
    network_fetch_allowed: false,
    starts_timer: false,
    polling_wired: false,
    authority_surface: false,
  });
}

export function resolveWorkingCockpitRefreshDecision(
  panelIdInput: unknown,
  requestedCadenceInput: unknown,
  registry: WorkingCockpitRefreshPolicyRegistry = DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY,
): WorkingCockpitRefreshDecisionResult {
  const panelId = WorkingCockpitPanelIdSchema.safeParse(panelIdInput);
  const requested = WorkingCockpitUpdateCadenceBandSchema.safeParse(
    requestedCadenceInput,
  );
  if (!panelId.success) {
    return refreshDecision({
      panelId: null,
      requestedCadence: requested.success ? requested.data : null,
      resolvedCadence: null,
      producerRate: null,
      decision: "blocked",
      reason: "unknown_panel",
    });
  }
  if (!requested.success) {
    return refreshDecision({
      panelId: panelId.data,
      requestedCadence: null,
      resolvedCadence: null,
      producerRate: null,
      decision: "blocked",
      reason: "schema_rejected",
    });
  }
  const lookup = findWorkingCockpitRefreshPolicy(panelId.data, registry);
  if (!lookup.policy) {
    return refreshDecision({
      panelId: panelId.data,
      requestedCadence: requested.data,
      resolvedCadence: null,
      producerRate: null,
      decision: "blocked",
      reason: "unknown_panel",
    });
  }
  if (
    cadenceRank(requested.data) >
    cadenceRank(lookup.policy.producer_rate_limit_band)
  ) {
    return refreshDecision({
      panelId: panelId.data,
      requestedCadence: requested.data,
      resolvedCadence: lookup.policy.producer_rate_limit_band,
      producerRate: lookup.policy.producer_rate_limit_band,
      decision: "clamped",
      reason: "requested_cadence_clamped_to_producer_rate",
    });
  }
  return refreshDecision({
    panelId: panelId.data,
    requestedCadence: requested.data,
    resolvedCadence: requested.data,
    producerRate: lookup.policy.producer_rate_limit_band,
    decision: "allowed",
    reason: "requested_cadence_allowed",
  });
}

export function createPhase9DWorkingCockpitCloseoutReport(
  input: Phase9DWorkingCockpitCloseoutInput = {},
): Phase9DWorkingCockpitCloseoutReport {
  const failedGuards = new Set<Phase9DWorkingCockpitCloseoutGuard>();
  const notes = new Set<string>();
  const panelRegistry =
    input.panelRegistry ?? DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY;
  const viewModel = input.viewModel ?? createDefaultWorkingCockpitViewModel();
  const refreshPolicyRegistry =
    input.refreshPolicyRegistry ??
    DEFAULT_WORKING_COCKPIT_REFRESH_POLICY_REGISTRY;
  const affordanceState =
    input.affordanceState ?? DEFAULT_PHASE_9D_WORKING_COCKPIT_AFFORDANCE_STATE;

  evaluatePanelRegistry(panelRegistry, failedGuards, notes);
  evaluateViewModel(viewModel, failedGuards, notes);
  evaluateRefreshPolicies(
    refreshPolicyRegistry,
    panelRegistry,
    failedGuards,
    notes,
  );
  evaluateAffordanceState(affordanceState, failedGuards, notes);

  if (failedGuards.size === 0) {
    notes.add("phase_9d_working_cockpit_scaffold_is_display_only");
  }

  return Phase9DWorkingCockpitCloseoutReportSchema.parse({
    kind: "command_center.phase_9d_working_cockpit_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9D_WORKING_COCKPIT_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    notes: [...notes],
    generated_from: "phase_9d_working_cockpit_scaffold",
    metadata_only: true,
    redaction_required: true,
    read_only: true,
    render_safe: failedGuards.size === 0,
    display_only: true,
    authority_surface: false,
    live_stream_allowed: false,
    remote_dashboard_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function createRefreshPolicyForPanel(
  panelId: WorkingCockpitPanelId,
): WorkingCockpitRefreshPolicy {
  const panel = listWorkingCockpitPanels().find(
    (item) => item.panel_id === panelId,
  );
  return WorkingCockpitRefreshPolicySchema.parse({
    kind: "command_center.working_cockpit_refresh_policy",
    phase: "9D3",
    panel_id: panelId,
    update_cadence_band: panel?.update_cadence_band ?? "low",
    producer_rate_limit_band: panel?.update_cadence_band ?? "low",
    stale_after_band: staleBandForPanel(panelId),
    backoff_policy_class:
      panelId === "router" ? "linear_metadata" : "capped_metadata",
    max_items: panel?.max_items ?? 10,
    live_stream_allowed: false,
    remote_sync_allowed: false,
    remote_dashboard_allowed: false,
    network_fetch_allowed: false,
    starts_timer: false,
    installs_subscription: false,
    polling_wired: false,
    metadata_only: true,
    redaction_required: true,
    read_only: true,
    descriptor_only: true,
    authority_surface: false,
  });
}

function staleBandForPanel(
  panelId: WorkingCockpitPanelId,
): WorkingCockpitStaleAfterBand {
  if (panelId === "router" || panelId === "tool_calls") return "short";
  if (panelId === "approvals" || panelId === "safety") return "medium";
  return "long";
}

function cadenceRank(
  band: WorkingCockpitUpdateCadenceBand | WorkingCockpitProducerRateLimitBand,
): number {
  if (band === "manual") return 0;
  if (band === "low") return 1;
  return 2;
}

function readPartialPolicy(input: unknown): {
  panel_id: WorkingCockpitPanelId | null;
  update_cadence_band?: WorkingCockpitUpdateCadenceBand;
  producer_rate_limit_band?: WorkingCockpitProducerRateLimitBand;
  max_items?: unknown;
  live_stream_allowed?: unknown;
  remote_sync_allowed?: unknown;
  remote_dashboard_allowed?: unknown;
  network_fetch_allowed?: unknown;
} {
  if (!input || typeof input !== "object") return { panel_id: null };
  const record = input as Record<string, unknown>;
  const panelId = WorkingCockpitPanelIdSchema.safeParse(record.panel_id);
  const cadence = WorkingCockpitUpdateCadenceBandSchema.safeParse(
    record.update_cadence_band,
  );
  const producer = WorkingCockpitProducerRateLimitBandSchema.safeParse(
    record.producer_rate_limit_band,
  );
  return {
    panel_id: panelId.success ? panelId.data : null,
    update_cadence_band: cadence.success ? cadence.data : undefined,
    producer_rate_limit_band: producer.success ? producer.data : undefined,
    max_items: record.max_items,
    live_stream_allowed: record.live_stream_allowed,
    remote_sync_allowed: record.remote_sync_allowed,
    remote_dashboard_allowed: record.remote_dashboard_allowed,
    network_fetch_allowed: record.network_fetch_allowed,
  };
}

function readPolicies(input: unknown): unknown[] {
  if (!input || typeof input !== "object") return [];
  const policies = (input as { policies?: unknown }).policies;
  return Array.isArray(policies) ? policies : [];
}

function refreshDecision(input: {
  panelId: WorkingCockpitPanelId | null;
  requestedCadence: WorkingCockpitUpdateCadenceBand | null;
  resolvedCadence: WorkingCockpitUpdateCadenceBand | null;
  producerRate: WorkingCockpitProducerRateLimitBand | null;
  decision: WorkingCockpitRefreshDecision;
  reason: WorkingCockpitRefreshDecisionReason;
}): WorkingCockpitRefreshDecisionResult {
  return WorkingCockpitRefreshDecisionResultSchema.parse({
    kind: "command_center.working_cockpit_refresh_decision",
    panel_id: input.panelId,
    requested_cadence_band: input.requestedCadence,
    resolved_cadence_band: input.resolvedCadence,
    producer_rate_limit_band: input.producerRate,
    decision: input.decision,
    reason: input.reason,
    metadata_only: true,
    read_only: true,
    descriptor_only: true,
    starts_timer: false,
    polling_wired: false,
    network_called: false,
    authority_surface: false,
  });
}

function evaluatePanelRegistry(
  panelRegistry: unknown,
  failedGuards: Set<Phase9DWorkingCockpitCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateWorkingCockpitPanelRegistry(panelRegistry);
  if (!validation.passed) {
    failedGuards.add("no_interactive_panels");
    failedGuards.add("no_mutating_affordances");
    notes.add("working_cockpit_panel_registry_validation_failed");
  }
}

function evaluateViewModel(
  viewModel: unknown,
  failedGuards: Set<Phase9DWorkingCockpitCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateWorkingCockpitViewModel(viewModel);
  if (!validation.passed) {
    failedGuards.add("all_panels_have_safe_view_models");
    if (validation.reasons.includes("raw_payload_field_present")) {
      failedGuards.add("no_raw_payload_rendering");
      notes.add("working_cockpit_view_model_raw_payload_detected");
    } else {
      notes.add("working_cockpit_view_model_validation_failed");
    }
  }
}

function evaluateRefreshPolicies(
  refreshPolicyRegistry: unknown,
  panelRegistry: unknown,
  failedGuards: Set<Phase9DWorkingCockpitCloseoutGuard>,
  notes: Set<string>,
): void {
  const registry = WorkingCockpitPanelRegistrySafeParse(panelRegistry);
  const validation = validateWorkingCockpitRefreshPolicyRegistry(
    refreshPolicyRegistry,
    registry,
  );
  if (!validation.passed) {
    failedGuards.add("all_panels_have_safe_refresh_policies");
    if (
      validation.reasons.includes("live_stream_enabled") ||
      validation.reasons.includes("remote_sync_enabled") ||
      validation.reasons.includes("network_fetch_enabled")
    ) {
      failedGuards.add("no_live_stream_remote_dashboard_path");
    }
    notes.add("working_cockpit_refresh_policy_validation_failed");
  }
}

function evaluateAffordanceState(
  affordanceState: unknown,
  failedGuards: Set<Phase9DWorkingCockpitCloseoutGuard>,
  notes: Set<string>,
): void {
  if (
    Phase9DWorkingCockpitAffordanceStateSchema.safeParse(affordanceState)
      .success
  ) {
    return;
  }
  if (!affordanceState || typeof affordanceState !== "object") {
    for (const [, guard] of AFFORDANCE_FIELD_TO_GUARD) failedGuards.add(guard);
    notes.add("working_cockpit_affordance_state_invalid");
    return;
  }
  const record = affordanceState as Partial<
    Record<Phase9DWorkingCockpitForbiddenAffordanceField, unknown>
  >;
  for (const [field, guard] of AFFORDANCE_FIELD_TO_GUARD) {
    if (record[field] !== false) {
      failedGuards.add(guard);
      notes.add(`forbidden_working_cockpit_affordance_enabled:${field}`);
    }
  }
}

function WorkingCockpitPanelRegistrySafeParse(
  input: unknown,
): WorkingCockpitPanelRegistry {
  const parsed = DEFAULT_WORKING_COCKPIT_PANEL_REGISTRY;
  if (validateWorkingCockpitPanelRegistry(input).passed) {
    return input as WorkingCockpitPanelRegistry;
  }
  return parsed;
}

const AFFORDANCE_FIELD_TO_GUARD: ReadonlyArray<
  [
    Phase9DWorkingCockpitForbiddenAffordanceField,
    Phase9DWorkingCockpitCloseoutGuard,
  ]
> = [
  ["interactive_panels_enabled", "no_interactive_panels"],
  ["mutating_affordances_enabled", "no_mutating_affordances"],
  ["approval_affordances_enabled", "no_approval_affordances"],
  ["routine_mutation_affordances_enabled", "no_routine_mutation_affordances"],
  ["tool_execution_affordances_enabled", "no_tool_execution_affordances"],
  [
    "device_environment_affordances_enabled",
    "no_device_environment_affordances",
  ],
  ["cloud_fallback_toggles_enabled", "no_cloud_fallback_toggles"],
  ["raw_payload_rendering_enabled", "no_raw_payload_rendering"],
  ["live_stream_enabled", "no_live_stream_remote_dashboard_path"],
  ["remote_dashboard_enabled", "no_live_stream_remote_dashboard_path"],
];
