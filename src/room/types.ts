import type { z } from "zod";
import type {
  AdapterRefSchema,
  ApprovalPolicySchema,
  DeviceSchema,
  DeviceStateSchema,
  PolicyRuleSchema,
  RetentionPolicySchema,
  RoomPolicySchema,
  RoomProfileSchema,
  SensorSchema,
  SensorStateSchema,
  ZoneSchema,
} from "./schema";

export const ROOM_TRUST_CLASSES = [
  "observe_only",
  "safe_mutate",
  "restricted_mutate",
  "forbidden",
] as const;

export const ROOM_CAPABILITIES = [
  "power.observe",
  "power.switch",
  "light.observe",
  "light.dimmer",
  "light.color",
  "light.temperature",
  "presence.observe",
  "motion.observe",
  "temperature.observe",
  "meter.observe",
  "humidity.observe",
  "camera.mock_frame",
  "screen.ocr",
] as const;

export const ROOM_ADAPTER_KINDS = [
  "fake",
  "hue",
  "mock_camera",
  "mock_screen",
  "manual",
] as const;

export const POLICY_RULE_SCOPES = ["room", "zone", "device", "sensor"] as const;

export const POLICY_RULE_EFFECTS = [
  "allow",
  "require_approval",
  "deny",
] as const;

export type TrustClass = (typeof ROOM_TRUST_CLASSES)[number];
export type Capability = (typeof ROOM_CAPABILITIES)[number];
export type AdapterKind = (typeof ROOM_ADAPTER_KINDS)[number];
export type PolicyRuleScope = (typeof POLICY_RULE_SCOPES)[number];
export type PolicyRuleEffect = (typeof POLICY_RULE_EFFECTS)[number];

export type AdapterRef = z.infer<typeof AdapterRefSchema>;
export type Zone = z.infer<typeof ZoneSchema>;
export type DeviceState = z.infer<typeof DeviceStateSchema>;
export type SensorState = z.infer<typeof SensorStateSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type Sensor = z.infer<typeof SensorSchema>;
export type PolicyRule = z.infer<typeof PolicyRuleSchema>;
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;
export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;
export type RoomPolicy = z.infer<typeof RoomPolicySchema>;
export type RoomProfile = z.infer<typeof RoomProfileSchema>;
