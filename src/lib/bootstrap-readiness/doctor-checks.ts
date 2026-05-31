import { z } from "zod";

import {
  BOOTSTRAP_CATEGORIES,
  BOOTSTRAP_READINESS_CONTRACT_VERSION,
  BootstrapCategorySchema,
  BootstrapRequirementIdSchema,
  BootstrapValidationTargetIdSchema,
  type BootstrapCategory,
  type BootstrapRequirementId,
  type BootstrapValidationTargetId,
} from "./contracts";
import { BOOTSTRAP_READINESS_CONTRACT } from "./registry";

export const DOCTOR_CHECK_REGISTRY_VERSION = "20B.2" as const;

export const DOCTOR_CHECK_CATEGORIES = BOOTSTRAP_CATEGORIES;

export const DOCTOR_CHECK_SEVERITIES = ["blocking", "warning", "info"] as const;

export const DOCTOR_CHECK_RUNTIMES = [
  "metadata_only",
  "future_doctor_target",
] as const;

export const DOCTOR_CHECK_IDS = [
  "doctor-check:node-version",
  "doctor-check:package-manager-availability",
  "doctor-check:typescript-tooling",
  "doctor-check:platform-support",
  "doctor-check:required-project-directories",
  "doctor-check:required-config-files",
  "doctor-check:required-env-file-example",
  "doctor-check:required-registries",
  "doctor-check:sqlite-readiness",
  "doctor-check:tauri-readiness",
  "doctor-check:ollama-local-model-runtime",
  "doctor-check:voice-runtime-prerequisites",
  "doctor-check:vision-runtime-prerequisites",
  "doctor-check:local-first-cloud-gated-posture",
  "doctor-check:disabled-provider-posture",
] as const;

export type DoctorCheckCategory = BootstrapCategory;
export type DoctorCheckSeverity = (typeof DOCTOR_CHECK_SEVERITIES)[number];
export type DoctorCheckRuntime = (typeof DOCTOR_CHECK_RUNTIMES)[number];
export type DoctorCheckId = (typeof DOCTOR_CHECK_IDS)[number];

export const DoctorCheckCategorySchema = BootstrapCategorySchema;
export const DoctorCheckSeveritySchema = z.enum(DOCTOR_CHECK_SEVERITIES);
export const DoctorCheckRuntimeSchema = z.enum(DOCTOR_CHECK_RUNTIMES);
export const DoctorCheckIdSchema = z.enum(DOCTOR_CHECK_IDS);

