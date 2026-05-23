import { z } from "zod";

import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";
import {
  OrbDisplayStateSchema,
  createDefaultOrbDisplayState,
  validateOrbDisplayState,
  type OrbDisplayState,
} from "./rest-orb";
import {
  OrbVisualTokenSetSchema,
  createDefaultOrbVisualTokens,
  deriveOrbVisualTokensFromState,
  validateOrbVisualTokens,
  type OrbVisualTokenSet,
} from "./rest-orb-visual-tokens";

export const REST_SCENE_KINDS = [
  "idle",
  "attentive",
  "gated",
  "degraded",
  "safe_fallback",
] as const;
export const REST_SCENE_DISPLAY_MODES = [
  "orb_visual_tokens",
  "metadata_status",
  "kill_switch_status",
  "accessibility_summary",
] as const;
export const REST_SCENE_IDLE_POSTURES = [
  "restful",
  "aware",
  "guarded",
  "degraded",
  "fallback",
] as const;
export const REST_SCENE_VALIDATION_REASONS = [
  "rest_scene_descriptor_valid",
  "schema_rejected",
  "orb_state_unsafe",
  "visual_tokens_unsafe",
] as const;
export const PHASE_9C_REST_SCREEN_CLOSEOUT_GUARDS = [
  "orb_state_safe",
  "visual_tokens_safe",
  "scene_descriptor_safe",
  "no_microphone_activation",
  "no_camera_activation",
  "no_wake_word_support",
  "no_presence_trigger_support",
  "no_automatic_working_transition",
  "no_automatic_audit_transition",
  "no_network_fetch",
  "no_execution_surface",
  "no_approval_surface",
  "no_routine_surface",
  "no_replay_run_surface",
] as const;
export const PHASE_9C_REST_SCREEN_FORBIDDEN_AFFORDANCE_FIELDS = [
  "microphone_activation_enabled",
  "camera_activation_enabled",
  "wake_word_support_enabled",
  "presence_trigger_support_enabled",
  "automatic_working_transition_enabled",
  "automatic_audit_transition_enabled",
  "network_fetch_enabled",
  "execution_surface_enabled",
  "approval_surface_enabled",
  "routine_surface_enabled",
  "replay_run_surface_enabled",
] as const;
export const PHASE_9C_REST_SCREEN_CLOSEOUT_VERDICTS = ["pass", "fail"] as const;

export const RestSceneKindSchema = z.enum(REST_SCENE_KINDS);
export const RestSceneDisplayModeSchema = z.enum(REST_SCENE_DISPLAY_MODES);
export const RestSceneIdlePostureSchema = z.enum(REST_SCENE_IDLE_POSTURES);
export const RestSceneValidationReasonSchema = z.enum(
  REST_SCENE_VALIDATION_REASONS,
);
export const Phase9CRestScreenCloseoutGuardSchema = z.enum(
  PHASE_9C_REST_SCREEN_CLOSEOUT_GUARDS,
);
export const Phase9CRestScreenForbiddenAffordanceFieldSchema = z.enum(
  PHASE_9C_REST_SCREEN_FORBIDDEN_AFFORDANCE_FIELDS,
);
export const Phase9CRestScreenCloseoutVerdictSchema = z.enum(
  PHASE_9C_REST_SCREEN_CLOSEOUT_VERDICTS,
);

export const RestSceneDescriptorSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.rest_scene_descriptor"),
    phase: z.literal("9C3"),
    scene_id: z.string().trim().min(1).max(120),
    scene_kind: RestSceneKindSchema,
    allowed_display_modes: z.array(RestSceneDisplayModeSchema).min(1),
    visual_token_profile: OrbVisualTokenSetSchema,
    idle_posture: RestSceneIdlePostureSchema,
    accessibility_summary: z.string().trim().min(1).max(180),
    render_safe: z.literal(true),
    non_interactive: z.literal(true),
    display_only: z.literal(true),
    metadata_only: z.literal(true),
    authority_surface: z.literal(false),
    captures_audio: z.literal(false),
    captures_video: z.literal(false),
    starts_timer: z.literal(false),
    installs_event_listener: z.literal(false),
    browser_listener_wired: z.literal(false),
    transition_trigger_allowed: z.literal(false),
    automatic_transition_allowed: z.literal(false),
    network_fetch_allowed: z.literal(false),
    approval_actions_allowed: z.literal(false),
    routine_actions_allowed: z.literal(false),
    tool_actions_allowed: z.literal(false),
    replay_run_actions_allowed: z.literal(false),
    capture_actions_allowed: z.literal(false),
  });

