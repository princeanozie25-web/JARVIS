import { z } from "zod";
import { MorningBriefGovernanceSummarySchema } from "./composer";
import {
  MorningBriefPreviewSchema,
  type MorningBriefPreview,
} from "./real-preview";
import { MorningBriefInputReadinessSchema } from "./real-input-contract";

export const MORNING_BRIEF_SUGGESTION_PAYLOAD_VERSION =
  "phase21c.morning-brief-suggestion-payload.v1" as const;

export const MORNING_BRIEF_SUGGESTION_WRITE_PLAN_VERSION =
  "phase21c.morning-brief-suggestion-write-plan.v1" as const;

export const MORNING_BRIEF_SUGGESTION_OUTPUT_KIND =
  "suggestion.digest" as const;

export const MORNING_BRIEF_SUGGESTION_PLAN_STATUSES = [
  "dry_run",
  "injected_writer_planned",
  "rejected",
] as const;

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

const BoundedTextSchema = z.string().trim().min(1).max(500);

export const MorningBriefSuggestionSectionSchema = z.strictObject({
  section_type: z.string().trim().min(1).max(80),
  title: BoundedTextSchema,
  status: z.string().trim().min(1).max(80),
  item_count: z.number().int().nonnegative(),
  summary: BoundedTextSchema,
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefSuggestionPayloadGovernanceSchema = z.strictObject({
  suggestion_only: z.literal(true),
  digest_only: z.literal(true),
  metadata_only: z.literal(true),
  action_execution_supported: z.literal(false),
  approval_finalization_supported: z.literal(false),
  send_supported: z.literal(false),
  apply_supported: z.literal(false),
  mutation_supported: z.literal(false),
  raw_body_included: z.literal(false),
});

export const MorningBriefSuggestionPayloadSchema = z.strictObject({
  kind: z.literal(MORNING_BRIEF_SUGGESTION_OUTPUT_KIND),
  payload_version: z.literal(MORNING_BRIEF_SUGGESTION_PAYLOAD_VERSION),
  suggestion_id: z.string().trim().min(1).max(220),
  source_kind: z.literal("morning_brief.preview"),
  preview_id: z.string().trim().min(1).max(180),
  title: BoundedTextSchema,
  generated_at: IsoDateTimeSchema,
  source_built_at: IsoDateTimeSchema,
  readiness: MorningBriefInputReadinessSchema,
  readiness_status: z.enum(["ready", "degraded", "not_ready"]),
  degraded: z.boolean(),
  section_count: z.number().int().nonnegative(),
  sections: z.array(MorningBriefSuggestionSectionSchema),
  governance_notes: z.array(z.string().trim().min(1).max(180)),
  composer_governance: MorningBriefGovernanceSummarySchema,
  governance: MorningBriefSuggestionPayloadGovernanceSchema,
  suggestion_inbox_ready: z.literal(true),
  delivery_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  write_attempted: z.literal(false),
  execution_attempted: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefSuggestionWriterResultSchema = z.strictObject({
  writer_id: z.string().trim().min(1).max(160),
  accepted: z.boolean(),
  wrote_to_real_inbox: z.literal(false),
  result_metadata_only: z.literal(true),
});

export const MorningBriefSuggestionWritePlanSchema = z.strictObject({
  plan_version: z.literal(MORNING_BRIEF_SUGGESTION_WRITE_PLAN_VERSION),
  status: z.enum(MORNING_BRIEF_SUGGESTION_PLAN_STATUSES),
  payload: MorningBriefSuggestionPayloadSchema,
  reasons: z.array(z.string().trim().min(1).max(180)),
  warnings: z.array(z.string().trim().min(1).max(180)),
  writer_result: MorningBriefSuggestionWriterResultSchema.nullable(),
  dry_run: z.boolean(),
  writer_injected: z.boolean(),
  real_inbox_write_attempted: z.literal(false),
  write_attempted: z.literal(false),
  execution_attempted: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type MorningBriefSuggestionSection = z.infer<
  typeof MorningBriefSuggestionSectionSchema
>;
export type MorningBriefSuggestionPayload = z.infer<
  typeof MorningBriefSuggestionPayloadSchema
>;
export type MorningBriefSuggestionWriterResult = z.infer<
  typeof MorningBriefSuggestionWriterResultSchema
>;
export type MorningBriefSuggestionWritePlan = z.infer<
  typeof MorningBriefSuggestionWritePlanSchema
>;
export type MorningBriefSuggestionPlanStatus =
  (typeof MORNING_BRIEF_SUGGESTION_PLAN_STATUSES)[number];

export interface MorningBriefSuggestionWriter {
  readonly writer_id: string;
  readonly preview_only: true;
  writePreviewPayload(
    payload: MorningBriefSuggestionPayload,
  ):
    | MorningBriefSuggestionWriterResult
    | Promise<MorningBriefSuggestionWriterResult>;
}

export function buildMorningBriefSuggestionPayload(
  preview: MorningBriefPreview,
): MorningBriefSuggestionPayload {
  const parsed = MorningBriefPreviewSchema.parse(preview);

  return MorningBriefSuggestionPayloadSchema.parse({
    kind: MORNING_BRIEF_SUGGESTION_OUTPUT_KIND,
    payload_version: MORNING_BRIEF_SUGGESTION_PAYLOAD_VERSION,
    suggestion_id: `suggestion:morning-brief:${parsed.preview_id}`,
    source_kind: "morning_brief.preview",
    preview_id: parsed.preview_id,
    title: parsed.title,
    generated_at: parsed.generated_at,
    source_built_at: parsed.source_built_at,
    readiness: parsed.readiness,
    readiness_status: parsed.readiness.status,
    degraded: parsed.degraded,
    section_count: parsed.section_count,
    sections: parsed.sections.map((section) => ({
      section_type: section.section_type,
      title: section.title,
      status: section.status,
      item_count: section.item_count,
      summary: section.summary,
      metadata_only: true,
      raw_body_included: false,
    })),
    governance_notes: [
      ...parsed.governance_notes,
      "suggestion_inbox_payload_ready",
      "suggestion_only_digest",
    ],
    composer_governance: parsed.governance,
    governance: {
      suggestion_only: true,
      digest_only: true,
      metadata_only: true,
      action_execution_supported: false,
      approval_finalization_supported: false,
      send_supported: false,
      apply_supported: false,
      mutation_supported: false,
      raw_body_included: false,
    },
    suggestion_inbox_ready: true,
    delivery_attempted: false,
    scheduling_attempted: false,
    write_attempted: false,
    execution_attempted: false,
    approval_finalization_attempted: false,
    metadata_only: true,
    raw_body_included: false,
  });
}

export async function planMorningBriefSuggestionInboxWrite(
  preview: MorningBriefPreview,
  writer?: MorningBriefSuggestionWriter | null,
): Promise<MorningBriefSuggestionWritePlan> {
  const payload = buildMorningBriefSuggestionPayload(preview);

  if (!writer) {
    return MorningBriefSuggestionWritePlanSchema.parse({
      plan_version: MORNING_BRIEF_SUGGESTION_WRITE_PLAN_VERSION,
      status: "dry_run",
      payload,
      reasons: ["dry_run_default_no_writer_supplied"],
      warnings: ["real_suggestion_inbox_write_not_attempted"],
      writer_result: null,
      dry_run: true,
      writer_injected: false,
      real_inbox_write_attempted: false,
      write_attempted: false,
      execution_attempted: false,
      approval_finalization_attempted: false,
      metadata_only: true,
    });
  }

  if (writer.preview_only !== true) {
    return MorningBriefSuggestionWritePlanSchema.parse({
      plan_version: MORNING_BRIEF_SUGGESTION_WRITE_PLAN_VERSION,
      status: "rejected",
      payload,
      reasons: ["writer_must_be_preview_only"],
      warnings: ["writer_rejected_before_invocation"],
      writer_result: null,
      dry_run: true,
      writer_injected: true,
      real_inbox_write_attempted: false,
      write_attempted: false,
      execution_attempted: false,
      approval_finalization_attempted: false,
      metadata_only: true,
    });
  }

  const writerResult = MorningBriefSuggestionWriterResultSchema.parse(
    await writer.writePreviewPayload(payload),
  );

  return MorningBriefSuggestionWritePlanSchema.parse({
    plan_version: MORNING_BRIEF_SUGGESTION_WRITE_PLAN_VERSION,
    status: "injected_writer_planned",
    payload,
    reasons: ["preview_only_injected_writer_invoked"],
    warnings: ["real_suggestion_inbox_write_not_attempted"],
    writer_result: writerResult,
    dry_run: true,
    writer_injected: true,
    real_inbox_write_attempted: false,
    write_attempted: false,
    execution_attempted: false,
    approval_finalization_attempted: false,
    metadata_only: true,
  });
}
