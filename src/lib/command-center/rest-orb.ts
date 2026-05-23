import { z } from "zod";

import {
  COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS,
  type CommandCenterForbiddenScreenHookField,
} from "./screens";
import {
  COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES,
  validateObservabilityPayloadSafety,
} from "./observability-redaction";
import { CommandCenterObservabilityResponseEnvelopeSchema } from "./observability-contract";
import { DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT } from "./state-machine";
import { CommandCenterSideEffectSnapshotSchema } from "./types";

export const ORB_HEARTBEAT_STATES = [
  "resting",
  "alive",
  "degraded",
  "unknown",
] as const;
export const ORB_LOAD_BANDS = [
  "none",
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const ORB_LAST_EVENT_CLASSES = [
  "none",
  "user_input",
  "system_metadata",
  "policy_status",
  "safety_status",
  "error_status",
] as const;
export const ORB_GOVERNANCE_POSTURES = [
  "normal",
  "guarded",
  "locked",
  "unknown",
] as const;
export const ORB_KILL_SWITCH_DISPLAY_STATES = [
  "available",
  "engaged",
  "unknown",
] as const;
export const ORB_APPROVAL_ATTENTION_STATES = [
  "none",
  "pending_metadata",
  "blocked",
  "unknown",
] as const;
export const ORB_DEGRADED_STATES = [
  "none",
  "partial",
  "major",
  "unknown",
] as const;
export const ORB_STATE_SOURCE_KINDS = [
  "observability_response_envelope",
  "synthetic_demo_safe_future_source",
  "static_fallback_state",
] as const;
export const ORB_DISPLAY_STATE_VALIDATION_REASONS = [
  "orb_state_valid",
  "schema_rejected",
  "raw_payload_field_present",
  "non_serializable_value",
  "unsafe_payload_shape",
  "mutating_hook_field_present",
] as const;

export const OrbHeartbeatStateSchema = z.enum(ORB_HEARTBEAT_STATES);
export const OrbLoadBandSchema = z.enum(ORB_LOAD_BANDS);
export const OrbLastEventClassSchema = z.enum(ORB_LAST_EVENT_CLASSES);
export const OrbGovernancePostureSchema = z.enum(ORB_GOVERNANCE_POSTURES);
export const OrbKillSwitchDisplaySchema = z.enum(
  ORB_KILL_SWITCH_DISPLAY_STATES,
);
export const OrbApprovalAttentionStateSchema = z.enum(
  ORB_APPROVAL_ATTENTION_STATES,
);
export const OrbDegradedStateSchema = z.enum(ORB_DEGRADED_STATES);
export const OrbStateSourceKindSchema = z.enum(ORB_STATE_SOURCE_KINDS);
export const OrbDisplayStateValidationReasonSchema = z.enum(
  ORB_DISPLAY_STATE_VALIDATION_REASONS,
);

export const OrbStateSourceSchema = z.strictObject({
  kind: z.literal("command_center.orb_state_source"),
  source_kind: OrbStateSourceKindSchema,
  source_ref: z.string().trim().min(1).max(160).optional(),
  read_only: z.literal(true),
  metadata_only: z.literal(true),
  redaction_required: z.literal(true),
  descriptor_only: z.literal(true),
  live_source_wired: z.literal(false),
  fetch_performed: z.literal(false),
  raw_payloads_allowed: z.literal(false),
});

export const OrbDisplayStateSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    kind: z.literal("command_center.orb_display_state"),
    phase: z.literal("9C1"),
    heartbeat_state: OrbHeartbeatStateSchema,
    load_band: OrbLoadBandSchema,
    last_event_class: OrbLastEventClassSchema,
    governance_posture: OrbGovernancePostureSchema,
    kill_switch_display: OrbKillSwitchDisplaySchema,
    approval_attention_state: OrbApprovalAttentionStateSchema,
    degraded_state: OrbDegradedStateSchema,
    generated_at: z.number().int().nonnegative(),
    source: OrbStateSourceSchema,
    display_only: z.literal(true),
    metadata_only: z.literal(true),
    render_safe: z.literal(true),
    replay_safe: z.literal(false),
    authority_surface: z.literal(false),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    callbacks_allowed: z.literal(false),
    transition_trigger_allowed: z.literal(false),
    approval_actions_allowed: z.literal(false),
    routine_actions_allowed: z.literal(false),
    tool_actions_allowed: z.literal(false),
    capture_actions_allowed: z.literal(false),
    network_actions_allowed: z.literal(false),
  });

export const OrbDisplayStateValidationSchema =
  CommandCenterSideEffectSnapshotSchema.extend({
    passed: z.boolean(),
    reasons: z.array(OrbDisplayStateValidationReasonSchema),
    withheld_fields: z.array(z.string().trim().min(1).max(180)),
    notes: z.array(z.string().trim().min(1).max(180)),
    metadata_only: z.literal(true),
    display_only: z.literal(true),
    render_safe: z.boolean(),
    raw_payloads_included: z.literal(false),
    exact_pii_included: z.literal(false),
    mutated_input: z.literal(false),
  });

