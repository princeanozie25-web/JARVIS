import { z } from "zod";

import {
  DOCTOR_CHECK_REGISTRY_VERSION,
  DoctorCheckIdSchema,
  type DoctorCheck,
  type DoctorCheckId,
} from "./doctor-checks";
import { getDoctorCheckRegistry } from "./doctor-checks";
import {
  DOCTOR_REPORT_CONTRACT_VERSION,
  DoctorReportSchema,
  buildDoctorReportFromResults,
  type DoctorReport,
} from "./doctor-report";
import {
  DOCTOR_RESULT_CONTRACT_VERSION,
  DoctorCheckResultSchema,
  DoctorObservedPostureSchema,
  DoctorRemediationHintSchema,
  DoctorResultSourceSchema,
  type DoctorCheckResult,
  type DoctorCheckStatus,
  type DoctorObservedPosture,
  type DoctorRemediationHint,
  type DoctorResultSource,
} from "./doctor-results";
import {
  HardwareProfileSchema,
  ModelRegistryStalenessReportSchema,
  ModelHardwareFitReportSchema,
  evaluateLocalModelHardwareFit,
  evaluateModelRegistryStaleness,
  type HardwareProfile,
  type ModelHardwareFitReport,
  type ModelRegistryEntry,
  type ModelRegistryStalenessReport,
} from "../../models";

export const DOCTOR_RUNTIME_VERSION = "20B.6" as const;

export const SAFE_LOCAL_RUNTIME_SUPPORTED_CHECK_IDS = [
  "doctor-check:node-version",
  "doctor-check:package-manager-availability",
  "doctor-check:platform-support",
  "doctor-check:required-project-directories",
  "doctor-check:required-config-files",
  "doctor-check:required-env-file-example",
] as const satisfies readonly DoctorCheckId[];

export const DoctorRuntimePathKindSchema = z.enum(["file", "directory"]);
export const DoctorRuntimePackageManagerIdSchema = z.enum(["npm", "pnpm"]);

export const DoctorRuntimePathRequestSchema = z.strictObject({
  relative_path: z.string().trim().min(1).max(180),
  path_kind: DoctorRuntimePathKindSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  mutation_enabled: z.literal(false),
});

export const DoctorRuntimeVersionProbeRequestSchema = z.strictObject({
  probe_id: z.literal("package-manager-availability"),
  package_manager_ids: z.array(DoctorRuntimePackageManagerIdSchema).min(1),
  timeout_ms: z.number().int().positive().max(2000),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  bounded: z.literal(true),
  shell_execution_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
});

