import { z } from "zod";

import {
  RED_TEAM_FORBIDDEN_ACTION_CLASSES,
  RED_TEAM_FORBIDDEN_TARGET_SCOPES,
  RED_TEAM_SUPPORTED_ACTION_CLASSES,
  RED_TEAM_SUPPORTED_TARGET_SCOPES,
  getRedTeamSandboxProfile,
} from "./contracts";
import {
  CAI_ADAPTER_MODES,
  CaiAdapterModeSchema,
} from "./cai-adapter-contract";

export const CAI_PROVIDER_MANIFEST_VERSION = "19D.7" as const;

export const CAI_PROVIDER_INSTALL_STATES = [
  "not_installed",
  "installation_reserved",
  "installed_disabled",
] as const;

export const CAI_PROVIDER_EXECUTION_STATES = [
  "disabled",
  "mock_metadata_only",
  "dry_run_metadata_only",
  "reserved_disabled",
] as const;

export const CAI_PROVIDER_READINESS_CHECK_IDS = [
  "cai_package_declared_not_installed",
  "python_sidecar_disabled",
  "execution_disabled",
  "subprocess_disabled",
  "network_scanning_disabled",
  "external_targets_disabled",
  "approval_metadata_required",
  "dry_run_required",
  "sandbox_profile_required",
] as const;

export const CAI_PROVIDER_DISABLED_CAPABILITIES = [
  "CAI installation",
  "CAI import",
  "CAI execution",
  "Python sidecar",
  "subprocess launch",
  "process spawn",
  "command execution",
  "network scanning",
  "external target access",
  "filesystem reads",
  "database reads",
  "repo mutation",
  "approval decisions",
  "authority token creation",
  "Phase 18 bypass",
] as const;

export type CaiProviderInstallState =
  (typeof CAI_PROVIDER_INSTALL_STATES)[number];
export type CaiProviderExecutionState =
  (typeof CAI_PROVIDER_EXECUTION_STATES)[number];
export type CaiProviderReadinessCheckId =
  (typeof CAI_PROVIDER_READINESS_CHECK_IDS)[number];

export const CaiProviderInstallStateSchema = z.enum(
  CAI_PROVIDER_INSTALL_STATES,
);
export const CaiProviderExecutionStateSchema = z.enum(
  CAI_PROVIDER_EXECUTION_STATES,
);
export const CaiProviderReadinessCheckIdSchema = z.enum(
  CAI_PROVIDER_READINESS_CHECK_IDS,
);

