import { z } from "zod";
import { type SuggestionInboxDeliveryAdapter } from "../suggestion-inbox";
import {
  type MorningBriefDeliveryResult,
  MorningBriefDeliveryResultSchema,
  deliverMorningBriefToSuggestionInbox,
} from "./delivery";
import {
  type MorningBriefPreview,
  MorningBriefPreviewSchema,
  buildMorningBriefPreview,
} from "./real-preview";
import {
  type MorningBriefRealInput,
  MorningBriefRealInputSchema,
} from "./real-input-contract";
import { MORNING_BRIEF_SCHEDULE_ID } from "./scheduler";

export const MORNING_BRIEF_SCHEDULED_INVOCATION_VERSION =
  "phase21c-r.morning-brief-scheduled-invocation.v1" as const;

export const MORNING_BRIEF_SCHEDULED_JOB_ID =
  "morning-brief:daily-0800-local:suggestion-inbox-delivery" as const;

const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

export const MorningBriefScheduledInvocationSchema = z.strictObject({
  invocation_version: z.literal(MORNING_BRIEF_SCHEDULED_INVOCATION_VERSION),
  job_id: z.literal(MORNING_BRIEF_SCHEDULED_JOB_ID),
  schedule: z.strictObject({
    schedule_id: z.literal(MORNING_BRIEF_SCHEDULE_ID),
    local_time: z.literal("08:00"),
    timezone: z.literal("local"),
    frequency: z.literal("daily"),
  }),
  input_resolver_contract: z.literal("supplied_or_injected_metadata_input"),
  delivery_target: z.literal("suggestion_inbox"),
  kill_switch: z.strictObject({
    supported: z.literal(true),
    default_enabled: z.literal(true),
    behavior: z.literal("skip_delivery_when_enabled"),
  }),
  failure_behavior: z.literal("skip_and_report_metadata_only"),
  idempotency: z.strictObject({
    key_strategy: z.literal("job_id_plus_source_built_at"),
    dedupe_window_ms: z.number().int().positive(),
  }),
  governance: z.strictObject({
    no_daemon: z.literal(true),
    no_timer_registration: z.literal(true),
    supplied_input_required: z.literal(true),
    live_google_calls_attempted: z.literal(false),
    provider_call_attempted: z.literal(false),
    network_call_attempted: z.literal(false),
    action_execution_attempted: z.literal(false),
    approval_finalization_attempted: z.literal(false),
    metadata_only: z.literal(true),
    new_authority_surface_added: z.literal(false),
  }),
});

export const MorningBriefScheduledInvocationRunInputSchema = z.strictObject({
  real_input: MorningBriefRealInputSchema.optional(),
  preview: MorningBriefPreviewSchema.optional(),
  invoked_at: IsoDateTimeSchema,
});

export const MorningBriefScheduledInvocationRunResultSchema = z.strictObject({
  invocation_version: z.literal(MORNING_BRIEF_SCHEDULED_INVOCATION_VERSION),
  job_id: z.literal(MORNING_BRIEF_SCHEDULED_JOB_ID),
  invoked_at: IsoDateTimeSchema,
  idempotency_key: z.string().trim().min(1).max(280),
  dedupe_window_ms: z.number().int().positive(),
  killed_by_switch: z.boolean(),
  delivered: z.boolean(),
  delivery: MorningBriefDeliveryResultSchema.nullable(),
  failure_reason: z.string().trim().min(1).max(220).nullable(),
  no_daemon_started: z.literal(true),
  no_background_process_started: z.literal(true),
  live_google_calls_attempted: z.literal(false),
  provider_call_attempted: z.literal(false),
  network_call_attempted: z.literal(false),
  action_execution_attempted: z.literal(false),
  approval_finalization_attempted: z.literal(false),
  metadata_only: z.literal(true),
});

export type MorningBriefScheduledInvocation = z.infer<
  typeof MorningBriefScheduledInvocationSchema
>;
type ParsedMorningBriefScheduledInvocationRunInput = z.infer<
  typeof MorningBriefScheduledInvocationRunInputSchema
>;
export type MorningBriefScheduledInvocationRunInput = z.input<
  typeof MorningBriefScheduledInvocationRunInputSchema
>;
export type MorningBriefScheduledInvocationRunResult = z.infer<
  typeof MorningBriefScheduledInvocationRunResultSchema
>;

export interface RunMorningBriefScheduledInvocationOptions {
  readonly adapter?: SuggestionInboxDeliveryAdapter | null;
  readonly kill_switch_enabled?: boolean;
}

