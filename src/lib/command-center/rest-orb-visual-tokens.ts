import { z } from "zod";

import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";
import {
  OrbDisplayStateSchema,
  validateOrbDisplayState,
  type OrbDisplayState,
} from "./rest-orb";

export const ORB_HEARTBEAT_RING_TOKENS = [
  "ring_resting",
  "ring_alive",
  "ring_degraded",
  "ring_attention",
  "ring_unknown",
] as const;
export const ORB_INNER_GLOW_TOKENS = [
  "glow_resting",
  "glow_ready",
  "glow_guarded",
  "glow_locked",
  "glow_unknown",
] as const;
export const ORB_OUTER_HALO_TOKENS = [
  "halo_none",
  "halo_soft",
  "halo_attention",
  "halo_degraded",
  "halo_locked",
] as const;
export const ORB_COLOR_BAND_TOKENS = [
  "band_neutral",
  "band_active",
  "band_guarded",
  "band_locked",
  "band_degraded",
  "band_attention",
  "band_unknown",
] as const;
export const ORB_MOTION_TOKENS = [
  "motion_still",
  "motion_slow_pulse",
  "motion_attention_pulse",
  "motion_reduced",
  "motion_none",
] as const;
export const ORB_INTENSITY_TOKENS = [
  "intensity_low",
  "intensity_medium",
  "intensity_high",
  "intensity_muted",
] as const;
export const ORB_SURFACE_LABEL_TOKENS = [
  "label_resting",
  "label_ready",
  "label_guarded",
  "label_locked",
  "label_attention",
  "label_degraded",
  "label_unknown",
] as const;
export const ORB_ACCESSIBILITY_LABEL_TOKENS = [
  "JARVIS resting",
  "JARVIS ready",
  "JARVIS guarded",
  "JARVIS locked",
  "JARVIS needs attention",
  "JARVIS degraded",
  "JARVIS state unknown",
] as const;
export const ORB_VISUAL_TOKEN_VALIDATION_REASONS = [
  "orb_visual_tokens_valid",
  "schema_rejected",
  "raw_render_instruction_present",
  "authority_key_present",
  "non_serializable_value",
  "unsafe_payload_shape",
] as const;
export const ORB_FORBIDDEN_RENDER_INSTRUCTION_FIELDS = [
  "raw_color",
  "hex_color",
  "rgb_color",
  "css_class",
  "css_text",
  "style",
  "pixel_value",
  "animation_timing",
  "animation_duration_ms",
  "canvas_instruction",
  "svg_path",
  "webgl_shader",
  "event_handler",
] as const;
export const ORB_FORBIDDEN_VISUAL_AUTHORITY_KEYS = [
  "onClick",
  "onclick",
  "execute",
  "approve",
  "schedule",
  "capture",
  "fetch",
  "route",
  "mutate",
  "on_execute",
  "on_approve",
  "on_schedule",
  "tool_call_hook",
  "approval_hook",
  "routine_hook",
] as const;

export const OrbHeartbeatRingTokenSchema = z.enum(ORB_HEARTBEAT_RING_TOKENS);
export const OrbInnerGlowTokenSchema = z.enum(ORB_INNER_GLOW_TOKENS);
export const OrbOuterHaloTokenSchema = z.enum(ORB_OUTER_HALO_TOKENS);
export const OrbColorBandTokenSchema = z.enum(ORB_COLOR_BAND_TOKENS);
export const OrbMotionTokenSchema = z.enum(ORB_MOTION_TOKENS);
export const OrbIntensityTokenSchema = z.enum(ORB_INTENSITY_TOKENS);
export const OrbSurfaceLabelTokenSchema = z.enum(ORB_SURFACE_LABEL_TOKENS);
export const OrbAccessibilityLabelTokenSchema = z.enum(
  ORB_ACCESSIBILITY_LABEL_TOKENS,
);
export const OrbVisualTokenValidationReasonSchema = z.enum(
  ORB_VISUAL_TOKEN_VALIDATION_REASONS,
);
export const OrbForbiddenRenderInstructionFieldSchema = z.enum(
  ORB_FORBIDDEN_RENDER_INSTRUCTION_FIELDS,
);
export const OrbForbiddenVisualAuthorityKeySchema = z.enum(
  ORB_FORBIDDEN_VISUAL_AUTHORITY_KEYS,
);

