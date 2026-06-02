import { z } from "zod";
import {
  AgentApprovalIntegrationSchema,
  AgentOutputSourceReferenceSchema,
  AgentOutputTypeSchema,
  AgentRiskClassSchema,
  AgentSuggestionInboxTargetSchema,
  AgentVerificationIntegrationSchema,
} from "./contract";
import {
  AgentDryRunEnvelopeSchema,
  AgentDryRunFixtureMetadataSchema,
} from "./dry-run-executor";
import { AgentRegistryEntrySchema } from "./registry";

export const AGENT_OUTPUT_FACTORY_VERSION =
  "phase21h.agent-output-factory.v1" as const;

export const AGENT_OUTPUT_PRIORITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const AGENT_OUTPUT_FACTORY_REASONS = [
  "preview_created",
  "planned_dry_run_required",
  "registry_agent_mismatch",
  "output_type_mismatch",
  "metadata_only",
  "inbox_write_forbidden",
] as const;

const OutputIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const PreviewTextSchema = z.string().trim().min(1).max(280);

export const AgentOutputPrioritySchema = z.enum(AGENT_OUTPUT_PRIORITIES);
export const AgentOutputFactoryReasonSchema = z.enum(
  AGENT_OUTPUT_FACTORY_REASONS,
);

export const AgentSpecificPreviewMetadataSchema = z.strictObject({
  agent_id: AgentRegistryEntrySchema.shape.id,
  display_name: PreviewTextSchema,
  preview_scope: z.enum([
    "life_context",
    "build_status",
    "research_metadata",
    "career_material",
    "application_metadata",
    "deadline_metadata",
    "cost_metadata",
    "health_metadata",
  ]),
  real_agent_logic_used: z.literal(false),
  metadata_only: z.literal(true),
});

