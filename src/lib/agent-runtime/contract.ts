import { z } from "zod";

export const AGENT_RUNTIME_CONTRACT_VERSION =
  "phase21h.agent-runtime-contract.v1" as const;

export const EXPANSION_ERA_AGENT_IDS = [
  "life_coach",
  "build_monitor",
  "research_agent",
  "cv_maintenance",
  "application_tracker",
  "deadline_agent",
  "cost_monitor",
  "health_agent",
] as const;

export const AGENT_RUNTIME_SCHEDULE_CLASSES = [
  "manual_only",
  "foreground_tick_candidate",
  "user_initiated",
  "disabled",
] as const;

export const AGENT_OUTPUT_TYPES = [
  "digest",
  "report",
  "recommendation",
  "draft",
  "alert",
] as const;

export const AGENT_AUTHORITY_LEVELS = [
  "observe_only",
  "suggest_only",
  "proposal_only",
] as const;

export const AGENT_DECLARED_SOURCE_KINDS = [
  "obsidian",
  "google_gmail",
  "google_calendar",
  "google_drive",
  "github",
  "telemetry",
  "model_calls",
  "project_registry",
  "manual_input",
] as const;

export const AGENT_RISK_CLASSES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const AGENT_OUTPUT_VALIDATION_REASONS = [
  "valid_output",
  "invalid_output",
  "agent_contract_mismatch",
  "undeclared_source",
  "suggestion_inbox_bypass",
  "execution_authority_forbidden",
  "proposal_output_requires_approval",
  "verification_metadata_required",
] as const;

const AgentIdSchema = z.enum(EXPANSION_ERA_AGENT_IDS);

const RuntimeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const AgentRuntimeScheduleClassSchema = z.enum(
  AGENT_RUNTIME_SCHEDULE_CLASSES,
);
export const AgentOutputTypeSchema = z.enum(AGENT_OUTPUT_TYPES);
export const AgentAuthorityLevelSchema = z.enum(AGENT_AUTHORITY_LEVELS);
export const AgentDeclaredSourceKindSchema = z.enum(
  AGENT_DECLARED_SOURCE_KINDS,
);
export const AgentRiskClassSchema = z.enum(AGENT_RISK_CLASSES);
export const AgentOutputValidationReasonSchema = z.enum(
  AGENT_OUTPUT_VALIDATION_REASONS,
);

export const AgentDeclaredSourceSchema = z.strictObject({
  source_kind: AgentDeclaredSourceKindSchema,
  source_id: RuntimeIdSchema,
  read_scope: z.enum(["metadata_only", "bounded_snippet", "derived_index"]),
  raw_body_allowed: z.literal(false),
  secret_access_allowed: z.literal(false),
  network_call_allowed: z.literal(false),
  write_access_allowed: z.literal(false),
  cross_agent_read_allowed: z.literal(false),
});

export const AgentSuggestionInboxTargetSchema = z.strictObject({
  target: z.literal("suggestion_inbox"),
  output_routed_to_inbox: z.literal(true),
  direct_execution_allowed: z.literal(false),
  inbox_only: z.literal(true),
  metadata_only: z.literal(true),
});

export const AgentApprovalIntegrationSchema = z.strictObject({
  phase18_lifecycle_required: z.boolean(),
  requires_approval: z.boolean(),
  approval_status: z.enum([
    "not_required",
    "not_requested",
    "pending",
    "approved",
    "denied",
    "expired",
  ]),
  approval_bypass_allowed: z.literal(false),
  approval_created: z.literal(false),
  execution_enabled: z.literal(false),
  metadata_only: z.literal(true),
});

