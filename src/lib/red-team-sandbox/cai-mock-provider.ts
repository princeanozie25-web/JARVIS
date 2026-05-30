import { z } from "zod";

import {
  RedTeamRunProposalSchema,
  RedTeamSandboxValidationResultSchema,
  buildRedTeamAuditPreview,
  validateRedTeamRunProposal,
  type RedTeamRunProposal,
  type RedTeamSandboxValidationResult,
} from "./contracts";
import {
  CaiAdapterAuditEnvelopeSchema,
  CaiAdapterRunRequestSchema,
  type CaiAdapterAuditEnvelope,
  type CaiAdapterRunRequest,
} from "./cai-adapter-contract";
import { getCaiProviderManifest } from "./cai-provider-manifest";
import { scanRedTeamSandboxSafety } from "./safety-guard";

export const CAI_MOCK_PROVIDER_VERSION = "19D.8" as const;

export const CAI_MOCK_PROVIDER_RUN_STATUSES = [
  "disabled",
  "dry_run_metadata_ready",
  "rejected",
] as const;

export const CAI_MOCK_PROVIDER_FINDING_SEVERITIES = [
  "info",
  "warning",
] as const;

export const CAI_MOCK_PROVIDER_FINDING_KINDS = [
  "static_analysis_note",
  "configuration_review_note",
  "dependency_inventory_note",
  "sandbox_boundary_note",
] as const;

export const CAI_MOCK_PROVIDER_DISABLED_CAPABILITIES = [
  "CAI installation",
  "CAI import",
  "CAI execution",
  "Python sidecar",
  "subprocess launch",
  "process spawn",
  "command execution",
  "network scanning",
  "filesystem reads",
  "database reads",
  "repo mutation",
  "approval decisions",
  "authority token creation",
  "Phase 18 bypass",
] as const;

export type CaiMockProviderRunStatus =
  (typeof CAI_MOCK_PROVIDER_RUN_STATUSES)[number];
export type CaiMockProviderFindingSeverity =
  (typeof CAI_MOCK_PROVIDER_FINDING_SEVERITIES)[number];
export type CaiMockProviderDisabledCapability =
  (typeof CAI_MOCK_PROVIDER_DISABLED_CAPABILITIES)[number];

export const CaiMockProviderRunStatusSchema = z.enum(
  CAI_MOCK_PROVIDER_RUN_STATUSES,
);
export const CaiMockProviderFindingSeveritySchema = z.enum(
  CAI_MOCK_PROVIDER_FINDING_SEVERITIES,
);
export const CaiMockProviderFindingKindSchema = z.enum(
  CAI_MOCK_PROVIDER_FINDING_KINDS,
);
export const CaiMockProviderDisabledCapabilitySchema = z.enum(
  CAI_MOCK_PROVIDER_DISABLED_CAPABILITIES,
);

