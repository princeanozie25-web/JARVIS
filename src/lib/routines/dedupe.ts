import { z } from "zod";

import { RoutineSchedulePolicyKindSchema } from "./registry";
import { RoutineKillSwitchStateSchema } from "./kill-switch";

export const ROUTINE_DEDUPE_DECISIONS = [
  "allow",
  "duplicate",
  "blocked",
  "expired_window",
] as const;

export const ROUTINE_DEDUPE_REASONS = [
  "unique_key_allowed",
  "duplicate_key",
  "kill_switch_blocked",
  "expired_window_catch_up_forbidden",
  "invalid_window",
] as const;

export const ROUTINE_DEDUPE_TELEMETRY_EVENT_TYPES = [
  "routine_dedupe_evaluated",
] as const;

export type RoutineDedupeDecisionName =
  (typeof ROUTINE_DEDUPE_DECISIONS)[number];
export type RoutineDedupeReason = (typeof ROUTINE_DEDUPE_REASONS)[number];
export type RoutineDedupeTelemetryEventType =
  (typeof ROUTINE_DEDUPE_TELEMETRY_EVENT_TYPES)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const TickIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^tick:[a-z0-9._:-]+$/);

const InputSurfaceHashSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^(hash|input|surface):[a-z0-9._:-]+$/);

const DedupeHashSchema = z
  .string()
  .trim()
  .regex(/^dedupe:[a-f0-9]{8}$/);

export const RoutineDedupeDecisionNameSchema = z.enum(ROUTINE_DEDUPE_DECISIONS);
export const RoutineDedupeReasonSchema = z.enum(ROUTINE_DEDUPE_REASONS);
export const RoutineDedupeTelemetryEventTypeSchema = z.enum(
  ROUTINE_DEDUPE_TELEMETRY_EVENT_TYPES,
);

export const CreateRoutineIdempotencyKeyInputSchema = z
  .strictObject({
    routine_id: RoutineIdSchema,
    schedule_kind: RoutineSchedulePolicyKindSchema,
    tick_id: TickIdSchema.nullable().default(null),
    window_start_ms: z.number().int().nonnegative().nullable().default(null),
    window_end_ms: z.number().int().nonnegative().nullable().default(null),
    input_surface_hashes: z.array(InputSurfaceHashSchema).default([]),
  })
  .refine(
    (input) =>
      input.tick_id !== null ||
      (input.window_start_ms !== null && input.window_end_ms !== null),
    "idempotency key requires a tick id or a complete window",
  );

export const RoutineIdempotencyKeySchema = z.strictObject({
  key_hash: DedupeHashSchema,
  routine_id: RoutineIdSchema,
  schedule_kind: RoutineSchedulePolicyKindSchema,
  tick_id: TickIdSchema.nullable(),
  window_start_ms: z.number().int().nonnegative().nullable(),
  window_end_ms: z.number().int().nonnegative().nullable(),
  input_surface_hashes: z.array(InputSurfaceHashSchema),
  input_surface_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  hashes_only: z.literal(true),
  raw_input_stored: z.literal(false),
  report_body_stored: z.literal(false),
  persistence_written: z.literal(false),
});

export const RoutineIdempotencyKeySummarySchema = z.strictObject({
  key_hash: DedupeHashSchema,
  routine_id: RoutineIdSchema,
  schedule_kind: RoutineSchedulePolicyKindSchema,
  tick_id: TickIdSchema.nullable(),
  window_start_ms: z.number().int().nonnegative().nullable(),
  window_end_ms: z.number().int().nonnegative().nullable(),
  metadata_only: z.literal(true),
  hashes_only: z.literal(true),
});

export const RoutineDedupeWindowSchema = z
  .strictObject({
    window_start_ms: z.number().int().nonnegative(),
    window_end_ms: z.number().int().nonnegative(),
    evaluated_at_ms: z.number().int().nonnegative(),
    catch_up_allowed: z.literal(false),
    metadata_only: z.literal(true),
    persistence_enabled: z.literal(false),
    timer_started: z.literal(false),
  })
  .refine(
    (window) => window.window_end_ms >= window.window_start_ms,
    "dedupe window end must be greater than or equal to start",
  );