export const DoctorCheckExpectedPostureSchema = z.strictObject({
  local_first: z.boolean(),
  cloud_gated: z.boolean(),
  disabled_by_default: z.boolean(),
  provider_disabled_by_default: z.boolean(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  shell_execution_enabled: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
});

export const DoctorCheckSchema = z.strictObject({
  check_id: DoctorCheckIdSchema,
  label: z.string().trim().min(1).max(140),
  category: DoctorCheckCategorySchema,
  severity: DoctorCheckSeveritySchema,
  required: z.boolean(),
  runtime: DoctorCheckRuntimeSchema,
  source_requirement_ids: z.array(BootstrapRequirementIdSchema).min(1),
  source_validation_target_ids: z
    .array(BootstrapValidationTargetIdSchema)
    .min(1),
  verifies: z.string().trim().min(1).max(360),
  expected_posture: DoctorCheckExpectedPostureSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  executes_check: z.literal(false),
  shell_execution_enabled: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  ui_route_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
});

export const DoctorCheckRegistrySchema = z.strictObject({
  registry_version: z.literal(DOCTOR_CHECK_REGISTRY_VERSION),
  registry_id: z.literal("phase-20b2-doctor-check-registry"),
  phase: z.literal("20B.2"),
  source_contract_version: z.literal(BOOTSTRAP_READINESS_CONTRACT_VERSION),
  summary: z.string().trim().min(1).max(360),
  categories: z.array(DoctorCheckCategorySchema),
  checks: z.array(DoctorCheckSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  executes_checks: z.literal(false),
  shell_execution_enabled: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  ui_route_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
});

export const DoctorCheckRegistrySummarySchema = z.strictObject({
  registry_version: z.literal(DOCTOR_CHECK_REGISTRY_VERSION),
  source_contract_version: z.literal(BOOTSTRAP_READINESS_CONTRACT_VERSION),
  check_count: z.number().int().positive(),
  required_check_count: z.number().int().nonnegative(),
  category_counts: z.record(
    DoctorCheckCategorySchema,
    z.number().int().nonnegative(),
  ),
  local_first_check_count: z.number().int().nonnegative(),
  cloud_gated_check_count: z.number().int().nonnegative(),
  disabled_by_default_check_count: z.number().int().nonnegative(),
  provider_disabled_by_default_check_count: z.number().int().nonnegative(),
  future_doctor_target_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  executes_checks: z.literal(false),
  shell_execution_enabled: z.literal(false),
  filesystem_inspection_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
});

export type DoctorCheckExpectedPosture = z.infer<
  typeof DoctorCheckExpectedPostureSchema
>;
export type DoctorCheck = z.infer<typeof DoctorCheckSchema>;
export type DoctorCheckRegistry = z.infer<typeof DoctorCheckRegistrySchema>;
export type DoctorCheckRegistrySummary = z.infer<
  typeof DoctorCheckRegistrySummarySchema
>;

const sourceRequirementIds = new Set<BootstrapRequirementId>(
  BOOTSTRAP_READINESS_CONTRACT.requirements.map(
    (requirement) => requirement.requirement_id,
  ),
);
const sourceValidationTargetIds = new Set<BootstrapValidationTargetId>(
  BOOTSTRAP_READINESS_CONTRACT.validation_targets.map(
    (target) => target.target_id,
  ),
);

function posture(
  input: Pick<
    DoctorCheckExpectedPosture,
    | "local_first"
    | "cloud_gated"
    | "disabled_by_default"
    | "provider_disabled_by_default"
  >,
): DoctorCheckExpectedPosture {
  return {
    ...input,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    shell_execution_enabled: false,
    filesystem_inspection_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
  };
}

function check(input: {
  check_id: DoctorCheckId;
  label: string;
  category: DoctorCheckCategory;
  severity: DoctorCheckSeverity;
  required: boolean;
  source_requirement_ids: readonly BootstrapRequirementId[];
  source_validation_target_ids: readonly BootstrapValidationTargetId[];
  verifies: string;
  expected_posture: DoctorCheckExpectedPosture;
}): DoctorCheck {
  return DoctorCheckSchema.parse({
    ...input,
    source_requirement_ids: [...input.source_requirement_ids],
    source_validation_target_ids: [...input.source_validation_target_ids],
    runtime: "future_doctor_target",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    executes_check: false,
    shell_execution_enabled: false,
    filesystem_inspection_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
    ui_route_created: false,
    authority_surface_created: false,
    capability_created: false,
  });
}

const CHECKS = [
  check({
    check_id: "doctor-check:node-version",
    label: "Node.js version",
    category: "environment",
    severity: "blocking",
    required: true,
    source_requirement_ids: ["bootstrap-req:node"],
    source_validation_target_ids: ["bootstrap-validation:node-version"],
    verifies:
      "Supported Node.js major version is expected for the local JARVIS app, tests, and tooling.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: false,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:package-manager-availability",
    label: "npm/pnpm availability",
    category: "environment",
    severity: "blocking",
    required: true,
    source_requirement_ids: ["bootstrap-req:npm-pnpm"],
    source_validation_target_ids: ["bootstrap-validation:package-manager"],
    verifies:
      "Package manager availability is expected without installing dependencies from this registry.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: false,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:typescript-tooling",
    label: "TypeScript/tooling readiness",
    category: "environment",
    severity: "blocking",
    required: true,
    source_requirement_ids: ["bootstrap-req:typescript"],
    source_validation_target_ids: ["bootstrap-validation:typescript-available"],
    verifies:
      "TypeScript tooling readiness is expected through project dependencies and validation.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: false,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:platform-support",
    label: "OS/platform support",
    category: "environment",
    severity: "blocking",
    required: true,
    source_requirement_ids: ["bootstrap-req:platform-support"],
    source_validation_target_ids: ["bootstrap-validation:platform-family"],
    verifies:
      "Platform family should match the supported local-first bootstrap targets declared by the contract.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: false,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:required-project-directories",
    label: "Required project directories",
    category: "project",
    severity: "blocking",
    required: true,
    source_requirement_ids: ["bootstrap-req:required-directories"],
    source_validation_target_ids: ["bootstrap-validation:project-layout"],
    verifies:
      "Required local project directories should be present for fresh-machine operation.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: false,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:required-config-files",
    label: "Required config files",
    category: "project",
    severity: "blocking",
    required: true,
    source_requirement_ids: ["bootstrap-req:required-config-files"],
    source_validation_target_ids: ["bootstrap-validation:config-files"],
    verifies:
      "Required local config files should be present before bootstrap can be considered reproducible.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: false,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:required-env-file-example",
    label: "Required env file/example",
    category: "project",
    severity: "blocking",
    required: true,
    source_requirement_ids: ["bootstrap-req:required-env-files"],
    source_validation_target_ids: ["bootstrap-validation:env-safe-defaults"],
    verifies:
      "Environment defaults should preserve local-only, remote-dashboard-disabled, and provider-disabled posture.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: true,
      disabled_by_default: true,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:required-registries",
    label: "Required registries",
    category: "project",
    severity: "blocking",
    required: true,
    source_requirement_ids: ["bootstrap-req:required-registries"],
    source_validation_target_ids: ["bootstrap-validation:registry-files"],
    verifies:
      "Required deterministic registries should remain present for model, room, tool, project, routine, architecture, disabled-feature, and authority metadata.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: true,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:sqlite-readiness",
    label: "SQLite readiness",
    category: "runtime",
    severity: "blocking",
    required: true,
    source_requirement_ids: ["bootstrap-req:sqlite"],
    source_validation_target_ids: ["bootstrap-validation:sqlite-package"],
    verifies:
      "SQLite package and migration readiness should be available for the local persistence substrate.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: false,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:tauri-readiness",
    label: "Tauri readiness",
    category: "runtime",
    severity: "blocking",
    required: true,
    source_requirement_ids: [
      "bootstrap-req:tauri",
      "bootstrap-req:verification-expectations",
    ],
    source_validation_target_ids: ["bootstrap-validation:tauri-toolchain"],
    verifies:
      "Tauri and Rust toolchain readiness should be describable for later packaging hardening.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: false,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:ollama-local-model-runtime",
    label: "Ollama/local model runtime readiness",
    category: "runtime",
    severity: "warning",
    required: false,
    source_requirement_ids: [
      "bootstrap-req:ollama",
      "bootstrap-req:local-model-runtime",
    ],
    source_validation_target_ids: [
      "bootstrap-validation:ollama-local-runtime",
      "bootstrap-validation:registry-files",
    ],
    verifies:
      "Local model runtime readiness should remain local-first, with cloud fallback explicitly gated.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: true,
      disabled_by_default: false,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:voice-runtime-prerequisites",
    label: "Voice runtime prerequisites",
    category: "runtime",
    severity: "warning",
    required: false,
    source_requirement_ids: ["bootstrap-req:voice-runtime-prerequisites"],
    source_validation_target_ids: [
      "bootstrap-validation:voice-local-prerequisites",
    ],
    verifies:
      "Voice prerequisites should remain optional, local-first, and cloud-gated while wake word and always-listening stay disabled.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: true,
      disabled_by_default: true,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:vision-runtime-prerequisites",
    label: "Vision runtime prerequisites",
    category: "runtime",
    severity: "warning",
    required: false,
    source_requirement_ids: ["bootstrap-req:vision-runtime-prerequisites"],
    source_validation_target_ids: [
      "bootstrap-validation:vision-local-prerequisites",
    ],
    verifies:
      "Vision prerequisites should remain optional, local-first, and cloud-gated while background camera stays disabled.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: true,
      disabled_by_default: true,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:local-first-cloud-gated-posture",
    label: "Local-first/cloud-gated posture",
    category: "validation",
    severity: "blocking",
    required: true,
    source_requirement_ids: [
      "bootstrap-req:local-model-runtime",
      "bootstrap-req:required-env-files",
      "bootstrap-req:required-registries",
      "bootstrap-req:doctor-integration-targets",
    ],
    source_validation_target_ids: [
      "bootstrap-validation:env-safe-defaults",
      "bootstrap-validation:doctor-readiness",
    ],
    verifies:
      "Doctor readiness should preserve local-first operation and keep cloud-dependent behavior gated.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: true,
      disabled_by_default: true,
      provider_disabled_by_default: true,
    }),
  }),
  check({
    check_id: "doctor-check:disabled-provider-posture",
    label: "Disabled-by-default provider posture",
    category: "validation",
    severity: "blocking",
    required: true,
    source_requirement_ids: [
      "bootstrap-req:required-env-files",
      "bootstrap-req:doctor-integration-targets",
    ],
    source_validation_target_ids: [
      "bootstrap-validation:env-safe-defaults",
      "bootstrap-validation:doctor-readiness",
    ],
    verifies:
      "Provider, network, and remote-dashboard defaults should remain disabled until governed by later approved surfaces.",
    expected_posture: posture({
      local_first: true,
      cloud_gated: true,
      disabled_by_default: true,
      provider_disabled_by_default: true,
    }),
  }),
] satisfies readonly DoctorCheck[];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }

    return Object.freeze(value);
  }

  return value;
}

