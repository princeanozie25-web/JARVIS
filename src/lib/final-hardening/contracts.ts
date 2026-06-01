import { z } from "zod";

export const FINAL_HARDENING_CONTRACT_VERSION = "20F.1" as const;

export const HARDENING_SURFACE_IDS = [
  "hardening-surface:model-runtime-unavailable",
  "hardening-surface:provider-disabled-misconfigured",
  "hardening-surface:sqlite-event-store-unavailable",
  "hardening-surface:projection-read-failure",
  "hardening-surface:tauri-command-center-startup-failure",
  "hardening-surface:doctor-bootstrap-failure",
  "hardening-surface:onboarding-demo-readiness-failure",
  "hardening-surface:voice-runtime-unavailable",
  "hardening-surface:vision-runtime-unavailable",
  "hardening-surface:room-adapter-unavailable",
  "hardening-surface:fake-room-failure",
  "hardening-surface:scheduler-stalled-disabled",
  "hardening-surface:approval-runtime-unavailable",
  "hardening-surface:red-team-sandbox-disabled-misconfigured",
  "hardening-surface:telemetry-audit-report-unavailable",
  "hardening-surface:packaging-build-failure",
  "hardening-surface:configuration-missing-invalid",
  "hardening-surface:environment-unsupported",
  "hardening-surface:disk-memory-constraints",
  "hardening-surface:local-first-fallback-posture",
  "hardening-surface:cloud-provider-opt-in-gated",
] as const;

export const HARDENING_FAILURE_MODE_IDS = [
  "hardening-failure-mode:model-runtime-unavailable",
  "hardening-failure-mode:provider-disabled-misconfigured",
  "hardening-failure-mode:sqlite-event-store-unavailable",
  "hardening-failure-mode:projection-read-failure",
  "hardening-failure-mode:tauri-command-center-startup-failure",
  "hardening-failure-mode:doctor-bootstrap-failure",
  "hardening-failure-mode:onboarding-demo-readiness-failure",
  "hardening-failure-mode:voice-runtime-unavailable",
  "hardening-failure-mode:vision-runtime-unavailable",
  "hardening-failure-mode:room-adapter-unavailable",
  "hardening-failure-mode:fake-room-failure",
  "hardening-failure-mode:scheduler-stalled-disabled",
  "hardening-failure-mode:approval-runtime-unavailable",
  "hardening-failure-mode:red-team-sandbox-disabled-misconfigured",
  "hardening-failure-mode:telemetry-audit-report-unavailable",
  "hardening-failure-mode:packaging-build-failure",
  "hardening-failure-mode:configuration-missing-invalid",
  "hardening-failure-mode:environment-unsupported",
  "hardening-failure-mode:disk-memory-constraints",
  "hardening-failure-mode:local-first-fallback-posture",
  "hardening-failure-mode:cloud-provider-opt-in-gated",
] as const;

export const HARDENING_DIMENSION_IDS = [
  "hardening-dimension:failure-mode",
  "hardening-dimension:fallback-behavior",
  "hardening-dimension:user-visible-error-posture",
  "hardening-dimension:audit-log-posture",
  "hardening-dimension:safe-default",
  "hardening-dimension:disabled-deferred-posture",
  "hardening-dimension:recovery-guidance",
  "hardening-dimension:blocking-severity",
] as const;

export const HARDENING_EXPECTATION_IDS = [
  "hardening-expectation:failure-mode",
  "hardening-expectation:fallback-behavior",
  "hardening-expectation:user-visible-error-posture",
  "hardening-expectation:audit-log-posture",
  "hardening-expectation:safe-default",
  "hardening-expectation:disabled-deferred-posture",
  "hardening-expectation:recovery-guidance",
  "hardening-expectation:blocking-severity",
] as const;

export const HARDENING_SEVERITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const HARDENING_RECOVERY_POSTURES = [
  "block_startup_with_guidance",
  "degrade_to_local_safe_mode",
  "defer_capability_with_notice",
  "surface_read_only_warning",
  "require_user_configuration",
  "keep_cloud_disabled",
] as const;

export type HardeningSurfaceId = (typeof HARDENING_SURFACE_IDS)[number];
export type HardeningFailureModeId =
  (typeof HARDENING_FAILURE_MODE_IDS)[number];
export type HardeningDimensionId = (typeof HARDENING_DIMENSION_IDS)[number];
export type HardeningExpectationId = (typeof HARDENING_EXPECTATION_IDS)[number];
export type HardeningSeverity = (typeof HARDENING_SEVERITIES)[number];
export type HardeningRecoveryPosture =
  (typeof HARDENING_RECOVERY_POSTURES)[number];

