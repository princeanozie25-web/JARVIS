import { z } from "zod";
import {
  AgentApprovalIntegrationSchema,
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

export const APPLICATION_TRACKER_AGENT_PREVIEW_VERSION =
  "phase21h.application-tracker-preview.v1" as const;

export const APPLICATION_TRACKER_STATUSES = [
  "saved",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;

export const APPLICATION_TRACKER_SOURCES = [
  "gmail_metadata",
  "calendar_metadata",
  "company_portal",
  "recruiter_metadata",
  "manual_input",
] as const;

export const APPLICATION_TRACKER_ACTIONS = [
  "monitor",
  "prepare_follow_up",
  "mark_stale",
  "ignore",
] as const;

export const APPLICATION_TRACKER_OUTREACH_TONES = [
  "concise",
  "warm",
  "formal",
  "curious",
] as const;

export const APPLICATION_TRACKER_OUTREACH_PURPOSES = [
  "follow_up",
  "thank_you",
  "status_check",
  "clarification",
] as const;

export const APPLICATION_TRACKER_PREVIEW_CAVEATS = [
  "metadata_only",
  "fixture_metadata_only",
  "no_gmail_calls",
  "no_google_api_calls",
  "no_oauth",
  "no_model_calls",
  "no_real_email_drafts",
  "no_raw_email_bodies",
  "no_inbox_write",
  "approval_required_for_outreach",
] as const;

const ApplicationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const ApplicationTextSchema = z.string().trim().min(1).max(360);

export const ApplicationTrackerStatusSchema = z.enum(
  APPLICATION_TRACKER_STATUSES,
);
export const ApplicationTrackerSourceSchema = z.enum(
  APPLICATION_TRACKER_SOURCES,
);
export const ApplicationTrackerActionSchema = z.enum(
  APPLICATION_TRACKER_ACTIONS,
);
export const ApplicationTrackerOutreachToneSchema = z.enum(
  APPLICATION_TRACKER_OUTREACH_TONES,
);
export const ApplicationTrackerOutreachPurposeSchema = z.enum(
  APPLICATION_TRACKER_OUTREACH_PURPOSES,
);
export const ApplicationTrackerPreviewCaveatSchema = z.enum(
  APPLICATION_TRACKER_PREVIEW_CAVEATS,
);

export const ApplicationMetadataSchema = z.strictObject({
  application_id: ApplicationIdSchema,
  company: ApplicationTextSchema,
  role_title: ApplicationTextSchema,
  status: ApplicationTrackerStatusSchema,
  applied_at: z.string().trim().datetime({ offset: true }).nullable(),
  last_contact_at: z.string().trim().datetime({ offset: true }).nullable(),
  follow_up_due_at: z.string().trim().datetime({ offset: true }).nullable(),
  source: ApplicationTrackerSourceSchema,
  priority: AgentOutputPrioritySchema,
  evidence_refs: z.array(AgentOutputSourceReferenceSchema).default([]),
  raw_email_body_included: z.literal(false),
  raw_application_body_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApplicationGmailMetadataSchema = z.strictObject({
  gmail_metadata_ref_id: ApplicationIdSchema,
  matched_thread_count: z.number().int().nonnegative(),
  unread_thread_count: z.number().int().nonnegative(),
  reply_needed_count: z.number().int().nonnegative(),
  oauth_attempted: z.literal(false),
  gmail_call_attempted: z.literal(false),
  raw_email_body_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApplicationVerificationMetadataSchema = z.strictObject({
  verification_ref_id: ApplicationIdSchema,
  verification_status: z.enum([
    "not_requested",
    "pending",
    "completed_metadata_only",
    "failed_closed",
  ]),
  risk_flag_count: z.number().int().nonnegative(),
  raw_verifier_response_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApplicationTrackerPreviewInputSchema = z.strictObject({
  preview_version: z.literal(APPLICATION_TRACKER_AGENT_PREVIEW_VERSION),
  dry_run: AgentDryRunEnvelopeSchema,
  registry_entry: AgentRegistryEntrySchema,
  application_metadata: z.array(ApplicationMetadataSchema).min(1),
  gmail_metadata: ApplicationGmailMetadataSchema.nullable().default(null),
  verification_metadata:
    ApplicationVerificationMetadataSchema.nullable().default(null),
  generated_at: z.string().trim().datetime({ offset: true }),
  metadata_only: z.literal(true),
  gmail_call_requested: z.literal(false),
  google_api_call_requested: z.literal(false),
  oauth_requested: z.literal(false),
  model_call_requested: z.literal(false),
  real_email_draft_requested: z.literal(false),
  raw_email_bodies_included: z.literal(false),
  raw_application_bodies_included: z.literal(false),
  scheduling_requested: z.literal(false),
  email_send_requested: z.literal(false),
  inbox_write_requested: z.literal(false),
  write_requested: z.literal(false),
  approval_bypass_requested: z.literal(false),
});

export const ApplicationOutreachMetadataSchema = z.strictObject({
  recipient_domain: ApplicationTextSchema,
  subject_hint: ApplicationTextSchema,
  tone: ApplicationTrackerOutreachToneSchema,
  purpose: ApplicationTrackerOutreachPurposeSchema,
  body_generated: z.literal(false),
  raw_email_body_included: z.literal(false),
  approval_required: z.literal(true),
  metadata_only: z.literal(true),
});

export const ApplicationFollowUpCandidateSchema = z.strictObject({
  application_id: ApplicationIdSchema,
  company: ApplicationTextSchema,
  role_title: ApplicationTextSchema,
  reason: ApplicationTextSchema,
  priority: AgentOutputPrioritySchema,
  suggested_action: ApplicationTrackerActionSchema,
  approval_required: z.boolean(),
  outreach_metadata: ApplicationOutreachMetadataSchema.nullable(),
  reply_needed: z.boolean(),
  stale: z.boolean(),
  metadata_only: z.literal(true),
  raw_email_body_included: z.literal(false),
  raw_application_body_included: z.literal(false),
});

export const ApplicationTrackerPreviewGovernanceSchema = z.strictObject({
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  gmail_call_attempted: z.literal(false),
  google_api_call_attempted: z.literal(false),
  oauth_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  email_send_attempted: z.literal(false),
  real_email_draft_attempted: z.literal(false),
  obsidian_write_attempted: z.literal(false),
  approval_bypass_attempted: z.literal(false),
  raw_email_bodies_included: z.literal(false),
  raw_application_bodies_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const ApplicationTrackerAgentPreviewSchema = z.strictObject({
  kind: z.literal("application_tracker.follow_up_digest_preview"),
  preview_version: z.literal(APPLICATION_TRACKER_AGENT_PREVIEW_VERSION),
  agent_id: z.literal("application_tracker"),
  application_tracking_digest_preview: z.strictObject({
    title: ApplicationTextSchema,
    summary: ApplicationTextSchema,
    follow_up_candidates: z.array(ApplicationFollowUpCandidateSchema),
    stale_applications: z.array(ApplicationIdSchema),
    reply_needed_indicators: z.array(ApplicationIdSchema),
    suggested_outreach_drafts_metadata_only: z.array(
      ApplicationOutreachMetadataSchema,
    ),
    evidence_refs: z.array(AgentOutputSourceReferenceSchema),
    caveats: z.array(ApplicationTrackerPreviewCaveatSchema),
    metadata_only: z.literal(true),
  }),
  runtime_output_preview: AgentOutputPreviewSchema,
  approval_metadata: AgentApprovalIntegrationSchema,
  suggested_inbox_target: z.literal("suggestion_inbox"),
  suggestion_inbox: AgentSuggestionInboxTargetSchema,
  gmail_metadata: ApplicationGmailMetadataSchema.nullable(),
  verification_metadata: ApplicationVerificationMetadataSchema.nullable(),
  governance: ApplicationTrackerPreviewGovernanceSchema,
  preview_only: z.literal(true),
  execution_attempted: z.literal(false),
  write_attempted: z.literal(false),
  inbox_write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type ApplicationMetadata = z.infer<typeof ApplicationMetadataSchema>;
export type ApplicationFollowUpCandidate = z.infer<
  typeof ApplicationFollowUpCandidateSchema
>;
export type ApplicationOutreachMetadata = z.infer<
  typeof ApplicationOutreachMetadataSchema
>;
export type ApplicationTrackerAgentPreview = z.infer<
  typeof ApplicationTrackerAgentPreviewSchema
>;
export type ApplicationTrackerPreviewInput = z.infer<
  typeof ApplicationTrackerPreviewInputSchema
>;

export function previewApplicationTrackerAgent(
  input: unknown,
): ApplicationTrackerAgentPreview {
  const parsed = ApplicationTrackerPreviewInputSchema.parse(input);
  if (parsed.registry_entry.id !== "application_tracker") {
    throw new Error(
      "Application Tracker preview requires the application_tracker registry entry.",
    );
  }
  if (parsed.dry_run.agent_id !== "application_tracker") {
    throw new Error(
      "Application Tracker preview requires an application_tracker dry-run.",
    );
  }
  if (parsed.dry_run.status !== "planned") {
    throw new Error("Application Tracker preview requires a planned dry-run.");
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
  const candidates = followUpCandidatesFor(
    parsed.application_metadata,
    parsed.generated_at,
  );
  const outreachMetadata = candidates
    .map((candidate) => candidate.outreach_metadata)
    .filter(
      (metadata): metadata is ApplicationOutreachMetadata => metadata !== null,
    );
  const evidenceRefs = uniqueSources([
    ...outputPreview.source_refs,
    ...parsed.application_metadata.flatMap(
      (application) => application.evidence_refs,
    ),
  ]);

  return ApplicationTrackerAgentPreviewSchema.parse({
    kind: "application_tracker.follow_up_digest_preview",
    preview_version: APPLICATION_TRACKER_AGENT_PREVIEW_VERSION,
    agent_id: "application_tracker",
    application_tracking_digest_preview: {
      title: "Application Tracker follow-up digest preview",
      summary: summaryFor(parsed.application_metadata, candidates),
      follow_up_candidates: candidates,
      stale_applications: candidates
        .filter((candidate) => candidate.stale)
        .map((candidate) => candidate.application_id),
      reply_needed_indicators: candidates
        .filter((candidate) => candidate.reply_needed)
        .map((candidate) => candidate.application_id),
      suggested_outreach_drafts_metadata_only: outreachMetadata,
      evidence_refs: evidenceRefs,
      caveats: [
        "metadata_only",
        "fixture_metadata_only",
        "no_gmail_calls",
        "no_google_api_calls",
        "no_oauth",
        "no_model_calls",
        "no_real_email_drafts",
        "no_raw_email_bodies",
        "no_inbox_write",
        "approval_required_for_outreach",
      ],
      metadata_only: true,
    },
    runtime_output_preview: outputPreview,
    approval_metadata: outputPreview.approval_metadata,
    suggested_inbox_target: outputPreview.suggested_inbox_target,
    suggestion_inbox: outputPreview.suggestion_inbox,
    gmail_metadata: parsed.gmail_metadata,
    verification_metadata: parsed.verification_metadata,
    governance: governanceSummary(),
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    metadata_only: true,
  });
}

function followUpCandidatesFor(
  applications: readonly ApplicationMetadata[],
  generatedAt: string,
): ApplicationFollowUpCandidate[] {
  const nowMs = Date.parse(generatedAt);
  return [...applications]
    .map((application) => candidateFor(application, nowMs))
    .filter((candidate) => candidate.suggested_action !== "ignore")
    .sort(
      (left, right) =>
        priorityRank(right.priority) - priorityRank(left.priority) ||
        Number(right.reply_needed) - Number(left.reply_needed) ||
        Number(right.stale) - Number(left.stale),
    );
}

function candidateFor(
  application: ApplicationMetadata,
  nowMs: number,
): ApplicationFollowUpCandidate {
  const due = application.follow_up_due_at
    ? Date.parse(application.follow_up_due_at) <= nowMs
    : false;
  const stale = isStale(application, nowMs);
  const replyNeeded =
    due &&
    ["applied", "screening", "interviewing"].includes(application.status);
  const suggestedAction = actionFor(application, due, stale, replyNeeded);
  return ApplicationFollowUpCandidateSchema.parse({
    application_id: application.application_id,
    company: application.company,
    role_title: application.role_title,
    reason: reasonFor(application, due, stale, replyNeeded),
    priority: priorityFor(application, due, stale, replyNeeded),
    suggested_action: suggestedAction,
    approval_required: suggestedAction === "prepare_follow_up",
    outreach_metadata:
      suggestedAction === "prepare_follow_up" ? outreachFor(application) : null,
    reply_needed: replyNeeded,
    stale,
    metadata_only: true,
    raw_email_body_included: false,
    raw_application_body_included: false,
  });
}

function actionFor(
  application: ApplicationMetadata,
  due: boolean,
  stale: boolean,
  replyNeeded: boolean,
): z.infer<typeof ApplicationTrackerActionSchema> {
  if (application.status === "rejected" || application.status === "withdrawn") {
    return "ignore";
  }
  if (stale) return "mark_stale";
  if (replyNeeded || due) return "prepare_follow_up";
  return "monitor";
}

function priorityFor(
  application: ApplicationMetadata,
  due: boolean,
  stale: boolean,
  replyNeeded: boolean,
): z.infer<typeof AgentOutputPrioritySchema> {
  if (replyNeeded && application.priority === "critical") return "critical";
  if (replyNeeded || (due && application.priority === "high")) return "high";
  if (stale || due) return "medium";
  return application.priority === "low" ? "low" : "medium";
}

function reasonFor(
  application: ApplicationMetadata,
  due: boolean,
  stale: boolean,
  replyNeeded: boolean,
): string {
  if (replyNeeded) {
    return `${application.company} has a due follow-up window for ${application.role_title}.`;
  }
  if (stale) {
    return `${application.company} appears stale based on metadata dates.`;
  }
  if (due) {
    return `${application.company} has follow-up metadata due.`;
  }
  return `${application.company} should remain visible for monitoring.`;
}

function outreachFor(
  application: ApplicationMetadata,
): ApplicationOutreachMetadata {
  return ApplicationOutreachMetadataSchema.parse({
    recipient_domain: domainHintFor(application.company),
    subject_hint: `${application.role_title} application follow-up`,
    tone: application.priority === "critical" ? "formal" : "warm",
    purpose:
      application.status === "interviewing" ? "thank_you" : "status_check",
    body_generated: false,
    raw_email_body_included: false,
    approval_required: true,
    metadata_only: true,
  });
}

function isStale(application: ApplicationMetadata, nowMs: number): boolean {
  if (application.status === "offer") return false;
  const lastTouch =
    application.last_contact_at ??
    application.applied_at ??
    application.follow_up_due_at;
  if (!lastTouch) return false;
  const daysSinceTouch = (nowMs - Date.parse(lastTouch)) / 86_400_000;
  return daysSinceTouch >= 30 && application.status !== "rejected";
}

function summaryFor(
  applications: readonly ApplicationMetadata[],
  candidates: readonly ApplicationFollowUpCandidate[],
): string {
  return `Metadata-only application tracker preview across ${applications.length} applications with ${candidates.length} follow-up candidate(s).`;
}

function domainHintFor(company: string): string {
  return `${company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}.example`;
}

function priorityRank(priority: z.infer<typeof AgentOutputPrioritySchema>) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[priority];
}

function uniqueSources(
  sources: readonly z.infer<typeof AgentOutputSourceReferenceSchema>[],
) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = `${source.source_kind}:${source.source_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function governanceSummary() {
  return ApplicationTrackerPreviewGovernanceSchema.parse({
    preview_only: true,
    execution_attempted: false,
    write_attempted: false,
    inbox_write_attempted: false,
    gmail_call_attempted: false,
    google_api_call_attempted: false,
    oauth_attempted: false,
    model_call_attempted: false,
    scheduling_attempted: false,
    email_send_attempted: false,
    real_email_draft_attempted: false,
    obsidian_write_attempted: false,
    approval_bypass_attempted: false,
    raw_email_bodies_included: false,
    raw_application_bodies_included: false,
    metadata_only: true,
  });
}
