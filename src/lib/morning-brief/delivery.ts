import { z } from "zod";
import {
  type SuggestionInboxDeliveryAdapter,
  SuggestionInboxDeliveryResultSchema,
  type SuggestionInboxDeliveryResult,
  SuggestionInboxItemSchema,
  buildSuggestionInboxItem,
  deliverSuggestionInboxItem,
} from "../suggestion-inbox";
import {
  type MorningBriefPreview,
  MorningBriefPreviewSchema,
} from "./real-preview";
import {
  MorningBriefSuggestionPayloadSchema,
  buildMorningBriefSuggestionPayload,
} from "./suggestion-inbox";

export const MORNING_BRIEF_DELIVERY_VERSION =
  "phase21c-r.morning-brief-inbox-delivery.v1" as const;

export const MorningBriefDeliveryInputSchema = z.strictObject({
  preview: MorningBriefPreviewSchema,
});

export const MorningBriefDeliveryResultSchema = z.strictObject({
  delivery_version: z.literal(MORNING_BRIEF_DELIVERY_VERSION),
  delivered: z.boolean(),
  inbox_item_id: z.string().trim().min(1).max(260).nullable(),
  source_ids: z.array(z.string().trim().min(1).max(260)),
  readiness_status: z.enum(["ready", "degraded", "not_ready"]),
  degraded: z.boolean(),
  suggestion_payload_id: z.string().trim().min(1).max(260),
  delivery_mode: z.enum(["dry_run", "in_memory", "injected"]),
  adapter_id: z.string().trim().min(1).max(160),
  idempotency_key: z.string().trim().min(1).max(260),
  deduplicated: z.boolean(),
  governance: z.strictObject({
    metadata_only: z.literal(true),
    suggestion_inbox_delivery_attempted: z.literal(true),
    action_execution_attempted: z.literal(false),
    approval_finalization_attempted: z.literal(false),
    provider_call_attempted: z.literal(false),
    network_call_attempted: z.literal(false),
    live_google_call_attempted: z.literal(false),
    raw_body_included: z.literal(false),
    new_authority_surface_added: z.literal(false),
  }),
  inbox_delivery: SuggestionInboxDeliveryResultSchema,
  execution_status: z.literal("not_supported"),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const MorningBriefDeliverySummarySchema = z.strictObject({
  delivered: z.boolean(),
  inbox_item_id: z.string().trim().min(1).max(260).nullable(),
  readiness_status: z.enum(["ready", "degraded", "not_ready"]),
  degraded: z.boolean(),
  source_count: z.number().int().nonnegative(),
  delivery_mode: z.enum(["dry_run", "in_memory", "injected"]),
  execution_status: z.literal("not_supported"),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export type MorningBriefDeliveryInput = z.infer<
  typeof MorningBriefDeliveryInputSchema
>;
export type MorningBriefDeliveryResult = z.infer<
  typeof MorningBriefDeliveryResultSchema
>;
export type MorningBriefDeliverySummary = z.infer<
  typeof MorningBriefDeliverySummarySchema
>;

export interface DeliverMorningBriefToSuggestionInboxOptions {
  readonly adapter?: SuggestionInboxDeliveryAdapter | null;
}

export function buildMorningBriefInboxItem(preview: MorningBriefPreview) {
  const parsedPreview = MorningBriefPreviewSchema.parse(preview);
  const payload = MorningBriefSuggestionPayloadSchema.parse(
    buildMorningBriefSuggestionPayload(parsedPreview),
  );
  const sourceIds = [
    payload.suggestion_id,
    payload.preview_id,
    ...payload.sections.map(
      (section) =>
        `morning-brief:${section.section_type}:${section.item_count}`,
    ),
  ];

  return SuggestionInboxItemSchema.parse(
    buildSuggestionInboxItem({
      kind: "morning_brief",
      title: payload.title,
      summary: `${payload.section_count} Morning Brief sections prepared as metadata-only digest.`,
      sections: payload.sections.map((section) => ({
        section_id: `morning-brief:${section.section_type}`,
        title: section.title,
        summary: section.summary,
        item_count: section.item_count,
        metadata_only: true,
        raw_body_included: false,
      })),
      source_ids: sourceIds,
      readiness_status: payload.readiness_status,
      degraded: payload.degraded,
      created_at: payload.generated_at,
      idempotency_key: `morning-brief:${payload.preview_id}:${payload.source_built_at}`,
      governance_notes: [
        ...payload.governance_notes,
        "morning_brief_realized_inbox_item",
      ],
      item_id: `inbox_item:morning_brief:${sanitizeId(payload.preview_id)}`,
    }),
  );
}

export async function deliverMorningBriefToSuggestionInbox(
  input: MorningBriefDeliveryInput,
  options: DeliverMorningBriefToSuggestionInboxOptions = {},
): Promise<MorningBriefDeliveryResult> {
  const parsed = MorningBriefDeliveryInputSchema.parse(input);
  const payload = buildMorningBriefSuggestionPayload(parsed.preview);
  const item = buildMorningBriefInboxItem(parsed.preview);
  const inboxDelivery: SuggestionInboxDeliveryResult =
    await deliverSuggestionInboxItem(item, {
      adapter: options.adapter ?? null,
    });

  return MorningBriefDeliveryResultSchema.parse({
    delivery_version: MORNING_BRIEF_DELIVERY_VERSION,
    delivered: inboxDelivery.delivered,
    inbox_item_id: inboxDelivery.inbox_item_id,
    source_ids: inboxDelivery.source_ids,
    readiness_status: inboxDelivery.readiness_status,
    degraded: inboxDelivery.degraded,
    suggestion_payload_id: payload.suggestion_id,
    delivery_mode: inboxDelivery.delivery_mode,
    adapter_id: inboxDelivery.adapter_id,
    idempotency_key: inboxDelivery.idempotency_key,
    deduplicated: inboxDelivery.deduplicated,
    governance: {
      metadata_only: true,
      suggestion_inbox_delivery_attempted: true,
      action_execution_attempted: false,
      approval_finalization_attempted: false,
      provider_call_attempted: false,
      network_call_attempted: false,
      live_google_call_attempted: false,
      raw_body_included: false,
      new_authority_surface_added: false,
    },
    inbox_delivery: inboxDelivery,
    execution_status: "not_supported",
    metadata_only: true,
    raw_body_included: false,
  });
}

export function summarizeMorningBriefDelivery(
  result: MorningBriefDeliveryResult,
): MorningBriefDeliverySummary {
  const parsed = MorningBriefDeliveryResultSchema.parse(result);
  return MorningBriefDeliverySummarySchema.parse({
    delivered: parsed.delivered,
    inbox_item_id: parsed.inbox_item_id,
    readiness_status: parsed.readiness_status,
    degraded: parsed.degraded,
    source_count: parsed.source_ids.length,
    delivery_mode: parsed.delivery_mode,
    execution_status: "not_supported",
    metadata_only: true,
    raw_body_included: false,
  });
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}
