import { z } from "zod";

import {
  RED_TEAM_SUPPORTED_ACTION_CLASSES,
  RED_TEAM_SUPPORTED_TARGET_SCOPES,
  RedTeamRunProposalSchema,
  RedTeamSandboxValidationResultSchema,
  buildRedTeamAuditPreview,
  validateRedTeamRunProposal,
  type RedTeamRunProposal,
  type RedTeamSandboxValidationResult,
} from "./contracts";
import { CaiAdapterRunRequestSchema } from "./cai-adapter-contract";
import { getCaiProviderManifest } from "./cai-provider-manifest";
import { scanRedTeamSandboxSafety } from "./safety-guard";

export const CAI_APPROVAL_BINDING_VERSION = "19D.9" as const;

export const CAI_APPROVAL_REQUIRED_EVIDENCE_IDS = [
  "phase_18_approval_metadata",
  "dry_run_required",
  "allowed_target_scope",
  "allowed_action_class",
  "sandbox_profile",
  "metadata_only_audit_preview",
] as const;

export const CAI_APPROVAL_DENIED_REASONS = [
  "missing_phase_18_approval_metadata",
  "non_dry_run_request",
  "forbidden_target_scope",
  "forbidden_action_class",
  "unsafe_request_metadata",
  "provider_executable_state",
  "metadata_contract_rejected",
] as const;

export const CAI_APPROVAL_BINDING_DISABLED_CAPABILITIES = [
  "approval decision creation",
  "authority token creation",
  "execution plan dispatch",
  "command execution",
  "CAI execution",
  "CAI import",
  "CAI installation",
  "Python sidecar",
  "subprocess launch",
  "process spawn",
  "network scanning",
  "filesystem reads",
  "database reads",
  "repo mutation",
  "Phase 18 bypass",
] as const;

export type CaiApprovalRequiredEvidenceId =
  (typeof CAI_APPROVAL_REQUIRED_EVIDENCE_IDS)[number];
export type CaiApprovalDeniedReason =
  (typeof CAI_APPROVAL_DENIED_REASONS)[number];

export const CaiApprovalRequiredEvidenceIdSchema = z.enum(
  CAI_APPROVAL_REQUIRED_EVIDENCE_IDS,
);
export const CaiApprovalDeniedReasonSchema = z.enum(
  CAI_APPROVAL_DENIED_REASONS,
);
export const CaiApprovalBindingDisabledCapabilitySchema = z.enum(
  CAI_APPROVAL_BINDING_DISABLED_CAPABILITIES,
);

