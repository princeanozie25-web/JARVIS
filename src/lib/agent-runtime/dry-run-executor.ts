import { z } from "zod";
import { AgentAuthorityLevelSchema, AgentOutputTypeSchema } from "./contract";
import { AgentRegistryEntrySchema } from "./registry";
import {
  AgentRunEligibilitySchema,
  AgentRunPlanSchema,
  AgentSourceReadPlanSchema,
  type AgentRunPlan,
} from "./planner";

export const AGENT_DRY_RUN_EXECUTOR_VERSION =
  "phase21h.agent-dry-run-executor.v1" as const;

export const AGENT_DRY_RUN_STATUSES = [
  "planned",
  "skipped",
  "rejected",
] as const;

export const AGENT_DRY_RUN_REASONS = [
  "planned_from_eligible_agent_plan",
  "skipped_by_agent_plan",
  "rejected_by_agent_plan",
  "registry_agent_mismatch",
  "planned_output_not_allowed",
  "dry_run_only",
  "metadata_only",
  "source_reads_forbidden",
] as const;

const DryRunIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const AgentDryRunStatusSchema = z.enum(AGENT_DRY_RUN_STATUSES);
export const AgentDryRunReasonSchema = z.enum(AGENT_DRY_RUN_REASONS);

export const AgentDryRunFixtureMetadataSchema = z.strictObject({
  fixture_id: DryRunIdSchema,
  fixture_hash: HashReferenceSchema.nullable().default(null),
  metadata_record_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
  model_prompt_included: z.literal(false),
});

export const AgentDryRunGovernanceSchema = z.strictObject({
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  source_reads_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  suggestion_inbox_write_attempted: z.literal(false),
  approval_bypass_attempted: z.literal(false),
  obsidian_read_attempted: z.literal(false),
  obsidian_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const AgentDryRunExecutorInputSchema = z.strictObject({
  executor_version: z.literal(AGENT_DRY_RUN_EXECUTOR_VERSION),
  plan: AgentRunPlanSchema,
  registry_entry: AgentRegistryEntrySchema,
  fixture_metadata: AgentDryRunFixtureMetadataSchema.nullable().default(null),
  metadata_only: z.literal(true),
  execute_real_agent_requested: z.literal(false),
  source_reads_requested: z.literal(false),
  suggestion_inbox_write_requested: z.literal(false),
});

export const AgentDryRunEnvelopeSchema = z.strictObject({
  executor_version: z.literal(AGENT_DRY_RUN_EXECUTOR_VERSION),
  dry_run_id: DryRunIdSchema,
  status: AgentDryRunStatusSchema,
  reasons: z.array(AgentDryRunReasonSchema),
  agent_id: AgentRegistryEntrySchema.shape.id,
  eligibility: AgentRunEligibilitySchema,
  selected_sources: z.array(AgentSourceReadPlanSchema),
  planned_output_type: AgentOutputTypeSchema,
  authority_class: AgentAuthorityLevelSchema,
  verification_required: z.boolean(),
  approval_required: z.boolean(),
  approval_lifecycle_required: z.boolean(),
  suggested_inbox_target: z.literal("suggestion_inbox"),
  fixture_metadata: AgentDryRunFixtureMetadataSchema.nullable(),
  governance: AgentDryRunGovernanceSchema,
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  source_reads_attempted: z.literal(false),
  metadata_only: z.literal(true),
  raw_source_body_included: z.literal(false),
  model_prompt_included: z.literal(false),
  generated_digest_body_included: z.literal(false),
});

export type AgentDryRunStatus = z.infer<typeof AgentDryRunStatusSchema>;
export type AgentDryRunReason = z.infer<typeof AgentDryRunReasonSchema>;
export type AgentDryRunFixtureMetadata = z.infer<
  typeof AgentDryRunFixtureMetadataSchema
>;
export type AgentDryRunExecutorInput = z.infer<
  typeof AgentDryRunExecutorInputSchema
>;
export type AgentDryRunEnvelope = z.infer<typeof AgentDryRunEnvelopeSchema>;

export function executeAgentDryRun(input: unknown): AgentDryRunEnvelope {
  const parsed = AgentDryRunExecutorInputSchema.parse(input);
  const plan = parsed.plan;
  const registryEntry = parsed.registry_entry;
  const registryAgentMismatch = registryEntry.id !== plan.agent_id;
  const plannedOutputAllowed = registryEntry.allowed_output_types.includes(
    plan.output_type,
  );
  const status = dryRunStatus({
    plan,
    registryAgentMismatch,
    plannedOutputAllowed,
  });

  return AgentDryRunEnvelopeSchema.parse({
    executor_version: AGENT_DRY_RUN_EXECUTOR_VERSION,
    dry_run_id: `dry-run:${plan.agent_id}:${status}:${plan.output_type}`,
    status,
    reasons: reasonsFor({
      status,
      registryAgentMismatch,
      plannedOutputAllowed,
    }),
    agent_id: plan.agent_id,
    eligibility: plan.eligibility,
    selected_sources: plan.selected_sources.filter((source) => source.selected),
    planned_output_type: plan.output_type,
    authority_class: plan.authority,
    verification_required: plan.requires_verification,
    approval_required: plan.requires_approval,
    approval_lifecycle_required: plan.approval_lifecycle_required,
    suggested_inbox_target: "suggestion_inbox",
    fixture_metadata: parsed.fixture_metadata,
    governance: governanceSummary(),
    execution_attempted: false,
    write_attempted: false,
    source_reads_attempted: false,
    metadata_only: true,
    raw_source_body_included: false,
    model_prompt_included: false,
    generated_digest_body_included: false,
  });
}

function dryRunStatus(input: {
  readonly plan: AgentRunPlan;
  readonly registryAgentMismatch: boolean;
  readonly plannedOutputAllowed: boolean;
}): AgentDryRunStatus {
  if (input.registryAgentMismatch || !input.plannedOutputAllowed) {
    return "rejected";
  }
  if (input.plan.eligibility === "eligible") {
    return "planned";
  }
  if (input.plan.eligibility === "skipped") {
    return "skipped";
  }
  return "rejected";
}

function reasonsFor(input: {
  readonly status: AgentDryRunStatus;
  readonly registryAgentMismatch: boolean;
  readonly plannedOutputAllowed: boolean;
}): AgentDryRunReason[] {
  return unique([
    input.status === "planned"
      ? "planned_from_eligible_agent_plan"
      : "dry_run_only",
    input.status === "skipped" ? "skipped_by_agent_plan" : "dry_run_only",
    input.status === "rejected" ? "rejected_by_agent_plan" : "dry_run_only",
    input.registryAgentMismatch ? "registry_agent_mismatch" : "metadata_only",
    !input.plannedOutputAllowed
      ? "planned_output_not_allowed"
      : "metadata_only",
    "dry_run_only",
    "metadata_only",
    "source_reads_forbidden",
  ]);
}

function governanceSummary() {
  return AgentDryRunGovernanceSchema.parse({
    execution_attempted: false,
    write_attempted: false,
    source_reads_attempted: false,
    model_call_attempted: false,
    network_call_attempted: false,
    scheduling_attempted: false,
    suggestion_inbox_write_attempted: false,
    approval_bypass_attempted: false,
    obsidian_read_attempted: false,
    obsidian_write_attempted: false,
    metadata_only: true,
  });
}

function unique<const T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
