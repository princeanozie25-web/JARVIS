import { z } from "zod";
import { JobSourceTypeSchema } from "./contract";
import { JobFeedSchema, type JobFeed } from "./feed";

export const JOB_SCOUT_ACQUISITION_VERSION =
  "phase21i.job-scout-acquisition-adapter-boundary.v1" as const;

export const JOB_SCOUT_ACQUISITION_METHODS = [
  "supplied_feed",
  "public_api",
  "structured_export",
  "manual_review",
] as const;

export const JOB_SCOUT_ACQUISITION_ACCESS_STATUSES = [
  "allowed",
  "disabled",
  "tos_disallowed",
] as const;

const BoundedIdSchema = z.string().trim().min(1).max(180);
const BoundedTextSchema = z.string().trim().min(1).max(600);
const IsoDateTimeSchema = z.string().trim().datetime({ offset: true });

export const JobSourceAcquisitionMethodSchema = z.enum(
  JOB_SCOUT_ACQUISITION_METHODS,
);
export const JobSourceAcquisitionAccessStatusSchema = z.enum(
  JOB_SCOUT_ACQUISITION_ACCESS_STATUSES,
);

export const JobSourceRateLimitSchema = z.strictObject({
  rate_limit_id: BoundedIdSchema,
  max_requests: z.number().int().positive(),
  window_seconds: z.number().int().positive(),
  observed_requests: z.number().int().nonnegative(),
  remaining_requests: z.number().int().nonnegative(),
  reset_at: IsoDateTimeSchema,
  metadata_only: z.literal(true),
});

export const JobSourceAcquisitionConfigSchema = z.strictObject({
  config_id: BoundedIdSchema,
  source_id: BoundedIdSchema,
  source_type: JobSourceTypeSchema,
  acquisition_method: JobSourceAcquisitionMethodSchema,
  enabled: z.boolean(),
  access_status: JobSourceAcquisitionAccessStatusSchema,
  rate_limit: JobSourceRateLimitSchema,
  form_automation_permitted: z.boolean(),
  telemetry: z.strictObject({
    metadata_only: z.literal(true),
    credentials_included: z.literal(false),
    raw_source_payload_included: z.literal(false),
  }),
});

export const JobSourceAcquisitionRequestSchema = z.strictObject({
  request_id: BoundedIdSchema,
  source_id: BoundedIdSchema,
  requested_at: IsoDateTimeSchema,
  expected_record_limit: z.number().int().positive().max(500),
  metadata_only: z.literal(true),
});

export const JobSourceAcquisitionEvaluationSchema = z.strictObject({
  acquisition_version: z.literal(JOB_SCOUT_ACQUISITION_VERSION),
  request_id: BoundedIdSchema,
  source_id: BoundedIdSchema,
  acquisition_method: JobSourceAcquisitionMethodSchema,
  access_status: JobSourceAcquisitionAccessStatusSchema,
  allowed: z.boolean(),
  adapter_invocation_permitted: z.boolean(),
  form_automation_permitted: z.boolean(),
  rate_limit: JobSourceRateLimitSchema,
  reasons: z.array(BoundedTextSchema),
  governance: z.strictObject({
    disabled_config_enforced: z.boolean(),
    tos_disallowed_config_enforced: z.boolean(),
    rate_limit_enforced: z.boolean(),
    source_id_enforced: z.boolean(),
    metadata_only: z.literal(true),
    credentials_included: z.literal(false),
    raw_source_payload_included: z.literal(false),
    network_call_attempted: z.literal(false),
    automation_attempted: z.literal(false),
  }),
});

export const JobSourceAcquisitionAdapterSummarySchema = z.strictObject({
  adapter_id: BoundedIdSchema,
  source_id: BoundedIdSchema,
  acquisition_method: JobSourceAcquisitionMethodSchema,
  invoked: z.boolean(),
  returned_feed: z.boolean(),
  fake_or_injected_adapter: z.literal(true),
  credentials_used: z.literal(false),
  raw_source_payload_logged: z.literal(false),
  network_call_attempted_by_boundary: z.literal(false),
});

export const JobSourceAcquisitionResultSchema = z.strictObject({
  acquisition_version: z.literal(JOB_SCOUT_ACQUISITION_VERSION),
  acquisition_id: BoundedIdSchema,
  request: JobSourceAcquisitionRequestSchema,
  config: JobSourceAcquisitionConfigSchema,
  evaluation: JobSourceAcquisitionEvaluationSchema,
  feed: JobFeedSchema.nullable(),
  adapter: JobSourceAcquisitionAdapterSummarySchema,
  telemetry: z.strictObject({
    metadata_only: z.literal(true),
    source_id: BoundedIdSchema,
    acquisition_method: JobSourceAcquisitionMethodSchema,
    rate_limit_remaining: z.number().int().nonnegative(),
    credentials_included: z.literal(false),
    raw_source_payload_included: z.literal(false),
    network_call_attempted_by_boundary: z.literal(false),
  }),
});

