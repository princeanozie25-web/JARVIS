import { z } from "zod";

import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS,
  validateCommandCenterObservabilityAction,
  type CommandCenterObservabilityActionValidation,
} from "./observability-contract";
import {
  DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY,
  validateCommandCenterObservabilitySourceAdapterRegistry,
  type CommandCenterObservabilitySourceAdapterRegistry,
} from "./observability-adapters";
import {
  COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES,
  validateObservabilityPayloadSafety,
  wrapObservabilityResponse,
} from "./observability-redaction";
import { createCommandCenterObservabilityQueryRequest } from "./observability-contract";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";

export const PHASE_9B_OBSERVABILITY_CLOSEOUT_GUARDS = [
  "no_mutating_endpoints_or_actions",
  "no_tool_execution_endpoint_or_action",
  "no_approval_approve_deny_endpoint_or_action",
  "no_routine_enable_disable_schedule_rerun_endpoint_or_action",
  "no_device_environment_action",
  "no_memory_project_write",
  "no_cloud_fallback_toggle",
  "no_unredacted_export",
  "no_remote_dashboard_publish",
  "no_raw_payload_render_support",
  "all_query_categories_have_descriptor_only_adapters",
  "all_adapters_read_only_metadata_only_redaction_required",
  "response_wrapper_fails_closed_on_unsafe_payloads",
  "replay_safe_only_for_trace_governance_runtime_dependencies",
] as const;

export const PHASE_9B_OBSERVABILITY_CLOSEOUT_VERDICTS = [
  "pass",
  "fail",
] as const;

export const Phase9BObservabilityCloseoutGuardSchema = z.enum(
  PHASE_9B_OBSERVABILITY_CLOSEOUT_GUARDS,
);
export const Phase9BObservabilityCloseoutVerdictSchema = z.enum(
  PHASE_9B_OBSERVABILITY_CLOSEOUT_VERDICTS,
);

