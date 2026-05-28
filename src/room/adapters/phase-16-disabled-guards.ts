import { z } from "zod";

export const PHASE_16_ROOM_ADAPTER_DISABLED_FEATURES = [
  "real_hue_writes",
  "hue_auto_discovery",
  "hue_cloud_remote_api",
  "scenes_macros",
  "scheduled_device_actions",
  "voice_trust_class_elevation",
  "runtime_trust_class_elevation",
  "jarvis_policy_edits",
  "multi_device_routines",
  "real_hue_adapter_without_fake_conformance",
] as const;

export const PHASE_16_ROOM_ADAPTER_GUARD_REASONS = [
  "phase_16a_fake_conformance_required",
  "real_hue_not_enabled",
  "local_only_invariant",
  "single_action_only",
  "approval_policy_locked",
] as const;

export const Phase16RoomAdapterDisabledFeatureSchema = z.enum(
  PHASE_16_ROOM_ADAPTER_DISABLED_FEATURES,
);
export const Phase16RoomAdapterGuardReasonSchema = z.enum(
  PHASE_16_ROOM_ADAPTER_GUARD_REASONS,
);

export const Phase16RoomAdapterDisabledGuardMatrixSchema = z.strictObject({
  phase: z.literal(16),
  slice: z.literal("16A.2"),
  status: z.literal("disabled_guard_matrix"),
  real_hue_writes_enabled: z.literal(false),
  hue_auto_discovery_enabled: z.literal(false),
  hue_cloud_remote_api_enabled: z.literal(false),
  scenes_macros_enabled: z.literal(false),
  scheduled_device_actions_enabled: z.literal(false),
  voice_trust_class_elevation_enabled: z.literal(false),
  runtime_trust_class_elevation_enabled: z.literal(false),
  jarvis_policy_edits_enabled: z.literal(false),
  multi_device_routines_enabled: z.literal(false),
  real_hue_adapter_enabled: z.literal(false),
  fake_conformance_required_before_real_hue: z.literal(true),
  real_hue_adapter_requires_fake_conformance: z.literal(true),
  metadata_only: z.literal(true),
  local_only: z.literal(true),
  network_called: z.literal(false),
  hardware_io_performed: z.literal(false),
  cloud_called: z.literal(false),
  persisted: z.literal(false),
  ui_rendered: z.literal(false),
});

export const Phase16RoomAdapterGuardDecisionSchema = z.strictObject({
  feature: Phase16RoomAdapterDisabledFeatureSchema,
  allowed: z.literal(false),
  reason: Phase16RoomAdapterGuardReasonSchema,
  phase: z.literal(16),
  slice: z.literal("16A.2"),
  metadata_only: z.literal(true),
  local_only: z.literal(true),
  network_called: z.literal(false),
  hardware_io_performed: z.literal(false),
  cloud_called: z.literal(false),
  persisted: z.literal(false),
  ui_rendered: z.literal(false),
  trust_class_elevated: z.literal(false),
  policy_edited: z.literal(false),
  schedule_registered: z.literal(false),
  routine_created: z.literal(false),
});

export type Phase16RoomAdapterDisabledFeature =
  (typeof PHASE_16_ROOM_ADAPTER_DISABLED_FEATURES)[number];
export type Phase16RoomAdapterGuardReason =
  (typeof PHASE_16_ROOM_ADAPTER_GUARD_REASONS)[number];
export type Phase16RoomAdapterDisabledGuardMatrix = z.infer<
  typeof Phase16RoomAdapterDisabledGuardMatrixSchema
>;
export type Phase16RoomAdapterGuardDecision = z.infer<
  typeof Phase16RoomAdapterGuardDecisionSchema
>;

export const DEFAULT_PHASE_16_ROOM_ADAPTER_DISABLED_GUARDS =
  Phase16RoomAdapterDisabledGuardMatrixSchema.parse({
    phase: 16,
    slice: "16A.2",
    status: "disabled_guard_matrix",
    real_hue_writes_enabled: false,
    hue_auto_discovery_enabled: false,
    hue_cloud_remote_api_enabled: false,
    scenes_macros_enabled: false,
    scheduled_device_actions_enabled: false,
    voice_trust_class_elevation_enabled: false,
    runtime_trust_class_elevation_enabled: false,
    jarvis_policy_edits_enabled: false,
    multi_device_routines_enabled: false,
    real_hue_adapter_enabled: false,
    fake_conformance_required_before_real_hue: true,
    real_hue_adapter_requires_fake_conformance: true,
    metadata_only: true,
    local_only: true,
    network_called: false,
    hardware_io_performed: false,
    cloud_called: false,
    persisted: false,
    ui_rendered: false,
  });

export function evaluatePhase16RoomAdapterDisabledFeature(
  feature: Phase16RoomAdapterDisabledFeature,
): Phase16RoomAdapterGuardDecision {
  return Phase16RoomAdapterGuardDecisionSchema.parse({
    feature,
    allowed: false,
    reason: reasonForFeature(feature),
    phase: 16,
    slice: "16A.2",
    metadata_only: true,
    local_only: true,
    network_called: false,
    hardware_io_performed: false,
    cloud_called: false,
    persisted: false,
    ui_rendered: false,
    trust_class_elevated: false,
    policy_edited: false,
    schedule_registered: false,
    routine_created: false,
  });
}

function reasonForFeature(
  feature: Phase16RoomAdapterDisabledFeature,
): Phase16RoomAdapterGuardReason {
  switch (feature) {
    case "real_hue_writes":
    case "real_hue_adapter_without_fake_conformance":
      return "phase_16a_fake_conformance_required";
    case "hue_auto_discovery":
    case "hue_cloud_remote_api":
      return "local_only_invariant";
    case "scenes_macros":
    case "multi_device_routines":
      return "single_action_only";
    case "scheduled_device_actions":
      return "approval_policy_locked";
    case "voice_trust_class_elevation":
    case "runtime_trust_class_elevation":
    case "jarvis_policy_edits":
      return "approval_policy_locked";
  }
}
