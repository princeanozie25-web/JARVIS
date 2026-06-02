import { z } from "zod";
import {
  AgentAuthorityLevelSchema,
  AgentDeclaredSourceKindSchema,
  AgentDeclaredSourceSchema,
  AgentOutputTypeSchema,
  type AgentDeclaredSource,
  type AgentOutputType,
  type AgentRuntimeContract,
} from "./contract";
import {
  AgentRegistryEntrySchema,
  getAgentRegistryEntry,
  type AgentRegistryEntry,
} from "./registry";

export const AGENT_PLANNER_VERSION = "phase21h.agent-planner.v1" as const;

export const AGENT_RUN_CONTEXTS = [
  "manual",
  "scheduled",
  "event_driven",
] as const;

export const AGENT_RUN_ELIGIBILITY = [
  "eligible",
  "ineligible",
  "skipped",
] as const;

export const AGENT_PLANNER_REASONS = [
  "eligible",
  "agent_disabled",
  "scheduled_context_not_implemented",
  "event_context_missing_trigger",
  "manual_context_allowed",
  "declared_sources_selected",
  "requested_source_undeclared",
  "requested_output_undeclared",
  "proposal_requires_approval",
  "critical_requires_verification",
  "metadata_only",
] as const;

export const AGENT_PLANNER_WARNINGS = [
  "scheduled_context_metadata_only",
  "event_trigger_metadata_only",
  "source_filtered_to_declared_registry",
  "approval_metadata_required",
  "verification_metadata_required",
] as const;

const PlannerIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

export const AgentRunContextSchema = z.enum(AGENT_RUN_CONTEXTS);
export const AgentRunEligibilitySchema = z.enum(AGENT_RUN_ELIGIBILITY);
export const AgentPlannerReasonSchema = z.enum(AGENT_PLANNER_REASONS);
export const AgentPlannerWarningSchema = z.enum(AGENT_PLANNER_WARNINGS);

