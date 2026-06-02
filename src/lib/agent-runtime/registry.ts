import { z } from "zod";
import {
  AGENT_RUNTIME_CONTRACT_VERSION,
  AGENT_RUNTIME_GOVERNANCE_DEFAULTS,
  EXPANSION_ERA_AGENT_IDS,
  AgentAuthorityLevelSchema,
  AgentDeclaredSourceKindSchema,
  AgentOutputTypeSchema,
  AgentRuntimeContractSchema,
  createAgentRuntimeContract,
  type AgentAuthorityLevel,
  type AgentDeclaredSourceKind,
  type AgentOutputType,
  type AgentRuntimeContract,
} from "./contract";

export const AGENT_REGISTRY_VERSION = "phase21h.agent-registry.v1" as const;

export const AGENT_REGISTRY_VALIDATION_REASONS = [
  "valid_registry",
  "invalid_registry",
  "missing_phase21h_agent",
  "unknown_agent",
  "execution_authority_forbidden",
  "suggestion_inbox_required",
  "proposal_agent_requires_approval",
  "proposal_agent_requires_verification",
  "critical_agent_requires_verification",
  "cross_agent_source_forbidden",
  "source_not_declared",
] as const;

const RegistryIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

export const AgentRegistryValidationReasonSchema = z.enum(
  AGENT_REGISTRY_VALIDATION_REASONS,
);

export const AgentRegistryEntrySchema = AgentRuntimeContractSchema.extend({
  registry_version: z.literal(AGENT_REGISTRY_VERSION),
  allowed_output_types: z.array(AgentOutputTypeSchema).min(1),
  allowed_source_kinds: z.array(AgentDeclaredSourceKindSchema).min(1),
  output_destination: z.literal("suggestion_inbox"),
  execution_authority: z.literal(false),
  schedules_created: z.literal(false),
  suggestions_created: z.literal(false),
  live_calls_allowed: z.literal(false),
  metadata_only: z.literal(true),
}).superRefine((entry, context) => {
  if (!entry.allowed_output_types.includes(entry.output_type)) {
    context.addIssue({
      code: "custom",
      message: "entry output_type must be listed in allowed_output_types.",
      path: ["allowed_output_types"],
    });
  }
  const declaredKinds = new Set(
    entry.declared_sources.map((source) => source.source_kind),
  );
  for (const sourceKind of declaredKinds) {
    if (!entry.allowed_source_kinds.includes(sourceKind)) {
      context.addIssue({
        code: "custom",
        message: "declared source kind must be listed in allowed_source_kinds.",
        path: ["allowed_source_kinds"],
      });
    }
  }
  if (entry.authority === "proposal_only" && !entry.requires_verification) {
    context.addIssue({
      code: "custom",
      message: "proposal agents require verification metadata.",
      path: ["requires_verification"],
    });
  }
});

export const AgentRegistrySchema = z.strictObject({
  registry_version: z.literal(AGENT_REGISTRY_VERSION),
  entries: z
    .array(AgentRegistryEntrySchema)
    .length(EXPANSION_ERA_AGENT_IDS.length),
  metadata_only: z.literal(true),
  execution_enabled: z.literal(false),
  scheduling_enabled: z.literal(false),
  background_jobs_enabled: z.literal(false),
  live_calls_enabled: z.literal(false),
});

export const AgentRegistryValidationSchema = z.strictObject({
  valid: z.boolean(),
  registry_version: z.literal(AGENT_REGISTRY_VERSION),
  entry_count: z.number().int().nonnegative(),
  reasons: z.array(AgentRegistryValidationReasonSchema),
  missing_agent_ids: z.array(RegistryIdSchema),
  unknown_agent_ids: z.array(RegistryIdSchema),
  execution_authority: z.literal(false),
  scheduling_enabled: z.literal(false),
  write_attempted: z.literal(false),
  network_called: z.literal(false),
  model_called: z.literal(false),
  metadata_only: z.literal(true),
});

export type AgentRegistryEntry = z.infer<typeof AgentRegistryEntrySchema>;
export type AgentRegistry = z.infer<typeof AgentRegistrySchema>;
export type AgentRegistryValidation = z.infer<
  typeof AgentRegistryValidationSchema
>;
export type AgentRegistryValidationReason = z.infer<
  typeof AgentRegistryValidationReasonSchema
>;