export const OrbVisualTokenSetSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.orb_visual_token_set"),
    phase: z.literal("9C2"),
    heartbeat_ring_token: OrbHeartbeatRingTokenSchema,
    inner_glow_token: OrbInnerGlowTokenSchema,
    outer_halo_token: OrbOuterHaloTokenSchema,
    color_band_token: OrbColorBandTokenSchema,
    motion_token: OrbMotionTokenSchema,
    intensity_token: OrbIntensityTokenSchema,
    surface_label_token: OrbSurfaceLabelTokenSchema,
    accessibility_label: OrbAccessibilityLabelTokenSchema,
    display_only: z.literal(true),
    metadata_only: z.literal(true),
    render_safe: z.literal(true),
    semantic_tokens_only: z.literal(true),
    render_instructions_included: z.literal(false),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    authority_surface: z.literal(false),
    callbacks_allowed: z.literal(false),
    event_handlers_allowed: z.literal(false),
    transition_trigger_allowed: z.literal(false),
    approval_actions_allowed: z.literal(false),
    routine_actions_allowed: z.literal(false),
    tool_actions_allowed: z.literal(false),
    capture_actions_allowed: z.literal(false),
    network_actions_allowed: z.literal(false),
  });

export const OrbVisualTokenValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(OrbVisualTokenValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    display_only: z.literal(true),
    metadata_only: z.literal(true),
    render_safe: z.boolean(),
    semantic_tokens_only: z.literal(true),
    render_instructions_included: z.literal(false),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type OrbHeartbeatRingToken = z.infer<typeof OrbHeartbeatRingTokenSchema>;
export type OrbInnerGlowToken = z.infer<typeof OrbInnerGlowTokenSchema>;
export type OrbOuterHaloToken = z.infer<typeof OrbOuterHaloTokenSchema>;
export type OrbColorBandToken = z.infer<typeof OrbColorBandTokenSchema>;
export type OrbMotionToken = z.infer<typeof OrbMotionTokenSchema>;
export type OrbIntensityToken = z.infer<typeof OrbIntensityTokenSchema>;
export type OrbSurfaceLabelToken = z.infer<typeof OrbSurfaceLabelTokenSchema>;
export type OrbAccessibilityLabelToken = z.infer<
  typeof OrbAccessibilityLabelTokenSchema
>;
export type OrbVisualTokenValidationReason = z.infer<
  typeof OrbVisualTokenValidationReasonSchema
>;
export type OrbForbiddenRenderInstructionField = z.infer<
  typeof OrbForbiddenRenderInstructionFieldSchema
>;
export type OrbForbiddenVisualAuthorityKey = z.infer<
  typeof OrbForbiddenVisualAuthorityKeySchema
>;
export type OrbVisualTokenSet = z.infer<typeof OrbVisualTokenSetSchema>;
export type OrbVisualTokenValidation = z.infer<
  typeof OrbVisualTokenValidationSchema
>;

export function createDefaultOrbVisualTokens(): OrbVisualTokenSet {
  return OrbVisualTokenSetSchema.parse({
    kind: "command_center.orb_visual_token_set",
    phase: "9C2",
    heartbeat_ring_token: "ring_resting",
    inner_glow_token: "glow_resting",
    outer_halo_token: "halo_none",
    color_band_token: "band_neutral",
    motion_token: "motion_still",
    intensity_token: "intensity_low",
    surface_label_token: "label_resting",
    accessibility_label: "JARVIS resting",
    display_only: true,
    metadata_only: true,
    render_safe: true,
    semantic_tokens_only: true,
    render_instructions_included: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    authority_surface: false,
    callbacks_allowed: false,
    event_handlers_allowed: false,
    transition_trigger_allowed: false,
    approval_actions_allowed: false,
    routine_actions_allowed: false,
    tool_actions_allowed: false,
    capture_actions_allowed: false,
    network_actions_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function deriveOrbVisualTokensFromState(
  state: unknown,
): OrbVisualTokenSet {
  const validation = validateOrbDisplayState(state);
  if (!validation.passed) return createDefaultOrbVisualTokens();

  const parsedState = OrbDisplayStateSchema.parse(state);
  return OrbVisualTokenSetSchema.parse({
    ...createDefaultOrbVisualTokens(),
    ...mapStateToTokens(parsedState),
  });
}

export function validateOrbVisualTokens(
  input: unknown,
): OrbVisualTokenValidation {
  const reasons = new Set<OrbVisualTokenValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const scan = scanVisualTokens(input, [], new WeakSet<object>());

  for (const field of scan.rawRenderInstructionFields) {
    withheldFields.add(field);
  }
  for (const field of scan.authorityKeys) {
    withheldFields.add(field);
  }
  for (const note of scan.notes) {
    notes.add(note);
  }

  if (scan.rawRenderInstructionFields.length > 0) {
    reasons.add("raw_render_instruction_present");
  }
  if (scan.authorityKeys.length > 0) {
    reasons.add("authority_key_present");
  }
  if (scan.nonSerializable) {
    reasons.add("non_serializable_value");
  }
  if (scan.unsafeShape) {
    reasons.add("unsafe_payload_shape");
  }
  if (!OrbVisualTokenSetSchema.safeParse(input).success) {
    reasons.add("schema_rejected");
  }

  const passed = reasons.size === 0;
  return OrbVisualTokenValidationSchema.parse({
    passed,
    reasons: passed ? ["orb_visual_tokens_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["orb_visual_tokens_semantic_only"],
    display_only: true,
    metadata_only: true,
    render_safe: passed,
    semantic_tokens_only: true,
    render_instructions_included: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function listOrbForbiddenRenderInstructionFields(): string[] {
  return [...ORB_FORBIDDEN_RENDER_INSTRUCTION_FIELDS];
}

export function listOrbForbiddenVisualAuthorityKeys(): string[] {
  return [...ORB_FORBIDDEN_VISUAL_AUTHORITY_KEYS];
}

function mapStateToTokens(
  state: OrbDisplayState,
): Pick<
  OrbVisualTokenSet,
  | "heartbeat_ring_token"
  | "inner_glow_token"
  | "outer_halo_token"
  | "color_band_token"
  | "motion_token"
  | "intensity_token"
  | "surface_label_token"
  | "accessibility_label"
> {
  if (state.kill_switch_display === "engaged") {
    return {
      heartbeat_ring_token: "ring_attention",
      inner_glow_token: "glow_locked",
      outer_halo_token: "halo_locked",
      color_band_token: "band_locked",
      motion_token: "motion_attention_pulse",
      intensity_token: "intensity_high",
      surface_label_token: "label_locked",
      accessibility_label: "JARVIS locked",
    };
  }

  if (
    state.approval_attention_state === "pending_metadata" ||
    state.approval_attention_state === "blocked"
  ) {
    return {
      heartbeat_ring_token: "ring_attention",
      inner_glow_token: "glow_guarded",
      outer_halo_token: "halo_attention",
      color_band_token: "band_attention",
      motion_token: "motion_attention_pulse",
      intensity_token: "intensity_high",
      surface_label_token: "label_attention",
      accessibility_label: "JARVIS needs attention",
    };
  }

  if (
    state.degraded_state === "partial" ||
    state.degraded_state === "major" ||
    state.heartbeat_state === "degraded"
  ) {
    return {
      heartbeat_ring_token: "ring_degraded",
      inner_glow_token: "glow_guarded",
      outer_halo_token: "halo_degraded",
      color_band_token: "band_degraded",
      motion_token: "motion_reduced",
      intensity_token:
        state.degraded_state === "major"
          ? "intensity_high"
          : "intensity_medium",
      surface_label_token: "label_degraded",
      accessibility_label: "JARVIS degraded",
    };
  }

  if (state.governance_posture === "locked") {
    return {
      heartbeat_ring_token: "ring_attention",
      inner_glow_token: "glow_locked",
      outer_halo_token: "halo_locked",
      color_band_token: "band_locked",
      motion_token: "motion_reduced",
      intensity_token: "intensity_high",
      surface_label_token: "label_locked",
      accessibility_label: "JARVIS locked",
    };
  }

  if (state.governance_posture === "guarded") {
    return {
      heartbeat_ring_token: "ring_alive",
      inner_glow_token: "glow_guarded",
      outer_halo_token: "halo_soft",
      color_band_token: "band_guarded",
      motion_token: "motion_slow_pulse",
      intensity_token: "intensity_medium",
      surface_label_token: "label_guarded",
      accessibility_label: "JARVIS guarded",
    };
  }

  if (state.heartbeat_state === "unknown" || state.load_band === "unknown") {
    return {
      heartbeat_ring_token: "ring_unknown",
      inner_glow_token: "glow_unknown",
      outer_halo_token: "halo_none",
      color_band_token: "band_unknown",
      motion_token: "motion_none",
      intensity_token: "intensity_muted",
      surface_label_token: "label_unknown",
      accessibility_label: "JARVIS state unknown",
    };
  }

  if (
    state.heartbeat_state === "alive" ||
    state.load_band === "medium" ||
    state.load_band === "high" ||
    state.last_event_class !== "none"
  ) {
    return {
      heartbeat_ring_token: "ring_alive",
      inner_glow_token: "glow_ready",
      outer_halo_token: "halo_soft",
      color_band_token: "band_active",
      motion_token: "motion_slow_pulse",
      intensity_token:
        state.load_band === "high" ? "intensity_high" : "intensity_medium",
      surface_label_token: "label_ready",
      accessibility_label: "JARVIS ready",
    };
  }

  return {
    heartbeat_ring_token: "ring_resting",
    inner_glow_token: "glow_resting",
    outer_halo_token: "halo_none",
    color_band_token: "band_neutral",
    motion_token: "motion_still",
    intensity_token: "intensity_low",
    surface_label_token: "label_resting",
    accessibility_label: "JARVIS resting",
  };
}

interface VisualTokenScanResult {
  rawRenderInstructionFields: string[];
  authorityKeys: string[];
  nonSerializable: boolean;
  unsafeShape: boolean;
  notes: string[];
}

function scanVisualTokens(
  input: unknown,
  path: string[],
  seen: WeakSet<object>,
): VisualTokenScanResult {
  const result: VisualTokenScanResult = {
    rawRenderInstructionFields: [],
    authorityKeys: [],
    nonSerializable: false,
    unsafeShape: false,
    notes: [],
  };

  if (input === undefined) {
    result.unsafeShape = path.length === 0;
    if (path.length === 0) result.notes.push("tokens_missing");
    return result;
  }
  if (
    typeof input === "function" ||
    typeof input === "symbol" ||
    typeof input === "bigint"
  ) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable:${path.join(".") || "root"}`);
    return result;
  }
  if (input === null || typeof input !== "object") {
    return result;
  }
  if (seen.has(input)) {
    result.nonSerializable = true;
    result.notes.push(`non_serializable_cycle:${path.join(".") || "root"}`);
    return result;
  }
  seen.add(input);

  if (input instanceof Date) return result;
  if (
    !Array.isArray(input) &&
    Object.getPrototypeOf(input) !== Object.prototype
  ) {
    result.unsafeShape = true;
    result.notes.push(`unsafe_object:${path.join(".") || "root"}`);
    return result;
  }

  const entries = Array.isArray(input)
    ? input.map((value, index) => [String(index), value] as const)
    : Object.entries(input);
  for (const [key, value] of entries) {
    if (isForbiddenRenderInstructionField(key)) {
      result.rawRenderInstructionFields.push([...path, key].join("."));
    }
    if (isForbiddenVisualAuthorityKey(key)) {
      result.authorityKeys.push([...path, key].join("."));
    }
    const child = scanVisualTokens(value, [...path, key], seen);
    result.rawRenderInstructionFields.push(...child.rawRenderInstructionFields);
    result.authorityKeys.push(...child.authorityKeys);
    result.nonSerializable ||= child.nonSerializable;
    result.unsafeShape ||= child.unsafeShape;
    result.notes.push(...child.notes);
  }

  return result;
}

function isForbiddenRenderInstructionField(key: string): boolean {
  return (
    ORB_FORBIDDEN_RENDER_INSTRUCTION_FIELDS as readonly string[]
  ).includes(key);
}

function isForbiddenVisualAuthorityKey(key: string): boolean {
  return (ORB_FORBIDDEN_VISUAL_AUTHORITY_KEYS as readonly string[]).includes(
    key,
  );
}
