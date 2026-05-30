import { z } from "zod";

export const RED_TEAM_SANDBOX_CONTRACT_VERSION = "19D.1" as const;

export const RED_TEAM_SUPPORTED_TARGET_SCOPES = [
  "localhost_only",
  "repo_static_analysis_only",
  "synthetic_fixture_only",
] as const;

export const RED_TEAM_FORBIDDEN_TARGET_SCOPES = [
  "public_internet",
  "private_lan",
  "third_party",
  "credentialed_external_system",
  "unknown",
] as const;

export const RED_TEAM_TARGET_SCOPES = [
  ...RED_TEAM_SUPPORTED_TARGET_SCOPES,
  ...RED_TEAM_FORBIDDEN_TARGET_SCOPES,
] as const;

export const RED_TEAM_SUPPORTED_ACTION_CLASSES = [
  "read_only_recon",
  "static_analysis",
  "configuration_review",
  "dependency_inventory",
  "synthetic_attack_simulation",
] as const;

export const RED_TEAM_FORBIDDEN_ACTION_CLASSES = [
  "exploit_execution",
  "credential_attack",
  "persistence",
  "lateral_movement",
  "data_exfiltration",
  "destructive_action",
  "network_scan_external",
  "privilege_escalation",
] as const;

export const RED_TEAM_ACTION_CLASSES = [
  ...RED_TEAM_SUPPORTED_ACTION_CLASSES,
  ...RED_TEAM_FORBIDDEN_ACTION_CLASSES,
] as const;

export const RED_TEAM_SANDBOX_VERDICTS = [
  "allowed_metadata_only",
  "denied",
] as const;

export const RED_TEAM_SANDBOX_VIOLATION_REASONS = [
  "forbidden_target_scope",
  "forbidden_action_class",
  "missing_approval_metadata",
  "approval_bypass_attempt",
  "non_dry_run_plan",
  "executable_payload_detected",
  "shell_command_detected",
  "external_network_target_detected",
  "secret_material_detected",
  "raw_payload_detected",
  "metadata_contract_rejected",
] as const;

export const RED_TEAM_SANDBOX_FIXTURE_IDS = [
  "red-team-fixture:safe-localhost-static-analysis",
  "red-team-fixture:denied-public-internet-scan",
  "red-team-fixture:denied-destructive-action",
] as const;

export type RedTeamTargetScope = (typeof RED_TEAM_TARGET_SCOPES)[number];
export type RedTeamActionClass = (typeof RED_TEAM_ACTION_CLASSES)[number];
export type RedTeamSandboxVerdict = (typeof RED_TEAM_SANDBOX_VERDICTS)[number];
export type RedTeamSandboxViolationReason =
  (typeof RED_TEAM_SANDBOX_VIOLATION_REASONS)[number];

export const RedTeamTargetScopeSchema = z.enum(RED_TEAM_TARGET_SCOPES);
export const RedTeamActionClassSchema = z.enum(RED_TEAM_ACTION_CLASSES);
export const RedTeamSandboxVerdictSchema = z.enum(RED_TEAM_SANDBOX_VERDICTS);
export const RedTeamSandboxViolationReasonSchema = z.enum(
  RED_TEAM_SANDBOX_VIOLATION_REASONS,
);

const RedTeamIdSchema = z
  .string()
  .trim()
  .regex(/^red-team-[a-z-]+:[a-z0-9._:-]+$/);

export const RedTeamDisabledAuthorityFlagsSchema = z.strictObject({
  cai_installed: z.literal(false),
  cai_execution_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  tool_creation_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
  repo_mutation_enabled: z.literal(false),
  approval_decision_enabled: z.literal(false),
  authority_grant_enabled: z.literal(false),
  authority_material_creation_enabled: z.literal(false),
  phase_18_bypass_enabled: z.literal(false),
});