function copyCheck(checkRecord: DoctorCheck): DoctorCheck {
  return DoctorCheckSchema.parse(JSON.parse(JSON.stringify(checkRecord)));
}

function copyRegistry(registry: DoctorCheckRegistry): DoctorCheckRegistry {
  return DoctorCheckRegistrySchema.parse(JSON.parse(JSON.stringify(registry)));
}

function assertAlignedWithBootstrapReadiness(checks: readonly DoctorCheck[]) {
  for (const checkRecord of checks) {
    for (const requirementId of checkRecord.source_requirement_ids) {
      if (!sourceRequirementIds.has(requirementId)) {
        throw new Error(`Unknown bootstrap requirement id: ${requirementId}`);
      }
    }

    for (const targetId of checkRecord.source_validation_target_ids) {
      if (!sourceValidationTargetIds.has(targetId)) {
        throw new Error(`Unknown bootstrap validation target id: ${targetId}`);
      }
    }
  }
}

assertAlignedWithBootstrapReadiness(CHECKS);

export const DOCTOR_CHECK_REGISTRY = deepFreeze(
  DoctorCheckRegistrySchema.parse({
    registry_version: DOCTOR_CHECK_REGISTRY_VERSION,
    registry_id: "phase-20b2-doctor-check-registry",
    phase: "20B.2",
    source_contract_version: BOOTSTRAP_READINESS_CONTRACT_VERSION,
    summary:
      "Metadata-only doctor check registry derived from the Phase 20B.1 bootstrap readiness contract; it declares fresh-machine checks without executing them.",
    categories: [...DOCTOR_CHECK_CATEGORIES],
    checks: CHECKS,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    executes_checks: false,
    shell_execution_enabled: false,
    filesystem_inspection_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
    ui_route_created: false,
    authority_surface_created: false,
    capability_created: false,
  }),
);

