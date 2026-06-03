import { z } from "zod";

export const SUGGESTION_INBOX_BRIDGE_VERSION =
  "phase21h.suggestion-inbox-delivery-bridge.v1" as const;

export const SUGGESTION_INBOX_ITEM_KINDS = [
  "morning_brief",
  "agent_digest",
  "job_scout",
  "knowledge_compounding",
  "system_alert",
] as const;

export const SUGGESTION_INBOX_READINESS_STATUSES = [
  "ready",
  "degraded",
  "not_ready",
] as const;

export const SUGGESTION_INBOX_DELIVERY_MODES = [
  "dry_run",
  "in_memory",
  "injected",
] as const;

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });
const BoundedTextSchema = z.string().trim().min(1).max(500);
const SourceIdSchema = z.string().trim().min(1).max(260);

export const SuggestionInboxItemKindSchema = z.enum(
  SUGGESTION_INBOX_ITEM_KINDS,
);

export const SuggestionInboxReadinessStatusSchema = z.enum(
  SUGGESTION_INBOX_READINESS_STATUSES,
);

export const SuggestionInboxDeliveryModeSchema = z.enum(
  SUGGESTION_INBOX_DELIVERY_MODES,
);

export const SuggestionInboxGovernanceSchema = z.strictObject({
  local_only: z.literal(true),
  metadata_only: z.literal(true),
  redacted_content_only: z.literal(true),
  no_raw_bodies: z.literal(true),
  action_execution_supported: z.literal(false),
  action_execution_attempted: z.literal(false),
  approval_finalization_supported: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  mutation_outside_inbox_boundary_attempted: z.literal(false),
  new_authority_surface_added: z.literal(false),
});

