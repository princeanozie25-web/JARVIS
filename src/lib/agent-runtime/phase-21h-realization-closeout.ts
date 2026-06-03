import { z } from "zod";
import { SUGGESTION_INBOX_BRIDGE_VERSION } from "../suggestion-inbox";
import { AGENT_SUITE_SUMMARY_VERSION } from "./agent-suite-summary";
import {
  AGENT_RUNTIME_CONTRACT_VERSION,
  EXPANSION_ERA_AGENT_IDS,
} from "./contract";
import { AGENT_DELIVERY_VERSION } from "./delivery";
import { AGENT_DRY_RUN_EXECUTOR_VERSION } from "./dry-run-executor";
import { AGENT_OUTPUT_FACTORY_VERSION } from "./output-factory";
import { AGENT_PLANNER_VERSION } from "./planner";
import { AGENT_REGISTRY_VERSION } from "./registry";
import { AGENT_SCHEDULED_INVOCATION_VERSION } from "./scheduled-invocation";

export const PHASE21H_REALIZATION_CLOSEOUT_VERSION =
  "phase21h-r.agent-suite-realization-closeout.v1" as const;

const AgentIdSchema = z.enum(EXPANSION_ERA_AGENT_IDS);

export const Phase21HRealizationComponentSchema = z.strictObject({
  component_id: z.string().trim().min(1).max(160),
  version: z.string().trim().min(1).max(160),
  present: z.literal(true),
  posture: z.enum([
    "registry",
    "runtime",
    "planner",
    "output_contracts",
    "preview_suite",
    "inbox_delivery",
    "scheduled_invocation",
    "shared_inbox_bridge",
    "digest_generation",
  ]),
});

export const Phase21HRealizedAgentSchema = z.strictObject({
  agent_id: AgentIdSchema,
  display_name: z.string().trim().min(1).max(120),
  inbox_delivery_supported: z.literal(true),
  scheduled_invocation_supported: z.literal(true),
  source_attribution_supported: z.literal(true),
  execution_authority: z.literal(false),
  approval_finalization_supported: z.literal(false),
  metadata_only: z.literal(true),
});

export const Phase21HRealizationGovernanceSchema = z.strictObject({
  workflow_status: z.literal(
    "Agent Suite realized as scheduled Suggestion Inbox delivery workflow",
  ),
  suggestion_inbox_delivery_exists: z.literal(true),
  scheduled_invocation_exists: z.literal(true),
  digest_generation_exists: z.literal(true),
  no_execution: z.literal(true),
  no_approval_finalization: z.literal(true),
  no_provider_model_calls: z.literal(true),
  no_network_calls: z.literal(true),
  no_autonomous_actions: z.literal(true),
  no_cross_agent_execution: z.literal(true),
  no_self_modification: z.literal(true),
  no_authority_escalation: z.literal(true),
  no_filesystem_writes: z.literal(true),
  no_database_writes: z.literal(true),
  metadata_only: z.literal(true),
  new_authority_surface_added: z.literal(false),
});

export const Phase21HRealizationCloseoutReportSchema = z.strictObject({
  kind: z.literal("agent_runtime.phase21h_realization_closeout"),
  closeout_version: z.literal(PHASE21H_REALIZATION_CLOSEOUT_VERSION),
  status: z.literal(
    "Agent Suite realized as scheduled Suggestion Inbox delivery workflow",
  ),
  realized: z.literal(true),
  foundation_complete: z.literal(true),
  components: z.array(Phase21HRealizationComponentSchema),
  agents: z.array(Phase21HRealizedAgentSchema),
  agent_count: z.number().int().nonnegative(),
  governance: Phase21HRealizationGovernanceSchema,
  readme_safe_wording: z.array(z.string().trim().min(1).max(260)),
  future_work: z.array(z.string().trim().min(1).max(260)),
  deterministic: z.literal(true),
  metadata_only: z.literal(true),
});

export type Phase21HRealizationComponent = z.infer<
  typeof Phase21HRealizationComponentSchema
>;
export type Phase21HRealizedAgent = z.infer<typeof Phase21HRealizedAgentSchema>;
export type Phase21HRealizationGovernance = z.infer<
  typeof Phase21HRealizationGovernanceSchema