export const Phase9BObservabilityCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9b_observability_closeout_report"),
  verdict: Phase9BObservabilityCloseoutVerdictSchema,
  checked_guards: z.array(Phase9BObservabilityCloseoutGuardSchema),
  failed_guards: z.array(Phase9BObservabilityCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9b_read_only_observability_scaffold"),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  redaction_required: z.literal(true),
  descriptor_only: z.literal(true),
  authority_surface: z.literal(false),
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

export type Phase9BObservabilityCloseoutGuard = z.infer<
  typeof Phase9BObservabilityCloseoutGuardSchema
>;
export type Phase9BObservabilityCloseoutVerdict = z.infer<
  typeof Phase9BObservabilityCloseoutVerdictSchema
>;
export type Phase9BObservabilityCloseoutReport = z.infer<
  typeof Phase9BObservabilityCloseoutReportSchema
>;

export interface Phase9BObservabilityCloseoutInput {
  actionValidations?: CommandCenterObservabilityActionValidation[];
  adapterRegistry?: CommandCenterObservabilitySourceAdapterRegistry | unknown;
  unsafePayload?: unknown;
}

export function createPhase9BObservabilityCloseoutReport(
  input: Phase9BObservabilityCloseoutInput = {},
): Phase9BObservabilityCloseoutReport {
  const failedGuards = new Set<Phase9BObservabilityCloseoutGuard>();
  const notes = new Set<string>();
  const actionValidations =
    input.actionValidations ?? defaultForbiddenActionValidations();

  evaluateForbiddenActions(actionValidations, failedGuards, notes);
  evaluateAdapterRegistry(
    input.adapterRegistry ??
      DEFAULT_COMMAND_CENTER_OBSERVABILITY_SOURCE_ADAPTER_REGISTRY,
    failedGuards,
    notes,
  );
  evaluatePayloadSafety(
    input.unsafePayload ?? { raw_prompt: "withheld" },
    failedGuards,
    notes,
  );
  evaluateReplaySafety(failedGuards, notes);

  if (failedGuards.size === 0) {
    notes.add("phase_9b_observability_scaffold_is_read_only_metadata_only");
  }

  return Phase9BObservabilityCloseoutReportSchema.parse({
    kind: "command_center.phase_9b_observability_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9B_OBSERVABILITY_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    notes: [...notes],
    generated_from: "phase_9b_read_only_observability_scaffold",
    metadata_only: true,
    read_only: true,
    redaction_required: true,
    descriptor_only: true,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function defaultForbiddenActionValidations(): CommandCenterObservabilityActionValidation[] {
  return COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_ACTIONS.map((action) =>
    validateCommandCenterObservabilityAction(action),
  );
}

function evaluateForbiddenActions(
  validations: CommandCenterObservabilityActionValidation[],
  failedGuards: Set<Phase9BObservabilityCloseoutGuard>,
  notes: Set<string>,
): void {
  for (const validation of validations) {
    if (validation.allowed || validation.read_only_query_action) {
      const guard = guardForForbiddenAction(validation.action);
      failedGuards.add(guard);
      notes.add(`forbidden_action_allowed:${validation.action}`);
    }
  }
}

function guardForForbiddenAction(
  action: string,
): Phase9BObservabilityCloseoutGuard {
  if (action === "execute_tool") return "no_tool_execution_endpoint_or_action";
  if (action === "approve" || action === "deny") {
    return "no_approval_approve_deny_endpoint_or_action";
  }
  if (
    action === "enable_routine" ||
    action === "disable_routine" ||
    action === "schedule_routine" ||
    action === "rerun_routine"
  ) {
    return "no_routine_enable_disable_schedule_rerun_endpoint_or_action";
  }
  if (action === "device_action") return "no_device_environment_action";
  if (action === "write_memory" || action === "write_project") {
    return "no_memory_project_write";
  }
  if (action === "cloud_fallback_toggle") return "no_cloud_fallback_toggle";
  if (action === "export_unredacted") return "no_unredacted_export";
  if (action === "remote_dashboard_publish") {
    return "no_remote_dashboard_publish";
  }
  return "no_mutating_endpoints_or_actions";
}

function evaluateAdapterRegistry(
  registry: Phase9BObservabilityCloseoutInput["adapterRegistry"],
  failedGuards: Set<Phase9BObservabilityCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation =
    validateCommandCenterObservabilitySourceAdapterRegistry(registry);
  if (
    validation.reasons.includes("missing_category") ||
    validation.reasons.includes("duplicate_category") ||
    validation.reasons.includes("schema_rejected")
  ) {
    failedGuards.add("all_query_categories_have_descriptor_only_adapters");
    notes.add("adapter_registry_descriptor_coverage_failed");
  }
  if (
    validation.reasons.includes("mutating_adapter") ||
    validation.reasons.includes("raw_payload_field_declared")
  ) {
    failedGuards.add("all_adapters_read_only_metadata_only_redaction_required");
    notes.add("adapter_readonly_metadata_redaction_guard_failed");
  }
  if (validation.reasons.includes("replay_safe_not_allowed")) {
    failedGuards.add(
      "replay_safe_only_for_trace_governance_runtime_dependencies",
    );
    notes.add("adapter_replay_safe_category_guard_failed");
  }
}

function evaluatePayloadSafety(
  unsafePayload: unknown,
  failedGuards: Set<Phase9BObservabilityCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateObservabilityPayloadSafety(unsafePayload);
  const request = createCommandCenterObservabilityQueryRequest({
    query_id: "phase9b:closeout:unsafe_payload",
    category: "vision",
  });
  const envelope = wrapObservabilityResponse({
    request,
    payload: unsafePayload,
  });

  if (
    validation.passed ||
    envelope.render_safe ||
    envelope.payload.length > 0
  ) {
    failedGuards.add("response_wrapper_fails_closed_on_unsafe_payloads");
    notes.add("unsafe_payload_not_withheld");
  }
  if (envelope.render_safe || envelope.raw_payloads_included) {
    failedGuards.add("no_raw_payload_render_support");
    notes.add("raw_payload_render_support_detected");
  }
}

function evaluateReplaySafety(
  failedGuards: Set<Phase9BObservabilityCloseoutGuard>,
  notes: Set<string>,
): void {
  for (const category of [
    "router",
    "tool_calls",
    "approvals",
    "costs",
    "safety",
    "vision",
    "environment",
    "projects",
    "routines",
    "suggestions",
  ] as const) {
    const request = createCommandCenterObservabilityQueryRequest({
      query_id: `phase9b:closeout:${category}`,
      category,
    });
    const envelope = wrapObservabilityResponse({
      request,
      payload: [{ item_id: `${category}:item`, item_class: "metadata" }],
    });
    if (envelope.replay_safe) {
      failedGuards.add(
        "replay_safe_only_for_trace_governance_runtime_dependencies",
      );
      notes.add(`replay_safe_noncompatible_category:${category}`);
    }
  }

  for (const category of COMMAND_CENTER_OBSERVABILITY_REPLAY_COMPATIBLE_CATEGORIES) {
    const request = createCommandCenterObservabilityQueryRequest({
      query_id: `phase9b:closeout:${category}`,
      category,
    });
    const envelope = wrapObservabilityResponse({
      request,
      payload: [{ item_id: `${category}:item`, item_class: "metadata" }],
    });
    if (!envelope.replay_safe) {
      failedGuards.add(
        "replay_safe_only_for_trace_governance_runtime_dependencies",
      );
      notes.add(`replay_safe_compatible_category_missing:${category}`);
    }
  }
}
