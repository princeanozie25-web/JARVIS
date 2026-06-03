import { z } from "zod";
import { type SuggestionInboxDeliveryAdapter } from "../suggestion-inbox";
import { EXPANSION_ERA_AGENT_IDS } from "./contract";
import {
  type AgentDeliveryResult,
  AgentDeliveryResultSchema,
  deliverAgentDigest,
} from "./delivery";
import { AgentOutputPreviewSchema } from "./output-factory";

export const AGENT_SCHEDULED_INVOCATION_VERSION =
  "phase21h-r.agent-scheduled-invocation.v1" as const;

export const AGENT_INVOCATION_STATUSES = [
  "delivered",
  "dry_run",
  "deduplicated",
  "killed",
  "rejected",
] as const;

const AgentIdSchema = z.enum(EXPANSION_ERA_AGENT_IDS);
const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

export const AgentInvocationStatusSchema = z.enum(AGENT_INVOCATION_STATUSES);

export const AgentInvocationMetadataSchema = z.strictObject({
  agent_id: AgentIdSchema,
  invocation_id: z.string().trim().min(1).max(260),
  idempotency_key: z.string().trim().min(1).max(260),
  dedupe_window_ms: z.number().int().positive(),
  supplied_input_required: z.literal(true),
  injected_sources_supported: z.literal(true),
  no_live_reads: z.literal(true),
  metadata_only: z.literal(true),
});

export const AgentScheduledInvocationSchema = z.strictObject({
  invocation_version: z.literal(AGENT_SCHEDULED_INVOCATION_VERSION),
  agent_id: AgentIdSchema,
  job_id: z.string().trim().min(1).max(220),
  delivery_target: z.literal("suggestion_inbox"),
  input_contract: z.literal("supplied_agent_output_preview"),
  kill_switch: z.strictObject({
    supported: z.literal(true),
    default_enabled: z.literal(true),
    behavior: z.literal("skip_delivery_when_enabled"),
  }),
  idempotency: z.strictObject({
    key_strategy: z.literal("agent_id_plus_preview_output_id"),
    dedupe_window_ms: z.number().int().positive(),
  }),
  governance: z.strictObject({
    no_daemon: z.literal(true),
    no_autonomous_execution: z.literal(true),
    no_live_reads: z.literal(true),
    no_provider_calls: z.literal(true),
    no_network_calls: z.literal(true),
    no_filesystem_reads: z.literal(true),
    no_action_execution: z.literal(true),
    no_approval_finalization: z.literal(true),
    no_cross_agent_execution: z.literal(true),
    no_self_modification: z.literal(true),
    metadata_only: z.literal(true),
    new_authority_surface_added: z.literal(false),
  }),
});

export const AgentScheduledInvocationRunInputSchema = z.strictObject({
  agent_id: AgentIdSchema,
  preview: AgentOutputPreviewSchema.optional(),
  invoked_at: IsoDateTimeSchema,
});