export const CaiMockProviderFindingSchema = z.strictObject({
  finding_id: z
    .string()
    .trim()
    .regex(/^cai-mock-finding:[a-z0-9._:-]+$/),
  finding_kind: CaiMockProviderFindingKindSchema,
  severity: CaiMockProviderFindingSeveritySchema,
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(260),
  synthetic_only: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const CaiMockProviderResultSchema = z.strictObject({
  result_id: z
    .string()
    .trim()
    .regex(/^cai-mock-result:[a-z0-9._:-]+$/),
  request_id: z
    .string()
    .trim()
    .regex(/^cai-adapter-request:[a-z0-9._:-]+$/),
  proposal_id: z
    .string()
    .trim()
    .regex(/^red-team-proposal:/),
  provider_id: z.literal("cai-mock-provider:phase-19d"),
  provider_version: z.literal(CAI_MOCK_PROVIDER_VERSION),
  status: CaiMockProviderRunStatusSchema,
  accepted: z.boolean(),
  findings: z.array(CaiMockProviderFindingSchema),
  validation_result: RedTeamSandboxValidationResultSchema,
  audit_envelope: CaiAdapterAuditEnvelopeSchema.nullable(),
  disabled_capabilities: z.array(CaiMockProviderDisabledCapabilitySchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  synthetic_only: z.literal(true),
  raw_value_included: z.literal(false),
  cai_installed: z.literal(false),
  cai_imported: z.literal(false),
  cai_called: z.literal(false),
  execution_enabled: z.literal(false),
  subprocess_launch_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
  approval_decision_enabled: z.literal(false),
  authority_token_creation_enabled: z.literal(false),
  phase_18_bypass_enabled: z.literal(false),
});

export const CaiMockProviderHealthSchema = z.strictObject({
  provider_id: z.literal("cai-mock-provider:phase-19d"),
  provider_version: z.literal(CAI_MOCK_PROVIDER_VERSION),
  status: z.literal("disabled"),
  manifest_execution_state: z.literal("disabled"),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  cai_installed: z.literal(false),
  cai_imported: z.literal(false),
  cai_called: z.literal(false),
  execution_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  process_spawn_enabled: z.literal(false),
});

export type CaiMockProviderFinding = z.infer<
  typeof CaiMockProviderFindingSchema
>;
export type CaiMockProviderResult = z.infer<typeof CaiMockProviderResultSchema>;
export type CaiMockProviderHealth = z.infer<typeof CaiMockProviderHealthSchema>;

export interface CaiMockProvider {
  readonly provider_id: "cai-mock-provider:phase-19d";
  readonly provider_version: typeof CAI_MOCK_PROVIDER_VERSION;
  readonly metadata_only: true;
  readonly read_only: true;
  readonly dry_run_only: true;
  health(): CaiMockProviderHealth;
  buildDryRun(request: unknown): CaiMockProviderResult;
  listDisabledCapabilities(): readonly CaiMockProviderDisabledCapability[];
}

export function createCaiMockProvider(): CaiMockProvider {
  return {
    provider_id: "cai-mock-provider:phase-19d",
    provider_version: CAI_MOCK_PROVIDER_VERSION,
    metadata_only: true,
    read_only: true,
    dry_run_only: true,
    health: () => providerHealth(),
    buildDryRun: (request) => runCaiMockDryRun(request),
    listDisabledCapabilities: () => listCaiMockProviderDisabledCapabilities(),
  };
}

export function runCaiMockDryRun(request: unknown): CaiMockProviderResult {
  const parsedRequest = CaiAdapterRunRequestSchema.safeParse(request);
  const requestId = requestIdFromUnknown(request);
  const proposal = proposalFromUnknown(request);
  const proposalId = proposal?.proposal_id ?? "red-team-proposal:invalid";
  const proposalValidation = proposal
    ? validateRedTeamRunProposal(proposal)
    : invalidRequestValidation();
  const safety = proposal
    ? scanRedTeamSandboxSafety(proposal, "proposal")
    : { passed: false };
  const manifest = getCaiProviderManifest();
  const accepted =
    parsedRequest.success &&
    Boolean(proposal) &&
    proposalValidation.verdict === "allowed_metadata_only" &&
    safety.passed &&
    manifest.execution_state === "disabled" &&
    manifest.install_state === "not_installed";
  const auditEnvelope =
    parsedRequest.success && proposal
      ? auditEnvelopeForRequest(parsedRequest.data, accepted)
      : null;

  return CaiMockProviderResultSchema.parse({
    result_id: `cai-mock-result:${requestId.replace(
      "cai-adapter-request:",
      "",
    )}`,
    request_id: requestId,
    proposal_id: proposalId,
    provider_id: "cai-mock-provider:phase-19d",
    provider_version: CAI_MOCK_PROVIDER_VERSION,
    status: accepted ? "dry_run_metadata_ready" : "rejected",
    accepted,
    findings: accepted ? buildCaiMockFindingFixture() : [],
    validation_result: proposalValidation,
    audit_envelope: auditEnvelope,
    disabled_capabilities: listCaiMockProviderDisabledCapabilities(),
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    synthetic_only: true,
    raw_value_included: false,
    cai_installed: false,
    cai_imported: false,
    cai_called: false,
    execution_enabled: false,
    subprocess_launch_enabled: false,
    process_spawn_enabled: false,
    command_execution_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
    approval_decision_enabled: false,
    authority_token_creation_enabled: false,
    phase_18_bypass_enabled: false,
  });
}

export function buildCaiMockFindingFixture(): readonly CaiMockProviderFinding[] {
  return [
    finding({
      finding_id: "cai-mock-finding:static-analysis-note",
      finding_kind: "static_analysis_note",
      severity: "info",
      title: "Static analysis metadata prepared",
      summary:
        "Synthetic note confirms only static metadata would be reviewed by a future governed provider.",
    }),
    finding({
      finding_id: "cai-mock-finding:configuration-review-note",
      finding_kind: "configuration_review_note",
      severity: "info",
      title: "Configuration review remains dry-run only",
      summary:
        "Synthetic note confirms configuration review produces no command, mutation, or external target.",
    }),
    finding({
      finding_id: "cai-mock-finding:dependency-inventory-note",
      finding_kind: "dependency_inventory_note",
      severity: "info",
      title: "Dependency inventory is synthetic",
      summary:
        "Synthetic note confirms dependency inventory is represented without reading files or package state.",
    }),
    finding({
      finding_id: "cai-mock-finding:sandbox-boundary-note",
      finding_kind: "sandbox_boundary_note",
      severity: "warning",
      title: "Sandbox boundary remains enforced",
      summary:
        "Synthetic note confirms CAI stays uninstalled, disabled, and gated by Phase 18 approval metadata.",
    }),
  ];
}

export function listCaiMockProviderDisabledCapabilities(): readonly CaiMockProviderDisabledCapability[] {
  return [...CAI_MOCK_PROVIDER_DISABLED_CAPABILITIES];
}

function providerHealth(): CaiMockProviderHealth {
  return CaiMockProviderHealthSchema.parse({
    provider_id: "cai-mock-provider:phase-19d",
    provider_version: CAI_MOCK_PROVIDER_VERSION,
    status: "disabled",
    manifest_execution_state: getCaiProviderManifest().execution_state,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    cai_installed: false,
    cai_imported: false,
    cai_called: false,
    execution_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    process_spawn_enabled: false,
  });
}

function finding(input: {
  readonly finding_id: string;
  readonly finding_kind: CaiMockProviderFinding["finding_kind"];
  readonly severity: CaiMockProviderFindingSeverity;
  readonly title: string;
  readonly summary: string;
}): CaiMockProviderFinding {
  return CaiMockProviderFindingSchema.parse({
    ...input,
    synthetic_only: true,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  });
}

function requestIdFromUnknown(request: unknown): string {
  if (
    request &&
    typeof request === "object" &&
    "request_id" in request &&
    typeof request.request_id === "string" &&
    /^cai-adapter-request:[a-z0-9._:-]+$/.test(request.request_id)
  ) {
    return request.request_id;
  }
  return "cai-adapter-request:invalid";
}

function proposalFromUnknown(request: unknown): RedTeamRunProposal | null {
  if (!request || typeof request !== "object" || !("proposal" in request)) {
    return null;
  }
  const parsed = RedTeamRunProposalSchema.safeParse(request.proposal);
  return parsed.success ? parsed.data : null;
}

function invalidRequestValidation(): RedTeamSandboxValidationResult {
  return validateRedTeamRunProposal({});
}

function auditEnvelopeForRequest(
  request: CaiAdapterRunRequest,
  accepted: boolean,
): CaiAdapterAuditEnvelope {
  return CaiAdapterAuditEnvelopeSchema.parse({
    envelope_id: `cai-adapter-audit:${request.request_id.replace(
      "cai-adapter-request:",
      "",
    )}`,
    request_id: request.request_id,
    proposal_id: request.proposal.proposal_id,
    mode: request.mode,
    audit_preview: buildRedTeamAuditPreview(request.proposal),
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
