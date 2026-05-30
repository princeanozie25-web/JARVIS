import { z } from "zod";

import {
  RedTeamAuditPreviewSchema,
  RedTeamRunPlanSchema,
  RedTeamRunProposalSchema,
  buildRedTeamAuditPreview,
  buildRedTeamRunPlan,
  validateRedTeamRunPlan,
  validateRedTeamRunProposal,
  type RedTeamAuditPreview,
  type RedTeamRunProposal,
  type RedTeamSandboxValidationResult,
} from "./contracts";
import { scanRedTeamSandboxSafety } from "./safety-guard";

export const CAI_ADAPTER_CONTRACT_VERSION = "19D.6" as const;

export const CAI_ADAPTER_MODES = [
  "disabled",
  "mock",
  "dry_run_only",
  "localhost_only_reserved",
] as const;

export const CAI_ADAPTER_CAPABILITIES = [
  "metadata_health",
  "capability_description",
  "sandbox_validation",
  "dry_run_metadata",
  "audit_envelope_metadata",
] as const;

export const CAI_ADAPTER_HEALTH_STATES = [
  "disabled_metadata_only",
  "mock_metadata_ready",
  "dry_run_metadata_only",
  "reserved_metadata_only",
  "invalid_metadata",
] as const;

export const CAI_ADAPTER_DISABLED_REASONS = [
  "cai_not_installed",
  "cai_execution_disabled",
  "python_sidecar_disabled",
  "subprocess_launch_disabled",
  "network_scan_disabled",
  "filesystem_read_disabled",
  "database_read_disabled",
  "phase_18_approval_required",
  "unsafe_proposal_rejected",
  "metadata_only_contract",
] as const;

export const CaiAdapterModeSchema = z.enum(CAI_ADAPTER_MODES);
export const CaiAdapterCapabilitySchema = z.enum(CAI_ADAPTER_CAPABILITIES);
export const CaiAdapterHealthStateSchema = z.enum(CAI_ADAPTER_HEALTH_STATES);
export const CaiAdapterDisabledReasonSchema = z.enum(
  CAI_ADAPTER_DISABLED_REASONS,
);

export const CaiAdapterDisabledCapabilityFlagsSchema = z.strictObject({
  cai_installed: z.literal(false),
  cai_called: z.literal(false),
  cai_execution_enabled: z.literal(false),
  python_sidecar_enabled: z.literal(false),
  subprocess_launch_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
  repo_mutation_enabled: z.literal(false),
  approval_decision_enabled: z.literal(false),
  authority_token_creation_enabled: z.literal(false),
  phase_18_bypass_enabled: z.literal(false),
});

