import { z } from "zod";
import {
  VisionCapabilitySchema,
  VisionInputKindSchema,
  VisionObservationSchema,
  VisionProviderKindSchema,
  VisionProviderResultSchema,
  VisionProviderResultStatusSchema,
  VisionRuntimeEnvironmentSchema,
  type VisionCapability,
  type VisionInputKind,
  type VisionObservation,
  type VisionProviderKind,
  type VisionProviderResult,
  type VisionProviderResultStatus,
  type VisionRuntimeEnvironment,
} from "./contracts";
import {
  DEFAULT_VISION_RUNTIME_POLICY,
  evaluateVisionRuntimePolicy,
  type VisionMutationAuthorityClass,
  type VisionPolicyDenialReason,
} from "./policy";
import type { VisionProviderCancellationToken } from "./provider";
import { VisionProviderRegistry } from "./registry";

export const VISION_SESSION_STATES = [
  "idle",
  "requested",
  "policy_checked",
  "provider_selected",
  "running",
  "completed",
  "cancelled",
  "failed",
  "denied",
] as const;

export const VISION_SESSION_EVENT_TYPES = [
  "session_started",
  "policy_denied",
  "provider_selected",
  "provider_completed",
  "observation_created",
  "session_completed",
  "session_cancelled",
  "session_failed",
] as const;

export const VISION_SESSION_RESULT_REASONS = [
  "completed",
  "policy_denied",
  "missing_provider",
  "provider_timeout",
  "provider_cancelled",
  "unsupported_capability",
  "provider_failed",
] as const;

const VisionSessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const VisionSessionTimestampSchema = z.number().int().nonnegative();

export const VisionSessionStateSchema = z.enum(VISION_SESSION_STATES);
export const VisionSessionEventTypeSchema = z.enum(VISION_SESSION_EVENT_TYPES);
export const VisionSessionResultReasonSchema = z.enum(
  VISION_SESSION_RESULT_REASONS,
);

export type VisionSessionState = (typeof VISION_SESSION_STATES)[number];
export type VisionSessionEventType =
  (typeof VISION_SESSION_EVENT_TYPES)[number];
export type VisionSessionResultReason =
  (typeof VISION_SESSION_RESULT_REASONS)[number];

export const VisionSessionLifecycleEventSchema = z.strictObject({
  event_id: VisionSessionIdSchema,
  event_type: VisionSessionEventTypeSchema,
  session_id: VisionSessionIdSchema,
  state: VisionSessionStateSchema,
  capability: VisionCapabilitySchema,
  input_kind: VisionInputKindSchema,
  provider_id: VisionSessionIdSchema.nullable(),
  provider_kind: VisionProviderKindSchema.nullable(),
  result_status: VisionProviderResultStatusSchema.nullable(),
  reason: z.string().trim().min(1).max(120).nullable(),
  observation_count: z.number().int().nonnegative(),
  timestamp_ms: VisionSessionTimestampSchema,
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  derived: z.literal(true),
  raw_payload_included: z.literal(false),
  cloud_called: z.literal(false),
  provider_executed: z.boolean(),
  action_executed: z.literal(false),
  mutation_performed: z.literal(false),
  tool_triggered: z.literal(false),
  device_action_triggered: z.literal(false),
  project_mutated: z.literal(false),
  memory_mutated: z.literal(false),
  runtime_executed: z.literal(false),
});