export const AgentOutputPreviewGovernanceSchema = z.strictObject({
  preview_only: z.literal(true),
  inbox_write_attempted: z.literal(false),
  execution_attempted: z.literal(false),
  source_reads_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  approval_bypass_attempted: z.literal(false),
  obsidian_read_attempted: z.literal(false),
  obsidian_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const AgentOutputFactoryInputSchema = z.strictObject({
  factory_version: z.literal(AGENT_OUTPUT_FACTORY_VERSION),
  dry_run: AgentDryRunEnvelopeSchema,
  registry_entry: AgentRegistryEntrySchema,
  fixture_metadata: AgentDryRunFixtureMetadataSchema.nullable().default(null),
  metadata_only: z.literal(true),
  inbox_write_requested: z.literal(false),
  execute_real_agent_requested: z.literal(false),
  source_reads_requested: z.literal(false),
  model_call_requested: z.literal(false),
});

export const AgentOutputPreviewSchema = z.strictObject({
  factory_version: z.literal(AGENT_OUTPUT_FACTORY_VERSION),
  output_id: OutputIdSchema,
  agent_id: AgentRegistryEntrySchema.shape.id,
  output_type: AgentOutputTypeSchema,
  title: PreviewTextSchema,
  summary: PreviewTextSchema,
  priority: AgentOutputPrioritySchema,
  risk_class: AgentRiskClassSchema,
  suggested_inbox_target: z.literal("suggestion_inbox"),
  suggestion_inbox: AgentSuggestionInboxTargetSchema,
  source_refs: z.array(AgentOutputSourceReferenceSchema),
  verification_metadata: AgentVerificationIntegrationSchema,
  approval_metadata: AgentApprovalIntegrationSchema,
  agent_metadata: AgentSpecificPreviewMetadataSchema,
  fixture_metadata: AgentDryRunFixtureMetadataSchema.nullable(),
  reasons: z.array(AgentOutputFactoryReasonSchema),
  preview_only: z.literal(true),
  inbox_write_attempted: z.literal(false),
  execution_attempted: z.literal(false),
  source_reads_attempted: z.literal(false),
  metadata_only: z.literal(true),
  raw_source_body_included: z.literal(false),
  model_prompt_included: z.literal(false),
  generated_body_included: z.literal(false),
  governance: AgentOutputPreviewGovernanceSchema,
});

export type AgentOutputPriority = z.infer<typeof AgentOutputPrioritySchema>;
export type AgentOutputFactoryReason = z.infer<
  typeof AgentOutputFactoryReasonSchema
>;
export type AgentSpecificPreviewMetadata = z.infer<
  typeof AgentSpecificPreviewMetadataSchema
>;
export type AgentOutputFactoryInput = z.infer<
  typeof AgentOutputFactoryInputSchema
>;
export type AgentOutputPreview = z.infer<typeof AgentOutputPreviewSchema>;

export function createAgentOutputPreview(input: unknown): AgentOutputPreview {
  const parsed = AgentOutputFactoryInputSchema.parse(input);
  const dryRun = parsed.dry_run;
  const registryEntry = parsed.registry_entry;
  const registryAgentMismatch = registryEntry.id !== dryRun.agent_id;
  const outputTypeMismatch =
    registryEntry.output_type !== dryRun.planned_output_type;

  if (dryRun.status !== "planned") {
    throw new Error("planned dry-run envelope required for output preview.");
  }
  if (registryAgentMismatch) {
    throw new Error("registry entry must match dry-run agent id.");
  }
  if (outputTypeMismatch) {
    throw new Error("registry output type must match dry-run output type.");
  }

  return AgentOutputPreviewSchema.parse({
    factory_version: AGENT_OUTPUT_FACTORY_VERSION,
    output_id: `preview:${dryRun.agent_id}:${dryRun.planned_output_type}`,
    agent_id: dryRun.agent_id,
    output_type: dryRun.planned_output_type,
    title: titleFor(registryEntry),
    summary: summaryFor(registryEntry),
    priority: priorityFor(registryEntry.risk_class, dryRun.planned_output_type),
    risk_class: registryEntry.risk_class,
    suggested_inbox_target: "suggestion_inbox",
    suggestion_inbox: {
      target: "suggestion_inbox",
      output_routed_to_inbox: true,
      direct_execution_allowed: false,
      inbox_only: true,
      metadata_only: true,
    },
    source_refs: dryRun.selected_sources.map((source) => ({
      source_kind: source.source.source_kind,
      source_id: source.source.source_id,
      content_hash: null,
      declared_in_contract: true,
      raw_body_included: false,
      metadata_only: true,
    })),
    verification_metadata: {
      verification_supported: true,
      verification_required: dryRun.verification_required,
      verification_requested: false,
      verification_status: dryRun.verification_required
        ? "not_requested"
        : "not_required",
      verifier_ref_id: null,
      raw_verifier_response_included: false,
      metadata_only: true,
    },
    approval_metadata: {
      phase18_lifecycle_required: dryRun.approval_lifecycle_required,
      requires_approval: dryRun.approval_required,
      approval_status: dryRun.approval_required
        ? "not_requested"
        : "not_required",
      approval_bypass_allowed: false,
      approval_created: false,
      execution_enabled: false,
      metadata_only: true,
    },
    agent_metadata: metadataFor(registryEntry.id),
    fixture_metadata: parsed.fixture_metadata ?? dryRun.fixture_metadata,
    reasons: ["preview_created", "metadata_only", "inbox_write_forbidden"],
    preview_only: true,
    inbox_write_attempted: false,
    execution_attempted: false,
    source_reads_attempted: false,
    metadata_only: true,
    raw_source_body_included: false,
    model_prompt_included: false,
    generated_body_included: false,
    governance: governanceSummary(),
  });
}

function titleFor(registryEntry: z.infer<typeof AgentRegistryEntrySchema>) {
  return `${metadataFor(registryEntry.id).display_name} ${registryEntry.output_type} preview`;
}

function summaryFor(registryEntry: z.infer<typeof AgentRegistryEntrySchema>) {
  return `${metadataFor(registryEntry.id).display_name} metadata-only ${registryEntry.output_type} preview.`;
}

function priorityFor(
  riskClass: z.infer<typeof AgentRiskClassSchema>,
  outputType: z.infer<typeof AgentOutputTypeSchema>,
): AgentOutputPriority {
  if (riskClass === "critical") return "critical";
  if (riskClass === "high" || outputType === "alert") return "high";
  if (riskClass === "medium") return "medium";
  return "low";
}

function metadataFor(
  agentId: z.infer<typeof AgentRegistryEntrySchema.shape.id>,
): AgentSpecificPreviewMetadata {
  const metadata = {
    life_coach: {
      agent_id: "life_coach",
      display_name: "Life Coach",
      preview_scope: "life_context",
    },
    build_monitor: {
      agent_id: "build_monitor",
      display_name: "Build Monitor",
      preview_scope: "build_status",
    },
    research_agent: {
      agent_id: "research_agent",
      display_name: "Research Agent",
      preview_scope: "research_metadata",
    },
    cv_maintenance: {
      agent_id: "cv_maintenance",
      display_name: "CV Maintenance",
      preview_scope: "career_material",
    },
    application_tracker: {
      agent_id: "application_tracker",
      display_name: "Application Tracker",
      preview_scope: "application_metadata",
    },
    deadline_agent: {
      agent_id: "deadline_agent",
      display_name: "Deadline Agent",
      preview_scope: "deadline_metadata",
    },
    cost_monitor: {
      agent_id: "cost_monitor",
      display_name: "Cost Monitor",
      preview_scope: "cost_metadata",
    },
    health_agent: {
      agent_id: "health_agent",
      display_name: "Health Agent",
      preview_scope: "health_metadata",
    },
  }[agentId];
  return AgentSpecificPreviewMetadataSchema.parse({
    ...metadata,
    real_agent_logic_used: false,
    metadata_only: true,
  });
}

function governanceSummary() {
  return AgentOutputPreviewGovernanceSchema.parse({
    preview_only: true,
    inbox_write_attempted: false,
    execution_attempted: false,
    source_reads_attempted: false,
    model_call_attempted: false,
    network_call_attempted: false,
    scheduling_attempted: false,
    approval_bypass_attempted: false,
    obsidian_read_attempted: false,
    obsidian_write_attempted: false,
    metadata_only: true,
  });
}
