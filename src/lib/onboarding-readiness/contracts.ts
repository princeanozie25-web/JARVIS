import { z } from "zod";

export const ONBOARDING_READINESS_CONTRACT_VERSION = "20C.1" as const;

export const ONBOARDING_READINESS_CATEGORIES = [
  "clone",
  "dependencies",
  "environment",
  "doctor",
  "demo",
  "fake_room",
  "local_model",
  "voice",
  "vision",
  "command_center",
  "packaging",
  "deferred",
] as const;

export const ONBOARDING_STEP_IDS = [
  "onboarding-step:clone-readiness",
  "onboarding-step:dependency-readiness",
  "onboarding-step:environment-configuration-readiness",
  "onboarding-step:doctor-check-readiness",
  "onboarding-step:demo-mode-readiness",
  "onboarding-step:fake-room-readiness",
  "onboarding-step:local-model-readiness",
  "onboarding-step:voice-readiness",
  "onboarding-step:vision-readiness",
  "onboarding-step:command-center-readiness",
  "onboarding-step:packaging-readiness",
  "onboarding-step:first-safe-run-readiness",
] as const;

export const ONBOARDING_GATE_IDS = [
  "onboarding-gate:phase-20a-governance-ready",
  "onboarding-gate:phase-20b-bootstrap-ready",
  "onboarding-gate:doctor-cli-report-available",
  "onboarding-gate:demo-mode-metadata-ready",
  "onboarding-gate:first-safe-run-approval-governed",
  "onboarding-gate:no-new-capabilities",
] as const;

export const ONBOARDING_DEFERRED_ITEM_IDS = [
  "onboarding-deferred:real-device-onboarding",
  "onboarding-deferred:wake-word",
  "onboarding-deferred:conversation-mode-architecture-amendment",
  "onboarding-deferred:cloud-provider-defaults",
  "onboarding-deferred:whole-home-multi-room",
] as const;

export type OnboardingReadinessCategory =
  (typeof ONBOARDING_READINESS_CATEGORIES)[number];
export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];
export type OnboardingGateId = (typeof ONBOARDING_GATE_IDS)[number];
export type OnboardingDeferredItemId =
  (typeof ONBOARDING_DEFERRED_ITEM_IDS)[number];

export const OnboardingReadinessCategorySchema = z.enum(
  ONBOARDING_READINESS_CATEGORIES,
);
export const OnboardingStepIdSchema = z.enum(ONBOARDING_STEP_IDS);
export const OnboardingGateIdSchema = z.enum(ONBOARDING_GATE_IDS);
export const OnboardingDeferredItemIdSchema = z.enum(
  ONBOARDING_DEFERRED_ITEM_IDS,
);

export const OnboardingSafetyPostureSchema = z.strictObject({
  contract_only: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  installer_automation_enabled: z.literal(false),
  shell_execution_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  filesystem_mutation_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  runtime_execution_enabled: z.literal(false),
  ui_route_created: z.literal(false),
  approval_bypass_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
  source_material_exposure_enabled: z.literal(false),
});

export const OnboardingStepSchema = z.strictObject({
  step_id: OnboardingStepIdSchema,
  label: z.string().trim().min(1).max(160),
  category: OnboardingReadinessCategorySchema,
  sequence: z.number().int().positive(),
  readiness_goal: z.string().trim().min(1).max(360),
  required_gate_ids: z.array(OnboardingGateIdSchema),
  evidence_ids: z.array(z.string().trim().min(1).max(180)).min(1),
  local_first: z.boolean(),
  cloud_gated: z.boolean(),
  disabled_by_default: z.boolean(),
  requires_approval_before_real_action: z.boolean(),
  safety_posture: OnboardingSafetyPostureSchema,
});

export const OnboardingGateSchema = z.strictObject({
  gate_id: OnboardingGateIdSchema,
  label: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(360),
  evidence_ids: z.array(z.string().trim().min(1).max(180)).min(1),
  satisfied_by_contract: z.literal(true),
  safety_posture: OnboardingSafetyPostureSchema,
});

export const OnboardingDeferredItemSchema = z.strictObject({
  deferred_item_id: OnboardingDeferredItemIdSchema,
  label: z.string().trim().min(1).max(160),
  category: OnboardingReadinessCategorySchema,
  deferred_reason: z.string().trim().min(1).max(360),
  future_phase_posture: z.string().trim().min(1).max(240),
  architecture_amendment_required: z.boolean(),
  remains_disabled: z.literal(true),
  safety_posture: OnboardingSafetyPostureSchema,
});

export const OnboardingReadinessContractSchema = z.strictObject({
  contract_version: z.literal(ONBOARDING_READINESS_CONTRACT_VERSION),
  contract_id: z.literal("phase-20c1-onboarding-readiness-contract"),
  phase: z.literal("20C.1"),
  summary: z.string().trim().min(1).max(420),
  categories: z.array(OnboardingReadinessCategorySchema),
  steps: z.array(OnboardingStepSchema),
  gates: z.array(OnboardingGateSchema),
  deferred_items: z.array(OnboardingDeferredItemSchema),
  safety_posture: OnboardingSafetyPostureSchema,
});

export const OnboardingReadinessSummarySchema = z.strictObject({
  contract_version: z.literal(ONBOARDING_READINESS_CONTRACT_VERSION),
  step_count: z.number().int().positive(),
  gate_count: z.number().int().positive(),
  deferred_item_count: z.number().int().positive(),
  category_counts: z.record(
    OnboardingReadinessCategorySchema,
    z.number().int().nonnegative(),
  ),
  local_first_step_count: z.number().int().nonnegative(),
  cloud_gated_step_count: z.number().int().nonnegative(),
  disabled_by_default_step_count: z.number().int().nonnegative(),
  approval_guarded_step_count: z.number().int().nonnegative(),
  architecture_amendment_deferred_count: z.number().int().nonnegative(),
  phase20c_contract_only: z.literal(true),
  phase20c_capability_neutral: z.literal(true),
  safety_posture: OnboardingSafetyPostureSchema,
});

export type OnboardingSafetyPosture = z.infer<
  typeof OnboardingSafetyPostureSchema
>;
export type OnboardingStep = z.infer<typeof OnboardingStepSchema>;
export type OnboardingGate = z.infer<typeof OnboardingGateSchema>;
export type OnboardingDeferredItem = z.infer<
  typeof OnboardingDeferredItemSchema
>;
export type OnboardingReadinessContract = z.infer<
  typeof OnboardingReadinessContractSchema
>;
export type OnboardingReadinessSummary = z.infer<
  typeof OnboardingReadinessSummarySchema
>;
