import { z } from "zod";

import { getRedTeamSandboxProfile } from "./contracts";
import { getDefaultCaiAdapterHealth } from "./cai-adapter-contract";
import { getCaiProviderManifest } from "./cai-provider-manifest";

export const CAI_LOCALHOST_EXECUTION_GATE_VERSION = "19D.10" as const;

export const CAI_LOCALHOST_EXECUTION_MODES = [
  "disabled",
  "mock_dry_run_only",
  "localhost_execution_reserved",
] as const;

export const CAI_LOCALHOST_EXECUTION_VERDICTS = ["blocked"] as const;

export const CAI_LOCALHOST_EXECUTION_PREREQUISITE_IDS = [
  "cai_installed",
  "cai_adapter_enabled",
  "sandbox_profile_selected",
  "localhost_only_target",
  "allowed_action_class",
  "dry_run_completed",
  "phase_18_approval_decision_exists",
  "one_action_authority_token_exists",
  "audit_preview_generated",
  "execution_timeout_configured",
  "network_egress_blocked_except_localhost",
  "result_verification_configured",
] as const;

export const CAI_LOCALHOST_EXECUTION_BLOCKER_IDS = [
  "cai_not_installed",
  "execution_disabled",
  "no_real_approval_decision",
  "no_authority_token",
  "no_sidecar",
  "no_subprocess",
  "network_scan_disabled",
] as const;

export const CAI_LOCALHOST_EXECUTION_DISABLED_CAPABILITIES = [
  "real execution",
  "CAI execution",
  "CAI installation",
  "CAI import",
  "CAI sidecar",
  "Python sidecar",
  "subprocess launch",
  "process spawn",
  "command execution",
  "network scan",
  "external targets",
  "filesystem reads",
  "database reads",
  "repo mutation",
  "approval decision creation",
  "authority token creation",
  "Phase 18 bypass",
] as const;

export type CaiLocalhostExecutionMode =
  (typeof CAI_LOCALHOST_EXECUTION_MODES)[number];
export type CaiLocalhostExecutionVerdict =
  (typeof CAI_LOCALHOST_EXECUTION_VERDICTS)[number];
export type CaiLocalhostExecutionPrerequisiteId =
  (typeof CAI_LOCALHOST_EXECUTION_PREREQUISITE_IDS)[number];
export type CaiLocalhostExecutionBlockerId =
  (typeof CAI_LOCALHOST_EXECUTION_BLOCKER_IDS)[number];
export type CaiLocalhostExecutionDisabledCapability =
  (typeof CAI_LOCALHOST_EXECUTION_DISABLED_CAPABILITIES)[number];

export const CaiLocalhostExecutionModeSchema = z.enum(
  CAI_LOCALHOST_EXECUTION_MODES,
);
export const CaiLocalhostExecutionVerdictSchema = z.enum(
  CAI_LOCALHOST_EXECUTION_VERDICTS,
);
export const CaiLocalhostExecutionPrerequisiteIdSchema = z.enum(
  CAI_LOCALHOST_EXECUTION_PREREQUISITE_IDS,
);
export const CaiLocalhostExecutionBlockerIdSchema = z.enum(
  CAI_LOCALHOST_EXECUTION_BLOCKER_IDS,
);
export const CaiLocalhostExecutionDisabledCapabilitySchema = z.enum(
  CAI_LOCALHOST_EXECUTION_DISABLED_CAPABILITIES,
);