export const EXPANSION_ERA_AGENT_REGISTRY = AgentRegistrySchema.parse({
  registry_version: AGENT_REGISTRY_VERSION,
  entries: [
    registryEntry({
      id: "life_coach",
      outputType: "recommendation",
      allowedOutputTypes: ["digest", "recommendation", "draft"],
      authority: "proposal_only",
      riskClass: "high",
      requiresVerification: true,
      requiresApproval: true,
      sources: [
        source("manual_input", "manual:life-coach", "metadata_only"),
        source("obsidian", "obsidian:personal-context", "bounded_snippet"),
        source("project_registry", "project:career-life", "metadata_only"),
      ],
    }),
    registryEntry({
      id: "build_monitor",
      outputType: "report",
      allowedOutputTypes: ["digest", "report", "alert"],
      authority: "suggest_only",
      riskClass: "medium",
      requiresVerification: false,
      requiresApproval: false,
      sources: [
        source("github", "github:jarvis", "metadata_only"),
        source("project_registry", "project:jarvis", "metadata_only"),
        source("telemetry", "telemetry:build-status", "metadata_only"),
      ],
    }),
    registryEntry({
      id: "research_agent",
      outputType: "report",
      allowedOutputTypes: ["digest", "report", "recommendation", "draft"],
      authority: "suggest_only",
      riskClass: "high",
      requiresVerification: true,
      requiresApproval: false,
      sources: [
        source("manual_input", "manual:research-topic", "metadata_only"),
        source("obsidian", "obsidian:research", "bounded_snippet"),
        source("model_calls", "model-calls:research-metadata", "metadata_only"),
      ],
    }),
    registryEntry({
      id: "cv_maintenance",
      outputType: "draft",
      allowedOutputTypes: ["report", "recommendation", "draft"],
      authority: "proposal_only",
      riskClass: "high",
      requiresVerification: true,
      requiresApproval: true,
      sources: [
        source("obsidian", "obsidian:career", "bounded_snippet"),
        source("github", "github:portfolio", "metadata_only"),
        source("project_registry", "project:career", "metadata_only"),
      ],
    }),
    registryEntry({
      id: "application_tracker",
      outputType: "report",
      allowedOutputTypes: ["digest", "report", "recommendation", "alert"],
      authority: "proposal_only",
      riskClass: "high",
      requiresVerification: true,
      requiresApproval: true,
      sources: [
        source(
          "google_gmail",
          "google:gmail-application-metadata",
          "metadata_only",
        ),
        source(
          "google_calendar",
          "google:calendar-interview-metadata",
          "metadata_only",
        ),
        source("obsidian", "obsidian:career-applications", "bounded_snippet"),
      ],
    }),
    registryEntry({
      id: "deadline_agent",
      outputType: "alert",
      allowedOutputTypes: ["digest", "recommendation", "alert"],
      authority: "suggest_only",
      riskClass: "medium",
      requiresVerification: true,
      requiresApproval: false,
      sources: [
        source("google_calendar", "google:calendar-deadlines", "metadata_only"),
        source("project_registry", "project:deadlines", "metadata_only"),
        source("manual_input", "manual:deadlines", "metadata_only"),
      ],
    }),
    registryEntry({
      id: "cost_monitor",
      outputType: "alert",
      allowedOutputTypes: ["digest", "report", "alert"],
      authority: "observe_only",
      riskClass: "medium",
      requiresVerification: false,
      requiresApproval: false,
      sources: [
        source("telemetry", "telemetry:cost", "metadata_only"),
        source("model_calls", "model-calls:cost", "metadata_only"),
      ],
    }),
    registryEntry({
      id: "health_agent",
      outputType: "digest",
      allowedOutputTypes: ["digest", "recommendation", "alert"],
      authority: "suggest_only",
      riskClass: "medium",
      requiresVerification: false,
      requiresApproval: false,
      sources: [
        source("manual_input", "manual:health", "metadata_only"),
        source("obsidian", "obsidian:health", "bounded_snippet"),
      ],
    }),
  ],
  metadata_only: true,
  execution_enabled: false,
  scheduling_enabled: false,
  background_jobs_enabled: false,
  live_calls_enabled: false,
});

export function getAgentRegistry(): AgentRegistry {
  return AgentRegistrySchema.parse(EXPANSION_ERA_AGENT_REGISTRY);
}

export function getAgentRegistryEntry(
  agentId: AgentRuntimeContract["id"],
): AgentRegistryEntry {
  const entry = EXPANSION_ERA_AGENT_REGISTRY.entries.find(
    (candidate) => candidate.id === agentId,
  );
  if (!entry) {
    throw new Error(`unknown agent registry entry: ${agentId}`);
  }
  return AgentRegistryEntrySchema.parse(entry);
}