export type OrbHeartbeatState = z.infer<typeof OrbHeartbeatStateSchema>;
export type OrbLoadBand = z.infer<typeof OrbLoadBandSchema>;
export type OrbLastEventClass = z.infer<typeof OrbLastEventClassSchema>;
export type OrbGovernancePosture = z.infer<typeof OrbGovernancePostureSchema>;
export type OrbKillSwitchDisplay = z.infer<typeof OrbKillSwitchDisplaySchema>;
export type OrbApprovalAttentionState = z.infer<
  typeof OrbApprovalAttentionStateSchema
>;
export type OrbDegradedState = z.infer<typeof OrbDegradedStateSchema>;
export type OrbStateSourceKind = z.infer<typeof OrbStateSourceKindSchema>;
export type OrbDisplayStateValidationReason = z.infer<
  typeof OrbDisplayStateValidationReasonSchema
>;
export type OrbStateSource = z.infer<typeof OrbStateSourceSchema>;
export type OrbDisplayState = z.infer<typeof OrbDisplayStateSchema>;
export type OrbDisplayStateValidation = z.infer<
  typeof OrbDisplayStateValidationSchema
>;

export function createDefaultOrbDisplayState(): OrbDisplayState {
  return OrbDisplayStateSchema.parse({
    kind: "command_center.orb_display_state",
    phase: "9C1",
    heartbeat_state: "resting",
    load_band: "none",
    last_event_class: "none",
    governance_posture: "normal",
    kill_switch_display: "available",
    approval_attention_state: "none",
    degraded_state: "none",
    generated_at: 0,
    source: {
      kind: "command_center.orb_state_source",
      source_kind: "static_fallback_state",
      source_ref: "phase9c1:default",
      read_only: true,
      metadata_only: true,
      redaction_required: true,
      descriptor_only: true,
      live_source_wired: false,
      fetch_performed: false,
      raw_payloads_allowed: false,
    },
    display_only: true,
    metadata_only: true,
    render_safe: true,
    replay_safe: false,
    authority_surface: false,
    raw_payloads_included: false,
    exact_pii_included: false,
    callbacks_allowed: false,
    transition_trigger_allowed: false,
    approval_actions_allowed: false,
    routine_actions_allowed: false,
    tool_actions_allowed: false,
    capture_actions_allowed: false,
    network_actions_allowed: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function validateOrbDisplayState(
  input: unknown,
): OrbDisplayStateValidation {
  const reasons = new Set<OrbDisplayStateValidationReason>();
  const withheldFields = new Set<string>();
  const notes = new Set<string>();
  const safety = validateObservabilityPayloadSafety(input);

  for (const field of safety.withheld_fields) withheldFields.add(field);
  for (const note of safety.notes) notes.add(note);

  if (safety.reason === "forbidden_raw_field") {
    reasons.add("raw_payload_field_present");
  }
  if (safety.reason === "non_serializable_value") {
    reasons.add("non_serializable_value");
  }
  if (safety.reason === "unsafe_payload_shape") {
    reasons.add("unsafe_payload_shape");
  }
  if (containsForbiddenHook(input)) {
    reasons.add("mutating_hook_field_present");
    collectForbiddenHookFields(input, [], withheldFields);
  }

  const parsed = OrbDisplayStateSchema.safeParse(input);
  if (!parsed.success) {
    reasons.add("schema_rejected");
  }

  const passed = reasons.size === 0;
  return OrbDisplayStateValidationSchema.parse({
    passed,
    reasons: passed ? ["orb_state_valid"] : [...reasons],
    withheld_fields: [...withheldFields],
    notes: notes.size > 0 ? [...notes] : ["orb_state_metadata_only"],
    metadata_only: true,
    display_only: true,
    render_safe: passed,
    raw_payloads_included: false,
    exact_pii_included: false,
    mutated_input: false,
    ...DEFAULT_COMMAND_CENTER_SIDE_EFFECT_SNAPSHOT,
  });
}

export function deriveOrbDisplayStateFromSafeMetadata(
  input: unknown,
): OrbDisplayState {
  const safety = validateObservabilityPayloadSafety(input);
  if (!safety.passed) {
    return createDefaultOrbDisplayState();
  }

  const metadata = readMetadata(input);
  return OrbDisplayStateSchema.parse({
    ...createDefaultOrbDisplayState(),
    heartbeat_state: mapHeartbeat(
      metadata.heartbeat_state ?? metadata.heartbeat_status,
    ),
    load_band: mapLoadBand(metadata.load_band ?? metadata.count_band),
    last_event_class: mapLastEventClass(metadata.last_event_class),
    governance_posture: mapGovernancePosture(metadata.governance_posture),
    kill_switch_display: mapKillSwitch(
      metadata.kill_switch_display ?? metadata.kill_switch_display_state,
    ),
    approval_attention_state: mapApprovalAttention(
      metadata.approval_attention_state,
    ),
    degraded_state: mapDegradedState(
      metadata.degraded_state ?? metadata.status,
    ),
    generated_at: mapGeneratedAt(metadata.generated_at),
    source: sourceFromMetadata(input),
  });
}

function readMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const envelope =
    CommandCenterObservabilityResponseEnvelopeSchema.safeParse(input);
  if (envelope.success) {
    const firstPayload = envelope.data.payload[0] as
      | Record<string, unknown>
      | undefined;
    return {
      ...firstPayload,
      generated_at: envelope.data.generated_at,
    };
  }
  if (isEnvelopeShapedMetadata(input)) {
    const envelopeLike = input as {
      generated_at?: unknown;
      payload?: unknown[];
    };
    const firstPayload = envelopeLike.payload?.[0];
    return {
      ...(firstPayload && typeof firstPayload === "object"
        ? (firstPayload as Record<string, unknown>)
        : {}),
      generated_at: envelopeLike.generated_at,
    };
  }
  if (Array.isArray(input)) {
    return input[0] && typeof input[0] === "object"
      ? (input[0] as Record<string, unknown>)
      : {};
  }
  return input as Record<string, unknown>;
}

function sourceFromMetadata(input: unknown): OrbStateSource {
  const envelope =
    CommandCenterObservabilityResponseEnvelopeSchema.safeParse(input);
  const envelopeLike = isEnvelopeShapedMetadata(input)
    ? (input as { query_id?: unknown })
    : null;
  return OrbStateSourceSchema.parse({
    kind: "command_center.orb_state_source",
    source_kind:
      envelope.success || envelopeLike
        ? "observability_response_envelope"
        : "synthetic_demo_safe_future_source",
    source_ref: envelope.success
      ? envelope.data.query_id
      : typeof envelopeLike?.query_id === "string"
        ? envelopeLike.query_id
        : "phase9c1:metadata",
    read_only: true,
    metadata_only: true,
    redaction_required: true,
    descriptor_only: true,
    live_source_wired: false,
    fetch_performed: false,
    raw_payloads_allowed: false,
  });
}

function isEnvelopeShapedMetadata(input: unknown): boolean {
  return (
    !!input &&
    typeof input === "object" &&
    "query_id" in input &&
    "category" in input &&
    "payload" in input &&
    Array.isArray((input as { payload?: unknown }).payload)
  );
}

function mapHeartbeat(input: unknown): OrbHeartbeatState {
  if (input === "alive") return "alive";
  if (input === "degraded") return "degraded";
  if (input === "quiet" || input === "resting") return "resting";
  return "unknown";
}

function mapLoadBand(input: unknown): OrbLoadBand {
  if (
    input === "none" ||
    input === "low" ||
    input === "medium" ||
    input === "high"
  ) {
    return input;
  }
  return "unknown";
}

function mapLastEventClass(input: unknown): OrbLastEventClass {
  if (
    input === "none" ||
    input === "user_input" ||
    input === "system_metadata" ||
    input === "policy_status" ||
    input === "safety_status" ||
    input === "error_status"
  ) {
    return input;
  }
  return "none";
}

function mapGovernancePosture(input: unknown): OrbGovernancePosture {
  if (input === "normal" || input === "guarded" || input === "locked") {
    return input;
  }
  return "unknown";
}

function mapKillSwitch(input: unknown): OrbKillSwitchDisplay {
  if (input === "available" || input === "engaged") return input;
  return "unknown";
}

function mapApprovalAttention(input: unknown): OrbApprovalAttentionState {
  if (input === "none" || input === "pending_metadata" || input === "blocked") {
    return input;
  }
  return "none";
}

function mapDegradedState(input: unknown): OrbDegradedState {
  if (input === "none" || input === "partial" || input === "major") {
    return input;
  }
  if (input === "degraded") return "partial";
  return "none";
}

function mapGeneratedAt(input: unknown): number {
  return typeof input === "number" && Number.isInteger(input) && input >= 0
    ? input
    : 0;
}

function containsForbiddenHook(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  if (Array.isArray(input))
    return input.some((item) => containsForbiddenHook(item));
  return Object.entries(input).some(
    ([key, value]) =>
      (
        COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS as readonly CommandCenterForbiddenScreenHookField[]
      ).includes(key as CommandCenterForbiddenScreenHookField) ||
      containsForbiddenHook(value),
  );
}

function collectForbiddenHookFields(
  input: unknown,
  path: string[],
  target: Set<string>,
): void {
  if (!input || typeof input !== "object") return;
  const entries = Array.isArray(input)
    ? input.map((value, index) => [String(index), value] as const)
    : Object.entries(input);
  for (const [key, value] of entries) {
    if (
      (
        COMMAND_CENTER_FORBIDDEN_SCREEN_HOOK_FIELDS as readonly CommandCenterForbiddenScreenHookField[]
      ).includes(key as CommandCenterForbiddenScreenHookField)
    ) {
      target.add([...path, key].join("."));
    }
    collectForbiddenHookFields(value, [...path, key], target);
  }
}

export function listOrbForbiddenRawPayloadFields(): string[] {
  return [...COMMAND_CENTER_OBSERVABILITY_FORBIDDEN_RAW_FIELD_CLASSES];
}