export const CaiLocalhostExecutionPrerequisiteSchema = z.strictObject({
  prerequisite_id: CaiLocalhostExecutionPrerequisiteIdSchema,
  label: z.string().trim().min(1).max(180),
  required: z.literal(true),
  modeled: z.literal(true),
  satisfied: z.boolean(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const CaiLocalhostExecutionBlockerSchema = z.strictObject({
  blocker_id: CaiLocalhostExecutionBlockerIdSchema,
  label: z.string().trim().min(1).max(180),
  blocking: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const CaiLocalhostExecutionGateSchema = z.strictObject({
  gate_id: z.literal("cai-localhost-execution-gate:phase-19d"),
  gate_version: z.literal(CAI_LOCALHOST_EXECUTION_GATE_VERSION),
  mode: CaiLocalhostExecutionModeSchema,
  verdict: CaiLocalhostExecutionVerdictSchema,
  localhost_only_required: z.literal(true),
  approval_decision_required: z.literal(true),
  one_action_authority_token_required: z.literal(true),
  dry_run_required: z.literal(true),
  audit_preview_required: z.literal(true),
  result_verification_required: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  execution_enabled: z.literal(false),
  cai_execution_enabled: z.literal(false),
  subprocess_launch_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
  approval_decision_created: z.literal(false),
  authority_token_created: z.literal(false),
  python_sidecar_created: z.literal(false),
});

export const CaiLocalhostExecutionReadinessReportSchema = z.strictObject({
  report_id: z.literal("cai-localhost-execution-readiness:phase-19d"),
  report_version: z.literal(CAI_LOCALHOST_EXECUTION_GATE_VERSION),
  gate: CaiLocalhostExecutionGateSchema,
  prerequisites: z.array(CaiLocalhostExecutionPrerequisiteSchema),
  blockers: z.array(CaiLocalhostExecutionBlockerSchema),
  disabled_capabilities: z.array(CaiLocalhostExecutionDisabledCapabilitySchema),
  sandbox_profile_id: z.literal("red-team-profile:phase-19d-local-sandbox"),
  provider_install_state: z.literal("not_installed"),
  provider_execution_state: z.literal("disabled"),
  adapter_mode: z.literal("disabled"),
  verdict: CaiLocalhostExecutionVerdictSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  raw_value_included: z.literal(false),
  cai_installed: z.literal(false),
  cai_imported: z.literal(false),
  cai_called: z.literal(false),
  execution_enabled: z.literal(false),
  subprocess_launch_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  external_targets_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
  approval_decision_exists: z.literal(false),
  authority_token_exists: z.literal(false),
  python_sidecar_exists: z.literal(false),
  phase_18_bypass_enabled: z.literal(false),
});

export type CaiLocalhostExecutionPrerequisite = z.infer<
  typeof CaiLocalhostExecutionPrerequisiteSchema
>;
export type CaiLocalhostExecutionBlocker = z.infer<
  typeof CaiLocalhostExecutionBlockerSchema
>;
export type CaiLocalhostExecutionGate = z.infer<
  typeof CaiLocalhostExecutionGateSchema
>;
export type CaiLocalhostExecutionReadinessReport = z.infer<
  typeof CaiLocalhostExecutionReadinessReportSchema
>;

export function buildCaiLocalhostExecutionReadinessReport(): CaiLocalhostExecutionReadinessReport {
  const manifest = getCaiProviderManifest();
  const adapterHealth = getDefaultCaiAdapterHealth();
  const profile = getRedTeamSandboxProfile();

  return CaiLocalhostExecutionReadinessReportSchema.parse({
    report_id: "cai-localhost-execution-readiness:phase-19d",
    report_version: CAI_LOCALHOST_EXECUTION_GATE_VERSION,
    gate: buildCaiLocalhostExecutionGate(),
    prerequisites: listCaiLocalhostExecutionPrerequisites(),
    blockers: listCaiLocalhostExecutionBlockers(),
    disabled_capabilities: listCaiLocalhostExecutionDisabledCapabilities(),
    sandbox_profile_id: profile.profile_id,
    provider_install_state: manifest.install_state,
    provider_execution_state: manifest.execution_state,
    adapter_mode: adapterHealth.mode,
    verdict: "blocked",
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    raw_value_included: false,
    cai_installed: false,
    cai_imported: false,
    cai_called: false,
    execution_enabled: false,
    subprocess_launch_enabled: false,
    process_spawn_enabled: false,
    command_execution_enabled: false,
    network_scan_enabled: false,
    external_targets_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
    approval_decision_exists: false,
    authority_token_exists: false,
    python_sidecar_exists: false,
    phase_18_bypass_enabled: false,
  });
}

export function assertCaiLocalhostExecutionBlocked(): void {
  const report = buildCaiLocalhostExecutionReadinessReport();
  const unsafe =
    report.verdict !== "blocked" ||
    report.gate.mode === "localhost_execution_reserved" ||
    report.gate.execution_enabled ||
    report.gate.cai_execution_enabled ||
    report.cai_installed ||
    report.cai_imported ||
    report.cai_called ||
    report.execution_enabled ||
    report.approval_decision_exists ||
    report.authority_token_exists ||
    report.python_sidecar_exists ||
    report.subprocess_launch_enabled ||
    report.process_spawn_enabled ||
    report.network_scan_enabled ||
    report.external_targets_enabled ||
    report.filesystem_read_enabled ||
    report.database_read_enabled ||
    report.phase_18_bypass_enabled;

  if (unsafe) {
    throw new Error("CAI localhost execution gate became executable");
  }
}

export function listCaiLocalhostExecutionPrerequisites(): readonly CaiLocalhostExecutionPrerequisite[] {
  return [
    prerequisite({
      prerequisite_id: "cai_installed",
      label: "CAI provider package is installed.",
      satisfied: false,
    }),
    prerequisite({
      prerequisite_id: "cai_adapter_enabled",
      label: "CAI adapter is enabled for localhost execution.",
      satisfied: false,
    }),
    prerequisite({
      prerequisite_id: "sandbox_profile_selected",
      label: "Phase 19D sandbox profile is selected.",
      satisfied: true,
    }),
    prerequisite({
      prerequisite_id: "localhost_only_target",
      label: "Target is constrained to localhost only.",
      satisfied: true,
    }),
    prerequisite({
      prerequisite_id: "allowed_action_class",
      label: "Action class is whitelisted by the sandbox profile.",
      satisfied: true,
    }),
    prerequisite({
      prerequisite_id: "dry_run_completed",
      label: "Dry-run metadata is completed before execution.",
      satisfied: false,
    }),
    prerequisite({
      prerequisite_id: "phase_18_approval_decision_exists",
      label: "A real Phase 18 approval decision exists.",
      satisfied: false,
    }),
    prerequisite({
      prerequisite_id: "one_action_authority_token_exists",
      label: "A single-action authority token exists.",
      satisfied: false,
    }),
    prerequisite({
      prerequisite_id: "audit_preview_generated",
      label: "Metadata-only audit preview is generated.",
      satisfied: true,
    }),
    prerequisite({
      prerequisite_id: "execution_timeout_configured",
      label: "Execution timeout is configured.",
      satisfied: false,
    }),
    prerequisite({
      prerequisite_id: "network_egress_blocked_except_localhost",
      label: "Network egress is blocked except localhost.",
      satisfied: false,
    }),
    prerequisite({
      prerequisite_id: "result_verification_configured",
      label: "Result verification metadata is configured.",
      satisfied: false,
    }),
  ];
}

export function listCaiLocalhostExecutionBlockers(): readonly CaiLocalhostExecutionBlocker[] {
  return [
    blocker({
      blocker_id: "cai_not_installed",
      label: "CAI is not installed.",
    }),
    blocker({
      blocker_id: "execution_disabled",
      label: "CAI execution remains disabled.",
    }),
    blocker({
      blocker_id: "no_real_approval_decision",
      label: "No real Phase 18 approval decision exists.",
    }),
    blocker({
      blocker_id: "no_authority_token",
      label: "No one-action authority token exists.",
    }),
    blocker({
      blocker_id: "no_sidecar",
      label: "No Python sidecar exists.",
    }),
    blocker({
      blocker_id: "no_subprocess",
      label: "Subprocess launch remains disabled.",
    }),
    blocker({
      blocker_id: "network_scan_disabled",
      label: "Network scanning remains disabled.",
    }),
  ];
}

export function listCaiLocalhostExecutionDisabledCapabilities(): readonly CaiLocalhostExecutionDisabledCapability[] {
  return [...CAI_LOCALHOST_EXECUTION_DISABLED_CAPABILITIES];
}

function buildCaiLocalhostExecutionGate(): CaiLocalhostExecutionGate {
  return CaiLocalhostExecutionGateSchema.parse({
    gate_id: "cai-localhost-execution-gate:phase-19d",
    gate_version: CAI_LOCALHOST_EXECUTION_GATE_VERSION,
    mode: "disabled",
    verdict: "blocked",
    localhost_only_required: true,
    approval_decision_required: true,
    one_action_authority_token_required: true,
    dry_run_required: true,
    audit_preview_required: true,
    result_verification_required: true,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    execution_enabled: false,
    cai_execution_enabled: false,
    subprocess_launch_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
    approval_decision_created: false,
    authority_token_created: false,
    python_sidecar_created: false,
  });
}

function prerequisite(input: {
  readonly prerequisite_id: CaiLocalhostExecutionPrerequisiteId;
  readonly label: string;
  readonly satisfied: boolean;
}): CaiLocalhostExecutionPrerequisite {
  return CaiLocalhostExecutionPrerequisiteSchema.parse({
    ...input,
    required: true,
    modeled: true,
    metadata_only: true,
    read_only: true,
  });
}

function blocker(input: {
  readonly blocker_id: CaiLocalhostExecutionBlockerId;
  readonly label: string;
}): CaiLocalhostExecutionBlocker {
  return CaiLocalhostExecutionBlockerSchema.parse({
    ...input,
    blocking: true,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  });
}
