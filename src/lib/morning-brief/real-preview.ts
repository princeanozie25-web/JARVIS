import { z } from "zod";
import {
  MorningBriefCompositionStatusSchema,
  MorningBriefComposedSectionSchema,
  MorningBriefComposerOptionsSchema,
  MorningBriefGovernanceSummarySchema,
  composeMorningBrief,
  type MorningBriefComposerOptions,
} from "./composer";
import {
  MorningBriefInputReadinessSchema,
  MorningBriefRealInputSchema,
  type MorningBriefRealInput,
} from "./real-input-contract";

export const MORNING_BRIEF_REAL_PREVIEW_VERSION =
  "phase21c.morning-brief-real-preview.v1" as const;

export const MORNING_BRIEF_PREVIEW_STATUSES = [
  "preview_ready",
  "preview_degraded",
  "failed_closed",
] as const;

const DEFAULT_PREVIEW_OPTIONS = {
  generated_at: null,
  title: null,
  max_items_per_section: 8,
  include_optional_empty_sections: false,
  preview_id: "morning-brief:real-preview",
} as const;

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

export const MorningBriefPreviewStatusSchema = z.enum(
  MORNING_BRIEF_PREVIEW_STATUSES,
);

export const MorningBriefPreviewOptionsSchema =
  MorningBriefComposerOptionsSchema.extend({
    preview_id: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .default("morning-brief:real-preview"),
  });

export const MorningBriefPreviewSchema = z.strictObject({
  kind: z.literal("morning_brief.preview"),
  preview_version: z.literal(MORNING_BRIEF_REAL_PREVIEW_VERSION),
  preview_id: z.string().trim().min(1).max(180),
  title: z.string().trim().min(1).max(500),
  generated_at: IsoDateTimeSchema,
  source_built_at: IsoDateTimeSchema,
  status: MorningBriefPreviewStatusSchema,
  composition_status: MorningBriefCompositionStatusSchema,
  readiness: MorningBriefInputReadinessSchema,
  sections: z.array(MorningBriefComposedSectionSchema),
  section_count: z.number().int().nonnegative(),
  degraded: z.boolean(),
  governance_notes: z.array(z.string().trim().min(1).max(180)),
  governance: MorningBriefGovernanceSummarySchema,
  suitable_for_future_ui: z.literal(true),
  suitable_for_future_suggestion_inbox: z.literal(true),
  preview_only: z.literal(true),
  delivery_attempted: z.literal(false),
  scheduling_attempted: z.literal(false),
  suggestion_inbox_write_attempted: z.literal(false),
  write_attempted: z.literal(false),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export type MorningBriefPreviewStatus = z.infer<
  typeof MorningBriefPreviewStatusSchema
>;
export type MorningBriefPreviewOptions = Partial<
  z.input<typeof MorningBriefPreviewOptionsSchema>
>;
export type MorningBriefPreview = z.infer<typeof MorningBriefPreviewSchema>;

export function buildMorningBriefPreview(
  input: MorningBriefRealInput,
  options: MorningBriefComposerOptions & { readonly preview_id?: string } = {},
): MorningBriefPreview {
  const parsedInput = MorningBriefRealInputSchema.parse(input);
  const parsedOptions = MorningBriefPreviewOptionsSchema.parse({
    ...DEFAULT_PREVIEW_OPTIONS,
    ...options,
  });
  const composerOptions = {
    generated_at: parsedOptions.generated_at,
    title: parsedOptions.title,
    max_items_per_section: parsedOptions.max_items_per_section,
    include_optional_empty_sections:
      parsedOptions.include_optional_empty_sections,
  };
  const brief = composeMorningBrief(parsedInput, composerOptions);

  return MorningBriefPreviewSchema.parse({
    kind: "morning_brief.preview",
    preview_version: MORNING_BRIEF_REAL_PREVIEW_VERSION,
    preview_id: parsedOptions.preview_id,
    title: brief.title,
    generated_at: brief.composed_at,
    source_built_at: brief.source_built_at,
    status:
      brief.composition_status === "composed"
        ? "preview_ready"
        : brief.composition_status === "degraded"
          ? "preview_degraded"
          : "failed_closed",
    composition_status: brief.composition_status,
    readiness: brief.readiness,
    sections: brief.sections,
    section_count: brief.sections.length,
    degraded: brief.composition_status !== "composed",
    governance_notes: governanceNotes(brief.composition_status),
    governance: brief.governance,
    suitable_for_future_ui: true,
    suitable_for_future_suggestion_inbox: true,
    preview_only: true,
    delivery_attempted: false,
    scheduling_attempted: false,
    suggestion_inbox_write_attempted: false,
    write_attempted: false,
    metadata_only: true,
    raw_body_included: false,
  });
}

function governanceNotes(
  status: z.infer<typeof MorningBriefCompositionStatusSchema>,
): string[] {
  return [
    "preview_only",
    "metadata_only",
    "no_scheduler",
    "no_delivery",
    "no_suggestion_inbox_write",
    ...(status === "failed_closed"
      ? ["failed_closed_missing_required_input"]
      : []),
    ...(status === "degraded" ? ["degraded_required_input_missing"] : []),
  ];
}