export const VisionRuntimeSessionRecordSchema = z.strictObject({
  session_id: VisionSessionIdSchema,
  request_id: VisionSessionIdSchema,
  state: VisionSessionStateSchema,
  capability: VisionCapabilitySchema,
  input_kind: VisionInputKindSchema,
  environment: VisionRuntimeEnvironmentSchema,
  provider_id: VisionSessionIdSchema.nullable(),
  provider_kind: VisionProviderKindSchema.nullable(),
  result_status: VisionProviderResultStatusSchema.nullable(),
  reason: VisionSessionResultReasonSchema,
  started_at_ms: VisionSessionTimestampSchema,
  ended_at_ms: VisionSessionTimestampSchema,
  observation_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  advisory_only: z.literal(true),
  derived: z.literal(true),
  raw_payload_included: z.literal(false),
  raw_frame_persisted: z.literal(false),
  raw_ocr_text_included: z.literal(false),
  cloud_called: z.literal(false),
  provider_executed: z.boolean(),
  action_executed: z.literal(false),
  mutation_performed: z.literal(false),
  tool_triggered: z.literal(false),
  device_action_triggered: z.literal(false),
  project_mutated: z.literal(false),
  memory_mutated: z.literal(false),
  runtime_executed: z.literal(false),
});

export type VisionSessionLifecycleEvent = z.infer<
  typeof VisionSessionLifecycleEventSchema
>;
export type VisionRuntimeSessionRecord = z.infer<
  typeof VisionRuntimeSessionRecordSchema
>;

export interface VisionSessionRunRequest {
  readonly request_id: string;
  readonly session_id: string;
  readonly capability: VisionCapability;
  readonly input_kind: VisionInputKind;
  readonly environment: VisionRuntimeEnvironment;
  readonly user_triggered: boolean;
  readonly timeout_ms: number;
  readonly requested_at_ms: number;
  readonly cancellation_token?: VisionProviderCancellationToken;
  readonly abort_signal?: AbortSignal;
  readonly simulated_latency_ms?: number;
  readonly mutation_authority_requested?: readonly VisionMutationAuthorityClass[];
  readonly metadata_only: true;
}

export interface VisionSessionRunResult {
  readonly session: VisionRuntimeSessionRecord;
  readonly events: readonly VisionSessionLifecycleEvent[];
  readonly provider_result: VisionProviderResult | null;
  readonly observations: readonly VisionObservation[];
  readonly metadata_only: true;
  readonly advisory_only: true;
  readonly derived: true;
  readonly raw_payload_included: false;
  readonly cloud_called: false;
  readonly action_executed: false;
  readonly mutation_performed: false;
  readonly tool_triggered: false;
  readonly device_action_triggered: false;
  readonly project_mutated: false;
  readonly memory_mutated: false;
  readonly runtime_executed: false;
}

export interface VisionSessionRunnerOptions {
  readonly registry?: VisionProviderRegistry;
}

export class VisionSessionRunner {
  private readonly registry: VisionProviderRegistry;

  constructor(options: VisionSessionRunnerOptions = {}) {
    this.registry = options.registry ?? createDefaultFakeRegistry();
  }