>;
export type Phase21HRealizationCloseoutReport = z.infer<
  typeof Phase21HRealizationCloseoutReportSchema
>;

export function buildPhase21HRealizationCloseoutReport(): Phase21HRealizationCloseoutReport {
  const agents = EXPANSION_ERA_AGENT_IDS.map((agentId) =>
    Phase21HRealizedAgentSchema.parse({
      agent_id: agentId,
      display_name: displayNameFor(agentId),
      inbox_delivery_supported: true,
      scheduled_invocation_supported: true,
      source_attribution_supported: true,
      execution_authority: false,
      approval_finalization_supported: false,
      metadata_only: true,
    }),
  );

  return Phase21HRealizationCloseoutReportSchema.parse({
    kind: "agent_runtime.phase21h_realization_closeout",
    closeout_version: PHASE21H_REALIZATION_CLOSEOUT_VERSION,
    status:
      "Agent Suite realized as scheduled Suggestion Inbox delivery workflow",
    realized: true,
    foundation_complete: true,
    components: [
      {
        component_id: "agent-runtime-contract",
        version: AGENT_RUNTIME_CONTRACT_VERSION,
        present: true,
        posture: "output_contracts",
      },
      {
        component_id: "agent-registry",
        version: AGENT_REGISTRY_VERSION,
        present: true,
        posture: "registry",
      },
      {
        component_id: "agent-dry-run-runtime",
        version: AGENT_DRY_RUN_EXECUTOR_VERSION,
        present: true,
        posture: "runtime",
      },
      {
        component_id: "agent-planner",
        version: AGENT_PLANNER_VERSION,
        present: true,
        posture: "planner",
      },
      {
        component_id: "agent-output-factory",
        version: AGENT_OUTPUT_FACTORY_VERSION,
        present: true,
        posture: "preview_suite",
      },
      {
        component_id: "agent-suite-summary",
        version: AGENT_SUITE_SUMMARY_VERSION,
        present: true,
        posture: "digest_generation",
      },
      {
        component_id: "agent-inbox-delivery",
        version: AGENT_DELIVERY_VERSION,
        present: true,
        posture: "inbox_delivery",
      },
      {
        component_id: "agent-scheduled-invocation-boundary",
        version: AGENT_SCHEDULED_INVOCATION_VERSION,
        present: true,
        posture: "scheduled_invocation",
      },
      {
        component_id: "shared-suggestion-inbox-delivery-bridge",
        version: SUGGESTION_INBOX_BRIDGE_VERSION,
        present: true,
        posture: "shared_inbox_bridge",
      },
    ],
    agents,
    agent_count: agents.length,
    governance: {
      workflow_status:
        "Agent Suite realized as scheduled Suggestion Inbox delivery workflow",
      suggestion_inbox_delivery_exists: true,
      scheduled_invocation_exists: true,
      digest_generation_exists: true,
      no_execution: true,
      no_approval_finalization: true,
      no_provider_model_calls: true,
      no_network_calls: true,
      no_autonomous_actions: true,
      no_cross_agent_execution: true,
      no_self_modification: true,
      no_authority_escalation: true,
      no_filesystem_writes: true,
      no_database_writes: true,
      metadata_only: true,
      new_authority_surface_added: false,
    },
    readme_safe_wording: [
      "Agent Suite realized as scheduled Suggestion Inbox delivery workflow",
      "Agent previews can become user-visible Suggestion Inbox digest or alert items through the shared governed delivery bridge.",
      "Scheduled invocation boundaries accept supplied preview inputs and do not create daemons, live reads, provider calls, or execution authority.",
    ],
    future_work: [
      "Autonomous execution, cross-agent workflows, agent self-modification, direct side effects, and execution authority remain future work.",
      "Any action proposed by an agent must remain behind the Phase 18 approval lifecycle.",
    ],
    deterministic: true,
    metadata_only: true,
  });
}

function displayNameFor(agentId: z.infer<typeof AgentIdSchema>) {
  return {
    life_coach: "Life Coach",
    build_monitor: "Build Monitor",
    research_agent: "Research Agent",
    cv_maintenance: "CV Maintenance",
    application_tracker: "Application Tracker",
    deadline_agent: "Deadline Agent",
    cost_monitor: "Cost Monitor",
    health_agent: "Health Agent",
  }[agentId];
}