export const AgentVerificationIntegrationSchema = z.strictObject({
  verification_supported: z.literal(true),
  verification_required: z.boolean(),
  verification_requested: z.boolean(),
  verification_status: z.enum([
    "not_required",
    "not_requested",
    "pending",
    "completed_metadata_only",
    "failed_closed",
  ]),
  verifier_ref_id: RuntimeIdSchema.nullable().default(null),
  raw_verifier_response_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const AgentRuntimeGovernanceSchema = z.strictObject({
  execution_authority: z.literal(false),
  scheduler_implementation_enabled: z.literal(false),
  background_daemon_enabled: z.literal(false),
  model_call_enabled: z.literal(false),
  gmail_call_enabled: z.literal(false),
  calendar_call_enabled: z.literal(false),
  drive_call_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
  obsidian_write_enabled: z.literal(false),
  vault_write_enabled: z.literal(false),
  cross_agent_read_enabled: z.literal(false),
  suggestion_inbox_required: z.literal(true),
  approval_lifecycle_required_for_proposals: z.literal(true),
  metadata_only: z.literal(true),
});

export const AgentRuntimeContractSchema = z
  .strictObject({
    id: AgentIdSchema,
    version: z.literal(AGENT_RUNTIME_CONTRACT_VERSION),
    owner: z.string().trim().min(1).max(120),
    schedule_class: AgentRuntimeScheduleClassSchema,
    declared_sources: z.array(AgentDeclaredSourceSchema).min(1),
    output_type: AgentOutputTypeSchema,
    risk_class: AgentRiskClassSchema,
    authority: AgentAuthorityLevelSchema,
    requires_verification: z.boolean(),
    requires_approval: z.boolean(),
    inbox_target: z.literal("suggestion_inbox"),
    governance: AgentRuntimeGovernanceSchema,
  })
  .superRefine((contract, context) => {
    if (contract.authority === "proposal_only" && !contract.requires_approval) {
      context.addIssue({
        code: "custom",
        message: "proposal_only agents require approval metadata.",
        path: ["requires_approval"],
      });
    }
    if (contract.risk_class === "critical" && !contract.requires_verification) {
      context.addIssue({
        code: "custom",
        message: "critical-risk agents require verification metadata.",
        path: ["requires_verification"],
      });
    }
  });

export const AgentOutputSourceReferenceSchema = z.strictObject({
  source_kind: AgentDeclaredSourceKindSchema,
  source_id: RuntimeIdSchema,
  content_hash: HashReferenceSchema.nullable().default(null),
  declared_in_contract: z.literal(true),
  raw_body_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const AgentOutputSchema = z
  .strictObject({
    output_id: RuntimeIdSchema,
    agent_id: AgentIdSchema,
    contract_version: z.literal(AGENT_RUNTIME_CONTRACT_VERSION),
    output_type: AgentOutputTypeSchema,
    authority: AgentAuthorityLevelSchema,
    risk_class: AgentRiskClassSchema,
    implies_action: z.boolean(),
    summary_hash: HashReferenceSchema,
    source_refs: z.array(AgentOutputSourceReferenceSchema),
    suggestion_inbox: AgentSuggestionInboxTargetSchema,
    approval: AgentApprovalIntegrationSchema,
    verification: AgentVerificationIntegrationSchema,
    created_at: z.string().trim().datetime({ offset: true }),
    metadata_only: z.literal(true),
    raw_output_body_included: z.literal(false),
    direct_execution_attempted: z.literal(false),
    action_executed: z.literal(false),
    schedule_created: z.literal(false),
    model_called: z.literal(false),
    network_called: z.literal(false),
    obsidian_written: z.literal(false),
  })
  .superRefine((output, context) => {
    if (output.implies_action && output.authority !== "proposal_only") {
      context.addIssue({
        code: "custom",
        message: "action-implying outputs must be proposal_only.",
        path: ["authority"],
      });
    }
    if (
      output.authority === "proposal_only" &&
      (!output.approval.requires_approval ||
        !output.approval.phase18_lifecycle_required)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "proposal outputs require Phase 18 approval lifecycle metadata.",
        path: ["approval"],
      });
    }
    if (
      output.verification.verification_required &&
      !output.verification.verification_supported
    ) {
      context.addIssue({
        code: "custom",
        message: "required verification must be supported.",
        path: ["verification"],
      });
    }
  });

export const AgentOutputValidationSchema = z.strictObject({
  valid: z.boolean(),
  agent_id: AgentIdSchema.nullable(),
  output_id: RuntimeIdSchema.nullable(),
  reasons: z.array(AgentOutputValidationReasonSchema),
  suggestion_inbox_target: z.literal("suggestion_inbox"),
  execution_authority: z.literal(false),
  schedule_created: z.literal(false),
  write_attempted: z.literal(false),
  network_called: z.literal(false),
  model_called: z.literal(false),
  metadata_only: z.literal(true),
});

export type AgentRuntimeContract = z.infer<typeof AgentRuntimeContractSchema>;
export type AgentDeclaredSource = z.infer<typeof AgentDeclaredSourceSchema>;
export type AgentOutput = z.infer<typeof AgentOutputSchema>;
export type AgentOutputValidation = z.infer<typeof AgentOutputValidationSchema>;
export type AgentOutputType = z.infer<typeof AgentOutputTypeSchema>;
export type AgentAuthorityLevel = z.infer<typeof AgentAuthorityLevelSchema>;
export type AgentDeclaredSourceKind = z.infer<
  typeof AgentDeclaredSourceKindSchema
>;
export type AgentRiskClass = z.infer<typeof AgentRiskClassSchema>;

export const AGENT_RUNTIME_GOVERNANCE_DEFAULTS =
  AgentRuntimeGovernanceSchema.parse({
    execution_authority: false,
    scheduler_implementation_enabled: false,
    background_daemon_enabled: false,
    model_call_enabled: false,
    gmail_call_enabled: false,
    calendar_call_enabled: false,
    drive_call_enabled: false,
    network_call_enabled: false,
    obsidian_write_enabled: false,
    vault_write_enabled: false,
    cross_agent_read_enabled: false,
    suggestion_inbox_required: true,
    approval_lifecycle_required_for_proposals: true,
    metadata_only: true,
  });

export function createAgentRuntimeContract(
  input: unknown,
): AgentRuntimeContract {
  return AgentRuntimeContractSchema.parse(input);
}

export function createAgentOutput(input: unknown): AgentOutput {
  return AgentOutputSchema.parse(input);
}

export function validateAgentOutputAgainstContract(
  contractInput: unknown,
  outputInput: unknown,
): AgentOutputValidation {
  const contract = AgentRuntimeContractSchema.safeParse(contractInput);
  const output = AgentOutputSchema.safeParse(outputInput);
  if (!contract.success || !output.success) {
    return validationResult({
      valid: false,
      agentId: output.success ? output.data.agent_id : null,
      outputId: output.success ? output.data.output_id : null,
      reasons: ["invalid_output"],
    });
  }

  const reasons: z.infer<typeof AgentOutputValidationReasonSchema>[] = [];
  if (output.data.agent_id !== contract.data.id) {
    reasons.push("agent_contract_mismatch");
  }
  if (!output.data.suggestion_inbox.output_routed_to_inbox) {
    reasons.push("suggestion_inbox_bypass");
  }
  if (
    output.data.direct_execution_attempted ||
    output.data.action_executed ||
    (output.data.authority === "proposal_only" &&
      !output.data.approval.requires_approval)
  ) {
    reasons.push("execution_authority_forbidden");
  }
  if (
    output.data.authority === "proposal_only" &&
    (!output.data.approval.requires_approval ||
      !output.data.approval.phase18_lifecycle_required)
  ) {
    reasons.push("proposal_output_requires_approval");
  }
  if (
    contract.data.requires_verification &&
    !output.data.verification.verification_required
  ) {
    reasons.push("verification_metadata_required");
  }

  const declared = new Set(
    contract.data.declared_sources.map(
      (source) => `${source.source_kind}:${source.source_id}`,
    ),
  );
  for (const source of output.data.source_refs) {
    if (!declared.has(`${source.source_kind}:${source.source_id}`)) {
      reasons.push("undeclared_source");
      break;
    }
  }

  return validationResult({
    valid: reasons.length === 0,
    agentId: output.data.agent_id,
    outputId: output.data.output_id,
    reasons: reasons.length ? reasons : ["valid_output"],
  });
}

function validationResult(input: {
  readonly valid: boolean;
  readonly agentId: AgentOutput["agent_id"] | null;
  readonly outputId: string | null;
  readonly reasons: readonly z.infer<
    typeof AgentOutputValidationReasonSchema
  >[];
}): AgentOutputValidation {
  return AgentOutputValidationSchema.parse({
    valid: input.valid,
    agent_id: input.agentId,
    output_id: input.outputId,
    reasons: [...new Set(input.reasons)],
    suggestion_inbox_target: "suggestion_inbox",
    execution_authority: false,
    schedule_created: false,
    write_attempted: false,
    network_called: false,
    model_called: false,
    metadata_only: true,
  });
}
