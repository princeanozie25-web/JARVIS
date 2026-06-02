import { z } from "zod";
import {
  MorningBriefPrioritySchema,
  MorningBriefRequestSchema,
  MorningBriefSectionTypeSchema,
  createMorningBriefRequest,
  type MorningBriefRequest,
} from "./contract";
import {
  MorningBriefGenerationResultSchema,
  generateMorningBrief,
} from "./generator";
import { planMorningBrief } from "./planner";

export const MORNING_BRIEF_PREVIEW_CLI_VERSION =
  "phase21c.morning-brief-preview-cli.v1" as const;

const HASH_A = `sha256:${"a".repeat(64)}`;
const HASH_B = `sha256:${"b".repeat(64)}`;
const NOW = "2026-06-02T07:30:00.000Z";

export const MorningBriefSectionPreviewSchema = z.strictObject({
  section_type: MorningBriefSectionTypeSchema,
  title: z.string().trim().min(1).max(500),
  priority: MorningBriefPrioritySchema,
  item_count: z.number().int().nonnegative(),
  bullets: z.array(z.string().trim().min(1).max(500)),
  risk_flags: z.array(z.string().trim().min(1).max(80)),
  verification_ref_ids: z.array(z.string().trim().min(1).max(180)),
  librarian_update_ids: z.array(z.string().trim().min(1).max(180)),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefPreviewCliReportSchema = z.strictObject({
  status: z.enum(["ok", "failed"]),
  cli_version: z.literal(MORNING_BRIEF_PREVIEW_CLI_VERSION),
  title: z.string().trim().min(1).max(500),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/),
  section_count: z.number().int().nonnegative(),
  priority_summary: MorningBriefGenerationResultSchema.shape.priority_summary,
  caveats: z.array(z.string().trim().min(1).max(500)),
  section_previews: z.array(MorningBriefSectionPreviewSchema),
  delivery_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  notification_attempted: z.literal(false),
  gmail_access_attempted: z.literal(false),
  calendar_access_attempted: z.literal(false),
  drive_access_attempted: z.literal(false),
  live_model_call_attempted: z.literal(false),
  vault_write_attempted: z.literal(false),
  write_attempted: z.literal(false),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export type MorningBriefSectionPreview = z.infer<
  typeof MorningBriefSectionPreviewSchema
>;
export type MorningBriefPreviewCliReport = z.infer<
  typeof MorningBriefPreviewCliReportSchema
>;

export interface MorningBriefPreviewCliDependencies {
  readonly write?: (line: string) => void;
  readonly request?: MorningBriefRequest;
}

export async function runMorningBriefPreviewCli(
  dependencies: MorningBriefPreviewCliDependencies = {},
): Promise<MorningBriefPreviewCliReport> {
  const report = await createMorningBriefPreviewReport(
    dependencies.request ?? buildSampleMorningBriefRequest(),
  );
  printMorningBriefPreviewReport(report, dependencies.write);
  return report;
}

export async function createMorningBriefPreviewReport(
  request: MorningBriefRequest,
): Promise<MorningBriefPreviewCliReport> {
  const parsedRequest = MorningBriefRequestSchema.parse(request);
  const plan = planMorningBrief(parsedRequest);
  const generated = await generateMorningBrief({
    request: parsedRequest,
    plan,
    runtime_mode: "deterministic_mock",
    metadata_only: true,
    delivery_requested: false,
    scheduling_requested: false,
    notification_requested: false,
    live_model_requested: false,
  });

  return MorningBriefPreviewCliReportSchema.parse({
    status: generated.generation_status === "generated" ? "ok" : "failed",
    cli_version: MORNING_BRIEF_PREVIEW_CLI_VERSION,
    title: generated.title,
    date: generated.brief_date,
    section_count: generated.sections.length,
    priority_summary: generated.priority_summary,
    caveats: generated.caveats,
    section_previews: generated.sections.map((section) => ({
      section_type: section.section_type,
      title: section.title,
      priority: section.priority,
      item_count: section.item_ids.length,
      bullets: section.bullets.slice(0, 5),
      risk_flags: section.risk_flags,
      verification_ref_ids: section.verification_ref_ids,
      librarian_update_ids: section.librarian_update_ids,
      metadata_only: true,
      raw_body_included: false,
    })),
    delivery_attempted: false,
    scheduling_attempted: false,
    notification_attempted: false,
    gmail_access_attempted: false,
    calendar_access_attempted: false,
    drive_access_attempted: false,
    live_model_call_attempted: false,
    vault_write_attempted: false,
    write_attempted: false,
    metadata_only: true,
    raw_body_included: false,
  });
}

export function printMorningBriefPreviewReport(
  report: MorningBriefPreviewCliReport,
  write: (line: string) => void = console.log,
): void {
  write(JSON.stringify(report, null, 2));
}

export function buildSampleMorningBriefRequest(): MorningBriefRequest {
  return createMorningBriefRequest({
    kind: "morning_brief.request",
    contract_version: "phase21c.morning-brief-contract.v1",
    request_id: "morning-brief:preview",
    brief_date: "2026-06-02",
    created_at: NOW,
    user_context: {
      user_id_hash: HASH_A,
      timezone: "Europe/London",
      locale: "en-GB",
      day_intent_hash: HASH_B,
      focus_area_ids: ["project:jarvis"],
      raw_user_profile_included: false,
    },
    calendar_metadata: [
      {
        event_id: "calendar:metadata-review",
        calendar_source_id: "google:calendar-main",
        title_hash: HASH_A,
        start_at: "2026-06-02T09:00:00.000Z",
        end_at: "2026-06-02T09:45:00.000Z",
        attendee_count: 1,
        priority: "high",
        metadata_only: true,
        raw_description_included: false,
      },
    ],
    email_metadata: [
      {
        message_id: "gmail:adapter-readiness",
        thread_id: "gmail:thread-adapter-readiness",
        subject_hash: HASH_B,
        sender_hash: HASH_A,
        received_at: NOW,
        label_ids: ["INBOX"],
        attachment_count: 0,
        priority: "medium",
        verification_ref_ids: ["verification:adapter-readiness"],
        metadata_only: true,
        raw_message_body_included: false,
      },
    ],
    project_metadata: [
      {
        project_id: "project:jarvis",
        project_name: "JARVIS",
        status: "active",
        priority: "critical",
        due_at: null,
        metadata_only: true,
      },
    ],
    knowledge_metadata: [
      {
        knowledge_id: "knowledge:llm-wiki",
        title: "LLM Wiki planning metadata",
        source_type: "llm_wiki",
        content_hash: HASH_A,
        updated_at: NOW,
        priority: "medium",
        metadata_only: true,
        raw_note_body_included: false,
      },
    ],
    reminder_metadata: [
      {
        reminder_id: "reminder:phase21c-checks",
        title_hash: HASH_B,
        due_at: NOW,
        priority: "high",
        metadata_only: true,
        raw_reminder_body_included: false,
      },
    ],
    verification_metadata: [
      {
        verification_id: "verification:adapter-readiness",
        source_ref_id: "gmail:adapter-readiness",
        verification_status: "verified_with_caveat",
        confidence: "medium",
        caveat_summary: "Preview uses safe fixture metadata only.",
        risk_flags: ["insufficient_sources"],
        advisory_only: true,
        metadata_only: true,
        raw_verifier_response_included: false,
      },
    ],
    librarian_updates: [
      {
        librarian_envelope_id: "librarian:wiki-compounding",
        source_type: "knowledge_compounding",
        classification: "candidate",
        route_target: "wiki",
        content_hash: HASH_B,
        priority: "medium",
        promotion_attempted: false,
        metadata_only: true,
        raw_body_included: false,
      },
    ],
    metadata_only: true,
    generation_requested: false,
    scheduling_requested: false,
    delivery_requested: false,
    notification_requested: false,
    model_call_requested: false,
    raw_calendar_bodies_included: false,
    raw_email_bodies_included: false,
    raw_knowledge_bodies_included: false,
  });
}
