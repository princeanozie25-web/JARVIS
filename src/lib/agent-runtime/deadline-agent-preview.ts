import { z } from "zod";
import {
  AgentOutputSourceReferenceSchema,
  AgentSuggestionInboxTargetSchema,
} from "./contract";
import { AgentDryRunEnvelopeSchema } from "./dry-run-executor";
import {
  AGENT_OUTPUT_FACTORY_VERSION,
  AgentOutputPreviewSchema,
  AgentOutputPrioritySchema,
  createAgentOutputPreview,
} from "./output-factory";
import { AgentRegistryEntrySchema } from "./registry";

export const DEADLINE_AGENT_PREVIEW_VERSION =
  "phase21h.deadline-agent-preview.v1" as const;

export const DEADLINE_AGENT_SOURCES = [
  "calendar_metadata",
  "project_registry",
  "manual_input",
] as const;

export const DEADLINE_PROGRESS_STATUSES = [
  "complete",
  "on_track",
  "needs_attention",
  "at_risk",
  "blocked",
  "overdue",
] as const;

export const DEADLINE_ESCALATION_LEVELS = [
  "none",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const DEADLINE_SUGGESTED_ACTIONS = [
  "monitor",
  "review_plan",
  "increase_focus",
  "create_recovery_plan",
  "escalate_to_manual_review",
] as const;

export const DEADLINE_PREVIEW_CAVEATS = [
  "metadata_only",
  "fixture_metadata_only",
  "no_scheduler",
  "no_calendar_calls",
  "no_gmail_calls",
  "no_obsidian_reads",
  "no_model_calls",
  "no_network_calls",
  "no_inbox_write",
  "suggestion_only",
] as const;

const DeadlineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const DeadlineTextSchema = z.string().trim().min(1).max(360);

export const DeadlineAgentSourceSchema = z.enum(DEADLINE_AGENT_SOURCES);
export const DeadlineProgressStatusSchema = z.enum(DEADLINE_PROGRESS_STATUSES);
export const DeadlineEscalationLevelSchema = z.enum(DEADLINE_ESCALATION_LEVELS);
export const DeadlineSuggestedActionSchema = z.enum(DEADLINE_SUGGESTED_ACTIONS);
export const DeadlinePreviewCaveatSchema = z.enum(DEADLINE_PREVIEW_CAVEATS);

export const DeadlineMetadataSchema = z.strictObject({
  deadline_id: DeadlineIdSchema,
  title: DeadlineTextSchema,
  source: DeadlineAgentSourceSchema,
  due_at: z.string().trim().datetime({ offset: true }),
  progress_percent: z.number().int().min(0).max(100),
  status: z.enum(["not_started", "in_progress", "blocked", "complete"]),
  priority: AgentOutputPrioritySchema,
  evidence_refs: z.array(AgentOutputSourceReferenceSchema).default([]),
  raw_body_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const DeadlineAgentPreviewInputSchema = z.strictObject({
  preview_version: z.literal(DEADLINE_AGENT_PREVIEW_VERSION),
  dry_run: AgentDryRunEnvelopeSchema,
  registry_entry: AgentRegistryEntrySchema,
  deadline_metadata: z.array(DeadlineMetadataSchema).min(1),
  generated_at: z.string().trim().datetime({ offset: true }),
  metadata_only: z.literal(true),
  scheduler_requested: z.literal(false),
  calendar_call_requested: z.literal(false),
  gmail_call_requested: z.literal(false),
  obsidian_read_requested: z.literal(false),
  model_call_requested: z.literal(false),
  network_call_requested: z.literal(false),
  tool_execution_requested: z.literal(false),
  inbox_write_requested: z.literal(false),
  write_requested: z.literal(false),
  approval_execution_requested: z.literal(false),
  auto_execution_requested: z.literal(false),
});

export const DeadlineSourceSummarySchema = z.strictObject({
  deadline_count: z.number().int().nonnegative(),
  calendar_metadata_count: z.number().int().nonnegative(),
  project_registry_count: z.number().int().nonnegative(),
  manual_input_count: z.number().int().nonnegative(),
  raw_body_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const DeadlineAlertSchema = z.strictObject({
  deadline_id: DeadlineIdSchema,
  title: DeadlineTextSchema,
  source: DeadlineAgentSourceSchema,
  due_at: z.string().trim().datetime({ offset: true }),
  days_remaining: z.number().int(),
  progress_percent: z.number().int().min(0).max(100),
  progress_status: DeadlineProgressStatusSchema,
  escalation_level: DeadlineEscalationLevelSchema,
  suggested_next_action: DeadlineSuggestedActionSchema,
  priority: AgentOutputPrioritySchema,
  evidence_refs: z.array(AgentOutputSourceReferenceSchema),
  suggestion_only: z.literal(true),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const DeadlineAgentPreviewGovernanceSchema = z.strictObject({
  preview_only: z.literal(true),
  suggestion_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  scheduler_attempted: z.literal(false),
  calendar_call_attempted: z.literal(false),
  gmail_call_attempted: z.literal(false),
  obsidian_read_attempted: z.literal(false),
  obsidian_write_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  tool_execution_attempted: z.literal(false),
  approval_execution_attempted: z.literal(false),
  auto_execution_attempted: z.literal(false),
  raw_body_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const DeadlineAgentPreviewSchema = z.strictObject({
  kind: z.literal("deadline_agent.deadline_alert_preview"),
  preview_version: z.literal(DEADLINE_AGENT_PREVIEW_VERSION),
  agent_id: z.literal("deadline_agent"),
  agent_name: z.literal("Deadline Agent"),
  deadline_alert_preview: z.strictObject({
    title: DeadlineTextSchema,
    summary: DeadlineTextSchema,
    source_summary: DeadlineSourceSummarySchema,
    upcoming_deadlines: z.array(DeadlineAlertSchema),
    caveats: z.array(DeadlinePreviewCaveatSchema),
    metadata_only: z.literal(true),
  }),
  runtime_output_preview: AgentOutputPreviewSchema,
  suggested_inbox_target: z.literal("suggestion_inbox"),
  suggestion_inbox: AgentSuggestionInboxTargetSchema,
  governance: DeadlineAgentPreviewGovernanceSchema,
  preview_only: z.literal(true),
  suggestion_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type DeadlineMetadata = z.infer<typeof DeadlineMetadataSchema>;
export type DeadlineAlert = z.infer<typeof DeadlineAlertSchema>;
export type DeadlineAgentPreview = z.infer<typeof DeadlineAgentPreviewSchema>;
export type DeadlineAgentPreviewInput = z.infer<
  typeof DeadlineAgentPreviewInputSchema
>;
export type DeadlineEscalationLevel = z.infer<
  typeof DeadlineEscalationLevelSchema
>;
export type DeadlineSuggestedAction = z.infer<
  typeof DeadlineSuggestedActionSchema
>;

export function previewDeadlineAgent(input: unknown): DeadlineAgentPreview {
  const parsed = DeadlineAgentPreviewInputSchema.parse(input);
  if (parsed.registry_entry.id !== "deadline_agent") {
    throw new Error(
      "Deadline Agent preview requires the deadline_agent registry entry.",
    );
  }
  if (parsed.dry_run.agent_id !== "deadline_agent") {
    throw new Error(
      "Deadline Agent preview requires a deadline_agent dry-run.",
    );
  }
  if (parsed.dry_run.status !== "planned") {
    throw new Error("Deadline Agent preview requires a planned dry-run.");
  }

  const outputPreview = createAgentOutputPreview({
    factory_version: AGENT_OUTPUT_FACTORY_VERSION,
    dry_run: parsed.dry_run,
    registry_entry: parsed.registry_entry,
    fixture_metadata: parsed.dry_run.fixture_metadata,
    metadata_only: true,
    inbox_write_requested: false,
    execute_real_agent_requested: false,
    source_reads_requested: false,
    model_call_requested: false,
  });
  const upcomingDeadlines = deadlineAlertsFor(
    parsed.deadline_metadata,
    parsed.generated_at,
  );

  return DeadlineAgentPreviewSchema.parse({
    kind: "deadline_agent.deadline_alert_preview",
    preview_version: DEADLINE_AGENT_PREVIEW_VERSION,
    agent_id: "deadline_agent",
    agent_name: "Deadline Agent",
    deadline_alert_preview: {
      title: "Deadline Agent alert preview",
      summary: summaryFor(parsed.deadline_metadata, upcomingDeadlines),
      source_summary: sourceSummaryFor(parsed.deadline_metadata),
      upcoming_deadlines: upcomingDeadlines,
      caveats: [
        "metadata_only",
        "fixture_metadata_only",
        "no_scheduler",
        "no_calendar_calls",
        "no_gmail_calls",
        "no_obsidian_reads",
        "no_model_calls",
        "no_network_calls",
        "no_inbox_write",
        "suggestion_only",
      ],
      metadata_only: true,
    },
    runtime_output_preview: outputPreview,
    suggested_inbox_target: outputPreview.suggested_inbox_target,
    suggestion_inbox: outputPreview.suggestion_inbox,
    governance: governanceSummary(),
    preview_only: true,
    suggestion_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    metadata_only: true,
  });
}

function deadlineAlertsFor(
  deadlines: readonly DeadlineMetadata[],
  generatedAt: string,
): DeadlineAlert[] {
  const nowMs = Date.parse(generatedAt);
  return deadlines
    .filter((deadline) => deadline.status !== "complete")
    .map((deadline) => alertFor(deadline, nowMs))
    .sort(
      (left, right) =>
        escalationRank(right.escalation_level) -
          escalationRank(left.escalation_level) ||
        left.days_remaining - right.days_remaining ||
        priorityRank(right.priority) - priorityRank(left.priority),
    );
}

function alertFor(deadline: DeadlineMetadata, nowMs: number): DeadlineAlert {
  const daysRemaining = daysUntil(deadline.due_at, nowMs);
  const progressStatus = progressStatusFor(deadline, daysRemaining);
  const escalationLevel = escalationLevelFor(deadline, daysRemaining);
  return DeadlineAlertSchema.parse({
    deadline_id: deadline.deadline_id,
    title: deadline.title,
    source: deadline.source,
    due_at: deadline.due_at,
    days_remaining: daysRemaining,
    progress_percent: deadline.progress_percent,
    progress_status: progressStatus,
    escalation_level: escalationLevel,
    suggested_next_action: suggestedActionFor(escalationLevel, progressStatus),
    priority: priorityFor(deadline, escalationLevel),
    evidence_refs: deadline.evidence_refs,
    suggestion_only: true,
    metadata_only: true,
    raw_body_included: false,
  });
}

function daysUntil(dueAt: string, nowMs: number): number {
  return Math.ceil((Date.parse(dueAt) - nowMs) / 86_400_000);
}

function progressStatusFor(
  deadline: DeadlineMetadata,
  daysRemaining: number,
): z.infer<typeof DeadlineProgressStatusSchema> {
  if (deadline.status === "complete" || deadline.progress_percent >= 100) {
    return "complete";
  }
  if (daysRemaining < 0) return "overdue";
  if (deadline.status === "blocked") return "blocked";
  if (deadline.progress_percent === 0 && daysRemaining <= 7) return "at_risk";
  if (deadline.progress_percent < expectedProgressBy(daysRemaining)) {
    return daysRemaining <= 3 ? "at_risk" : "needs_attention";
  }
  return "on_track";
}

function escalationLevelFor(
  deadline: DeadlineMetadata,
  daysRemaining: number,
): DeadlineEscalationLevel {
  if (deadline.status === "blocked" && daysRemaining <= 3) return "critical";
  if (daysRemaining < 0) return "critical";
  if (deadline.progress_percent === 0 && daysRemaining <= 2) return "critical";
  if (deadline.status === "blocked") return "high";
  if (daysRemaining <= 2 && deadline.progress_percent < 80) return "high";
  if (daysRemaining <= 7 && deadline.progress_percent < 50) return "medium";
  if (daysRemaining <= 14 && deadline.progress_percent < 40) return "low";
  return "none";
}

function expectedProgressBy(daysRemaining: number): number {
  if (daysRemaining <= 2) return 80;
  if (daysRemaining <= 7) return 50;
  if (daysRemaining <= 14) return 40;
  return 20;
}

function suggestedActionFor(
  escalationLevel: DeadlineEscalationLevel,
  progressStatus: z.infer<typeof DeadlineProgressStatusSchema>,
): DeadlineSuggestedAction {
  if (escalationLevel === "critical") return "escalate_to_manual_review";
  if (progressStatus === "blocked" || escalationLevel === "high") {
    return "create_recovery_plan";
  }
  if (escalationLevel === "medium") return "increase_focus";
  if (escalationLevel === "low") return "review_plan";
  return "monitor";
}

function priorityFor(
  deadline: DeadlineMetadata,
  escalationLevel: DeadlineEscalationLevel,
): z.infer<typeof AgentOutputPrioritySchema> {
  if (escalationLevel === "critical") return "critical";
  if (escalationLevel === "high") return "high";
  if (escalationLevel === "medium") {
    return deadline.priority === "critical" ? "high" : "medium";
  }
  if (escalationLevel === "low") return "medium";
  return deadline.priority;
}

function sourceSummaryFor(deadlines: readonly DeadlineMetadata[]) {
  return DeadlineSourceSummarySchema.parse({
    deadline_count: deadlines.length,
    calendar_metadata_count: deadlines.filter(
      (deadline) => deadline.source === "calendar_metadata",
    ).length,
    project_registry_count: deadlines.filter(
      (deadline) => deadline.source === "project_registry",
    ).length,
    manual_input_count: deadlines.filter(
      (deadline) => deadline.source === "manual_input",
    ).length,
    raw_body_included: false,
    metadata_only: true,
  });
}

function summaryFor(
  deadlines: readonly DeadlineMetadata[],
  alerts: readonly DeadlineAlert[],
): string {
  const criticalCount = alerts.filter(
    (alert) => alert.escalation_level === "critical",
  ).length;
  return `Metadata-only Deadline Agent preview across ${deadlines.length} deadlines with ${alerts.length} active alert(s) and ${criticalCount} critical escalation(s).`;
}

function escalationRank(escalationLevel: DeadlineEscalationLevel) {
  return { none: 0, low: 1, medium: 2, high: 3, critical: 4 }[escalationLevel];
}

function priorityRank(priority: z.infer<typeof AgentOutputPrioritySchema>) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[priority];
}

function governanceSummary() {
  return DeadlineAgentPreviewGovernanceSchema.parse({
    preview_only: true,
    suggestion_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    scheduler_attempted: false,
    calendar_call_attempted: false,
    gmail_call_attempted: false,
    obsidian_read_attempted: false,
    obsidian_write_attempted: false,
    model_call_attempted: false,
    network_call_attempted: false,
    tool_execution_attempted: false,
    approval_execution_attempted: false,
    auto_execution_attempted: false,
    raw_body_included: false,
    metadata_only: true,
  });
}