export function getDoctorCheckRegistry(): DoctorCheckRegistry {
  return copyRegistry(DOCTOR_CHECK_REGISTRY);
}

export function getDoctorChecksByCategory(
  category: DoctorCheckCategory,
): readonly DoctorCheck[] {
  return DOCTOR_CHECK_REGISTRY.checks
    .filter((checkRecord) => checkRecord.category === category)
    .map(copyCheck);
}

export function getRequiredDoctorChecks(): readonly DoctorCheck[] {
  return DOCTOR_CHECK_REGISTRY.checks
    .filter((checkRecord) => checkRecord.required)
    .map(copyCheck);
}

export function summarizeDoctorCheckRegistry(): DoctorCheckRegistrySummary {
  const checks = DOCTOR_CHECK_REGISTRY.checks;
  const categoryCounts = Object.fromEntries(
    DOCTOR_CHECK_CATEGORIES.map((category) => [
      category,
      checks.filter((checkRecord) => checkRecord.category === category).length,
    ]),
  ) as Record<DoctorCheckCategory, number>;

  return DoctorCheckRegistrySummarySchema.parse({
    registry_version: DOCTOR_CHECK_REGISTRY_VERSION,
    source_contract_version: BOOTSTRAP_READINESS_CONTRACT_VERSION,
    check_count: checks.length,
    required_check_count: checks.filter((checkRecord) => checkRecord.required)
      .length,
    category_counts: categoryCounts,
    local_first_check_count: checks.filter(
      (checkRecord) => checkRecord.expected_posture.local_first,
    ).length,
    cloud_gated_check_count: checks.filter(
      (checkRecord) => checkRecord.expected_posture.cloud_gated,
    ).length,
    disabled_by_default_check_count: checks.filter(
      (checkRecord) => checkRecord.expected_posture.disabled_by_default,
    ).length,
    provider_disabled_by_default_check_count: checks.filter(
      (checkRecord) =>
        checkRecord.expected_posture.provider_disabled_by_default,
    ).length,
    future_doctor_target_count: checks.filter(
      (checkRecord) => checkRecord.runtime === "future_doctor_target",
    ).length,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    executes_checks: false,
    shell_execution_enabled: false,
    filesystem_inspection_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
    authority_surface_created: false,
    capability_created: false,
  });
}
