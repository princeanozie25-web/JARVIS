import { z } from "zod";

export const MORNING_BRIEF_CONTRACT_VERSION =
  "phase21c.morning-brief-contract.v1" as const;

export const MORNING_BRIEF_SECTIONS = [
  "today_overview",
  "calendar_summary",
  "inbox_summary",
  "project_focus",
  "knowledge_updates",
  "risk_alerts",
  "recommended_actions",
] as const;

export const MORNING_BRIEF_PRIORITIES = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export const MORNING_BRIEF_SOURCE_DOMAINS = [
  "calendar",
  "email",
  "project",
  "knowledge",
  "reminder",
  "verification",
  "librarian",
] as const;

export const MORNING_BRIEF_GOVERNANCE = {
  contract_only: true,
  generation_supported: false,
  scheduling_supported: false,
  delivery_supported: false,
  notification_supported: false,
  gmail_access_supported: false,
  calendar_access_supported: false,
  model_call_supported: false,
  background_job_supported: false,
  mutation_supported: false,
  raw_bodies_supported: false,
  metadata_only: true,
} as const;

const ContractIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:[._:/-][a-z0-9]+)*$/);

const HashReferenceSchema = z
  .string()
  .trim()
  .regex(/^sha256:[a-f0-9]{64}$/);

const DateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/);
const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });
const BoundedTextSchema = z.string().trim().min(1).max(500);

export const MorningBriefSectionTypeSchema = z.enum(MORNING_BRIEF_SECTIONS);
export const MorningBriefPrioritySchema = z.enum(MORNING_BRIEF_PRIORITIES);
export const MorningBriefSourceDomainSchema = z.enum(
  MORNING_BRIEF_SOURCE_DOMAINS,
);