export const RestSceneDescriptorValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(RestSceneValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    render_safe: z.boolean(),
    non_interactive: z.literal(true),
    display_only: z.literal(true),
    metadata_only: z.literal(true),
    mutated_input: z.literal(false),
  });

export const Phase9CRestScreenPolicyGuardStateSchema = z.strictObject({
  microphone_activation_enabled: z.literal(false),
  camera_activation_enabled: z.literal(false),
  wake_word_support_enabled: z.literal(false),
  presence_trigger_support_enabled: z.literal(false),
  automatic_working_transition_enabled: z.literal(false),
  automatic_audit_transition_enabled: z.literal(false),
  network_fetch_enabled: z.literal(false),
  execution_surface_enabled: z.literal(false),
  approval_surface_enabled: z.literal(false),
  routine_surface_enabled: z.literal(false),
  replay_run_surface_enabled: z.literal(false),
  user_input_wake_only: z.literal(true),
});

export const Phase9CRestScreenCloseoutReportSchema = z.strictObject({
  kind: z.literal("command_center.phase_9c_rest_screen_closeout_report"),
  verdict: Phase9CRestScreenCloseoutVerdictSchema,
  checked_guards: z.array(Phase9CRestScreenCloseoutGuardSchema),
  failed_guards: z.array(Phase9CRestScreenCloseoutGuardSchema),
  notes: z.array(z.string().trim().min(1).max(180)),
  generated_from: z.literal("phase_9c_rest_screen_scaffold"),
  display_only: z.literal(true),
  metadata_only: z.literal(true),
  render_safe: z.boolean(),
  non_interactive: z.literal(true),
  user_input_wake_only: z.literal(true),
  authority_surface: z.literal(false),
  captures_audio: z.literal(false),
  captures_video: z.literal(false),
  network_fetch_allowed: z.literal(false),
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

export type RestSceneKind = z.infer<typeof RestSceneKindSchema>;
export type RestSceneDisplayMode = z.infer<typeof RestSceneDisplayModeSchema>;
export type RestSceneIdlePosture = z.infer<typeof RestSceneIdlePostureSchema>;
export type RestSceneValidationReason = z.infer<
  typeof RestSceneValidationReasonSchema
>;
export type Phase9CRestScreenCloseoutGuard = z.infer<
  typeof Phase9CRestScreenCloseoutGuardSchema
>;
export type Phase9CRestScreenForbiddenAffordanceField = z.infer<
  typeof Phase9CRestScreenForbiddenAffordanceFieldSchema
>;
export type Phase9CRestScreenCloseoutVerdict = z.infer<
  typeof Phase9CRestScreenCloseoutVerdictSchema
>;
export type RestSceneDescriptor = z.infer<typeof RestSceneDescriptorSchema>;
export type RestSceneDescriptorValidation = z.infer<
  typeof RestSceneDescriptorValidationSchema
>;
export type Phase9CRestScreenPolicyGuardState = z.infer<
  typeof Phase9CRestScreenPolicyGuardStateSchema
>;
export type Phase9CRestScreenCloseoutReport = z.infer<
  typeof Phase9CRestScreenCloseoutReportSchema
>;

export interface Phase9CRestScreenCloseoutInput {
  orbState?: unknown;
  visualTokens?: unknown;
  sceneDescriptor?: unknown;
  policyGuardState?: unknown;
}

export const DEFAULT_PHASE_9C_REST_SCREEN_POLICY_GUARD_STATE: Phase9CRestScreenPolicyGuardState =
  Phase9CRestScreenPolicyGuardStateSchema.parse({
    microphone_activation_enabled: false,
    camera_activation_enabled: false,
    wake_word_support_enabled: false,
    presence_trigger_support_enabled: false,
    automatic_working_transition_enabled: false,
    automatic_audit_transition_enabled: false,
    network_fetch_enabled: false,
    execution_surface_enabled: false,
    approval_surface_enabled: false,
    routine_surface_enabled: false,
    replay_run_surface_enabled: false,
    user_input_wake_only: true,
  });

export function deriveRestSceneDescriptor(
  input: {
    orbState?: unknown;
    visualTokens?: unknown;
  } = {},
): RestSceneDescriptor {
  const orbStateInput = input.orbState ?? createDefaultOrbDisplayState();
  const visualTokensInput =
    input.visualTokens ?? deriveOrbVisualTokensFromState(orbStateInput);
  const orbValidation = validateOrbDisplayState(orbStateInput);
  const tokenValidation = validateOrbVisualTokens(visualTokensInput);

  if (!orbValidation.passed || !tokenValidation.passed) {
    return createSafeFallbackRestSceneDescriptor();
  }

  const orbState = OrbDisplayStateSchema.parse(orbStateInput);
  const visualTokens = OrbVisualTokenSetSchema.parse(visualTokensInput);
  return RestSceneDescriptorSchema.parse({
    ...baseRestSceneDescriptor({
      sceneKind: mapRestSceneKind(orbState),
      visualTokens,
      idlePosture: mapIdlePosture(orbState),
      accessibilitySummary: accessibilitySummaryForState(orbState),
    }),
  });
}

export function validateRestSceneDescriptor(
  input: unknown,
): RestSceneDescriptorValidation {
  const reasons = new Set<RestSceneValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const parsed = RestSceneDescriptorSchema.safeParse(input);

  if (!parsed.success) {
    reasons.add("schema_rejected");
  } else {
    const tokenValidation = validateOrbVisualTokens(
      parsed.data.visual_token_profile,
    );

    if (!tokenValidation.passed) {
      reasons.add("visual_tokens_unsafe");
      for (const field of tokenValidation.withheld_fields) {
        withheldFields.add(field);
      }
      for (const note of tokenValidation.notes) {
        notes.add(note);
      }
    }
  }

  const passed = reasons.size === 0;
  return RestSceneDescriptorValidationSchema.parse({
    passed,
    reasons: passed ? ["rest_scene_descriptor_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["rest_scene_descriptor_display_only"],
    render_safe: passed,
    non_interactive: true,
    display_only: true,
    metadata_only: true,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function createPhase9CRestScreenCloseoutReport(
  input: Phase9CRestScreenCloseoutInput = {},
): Phase9CRestScreenCloseoutReport {
  const failedGuards = new Set<Phase9CRestScreenCloseoutGuard>();
  const notes = new Set<string>();
  const orbState = input.orbState ?? createDefaultOrbDisplayState();
  const visualTokens =
    input.visualTokens ?? deriveOrbVisualTokensFromState(orbState);
  const sceneDescriptor =
    input.sceneDescriptor ??
    deriveRestSceneDescriptor({ orbState, visualTokens });

  evaluateOrbState(orbState, failedGuards, notes);
  evaluateVisualTokens(visualTokens, failedGuards, notes);
  evaluateSceneDescriptor(sceneDescriptor, failedGuards, notes);
  evaluatePolicyGuardState(
    input.policyGuardState ?? DEFAULT_PHASE_9C_REST_SCREEN_POLICY_GUARD_STATE,
    failedGuards,
    notes,
  );

  if (failedGuards.size === 0) {
    notes.add("phase_9c_rest_screen_scaffold_is_display_only");
  }

  return Phase9CRestScreenCloseoutReportSchema.parse({
    kind: "command_center.phase_9c_rest_screen_closeout_report",
    verdict: failedGuards.size === 0 ? "pass" : "fail",
    checked_guards: [...PHASE_9C_REST_SCREEN_CLOSEOUT_GUARDS],
    failed_guards: [...failedGuards],
    notes: [...notes],
    generated_from: "phase_9c_rest_screen_scaffold",
    display_only: true,
    metadata_only: true,
    render_safe: failedGuards.size === 0,
    non_interactive: true,
    user_input_wake_only: true,
    authority_surface: false,
    captures_audio: false,
    captures_video: false,
    network_fetch_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function createSafeFallbackRestSceneDescriptor(): RestSceneDescriptor {
  return RestSceneDescriptorSchema.parse({
    ...baseRestSceneDescriptor({
      sceneKind: "safe_fallback",
      visualTokens: createDefaultOrbVisualTokens(),
      idlePosture: "fallback",
      accessibilitySummary: "Rest screen safe fallback",
    }),
  });
}

function baseRestSceneDescriptor(input: {
  sceneKind: RestSceneKind;
  visualTokens: OrbVisualTokenSet;
  idlePosture: RestSceneIdlePosture;
  accessibilitySummary: string;
}): RestSceneDescriptor {
  return {
    kind: "command_center.rest_scene_descriptor",
    phase: "9C3",
    scene_id: `rest_scene:${input.sceneKind}`,
    scene_kind: input.sceneKind,
    allowed_display_modes: [
      "orb_visual_tokens",
      "metadata_status",
      "kill_switch_status",
      "accessibility_summary",
    ],
    visual_token_profile: input.visualTokens,
    idle_posture: input.idlePosture,
    accessibility_summary: input.accessibilitySummary,
    render_safe: true,
    non_interactive: true,
    display_only: true,
    metadata_only: true,
    authority_surface: false,
    captures_audio: false,
    captures_video: false,
    starts_timer: false,
    installs_event_listener: false,
    browser_listener_wired: false,
    transition_trigger_allowed: false,
    automatic_transition_allowed: false,
    network_fetch_allowed: false,
    approval_actions_allowed: false,
    routine_actions_allowed: false,
    tool_actions_allowed: false,
    replay_run_actions_allowed: false,
    capture_actions_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  };
}

function mapRestSceneKind(state: OrbDisplayState): RestSceneKind {
  if (
    state.kill_switch_display === "engaged" ||
    state.governance_posture === "locked"
  ) {
    return "gated";
  }
  if (
    state.degraded_state === "partial" ||
    state.degraded_state === "major" ||
    state.heartbeat_state === "degraded"
  ) {
    return "degraded";
  }
  if (
    state.approval_attention_state === "pending_metadata" ||
    state.approval_attention_state === "blocked" ||
    state.load_band === "medium" ||
    state.load_band === "high" ||
    state.last_event_class !== "none"
  ) {
    return "attentive";
  }
  return "idle";
}

function mapIdlePosture(state: OrbDisplayState): RestSceneIdlePosture {
  const sceneKind = mapRestSceneKind(state);
  if (sceneKind === "gated") return "guarded";
  if (sceneKind === "degraded") return "degraded";
  if (sceneKind === "attentive") return "aware";
  if (sceneKind === "safe_fallback") return "fallback";
  return "restful";
}

function accessibilitySummaryForState(state: OrbDisplayState): string {
  const sceneKind = mapRestSceneKind(state);
  if (sceneKind === "gated") return "Rest screen gated";
  if (sceneKind === "degraded") return "Rest screen degraded";
  if (sceneKind === "attentive") return "Rest screen attentive";
  return "Rest screen idle";
}

function evaluateOrbState(
  orbState: unknown,
  failedGuards: Set<Phase9CRestScreenCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateOrbDisplayState(orbState);
  if (!validation.passed) {
    failedGuards.add("orb_state_safe");
    notes.add("orb_state_validation_failed");
  }
}

function evaluateVisualTokens(
  visualTokens: unknown,
  failedGuards: Set<Phase9CRestScreenCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateOrbVisualTokens(visualTokens);
  if (!validation.passed) {
    failedGuards.add("visual_tokens_safe");
    notes.add("visual_tokens_validation_failed");
  }
}

function evaluateSceneDescriptor(
  sceneDescriptor: unknown,
  failedGuards: Set<Phase9CRestScreenCloseoutGuard>,
  notes: Set<string>,
): void {
  const validation = validateRestSceneDescriptor(sceneDescriptor);
  if (!validation.passed) {
    failedGuards.add("scene_descriptor_safe");
    notes.add("scene_descriptor_validation_failed");
  }
}

function evaluatePolicyGuardState(
  policyGuardState: unknown,
  failedGuards: Set<Phase9CRestScreenCloseoutGuard>,
  notes: Set<string>,
): void {
  if (
    Phase9CRestScreenPolicyGuardStateSchema.safeParse(policyGuardState).success
  ) {
    return;
  }
  if (!policyGuardState || typeof policyGuardState !== "object") {
    for (const guard of POLICY_GUARD_FIELD_TO_GUARD.map(([, guard]) => guard)) {
      failedGuards.add(guard);
    }
    notes.add("rest_screen_policy_guard_state_invalid");
    return;
  }

  const record = policyGuardState as Partial<
    Record<
      Phase9CRestScreenForbiddenAffordanceField | "user_input_wake_only",
      unknown
    >
  >;
  for (const [field, guard] of POLICY_GUARD_FIELD_TO_GUARD) {
    if (record[field] !== false) {
      failedGuards.add(guard);
      notes.add(`forbidden_rest_affordance_enabled:${field}`);
    }
  }
  if (record.user_input_wake_only !== true) {
    failedGuards.add("no_wake_word_support");
    failedGuards.add("no_presence_trigger_support");
    notes.add("user_input_wake_only_disabled");
  }
}

const POLICY_GUARD_FIELD_TO_GUARD: ReadonlyArray<
  [Phase9CRestScreenForbiddenAffordanceField, Phase9CRestScreenCloseoutGuard]
> = [
  ["microphone_activation_enabled", "no_microphone_activation"],
  ["camera_activation_enabled", "no_camera_activation"],
  ["wake_word_support_enabled", "no_wake_word_support"],
  ["presence_trigger_support_enabled", "no_presence_trigger_support"],
  ["automatic_working_transition_enabled", "no_automatic_working_transition"],
  ["automatic_audit_transition_enabled", "no_automatic_audit_transition"],
  ["network_fetch_enabled", "no_network_fetch"],
  ["execution_surface_enabled", "no_execution_surface"],
  ["approval_surface_enabled", "no_approval_surface"],
  ["routine_surface_enabled", "no_routine_surface"],
  ["replay_run_surface_enabled", "no_replay_run_surface"],
];
