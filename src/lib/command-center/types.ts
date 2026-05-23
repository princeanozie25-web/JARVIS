import { z } from "zod";

export const COMMAND_CENTER_MODES = ["rest", "working", "audit"] as const;

export const COMMAND_CENTER_TRANSITION_EVENT_TYPES = [
  "explicit_user_wake_to_working",
  "explicit_user_enter_audit",
  "explicit_user_return_to_working",
  "idle_return_to_rest",
  "manual_return_to_rest",
  "voice_wake_word_detected",
  "microphone_activity_detected",
  "camera_activity_detected",
  "presence_detected",
  "automatic_audit_requested",
  "automatic_execution_requested",
] as const;

export const COMMAND_CENTER_TRANSITION_REASONS = [
  "explicit_user_input",
  "idle_return_to_rest",
  "manual_return_to_rest",
  "disabled_voice_transition",
  "disabled_microphone_transition",
  "disabled_camera_transition",
  "disabled_presence_transition",
  "automatic_audit_blocked",
  "automatic_execution_blocked",
  "unsupported_transition",
  "unknown_event",
] as const;

export const COMMAND_CENTER_DISABLED_FEATURES = [
  "voice_triggered_screen_transitions",
  "microphone_triggered_screen_transitions",
  "camera_triggered_screen_transitions",
  "presence_triggered_screen_transitions",
  "automatic_transition_into_audit",
  "automatic_execution_from_any_screen",
] as const;

export const CommandCenterModeSchema = z.enum(COMMAND_CENTER_MODES);
export const CommandCenterTransitionEventTypeSchema = z.enum(
  COMMAND_CENTER_TRANSITION_EVENT_TYPES,
);
export const CommandCenterTransitionReasonSchema = z.enum(
  COMMAND_CENTER_TRANSITION_REASONS,
);
export const CommandCenterDisabledFeatureSchema = z.enum(
  COMMAND_CENTER_DISABLED_FEATURES,
);

export const CommandCenterTransitionEventSchema = z.strictObject({
  type: CommandCenterTransitionEventTypeSchema,
});

export const CommandCenterShellConfigSchema = z.strictObject({
  initial_mode: CommandCenterModeSchema.optional(),
});

export const CommandCenterShellStateSchema = z.strictObject({
  kind: z.literal("command_center.shell_state"),
  phase: z.literal("9A1"),
  mode: CommandCenterModeSchema,
  previous_mode: CommandCenterModeSchema.nullable(),
  transition_count: z.number().int().nonnegative(),
  initialized_from_explicit_config: z.boolean(),
  presentation_only: z.literal(true),
  authority_surface: z.literal(false),
  can_execute: z.literal(false),
  can_request_approval: z.literal(false),
  can_schedule_routine: z.literal(false),
  audio_capture_active: z.literal(false),
  video_capture_active: z.literal(false),
});

export const CommandCenterSideEffectSnapshotSchema = z.strictObject({
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

export const CommandCenterTransitionResultSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.transition_result"),
    event_type: z.union([
      CommandCenterTransitionEventTypeSchema,
      z.literal("unknown"),
    ]),
    previous_mode: CommandCenterModeSchema,
    next_mode: CommandCenterModeSchema,
    changed: z.boolean(),
    reason: CommandCenterTransitionReasonSchema,
    state: CommandCenterShellStateSchema,
    presentation_only: z.literal(true),
    authority_surface: z.literal(false),
  });

export const CommandCenterIdleWakePolicySchema = z.strictObject({
  kind: z.literal("command_center.idle_wake_policy"),
  version: z.literal(1),
  wake_word_enabled: z.literal(false),
  microphone_wake_enabled: z.literal(false),
  camera_wake_enabled: z.literal(false),
  presence_wake_enabled: z.literal(false),
  user_input_only_wake: z.literal(true),
  automatic_wake_enabled: z.literal(false),
  idle_return_to_rest_allowed: z.literal(true),
  rest_audio_capture_allowed: z.literal(false),
  rest_video_capture_allowed: z.literal(false),
});

export const CommandCenterDisabledFeatureChecklistSchema = z.strictObject(
  Object.fromEntries(
    COMMAND_CENTER_DISABLED_FEATURES.map((feature) => [
      feature,
      z.literal(false),
    ]),
  ) as Record<CommandCenterDisabledFeature, z.ZodLiteral<false>>,
);

export const CommandCenterDisabledFeatureGuardSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    guard_id: z.literal("phase9_command_center_disabled_features_v1"),
    disabled_features: CommandCenterDisabledFeatureChecklistSchema,
    presentation_only: z.literal(true),
    authority_surface: z.literal(false),
    api_route_added: z.literal(false),
    runtime_wired: z.literal(false),
    telemetry_stream_wired: z.literal(false),
    db_access_wired: z.literal(false),
    camera_wired: z.literal(false),
    microphone_wired: z.literal(false),
  });

export const CommandCenterDisabledFeatureGuardValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    violations: z.array(CommandCenterDisabledFeatureSchema),
    disabled_feature_count: z.number().int().nonnegative(),
    enabled_feature_count: z.number().int().nonnegative(),
    presentation_only: z.literal(true),
    authority_surface: z.literal(false),
    api_route_added: z.literal(false),
    runtime_wired: z.literal(false),
    telemetry_stream_wired: z.literal(false),
    db_access_wired: z.literal(false),
    camera_wired: z.literal(false),
    microphone_wired: z.literal(false),
  });

export type CommandCenterMode = z.infer<typeof CommandCenterModeSchema>;
export type CommandCenterTransitionEventType = z.infer<
  typeof CommandCenterTransitionEventTypeSchema
>;
export type CommandCenterTransitionReason = z.infer<
  typeof CommandCenterTransitionReasonSchema
>;
export type CommandCenterDisabledFeature = z.infer<
  typeof CommandCenterDisabledFeatureSchema
>;
export type CommandCenterTransitionEvent = z.infer<
  typeof CommandCenterTransitionEventSchema
>;
export type CommandCenterShellConfig = z.infer<
  typeof CommandCenterShellConfigSchema
>;
export type CommandCenterShellState = z.infer<
  typeof CommandCenterShellStateSchema
>;
export type CommandCenterSideEffectSnapshot = z.infer<
  typeof CommandCenterSideEffectSnapshotSchema
>;
export type CommandCenterTransitionResult = z.infer<
  typeof CommandCenterTransitionResultSchema
>;
export type CommandCenterIdleWakePolicy = z.infer<
  typeof CommandCenterIdleWakePolicySchema
>;
export type CommandCenterDisabledFeatureChecklist = z.infer<
  typeof CommandCenterDisabledFeatureChecklistSchema
>;
export type CommandCenterDisabledFeatureGuard = z.infer<
  typeof CommandCenterDisabledFeatureGuardSchema
>;
export type CommandCenterDisabledFeatureGuardValidation = z.infer<
  typeof CommandCenterDisabledFeatureGuardValidationSchema
>;