export const CaiApprovalRequiredEvidenceSchema = z.strictObject({
  evidence_id: CaiApprovalRequiredEvidenceIdSchema,
  label: z.string().trim().min(1).max(180),
  satisfied: z.boolean(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const CaiApprovalBindingPolicySchema = z.strictObject({
  policy_id: z.literal("cai-approval-binding-policy:phase-19d"),
  policy_version: z.literal(CAI_APPROVAL_BINDING_VERSION),
  requires_phase_18_approval_metadata: z.literal(true),
  dry_run_first_required: z.literal(true),
  allowed_target_scopes: z.array(z.enum(RED_TEAM_SUPPORTED_TARGET_SCOPES)),
  allowed_action_classes: z.array(z.enum(RED_TEAM_SUPPORTED_ACTION_CLASSES)),
  approval_decision_creation_enabled: z.literal(false),
  authority_token_creation_enabled: z.literal(false),
  execution_plan_dispatch_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  cai_execution_enabled: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
});

export const CaiApprovalProposalSchema = z.strictObject({
  cai_approval_proposal_id: z
    .string()
    .trim()
    .regex(/^cai-approval-proposal:[a-z0-9._:-]+$/),
  request_id: z
    .string()
    .trim()
    .regex(/^cai-adapter-request:[a-z0-9._:-]+$/),
  proposal_id: z
    .string()
    .trim()
    .regex(/^red-team-proposal:[a-z0-9._:-]+$/),
  target_scope: z.string().trim().min(1).max(80),
  action_class: z.string().trim().min(1).max(80),
  sandbox_profile_id: z.string().trim().min(1).max(120),
  binding_policy: CaiApprovalBindingPolicySchema,
  approval_required: z.literal(true),
  approval_metadata_present: z.boolean(),
  dry_run_required: z.literal(true),
  dry_run_first: z.literal(true),
  allowed_target_scope: z.boolean(),
  allowed_action_class: z.boolean(),
  required_evidence: z.array(CaiApprovalRequiredEvidenceSchema),
  denied_reasons: z.array(CaiApprovalDeniedReasonSchema),
  validation_result: RedTeamSandboxValidationResultSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  raw_payload_included: z.literal(false),
  shell_commands_included: z.literal(false),
  secrets_included: z.literal(false),
  executable_content_included: z.literal(false),
  approval_decision_created: z.literal(false),
  authority_token_created: z.literal(false),
  execution_plan_dispatch_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  cai_execution_enabled: z.literal(false),
});

export const CaiApprovalAuditPreviewSchema = z.strictObject({
  audit_preview_id: z
    .string()
    .trim()
    .regex(/^cai-approval-audit:[a-z0-9._:-]+$/),
  cai_approval_proposal_id: z
    .string()
    .trim()
    .regex(/^cai-approval-proposal:[a-z0-9._:-]+$/),
  proposal_id: z
    .string()
    .trim()
    .regex(/^red-team-proposal:[a-z0-9._:-]+$/),
  target_scope: z.string().trim().min(1).max(80),
  action_class: z.string().trim().min(1).max(80),
  approval_required: z.literal(true),
  dry_run_required: z.literal(true),
  sandbox_profile_id: z.string().trim().min(1).max(120),
  denied_reasons: z.array(CaiApprovalDeniedReasonSchema),
  red_team_audit_preview_id: z.string().trim().min(1).max(160).nullable(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  raw_payload_included: z.literal(false),
  shell_commands_included: z.literal(false),
  secrets_included: z.literal(false),
  executable_content_included: z.literal(false),
  approval_decision_created: z.literal(false),
  authority_token_created: z.literal(false),
  execution_plan_dispatch_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  cai_execution_enabled: z.literal(false),
});

export const CaiApprovalBindingResultSchema = z.strictObject({
  binding_result_id: z
    .string()
    .trim()
    .regex(/^cai-approval-binding-result:[a-z0-9._:-]+$/),
  proposal: CaiApprovalProposalSchema,
  valid: z.boolean(),
  denied_reasons: z.array(CaiApprovalDeniedReasonSchema),
  audit_preview: CaiApprovalAuditPreviewSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  approval_decision_created: z.literal(false),
  authority_token_created: z.literal(false),
  execution_plan_dispatch_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  cai_execution_enabled: z.literal(false),
});

export type CaiApprovalRequiredEvidence = z.infer<
  typeof CaiApprovalRequiredEvidenceSchema
>;
export type CaiApprovalBindingPolicy = z.infer<
  typeof CaiApprovalBindingPolicySchema
>;
export type CaiApprovalProposal = z.infer<typeof CaiApprovalProposalSchema>;
export type CaiApprovalAuditPreview = z.infer<
  typeof CaiApprovalAuditPreviewSchema
>;
export type CaiApprovalBindingResult = z.infer<
  typeof CaiApprovalBindingResultSchema
>;
export type CaiApprovalBindingDisabledCapability = z.infer<
  typeof CaiApprovalBindingDisabledCapabilitySchema
>;

export function buildCaiApprovalProposal(
  request: unknown,
): CaiApprovalProposal {
  const parsedRequest = CaiAdapterRunRequestSchema.safeParse(request);
  const requestId = requestIdFromUnknown(request);
  const proposal = proposalFromUnknown(request);
  const proposalId = proposal?.proposal_id ?? "red-team-proposal:invalid";
  const targetScope = proposal?.target.scope ?? "unknown";
  const actionClass = proposal?.action_class ?? "unknown";
  const sandboxProfileId = proposal?.profile_id ?? "red-team-profile:unknown";
  const validation = proposal
    ? validateRedTeamRunProposal(proposal)
    : invalidProposalValidation();
  const safety = proposal
    ? scanRedTeamSandboxSafety(proposal, "proposal")
    : { passed: false };
  const manifest = getCaiProviderManifest();
  const dryRunRequired = dryRunRequiredFromUnknown(request);
  const approvalMetadataPresent = Boolean(
    proposal?.approval_metadata?.approval_metadata_present,
  );
  const allowedTargetScope = (
    RED_TEAM_SUPPORTED_TARGET_SCOPES as readonly string[]
  ).includes(targetScope);
  const allowedActionClass = (
    RED_TEAM_SUPPORTED_ACTION_CLASSES as readonly string[]
  ).includes(actionClass);
  const providerNonExecutable =
    manifest.install_state === "not_installed" &&
    manifest.execution_state === "disabled" &&
    !manifest.execution_enabled &&
    !manifest.cai_called &&
    !manifest.cai_imported &&
    !manifest.cai_installed;
  const deniedReasons = deniedReasonsFor({
    parsedRequestSucceeded: parsedRequest.success,
    validation,
    safetyPassed: safety.passed,
    dryRunRequired,
    approvalMetadataPresent,
    allowedTargetScope,
    allowedActionClass,
    providerNonExecutable,
  });

  return CaiApprovalProposalSchema.parse({
    cai_approval_proposal_id: `cai-approval-proposal:${requestId.replace(
      "cai-adapter-request:",
      "",
    )}`,
    request_id: requestId,
    proposal_id: proposalId,
    target_scope: targetScope,
    action_class: actionClass,
    sandbox_profile_id: sandboxProfileId,
    binding_policy: bindingPolicy(),
    approval_required: true,
    approval_metadata_present: approvalMetadataPresent,
    dry_run_required: true,
    dry_run_first: true,
    allowed_target_scope: allowedTargetScope,
    allowed_action_class: allowedActionClass,
    required_evidence: requiredEvidence({
      approvalMetadataPresent,
      dryRunRequired,
      allowedTargetScope,
      allowedActionClass,
      sandboxProfilePresent: Boolean(proposal?.profile_id),
      auditPreviewAvailable: Boolean(proposal),
    }),
    denied_reasons: deniedReasons,
    validation_result: validation,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    raw_payload_included: false,
    shell_commands_included: false,
    secrets_included: false,
    executable_content_included: false,
    approval_decision_created: false,
    authority_token_created: false,
    execution_plan_dispatch_enabled: false,
    command_execution_enabled: false,
    cai_execution_enabled: false,
  });
}

export function validateCaiApprovalProposal(
  proposal: unknown,
): CaiApprovalBindingResult {
  const parsed = CaiApprovalProposalSchema.safeParse(proposal);
  const proposalValue = parsed.success
    ? parsed.data
    : buildCaiApprovalProposal({});
  const valid =
    parsed.success &&
    proposalValue.denied_reasons.length === 0 &&
    proposalValue.validation_result.verdict === "allowed_metadata_only" &&
    proposalValue.approval_metadata_present &&
    proposalValue.allowed_target_scope &&
    proposalValue.allowed_action_class;

  return CaiApprovalBindingResultSchema.parse({
    binding_result_id: `cai-approval-binding-result:${proposalValue.cai_approval_proposal_id.replace(
      "cai-approval-proposal:",
      "",
    )}`,
    proposal: proposalValue,
    valid,
    denied_reasons: parsed.success
      ? proposalValue.denied_reasons
      : ["metadata_contract_rejected", ...proposalValue.denied_reasons].filter(
          unique,
        ),
    audit_preview: buildCaiApprovalAuditPreview(proposalValue),
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    approval_decision_created: false,
    authority_token_created: false,
    execution_plan_dispatch_enabled: false,
    command_execution_enabled: false,
    cai_execution_enabled: false,
  });
}

export function buildCaiApprovalAuditPreview(
  proposal: unknown,
): CaiApprovalAuditPreview {
  const proposalValue = CaiApprovalProposalSchema.parse(proposal);
  const redTeamAuditPreview = proposalFromApprovalProposal(proposalValue)
    ? buildRedTeamAuditPreview(proposalFromApprovalProposal(proposalValue)!)
    : null;

  return CaiApprovalAuditPreviewSchema.parse({
    audit_preview_id: `cai-approval-audit:${proposalValue.cai_approval_proposal_id.replace(
      "cai-approval-proposal:",
      "",
    )}`,
    cai_approval_proposal_id: proposalValue.cai_approval_proposal_id,
    proposal_id: proposalValue.proposal_id,
    target_scope: proposalValue.target_scope,
    action_class: proposalValue.action_class,
    approval_required: true,
    dry_run_required: true,
    sandbox_profile_id: proposalValue.sandbox_profile_id,
    denied_reasons: proposalValue.denied_reasons,
    red_team_audit_preview_id: redTeamAuditPreview?.audit_preview_id ?? null,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    raw_payload_included: false,
    shell_commands_included: false,
    secrets_included: false,
    executable_content_included: false,
    approval_decision_created: false,
    authority_token_created: false,
    execution_plan_dispatch_enabled: false,
    command_execution_enabled: false,
    cai_execution_enabled: false,
  });
}

export function assertCaiRequiresApproval(proposal: unknown): void {
  const parsed = CaiApprovalProposalSchema.parse(proposal);
  const result = validateCaiApprovalProposal(parsed);
  const unsafe =
    !parsed.approval_required ||
    !parsed.approval_metadata_present ||
    !parsed.dry_run_required ||
    !parsed.dry_run_first ||
    parsed.approval_decision_created ||
    parsed.authority_token_created ||
    parsed.execution_plan_dispatch_enabled ||
    parsed.command_execution_enabled ||
    parsed.cai_execution_enabled ||
    !result.valid;

  if (unsafe) {
    throw new Error("CAI approval binding requires inert Phase 18 metadata");
  }
}

export function listCaiApprovalBindingDisabledCapabilities(): readonly CaiApprovalBindingDisabledCapability[] {
  return [...CAI_APPROVAL_BINDING_DISABLED_CAPABILITIES];
}

function bindingPolicy(): CaiApprovalBindingPolicy {
  return CaiApprovalBindingPolicySchema.parse({
    policy_id: "cai-approval-binding-policy:phase-19d",
    policy_version: CAI_APPROVAL_BINDING_VERSION,
    requires_phase_18_approval_metadata: true,
    dry_run_first_required: true,
    allowed_target_scopes: [...RED_TEAM_SUPPORTED_TARGET_SCOPES],
    allowed_action_classes: [...RED_TEAM_SUPPORTED_ACTION_CLASSES],
    approval_decision_creation_enabled: false,
    authority_token_creation_enabled: false,
    execution_plan_dispatch_enabled: false,
    command_execution_enabled: false,
    cai_execution_enabled: false,
    metadata_only: true,
    read_only: true,
    deterministic: true,
  });
}

function requiredEvidence(input: {
  readonly approvalMetadataPresent: boolean;
  readonly dryRunRequired: boolean;
  readonly allowedTargetScope: boolean;
  readonly allowedActionClass: boolean;
  readonly sandboxProfilePresent: boolean;
  readonly auditPreviewAvailable: boolean;
}): readonly CaiApprovalRequiredEvidence[] {
  return [
    evidence({
      evidence_id: "phase_18_approval_metadata",
      label: "Phase 18 approval metadata is present.",
      satisfied: input.approvalMetadataPresent,
    }),
    evidence({
      evidence_id: "dry_run_required",
      label: "CAI request is dry-run-first.",
      satisfied: input.dryRunRequired,
    }),
    evidence({
      evidence_id: "allowed_target_scope",
      label: "Target scope is whitelisted by the red-team sandbox.",
      satisfied: input.allowedTargetScope,
    }),
    evidence({
      evidence_id: "allowed_action_class",
      label: "Action class is whitelisted by the red-team sandbox.",
      satisfied: input.allowedActionClass,
    }),
    evidence({
      evidence_id: "sandbox_profile",
      label: "Sandbox profile metadata is attached.",
      satisfied: input.sandboxProfilePresent,
    }),
    evidence({
      evidence_id: "metadata_only_audit_preview",
      label: "Audit preview can be represented as metadata only.",
      satisfied: input.auditPreviewAvailable,
    }),
  ];
}

function evidence(input: {
  readonly evidence_id: CaiApprovalRequiredEvidenceId;
  readonly label: string;
  readonly satisfied: boolean;
}): CaiApprovalRequiredEvidence {
  return CaiApprovalRequiredEvidenceSchema.parse({
    ...input,
    metadata_only: true,
    read_only: true,
  });
}

function deniedReasonsFor(input: {
  readonly parsedRequestSucceeded: boolean;
  readonly validation: RedTeamSandboxValidationResult;
  readonly safetyPassed: boolean;
  readonly dryRunRequired: boolean;
  readonly approvalMetadataPresent: boolean;
  readonly allowedTargetScope: boolean;
  readonly allowedActionClass: boolean;
  readonly providerNonExecutable: boolean;
}): readonly CaiApprovalDeniedReason[] {
  const reasons: CaiApprovalDeniedReason[] = [];

  if (!input.parsedRequestSucceeded) {
    reasons.push("metadata_contract_rejected");
  }
  if (!input.approvalMetadataPresent) {
    reasons.push("missing_phase_18_approval_metadata");
  }
  if (!input.dryRunRequired) {
    reasons.push("non_dry_run_request");
  }
  if (!input.allowedTargetScope) {
    reasons.push("forbidden_target_scope");
  }
  if (!input.allowedActionClass) {
    reasons.push("forbidden_action_class");
  }
  if (
    !input.safetyPassed ||
    input.validation.verdict !== "allowed_metadata_only"
  ) {
    reasons.push("unsafe_request_metadata");
  }
  if (!input.providerNonExecutable) {
    reasons.push("provider_executable_state");
  }

  return reasons.filter(unique);
}

function unique<T>(value: T, index: number, values: readonly T[]): boolean {
  return values.indexOf(value) === index;
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

function dryRunRequiredFromUnknown(request: unknown): boolean {
  return Boolean(
    request &&
    typeof request === "object" &&
    "dry_run_required" in request &&
    request.dry_run_required === true,
  );
}

function proposalFromUnknown(request: unknown): RedTeamRunProposal | null {
  if (!request || typeof request !== "object" || !("proposal" in request)) {
    return null;
  }
  const parsed = RedTeamRunProposalSchema.safeParse(request.proposal);
  return parsed.success ? parsed.data : null;
}

function proposalFromApprovalProposal(
  proposal: CaiApprovalProposal,
): RedTeamRunProposal | null {
  if (proposal.validation_result.verdict !== "allowed_metadata_only") {
    return null;
  }

  const parsed = RedTeamRunProposalSchema.safeParse({
    proposal_id: proposal.proposal_id,
    profile_id: proposal.sandbox_profile_id,
    target: {
      target_id: "red-team-target:approval-preview-placeholder",
      label: "Approval preview placeholder target",
      scope: proposal.target_scope,
      target_reference: "redacted-metadata-reference",
      localhost_only: proposal.target_scope === "localhost_only",
      external_network_allowed: false,
      credentialed_access_allowed: false,
      metadata_only: true,
      read_only: true,
    },
    action_class: proposal.action_class,
    authorization_policy: {
      policy_id: "red-team-policy:phase-18-approval-required",
      label: "Phase 18 approval metadata required for every red-team class",
      requires_phase_18_approval_metadata: true,
      dry_run_first_required: true,
      per_action_class_authorization_required: true,
      target_whitelist_required: true,
      external_targets_allowed: false,
      approval_bypass_allowed: false,
      authority_grant_allowed: false,
      metadata_only: true,
      read_only: true,
    },
    approval_metadata: {
      approval_required: true,
      phase_18_lifecycle_required: true,
      approval_metadata_present: proposal.approval_metadata_present,
      approval_created: false,
      approval_decision_recorded: false,
      authority_granted: false,
      phase_18_bypass_enabled: false,
      metadata_only: true,
    },
    dry_run_required: true,
    execution_enabled: false,
    network_scan_enabled: false,
    shell_commands_included: false,
    executable_payload_included: false,
    credentials_included: false,
    secrets_included: false,
    phase_18_bypass_enabled: false,
    metadata_only: true,
    read_only: true,
    deterministic: true,
  });

  return parsed.success ? parsed.data : null;
}

function invalidProposalValidation(): RedTeamSandboxValidationResult {
  return validateRedTeamRunProposal({});
}
