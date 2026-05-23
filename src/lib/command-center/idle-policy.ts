import { z } from "zod";

import {
  DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  createCommandCenterShellState,
  returnCommandCenterToRestForIdle,
  returnCommandCenterToRestManually,
  wakeCommandCenterFromUserInput,
} from "./state-machine";
import {
  CommandCenterModeSchema,
  CommandCenterShellStateSchema,
  type CommandCenterMode,
  type CommandCenterShellState,
  type CommandCenterTransitionResult,
} from "./types";

export const COMMAND_CENTER_IDLE_TIMEOUT_BANDS = [
  "none",
  "short",
  "medium",
  "long",
] as const;

export const COMMAND_CENTER_IDLE_WAKE_SOURCES = [
  "user_input",
  "manual_idle",
  "timeout_idle",
  "voice_wake_word",
  "microphone_activity",
  "camera_activity",
  "presence_detected",
  "network_event",
  "automatic_audit",
] as const;

export const COMMAND_CENTER_IDLE_WAKE_DECISIONS = [
  "allowed",
  "blocked",
] as const;

export const COMMAND_CENTER_IDLE_WAKE_REASONS = [
  "user_input_wake_allowed",
  "manual_idle_to_rest_allowed",
  "timeout_idle_to_rest_allowed",
  "timeout_idle_not_allowed",
  "wake_source_disabled",
  "network_wake_disabled",
  "automatic_audit_blocked",
  "unsupported_idle_transition",
  "policy_disallows_target",
  "schema_rejected",
] as const;

export const PHASE_9A_COMMAND_CENTER_CLOSEOUT_GUARDS = [
  "no_execution_affordance",
  "no_approval_affordance",
  "no_routine_mutation_affordance",
  "no_tool_mutation_affordance",
  "no_capture_affordance",
  "no_remote_dashboard_affordance",
  "no_graph_replay_execution_affordance",
] as const;

export const PHASE_9A_COMMAND_CENTER_FORBIDDEN_AFFORDANCE_FIELDS = [
  "execution_affordance_enabled",
  "approval_affordance_enabled",
  "routine_mutation_affordance_enabled",
  "tool_mutation_affordance_enabled",
  "capture_affordance_enabled",
  "remote_dashboard_affordance_enabled",
  "graph_replay_execution_affordance_enabled",
] as const;

export const COMMAND_CENTER_CLOSEOUT_VERDICTS = ["pass", "fail"] as const;

export const CommandCenterIdleTimeoutBandSchema = z.enum(
  COMMAND_CENTER_IDLE_TIMEOUT_BANDS,
);
export const CommandCenterIdleWakeSourceSchema = z.enum(
  COMMAND_CENTER_IDLE_WAKE_SOURCES,
);
export const CommandCenterIdleWakeDecisionSchema = z.enum(
  COMMAND_CENTER_IDLE_WAKE_DECISIONS,
);
export const CommandCenterIdleWakeReasonSchema = z.enum(
  COMMAND_CENTER_IDLE_WAKE_REASONS,
);
export const Phase9ACommandCenterCloseoutGuardSchema = z.enum(
  PHASE_9A_COMMAND_CENTER_CLOSEOUT_GUARDS,
);
export const Phase9ACommandCenterForbiddenAffordanceFieldSchema = z.enum(
  PHASE_9A_COMMAND_CENTER_FORBIDDEN_AFFORDANCE_FIELDS,
);
export const CommandCenterCloseoutVerdictSchema = z.enum(
  COMMAND_CENTER_CLOSEOUT_VERDICTS,
);

export const CommandCenterIdleTransitionReasonMetadataSchema = z.strictObject({
  user_input_wake_metadata_only: z.literal(true),
  manual_idle_metadata_only: z.literal(true),
  timeout_idle_band_only: z.literal(true),
  automatic_audit_allowed: z.literal(false),
  disabled_source_reason_only: z.literal(true),
});

export const CommandCenterIdlePolicySchema = z.strictObject({
  kind: z.literal("command_center.idle_policy"),
  phase: z.literal("9A3"),
  current_mode: CommandCenterModeSchema,
  idle_timeout_band: CommandCenterIdleTimeoutBandSchema,
  allowed_idle_transition_targets: z.array(CommandCenterModeSchema),
  wake_sources: z.array(CommandCenterIdleWakeSourceSchema),
  disabled_wake_sources: z.array(CommandCenterIdleWakeSourceSchema),
  timeout_idle_transition_allowed: z.boolean(),
  user_input_only_wake: z.literal(true),
  transition_reason_metadata: CommandCenterIdleTransitionReasonMetadataSchema,
  presentation_only: z.literal(true),
  authority_surface: z.literal(false),
  starts_timer: z.literal(false),
  installs_event_listener: z.literal(false),
  captures_audio: z.literal(false),
  captures_video: z.literal(false),
});