export const AgentAvailableMetadataSourceSchema = z.strictObject({
  source_kind: AgentDeclaredSourceKindSchema,
  source_id: PlannerIdSchema,
  available: z.boolean(),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const AgentRunTriggerMetadataSchema = z.strictObject({
  trigger_id: PlannerIdSchema,
  trigger_kind: z.enum(["manual", "scheduled_tick", "event_metadata"]),
  source_ref_hash: HashReferenceSchema.nullable().default(null),
  metadata_only: z.literal(true),
  raw_trigger_body_included: z.literal(false),
});

export const AgentPlannerInputSchema = z.strictObject({
  planner_version: z.literal(AGENT_PLANNER_VERSION),
  agent_id: AgentRegistryEntrySchema.shape.id,
  registry_entry: AgentRegistryEntrySchema.optional(),
  run_context: AgentRunContextSchema,
  available_metadata_sources: z.array(AgentAvailableMetadataSourceSchema),
  requested_source_ids: z.array(PlannerIdSchema).default([]),
  requested_output_type: AgentOutputTypeSchema.nullable().default(null),
  trigger_metadata: AgentRunTriggerMetadataSchema.nullable().default(null),
  metadata_only: z.literal(true),
  execution_requested: z.literal(false),
  scheduling_requested: z.literal(false),
  write_requested: z.literal(false),
});

export const AgentSourceReadPlanSchema = z.strictObject({
  source: AgentDeclaredSourceSchema,
  available: z.boolean(),
  selected: z.boolean(),
  reason: z.enum([
    "declared_and_available",
    "declared_but_unavailable",
    "not_requested",
  ]),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const AgentRunGovernanceSchema = z.strictObject({
  execution_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  suggestion_created: z.literal(false),
  approval_bypass_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  write_attempted: z.literal(false),
  obsidian_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const AgentRunPlanSchema = z.strictObject({
  planner_version: z.literal(AGENT_PLANNER_VERSION),
  agent_id: AgentRegistryEntrySchema.shape.id,
  eligibility: AgentRunEligibilitySchema,
  run_context: AgentRunContextSchema,
  selected_sources: z.array(AgentSourceReadPlanSchema),
  output_type: AgentOutputTypeSchema,
  authority: AgentAuthorityLevelSchema,
  requires_verification: z.boolean(),
  requires_approval: z.boolean(),
  approval_lifecycle_required: z.boolean(),
  reasons: z.array(AgentPlannerReasonSchema),
  warnings: z.array(AgentPlannerWarningSchema),
  trigger_metadata: AgentRunTriggerMetadataSchema.nullable(),
  governance: AgentRunGovernanceSchema,
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type AgentRunContext = z.infer<typeof AgentRunContextSchema>;
export type AgentRunEligibility = z.infer<typeof AgentRunEligibilitySchema>;
export type AgentPlannerReason = z.infer<typeof AgentPlannerReasonSchema>;
export type AgentPlannerWarning = z.infer<typeof AgentPlannerWarningSchema>;
export type AgentAvailableMetadataSource = z.infer<
  typeof AgentAvailableMetadataSourceSchema
>;
export type AgentRunTriggerMetadata = z.infer<
  typeof AgentRunTriggerMetadataSchema
>;
export type AgentPlannerInput = z.infer<typeof AgentPlannerInputSchema>;
export type AgentSourceReadPlan = z.infer<typeof AgentSourceReadPlanSchema>;
export type AgentRunPlan = z.infer<typeof AgentRunPlanSchema>;

export function planAgentRun(input: unknown): AgentRunPlan {
  const parsed = AgentPlannerInputSchema.parse(input);
  const registryEntry =
    parsed.registry_entry ?? getAgentRegistryEntry(parsed.agent_id);
  const requestedOutputType =
    parsed.requested_output_type ?? registryEntry.output_type;
  const outputAllowed =
    registryEntry.allowed_output_types.includes(requestedOutputType);
  const requestedSourceIds = new Set(parsed.requested_source_ids);
  const requestedSourceMismatch = parsed.requested_source_ids.some(
    (sourceId) =>
      !registryEntry.declared_sources.some(
        (source) => source.source_id === sourceId,
      ),
  );
  const sourcePlans = sourceReadPlans(
    registryEntry,
    parsed.available_metadata_sources,
    requestedSourceIds,
  );
  const hasSelectedSource = sourcePlans.some((plan) => plan.selected);
  const scheduledBlocked = parsed.run_context === "scheduled";
  const eventMissingTrigger =
    parsed.run_context === "event_driven" && parsed.trigger_metadata === null;
  const proposalRequiresApproval =
    registryEntry.authority === "proposal_only" &&
    registryEntry.requires_approval;
  const verificationRequired = registryEntry.requires_verification;
  const criticalRequiresVerification =
    registryEntry.risk_class === "critical" &&
    registryEntry.requires_verification;
  const eligible =
    outputAllowed &&
    !requestedSourceMismatch &&
    hasSelectedSource &&
    !scheduledBlocked &&
    !eventMissingTrigger;
  const skipped = registryEntry.schedule_class === "disabled";

  return AgentRunPlanSchema.parse({
    planner_version: AGENT_PLANNER_VERSION,
    agent_id: registryEntry.id,
    eligibility: skipped ? "skipped" : eligible ? "eligible" : "ineligible",
    run_context: parsed.run_context,
    selected_sources: sourcePlans,
    output_type: requestedOutputType,
    authority: registryEntry.authority,
    requires_verification: registryEntry.requires_verification,
    requires_approval: registryEntry.requires_approval,
    approval_lifecycle_required:
      registryEntry.authority === "proposal_only" ||
      registryEntry.requires_approval,
    reasons: reasonsFor({
      eligible,
      skipped,
      scheduledBlocked,
      eventMissingTrigger,
      requestedSourceMismatch,
      outputAllowed,
      proposalRequiresApproval,
      criticalRequiresVerification,
      hasSelectedSource,
      runContext: parsed.run_context,
    }),
    warnings: warningsFor({
      runContext: parsed.run_context,
      triggerMetadataPresent: parsed.trigger_metadata !== null,
      requestedSourceMismatch,
      proposalRequiresApproval,
      verificationRequired,
      criticalRequiresVerification,
    }),
    trigger_metadata: parsed.trigger_metadata,
    governance: governanceSummary(),
    execution_attempted: false,
    write_attempted: false,
    metadata_only: true,
  });
}

function sourceReadPlans(
  registryEntry: AgentRegistryEntry,
  availableSources: readonly AgentAvailableMetadataSource[],
  requestedSourceIds: ReadonlySet<string>,
): AgentSourceReadPlan[] {
  const available = new Set(
    availableSources
      .filter((source) => source.available)
      .map((source) => `${source.source_kind}:${source.source_id}`),
  );
  const requestedAll = requestedSourceIds.size === 0;
  return registryEntry.declared_sources.map((source) => {
    const sourceKey = `${source.source_kind}:${source.source_id}`;
    const selected =
      available.has(sourceKey) &&
      (requestedAll || requestedSourceIds.has(source.source_id));
    return AgentSourceReadPlanSchema.parse({
      source,
      available: available.has(sourceKey),
      selected,
      reason: selected
        ? "declared_and_available"
        : available.has(sourceKey)
          ? "not_requested"
          : "declared_but_unavailable",
      metadata_only: true,
      raw_body_included: false,
    });
  });
}

function reasonsFor(input: {
  readonly eligible: boolean;
  readonly skipped: boolean;
  readonly scheduledBlocked: boolean;
  readonly eventMissingTrigger: boolean;
  readonly requestedSourceMismatch: boolean;
  readonly outputAllowed: boolean;
  readonly proposalRequiresApproval: boolean;
  readonly criticalRequiresVerification: boolean;
  readonly hasSelectedSource: boolean;
  readonly runContext: AgentRunContext;
}): AgentPlannerReason[] {
  return unique([
    input.eligible && !input.skipped ? "eligible" : "metadata_only",
    input.skipped ? "agent_disabled" : "metadata_only",
    input.scheduledBlocked
      ? "scheduled_context_not_implemented"
      : "metadata_only",
    input.eventMissingTrigger
      ? "event_context_missing_trigger"
      : "metadata_only",
    input.runContext === "manual" ? "manual_context_allowed" : "metadata_only",
    input.hasSelectedSource ? "declared_sources_selected" : "metadata_only",
    input.requestedSourceMismatch
      ? "requested_source_undeclared"
      : "metadata_only",
    !input.outputAllowed ? "requested_output_undeclared" : "metadata_only",
    input.proposalRequiresApproval
      ? "proposal_requires_approval"
      : "metadata_only",
    input.criticalRequiresVerification
      ? "critical_requires_verification"
      : "metadata_only",
  ]);
}

function warningsFor(input: {
  readonly runContext: AgentRunContext;
  readonly triggerMetadataPresent: boolean;
  readonly requestedSourceMismatch: boolean;
  readonly proposalRequiresApproval: boolean;
  readonly verificationRequired: boolean;
  readonly criticalRequiresVerification: boolean;
}): AgentPlannerWarning[] {
  return unique([
    ...(input.runContext === "scheduled"
      ? ["scheduled_context_metadata_only" as const]
      : []),
    ...(input.runContext === "event_driven" || input.triggerMetadataPresent
      ? ["event_trigger_metadata_only" as const]
      : []),
    ...(input.requestedSourceMismatch
      ? ["source_filtered_to_declared_registry" as const]
      : []),
    ...(input.proposalRequiresApproval
      ? ["approval_metadata_required" as const]
      : []),
    ...(input.verificationRequired || input.criticalRequiresVerification
      ? ["verification_metadata_required" as const]
      : []),
  ]);
}

function governanceSummary() {
  return {
    execution_attempted: false,
    scheduling_attempted: false,
    suggestion_created: false,
    approval_bypass_attempted: false,
    model_call_attempted: false,
    network_call_attempted: false,
    write_attempted: false,
    obsidian_write_attempted: false,
    metadata_only: true,
  };
}

function unique<const T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