export const MorningBriefSourceReferenceSchema = z.strictObject({
  source_id: ContractIdSchema,
  source_domain: MorningBriefSourceDomainSchema,
  source_ref: z.string().trim().min(1).max(240).nullable().default(null),
  content_hash: HashReferenceSchema.nullable().default(null),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefUserContextSchema = z.strictObject({
  user_id_hash: HashReferenceSchema,
  timezone: z.string().trim().min(1).max(80),
  locale: z.string().trim().min(2).max(20).default("en-US"),
  day_intent_hash: HashReferenceSchema.nullable().default(null),
  focus_area_ids: z.array(ContractIdSchema).default([]),
  raw_user_profile_included: z.literal(false),
});

export const MorningBriefCalendarMetadataSchema = z.strictObject({
  event_id: ContractIdSchema,
  calendar_source_id: ContractIdSchema,
  title_hash: HashReferenceSchema.nullable().default(null),
  start_at: IsoDateTimeSchema,
  end_at: IsoDateTimeSchema,
  attendee_count: z.number().int().nonnegative().default(0),
  location_hash: HashReferenceSchema.nullable().default(null),
  priority: MorningBriefPrioritySchema.default("medium"),
  verification_ref_ids: z.array(ContractIdSchema).default([]),
  metadata_only: z.literal(true),
  raw_description_included: z.literal(false),
});

export const MorningBriefEmailMetadataSchema = z.strictObject({
  message_id: ContractIdSchema,
  thread_id: ContractIdSchema,
  subject_hash: HashReferenceSchema.nullable().default(null),
  sender_hash: HashReferenceSchema.nullable().default(null),
  received_at: IsoDateTimeSchema.nullable().default(null),
  label_ids: z.array(z.string().trim().min(1).max(80)).default([]),
  attachment_count: z.number().int().nonnegative().default(0),
  priority: MorningBriefPrioritySchema.default("medium"),
  verification_ref_ids: z.array(ContractIdSchema).default([]),
  metadata_only: z.literal(true),
  raw_message_body_included: z.literal(false),
});

export const MorningBriefProjectMetadataSchema = z.strictObject({
  project_id: ContractIdSchema,
  project_name: z.string().trim().min(1).max(160),
  status: z.enum(["active", "blocked", "paused", "done", "unknown"]),
  priority: MorningBriefPrioritySchema.default("medium"),
  due_at: IsoDateTimeSchema.nullable().default(null),
  source_refs: z.array(MorningBriefSourceReferenceSchema).default([]),
  metadata_only: z.literal(true),
});

export const MorningBriefKnowledgeMetadataSchema = z.strictObject({
  knowledge_id: ContractIdSchema,
  title: z.string().trim().min(1).max(180),
  source_type: z.enum([
    "librarian",
    "llm_wiki",
    "knowledge_compounding",
    "obsidian",
    "gitnexus",
    "external_research",
  ]),
  content_hash: HashReferenceSchema,
  updated_at: IsoDateTimeSchema.nullable().default(null),
  priority: MorningBriefPrioritySchema.default("low"),
  source_refs: z.array(MorningBriefSourceReferenceSchema).default([]),
  metadata_only: z.literal(true),
  raw_note_body_included: z.literal(false),
});

export const MorningBriefReminderMetadataSchema = z.strictObject({
  reminder_id: ContractIdSchema,
  title_hash: HashReferenceSchema,
  due_at: IsoDateTimeSchema.nullable().default(null),
  priority: MorningBriefPrioritySchema.default("medium"),
  source_refs: z.array(MorningBriefSourceReferenceSchema).default([]),
  metadata_only: z.literal(true),
  raw_reminder_body_included: z.literal(false),
});

export const MorningBriefVerificationMetadataSchema = z.strictObject({
  verification_id: ContractIdSchema,
  source_ref_id: ContractIdSchema,
  verification_status: z.enum([
    "verified",
    "verified_with_caveat",
    "unverified",
    "conflicting",
    "needs_human_review",
    "failed_closed",
    "unavailable",
    "skipped",
  ]),
  confidence: z.enum(["high", "medium", "low", "unknown"]),
  caveat_summary: BoundedTextSchema.nullable().default(null),
  risk_flags: z
    .array(
      z.enum([
        "unsupported_claim",
        "outdated_information",
        "insufficient_sources",
        "overconfident_answer",
        "safety_sensitive",
        "conflicting_context",
        "model_disagreement",
      ]),
    )
    .default([]),
  advisory_only: z.literal(true),
  metadata_only: z.literal(true),
  raw_verifier_response_included: z.literal(false),
});

export const MorningBriefLibrarianUpdateSchema = z.strictObject({
  librarian_envelope_id: ContractIdSchema,
  source_type: z.enum([
    "user_note",
    "agent_output",
    "gitnexus",
    "llm_wiki",
    "knowledge_compounding",
    "imported_document",
    "external_research",
    "google_gmail",
    "google_calendar",
    "google_drive",
  ]),
  classification: z.enum(["transient", "candidate", "durable", "canonical"]),
  route_target: z.enum([
    "inbox",
    "wiki",
    "project",
    "research",
    "learning",
    "career",
    "agent",
    "reference",
    "review",
    "archive",
    "meta",
  ]),
  content_hash: HashReferenceSchema,
  priority: MorningBriefPrioritySchema.default("low"),
  promotion_attempted: z.literal(false),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefSectionSchema = z.strictObject({
  section_type: MorningBriefSectionTypeSchema,
  priority: MorningBriefPrioritySchema,
  source_refs: z.array(MorningBriefSourceReferenceSchema),
  verification_ref_ids: z.array(ContractIdSchema).default([]),
  librarian_update_ids: z.array(ContractIdSchema).default([]),
  intended_summary_shape: z.enum([
    "bullets",
    "ranked_items",
    "risk_list",
    "action_list",
    "timeline",
  ]),
  generated_text_included: z.literal(false),
  metadata_only: z.literal(true),
});

export const MorningBriefRequestSchema = z.strictObject({
  kind: z.literal("morning_brief.request"),
  contract_version: z.literal(MORNING_BRIEF_CONTRACT_VERSION),
  request_id: ContractIdSchema,
  brief_date: DateSchema,
  created_at: IsoDateTimeSchema,
  user_context: MorningBriefUserContextSchema,
  calendar_metadata: z.array(MorningBriefCalendarMetadataSchema).default([]),
  email_metadata: z.array(MorningBriefEmailMetadataSchema).default([]),
  project_metadata: z.array(MorningBriefProjectMetadataSchema).default([]),
  knowledge_metadata: z.array(MorningBriefKnowledgeMetadataSchema).default([]),
  reminder_metadata: z.array(MorningBriefReminderMetadataSchema).default([]),
  verification_metadata: z
    .array(MorningBriefVerificationMetadataSchema)
    .default([]),
  librarian_updates: z.array(MorningBriefLibrarianUpdateSchema).default([]),
  requested_sections: z
    .array(MorningBriefSectionTypeSchema)
    .default([...MORNING_BRIEF_SECTIONS]),
  metadata_only: z.literal(true),
  generation_requested: z.literal(false),
  scheduling_requested: z.literal(false),
  delivery_requested: z.literal(false),
  notification_requested: z.literal(false),
  model_call_requested: z.literal(false),
  raw_calendar_bodies_included: z.literal(false),
  raw_email_bodies_included: z.literal(false),
  raw_knowledge_bodies_included: z.literal(false),
});

export const MorningBriefContractSchema = z.strictObject({
  contract_version: z.literal(MORNING_BRIEF_CONTRACT_VERSION),
  supported_sections: z.array(MorningBriefSectionTypeSchema),
  supported_priorities: z.array(MorningBriefPrioritySchema),
  governance: z.strictObject({
    contract_only: z.literal(true),
    generation_supported: z.literal(false),
    scheduling_supported: z.literal(false),
    delivery_supported: z.literal(false),
    notification_supported: z.literal(false),
    gmail_access_supported: z.literal(false),
    calendar_access_supported: z.literal(false),
    model_call_supported: z.literal(false),
    background_job_supported: z.literal(false),
    mutation_supported: z.literal(false),
    raw_bodies_supported: z.literal(false),
    metadata_only: z.literal(true),
  }),
});

export type MorningBriefSectionType = z.infer<
  typeof MorningBriefSectionTypeSchema
>;
export type MorningBriefPriority = z.infer<typeof MorningBriefPrioritySchema>;
export type MorningBriefSourceReference = z.infer<
  typeof MorningBriefSourceReferenceSchema
>;
export type MorningBriefCalendarMetadata = z.infer<
  typeof MorningBriefCalendarMetadataSchema
>;
export type MorningBriefEmailMetadata = z.infer<
  typeof MorningBriefEmailMetadataSchema
>;
export type MorningBriefProjectMetadata = z.infer<
  typeof MorningBriefProjectMetadataSchema
>;
export type MorningBriefKnowledgeMetadata = z.infer<
  typeof MorningBriefKnowledgeMetadataSchema
>;
export type MorningBriefReminderMetadata = z.infer<
  typeof MorningBriefReminderMetadataSchema
>;
export type MorningBriefRequest = z.infer<typeof MorningBriefRequestSchema>;
export type MorningBriefSection = z.infer<typeof MorningBriefSectionSchema>;
export type MorningBriefVerificationMetadata = z.infer<
  typeof MorningBriefVerificationMetadataSchema
>;
export type MorningBriefLibrarianUpdate = z.infer<
  typeof MorningBriefLibrarianUpdateSchema
>;

export function createMorningBriefRequest(input: unknown): MorningBriefRequest {
  return MorningBriefRequestSchema.parse(input);
}

export function createMorningBriefSection(input: unknown): MorningBriefSection {
  return MorningBriefSectionSchema.parse(input);
}

export const MORNING_BRIEF_CONTRACT = MorningBriefContractSchema.parse({
  contract_version: MORNING_BRIEF_CONTRACT_VERSION,
  supported_sections: [...MORNING_BRIEF_SECTIONS],
  supported_priorities: [...MORNING_BRIEF_PRIORITIES],
  governance: MORNING_BRIEF_GOVERNANCE,
});
