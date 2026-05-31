import { z } from "zod";

export const BOOTSTRAP_READINESS_CONTRACT_VERSION = "20B.1" as const;

export const BOOTSTRAP_CATEGORIES = [
  "environment",
  "runtime",
  "project",
  "validation",
] as const;

export const BOOTSTRAP_REQUIREMENT_KINDS = [
  "required",
  "optional",
  "disabled_by_default",
  "cloud_gated",
  "local_first",
] as const;

export const BOOTSTRAP_REQUIREMENT_IDS = [
  "bootstrap-req:node",
  "bootstrap-req:npm-pnpm",
  "bootstrap-req:typescript",
  "bootstrap-req:platform-support",
  "bootstrap-req:ollama",
  "bootstrap-req:local-model-runtime",
  "bootstrap-req:sqlite",
  "bootstrap-req:tauri",
  "bootstrap-req:voice-runtime-prerequisites",
  "bootstrap-req:vision-runtime-prerequisites",
  "bootstrap-req:required-directories",
  "bootstrap-req:required-config-files",
  "bootstrap-req:required-env-files",
  "bootstrap-req:required-registries",
  "bootstrap-req:readiness-checks",
  "bootstrap-req:doctor-integration-targets",
  "bootstrap-req:verification-expectations",
] as const;

export const BOOTSTRAP_VALIDATION_TARGET_IDS = [
  "bootstrap-validation:node-version",
  "bootstrap-validation:package-manager",
  "bootstrap-validation:typescript-available",
  "bootstrap-validation:platform-family",
  "bootstrap-validation:ollama-local-runtime",
  "bootstrap-validation:sqlite-package",
  "bootstrap-validation:tauri-toolchain",
  "bootstrap-validation:voice-local-prerequisites",
  "bootstrap-validation:vision-local-prerequisites",
  "bootstrap-validation:project-layout",
  "bootstrap-validation:config-files",
  "bootstrap-validation:env-safe-defaults",
  "bootstrap-validation:registry-files",
  "bootstrap-validation:doctor-readiness",
  "bootstrap-validation:test-suite",
] as const;

export type BootstrapCategory = (typeof BOOTSTRAP_CATEGORIES)[number];
export type BootstrapRequirementKind =
  (typeof BOOTSTRAP_REQUIREMENT_KINDS)[number];
export type BootstrapRequirementId = (typeof BOOTSTRAP_REQUIREMENT_IDS)[number];
export type BootstrapValidationTargetId =
  (typeof BOOTSTRAP_VALIDATION_TARGET_IDS)[number];

export const BootstrapCategorySchema = z.enum(BOOTSTRAP_CATEGORIES);
export const BootstrapRequirementKindSchema = z.enum(
  BOOTSTRAP_REQUIREMENT_KINDS,
);
export const BootstrapRequirementIdSchema = z.enum(BOOTSTRAP_REQUIREMENT_IDS);
export const BootstrapValidationTargetIdSchema = z.enum(
  BOOTSTRAP_VALIDATION_TARGET_IDS,
);

export const BootstrapRequirementSchema = z.strictObject({
  requirement_id: BootstrapRequirementIdSchema,
  label: z.string().trim().min(1).max(140),
  category: BootstrapCategorySchema,
  kind: BootstrapRequirementKindSchema,
  must_exist: z.string().trim().min(1).max(320),
  optional_reason: z.string().trim().min(1).max(240).nullable(),
  disabled_by_default: z.boolean(),
  local_first: z.boolean(),
  cloud_gated: z.boolean(),
  validation_target_ids: z.array(BootstrapValidationTargetIdSchema).min(1),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  installation_executed: z.literal(false),
  shell_invocation_enabled: z.literal(false),
  filesystem_mutation_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  runtime_hook_enabled: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
});

export const BootstrapValidationTargetSchema = z.strictObject({
  target_id: BootstrapValidationTargetIdSchema,
  label: z.string().trim().min(1).max(140),
  category: BootstrapCategorySchema,
  validates_requirement_ids: z.array(BootstrapRequirementIdSchema).min(1),
  doctor_integration_target: z.boolean(),
  verification_expectation: z.string().trim().min(1).max(320),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  executes_check: z.literal(false),
  shell_command_included: z.literal(false),
  installs_dependency: z.literal(false),
  mutates_environment: z.literal(false),
  mutates_filesystem: z.literal(false),
  calls_network: z.literal(false),
  contacts_provider: z.literal(false),
});

export const BootstrapReadinessPostureSchema = z.strictObject({
  contract_layer_only: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  performs_installation: z.literal(false),
  executes_shell: z.literal(false),
  mutates_environment: z.literal(false),
  mutates_filesystem: z.literal(false),
  calls_network: z.literal(false),
  contacts_provider: z.literal(false),
  adds_runtime_hook: z.literal(false),
  adds_bootstrap_automation: z.literal(false),
  creates_authority_surface: z.literal(false),
  creates_capability: z.literal(false),
});

export const BootstrapReadinessContractSchema = z.strictObject({
  contract_version: z.literal(BOOTSTRAP_READINESS_CONTRACT_VERSION),
  contract_id: z.literal("phase-20b1-bootstrap-readiness-contract"),
  phase: z.literal("20B.1"),
  summary: z.string().trim().min(1).max(360),
  categories: z.array(BootstrapCategorySchema),
  requirements: z.array(BootstrapRequirementSchema),
  validation_targets: z.array(BootstrapValidationTargetSchema),
  posture: BootstrapReadinessPostureSchema,
});

export const BootstrapReadinessSummarySchema = z.strictObject({
  contract_version: z.literal(BOOTSTRAP_READINESS_CONTRACT_VERSION),
  requirement_count: z.number().int().positive(),
  validation_target_count: z.number().int().positive(),
  category_counts: z.record(
    BootstrapCategorySchema,
    z.number().int().nonnegative(),
  ),
  required_count: z.number().int().nonnegative(),
  optional_count: z.number().int().nonnegative(),
  disabled_by_default_count: z.number().int().nonnegative(),
  local_first_count: z.number().int().nonnegative(),
  cloud_gated_count: z.number().int().nonnegative(),
  doctor_integration_target_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  installation_executed: z.literal(false),
  shell_invocation_enabled: z.literal(false),
  filesystem_mutation_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  runtime_hook_enabled: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
});

export type BootstrapRequirement = z.infer<typeof BootstrapRequirementSchema>;
export type BootstrapValidationTarget = z.infer<
  typeof BootstrapValidationTargetSchema
>;
export type BootstrapReadinessPosture = z.infer<
  typeof BootstrapReadinessPostureSchema
>;
export type BootstrapReadinessContract = z.infer<
  typeof BootstrapReadinessContractSchema
>;
export type BootstrapReadinessSummary = z.infer<
  typeof BootstrapReadinessSummarySchema
>;
