import { z } from "zod";
import { EXPANSION_ERA_AGENT_IDS } from "./contract";
import {
  AGENT_REGISTRY_VERSION,
  AgentRegistryEntrySchema,
  getAgentRegistry,
} from "./registry";

export const AGENT_SUITE_SUMMARY_VERSION =
  "phase21h.agent-suite-summary.v1" as const;

export const IMPLEMENTED_AGENT_PREVIEW_IDS = [
  "life_coach",
  "build_monitor",
  "research_agent",
  "cv_maintenance",
  "application_tracker",
  "deadline_agent",
  "cost_monitor",
  "health_agent",
] as const;

export const AGENT_SUITE_READINESS_STATUSES = [
  "complete_preview_suite",
  "partial_preview_suite",
] as const;

const AgentIdSchema = z.enum(EXPANSION_ERA_AGENT_IDS);

export const AgentSuiteReadinessStatusSchema = z.enum(
  AGENT_SUITE_READINESS_STATUSES,
);

export const AgentPreviewCoverageEntrySchema = z.strictObject({
  agent_id: AgentIdSchema,
  display_name: z.string().trim().min(1).max(120),
  preview_implemented: z.boolean(),
  output_type: AgentRegistryEntrySchema.shape.output_type,
  authority: AgentRegistryEntrySchema.shape.authority,
  suggestion_inbox_target: z.literal("suggestion_inbox"),
  execution_authority: z.literal(false),
  metadata_only: z.literal(true),
});

export const AgentSuiteGovernancePostureSchema = z.strictObject({
  preview_only: z.literal(true),
  suggestion_only: z.literal(true),
  scheduler_wiring_enabled: z.literal(false),
  suggestion_inbox_writes_enabled: z.literal(false),
  approval_execution_enabled: z.literal(false),
  filesystem_writes_enabled: z.literal(false),
  database_writes_enabled: z.literal(false),
  network_calls_enabled: z.literal(false),
  provider_calls_enabled: z.literal(false),
  obsidian_reads_enabled: z.literal(false),
  gmail_calendar_reads_enabled: z.literal(false),
  sensor_integration_enabled: z.literal(false),
  runtime_mutation_enabled: z.literal(false),
  new_authority_surface_created: z.literal(false),
  approval_lifecycle_remains_execution_path: z.literal(true),
  metadata_only: z.literal(true),
});

export const AgentSuiteRegistrySummarySchema = z.strictObject({
  kind: z.literal("agent_runtime.preview_suite_registry_summary"),
  summary_version: z.literal(AGENT_SUITE_SUMMARY_VERSION),
  registry_version: z.literal(AGENT_REGISTRY_VERSION),
  registered_agent_count: z.number().int().nonnegative(),
  expected_agent_count: z.number().int().nonnegative(),
  preview_coverage: z.strictObject({
    implemented_preview_count: z.number().int().nonnegative(),
    missing_preview_count: z.number().int().nonnegative(),
    implemented_preview_ids: z.array(AgentIdSchema),
    missing_preview_ids: z.array(AgentIdSchema),
    coverage_entries: z.array(AgentPreviewCoverageEntrySchema),
    metadata_only: z.literal(true),
  }),
  readiness_summary: z.strictObject({
    status: AgentSuiteReadinessStatusSchema,
    complete_preview_suite: z.boolean(),
    all_registered_agents_represented: z.boolean(),
    ready_for_closeout_verification: z.boolean(),
    notes: z.array(z.string().trim().min(1).max(220)),
    metadata_only: z.literal(true),
  }),
  governance_posture: AgentSuiteGovernancePostureSchema,
  deterministic: z.literal(true),
  metadata_only: z.literal(true),
});

export type AgentSuiteRegistrySummary = z.infer<
  typeof AgentSuiteRegistrySummarySchema
>;

export function buildAgentSuiteRegistrySummary(): AgentSuiteRegistrySummary {
  const registry = getAgentRegistry();
  const implemented = new Set<string>(IMPLEMENTED_AGENT_PREVIEW_IDS);
  const missing = EXPANSION_ERA_AGENT_IDS.filter((id) => !implemented.has(id));
  const coverageEntries = registry.entries.map((entry) =>
    AgentPreviewCoverageEntrySchema.parse({
      agent_id: entry.id,
      display_name: displayNameFor(entry.id),
      preview_implemented: implemented.has(entry.id),
      output_type: entry.output_type,
      authority: entry.authority,
      suggestion_inbox_target: "suggestion_inbox",
      execution_authority: false,
      metadata_only: true,
    }),
  );
  const complete =
    missing.length === 0 &&
    registry.entries.length === EXPANSION_ERA_AGENT_IDS.length;

  return AgentSuiteRegistrySummarySchema.parse({
    kind: "agent_runtime.preview_suite_registry_summary",
    summary_version: AGENT_SUITE_SUMMARY_VERSION,
    registry_version: registry.registry_version,
    registered_agent_count: registry.entries.length,
    expected_agent_count: EXPANSION_ERA_AGENT_IDS.length,
    preview_coverage: {
      implemented_preview_count: IMPLEMENTED_AGENT_PREVIEW_IDS.length,
      missing_preview_count: missing.length,
      implemented_preview_ids: [...IMPLEMENTED_AGENT_PREVIEW_IDS],
      missing_preview_ids: missing,
      coverage_entries: coverageEntries,
      metadata_only: true,
    },
    readiness_summary: {
      status: complete ? "complete_preview_suite" : "partial_preview_suite",
      complete_preview_suite: complete,
      all_registered_agents_represented: complete,
      ready_for_closeout_verification: complete,
      notes: complete
        ? [
            "All Phase 21H registered agents have preview-only foundations.",
            "Suggestions only. Approval lifecycle remains the only path to execution.",
          ]
        : [
            "One or more Phase 21H registered agents still lack preview foundations.",
          ],
      metadata_only: true,
    },
    governance_posture: governancePosture(),
    deterministic: true,
    metadata_only: true,
  });
}

function displayNameFor(id: z.infer<typeof AgentIdSchema>) {
  return {
    life_coach: "Life Coach",
    build_monitor: "Build Monitor",
    research_agent: "Research Agent",
    cv_maintenance: "CV Maintenance",
    application_tracker: "Application Tracker",
    deadline_agent: "Deadline Agent",
    cost_monitor: "Cost Monitor",
    health_agent: "Health Agent",
  }[id];
}

function governancePosture() {
  return AgentSuiteGovernancePostureSchema.parse({
    preview_only: true,
    suggestion_only: true,
    scheduler_wiring_enabled: false,
    suggestion_inbox_writes_enabled: false,
    approval_execution_enabled: false,
    filesystem_writes_enabled: false,
    database_writes_enabled: false,
    network_calls_enabled: false,
    provider_calls_enabled: false,
    obsidian_reads_enabled: false,
    gmail_calendar_reads_enabled: false,
    sensor_integration_enabled: false,
    runtime_mutation_enabled: false,
    new_authority_surface_created: false,
    approval_lifecycle_remains_execution_path: true,
    metadata_only: true,
  });
}