export type JobSourceAcquisitionMethod = z.infer<
  typeof JobSourceAcquisitionMethodSchema
>;
export type JobSourceAcquisitionAccessStatus = z.infer<
  typeof JobSourceAcquisitionAccessStatusSchema
>;
export type JobSourceRateLimit = z.infer<typeof JobSourceRateLimitSchema>;
export type JobSourceAcquisitionConfig = z.infer<
  typeof JobSourceAcquisitionConfigSchema
>;
export type JobSourceAcquisitionRequest = z.infer<
  typeof JobSourceAcquisitionRequestSchema
>;
export type JobSourceAcquisitionEvaluation = z.infer<
  typeof JobSourceAcquisitionEvaluationSchema
>;
export type JobSourceAcquisitionAdapterSummary = z.infer<
  typeof JobSourceAcquisitionAdapterSummarySchema
>;
export type JobSourceAcquisitionResult = z.infer<
  typeof JobSourceAcquisitionResultSchema
>;

export interface JobSourceAcquisitionAdapter {
  readonly adapter_id: string;
  readonly source_id: string;
  readonly acquisition_method: JobSourceAcquisitionMethod;
  acquire(
    request: JobSourceAcquisitionRequest,
    config: JobSourceAcquisitionConfig,
  ): JobFeed | Promise<JobFeed>;
}

export function buildDefaultJobSourceAcquisitionConfigs(): JobSourceAcquisitionConfig[] {
  return [
    config("source:greenhouse", "greenhouse", "public_api", true, "allowed", {
      formAutomationPermitted: false,
      maxRequests: 60,
    }),
    config("source:lever", "lever", "public_api", true, "allowed", {
      formAutomationPermitted: false,
      maxRequests: 60,
    }),
    config("source:ashby", "ashby", "public_api", true, "allowed", {
      formAutomationPermitted: false,
      maxRequests: 60,
    }),
    config("source:workable", "workable", "public_api", true, "allowed", {
      formAutomationPermitted: false,
      maxRequests: 40,
    }),
    config(
      "source:linkedin",
      "linkedin",
      "structured_export",
      false,
      "tos_disallowed",
      { formAutomationPermitted: false, maxRequests: 1 },
    ),
    config("source:otta", "otta", "structured_export", false, "disabled", {
      formAutomationPermitted: false,
      maxRequests: 1,
    }),
    config("source:manual", "manual", "supplied_feed", true, "allowed", {
      formAutomationPermitted: false,
      maxRequests: 500,
    }),
  ];
}

export function evaluateJobSourceAcquisitionConfig(input: {
  readonly config: JobSourceAcquisitionConfig;
  readonly request: JobSourceAcquisitionRequest;
}): JobSourceAcquisitionEvaluation {
  const config = JobSourceAcquisitionConfigSchema.parse(input.config);
  const request = JobSourceAcquisitionRequestSchema.parse(input.request);
  const reasons = [
    ...(config.source_id === request.source_id
      ? ["source_id_matches"]
      : ["source_id_mismatch"]),
    ...(config.enabled ? ["config_enabled"] : ["config_disabled"]),
    ...(config.access_status === "allowed"
      ? ["source_access_allowed"]
      : [`source_access_${config.access_status}`]),
    ...(config.rate_limit.remaining_requests > 0
      ? ["rate_limit_available"]
      : ["rate_limit_exhausted"]),
    ...(config.rate_limit.observed_requests < config.rate_limit.max_requests
      ? ["rate_window_below_limit"]
      : ["rate_window_exhausted"]),
    ...(config.form_automation_permitted
      ? ["form_automation_declared_for_future_review"]
      : ["form_automation_not_permitted"]),
  ];
  const allowed =
    config.source_id === request.source_id &&
    config.enabled &&
    config.access_status === "allowed" &&
    config.rate_limit.remaining_requests > 0 &&
    config.rate_limit.observed_requests < config.rate_limit.max_requests &&
    config.acquisition_method !== "structured_export";

  return JobSourceAcquisitionEvaluationSchema.parse({
    acquisition_version: JOB_SCOUT_ACQUISITION_VERSION,
    request_id: request.request_id,
    source_id: config.source_id,
    acquisition_method: config.acquisition_method,
    access_status: config.access_status,
    allowed,
    adapter_invocation_permitted: allowed,
    form_automation_permitted: config.form_automation_permitted,
    rate_limit: config.rate_limit,
    reasons,
    governance: {
      disabled_config_enforced: !config.enabled,
      tos_disallowed_config_enforced: config.access_status === "tos_disallowed",
      rate_limit_enforced:
        config.rate_limit.remaining_requests === 0 ||
        config.rate_limit.observed_requests >= config.rate_limit.max_requests,
      source_id_enforced: config.source_id !== request.source_id,
      metadata_only: true,
      credentials_included: false,
      raw_source_payload_included: false,
      network_call_attempted: false,
      automation_attempted: false,
    },
  });
}