export const HardeningSurfaceIdSchema = z.enum(HARDENING_SURFACE_IDS);
export const HardeningFailureModeIdSchema = z.enum(HARDENING_FAILURE_MODE_IDS);
export const HardeningDimensionIdSchema = z.enum(HARDENING_DIMENSION_IDS);
export const HardeningExpectationIdSchema = z.enum(HARDENING_EXPECTATION_IDS);
export const HardeningSeveritySchema = z.enum(HARDENING_SEVERITIES);
export const HardeningRecoveryPostureSchema = z.enum(
  HARDENING_RECOVERY_POSTURES,
);

export const FinalHardeningPostureSchema = z.strictObject({
  contract_only: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  hardening_execution_enabled: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  runtime_execution_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  shell_process_execution_enabled: z.literal(false),
  ui_route_created: z.literal(false),
  approval_bypass_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
  source_material_exposure_enabled: z.literal(false),
});

export const HardeningDimensionSchema = z.strictObject({
  dimension_id: HardeningDimensionIdSchema,
  label: z.string().trim().min(1).max(180),
  hardening_goal: z.string().trim().min(1).max(480),
  severity: HardeningSeveritySchema,
  expectation_id: HardeningExpectationIdSchema,
  posture: FinalHardeningPostureSchema,
});

export const HardeningExpectationSchema = z.strictObject({
  expectation_id: HardeningExpectationIdSchema,
  dimension_id: HardeningDimensionIdSchema,
  severity: HardeningSeveritySchema,
  expectation: z.string().trim().min(1).max(560),
  verification_guidance: z.array(z.string().trim().min(1).max(240)).min(1),
  future_hardening_only: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export const HardeningFailureModeSchema = z.strictObject({
  failure_mode_id: HardeningFailureModeIdSchema,
  surface_id: HardeningSurfaceIdSchema,
  label: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(520),
  severity: HardeningSeveritySchema,
  expected_recovery_posture: HardeningRecoveryPostureSchema,
  posture: FinalHardeningPostureSchema,
});

export const HardeningSurfaceSchema = z.strictObject({
  surface_id: HardeningSurfaceIdSchema,
  label: z.string().trim().min(1).max(180),
  failure_mode_id: HardeningFailureModeIdSchema,
  dimension_ids: z.array(HardeningDimensionIdSchema).min(1),
  expectation_ids: z.array(HardeningExpectationIdSchema).min(1),
  fallback_behavior: z.string().trim().min(1).max(520),
  user_visible_error_posture: z.string().trim().min(1).max(520),
  audit_log_posture: z.string().trim().min(1).max(520),
  safe_default: z.string().trim().min(1).max(520),
  disabled_deferred_posture: z.string().trim().min(1).max(520),
  recovery_guidance: z.array(z.string().trim().min(1).max(240)).min(1),
  blocking_severity: HardeningSeveritySchema,
  recovery_posture: HardeningRecoveryPostureSchema,
  posture: FinalHardeningPostureSchema,
});

export const FinalHardeningContractSchema = z.strictObject({
  contract_version: z.literal(FINAL_HARDENING_CONTRACT_VERSION),
  contract_id: z.literal("phase-20f1-final-hardening-contract"),
  phase: z.literal("20F.1"),
  summary: z.string().trim().min(1).max(560),
  surfaces: z.array(HardeningSurfaceSchema),
  failure_modes: z.array(HardeningFailureModeSchema),
  dimensions: z.array(HardeningDimensionSchema),
  expectations: z.array(HardeningExpectationSchema),
  posture: FinalHardeningPostureSchema,
});

export const FinalHardeningSummarySchema = z.strictObject({
  contract_version: z.literal(FINAL_HARDENING_CONTRACT_VERSION),
  surface_count: z.number().int().positive(),
  failure_mode_count: z.number().int().positive(),
  dimension_count: z.number().int().positive(),
  expectation_count: z.number().int().positive(),
  critical_surface_count: z.number().int().nonnegative(),
  high_surface_count: z.number().int().nonnegative(),
  medium_surface_count: z.number().int().nonnegative(),
  low_surface_count: z.number().int().nonnegative(),
  recovery_posture_count: z.number().int().positive(),
  safe_default_surface_count: z.number().int().nonnegative(),
  fallback_surface_count: z.number().int().nonnegative(),
  phase20f_contract_only: z.literal(true),
  phase20f_capability_neutral: z.literal(true),
  posture: FinalHardeningPostureSchema,
});

export type FinalHardeningPosture = z.infer<typeof FinalHardeningPostureSchema>;
export type HardeningDimension = z.infer<typeof HardeningDimensionSchema>;
export type HardeningExpectation = z.infer<typeof HardeningExpectationSchema>;
export type HardeningFailureMode = z.infer<typeof HardeningFailureModeSchema>;
export type HardeningSurface = z.infer<typeof HardeningSurfaceSchema>;
export type FinalHardeningContract = z.infer<
  typeof FinalHardeningContractSchema
>;
export type FinalHardeningSummary = z.infer<typeof FinalHardeningSummarySchema>;