export const RedTeamApprovalMetadataSchema = z.strictObject({
  approval_required: z.literal(true),
  phase_18_lifecycle_required: z.literal(true),
  approval_metadata_present: z.literal(true),
  approval_created: z.literal(false),
  approval_decision_recorded: z.literal(false),
  authority_granted: z.literal(false),
  phase_18_bypass_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const RedTeamSandboxProfileSchema = z.strictObject({
  profile_id: RedTeamIdSchema.regex(/^red-team-profile:/),
  label: z.string().trim().min(1).max(140),
  allowed_target_scopes: z.array(z.enum(RED_TEAM_SUPPORTED_TARGET_SCOPES)),
  forbidden_target_scopes: z.array(z.enum(RED_TEAM_FORBIDDEN_TARGET_SCOPES)),
  allowed_action_classes: z.array(z.enum(RED_TEAM_SUPPORTED_ACTION_CLASSES)),
  forbidden_action_classes: z.array(z.enum(RED_TEAM_FORBIDDEN_ACTION_CLASSES)),
  disabled_authority_flags: RedTeamDisabledAuthorityFlagsSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
});

export const RedTeamTargetSchema = z.strictObject({
  target_id: RedTeamIdSchema.regex(/^red-team-target:/),
  label: z.string().trim().min(1).max(140),
  scope: RedTeamTargetScopeSchema,
  target_reference: z.string().trim().min(1).max(180),
  localhost_only: z.boolean(),
  external_network_allowed: z.literal(false),
  credentialed_access_allowed: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const RedTeamAuthorizationPolicySchema = z.strictObject({
  policy_id: RedTeamIdSchema.regex(/^red-team-policy:/),
  label: z.string().trim().min(1).max(180),
  requires_phase_18_approval_metadata: z.literal(true),
  dry_run_first_required: z.literal(true),
  per_action_class_authorization_required: z.literal(true),
  target_whitelist_required: z.literal(true),
  external_targets_allowed: z.literal(false),
  approval_bypass_allowed: z.literal(false),
  authority_grant_allowed: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const RedTeamRunProposalSchema = z.strictObject({
  proposal_id: RedTeamIdSchema.regex(/^red-team-proposal:/),
  profile_id: RedTeamIdSchema.regex(/^red-team-profile:/),
  target: RedTeamTargetSchema,
  action_class: RedTeamActionClassSchema,
  authorization_policy: RedTeamAuthorizationPolicySchema,
  approval_metadata: RedTeamApprovalMetadataSchema.nullable(),
  dry_run_required: z.literal(true),
  execution_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  shell_commands_included: z.literal(false),
  executable_payload_included: z.literal(false),
  credentials_included: z.literal(false),
  secrets_included: z.literal(false),
  phase_18_bypass_enabled: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
});

export const RedTeamRunPlanSchema = z.strictObject({
  plan_id: RedTeamIdSchema.regex(/^red-team-plan:/),
  proposal_id: RedTeamIdSchema.regex(/^red-team-proposal:/),
  target_scope: RedTeamTargetScopeSchema,
  action_class: RedTeamActionClassSchema,
  approval_metadata: RedTeamApprovalMetadataSchema.nullable(),
  dry_run_first: z.boolean(),
  plan_steps_metadata: z.array(z.string().trim().min(1).max(140)),
  execution_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
  repo_mutation_enabled: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
});

export const RedTeamAuditPreviewSchema = z.strictObject({
  audit_preview_id: RedTeamIdSchema.regex(/^red-team-audit:/),
  proposal_id: RedTeamIdSchema.regex(/^red-team-proposal:/),
  verdict: RedTeamSandboxVerdictSchema,
  target_scope: RedTeamTargetScopeSchema,
  action_class: RedTeamActionClassSchema,
  violation_reason_codes: z.array(RedTeamSandboxViolationReasonSchema),
  disabled_authority_flags: RedTeamDisabledAuthorityFlagsSchema,
  approval_required: z.literal(true),
  dry_run_first_required: z.literal(true),
  raw_payload_included: z.literal(false),
  shell_commands_included: z.literal(false),
  secrets_included: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  redaction_safe: z.literal(true),
  deterministic: z.literal(true),
});

export const RedTeamSandboxViolationSchema = z.strictObject({
  violation_id: z
    .string()
    .trim()
    .regex(/^red-team-violation:\d{4}$/),
  reason_code: RedTeamSandboxViolationReasonSchema,
  path: z.string().trim().min(1).max(260),
  field_name: z.string().trim().min(1).max(120).nullable(),
  severity: z.enum(["warning", "error"]),
  redacted_sample: z.string().trim().min(1).max(120),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const RedTeamSandboxValidationResultSchema = z.strictObject({
  verdict: RedTeamSandboxVerdictSchema,
  violations: z.array(RedTeamSandboxViolationSchema),
  violation_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  redaction_safe: z.literal(true),
  raw_value_included: z.literal(false),
});

export type RedTeamDisabledAuthorityFlags = z.infer<
  typeof RedTeamDisabledAuthorityFlagsSchema
>;
export type RedTeamApprovalMetadata = z.infer<
  typeof RedTeamApprovalMetadataSchema
>;
export type RedTeamSandboxProfile = z.infer<typeof RedTeamSandboxProfileSchema>;
export type RedTeamTarget = z.infer<typeof RedTeamTargetSchema>;
export type RedTeamAuthorizationPolicy = z.infer<
  typeof RedTeamAuthorizationPolicySchema
>;
export type RedTeamRunProposal = z.infer<typeof RedTeamRunProposalSchema>;
export type RedTeamRunPlan = z.infer<typeof RedTeamRunPlanSchema>;
export type RedTeamAuditPreview = z.infer<typeof RedTeamAuditPreviewSchema>;
export type RedTeamSandboxViolation = z.infer<
  typeof RedTeamSandboxViolationSchema
>;
export type RedTeamSandboxValidationResult = z.infer<
  typeof RedTeamSandboxValidationResultSchema
>;

export const RED_TEAM_DISABLED_AUTHORITY_FLAGS =
  RedTeamDisabledAuthorityFlagsSchema.parse({
    cai_installed: false,
    cai_execution_enabled: false,
    command_execution_enabled: false,
    tool_creation_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
    repo_mutation_enabled: false,
    approval_decision_enabled: false,
    authority_grant_enabled: false,
    authority_material_creation_enabled: false,
    phase_18_bypass_enabled: false,
  });

export const RED_TEAM_APPROVAL_METADATA = RedTeamApprovalMetadataSchema.parse({
  approval_required: true,
  phase_18_lifecycle_required: true,
  approval_metadata_present: true,
  approval_created: false,
  approval_decision_recorded: false,
  authority_granted: false,
  phase_18_bypass_enabled: false,
  metadata_only: true,
});

const RED_TEAM_SANDBOX_PROFILE = RedTeamSandboxProfileSchema.parse({
  profile_id: "red-team-profile:phase-19d-local-sandbox",
  label: "Phase 19D Local Red-Team Sandbox",
  allowed_target_scopes: [...RED_TEAM_SUPPORTED_TARGET_SCOPES],
  forbidden_target_scopes: [...RED_TEAM_FORBIDDEN_TARGET_SCOPES],
  allowed_action_classes: [...RED_TEAM_SUPPORTED_ACTION_CLASSES],
  forbidden_action_classes: [...RED_TEAM_FORBIDDEN_ACTION_CLASSES],
  disabled_authority_flags: RED_TEAM_DISABLED_AUTHORITY_FLAGS,
  metadata_only: true,
  read_only: true,
  deterministic: true,
});

const RED_TEAM_AUTHORIZATION_POLICY = RedTeamAuthorizationPolicySchema.parse({
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
});

function target(input: {
  readonly slug: string;
  readonly label: string;
  readonly scope: RedTeamTargetScope;
  readonly targetReference: string;
  readonly localhostOnly: boolean;
}): RedTeamTarget {
  return RedTeamTargetSchema.parse({
    target_id: `red-team-target:${input.slug}`,
    label: input.label,
    scope: input.scope,
    target_reference: input.targetReference,
    localhost_only: input.localhostOnly,
    external_network_allowed: false,
    credentialed_access_allowed: false,
    metadata_only: true,
    read_only: true,
  });
}

function proposal(input: {
  readonly slug: string;
  readonly target: RedTeamTarget;
  readonly actionClass: RedTeamActionClass;
  readonly approvalMetadata?: RedTeamApprovalMetadata | null;
}): RedTeamRunProposal {
  return RedTeamRunProposalSchema.parse({
    proposal_id: `red-team-proposal:${input.slug}`,
    profile_id: RED_TEAM_SANDBOX_PROFILE.profile_id,
    target: input.target,
    action_class: input.actionClass,
    authorization_policy: RED_TEAM_AUTHORIZATION_POLICY,
    approval_metadata: input.approvalMetadata ?? RED_TEAM_APPROVAL_METADATA,
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
}

const SAFE_LOCALHOST_STATIC_ANALYSIS_PROPOSAL = proposal({
  slug: "safe-localhost-static-analysis",
  target: target({
    slug: "localhost-static-analysis",
    label: "Localhost static metadata target",
    scope: "localhost_only",
    targetReference: "localhost",
    localhostOnly: true,
  }),
  actionClass: "static_analysis",
});

const DENIED_PUBLIC_INTERNET_SCAN_PROPOSAL = proposal({
  slug: "denied-public-internet-scan",
  target: target({
    slug: "public-internet-redacted",
    label: "Denied public internet target",
    scope: "public_internet",
    targetReference: "public-internet-redacted",
    localhostOnly: false,
  }),
  actionClass: "network_scan_external",
});

const DENIED_DESTRUCTIVE_ACTION_PROPOSAL = proposal({
  slug: "denied-destructive-action",
  target: target({
    slug: "synthetic-destructive-action",
    label: "Synthetic destructive action target",
    scope: "synthetic_fixture_only",
    targetReference: "synthetic-fixture",
    localhostOnly: false,
  }),
  actionClass: "destructive_action",
});

function copy<T>(schema: z.ZodType<T>, value: T): T {
  return schema.parse(JSON.parse(JSON.stringify(value)));
}

export function getRedTeamSandboxProfile(): RedTeamSandboxProfile {
  return copy(RedTeamSandboxProfileSchema, RED_TEAM_SANDBOX_PROFILE);
}

export function getRedTeamAuthorizationPolicy(): RedTeamAuthorizationPolicy {
  return copy(RedTeamAuthorizationPolicySchema, RED_TEAM_AUTHORIZATION_POLICY);
}

export function buildSafeLocalhostStaticAnalysisProposal(): RedTeamRunProposal {
  return copy(
    RedTeamRunProposalSchema,
    SAFE_LOCALHOST_STATIC_ANALYSIS_PROPOSAL,
  );
}

export function buildDeniedPublicInternetScanProposal(): RedTeamRunProposal {
  return copy(RedTeamRunProposalSchema, DENIED_PUBLIC_INTERNET_SCAN_PROPOSAL);
}

export function buildDeniedDestructiveActionProposal(): RedTeamRunProposal {
  return copy(RedTeamRunProposalSchema, DENIED_DESTRUCTIVE_ACTION_PROPOSAL);
}

export function listRedTeamSandboxFixtures(): readonly RedTeamRunProposal[] {
  return [
    buildSafeLocalhostStaticAnalysisProposal(),
    buildDeniedPublicInternetScanProposal(),
    buildDeniedDestructiveActionProposal(),
  ];
}

function reasonForFieldName(
  fieldName: string,
): RedTeamSandboxViolationReason | null {
  const normalized = fieldName.toLowerCase();
  if (
    [
      "executable_payload",
      "execution_payload",
      "function_body",
      "script",
    ].includes(normalized)
  ) {
    return "executable_payload_detected";
  }
  if (["command", "shell_command", "shell_commands"].includes(normalized)) {
    return "shell_command_detected";
  }
  if (
    [
      "credential",
      "credentials",
      "password",
      "secret",
      "secrets",
      "api_key",
      "access_token",
      "refresh_token",
    ].includes(normalized)
  ) {
    return "secret_material_detected";
  }
  if (
    [
      "raw_payload",
      "raw_prompt",
      "prompt",
      "raw_model_output",
      "model_output",
      "tool_args",
      "tool_arguments",
    ].includes(normalized)
  ) {
    return "raw_payload_detected";
  }
  return null;
}

function reasonForStringValue(
  value: string,
): RedTeamSandboxViolationReason | null {
  if (
    /^\s*(function\s|async\s*\(|\([^)]*\)\s*=>|class\s+[a-z0-9_$]+)/i.test(
      value,
    )
  ) {
    return "executable_payload_detected";
  }
  if (
    /^\s*(rm\s+-rf|curl\s+https?:\/\/|wget\s+https?:\/\/|powershell\s+-|bash\s+-c|sh\s+-c|cmd\s+\/c|nmap\s+)/i.test(
      value,
    )
  ) {
    return "shell_command_detected";
  }
  if (
    /\b(sk-[a-z0-9_-]{10,}|api[_-]?key\s*[:=]|bearer\s+[a-z0-9._-]{12,}|password\s*[:=])/i.test(
      value,
    )
  ) {
    return "secret_material_detected";
  }
  if (/https?:\/\/(?!localhost\b|127\.0\.0\.1\b|\[::1\]\b)/i.test(value)) {
    return "external_network_target_detected";
  }
  return null;
}

function collectUnsafeFields(
  input: unknown,
  path: string,
  fieldName: string | null,
  violations: Omit<RedTeamSandboxViolation, "violation_id">[],
): void {
  if (fieldName) {
    const reason = reasonForFieldName(fieldName);
    if (reason) {
      violations.push(violation({ reason, path, fieldName }));
      return;
    }
  }

  if (typeof input === "function") {
    violations.push(
      violation({
        reason: "executable_payload_detected",
        path,
        fieldName,
      }),
    );
    return;
  }

  if (typeof input === "string") {
    const reason = reasonForStringValue(input);
    if (reason) {
      violations.push(violation({ reason, path, fieldName }));
    }
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((value, index) => {
      collectUnsafeFields(value, `${path}[${index}]`, null, violations);
    });
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    collectUnsafeFields(value, `${path}.${key}`, key, violations);
  }
}

function violation(input: {
  readonly reason: RedTeamSandboxViolationReason;
  readonly path: string;
  readonly fieldName?: string | null;
  readonly severity?: RedTeamSandboxViolation["severity"];
}): Omit<RedTeamSandboxViolation, "violation_id"> {
  return {
    reason_code: input.reason,
    path: input.path,
    field_name: input.fieldName ?? null,
    severity: input.severity ?? "error",
    redacted_sample: `[redacted:${input.reason}]`,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  };
}

function validationResult(
  violations: readonly Omit<RedTeamSandboxViolation, "violation_id">[],
): RedTeamSandboxValidationResult {
  const parsedViolations = [...violations]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((item, index) =>
      RedTeamSandboxViolationSchema.parse({
        ...item,
        violation_id: `red-team-violation:${String(index).padStart(4, "0")}`,
      }),
    );

  return RedTeamSandboxValidationResultSchema.parse({
    verdict: parsedViolations.length === 0 ? "allowed_metadata_only" : "denied",
    violations: parsedViolations,
    violation_count: parsedViolations.length,
    metadata_only: true,
    read_only: true,
    redaction_safe: true,
    raw_value_included: false,
  });
}

function validateApprovalMetadata(
  approvalMetadata: RedTeamApprovalMetadata | null | undefined,
  path: string,
  violations: Omit<RedTeamSandboxViolation, "violation_id">[],
): void {
  if (!approvalMetadata) {
    violations.push(
      violation({
        reason: "missing_approval_metadata",
        path,
        fieldName: "approval_metadata",
      }),
    );
    return;
  }

  if (
    !approvalMetadata.approval_required ||
    !approvalMetadata.phase_18_lifecycle_required ||
    !approvalMetadata.approval_metadata_present
  ) {
    violations.push(
      violation({
        reason: "missing_approval_metadata",
        path,
        fieldName: "approval_metadata",
      }),
    );
  }

  if (
    approvalMetadata.phase_18_bypass_enabled ||
    approvalMetadata.authority_granted ||
    approvalMetadata.approval_created ||
    approvalMetadata.approval_decision_recorded
  ) {
    violations.push(
      violation({
        reason: "approval_bypass_attempt",
        path,
        fieldName: "approval_metadata",
      }),
    );
  }
}

function validateTarget(
  targetValue: RedTeamTarget,
  path: string,
  violations: Omit<RedTeamSandboxViolation, "violation_id">[],
): void {
  if (!RED_TEAM_SUPPORTED_TARGET_SCOPES.includes(targetValue.scope as never)) {
    violations.push(
      violation({
        reason: "forbidden_target_scope",
        path: `${path}.scope`,
        fieldName: "scope",
      }),
    );
  }
  if (
    targetValue.external_network_allowed ||
    targetValue.credentialed_access_allowed ||
    (targetValue.scope === "localhost_only" && !targetValue.localhost_only)
  ) {
    violations.push(
      violation({
        reason: "external_network_target_detected",
        path,
        fieldName: "target",
      }),
    );
  }
  const targetReferenceReason = reasonForStringValue(
    targetValue.target_reference,
  );
  if (targetReferenceReason) {
    violations.push(
      violation({
        reason: targetReferenceReason,
        path: `${path}.target_reference`,
        fieldName: "target_reference",
      }),
    );
  }
}

export function validateRedTeamRunProposal(
  input: unknown,
): RedTeamSandboxValidationResult {
  const violations: Omit<RedTeamSandboxViolation, "violation_id">[] = [];
  collectUnsafeFields(input, "$", null, violations);
  const parsed = RedTeamRunProposalSchema.safeParse(input);

  if (!parsed.success) {
    violations.push(
      violation({
        reason: "metadata_contract_rejected",
        path: "$",
        fieldName: null,
      }),
    );
    return validationResult(violations);
  }

  const value = parsed.data;
  validateTarget(value.target, "$.target", violations);
  if (
    !RED_TEAM_SUPPORTED_ACTION_CLASSES.includes(value.action_class as never)
  ) {
    violations.push(
      violation({
        reason: "forbidden_action_class",
        path: "$.action_class",
        fieldName: "action_class",
      }),
    );
  }
  validateApprovalMetadata(
    value.approval_metadata,
    "$.approval_metadata",
    violations,
  );
  if (
    !value.dry_run_required ||
    value.execution_enabled ||
    value.network_scan_enabled ||
    value.shell_commands_included ||
    value.executable_payload_included ||
    value.credentials_included ||
    value.secrets_included ||
    value.phase_18_bypass_enabled
  ) {
    violations.push(
      violation({
        reason: "approval_bypass_attempt",
        path: "$",
        fieldName: "disabled_authority",
      }),
    );
  }

  return validationResult(violations);
}

export function buildRedTeamRunPlan(
  proposalValue: RedTeamRunProposal,
): RedTeamRunPlan {
  return RedTeamRunPlanSchema.parse({
    plan_id: `red-team-plan:${proposalValue.proposal_id.replace(
      "red-team-proposal:",
      "",
    )}`,
    proposal_id: proposalValue.proposal_id,
    target_scope: proposalValue.target.scope,
    action_class: proposalValue.action_class,
    approval_metadata: proposalValue.approval_metadata,
    dry_run_first: true,
    plan_steps_metadata: [
      "validate target scope metadata",
      "validate action class metadata",
      "prepare dry-run-only review metadata",
    ],
    execution_enabled: false,
    command_execution_enabled: false,
    network_scan_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
    repo_mutation_enabled: false,
    metadata_only: true,
    read_only: true,
    deterministic: true,
  });
}

export function validateRedTeamRunPlan(
  input: unknown,
): RedTeamSandboxValidationResult {
  const violations: Omit<RedTeamSandboxViolation, "violation_id">[] = [];
  collectUnsafeFields(input, "$", null, violations);
  const parsed = RedTeamRunPlanSchema.safeParse(input);

  if (!parsed.success) {
    violations.push(
      violation({
        reason: "metadata_contract_rejected",
        path: "$",
        fieldName: null,
      }),
    );
    return validationResult(violations);
  }

  const value = parsed.data;
  if (!value.dry_run_first) {
    violations.push(
      violation({
        reason: "non_dry_run_plan",
        path: "$.dry_run_first",
        fieldName: "dry_run_first",
      }),
    );
  }
  if (!RED_TEAM_SUPPORTED_TARGET_SCOPES.includes(value.target_scope as never)) {
    violations.push(
      violation({
        reason: "forbidden_target_scope",
        path: "$.target_scope",
        fieldName: "target_scope",
      }),
    );
  }
  if (
    !RED_TEAM_SUPPORTED_ACTION_CLASSES.includes(value.action_class as never)
  ) {
    violations.push(
      violation({
        reason: "forbidden_action_class",
        path: "$.action_class",
        fieldName: "action_class",
      }),
    );
  }
  validateApprovalMetadata(
    value.approval_metadata,
    "$.approval_metadata",
    violations,
  );

  return validationResult(violations);
}

export function buildRedTeamAuditPreview(
  proposalValue: RedTeamRunProposal,
): RedTeamAuditPreview {
  const validation = validateRedTeamRunProposal(proposalValue);
  return RedTeamAuditPreviewSchema.parse({
    audit_preview_id: `red-team-audit:${proposalValue.proposal_id.replace(
      "red-team-proposal:",
      "",
    )}`,
    proposal_id: proposalValue.proposal_id,
    verdict: validation.verdict,
    target_scope: proposalValue.target.scope,
    action_class: proposalValue.action_class,
    violation_reason_codes: validation.violations.map(
      (item) => item.reason_code,
    ),
    disabled_authority_flags: RED_TEAM_DISABLED_AUTHORITY_FLAGS,
    approval_required: true,
    dry_run_first_required: true,
    raw_payload_included: false,
    shell_commands_included: false,
    secrets_included: false,
    metadata_only: true,
    read_only: true,
    redaction_safe: true,
    deterministic: true,
  });
}

export function validateRedTeamAuditPreview(
  input: unknown,
): RedTeamSandboxValidationResult {
  const violations: Omit<RedTeamSandboxViolation, "violation_id">[] = [];
  collectUnsafeFields(input, "$", null, violations);
  const parsed = RedTeamAuditPreviewSchema.safeParse(input);

  if (!parsed.success) {
    violations.push(
      violation({
        reason: "metadata_contract_rejected",
        path: "$",
        fieldName: null,
      }),
    );
    return validationResult(violations);
  }

  const value = parsed.data;
  if (
    !value.metadata_only ||
    !value.read_only ||
    !value.redaction_safe ||
    value.raw_payload_included ||
    value.shell_commands_included ||
    value.secrets_included
  ) {
    violations.push(
      violation({
        reason: "raw_payload_detected",
        path: "$",
        fieldName: "audit_preview",
      }),
    );
  }

  return validationResult(violations);
}