export async function acquireJobsThroughAdapter(input: {
  readonly acquisition_id?: string;
  readonly config: JobSourceAcquisitionConfig;
  readonly request: JobSourceAcquisitionRequest;
  readonly adapter: JobSourceAcquisitionAdapter;
}): Promise<JobSourceAcquisitionResult> {
  const config = JobSourceAcquisitionConfigSchema.parse(input.config);
  const request = JobSourceAcquisitionRequestSchema.parse(input.request);
  const evaluation = evaluateJobSourceAcquisitionConfig({ config, request });
  const adapterMatches =
    input.adapter.source_id === config.source_id &&
    input.adapter.acquisition_method === config.acquisition_method;

  if (!evaluation.allowed || !adapterMatches) {
    return result({
      acquisition_id: input.acquisition_id,
      request,
      config,
      evaluation: adapterMatches
        ? evaluation
        : JobSourceAcquisitionEvaluationSchema.parse({
            ...evaluation,
            allowed: false,
            adapter_invocation_permitted: false,
            reasons: [...evaluation.reasons, "adapter_config_mismatch"],
          }),
      adapter_id: input.adapter.adapter_id,
      adapterInvoked: false,
      feed: null,
    });
  }

  const feed = JobFeedSchema.parse(
    await input.adapter.acquire(request, config),
  );
  if (feed.source.source_id !== config.source_id) {
    return result({
      acquisition_id: input.acquisition_id,
      request,
      config,
      evaluation: JobSourceAcquisitionEvaluationSchema.parse({
        ...evaluation,
        allowed: false,
        adapter_invocation_permitted: false,
        reasons: [...evaluation.reasons, "adapter_feed_source_mismatch"],
      }),
      adapter_id: input.adapter.adapter_id,
      adapterInvoked: true,
      feed: null,
    });
  }

  return result({
    acquisition_id: input.acquisition_id,
    request,
    config,
    evaluation,
    adapter_id: input.adapter.adapter_id,
    adapterInvoked: true,
    feed,
  });
}

function result(input: {
  readonly acquisition_id?: string;
  readonly request: JobSourceAcquisitionRequest;
  readonly config: JobSourceAcquisitionConfig;
  readonly evaluation: JobSourceAcquisitionEvaluation;
  readonly adapter_id: string;
  readonly adapterInvoked: boolean;
  readonly feed: JobFeed | null;
}): JobSourceAcquisitionResult {
  return JobSourceAcquisitionResultSchema.parse({
    acquisition_version: JOB_SCOUT_ACQUISITION_VERSION,
    acquisition_id:
      input.acquisition_id ??
      `job-scout:acquisition:${input.request.request_id}`,
    request: input.request,
    config: input.config,
    evaluation: input.evaluation,
    feed: input.feed,
    adapter: {
      adapter_id: input.adapter_id,
      source_id: input.config.source_id,
      acquisition_method: input.config.acquisition_method,
      invoked: input.adapterInvoked,
      returned_feed: input.feed !== null,
      fake_or_injected_adapter: true,
      credentials_used: false,
      raw_source_payload_logged: false,
      network_call_attempted_by_boundary: false,
    },
    telemetry: {
      metadata_only: true,
      source_id: input.config.source_id,
      acquisition_method: input.config.acquisition_method,
      rate_limit_remaining: input.config.rate_limit.remaining_requests,
      credentials_included: false,
      raw_source_payload_included: false,
      network_call_attempted_by_boundary: false,
    },
  });
}

function config(
  sourceId: string,
  sourceType: z.infer<typeof JobSourceTypeSchema>,
  method: JobSourceAcquisitionMethod,
  enabled: boolean,
  accessStatus: JobSourceAcquisitionAccessStatus,
  options: {
    readonly formAutomationPermitted: boolean;
    readonly maxRequests: number;
  },
): JobSourceAcquisitionConfig {
  return JobSourceAcquisitionConfigSchema.parse({
    config_id: `job-scout:acquisition-config:${sourceType}`,
    source_id: sourceId,
    source_type: sourceType,
    acquisition_method: method,
    enabled,
    access_status: accessStatus,
    rate_limit: {
      rate_limit_id: `job-scout:rate-limit:${sourceType}`,
      max_requests: options.maxRequests,
      window_seconds: 3600,
      observed_requests: 0,
      remaining_requests: options.maxRequests,
      reset_at: "2026-06-03T09:00:00.000Z",
      metadata_only: true,
    },
    form_automation_permitted: options.formAutomationPermitted,
    telemetry: {
      metadata_only: true,
      credentials_included: false,
      raw_source_payload_included: false,
    },
  });
}