  async run(request: VisionSessionRunRequest): Promise<VisionSessionRunResult> {
    const capability = VisionCapabilitySchema.parse(request.capability);
    const inputKind = VisionInputKindSchema.parse(request.input_kind);
    const environment = VisionRuntimeEnvironmentSchema.parse(
      request.environment,
    );
    const events: VisionSessionLifecycleEvent[] = [];
    const eventContext = {
      session_id: request.session_id,
      capability,
      input_kind: inputKind,
      timestamp_ms: request.requested_at_ms,
    };

    events.push(
      createVisionSessionLifecycleEvent({
        ...eventContext,
        event_type: "session_started",
        state: "requested",
        reason: "requested",
      }),
    );

    const policy = evaluateVisionRuntimePolicy({
      capability,
      input_kind: inputKind,
      provider_kind: providerKindForPolicy(capability),
      environment,
      user_triggered: request.user_triggered,
      capture_mode: "single",
      mutation_authority_requested: request.mutation_authority_requested,
      policy: DEFAULT_VISION_RUNTIME_POLICY,
    });

    if (!policy.allowed) {
      events.push(
        createVisionSessionLifecycleEvent({
          ...eventContext,
          event_type: "policy_denied",
          state: "denied",
          reason: policy.reason,
        }),
      );
      return sessionRunResult({
        request,
        state: "denied",
        reason: "policy_denied",
        events,
        provider_result: null,
        observations: [],
        provider_executed: false,
      });
    }

    events.push(
      createVisionSessionLifecycleEvent({
        ...eventContext,
        event_type: "provider_selected",
        state: "policy_checked",
        reason: "policy_checked",
      }),
    );

    const provider = this.registry.getProviderByCapability(capability);
    if (!provider) {
      events.push(
        createVisionSessionLifecycleEvent({
          ...eventContext,
          event_type: "session_failed",
          state: "failed",
          reason: "missing_provider",
        }),
      );
      return sessionRunResult({
        request,
        state: "failed",
        reason: "missing_provider",
        events,
        provider_result: null,
        observations: [],
        provider_executed: false,
      });
    }

    const providerContext = {
      provider_id: provider.id,
      provider_kind: provider.kind,
    };
    events[events.length - 1] = createVisionSessionLifecycleEvent({
      ...eventContext,
      ...providerContext,
      event_type: "provider_selected",
      state: "provider_selected",
      reason: "provider_selected",
    });

    const providerRun = await provider.run({
      request_id: request.request_id,
      session_id: request.session_id,
      capability,
      input_kind: inputKind,
      user_triggered: request.user_triggered,
      timeout_ms: request.timeout_ms,
      requested_at_ms: request.requested_at_ms,
      environment,
      cancellation_token: request.cancellation_token,
      abort_signal: request.abort_signal,
      simulated_latency_ms: request.simulated_latency_ms,
      metadata_only: true,
    });
    const providerResult = VisionProviderResultSchema.parse(
      providerRun.provider_result,
    );
    const observations = providerRun.observations.map((observation) =>
      VisionObservationSchema.parse(observation),
    );

    events.push(
      createVisionSessionLifecycleEvent({
        ...eventContext,
        ...providerContext,
        event_type: "provider_completed",
        state: "running",
        result_status: providerResult.status,
        reason: providerResult.reason,
        observation_count: observations.length,
        provider_executed: true,
      }),
    );

    const finalReason = resultReasonForProviderStatus(providerResult.status);
    if (
      providerResult.status === "success" ||
      providerResult.status === "degraded"
    ) {
      for (const observation of observations) {
        events.push(
          createVisionSessionLifecycleEvent({
            ...eventContext,
            ...providerContext,
            event_type: "observation_created",
            state: "running",
            result_status: providerResult.status,
            reason: "observation_created",
            observation_count: 1,
            provider_executed: true,
          }),
        );
        VisionObservationSchema.parse(observation);
      }
      events.push(
        createVisionSessionLifecycleEvent({
          ...eventContext,
          ...providerContext,
          event_type: "session_completed",
          state: "completed",
          result_status: providerResult.status,
          reason: finalReason,
          observation_count: observations.length,
          provider_executed: true,
        }),
      );
      return sessionRunResult({
        request,
        state: "completed",
        reason: "completed",
        events,
        provider_result: providerResult,
        observations,
        provider_executed: true,
      });
    }

    const terminalState =
      providerResult.status === "cancelled" ? "cancelled" : "failed";
    const terminalEvent =
      providerResult.status === "cancelled"
        ? "session_cancelled"
        : "session_failed";
    events.push(
      createVisionSessionLifecycleEvent({
        ...eventContext,
        ...providerContext,
        event_type: terminalEvent,
        state: terminalState,
        result_status: providerResult.status,
        reason: finalReason,
        provider_executed: true,
      }),
    );

    return sessionRunResult({
      request,
      state: terminalState,
      reason: finalReason,
      events,
      provider_result: providerResult,
      observations: [],
      provider_executed: true,
    });
  }
}

export function createFakeVisionSessionRunner(): VisionSessionRunner {
  return new VisionSessionRunner();
}

function createDefaultFakeRegistry(): VisionProviderRegistry {
  const result = VisionProviderRegistry.createFakeOnly();
  if (!result.ok) {
    throw new Error("Default fake vision registry failed to initialize.");
  }
  return result.registry;
}