export const CaiProviderPackageRequirementSchema = z.strictObject({
  package_id: z.literal("cai-provider-package:cai"),
  package_name: z.literal("cai"),
  package_kind: z.literal("future_optional_provider"),
  install_state: z.literal("not_installed"),
  import_enabled: z.literal(false),
  package_call_enabled: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const CaiProviderRuntimeRequirementSchema = z.strictObject({
  runtime_id: z.literal("cai-provider-runtime:python-sidecar"),
  runtime_kind: z.literal("python_sidecar_reserved"),
  execution_state: z.literal("disabled"),
  python_sidecar_enabled: z.literal(false),
  subprocess_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const CaiProviderManifestSchema = z.strictObject({
  manifest_id: z.literal("cai-provider-manifest:phase-19d"),
  manifest_version: z.literal(CAI_PROVIDER_MANIFEST_VERSION),
  provider_id: z.literal("provider:cai"),
  provider_name: z.literal("CAI Red-Team Provider"),
  provider_kind: z.literal("cai"),
  install_state: z.literal("not_installed"),
  execution_state: z.literal("disabled"),
  supported_adapter_modes: z.array(CaiAdapterModeSchema),
  required_sandbox_profile_id: z.literal(
    "red-team-profile:phase-19d-local-sandbox",
  ),
  package_requirement: CaiProviderPackageRequirementSchema,
  runtime_requirement: CaiProviderRuntimeRequirementSchema,
  allowed_target_scopes: z.array(z.enum(RED_TEAM_SUPPORTED_TARGET_SCOPES)),
  allowed_action_classes: z.array(z.enum(RED_TEAM_SUPPORTED_ACTION_CLASSES)),
  forbidden_target_scopes: z.array(z.enum(RED_TEAM_FORBIDDEN_TARGET_SCOPES)),
  forbidden_action_classes: z.array(z.enum(RED_TEAM_FORBIDDEN_ACTION_CLASSES)),
  approval_required: z.literal(true),
  dry_run_required: z.literal(true),
  localhost_only_required: z.literal(true),
  audit_required: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  cai_imported: z.literal(false),
  cai_called: z.literal(false),
  cai_installed: z.literal(false),
  execution_enabled: z.literal(false),
  subprocess_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
});

export const CaiProviderReadinessCheckSchema = z.strictObject({
  check_id: CaiProviderReadinessCheckIdSchema,
  label: z.string().trim().min(1).max(180),
  passed: z.boolean(),
  install_state: CaiProviderInstallStateSchema,
  execution_state: CaiProviderExecutionStateSchema,
  disabled_capability: z.enum(CAI_PROVIDER_DISABLED_CAPABILITIES).nullable(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const CaiProviderReadinessReportSchema = z.strictObject({
  report_id: z.literal("cai-provider-readiness:phase-19d"),
  manifest_version: z.literal(CAI_PROVIDER_MANIFEST_VERSION),
  provider_id: z.literal("provider:cai"),
  install_state: z.literal("not_installed"),
  execution_state: z.literal("disabled"),
  ready_for_installation: z.literal(false),
  executable: z.literal(false),
  checks: z.array(CaiProviderReadinessCheckSchema),
  disabled_capabilities: z.array(z.enum(CAI_PROVIDER_DISABLED_CAPABILITIES)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  cai_imported: z.literal(false),
  cai_called: z.literal(false),
  cai_installed: z.literal(false),
  python_sidecar_created: z.literal(false),
  subprocess_spawned: z.literal(false),
  command_executed: z.literal(false),
  network_scan_performed: z.literal(false),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  approval_decision_created: z.literal(false),
  authority_token_created: z.literal(false),
  phase_18_bypass_enabled: z.literal(false),
});

export type CaiProviderPackageRequirement = z.infer<
  typeof CaiProviderPackageRequirementSchema
>;
export type CaiProviderRuntimeRequirement = z.infer<
  typeof CaiProviderRuntimeRequirementSchema
>;
export type CaiProviderManifest = z.infer<typeof CaiProviderManifestSchema>;
export type CaiProviderReadinessCheck = z.infer<
  typeof CaiProviderReadinessCheckSchema
>;
export type CaiProviderReadinessReport = z.infer<
  typeof CaiProviderReadinessReportSchema
>;

const CAI_PROVIDER_PACKAGE_REQUIREMENT =
  CaiProviderPackageRequirementSchema.parse({
    package_id: "cai-provider-package:cai",
    package_name: "cai",
    package_kind: "future_optional_provider",
    install_state: "not_installed",
    import_enabled: false,
    package_call_enabled: false,
    metadata_only: true,
    read_only: true,
  });

const CAI_PROVIDER_RUNTIME_REQUIREMENT =
  CaiProviderRuntimeRequirementSchema.parse({
    runtime_id: "cai-provider-runtime:python-sidecar",
    runtime_kind: "python_sidecar_reserved",
    execution_state: "disabled",
    python_sidecar_enabled: false,
    subprocess_enabled: false,
    process_spawn_enabled: false,
    command_execution_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
    metadata_only: true,
    read_only: true,
  });

function copy<T>(schema: z.ZodType<T>, value: T): T {
  return schema.parse(JSON.parse(JSON.stringify(value)));
}

function readinessCheck(input: {
  readonly check_id: CaiProviderReadinessCheckId;
  readonly label: string;
  readonly disabled_capability:
    | (typeof CAI_PROVIDER_DISABLED_CAPABILITIES)[number]
    | null;
}): CaiProviderReadinessCheck {
  return CaiProviderReadinessCheckSchema.parse({
    check_id: input.check_id,
    label: input.label,
    passed: true,
    install_state: "not_installed",
    execution_state: "disabled",
    disabled_capability: input.disabled_capability,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  });
}

export function getCaiProviderManifest(): CaiProviderManifest {
  return CaiProviderManifestSchema.parse({
    manifest_id: "cai-provider-manifest:phase-19d",
    manifest_version: CAI_PROVIDER_MANIFEST_VERSION,
    provider_id: "provider:cai",
    provider_name: "CAI Red-Team Provider",
    provider_kind: "cai",
    install_state: "not_installed",
    execution_state: "disabled",
    supported_adapter_modes: [...CAI_ADAPTER_MODES],
    required_sandbox_profile_id: getRedTeamSandboxProfile().profile_id,
    package_requirement: copy(
      CaiProviderPackageRequirementSchema,
      CAI_PROVIDER_PACKAGE_REQUIREMENT,
    ),
    runtime_requirement: copy(
      CaiProviderRuntimeRequirementSchema,
      CAI_PROVIDER_RUNTIME_REQUIREMENT,
    ),
    allowed_target_scopes: [...RED_TEAM_SUPPORTED_TARGET_SCOPES],
    allowed_action_classes: [...RED_TEAM_SUPPORTED_ACTION_CLASSES],
    forbidden_target_scopes: [...RED_TEAM_FORBIDDEN_TARGET_SCOPES],
    forbidden_action_classes: [...RED_TEAM_FORBIDDEN_ACTION_CLASSES],
    approval_required: true,
    dry_run_required: true,
    localhost_only_required: true,
    audit_required: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    cai_imported: false,
    cai_called: false,
    cai_installed: false,
    execution_enabled: false,
    subprocess_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
  });
}

export function buildCaiProviderReadinessReport(): CaiProviderReadinessReport {
  const checks = [
    readinessCheck({
      check_id: "cai_package_declared_not_installed",
      label: "CAI package is declared as a future provider and not installed.",
      disabled_capability: "CAI installation",
    }),
    readinessCheck({
      check_id: "python_sidecar_disabled",
      label: "Python sidecar remains disabled.",
      disabled_capability: "Python sidecar",
    }),
    readinessCheck({
      check_id: "execution_disabled",
      label: "CAI execution remains disabled.",
      disabled_capability: "CAI execution",
    }),
    readinessCheck({
      check_id: "subprocess_disabled",
      label: "Subprocess launch remains disabled.",
      disabled_capability: "subprocess launch",
    }),
    readinessCheck({
      check_id: "network_scanning_disabled",
      label: "Network scanning remains disabled.",
      disabled_capability: "network scanning",
    }),
    readinessCheck({
      check_id: "external_targets_disabled",
      label: "External targets remain disabled.",
      disabled_capability: "external target access",
    }),
    readinessCheck({
      check_id: "approval_metadata_required",
      label: "Phase 18 approval metadata remains required.",
      disabled_capability: null,
    }),
    readinessCheck({
      check_id: "dry_run_required",
      label: "Dry-run metadata remains required.",
      disabled_capability: null,
    }),
    readinessCheck({
      check_id: "sandbox_profile_required",
      label: "Phase 19D sandbox profile remains required.",
      disabled_capability: null,
    }),
  ];

  return CaiProviderReadinessReportSchema.parse({
    report_id: "cai-provider-readiness:phase-19d",
    manifest_version: CAI_PROVIDER_MANIFEST_VERSION,
    provider_id: "provider:cai",
    install_state: "not_installed",
    execution_state: "disabled",
    ready_for_installation: false,
    executable: false,
    checks,
    disabled_capabilities: [...CAI_PROVIDER_DISABLED_CAPABILITIES],
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    cai_imported: false,
    cai_called: false,
    cai_installed: false,
    python_sidecar_created: false,
    subprocess_spawned: false,
    command_executed: false,
    network_scan_performed: false,
    filesystem_read: false,
    database_read: false,
    approval_decision_created: false,
    authority_token_created: false,
    phase_18_bypass_enabled: false,
  });
}

export function assertCaiProviderNotExecutable(): void {
  const manifest = getCaiProviderManifest();
  const report = buildCaiProviderReadinessReport();
  const executable =
    manifest.install_state !== "not_installed" ||
    manifest.execution_state !== "disabled" ||
    manifest.cai_imported ||
    manifest.cai_called ||
    manifest.cai_installed ||
    manifest.execution_enabled ||
    manifest.subprocess_enabled ||
    manifest.network_scan_enabled ||
    manifest.filesystem_read_enabled ||
    report.executable ||
    report.cai_imported ||
    report.cai_called ||
    report.cai_installed ||
    report.python_sidecar_created ||
    report.subprocess_spawned ||
    report.command_executed ||
    report.network_scan_performed ||
    report.filesystem_read ||
    report.database_read ||
    report.approval_decision_created ||
    report.authority_token_created ||
    report.phase_18_bypass_enabled;

  if (executable) {
    throw new Error("CAI provider manifest became executable");
  }
}

export function listCaiProviderDisabledCapabilities(): readonly string[] {
  return [...CAI_PROVIDER_DISABLED_CAPABILITIES];
}