export function validateAgentRegistry(input: unknown): AgentRegistryValidation {
  const parsed = AgentRegistrySchema.safeParse(input);
  if (!parsed.success) {
    return validationResult({
      valid: false,
      entryCount: 0,
      reasons: ["invalid_registry"],
      missingAgentIds: [...EXPANSION_ERA_AGENT_IDS],
      unknownAgentIds: [],
    });
  }

  const ids = parsed.data.entries.map((entry) => entry.id);
  const expected = new Set(EXPANSION_ERA_AGENT_IDS);
  const seen = new Set(ids);
  const missing = EXPANSION_ERA_AGENT_IDS.filter((id) => !seen.has(id));
  const unknown = ids.filter((id) => !expected.has(id));
  const reasons: AgentRegistryValidationReason[] = [];

  if (missing.length > 0) reasons.push("missing_phase21h_agent");
  if (unknown.length > 0) reasons.push("unknown_agent");

  for (const entry of parsed.data.entries) {
    if (entry.execution_authority || entry.governance.execution_authority) {
      reasons.push("execution_authority_forbidden");
    }
    if (
      entry.output_destination !== "suggestion_inbox" ||
      entry.inbox_target !== "suggestion_inbox"
    ) {
      reasons.push("suggestion_inbox_required");
    }
    if (entry.authority === "proposal_only" && !entry.requires_approval) {
      reasons.push("proposal_agent_requires_approval");
    }
    if (entry.authority === "proposal_only" && !entry.requires_verification) {
      reasons.push("proposal_agent_requires_verification");
    }
    if (entry.risk_class === "critical" && !entry.requires_verification) {
      reasons.push("critical_agent_requires_verification");
    }
    if (
      entry.declared_sources.some((source) => source.cross_agent_read_allowed)
    ) {
      reasons.push("cross_agent_source_forbidden");
    }
    const allowed = new Set(entry.allowed_source_kinds);
    if (
      entry.declared_sources.some((source) => !allowed.has(source.source_kind))
    ) {
      reasons.push("source_not_declared");
    }
  }

  return validationResult({
    valid: reasons.length === 0,
    entryCount: parsed.data.entries.length,
    reasons: reasons.length ? reasons : ["valid_registry"],
    missingAgentIds: missing,
    unknownAgentIds: unknown,
  });
}

function registryEntry(input: {
  readonly id: AgentRuntimeContract["id"];
  readonly outputType: AgentOutputType;
  readonly allowedOutputTypes: readonly AgentOutputType[];
  readonly authority: AgentAuthorityLevel;
  readonly riskClass: AgentRuntimeContract["risk_class"];
  readonly requiresVerification: boolean;
  readonly requiresApproval: boolean;
  readonly sources: readonly ReturnType<typeof source>[];
}): AgentRegistryEntry {
  const allowedSourceKinds = [
    ...new Set(input.sources.map((item) => item.source_kind)),
  ];
  return AgentRegistryEntrySchema.parse({
    id: input.id,
    version: AGENT_RUNTIME_CONTRACT_VERSION,
    registry_version: AGENT_REGISTRY_VERSION,
    owner: "Prince Anozie",
    schedule_class: "manual_only",
    declared_sources: [...input.sources],
    output_type: input.outputType,
    allowed_output_types: [...input.allowedOutputTypes],
    allowed_source_kinds: allowedSourceKinds,
    risk_class: input.riskClass,
    authority: input.authority,
    requires_verification: input.requiresVerification,
    requires_approval: input.requiresApproval,
    inbox_target: "suggestion_inbox",
    output_destination: "suggestion_inbox",
    execution_authority: false,
    schedules_created: false,
    suggestions_created: false,
    live_calls_allowed: false,
    metadata_only: true,
    governance: AGENT_RUNTIME_GOVERNANCE_DEFAULTS,
  });
}

function source(
  sourceKind: AgentDeclaredSourceKind,
  sourceId: string,
  readScope: "metadata_only" | "bounded_snippet" | "derived_index",
) {
  return {
    source_kind: sourceKind,
    source_id: sourceId,
    read_scope: readScope,
    raw_body_allowed: false,
    secret_access_allowed: false,
    network_call_allowed: false,
    write_access_allowed: false,
    cross_agent_read_allowed: false,
  } as const;
}

function validationResult(input: {
  readonly valid: boolean;
  readonly entryCount: number;
  readonly reasons: readonly AgentRegistryValidationReason[];
  readonly missingAgentIds: readonly string[];
  readonly unknownAgentIds: readonly string[];
}): AgentRegistryValidation {
  return AgentRegistryValidationSchema.parse({
    valid: input.valid,
    registry_version: AGENT_REGISTRY_VERSION,
    entry_count: input.entryCount,
    reasons: [...new Set(input.reasons)],
    missing_agent_ids: [...input.missingAgentIds],
    unknown_agent_ids: [...input.unknownAgentIds],
    execution_authority: false,
    scheduling_enabled: false,
    write_attempted: false,
    network_called: false,
    model_called: false,
    metadata_only: true,
  });
}
