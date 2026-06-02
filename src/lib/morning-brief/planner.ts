import { z } from "zod";
import {
  MORNING_BRIEF_PRIORITIES,
  MORNING_BRIEF_SECTIONS,
  MorningBriefPrioritySchema,
  MorningBriefRequestSchema,
  MorningBriefSectionSchema,
  MorningBriefSectionTypeSchema,
  MorningBriefSourceReferenceSchema,
  type MorningBriefCalendarMetadata,
  type MorningBriefEmailMetadata,
  type MorningBriefKnowledgeMetadata,
  type MorningBriefLibrarianUpdate,
  type MorningBriefPriority,
  type MorningBriefProjectMetadata,
  type MorningBriefReminderMetadata,
  type MorningBriefRequest,
  type MorningBriefSection,
  type MorningBriefSectionType,
  type MorningBriefSourceReference,
  type MorningBriefVerificationMetadata,
} from "./contract";

export const MORNING_BRIEF_PLANNER_VERSION =
  "phase21c.morning-brief-planner.v1" as const;

export const MORNING_BRIEF_INCLUSION_ACTIONS = [
  "include",
  "defer",
  "suppress",
] as const;

export const MORNING_BRIEF_PLANNER_WARNINGS = [
  "metadata_only",
  "high_risk_verification_present",
  "section_not_requested",
  "insufficient_input_metadata",
  "raw_body_inputs_rejected_by_contract",
] as const;

const PlannerIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const PlanReasonSchema = z.string().trim().min(1).max(160);

export const MorningBriefInclusionActionSchema = z.enum(
  MORNING_BRIEF_INCLUSION_ACTIONS,
);

export const MorningBriefPlannerWarningSchema = z.enum(
  MORNING_BRIEF_PLANNER_WARNINGS,
);