export const EvaluateRoutineDedupeInputSchema = z.strictObject({
  candidate_key: RoutineIdempotencyKeySchema,
  prior_key_summaries: z.array(RoutineIdempotencyKeySummarySchema),
  dedupe_window: RoutineDedupeWindowSchema,
  kill_switch: RoutineKillSwitchStateSchema.optional(),
});

export const RoutineDedupeDecisionSchema = z.strictObject({
  decision: RoutineDedupeDecisionNameSchema,
  reason: RoutineDedupeReasonSchema,
  key_hash: DedupeHashSchema,
  routine_id: RoutineIdSchema,
  schedule_kind: RoutineSchedulePolicyKindSchema,
  metadata_only: z.literal(true),
  hashes_only: z.literal(true),
  no_persistence: z.literal(true),
  catch_up_allowed: z.literal(false),
  timer_started: z.literal(false),
  scheduler_started: z.literal(false),
  background_job_started: z.literal(false),
  routine_executed: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  runtime_mutated: z.literal(false),
  cloud_called: z.literal(false),
  persistence_written: z.literal(false),
});

export const RoutineDedupeTelemetryEventSchema = z.strictObject({
  event_type: RoutineDedupeTelemetryEventTypeSchema,
  decision: RoutineDedupeDecisionNameSchema,
  reason: RoutineDedupeReasonSchema,
  allow_count: z.number().int().nonnegative(),
  duplicate_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  expired_window_count: z.number().int().nonnegative(),
  prior_key_count: z.number().int().nonnegative(),
  input_surface_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  counts_and_flags_only: z.literal(true),
  timer_started: z.literal(false),
  scheduler_started: z.literal(false),
  background_job_started: z.literal(false),
  routine_executed: z.literal(false),
  tool_called: z.literal(false),
  action_executed: z.literal(false),
  approval_granted: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  environment_mutated: z.literal(false),
  runtime_mutated: z.literal(false),
  cloud_called: z.literal(false),
  persistence_written: z.literal(false),
});

export type CreateRoutineIdempotencyKeyInput = z.input<
  typeof CreateRoutineIdempotencyKeyInputSchema
>;
export type RoutineIdempotencyKey = z.infer<typeof RoutineIdempotencyKeySchema>;
export type RoutineIdempotencyKeySummary = z.infer<
  typeof RoutineIdempotencyKeySummarySchema
>;
export type RoutineDedupeWindow = z.infer<typeof RoutineDedupeWindowSchema>;
export type EvaluateRoutineDedupeInput = z.input<
  typeof EvaluateRoutineDedupeInputSchema
>;
export type RoutineDedupeDecision = z.infer<typeof RoutineDedupeDecisionSchema>;
export type RoutineDedupeTelemetryEvent = z.infer<
  typeof RoutineDedupeTelemetryEventSchema