export const SuggestionInboxItemSectionSchema = z.strictObject({
  section_id: z.string().trim().min(1).max(160),
  title: BoundedTextSchema,
  summary: BoundedTextSchema,
  item_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export const SuggestionInboxItemSchema = z.strictObject({
  bridge_version: z.literal(SUGGESTION_INBOX_BRIDGE_VERSION),
  id: z
    .string()
    .trim()
    .min(1)
    .max(260)
    .regex(/^inbox_item:[a-z0-9._:-]+$/),
  kind: SuggestionInboxItemKindSchema,
  title: BoundedTextSchema,
  summary: BoundedTextSchema,
  sections: z.array(SuggestionInboxItemSectionSchema).default([]),
  source_ids: z.array(SourceIdSchema),
  readiness_status: SuggestionInboxReadinessStatusSchema,
  degraded: z.boolean(),
  created_at: IsoDateTimeSchema,
  idempotency_key: z.string().trim().min(1).max(260),
  dedupe_window_ms: z.number().int().positive(),
  governance_notes: z.array(z.string().trim().min(1).max(220)),
  governance: SuggestionInboxGovernanceSchema,
  user_visible: z.literal(true),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
  no_action_execution: z.literal(true),
  no_approval_finalization: z.literal(true),
});

export const SuggestionInboxDeliveryResultSchema = z.strictObject({
  bridge_version: z.literal(SUGGESTION_INBOX_BRIDGE_VERSION),
  delivered: z.boolean(),
  inbox_item_id: z.string().trim().min(1).max(260).nullable(),
  source_ids: z.array(SourceIdSchema),
  readiness_status: SuggestionInboxReadinessStatusSchema,
  degraded: z.boolean(),
  delivery_mode: SuggestionInboxDeliveryModeSchema,
  adapter_id: z.string().trim().min(1).max(160),
  idempotency_key: z.string().trim().min(1).max(260),
  deduplicated: z.boolean(),
  reasons: z.array(z.string().trim().min(1).max(220)),
  governance: SuggestionInboxGovernanceSchema,
  execution_status: z.literal("not_supported"),
  approval_status: z.literal("not_supported"),
  metadata_only: z.literal(true),
  raw_body_included: z.literal(false),
});

export type SuggestionInboxItemKind = z.infer<
  typeof SuggestionInboxItemKindSchema
>;
export type SuggestionInboxReadinessStatus = z.infer<
  typeof SuggestionInboxReadinessStatusSchema
>;
export type SuggestionInboxDeliveryMode = z.infer<
  typeof SuggestionInboxDeliveryModeSchema
>;
export type SuggestionInboxGovernance = z.infer<
  typeof SuggestionInboxGovernanceSchema
>;
export type SuggestionInboxItemSection = z.infer<
  typeof SuggestionInboxItemSectionSchema
>;
export type SuggestionInboxItem = z.infer<typeof SuggestionInboxItemSchema>;
export type SuggestionInboxDeliveryResult = z.infer<
  typeof SuggestionInboxDeliveryResultSchema
>;

export interface SuggestionInboxDeliveryAdapter {
  readonly adapter_id: string;
  readonly mode: SuggestionInboxDeliveryMode;
  deliverItem(
    item: SuggestionInboxItem,
  ): SuggestionInboxDeliveryResult | Promise<SuggestionInboxDeliveryResult>;
}

export interface BuildSuggestionInboxItemInput {
  readonly kind: SuggestionInboxItemKind;
  readonly title: string;
  readonly summary: string;
  readonly sections?: readonly SuggestionInboxItemSection[];
  readonly source_ids: readonly string[];
  readonly readiness_status: SuggestionInboxReadinessStatus;
  readonly degraded: boolean;
  readonly created_at: string;
  readonly idempotency_key?: string;
  readonly dedupe_window_ms?: number;
  readonly governance_notes?: readonly string[];
  readonly item_id?: string;
}

export interface DeliverSuggestionInboxItemOptions {
  readonly adapter?: SuggestionInboxDeliveryAdapter | null;
}

export interface InMemorySuggestionInboxAdapter extends SuggestionInboxDeliveryAdapter {
  listItems(): SuggestionInboxItem[];
}

const DEFAULT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function defaultSuggestionInboxGovernance(): SuggestionInboxGovernance {
  return SuggestionInboxGovernanceSchema.parse({
    local_only: true,
    metadata_only: true,
    redacted_content_only: true,
    no_raw_bodies: true,
    action_execution_supported: false,
    action_execution_attempted: false,
    approval_finalization_supported: false,
    approval_finalization_attempted: false,
    provider_call_attempted: false,
    network_call_attempted: false,
    mutation_outside_inbox_boundary_attempted: false,
    new_authority_surface_added: false,
  });
}

export function buildSuggestionInboxItem(
  input: BuildSuggestionInboxItemInput,
): SuggestionInboxItem {
  const sourceIds = [...input.source_ids];
  const idempotencyKey =
    input.idempotency_key ??
    `suggestion-inbox:${input.kind}:${sourceIds.join(":")}`;
  const itemId =
    input.item_id ??
    `inbox_item:${sanitizeId(input.kind)}:${sanitizeId(sourceIds[0] ?? input.title)}`;

  return SuggestionInboxItemSchema.parse({
    bridge_version: SUGGESTION_INBOX_BRIDGE_VERSION,
    id: itemId,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    sections: input.sections ?? [],
    source_ids: sourceIds,
    readiness_status: input.readiness_status,
    degraded: input.degraded,
    created_at: input.created_at,
    idempotency_key: idempotencyKey,
    dedupe_window_ms: input.dedupe_window_ms ?? DEFAULT_DEDUPE_WINDOW_MS,
    governance_notes: [
      ...(input.governance_notes ?? []),
      "suggestion_inbox_delivery_bridge",
      "metadata_only",
      "no_action_execution",
      "no_approval_finalization",
    ],
    governance: defaultSuggestionInboxGovernance(),
    user_visible: true,
    metadata_only: true,
    raw_body_included: false,
    no_action_execution: true,
    no_approval_finalization: true,
  });
}

export async function deliverSuggestionInboxItem(
  item: SuggestionInboxItem,
  options: DeliverSuggestionInboxItemOptions = {},
): Promise<SuggestionInboxDeliveryResult> {
  const parsed = assertSafeSuggestionInboxItem(item);
  const adapter = options.adapter ?? createDryRunSuggestionInboxAdapter();
  const result = await adapter.deliverItem(parsed);
  return SuggestionInboxDeliveryResultSchema.parse(result);
}

export function createDryRunSuggestionInboxAdapter(): SuggestionInboxDeliveryAdapter {
  return {
    adapter_id: "dry-run-suggestion-inbox",
    mode: "dry_run",
    deliverItem(item) {
      const parsed = assertSafeSuggestionInboxItem(item);
      return baseDeliveryResult(parsed, {
        delivered: false,
        inbox_item_id: null,
        delivery_mode: "dry_run",
        adapter_id: "dry-run-suggestion-inbox",
        deduplicated: false,
        reasons: ["dry_run_default_no_write"],
      });
    },
  };
}

export function createInMemorySuggestionInboxAdapter(): InMemorySuggestionInboxAdapter {
  const items = new Map<string, SuggestionInboxItem>();
  const idempotencyKeys = new Map<string, string>();

  return {
    adapter_id: "in-memory-suggestion-inbox",
    mode: "in_memory",
    deliverItem(item) {
      const parsed = assertSafeSuggestionInboxItem(item);
      const existingId = idempotencyKeys.get(parsed.idempotency_key);
      if (existingId) {
        return baseDeliveryResult(parsed, {
          delivered: false,
          inbox_item_id: existingId,
          delivery_mode: "in_memory",
          adapter_id: "in-memory-suggestion-inbox",
          deduplicated: true,
          reasons: ["duplicate_idempotency_key_within_window"],
        });
      }

      items.set(parsed.id, parsed);
      idempotencyKeys.set(parsed.idempotency_key, parsed.id);
      return baseDeliveryResult(parsed, {
        delivered: true,
        inbox_item_id: parsed.id,
        delivery_mode: "in_memory",
        adapter_id: "in-memory-suggestion-inbox",
        deduplicated: false,
        reasons: ["delivered_to_in_memory_inbox_boundary"],
      });
    },
    listItems() {
      return [...items.values()];
    },
  };
}

export function assertSafeSuggestionInboxItem(
  item: SuggestionInboxItem,
): SuggestionInboxItem {
  const parsed = SuggestionInboxItemSchema.parse(item);
  if (
    !parsed.metadata_only ||
    parsed.raw_body_included ||
    !parsed.no_action_execution ||
    !parsed.no_approval_finalization ||
    parsed.governance.action_execution_attempted ||
    parsed.governance.approval_finalization_attempted ||
    parsed.governance.provider_call_attempted ||
    parsed.governance.network_call_attempted ||
    parsed.governance.mutation_outside_inbox_boundary_attempted
  ) {
    throw new Error("unsafe suggestion inbox item rejected");
  }
  return parsed;
}

function baseDeliveryResult(
  item: SuggestionInboxItem,
  input: {
    readonly delivered: boolean;
    readonly inbox_item_id: string | null;
    readonly delivery_mode: SuggestionInboxDeliveryMode;
    readonly adapter_id: string;
    readonly deduplicated: boolean;
    readonly reasons: readonly string[];
  },
): SuggestionInboxDeliveryResult {
  return SuggestionInboxDeliveryResultSchema.parse({
    bridge_version: SUGGESTION_INBOX_BRIDGE_VERSION,
    delivered: input.delivered,
    inbox_item_id: input.inbox_item_id,
    source_ids: item.source_ids,
    readiness_status: item.readiness_status,
    degraded: item.degraded,
    delivery_mode: input.delivery_mode,
    adapter_id: input.adapter_id,
    idempotency_key: item.idempotency_key,
    deduplicated: input.deduplicated,
    reasons: input.reasons,
    governance: item.governance,
    execution_status: "not_supported",
    approval_status: "not_supported",
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