export const MorningBriefItemDecisionSchema = z.strictObject({
  item_id: PlannerIdSchema,
  item_kind: z.enum([
    "calendar_event",
    "email_message",
    "project",
    "knowledge_update",
    "reminder",
    "verification_alert",
    "librarian_update",
  ]),
  section_type: MorningBriefSectionTypeSchema,
  inclusion: MorningBriefInclusionActionSchema,
  priority: MorningBriefPrioritySchema,
  ordering_key: z.string().trim().min(1).max(240),
  source_ref: MorningBriefSourceReferenceSchema,
  verification_ref_ids: z.array(PlannerIdSchema).default([]),
  librarian_update_ids: z.array(PlannerIdSchema).default([]),
  risk_flags: z.array(z.string().trim().min(1).max(80)).default([]),
  reasons: z.array(PlanReasonSchema),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefOmissionDecisionSchema = z.strictObject({
  item_id: PlannerIdSchema,
  item_kind: MorningBriefItemDecisionSchema.shape.item_kind,
  intended_section_type: MorningBriefSectionTypeSchema,
  inclusion: z.enum(["defer", "suppress"]),
  priority: MorningBriefPrioritySchema,
  reasons: z.array(PlanReasonSchema),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefSectionPlanSchema = z.strictObject({
  section: MorningBriefSectionSchema,
  item_ids: z.array(PlannerIdSchema),
  included_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  suppressed_count: z.number().int().nonnegative(),
  ordering: z.array(PlannerIdSchema),
  metadata_only: z.literal(true),
  generated_text_included: z.literal(false),
});

export const MorningBriefGovernanceSummarySchema = z.strictObject({
  generation_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  delivery_attempted: z.literal(false),
  notification_attempted: z.literal(false),
  gmail_access_attempted: z.literal(false),
  calendar_access_attempted: z.literal(false),
  model_call_attempted: z.literal(false),
  background_job_attempted: z.literal(false),
  raw_bodies_included: z.literal(false),
  write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export const MorningBriefPlanSchema = z.strictObject({
  planner_version: z.literal(MORNING_BRIEF_PLANNER_VERSION),
  request_id: PlannerIdSchema,
  brief_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  section_plans: z.array(MorningBriefSectionPlanSchema),
  item_decisions: z.array(MorningBriefItemDecisionSchema),
  omission_decisions: z.array(MorningBriefOmissionDecisionSchema),
  warnings: z.array(MorningBriefPlannerWarningSchema),
  governance: MorningBriefGovernanceSummarySchema,
  write_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type MorningBriefInclusionAction = z.infer<
  typeof MorningBriefInclusionActionSchema
>;
export type MorningBriefPlannerWarning = z.infer<
  typeof MorningBriefPlannerWarningSchema
>;
export type MorningBriefItemDecision = z.infer<
  typeof MorningBriefItemDecisionSchema
>;
export type MorningBriefOmissionDecision = z.infer<
  typeof MorningBriefOmissionDecisionSchema
>;
export type MorningBriefSectionPlan = z.infer<
  typeof MorningBriefSectionPlanSchema
>;
export type MorningBriefGovernanceSummary = z.infer<
  typeof MorningBriefGovernanceSummarySchema
>;
export type MorningBriefPlan = z.infer<typeof MorningBriefPlanSchema>;

const PRIORITY_RANK: Record<MorningBriefPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SECTION_ORDER = new Map<MorningBriefSectionType, number>(
  MORNING_BRIEF_SECTIONS.map((section, index) => [section, index]),
);

const SECTION_SHAPES: Record<
  MorningBriefSectionType,
  MorningBriefSection["intended_summary_shape"]
> = {
  today_overview: "ranked_items",
  calendar_summary: "timeline",
  inbox_summary: "ranked_items",
  project_focus: "ranked_items",
  knowledge_updates: "bullets",
  risk_alerts: "risk_list",
  recommended_actions: "action_list",
};

export function planMorningBrief(input: unknown): MorningBriefPlan {
  const request = MorningBriefRequestSchema.parse(input);
  const requestedSections = new Set(request.requested_sections);
  const verificationBySource = groupVerificationBySource(
    request.verification_metadata,
  );
  const decisions = sortDecisions([
    ...request.calendar_metadata.map((item) =>
      decideCalendarEvent(item, request, verificationBySource),
    ),
    ...request.email_metadata.map((item) =>
      decideEmailMessage(item, request, verificationBySource),
    ),
    ...request.project_metadata.map((item) =>
      decideProject(item, request, verificationBySource),
    ),
    ...request.knowledge_metadata.map((item) => decideKnowledgeUpdate(item)),
    ...request.reminder_metadata.map((item) => decideReminder(item, request)),
    ...request.verification_metadata.map((item) => decideVerification(item)),
    ...request.librarian_updates.map((item) => decideLibrarianUpdate(item)),
  ]).map((decision) =>
    requestedSections.has(decision.section_type)
      ? decision
      : {
          ...decision,
          inclusion: "suppress" as const,
          reasons: unique([...decision.reasons, "section_not_requested"]),
        },
  );

  const sectionPlans = request.requested_sections.map((sectionType) =>
    buildSectionPlan(sectionType, decisions),
  );

  const warnings = warningsFor(request, decisions);
  const plan = {
    planner_version: MORNING_BRIEF_PLANNER_VERSION,
    request_id: request.request_id,
    brief_date: request.brief_date,
    section_plans: sectionPlans,
    item_decisions: decisions,
    omission_decisions: decisions
      .filter((decision) => decision.inclusion !== "include")
      .map((decision) => ({
        item_id: decision.item_id,
        item_kind: decision.item_kind,
        intended_section_type: decision.section_type,
        inclusion: decision.inclusion,
        priority: decision.priority,
        reasons: decision.reasons,
        metadata_only: true,
        raw_body_included: false,
      })),
    warnings,
    governance: governanceSummary(),
    write_attempted: false,
    metadata_only: true,
  };

  return MorningBriefPlanSchema.parse(plan);
}

function decideCalendarEvent(
  event: MorningBriefCalendarMetadata,
  request: MorningBriefRequest,
  verificationBySource: Map<
    string,
    readonly MorningBriefVerificationMetadata[]
  >,
): MorningBriefItemDecision {
  const verification = verificationBySource.get(event.event_id) ?? [];
  const risk = verificationRisk(verification);
  const priority = maxPriority(event.priority, risk.priority);
  const sameDay = datePart(event.start_at) === request.brief_date;
  const include = sameDay || isHighPriority(priority);
  const reasons = [
    sameDay
      ? "calendar_event_on_brief_date"
      : "calendar_event_outside_brief_date",
    ...risk.reasons,
  ];

  return itemDecision({
    item_id: event.event_id,
    item_kind: "calendar_event",
    section_type: "calendar_summary",
    inclusion: include ? "include" : "defer",
    priority,
    source_ref: sourceRef(event.event_id, "calendar"),
    verification_ref_ids: event.verification_ref_ids,
    risk_flags: risk.riskFlags,
    ordering_hint: event.start_at,
    reasons,
  });
}

function decideEmailMessage(
  email: MorningBriefEmailMetadata,
  request: MorningBriefRequest,
  verificationBySource: Map<
    string,
    readonly MorningBriefVerificationMetadata[]
  >,
): MorningBriefItemDecision {
  const verification = verificationBySource.get(email.message_id) ?? [];
  const risk = verificationRisk(verification);
  const priority = maxPriority(email.priority, risk.priority);
  const labels = new Set(email.label_ids.map((label) => label.toLowerCase()));
  const receivedToday =
    email.received_at !== null &&
    datePart(email.received_at) === request.brief_date;
  const blockedLabel = labels.has("spam") || labels.has("trash");
  const shouldInclude =
    !blockedLabel &&
    (isHighPriority(priority) ||
      labels.has("inbox") ||
      email.attachment_count > 0 ||
      receivedToday);

  return itemDecision({
    item_id: email.message_id,
    item_kind: "email_message",
    section_type: "inbox_summary",
    inclusion: blockedLabel ? "suppress" : shouldInclude ? "include" : "defer",
    priority,
    source_ref: sourceRef(email.message_id, "email"),
    verification_ref_ids: email.verification_ref_ids,
    risk_flags: risk.riskFlags,
    ordering_hint: email.received_at ?? "9999-12-31T23:59:59.999Z",
    reasons: [
      blockedLabel
        ? "email_suppressed_by_label"
        : shouldInclude
          ? "email_relevant_to_brief"
          : "email_deferred_low_relevance",
      ...risk.reasons,
    ],
  });
}

function decideProject(
  project: MorningBriefProjectMetadata,
  request: MorningBriefRequest,
  verificationBySource: Map<
    string,
    readonly MorningBriefVerificationMetadata[]
  >,
): MorningBriefItemDecision {
  const verification = verificationBySource.get(project.project_id) ?? [];
  const risk = verificationRisk(verification);
  const dueToday =
    project.due_at !== null && datePart(project.due_at) <= request.brief_date;
  const blocked = project.status === "blocked";
  const priority = maxPriority(
    project.priority,
    risk.priority,
    blocked ? "critical" : "low",
    dueToday ? "high" : "low",
  );
  const inclusion =
    project.status === "done"
      ? "suppress"
      : blocked ||
          dueToday ||
          project.status === "active" ||
          isHighPriority(priority)
        ? "include"
        : "defer";

  return itemDecision({
    item_id: project.project_id,
    item_kind: "project",
    section_type: "project_focus",
    inclusion,
    priority,
    source_ref: sourceRef(project.project_id, "project"),
    risk_flags: risk.riskFlags,
    ordering_hint: `${project.status}:${project.due_at ?? "none"}`,
    reasons: [
      project.status === "done"
        ? "project_done_suppressed"
        : blocked
          ? "blocked_project_escalated"
          : dueToday
            ? "project_due_or_overdue"
            : project.status === "active"
              ? "active_project_included"
              : "project_deferred_by_status",
      ...risk.reasons,
    ],
  });
}

function decideKnowledgeUpdate(
  item: MorningBriefKnowledgeMetadata,
): MorningBriefItemDecision {
  const include =
    item.priority !== "low" ||
    item.source_type === "knowledge_compounding" ||
    item.source_type === "llm_wiki";

  return itemDecision({
    item_id: item.knowledge_id,
    item_kind: "knowledge_update",
    section_type: "knowledge_updates",
    inclusion: include ? "include" : "defer",
    priority: item.priority,
    source_ref: sourceRef(item.knowledge_id, "knowledge", item.content_hash),
    ordering_hint: item.updated_at ?? item.title,
    reasons: [
      include
        ? "knowledge_update_metadata_relevant"
        : "knowledge_update_low_priority_deferred",
      `source_type:${item.source_type}`,
    ],
  });
}

function decideReminder(
  reminder: MorningBriefReminderMetadata,
  request: MorningBriefRequest,
): MorningBriefItemDecision {
  const due =
    reminder.due_at !== null && datePart(reminder.due_at) <= request.brief_date;
  const priority = maxPriority(reminder.priority, due ? "high" : "low");

  return itemDecision({
    item_id: reminder.reminder_id,
    item_kind: "reminder",
    section_type: "recommended_actions",
    inclusion: due || isHighPriority(priority) ? "include" : "defer",
    priority,
    source_ref: sourceRef(reminder.reminder_id, "reminder"),
    ordering_hint: reminder.due_at ?? "9999-12-31T23:59:59.999Z",
    reasons: [due ? "reminder_due_or_overdue" : "reminder_deferred_future"],
  });
}

function decideVerification(
  verification: MorningBriefVerificationMetadata,
): MorningBriefItemDecision {
  const risk = verificationRisk([verification]);
  const include =
    verification.verification_status !== "verified" ||
    verification.confidence !== "high" ||
    verification.risk_flags.length > 0;

  return itemDecision({
    item_id: verification.verification_id,
    item_kind: "verification_alert",
    section_type: "risk_alerts",
    inclusion: include ? "include" : "defer",
    priority: risk.priority,
    source_ref: sourceRef(verification.verification_id, "verification"),
    verification_ref_ids: [verification.verification_id],
    risk_flags: verification.risk_flags,
    ordering_hint: verification.source_ref_id,
    reasons: [
      include
        ? "verification_risk_visible"
        : "verified_high_confidence_deferred",
      ...risk.reasons,
    ],
  });
}

function decideLibrarianUpdate(
  update: MorningBriefLibrarianUpdate,
): MorningBriefItemDecision {
  const durableOrCanonical =
    update.classification === "durable" ||
    update.classification === "canonical";
  const include =
    durableOrCanonical ||
    update.priority !== "low" ||
    update.route_target === "wiki";

  return itemDecision({
    item_id: update.librarian_envelope_id,
    item_kind: "librarian_update",
    section_type: "knowledge_updates",
    inclusion: include ? "include" : "defer",
    priority: update.priority,
    source_ref: sourceRef(
      update.librarian_envelope_id,
      "librarian",
      update.content_hash,
    ),
    librarian_update_ids: [update.librarian_envelope_id],
    ordering_hint: `${update.route_target}:${update.classification}`,
    reasons: [
      include
        ? "librarian_update_metadata_relevant"
        : "librarian_update_low_priority_deferred",
      `classification:${update.classification}`,
      `route:${update.route_target}`,
    ],
  });
}

function buildSectionPlan(
  sectionType: MorningBriefSectionType,
  decisions: readonly MorningBriefItemDecision[],
): MorningBriefSectionPlan {
  const sectionDecisions =
    sectionType === "today_overview"
      ? topOverviewDecisions(decisions)
      : decisions.filter((decision) => decision.section_type === sectionType);
  const included = sortDecisions(
    sectionDecisions.filter((decision) => decision.inclusion === "include"),
  );
  const deferred = sectionDecisions.filter(
    (decision) => decision.inclusion === "defer",
  );
  const suppressed = sectionDecisions.filter(
    (decision) => decision.inclusion === "suppress",
  );
  const priority = included.length
    ? maxPriority(...included.map((decision) => decision.priority))
    : "low";
  const section = {
    section_type: sectionType,
    priority,
    source_refs: included.map((decision) => decision.source_ref),
    verification_ref_ids: unique(
      included.flatMap((decision) => decision.verification_ref_ids),
    ),
    librarian_update_ids: unique(
      included.flatMap((decision) => decision.librarian_update_ids),
    ),
    intended_summary_shape: SECTION_SHAPES[sectionType],
    generated_text_included: false,
    metadata_only: true,
  };

  return MorningBriefSectionPlanSchema.parse({
    section,
    item_ids: included.map((decision) => decision.item_id),
    included_count: included.length,
    deferred_count: deferred.length,
    suppressed_count: suppressed.length,
    ordering: included.map((decision) => decision.item_id),
    metadata_only: true,
    generated_text_included: false,
  });
}

function topOverviewDecisions(
  decisions: readonly MorningBriefItemDecision[],
): readonly MorningBriefItemDecision[] {
  return sortDecisions(
    decisions.filter(
      (decision) =>
        decision.inclusion === "include" &&
        decision.section_type !== "today_overview",
    ),
  ).slice(0, 7);
}

function itemDecision(input: {
  readonly item_id: string;
  readonly item_kind: MorningBriefItemDecision["item_kind"];
  readonly section_type: MorningBriefSectionType;
  readonly inclusion: MorningBriefInclusionAction;
  readonly priority: MorningBriefPriority;
  readonly source_ref: MorningBriefSourceReference;
  readonly verification_ref_ids?: readonly string[];
  readonly librarian_update_ids?: readonly string[];
  readonly risk_flags?: readonly string[];
  readonly ordering_hint: string;
  readonly reasons: readonly string[];
}): MorningBriefItemDecision {
  return MorningBriefItemDecisionSchema.parse({
    item_id: input.item_id,
    item_kind: input.item_kind,
    section_type: input.section_type,
    inclusion: input.inclusion,
    priority: input.priority,
    ordering_key: [
      String(PRIORITY_RANK[input.priority]).padStart(2, "0"),
      String(SECTION_ORDER.get(input.section_type) ?? 99).padStart(2, "0"),
      input.ordering_hint,
      input.item_id,
    ].join(":"),
    source_ref: input.source_ref,
    verification_ref_ids: [...(input.verification_ref_ids ?? [])],
    librarian_update_ids: [...(input.librarian_update_ids ?? [])],
    risk_flags: unique([...(input.risk_flags ?? [])]),
    reasons: unique(input.reasons),
    metadata_only: true,
    raw_body_included: false,
  });
}

function sourceRef(
  sourceId: string,
  sourceDomain: MorningBriefSourceReference["source_domain"],
  contentHash: string | null = null,
): MorningBriefSourceReference {
  return MorningBriefSourceReferenceSchema.parse({
    source_id: sourceId,
    source_domain: sourceDomain,
    source_ref: `${sourceDomain}://${sourceId}`,
    content_hash: contentHash,
    metadata_only: true,
    raw_body_included: false,
  });
}

function groupVerificationBySource(
  verification: readonly MorningBriefVerificationMetadata[],
): Map<string, readonly MorningBriefVerificationMetadata[]> {
  const grouped = new Map<string, MorningBriefVerificationMetadata[]>();
  for (const item of verification) {
    grouped.set(item.source_ref_id, [
      ...(grouped.get(item.source_ref_id) ?? []),
      item,
    ]);
  }
  return grouped;
}

function verificationRisk(
  verification: readonly MorningBriefVerificationMetadata[],
): {
  readonly priority: MorningBriefPriority;
  readonly riskFlags: readonly string[];
  readonly reasons: readonly string[];
} {
  if (verification.length === 0) {
    return { priority: "low", riskFlags: [], reasons: [] };
  }

  const riskFlags = unique(verification.flatMap((item) => item.risk_flags));
  const statuses = new Set(
    verification.map((item) => item.verification_status),
  );
  const confidences = new Set(verification.map((item) => item.confidence));
  const critical =
    statuses.has("conflicting") ||
    statuses.has("needs_human_review") ||
    statuses.has("failed_closed") ||
    riskFlags.includes("safety_sensitive") ||
    riskFlags.includes("conflicting_context") ||
    riskFlags.includes("model_disagreement");
  const high =
    critical ||
    statuses.has("unverified") ||
    statuses.has("verified_with_caveat") ||
    statuses.has("unavailable") ||
    confidences.has("low") ||
    confidences.has("unknown") ||
    riskFlags.length > 0;

  return {
    priority: critical ? "critical" : high ? "high" : "medium",
    riskFlags,
    reasons: [
      "verification_metadata_considered",
      ...(critical ? ["verification_escalated_critical"] : []),
      ...(!critical && high ? ["verification_escalated_high"] : []),
    ],
  };
}

function warningsFor(
  request: MorningBriefRequest,
  decisions: readonly MorningBriefItemDecision[],
): readonly MorningBriefPlannerWarning[] {
  const warnings: MorningBriefPlannerWarning[] = ["metadata_only"];
  if (
    request.calendar_metadata.length +
      request.email_metadata.length +
      request.project_metadata.length +
      request.knowledge_metadata.length +
      request.reminder_metadata.length +
      request.verification_metadata.length +
      request.librarian_updates.length ===
    0
  ) {
    warnings.push("insufficient_input_metadata");
  }
  if (
    decisions.some(
      (decision) =>
        decision.section_type === "risk_alerts" &&
        decision.inclusion === "include",
    )
  ) {
    warnings.push("high_risk_verification_present");
  }
  if (
    decisions.some((decision) =>
      decision.reasons.includes("section_not_requested"),
    )
  ) {
    warnings.push("section_not_requested");
  }
  return unique(warnings);
}

function governanceSummary(): MorningBriefGovernanceSummary {
  return {
    generation_attempted: false,
    scheduling_attempted: false,
    delivery_attempted: false,
    notification_attempted: false,
    gmail_access_attempted: false,
    calendar_access_attempted: false,
    model_call_attempted: false,
    background_job_attempted: false,
    raw_bodies_included: false,
    write_attempted: false,
    metadata_only: true,
  };
}

function sortDecisions(
  decisions: readonly MorningBriefItemDecision[],
): MorningBriefItemDecision[] {
  return [...decisions].sort((left, right) =>
    left.ordering_key.localeCompare(right.ordering_key),
  );
}

function maxPriority(
  ...priorities: readonly MorningBriefPriority[]
): MorningBriefPriority {
  return priorities.reduce<MorningBriefPriority>(
    (best, priority) =>
      PRIORITY_RANK[priority] < PRIORITY_RANK[best] ? priority : best,
    "low",
  );
}

function isHighPriority(priority: MorningBriefPriority): boolean {
  return priority === "critical" || priority === "high";
}

function datePart(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

function unique<const T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