const DEFAULT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function buildMorningBriefScheduledInvocation(): MorningBriefScheduledInvocation {
  return MorningBriefScheduledInvocationSchema.parse({
    invocation_version: MORNING_BRIEF_SCHEDULED_INVOCATION_VERSION,
    job_id: MORNING_BRIEF_SCHEDULED_JOB_ID,
    schedule: {
      schedule_id: MORNING_BRIEF_SCHEDULE_ID,
      local_time: "08:00",
      timezone: "local",
      frequency: "daily",
    },
    input_resolver_contract: "supplied_or_injected_metadata_input",
    delivery_target: "suggestion_inbox",
    kill_switch: {
      supported: true,
      default_enabled: true,
      behavior: "skip_delivery_when_enabled",
    },
    failure_behavior: "skip_and_report_metadata_only",
    idempotency: {
      key_strategy: "job_id_plus_source_built_at",
      dedupe_window_ms: DEFAULT_DEDUPE_WINDOW_MS,
    },
    governance: {
      no_daemon: true,
      no_timer_registration: true,
      supplied_input_required: true,
      live_google_calls_attempted: false,
      provider_call_attempted: false,
      network_call_attempted: false,
      action_execution_attempted: false,
      approval_finalization_attempted: false,
      metadata_only: true,
      new_authority_surface_added: false,
    },
  });
}

export async function runMorningBriefScheduledInvocation(
  input: MorningBriefScheduledInvocationRunInput,
  options: RunMorningBriefScheduledInvocationOptions = {},
): Promise<MorningBriefScheduledInvocationRunResult> {
  const parsed = MorningBriefScheduledInvocationRunInputSchema.parse(input);
  const invocation = buildMorningBriefScheduledInvocation();
  const killSwitchEnabled = options.kill_switch_enabled ?? false;

  if (killSwitchEnabled) {
    return runResult({
      invoked_at: parsed.invoked_at,
      idempotency_key: `${invocation.job_id}:killed:${parsed.invoked_at}`,
      killed_by_switch: true,
      delivered: false,
      delivery: null,
      failure_reason: "kill_switch_enabled",
    });
  }

  const preview = resolvePreview(parsed);
  if (!preview) {
    return runResult({
      invoked_at: parsed.invoked_at,
      idempotency_key: `${invocation.job_id}:missing-input:${parsed.invoked_at}`,
      killed_by_switch: false,
      delivered: false,
      delivery: null,
      failure_reason: "supplied_input_required",
    });
  }

  const delivery: MorningBriefDeliveryResult =
    await deliverMorningBriefToSuggestionInbox(
      { preview },
      { adapter: options.adapter ?? null },
    );

  return runResult({
    invoked_at: parsed.invoked_at,
    idempotency_key: `${invocation.job_id}:${preview.source_built_at}`,
    killed_by_switch: false,
    delivered: delivery.delivered,
    delivery,
    failure_reason: null,
  });
}

function resolvePreview(
  input: ParsedMorningBriefScheduledInvocationRunInput,
): MorningBriefPreview | null {
  if (input.preview) return MorningBriefPreviewSchema.parse(input.preview);
  if (input.real_input) {
    const realInput: MorningBriefRealInput = MorningBriefRealInputSchema.parse(
      input.real_input,
    );
    return buildMorningBriefPreview(realInput, {
      generated_at: input.invoked_at,
      preview_id: "morning-brief:scheduled-preview",
    });
  }
  return null;
}

function runResult(input: {
  readonly invoked_at: string;
  readonly idempotency_key: string;
  readonly killed_by_switch: boolean;
  readonly delivered: boolean;
  readonly delivery: MorningBriefDeliveryResult | null;
  readonly failure_reason: string | null;
}): MorningBriefScheduledInvocationRunResult {
  return MorningBriefScheduledInvocationRunResultSchema.parse({
    invocation_version: MORNING_BRIEF_SCHEDULED_INVOCATION_VERSION,
    job_id: MORNING_BRIEF_SCHEDULED_JOB_ID,
    invoked_at: input.invoked_at,
    idempotency_key: input.idempotency_key,
    dedupe_window_ms: DEFAULT_DEDUPE_WINDOW_MS,
    killed_by_switch: input.killed_by_switch,
    delivered: input.delivered,
    delivery: input.delivery,
    failure_reason: input.failure_reason,
    no_daemon_started: true,
    no_background_process_started: true,
    live_google_calls_attempted: false,
    provider_call_attempted: false,
    network_call_attempted: false,
    action_execution_attempted: false,
    approval_finalization_attempted: false,
    metadata_only: true,
  });
}