function providerKindForPolicy(
  capability: VisionCapability,
): VisionProviderKind {
  switch (capability) {
    case "screenshot_ocr":
      return "fake_ocr";
    case "object_detection":
      return "fake_object_detector";
    case "mock_camera":
      return "fake_mock_camera";
    case "real_camera":
      return "real_camera";
    case "cloud_vision":
      return "cloud_vision";
  }
}

function resultReasonForProviderStatus(
  status: VisionProviderResultStatus,
): VisionSessionResultReason {
  switch (status) {
    case "success":
    case "degraded":
      return "completed";
    case "timeout":
      return "provider_timeout";
    case "cancelled":
      return "provider_cancelled";
    case "unsupported_capability":
      return "unsupported_capability";
    case "policy_denied":
      return "policy_denied";
  }
}

function createVisionSessionLifecycleEvent(input: {
  readonly event_type: VisionSessionEventType;
  readonly session_id: string;
  readonly state: VisionSessionState;
  readonly capability: VisionCapability;
  readonly input_kind: VisionInputKind;
  readonly timestamp_ms: number;
  readonly provider_id?: string | null;
  readonly provider_kind?: VisionProviderKind | null;
  readonly result_status?: VisionProviderResultStatus | null;
  readonly reason: string | VisionPolicyDenialReason;
  readonly observation_count?: number;
  readonly provider_executed?: boolean;
}): VisionSessionLifecycleEvent {
  const eventSlug = input.event_type.replace(/_/g, "-");
  return VisionSessionLifecycleEventSchema.parse({
    event_id: `${input.session_id}.${eventSlug}.${input.timestamp_ms}`,
    event_type: input.event_type,
    session_id: input.session_id,
    state: input.state,
    capability: input.capability,
    input_kind: input.input_kind,
    provider_id: input.provider_id ?? null,
    provider_kind: input.provider_kind ?? null,
    result_status: input.result_status ?? null,
    reason: input.reason,
    observation_count: input.observation_count ?? 0,
    timestamp_ms: input.timestamp_ms,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
    cloud_called: false,
    provider_executed: input.provider_executed ?? false,
    action_executed: false,
    mutation_performed: false,
    tool_triggered: false,
    device_action_triggered: false,
    project_mutated: false,
    memory_mutated: false,
    runtime_executed: false,
  });
}

function sessionRunResult(input: {
  readonly request: VisionSessionRunRequest;
  readonly state: Exclude<VisionSessionState, "idle" | "requested">;
  readonly reason: VisionSessionResultReason;
  readonly events: readonly VisionSessionLifecycleEvent[];
  readonly provider_result: VisionProviderResult | null;
  readonly observations: readonly VisionObservation[];
  readonly provider_executed: boolean;
}): VisionSessionRunResult {
  const session = VisionRuntimeSessionRecordSchema.parse({
    session_id: input.request.session_id,
    request_id: input.request.request_id,
    state: input.state,
    capability: input.request.capability,
    input_kind: input.request.input_kind,
    environment: input.request.environment,
    provider_id: input.provider_result?.provider_id ?? null,
    provider_kind: input.provider_result?.provider_kind ?? null,
    result_status: input.provider_result?.status ?? null,
    reason: input.reason,
    started_at_ms: input.request.requested_at_ms,
    ended_at_ms: input.request.requested_at_ms,
    observation_count: input.observations.length,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
    raw_frame_persisted: false,
    raw_ocr_text_included: false,
    cloud_called: false,
    provider_executed: input.provider_executed,
    action_executed: false,
    mutation_performed: false,
    tool_triggered: false,
    device_action_triggered: false,
    project_mutated: false,
    memory_mutated: false,
    runtime_executed: false,
  });

  return {
    session,
    events: input.events,
    provider_result: input.provider_result,
    observations: input.observations,
    metadata_only: true,
    advisory_only: true,
    derived: true,
    raw_payload_included: false,
    cloud_called: false,
    action_executed: false,
    mutation_performed: false,
    tool_triggered: false,
    device_action_triggered: false,
    project_mutated: false,
    memory_mutated: false,
    runtime_executed: false,
  };
}