export const CommandCenterIdleWakeTransitionRequestSchema = z.strictObject({
  source: CommandCenterIdleWakeSourceSchema,
  requested_target: CommandCenterModeSchema.optional(),
});

export const CommandCenterIdleWakeTransitionEvaluationSchema =
  CommandCenterShellStateSchema.extend({
    kind: z.literal("command_center.idle_wake_transition_evaluation"),
    source: CommandCenterIdleWakeSourceSchema,
    decision: CommandCenterIdleWakeDecisionSchema,
    reason: CommandCenterIdleWakeReasonSchema,
    requested_target: CommandCenterModeSchema.nullable(),
    previous_mode: CommandCenterModeSchema,
    next_mode: CommandCenterModeSchema,
    changed: z.boolean(),
    presentation_only: z.literal(true),
    authority_surface: z.literal(false),
    starts_timer: z.literal(false),
    installs_event_listener: z.literal(false),
    captures_audio: z.literal(false),
    captures_video: z.literal(false),
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

export const Phase9ACommandCenterAffordanceStateSchema = z.strictObject({
  execution_affordance_enabled: z.literal(false),
  approval_affordance_enabled: z.literal(false),
  routine_mutation_affordance_enabled: z.literal(false),
  tool_mutation_affordance_enabled: z.literal(false),
  capture_affordance_enabled: z.literal(false),
  remote_dashboard_affordance_enabled: z.literal(false),
  graph_replay_execution_affordance_enabled: z.literal(false),
});

export const Phase9ACommandCenterCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9a_closeout_report"),
  verdict: CommandCenterCloseoutVerdictSchema,
  checked_guards: z.array(Phase9ACommandCenterCloseoutGuardSchema),
  failed_guards: z.array(Phase9ACommandCenterCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(160)),
  generated_from: z.literal("phase_9a_command_center_scaffold"),
  metadata_only: z.literal(true),
  presentation_only: z.literal(true),
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

export type CommandCenterIdleTimeoutBand = z.infer<
  typeof CommandCenterIdleTimeoutBandSchema
>;
export type CommandCenterIdleWakeSource = z.infer<
  typeof CommandCenterIdleWakeSourceSchema
>;
export type CommandCenterIdleWakeDecision = z.infer<
  typeof CommandCenterIdleWakeDecisionSchema
>;
export type CommandCenterIdleWakeReason = z.infer<
  typeof CommandCenterIdleWakeReasonSchema
>;
export type Phase9ACommandCenterCloseoutGuard = z.infer<
  typeof Phase9ACommandCenterCloseoutGuardSchema
>;
export type Phase9ACommandCenterForbiddenAffordanceField = z.infer<
  typeof Phase9ACommandCenterForbiddenAffordanceFieldSchema
>;
export type CommandCenterCloseoutVerdict = z.infer<
  typeof CommandCenterCloseoutVerdictSchema
>;
export type CommandCenterIdleTransitionReasonMetadata = z.infer<
  typeof CommandCenterIdleTransitionReasonMetadataSchema
>;
export type CommandCenterIdlePolicy = z.infer<
  typeof CommandCenterIdlePolicySchema
>;
export type CommandCenterIdleWakeTransitionRequest = z.infer<
  typeof CommandCenterIdleWakeTransitionRequestSchema
>;
export type CommandCenterIdleWakeTransitionEvaluation = z.infer<
  typeof CommandCenterIdleWakeTransitionEvaluationSchema
>;
export type Phase9ACommandCenterAffordanceState = z.infer<
  typeof Phase9ACommandCenterAffordanceStateSchema
>;
export type Phase9ACommandCenterCloseoutReport = z.infer<
  typeof Phase9ACommandCenterCloseoutReportSchema
>;

export const DEFAULT_PHASE_9A_COMMAND_CENTER_AFFORDANCE_STATE: Phase9ACommandCenterAffordanceState =
  Phase9ACommandCenterAffordanceStateSchema.parse({
    execution_affordance_enabled: false,
    approval_affordance_enabled: false,
    routine_mutation_affordance_enabled: false,
    tool_mutation_affordance_enabled: false,
    capture_affordance_enabled: false,
    remote_dashboard_affordance_enabled: false,
    graph_replay_execution_affordance_enabled: false,
  });

export function createCommandCenterIdlePolicy(input: {
  current_mode: CommandCenterMode;
  idle_timeout_band?: CommandCenterIdleTimeoutBand;
  allowed_idle_transition_targets?: CommandCenterMode[];
  timeout_idle_transition_allowed?: boolean;
}): CommandCenterIdlePolicy {
  return CommandCenterIdlePolicySchema.parse({
    kind: "command_center.idle_policy",
    phase: "9A3",
    current_mode: input.current_mode,
    idle_timeout_band: input.idle_timeout_band ?? "none",
    allowed_idle_transition_targets:
      input.allowed_idle_transition_targets ??
      defaultAllowedIdleTargets(input.current_mode),
    wake_sources: ["user_input", "manual_idle", "timeout_idle"],
    disabled_wake_sources: [
      "voice_wake_word",
      "microphone_activity",
      "camera_activity",
      "presence_detected",
      "network_event",
      "automatic_audit",
    ],
    timeout_idle_transition_allowed:
      input.timeout_idle_transition_allowed ?? true,
    user_input_only_wake: true,
    transition_reason_metadata: {
      user_input_wake_metadata_only: true,
      manual_idle_metadata_only: true,
      timeout_idle_band_only: true,
      automatic_audit_allowed: false,
      disabled_source_reason_only: true,
    },
    presentation_only: true,
    authority_surface: false,
    starts_timer: false,
    installs_event_listener: false,
    captures_audio: false,
    captures_video: false,
  });
}

export function evaluateCommandCenterIdleWakeTransition(input: {
  policy: CommandCenterIdlePolicy;
  request: CommandCenterIdleWakeTransitionRequest;
  state?: CommandCenterShellState;
}): CommandCenterIdleWakeTransitionEvaluation {
  const policy = CommandCenterIdlePolicySchema.parse(input.policy);
  const request = CommandCenterIdleWakeTransitionRequestSchema.parse(
    input.request,
  );
  const state =
    input.state ??
    createCommandCenterShellState({ initial_mode: policy.current_mode });

  if (
    request.requested_target === "audit" ||
    request.source === "automatic_audit"
  ) {
    return blockedEvaluation({
      state,
      source: request.source,
      requestedTarget: request.requested_target ?? null,
      reason: "automatic_audit_blocked",
    });
  }

  if (isDisabledWakeSource(request.source)) {
    return blockedEvaluation({
      state,
      source: request.source,
      requestedTarget: request.requested_target ?? null,
      reason:
        request.source === "network_event"
          ? "network_wake_disabled"
          : "wake_source_disabled",
    });
  }

  if (request.source === "user_input") {
    if (state.mode === "rest" && request.requested_target !== "rest") {
      return allowedEvaluation(
        "user_input_wake_allowed",
        request,
        wakeCommandCenterFromUserInput(state),
      );
    }
    return blockedEvaluation({
      state,
      source: request.source,
      requestedTarget: request.requested_target ?? null,
      reason: "unsupported_idle_transition",
    });
  }

  if (request.source === "manual_idle") {
    if (canMoveToRestByPolicy(policy, state.mode)) {
      return allowedEvaluation(
        "manual_idle_to_rest_allowed",
        request,
        returnCommandCenterToRestManually(state),
      );
    }
    return blockedEvaluation({
      state,
      source: request.source,
      requestedTarget: request.requested_target ?? null,
      reason: "policy_disallows_target",
    });
  }

  if (request.source === "timeout_idle") {
    if (
      policy.timeout_idle_transition_allowed &&
      canMoveToRestByPolicy(policy, state.mode)
    ) {
      return allowedEvaluation(
        "timeout_idle_to_rest_allowed",
        request,
        returnCommandCenterToRestForIdle(state),
      );
    }
    return blockedEvaluation({
      state,
      source: request.source,
      requestedTarget: request.requested_target ?? null,
      reason: "timeout_idle_not_allowed",
    });
  }

  return blockedEvaluation({
    state,
    source: request.source,
    requestedTarget: request.requested_target ?? null,
    reason: "schema_rejected",
  });
}

export function createPhase9ACommandCenterCloseoutReport(
  input: unknown = DEFAULT_PHASE_9A_COMMAND_CENTER_AFFORDANCE_STATE,
): Phase9ACommandCenterCloseoutReport {
  const failedGuards = failedCloseoutGuards(input);

  return Phase9ACommandCenterCloseoutReportSchema.parse({
    kind: "command_center.phase_9a_closeout_report",
    verdict: failedGuards.length === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9A_COMMAND_CENTER_CLOSEOUT_GUARDS],
    failed_guards: failedGuards,
    notes:
      failedGuards.length === 0
        ? ["phase_9a_command_center_scaffold_is_presentation_only"]
        : failedGuards.map((guard) => `forbidden_affordance_enabled:${guard}`),
    generated_from: "phase_9a_command_center_scaffold",
    metadata_only: true,
    presentation_only: true,
    authority_surface: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function defaultAllowedIdleTargets(
  mode: CommandCenterMode,
): CommandCenterMode[] {
  return mode === "rest" ? [] : ["rest"];
}

function isDisabledWakeSource(source: CommandCenterIdleWakeSource): boolean {
  return (
    source === "voice_wake_word" ||
    source === "microphone_activity" ||
    source === "camera_activity" ||
    source === "presence_detected" ||
    source === "network_event"
  );
}

function canMoveToRestByPolicy(
  policy: CommandCenterIdlePolicy,
  mode: CommandCenterMode,
): boolean {
  return (
    mode !== "rest" && policy.allowed_idle_transition_targets.includes("rest")
  );
}

function allowedEvaluation(
  reason: CommandCenterIdleWakeReason,
  request: CommandCenterIdleWakeTransitionRequest,
  transition: CommandCenterTransitionResult,
): CommandCenterIdleWakeTransitionEvaluation {
  return CommandCenterIdleWakeTransitionEvaluationSchema.parse({
    ...transition.state,
    kind: "command_center.idle_wake_transition_evaluation",
    source: request.source,
    decision: "allowed",
    reason,
    requested_target: request.requested_target ?? null,
    previous_mode: transition.previous_mode,
    next_mode: transition.next_mode,
    changed: transition.changed,
    starts_timer: false,
    installs_event_listener: false,
    captures_audio: false,
    captures_video: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function blockedEvaluation(input: {
  state: CommandCenterShellState;
  source: CommandCenterIdleWakeSource;
  requestedTarget: CommandCenterMode | null;
  reason: CommandCenterIdleWakeReason;
}): CommandCenterIdleWakeTransitionEvaluation {
  const state = CommandCenterShellStateSchema.parse(input.state);

  return CommandCenterIdleWakeTransitionEvaluationSchema.parse({
    ...state,
    kind: "command_center.idle_wake_transition_evaluation",
    source: input.source,
    decision: "blocked",
    reason: input.reason,
    requested_target: input.requestedTarget,
    previous_mode: state.mode,
    next_mode: state.mode,
    changed: false,
    starts_timer: false,
    installs_event_listener: false,
    captures_audio: false,
    captures_video: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

function failedCloseoutGuards(
  input: unknown,
): Phase9ACommandCenterCloseoutGuard[] {
  const parsed = Phase9ACommandCenterAffordanceStateSchema.safeParse(input);
  if (parsed.success) {
    return [];
  }

  if (!input || typeof input !== "object") {
    return [...PHASE_9A_COMMAND_CENTER_CLOSEOUT_GUARDS];
  }

  const record = input as Partial<
    Record<Phase9ACommandCenterForbiddenAffordanceField, unknown>
  >;
  const failed: Phase9ACommandCenterCloseoutGuard[] = [];
  for (const [field, guard] of AFFORDANCE_FIELD_TO_GUARD) {
    if (record[field] !== false) {
      failed.push(guard);
    }
  }
  return failed;
}

const AFFORDANCE_FIELD_TO_GUARD: ReadonlyArray<
  [
    Phase9ACommandCenterForbiddenAffordanceField,
    Phase9ACommandCenterCloseoutGuard,
  ]
> = [
  ["execution_affordance_enabled", "no_execution_affordance"],
  ["approval_affordance_enabled", "no_approval_affordance"],
  ["routine_mutation_affordance_enabled", "no_routine_mutation_affordance"],
  ["tool_mutation_affordance_enabled", "no_tool_mutation_affordance"],
  ["capture_affordance_enabled", "no_capture_affordance"],
  ["remote_dashboard_affordance_enabled", "no_remote_dashboard_affordance"],
  [
    "graph_replay_execution_affordance_enabled",
    "no_graph_replay_execution_affordance",
  ],
];