export const CaiAdapterHealthSchema = z.strictObject({
  adapter_id: z.literal("cai-adapter:mock-metadata-only"),
  contract_version: z.literal(CAI_ADAPTER_CONTRACT_VERSION),
  mode: CaiAdapterModeSchema,
  health: CaiAdapterHealthStateSchema,
  disabled_reasons: z.array(CaiAdapterDisabledReasonSchema),
  capabilities: z.array(CaiAdapterCapabilitySchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  cai_installed: z.literal(false),
  cai_called: z.literal(false),
  execution_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  subprocess_launch_enabled: z.literal(false),
  python_sidecar_enabled: z.literal(false),
  raw_value_included: z.literal(false),
});

export const CaiAdapterCapabilityMetadataSchema = z.strictObject({
  capability: CaiAdapterCapabilitySchema,
  label: z.string().trim().min(1).max(160),
  mode: CaiAdapterModeSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  execution_enabled: z.literal(false),
  cai_call_enabled: z.literal(false),
  subprocess_launch_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
});

export const CaiAdapterRunRequestSchema = z.strictObject({
  request_id: z
    .string()
    .trim()
    .regex(/^cai-adapter-request:[a-z0-9._:-]+$/),
  mode: CaiAdapterModeSchema,
  proposal: RedTeamRunProposalSchema,
  requested_capability: CaiAdapterCapabilitySchema,
  dry_run_required: z.literal(true),
  approval_metadata_required: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  execution_enabled: z.literal(false),
  cai_call_enabled: z.literal(false),
  subprocess_launch_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
});

export const CaiAdapterAuditEnvelopeSchema = z.strictObject({
  envelope_id: z
    .string()
    .trim()
    .regex(/^cai-adapter-audit:[a-z0-9._:-]+$/),
  request_id: z
    .string()
    .trim()
    .regex(/^cai-adapter-request:[a-z0-9._:-]+$/),
  proposal_id: z
    .string()
    .trim()
    .regex(/^red-team-proposal:/),
  mode: CaiAdapterModeSchema,
  audit_preview: RedTeamAuditPreviewSchema,
  disabled_reasons: z.array(CaiAdapterDisabledReasonSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  redaction_safe: z.literal(true),
  deterministic: z.literal(true),
  raw_value_included: z.literal(false),
  cai_called: z.literal(false),
  execution_enabled: z.literal(false),
  subprocess_launch_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
});

export const CaiAdapterDryRunResultSchema = z.strictObject({
  result_id: z
    .string()
    .trim()
    .regex(/^cai-adapter-dry-run:[a-z0-9._:-]+$/),
  request_id: z
    .string()
    .trim()
    .regex(/^cai-adapter-request:[a-z0-9._:-]+$/),
  proposal_id: z
    .string()
    .trim()
    .regex(/^red-team-proposal:/),
  mode: CaiAdapterModeSchema,
  accepted: z.boolean(),
  verdict: z.enum(["metadata_dry_run_ready", "rejected"]),
  disabled_reasons: z.array(CaiAdapterDisabledReasonSchema),
  validation_result: z.custom<RedTeamSandboxValidationResult>(),
  plan_metadata: RedTeamRunPlanSchema.nullable(),
  audit_envelope: CaiAdapterAuditEnvelopeSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  redaction_safe: z.literal(true),
  deterministic: z.literal(true),
  raw_value_included: z.literal(false),
  cai_called: z.literal(false),
  execution_enabled: z.literal(false),
  subprocess_launch_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
});

export type CaiAdapterMode = (typeof CAI_ADAPTER_MODES)[number];
export type CaiAdapterCapability = (typeof CAI_ADAPTER_CAPABILITIES)[number];
export type CaiAdapterHealth = z.infer<typeof CaiAdapterHealthSchema>;
export type CaiAdapterRunRequest = z.infer<typeof CaiAdapterRunRequestSchema>;
export type CaiAdapterDryRunResult = z.infer<
  typeof CaiAdapterDryRunResultSchema
>;
export type CaiAdapterAuditEnvelope = z.infer<
  typeof CaiAdapterAuditEnvelopeSchema
>;
export type CaiAdapterDisabledReason =
  (typeof CAI_ADAPTER_DISABLED_REASONS)[number];
export type CaiAdapterCapabilityMetadata = z.infer<
  typeof CaiAdapterCapabilityMetadataSchema
>;

export interface CaiAdapter {
  readonly adapter_id: "cai-adapter:mock-metadata-only";
  readonly mode: CaiAdapterMode;
  readonly metadata_only: true;
  readonly read_only: true;
  health(): CaiAdapterHealth;
  describeCapabilities(): readonly CaiAdapterCapabilityMetadata[];
  buildDryRun(request: CaiAdapterRunRequest): CaiAdapterDryRunResult;
}

export const CAI_ADAPTER_DISABLED_CAPABILITY_FLAGS =
  CaiAdapterDisabledCapabilityFlagsSchema.parse({
    cai_installed: false,
    cai_called: false,
    cai_execution_enabled: false,
    python_sidecar_enabled: false,
    subprocess_launch_enabled: false,
    process_spawn_enabled: false,
    command_execution_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
    repo_mutation_enabled: false,
    approval_decision_enabled: false,
    authority_token_creation_enabled: false,
    phase_18_bypass_enabled: false,
  });

export function buildCaiAdapterRunRequest(input: {
  readonly request_id: string;
  readonly proposal: RedTeamRunProposal;
  readonly mode?: CaiAdapterMode;
  readonly requested_capability?: CaiAdapterCapability;
}): CaiAdapterRunRequest {
  return CaiAdapterRunRequestSchema.parse({
    request_id: input.request_id,
    mode: input.mode ?? "mock",
    proposal: input.proposal,
    requested_capability: input.requested_capability ?? "dry_run_metadata",
    dry_run_required: true,
    approval_metadata_required: true,
    metadata_only: true,
    read_only: true,
    execution_enabled: false,
    cai_call_enabled: false,
    subprocess_launch_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
  });
}

export function getDefaultCaiAdapterHealth(): CaiAdapterHealth {
  return healthForMode("disabled");
}

export function createMockCaiAdapter(): CaiAdapter {
  return {
    adapter_id: "cai-adapter:mock-metadata-only",
    mode: "mock",
    metadata_only: true,
    read_only: true,
    health: () => healthForMode("mock"),
    describeCapabilities: () => capabilityMetadata("mock"),
    buildDryRun: (request) => buildMockDryRunResult(request),
  };
}

function healthForMode(mode: CaiAdapterMode): CaiAdapterHealth {
  return CaiAdapterHealthSchema.parse({
    adapter_id: "cai-adapter:mock-metadata-only",
    contract_version: CAI_ADAPTER_CONTRACT_VERSION,
    mode,
    health:
      mode === "disabled"
        ? "disabled_metadata_only"
        : mode === "mock"
          ? "mock_metadata_ready"
          : mode === "dry_run_only"
            ? "dry_run_metadata_only"
            : "reserved_metadata_only",
    disabled_reasons: [
      "cai_not_installed",
      "cai_execution_disabled",
      "python_sidecar_disabled",
      "subprocess_launch_disabled",
      "network_scan_disabled",
      "filesystem_read_disabled",
      "phase_18_approval_required",
      "metadata_only_contract",
    ],
    capabilities: [...CAI_ADAPTER_CAPABILITIES],
    metadata_only: true,
    read_only: true,
    deterministic: true,
    cai_installed: false,
    cai_called: false,
    execution_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    subprocess_launch_enabled: false,
    python_sidecar_enabled: false,
    raw_value_included: false,
  });
}

function capabilityMetadata(
  mode: CaiAdapterMode,
): readonly CaiAdapterCapabilityMetadata[] {
  return CAI_ADAPTER_CAPABILITIES.map((capability) =>
    CaiAdapterCapabilityMetadataSchema.parse({
      capability,
      label: capability.replaceAll("_", " "),
      mode,
      metadata_only: true,
      read_only: true,
      execution_enabled: false,
      cai_call_enabled: false,
      subprocess_launch_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
    }),
  );
}

function buildMockDryRunResult(
  request: CaiAdapterRunRequest,
): CaiAdapterDryRunResult {
  const parsed = CaiAdapterRunRequestSchema.parse(request);
  const proposalValidation = validateRedTeamRunProposal(parsed.proposal);
  const safety = scanRedTeamSandboxSafety(parsed.proposal, "proposal");
  const safeProposal =
    proposalValidation.verdict === "allowed_metadata_only" && safety.passed;
  const plan = safeProposal ? buildRedTeamRunPlan(parsed.proposal) : null;
  const planValidation = plan
    ? validateRedTeamRunPlan(plan)
    : proposalValidation;
  const accepted =
    safeProposal && planValidation.verdict === "allowed_metadata_only";
  const auditEnvelope = auditEnvelopeForRequest(parsed, accepted);

  return CaiAdapterDryRunResultSchema.parse({
    result_id: `cai-adapter-dry-run:${parsed.request_id.replace(
      "cai-adapter-request:",
      "",
    )}`,
    request_id: parsed.request_id,
    proposal_id: parsed.proposal.proposal_id,
    mode: parsed.mode,
    accepted,
    verdict: accepted ? "metadata_dry_run_ready" : "rejected",
    disabled_reasons: accepted
      ? [
          "cai_not_installed",
          "cai_execution_disabled",
          "metadata_only_contract",
        ]
      : [
          "unsafe_proposal_rejected",
          "cai_execution_disabled",
          "metadata_only_contract",
        ],
    validation_result: proposalValidation,
    plan_metadata: plan,
    audit_envelope: auditEnvelope,
    metadata_only: true,
    read_only: true,
    redaction_safe: true,
    deterministic: true,
    raw_value_included: false,
    cai_called: false,
    execution_enabled: false,
    subprocess_launch_enabled: false,
    process_spawn_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
  });
}

function auditEnvelopeForRequest(
  request: CaiAdapterRunRequest,
  accepted: boolean,
): CaiAdapterAuditEnvelope {
  const auditPreview: RedTeamAuditPreview = buildRedTeamAuditPreview(
    request.proposal,
  );
  return CaiAdapterAuditEnvelopeSchema.parse({
    envelope_id: `cai-adapter-audit:${request.request_id.replace(
      "cai-adapter-request:",
      "",
    )}`,
    request_id: request.request_id,
    proposal_id: request.proposal.proposal_id,
    mode: request.mode,
    audit_preview: auditPreview,
    disabled_reasons: accepted
      ? [
          "cai_not_installed",
          "cai_execution_disabled",
          "metadata_only_contract",
        ]
      : [
          "unsafe_proposal_rejected",
          "cai_execution_disabled",
          "metadata_only_contract",
        ],
    metadata_only: true,
    read_only: true,
    redaction_safe: true,
    deterministic: true,
    raw_value_included: false,
    cai_called: false,
    execution_enabled: false,
    subprocess_launch_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
  });
}