export const DoctorRuntimeVersionProbeResultSchema = z.strictObject({
  available: z.boolean(),
  detected_package_manager: DoctorRuntimePackageManagerIdSchema.nullable(),
  version_label: z.string().trim().min(1).max(80).nullable(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  bounded: z.literal(true),
  shell_execution_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  install_action_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
});

export const DoctorRuntimeEvaluationSchema = z.strictObject({
  runtime_version: z.literal(DOCTOR_RUNTIME_VERSION),
  source_registry_version: z.literal(DOCTOR_CHECK_REGISTRY_VERSION),
  result_contract_version: z.literal(DOCTOR_RESULT_CONTRACT_VERSION),
  report_contract_version: z.literal(DOCTOR_REPORT_CONTRACT_VERSION),
  supported_check_ids: z.array(DoctorCheckIdSchema),
  results: z.array(DoctorCheckResultSchema),
  report: DoctorReportSchema,
  hardware_profile: HardwareProfileSchema,
  local_model_fit: ModelHardwareFitReportSchema,
  model_registry_staleness: ModelRegistryStalenessReportSchema,
  observed_at: z.string().trim().min(1).max(80).nullable(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  safe_local_runtime_only: z.literal(true),
  real_environment_inspection_limited: z.literal(true),
  installation_enabled: z.literal(false),
  auto_fix_enabled: z.literal(false),
  filesystem_mutation_enabled: z.literal(false),
  shell_execution_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  provider_call_enabled: z.literal(false),
  ollama_call_enabled: z.literal(false),
  tauri_execution_enabled: z.literal(false),
  voice_runtime_execution_enabled: z.literal(false),
  vision_runtime_execution_enabled: z.literal(false),
  approval_bypass_created: z.literal(false),
  ui_route_created: z.literal(false),
  authority_surface_created: z.literal(false),
  capability_created: z.literal(false),
  raw_payload_included: z.literal(false),
});

export type DoctorRuntimePathKind = z.infer<typeof DoctorRuntimePathKindSchema>;
export type DoctorRuntimePathRequest = z.infer<
  typeof DoctorRuntimePathRequestSchema
>;
export type DoctorRuntimeVersionProbeRequest = z.infer<
  typeof DoctorRuntimeVersionProbeRequestSchema
>;
export type DoctorRuntimeVersionProbeResult = z.infer<
  typeof DoctorRuntimeVersionProbeResultSchema
>;
export type DoctorRuntimeEvaluation = z.infer<
  typeof DoctorRuntimeEvaluationSchema
>;

export type DoctorRuntimeAdapters = {
  pathExists: (request: DoctorRuntimePathRequest) => boolean;
  nodeVersion?: () => string | null;
  platform?: () => string | null;
  packageManagerVersionProbe?: (
    request: DoctorRuntimeVersionProbeRequest,
  ) => DoctorRuntimeVersionProbeResult;
};

export type DoctorRuntimeOptions = {
  adapters: DoctorRuntimeAdapters;
  observed_at?: string | null;
  hardwareProfile?: HardwareProfile;
  modelRegistryEntries?: readonly ModelRegistryEntry[];
  modelRegistryNow?: Date | string;
};

const FALLBACK_HARDWARE_PROFILE: HardwareProfile = HardwareProfileSchema.parse({
  totalRamGb: 0,
  freeRamGb: 0,
  platform: "linux",
  arch: "x64",
  unifiedMemory: false,
  metal: false,
  vramGb: null,
  reservedRamGb: 6,
});

const REQUIRED_DIRECTORIES = [
  "app",
  "src",
  "config",
  "db",
  "docs",
  "scripts",
  "tests",
  "src-tauri",
  "models",
  "workspace",
] as const;

const REQUIRED_CONFIG_FILES = [
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "vitest.config.ts",
  "config/room/default-room.yaml",
  "config/models/registry.yaml",
] as const;

const ENV_FILE_OPTIONS = [".env.local", ".env.example"] as const;

function checkPath(
  adapters: DoctorRuntimeAdapters,
  relativePath: string,
  pathKind: DoctorRuntimePathKind,
): boolean {
  return adapters.pathExists(
    DoctorRuntimePathRequestSchema.parse({
      relative_path: relativePath,
      path_kind: pathKind,
      metadata_only: true,
      read_only: true,
      mutation_enabled: false,
    }),
  );
}

function source(observedAt: string | null): DoctorResultSource {
  return DoctorResultSourceSchema.parse({
    contract_version: DOCTOR_RESULT_CONTRACT_VERSION,
    source_kind: "safe-local-runtime",
    source_registry_version: DOCTOR_CHECK_REGISTRY_VERSION,
    observed_at: observedAt,
    generated_at: null,
    deterministic_placeholder: false,
    metadata_only: true,
    read_only: true,
    filesystem_inspection_enabled: false,
    shell_execution_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    install_action_enabled: false,
    mutation_enabled: false,
  });
}

function observedPosture(check: DoctorCheck): DoctorObservedPosture {
  return DoctorObservedPostureSchema.parse({
    observation_status: "safe_local_runtime_observation",
    local_first: check.expected_posture.local_first,
    cloud_gated: check.expected_posture.cloud_gated,
    disabled_by_default: check.expected_posture.disabled_by_default,
    provider_disabled_by_default:
      check.expected_posture.provider_disabled_by_default,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    shell_execution_observed: false,
    filesystem_inspection_observed: false,
    process_spawn_observed: false,
    network_call_observed: false,
    provider_call_observed: false,
    install_action_observed: false,
    mutation_observed: false,
  });
}

function remediationHint(
  check: DoctorCheck,
  status: DoctorCheckStatus,
  summary: string,
): DoctorRemediationHint {
  return DoctorRemediationHintSchema.parse({
    hint_id: `doctor-remediation:${check.check_id}`,
    summary,
    manual_action_required:
      status === "failed" && check.required && check.severity === "blocking",
    automation_available: false,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    shell_instruction_included: false,
    install_instruction_included: false,
    provider_instruction_included: false,
  });
}

function runtimeResult(
  check: DoctorCheck,
  status: DoctorCheckStatus,
  observedAt: string | null,
  summary: string,
): DoctorCheckResult {
  return DoctorCheckResultSchema.parse({
    check_id: check.check_id,
    status,
    severity: check.severity,
    category: check.category,
    expected_posture: check.expected_posture,
    observed_posture: observedPosture(check),
    remediation_hint: remediationHint(check, status, summary),
    blocking: check.required && check.severity === "blocking",
    local_first: check.expected_posture.local_first,
    cloud_gated: check.expected_posture.cloud_gated,
    disabled_by_default: check.expected_posture.disabled_by_default,
    provider_disabled_by_default:
      check.expected_posture.provider_disabled_by_default,
    source: source(observedAt),
    metadata_only: true,
    read_only: true,
    deterministic: true,
    check_executed: status !== "skipped",
    filesystem_inspection_enabled: false,
    shell_execution_enabled: false,
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

function unsupportedResult(
  check: DoctorCheck,
  observedAt: string | null,
): DoctorCheckResult {
  return runtimeResult(
    check,
    "skipped",
    observedAt,
    "Phase 20B.6 safe local runtime does not evaluate this check yet; no provider, runtime, network, install, or mutation behavior was attempted.",
  );
}

function majorVersion(versionLabel: string | null | undefined): number | null {
  const match = versionLabel?.match(/^v?(\d+)/);

  return match ? Number(match[1]) : null;
}

function evaluateNodeVersion(
  check: DoctorCheck,
  options: DoctorRuntimeOptions,
  observedAt: string | null,
): DoctorCheckResult {
  const version = options.adapters.nodeVersion?.() ?? null;
  const major = majorVersion(version);

  if (major === null) {
    return runtimeResult(
      check,
      "skipped",
      observedAt,
      "Node.js version was not supplied by the injected adapter; no process or shell probing was attempted.",
    );
  }

  if (major >= 20) {
    return runtimeResult(
      check,
      "passed",
      observedAt,
      "Injected Node.js version satisfies the supported major version expectation.",
    );
  }

  return runtimeResult(
    check,
    "failed",
    observedAt,
    "Injected Node.js version is below the supported major version expectation.",
  );
}

function evaluatePackageManager(
  check: DoctorCheck,
  options: DoctorRuntimeOptions,
  observedAt: string | null,
): DoctorCheckResult {
  const probe = options.adapters.packageManagerVersionProbe;

  if (!probe) {
    return runtimeResult(
      check,
      "skipped",
      observedAt,
      "Package manager availability was not supplied by an injected bounded read-only version probe.",
    );
  }

  const result = DoctorRuntimeVersionProbeResultSchema.parse(
    probe(
      DoctorRuntimeVersionProbeRequestSchema.parse({
        probe_id: "package-manager-availability",
        package_manager_ids: ["pnpm", "npm"],
        timeout_ms: 1000,
        metadata_only: true,
        read_only: true,
        bounded: true,
        shell_execution_enabled: false,
        network_call_enabled: false,
        provider_call_enabled: false,
        install_action_enabled: false,
        mutation_enabled: false,
      }),
    ),
  );

  return runtimeResult(
    check,
    result.available ? "passed" : "failed",
    observedAt,
    result.available
      ? "Injected bounded read-only version probe reported an available package manager."
      : "Injected bounded read-only version probe did not report an available package manager.",
  );
}

function evaluatePlatform(
  check: DoctorCheck,
  options: DoctorRuntimeOptions,
  observedAt: string | null,
): DoctorCheckResult {
  const platform = options.adapters.platform?.() ?? null;

  if (!platform) {
    return runtimeResult(
      check,
      "skipped",
      observedAt,
      "Platform was not supplied by the injected adapter; no process probing was attempted.",
    );
  }

  if (platform === "darwin" || platform === "linux") {
    return runtimeResult(
      check,
      "passed",
      observedAt,
      "Injected platform is within the supported local-first bootstrap targets.",
    );
  }

  return runtimeResult(
    check,
    "failed",
    observedAt,
    "Injected platform is outside the supported local-first bootstrap targets.",
  );
}

function evaluateRequiredDirectories(
  check: DoctorCheck,
  options: DoctorRuntimeOptions,
  observedAt: string | null,
): DoctorCheckResult {
  const missing = REQUIRED_DIRECTORIES.filter(
    (directory) => !checkPath(options.adapters, directory, "directory"),
  );

  return runtimeResult(
    check,
    missing.length === 0 ? "passed" : "failed",
    observedAt,
    missing.length === 0
      ? "Injected filesystem adapter reported all required project directories present."
      : "Injected filesystem adapter reported one or more required project directories missing.",
  );
}

function evaluateRequiredConfigFiles(
  check: DoctorCheck,
  options: DoctorRuntimeOptions,
  observedAt: string | null,
): DoctorCheckResult {
  const missing = REQUIRED_CONFIG_FILES.filter(
    (file) => !checkPath(options.adapters, file, "file"),
  );

  return runtimeResult(
    check,
    missing.length === 0 ? "passed" : "failed",
    observedAt,
    missing.length === 0
      ? "Injected filesystem adapter reported required config files, including package.json and tsconfig.json, present."
      : "Injected filesystem adapter reported one or more required config files missing.",
  );
}

function evaluateEnvFile(
  check: DoctorCheck,
  options: DoctorRuntimeOptions,
  observedAt: string | null,
): DoctorCheckResult {
  const present = ENV_FILE_OPTIONS.some((file) =>
    checkPath(options.adapters, file, "file"),
  );

  return runtimeResult(
    check,
    present ? "passed" : "failed",
    observedAt,
    present
      ? "Injected filesystem adapter reported a required env file or example present."
      : "Injected filesystem adapter did not report .env.local or .env.example present.",
  );
}

function evaluateCheck(
  check: DoctorCheck,
  options: DoctorRuntimeOptions,
  observedAt: string | null,
): DoctorCheckResult {
  if (check.check_id === "doctor-check:node-version") {
    return evaluateNodeVersion(check, options, observedAt);
  }

  if (check.check_id === "doctor-check:package-manager-availability") {
    return evaluatePackageManager(check, options, observedAt);
  }

  if (check.check_id === "doctor-check:platform-support") {
    return evaluatePlatform(check, options, observedAt);
  }

  if (check.check_id === "doctor-check:required-project-directories") {
    return evaluateRequiredDirectories(check, options, observedAt);
  }

  if (check.check_id === "doctor-check:required-config-files") {
    return evaluateRequiredConfigFiles(check, options, observedAt);
  }

  if (check.check_id === "doctor-check:required-env-file-example") {
    return evaluateEnvFile(check, options, observedAt);
  }

  return unsupportedResult(check, observedAt);
}

export function runSafeLocalDoctorRuntime(
  options: DoctorRuntimeOptions,
): DoctorRuntimeEvaluation {
  const observedAt = options.observed_at ?? null;
  const results = getDoctorCheckRegistry().checks.map((check) =>
    evaluateCheck(check, options, observedAt),
  );
  const report: DoctorReport = buildDoctorReportFromResults(results);
  const hardwareProfile = options.hardwareProfile ?? FALLBACK_HARDWARE_PROFILE;
  const localModelFit: ModelHardwareFitReport = evaluateLocalModelHardwareFit(
    options.modelRegistryEntries ?? [],
    hardwareProfile,
  );
  const modelRegistryStaleness: ModelRegistryStalenessReport =
    evaluateModelRegistryStaleness(
      options.modelRegistryEntries ?? [],
      options.modelRegistryNow ?? "1970-01-01",
    );

  return DoctorRuntimeEvaluationSchema.parse({
    runtime_version: DOCTOR_RUNTIME_VERSION,
    source_registry_version: DOCTOR_CHECK_REGISTRY_VERSION,
    result_contract_version: DOCTOR_RESULT_CONTRACT_VERSION,
    report_contract_version: DOCTOR_REPORT_CONTRACT_VERSION,
    supported_check_ids: [...SAFE_LOCAL_RUNTIME_SUPPORTED_CHECK_IDS],
    results,
    report,
    hardware_profile: hardwareProfile,
    local_model_fit: localModelFit,
    model_registry_staleness: modelRegistryStaleness,
    observed_at: observedAt,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    safe_local_runtime_only: true,
    real_environment_inspection_limited: true,
    installation_enabled: false,
    auto_fix_enabled: false,
    filesystem_mutation_enabled: false,
    shell_execution_enabled: false,
    process_spawn_enabled: false,
    network_call_enabled: false,
    provider_call_enabled: false,
    ollama_call_enabled: false,
    tauri_execution_enabled: false,
    voice_runtime_execution_enabled: false,
    vision_runtime_execution_enabled: false,
    approval_bypass_created: false,
    ui_route_created: false,
    authority_surface_created: false,
    capability_created: false,
    raw_payload_included: false,
  });
}