>;

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `dedupe:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function createRoutineIdempotencyKey(
  input: CreateRoutineIdempotencyKeyInput,
): RoutineIdempotencyKey {
  const parsed = CreateRoutineIdempotencyKeyInputSchema.parse(input);
  const inputSurfaceHashes = [...parsed.input_surface_hashes].sort();
  const hashMaterial = JSON.stringify({
    routine_id: parsed.routine_id,
    schedule_kind: parsed.schedule_kind,
    tick_id: parsed.tick_id,
    window_start_ms: parsed.window_start_ms,
    window_end_ms: parsed.window_end_ms,
    input_surface_hashes: inputSurfaceHashes,
  });

  return RoutineIdempotencyKeySchema.parse({
    key_hash: stableHash(hashMaterial),
    routine_id: parsed.routine_id,
    schedule_kind: parsed.schedule_kind,
    tick_id: parsed.tick_id,
    window_start_ms: parsed.window_start_ms,
    window_end_ms: parsed.window_end_ms,
    input_surface_hashes: inputSurfaceHashes,
    input_surface_count: inputSurfaceHashes.length,
    metadata_only: true,
    hashes_only: true,
    raw_input_stored: false,
    report_body_stored: false,
    persistence_written: false,
  });
}

export function summarizeRoutineIdempotencyKey(
  keyInput: RoutineIdempotencyKey,
): RoutineIdempotencyKeySummary {
  const key = RoutineIdempotencyKeySchema.parse(keyInput);
  return RoutineIdempotencyKeySummarySchema.parse({
    key_hash: key.key_hash,
    routine_id: key.routine_id,
    schedule_kind: key.schedule_kind,
    tick_id: key.tick_id,
    window_start_ms: key.window_start_ms,
    window_end_ms: key.window_end_ms,
    metadata_only: true,
    hashes_only: true,
  });
}

function decision(input: {
  decision: RoutineDedupeDecisionName;
  reason: RoutineDedupeReason;
  key: RoutineIdempotencyKey;
}): RoutineDedupeDecision {
  return RoutineDedupeDecisionSchema.parse({
    decision: input.decision,
    reason: input.reason,
    key_hash: input.key.key_hash,
    routine_id: input.key.routine_id,
    schedule_kind: input.key.schedule_kind,
    metadata_only: true,
    hashes_only: true,
    no_persistence: true,
    catch_up_allowed: false,
    timer_started: false,
    scheduler_started: false,
    background_job_started: false,
    routine_executed: false,
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    runtime_mutated: false,
    cloud_called: false,
    persistence_written: false,
  });
}

export function evaluateRoutineDedupe(
  input: EvaluateRoutineDedupeInput,
): RoutineDedupeDecision {
  const parsed = EvaluateRoutineDedupeInputSchema.parse(input);

  if (
    parsed.kill_switch?.state === "disabled" ||
    parsed.kill_switch?.state === "locked_down"
  ) {
    return decision({
      decision: "blocked",
      reason: "kill_switch_blocked",
      key: parsed.candidate_key,
    });
  }

  if (
    parsed.dedupe_window.evaluated_at_ms > parsed.dedupe_window.window_end_ms
  ) {
    return decision({
      decision: "expired_window",
      reason: "expired_window_catch_up_forbidden",
      key: parsed.candidate_key,
    });
  }

  if (
    parsed.candidate_key.window_start_ms !== null &&
    parsed.candidate_key.window_end_ms !== null &&
    (parsed.candidate_key.window_start_ms !==
      parsed.dedupe_window.window_start_ms ||
      parsed.candidate_key.window_end_ms !== parsed.dedupe_window.window_end_ms)
  ) {
    return decision({
      decision: "blocked",
      reason: "invalid_window",
      key: parsed.candidate_key,
    });
  }

  if (
    parsed.prior_key_summaries.some(
      (summary) => summary.key_hash === parsed.candidate_key.key_hash,
    )
  ) {
    return decision({
      decision: "duplicate",
      reason: "duplicate_key",
      key: parsed.candidate_key,
    });
  }

  return decision({
    decision: "allow",
    reason: "unique_key_allowed",
    key: parsed.candidate_key,
  });
}

export function createRoutineDedupeTelemetryEvent(input: {
  decision: RoutineDedupeDecision;
  prior_key_count: number;
  input_surface_count: number;
}): RoutineDedupeTelemetryEvent {
  const parsedDecision = RoutineDedupeDecisionSchema.parse(input.decision);
  return RoutineDedupeTelemetryEventSchema.parse({
    event_type: "routine_dedupe_evaluated",
    decision: parsedDecision.decision,
    reason: parsedDecision.reason,
    allow_count: parsedDecision.decision === "allow" ? 1 : 0,
    duplicate_count: parsedDecision.decision === "duplicate" ? 1 : 0,
    blocked_count: parsedDecision.decision === "blocked" ? 1 : 0,
    expired_window_count: parsedDecision.decision === "expired_window" ? 1 : 0,
    prior_key_count: input.prior_key_count,
    input_surface_count: input.input_surface_count,
    metadata_only: true,
    counts_and_flags_only: true,
    timer_started: false,
    scheduler_started: false,
    background_job_started: false,
    routine_executed: false,
    tool_called: false,
    action_executed: false,
    approval_granted: false,
    memory_written: false,
    project_mutated: false,
    environment_mutated: false,
    runtime_mutated: false,
    cloud_called: false,
    persistence_written: false,
  });
}