export const AgentInvocationResultSchema = z.strictObject({
  invocation_version: z.literal(AGENT_SCHEDULED_INVOCATION_VERSION),
  status: AgentInvocationStatusSchema,
  agent_id: AgentIdSchema,
  job_id: z.string().trim().min(1).max(220),
  invoked_at: IsoDateTimeSchema,
  metadata: AgentInvocationMetadataSchema,
  delivered: z.boolean(),
  delivery: AgentDeliveryResultSchema.nullable(),
  failure_reason: z.string().trim().min(1).max(220).nullable(),
  killed_by_switch: z.boolean(),
  no_daemon_started: z.literal(true),
  no_background_process_started: z.literal(true),
  live_reads_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  filesystem_read_attempted: z.literal(false),
  action_execution_attempted: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  cross_agent_execution_attempted: z.literal(false),
  self_modification_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type AgentInvocationStatus = z.infer<typeof AgentInvocationStatusSchema>;
export type AgentInvocationMetadata = z.infer<
  typeof AgentInvocationMetadataSchema
>;
export type AgentScheduledInvocation = z.infer<
  typeof AgentScheduledInvocationSchema
>;
export type AgentScheduledInvocationRunInput = z.input<
  typeof AgentScheduledInvocationRunInputSchema
>;
export type AgentInvocationResult = z.infer<typeof AgentInvocationResultSchema>;

export interface RunAgentScheduledInvocationOptions {
  readonly adapter?: SuggestionInboxDeliveryAdapter | null;
  readonly kill_switch_enabled?: boolean;
  readonly dedupe_window_ms?: number;
}

const DEFAULT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function buildAgentScheduledInvocation(
  agentId: z.input<typeof AgentIdSchema>,
  options: { readonly dedupe_window_ms?: number } = {},
): AgentScheduledInvocation {
  const agent_id = AgentIdSchema.parse(agentId);
  const dedupeWindowMs = options.dedupe_window_ms ?? DEFAULT_DEDUPE_WINDOW_MS;

  return AgentScheduledInvocationSchema.parse({
    invocation_version: AGENT_SCHEDULED_INVOCATION_VERSION,
    agent_id,
    job_id: `agent-suite:${agent_id}:suggestion-inbox-delivery`,
    delivery_target: "suggestion_inbox",
    input_contract: "supplied_agent_output_preview",
    kill_switch: {
      supported: true,
      default_enabled: true,
      behavior: "skip_delivery_when_enabled",
    },
    idempotency: {
      key_strategy: "agent_id_plus_preview_output_id",
      dedupe_window_ms: dedupeWindowMs,
    },
    governance: {
      no_daemon: true,
      no_autonomous_execution: true,
      no_live_reads: true,
      no_provider_calls: true,
      no_network_calls: true,
      no_filesystem_reads: true,
      no_action_execution: true,
      no_approval_finalization: true,
      no_cross_agent_execution: true,
      no_self_modification: true,
      metadata_only: true,
      new_authority_surface_added: false,
    },
  });
}

export async function runAgentScheduledInvocation(
  input: AgentScheduledInvocationRunInput,
  options: RunAgentScheduledInvocationOptions = {},
): Promise<AgentInvocationResult> {
  const parsed = AgentScheduledInvocationRunInputSchema.parse(input);
  const invocation = buildAgentScheduledInvocation(parsed.agent_id, {
    dedupe_window_ms: options.dedupe_window_ms,
  });
  const dedupeWindowMs =
    options.dedupe_window_ms ?? invocation.idempotency.dedupe_window_ms;

  if (options.kill_switch_enabled ?? false) {
    return resultFor({
      invocation,
      invoked_at: parsed.invoked_at,
      status: "killed",
      delivered: false,
      delivery: null,
      failure_reason: "kill_switch_enabled",
      killed_by_switch: true,
      idempotency_key: `${invocation.job_id}:killed:${parsed.invoked_at}`,
      dedupe_window_ms: dedupeWindowMs,
    });
  }

  if (!parsed.preview) {
    return resultFor({
      invocation,
      invoked_at: parsed.invoked_at,
      status: "rejected",
      delivered: false,
      delivery: null,
      failure_reason: "supplied_preview_required",
      killed_by_switch: false,
      idempotency_key: `${invocation.job_id}:missing-preview:${parsed.invoked_at}`,
      dedupe_window_ms: dedupeWindowMs,
    });
  }

  const preview = AgentOutputPreviewSchema.parse(parsed.preview);
  if (preview.agent_id !== parsed.agent_id) {
    return resultFor({
      invocation,
      invoked_at: parsed.invoked_at,
      status: "rejected",
      delivered: false,
      delivery: null,
      failure_reason: "preview_agent_mismatch",
      killed_by_switch: false,
      idempotency_key: `${invocation.job_id}:mismatch:${preview.output_id}`,
      dedupe_window_ms: dedupeWindowMs,
    });
  }

  const delivery: AgentDeliveryResult = await deliverAgentDigest(preview, {
    adapter: options.adapter ?? null,
    created_at: parsed.invoked_at,
    dedupe_window_ms: dedupeWindowMs,
  });

  return resultFor({
    invocation,
    invoked_at: parsed.invoked_at,
    status: delivery.status,
    delivered: delivery.delivered,
    delivery,
    failure_reason: null,
    killed_by_switch: false,
    idempotency_key: delivery.idempotency_key,
    dedupe_window_ms: dedupeWindowMs,
  });
}

function resultFor(input: {
  readonly invocation: AgentScheduledInvocation;
  readonly invoked_at: string;
  readonly status: AgentInvocationStatus;
  readonly delivered: boolean;
  readonly delivery: AgentDeliveryResult | null;
  readonly failure_reason: string | null;
  readonly killed_by_switch: boolean;
  readonly idempotency_key: string;
  readonly dedupe_window_ms: number;
}): AgentInvocationResult {
  return AgentInvocationResultSchema.parse({
    invocation_version: AGENT_SCHEDULED_INVOCATION_VERSION,
    status: input.status,
    agent_id: input.invocation.agent_id,
    job_id: input.invocation.job_id,
    invoked_at: input.invoked_at,
    metadata: {
      agent_id: input.invocation.agent_id,
      invocation_id: `${input.invocation.job_id}:${input.invoked_at}`,
      idempotency_key: input.idempotency_key,
      dedupe_window_ms: input.dedupe_window_ms,
      supplied_input_required: true,
      injected_sources_supported: true,
      no_live_reads: true,
      metadata_only: true,
    },
    delivered: input.delivered,
    delivery: input.delivery,
    failure_reason: input.failure_reason,
    killed_by_switch: input.killed_by_switch,
    no_daemon_started: true,
    no_background_process_started: true,
    live_reads_attempted: false,
    provider_call_attempted: false,
    network_call_attempted: false,
    filesystem_read_attempted: false,
    action_execution_attempted: false,
    approval_finalization_attempted: false,
    cross_agent_execution_attempted: false,
    self_modification_attempted: false,
    metadata_only: true,
  });
}
