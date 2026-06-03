import { z } from "zod";
import {
  type SuggestionInboxDeliveryAdapter,
  SuggestionInboxDeliveryResultSchema,
  type SuggestionInboxDeliveryResult,
  SuggestionInboxItemKindSchema,
  SuggestionInboxItemSchema,
  buildSuggestionInboxItem,
  deliverSuggestionInboxItem,
} from "../suggestion-inbox";
import { EXPANSION_ERA_AGENT_IDS } from "./contract";
import { AgentOutputPreviewSchema } from "./output-factory";

export const AGENT_DELIVERY_VERSION = "phase21h-r.agent-delivery.v1" as const;

export const AGENT_DELIVERY_STATUSES = [
  "delivered",
  "dry_run",
  "deduplicated",
] as const;

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });
const AgentIdSchema = z.enum(EXPANSION_ERA_AGENT_IDS);

export const AgentDeliveryStatusSchema = z.enum(AGENT_DELIVERY_STATUSES);

export const AgentInboxItemBuildOptionsSchema = z.strictObject({
  created_at: IsoDateTimeSchema.default("1970-01-01T00:00:00.000Z"),
  dedupe_window_ms: z
    .number()
    .int()
    .positive()
    .default(24 * 60 * 60 * 1000),
});

export const AgentDeliveryResultSchema = z.strictObject({
  delivery_version: z.literal(AGENT_DELIVERY_VERSION),
  status: AgentDeliveryStatusSchema,
  delivered: z.boolean(),
  inbox_item_id: z.string().trim().min(1).max(260).nullable(),
  agent_id: AgentIdSchema,
  output_id: z.string().trim().min(1).max(220),
  output_type: AgentOutputPreviewSchema.shape.output_type,
  inbox_kind: SuggestionInboxItemKindSchema,
  source_ids: z.array(z.string().trim().min(1).max(260)),
  idempotency_key: z.string().trim().min(1).max(260),
  deduplicated: z.boolean(),
  delivery: SuggestionInboxDeliveryResultSchema,
  governance: z.strictObject({
    metadata_only: z.literal(true),
    source_attributed: z.literal(true),
    action_execution_attempted: z.literal(false),
    approval_finalization_attempted: z.literal(false),
    provider_call_attempted: z.literal(false),
    network_call_attempted: z.literal(false),
    cross_agent_execution_attempted: z.literal(false),
    self_modification_attempted: z.literal(false),
    new_authority_surface_added: z.literal(false),
  }),
  execution_status: z.literal("not_supported"),
  approval_status: z.literal("not_supported"),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const AgentDeliverySummarySchema = z.strictObject({
  agent_id: AgentIdSchema,
  delivered: z.boolean(),
  inbox_item_id: z.string().trim().min(1).max(260).nullable(),
  status: AgentDeliveryStatusSchema,
  source_count: z.number().int().nonnegative(),
  inbox_kind: SuggestionInboxItemKindSchema,
  execution_status: z.literal("not_supported"),
  approval_status: z.literal("not_supported"),
  metadata_only: z.literal(true),
});

export type AgentDeliveryStatus = z.infer<typeof AgentDeliveryStatusSchema>;
export type AgentInboxItemBuildOptions = z.input<
  typeof AgentInboxItemBuildOptionsSchema
>;
export type AgentDeliveryResult = z.infer<typeof AgentDeliveryResultSchema>;
export type AgentDeliverySummary = z.infer<typeof AgentDeliverySummarySchema>;

export interface DeliverAgentDigestOptions {
  readonly adapter?: SuggestionInboxDeliveryAdapter | null;
  readonly created_at?: string;
  readonly dedupe_window_ms?: number;
}

export function buildAgentInboxItem(
  previewInput: z.input<typeof AgentOutputPreviewSchema>,
  options: AgentInboxItemBuildOptions = {},
) {
  const preview = AgentOutputPreviewSchema.parse(previewInput);
  const parsedOptions = AgentInboxItemBuildOptionsSchema.parse(options);
  const sourceIds = [
    preview.output_id,
    `agent:${preview.agent_id}`,
    ...preview.source_refs.map(
      (source) => `${source.source_kind}:${source.source_id}`,
    ),
  ];
  const inboxKind =
    preview.output_type === "alert" ? "system_alert" : "agent_digest";

  return SuggestionInboxItemSchema.parse(
    buildSuggestionInboxItem({
      kind: inboxKind,
      title: preview.title,
      summary: preview.summary,
      sections: [
        {
          section_id: `agent:${preview.agent_id}:sources`,
          title: "Source attribution",
          summary: `${preview.source_refs.length} declared metadata sources attributed.`,
          item_count: preview.source_refs.length,
          metadata_only: true,
          raw_body_included: false,
        },
      ],
      source_ids: sourceIds,
      readiness_status: "ready",
      degraded: false,
      created_at: parsedOptions.created_at,
      idempotency_key: `agent:${preview.agent_id}:${preview.output_id}`,
      dedupe_window_ms: parsedOptions.dedupe_window_ms,
      governance_notes: [
        "agent_suite_realization",
        `agent:${preview.agent_id}`,
        `output_type:${preview.output_type}`,
        "source_attributed",
      ],
      item_id: `inbox_item:agent:${preview.agent_id}:${sanitizeId(preview.output_id)}`,
    }),
  );
}

export async function deliverAgentDigest(
  previewInput: z.input<typeof AgentOutputPreviewSchema>,
  options: DeliverAgentDigestOptions = {},
): Promise<AgentDeliveryResult> {
  const preview = AgentOutputPreviewSchema.parse(previewInput);
  const item = buildAgentInboxItem(preview, {
    created_at: options.created_at,
    dedupe_window_ms: options.dedupe_window_ms,
  });
  const delivery: SuggestionInboxDeliveryResult =
    await deliverSuggestionInboxItem(item, {
      adapter: options.adapter ?? null,
    });
  const status: AgentDeliveryStatus = delivery.deduplicated
    ? "deduplicated"
    : delivery.delivered
      ? "delivered"
      : "dry_run";

  return AgentDeliveryResultSchema.parse({
    delivery_version: AGENT_DELIVERY_VERSION,
    status,
    delivered: delivery.delivered,
    inbox_item_id: delivery.inbox_item_id,
    agent_id: preview.agent_id,
    output_id: preview.output_id,
    output_type: preview.output_type,
    inbox_kind: item.kind,
    source_ids: delivery.source_ids,
    idempotency_key: delivery.idempotency_key,
    deduplicated: delivery.deduplicated,
    delivery,
    governance: {
      metadata_only: true,
      source_attributed: true,
      action_execution_attempted: false,
      approval_finalization_attempted: false,
      provider_call_attempted: false,
      network_call_attempted: false,
      cross_agent_execution_attempted: false,
      self_modification_attempted: false,
      new_authority_surface_added: false,
    },
    execution_status: "not_supported",
    approval_status: "not_supported",
    metadata_only: true,
    raw_body_included: false,
  });
}

export function summarizeAgentDelivery(
  resultInput: AgentDeliveryResult,
): AgentDeliverySummary {
  const result = AgentDeliveryResultSchema.parse(resultInput);
  return AgentDeliverySummarySchema.parse({
    agent_id: result.agent_id,
    delivered: result.delivered,
    inbox_item_id: result.inbox_item_id,
    status: result.status,
    source_count: result.source_ids.length,
    inbox_kind: result.inbox_kind,
    execution_status: "not_supported",
    approval_status: "not_supported",
    metadata_only: true,
  });
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}
