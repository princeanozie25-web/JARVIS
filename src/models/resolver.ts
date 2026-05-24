import { z } from "zod";
import type { ModelRegistryLoader } from "./registry";
import {
  MODEL_CAPABILITIES,
  MODEL_RUNTIME_CLASSES,
  MODEL_TIERS,
} from "./types";
import type {
  ModelCapability,
  ModelRegistryEntry,
  ModelRuntimeClass,
  ModelTier,
} from "./types";

export const MODEL_RESOLVER_REJECTION_REASONS = [
  "disabled",
  "cloud_not_allowed",
  "capability_mismatch",
  "streaming_required",
  "tools_required",
  "vision_required",
  "excluded",
  "priority_too_high",
] as const;

export const MODEL_RESOLVER_FAILURE_REASONS = [
  "invalid_request",
  "no_eligible_models",
] as const;

export const MODEL_FALLBACK_GOVERNANCE_FLAGS = [
  "cloud_opt_in_required",
  "disabled_model_opt_in_required",
  "no_eligible_models",
  "capability_unavailable",
  "streaming_unavailable",
  "tools_unavailable",
  "vision_unavailable",
] as const;

export type ModelResolverRejectionReason =
  (typeof MODEL_RESOLVER_REJECTION_REASONS)[number];
export type ModelResolverFailureReason =
  (typeof MODEL_RESOLVER_FAILURE_REASONS)[number];
export type ModelFallbackGovernanceFlag =
  (typeof MODEL_FALLBACK_GOVERNANCE_FLAGS)[number];

export interface ModelResolverInput {
  readonly capability: ModelCapability;
  readonly preferred_tier?: ModelTier;
  readonly allow_cloud?: boolean;
  readonly allow_disabled?: boolean;
  readonly runtime_class?: ModelRuntimeClass;
  readonly max_priority?: number;
  readonly excluded_model_ids?: readonly string[];
  readonly required_streaming?: boolean;
  readonly required_tools?: boolean;
  readonly required_vision?: boolean;
}

export interface NormalizedModelResolverInput {
  readonly capability: ModelCapability;
  readonly preferred_tier?: ModelTier;
  readonly allow_cloud: boolean;
  readonly allow_disabled: boolean;
  readonly runtime_class?: ModelRuntimeClass;
  readonly max_priority?: number;
  readonly excluded_model_ids: readonly string[];
  readonly required_streaming: boolean;
  readonly required_tools: boolean;
  readonly required_vision: boolean;
}

export interface ModelResolverCandidate {
  readonly entry: ModelRegistryEntry;
  readonly eligible: boolean;
  readonly rejection_reasons: readonly ModelResolverRejectionReason[];
}

export interface ModelResolverFailure {
  readonly reason: ModelResolverFailureReason;
  readonly message: string;
}

export interface ModelResolverResult {
  readonly selected: ModelRegistryEntry | null;
  readonly failure: ModelResolverFailure | null;
  readonly candidates: readonly ModelResolverCandidate[];
  readonly eligible_candidates: readonly ModelResolverCandidate[];
  readonly input: NormalizedModelResolverInput | null;
}

export type ModelFallbackRejectionTrace = Readonly<
  Record<ModelResolverRejectionReason, readonly string[]>
>;

export interface ModelFallbackPlanOptions {
  readonly now?: () => number;
}

export interface ModelFallbackPlan {
  readonly selected_primary: ModelResolverCandidate | null;
  readonly fallback_chain: readonly ModelResolverCandidate[];
  readonly rejected_candidates: readonly ModelResolverCandidate[];
  readonly candidates: readonly ModelResolverCandidate[];
  readonly rejection_reasons: ModelFallbackRejectionTrace;
  readonly governance_flags: readonly ModelFallbackGovernanceFlag[];
  readonly planning_timestamp?: number;
  readonly failure: ModelResolverFailure | null;
  readonly input: NormalizedModelResolverInput | null;
}

const ModelResolverInputSchema = z.strictObject({
  capability: z.enum(MODEL_CAPABILITIES),
  preferred_tier: z.enum(MODEL_TIERS).optional(),
  allow_cloud: z.boolean().default(false),
  allow_disabled: z.boolean().default(false),
  runtime_class: z.enum(MODEL_RUNTIME_CLASSES).optional(),
  max_priority: z.number().int().nonnegative().optional(),
  excluded_model_ids: z.array(z.string().trim().min(1)).default([]),
  required_streaming: z.boolean().default(false),
  required_tools: z.boolean().default(false),
  required_vision: z.boolean().default(false),
});

const TIER_RANK: Record<ModelTier, number> = {
  T1: 0,
  T2: 1,
  T3: 2,
  T4: 3,
};

const DEFAULT_RUNTIME_RANK: Record<ModelRuntimeClass, number> = {
  local: 0,
  mock: 1,
  cloud: 2,
};

export function resolveModel(
  registry: ModelRegistryLoader,
  input: unknown,
): ModelResolverResult {
  const parsed = ModelResolverInputSchema.safeParse(input);
  if (!parsed.success) {
    return clone({
      selected: null,
      failure: {
        reason: "invalid_request",
        message: "Model resolver input was malformed.",
      },
      candidates: [],
      eligible_candidates: [],
      input: null,
    });
  }

  const normalizedInput = parsed.data;
  const unsortedCandidates = registry
    .listModels()
    .map((entry) => createCandidate(entry, normalizedInput));
  const hasEligibleRuntimePreference =
    normalizedInput.runtime_class !== undefined &&
    unsortedCandidates.some(
      (candidate) =>
        candidate.eligible &&
        candidate.entry.runtime_class === normalizedInput.runtime_class,
    );
  const candidates = unsortedCandidates.sort((left, right) =>
    compareCandidates(
      left,
      right,
      normalizedInput,
      hasEligibleRuntimePreference,
    ),
  );
  const eligibleCandidates = candidates.filter(
    (candidate) => candidate.eligible,
  );
  const selected = eligibleCandidates[0]?.entry ?? null;

  return clone({
    selected,
    failure: selected
      ? null
      : {
          reason: "no_eligible_models",
          message: "No registry entries matched the resolver policy.",
        },
    candidates,
    eligible_candidates: eligibleCandidates,
    input: normalizedInput,
  });
}

export function buildFallbackPlan(
  registry: ModelRegistryLoader,
  input: unknown,
  options: ModelFallbackPlanOptions = {},
): ModelFallbackPlan {
  const parsed = ModelResolverInputSchema.safeParse(input);
  if (!parsed.success) {
    return clone({
      selected_primary: null,
      fallback_chain: [],
      rejected_candidates: [],
      candidates: [],
      rejection_reasons: createEmptyRejectionTrace(),
      governance_flags: ["no_eligible_models"],
      ...createTimestamp(options),
      failure: {
        reason: "invalid_request",
        message: "Model resolver input was malformed.",
      },
      input: null,
    });
  }

  const normalizedInput = parsed.data;
  const candidates = registry
    .listModels()
    .map((entry) => createCandidate(entry, normalizedInput))
    .sort((left, right) =>
      compareFallbackCandidates(left, right, normalizedInput),
    );
  const eligibleCandidates = candidates.filter(
    (candidate) => candidate.eligible,
  );
  const rejectedCandidates = candidates.filter(
    (candidate) => !candidate.eligible,
  );
  const selectedPrimary = eligibleCandidates[0] ?? null;

  return clone({
    selected_primary: selectedPrimary,
    fallback_chain: eligibleCandidates.slice(1),
    rejected_candidates: rejectedCandidates,
    candidates,
    rejection_reasons: createRejectionTrace(rejectedCandidates),
    governance_flags: createGovernanceFlags(candidates, normalizedInput),
    ...createTimestamp(options),
    failure: selectedPrimary
      ? null
      : {
          reason: "no_eligible_models",
          message: "No registry entries matched the resolver policy.",
        },
    input: normalizedInput,
  });
}

function createCandidate(
  entry: ModelRegistryEntry,
  input: NormalizedModelResolverInput,
): ModelResolverCandidate {
  const rejectionReasons: ModelResolverRejectionReason[] = [];
  const excludedIds = new Set(input.excluded_model_ids);

  if (excludedIds.has(entry.id)) rejectionReasons.push("excluded");
  if (entry.visibility === "disabled" && !input.allow_disabled) {
    rejectionReasons.push("disabled");
  }
  if (entry.runtime_class === "cloud" && !input.allow_cloud) {
    rejectionReasons.push("cloud_not_allowed");
  }
  if (!entry.capabilities.includes(input.capability)) {
    rejectionReasons.push("capability_mismatch");
  }
  if (input.required_streaming && !entry.supports_streaming) {
    rejectionReasons.push("streaming_required");
  }
  if (input.required_tools && !entry.supports_tools) {
    rejectionReasons.push("tools_required");
  }
  if (input.required_vision && !entry.supports_vision) {
    rejectionReasons.push("vision_required");
  }
  if (input.max_priority !== undefined && entry.priority > input.max_priority) {
    rejectionReasons.push("priority_too_high");
  }

  return {
    entry,
    eligible: rejectionReasons.length === 0,
    rejection_reasons: rejectionReasons,
  };
}

function compareCandidates(
  left: ModelResolverCandidate,
  right: ModelResolverCandidate,
  input: NormalizedModelResolverInput,
  hasEligibleRuntimePreference: boolean,
): number {
  return (
    Number(right.eligible) - Number(left.eligible) ||
    runtimePreferenceRank(left.entry, input, hasEligibleRuntimePreference) -
      runtimePreferenceRank(right.entry, input, hasEligibleRuntimePreference) ||
    tierPreferenceRank(left.entry, input) -
      tierPreferenceRank(right.entry, input) ||
    left.entry.priority - right.entry.priority ||
    TIER_RANK[left.entry.tier] - TIER_RANK[right.entry.tier] ||
    left.entry.id.localeCompare(right.entry.id)
  );
}

function compareFallbackCandidates(
  left: ModelResolverCandidate,
  right: ModelResolverCandidate,
  input: NormalizedModelResolverInput,
): number {
  return (
    Number(right.eligible) - Number(left.eligible) ||
    left.entry.priority - right.entry.priority ||
    tierPreferenceRank(left.entry, input) -
      tierPreferenceRank(right.entry, input) ||
    fallbackRuntimePreferenceRank(left.entry, input) -
      fallbackRuntimePreferenceRank(right.entry, input) ||
    DEFAULT_RUNTIME_RANK[left.entry.runtime_class] -
      DEFAULT_RUNTIME_RANK[right.entry.runtime_class] ||
    left.entry.id.localeCompare(right.entry.id)
  );
}

function runtimePreferenceRank(
  entry: ModelRegistryEntry,
  input: NormalizedModelResolverInput,
  hasEligibleRuntimePreference: boolean,
): number {
  if (input.runtime_class && hasEligibleRuntimePreference) {
    return entry.runtime_class === input.runtime_class ? 0 : 1;
  }
  return DEFAULT_RUNTIME_RANK[entry.runtime_class];
}

function tierPreferenceRank(
  entry: ModelRegistryEntry,
  input: NormalizedModelResolverInput,
): number {
  if (!input.preferred_tier) return 0;
  return entry.tier === input.preferred_tier ? 0 : 1;
}

function fallbackRuntimePreferenceRank(
  entry: ModelRegistryEntry,
  input: NormalizedModelResolverInput,
): number {
  if (!input.runtime_class) return 0;
  return entry.runtime_class === input.runtime_class ? 0 : 1;
}

function createRejectionTrace(
  rejectedCandidates: readonly ModelResolverCandidate[],
): ModelFallbackRejectionTrace {
  const trace = createEmptyRejectionTrace();

  for (const candidate of rejectedCandidates) {
    for (const reason of candidate.rejection_reasons) {
      trace[reason].push(candidate.entry.id);
    }
  }

  return trace;
}

function createEmptyRejectionTrace(): Record<
  ModelResolverRejectionReason,
  string[]
> {
  return {
    disabled: [],
    cloud_not_allowed: [],
    capability_mismatch: [],
    streaming_required: [],
    tools_required: [],
    vision_required: [],
    excluded: [],
    priority_too_high: [],
  };
}

function createGovernanceFlags(
  candidates: readonly ModelResolverCandidate[],
  input: NormalizedModelResolverInput,
): ModelFallbackGovernanceFlag[] {
  const flags = new Set<ModelFallbackGovernanceFlag>();
  const eligibleCandidates = candidates.filter(
    (candidate) => candidate.eligible,
  );

  if (eligibleCandidates.length === 0) flags.add("no_eligible_models");
  if (hasActionableGovernanceRejection(candidates, "cloud_not_allowed")) {
    flags.add("cloud_opt_in_required");
  }
  if (hasActionableGovernanceRejection(candidates, "disabled")) {
    flags.add("disabled_model_opt_in_required");
  }
  if (
    candidates.every((candidate) =>
      candidate.rejection_reasons.includes("capability_mismatch"),
    )
  ) {
    flags.add("capability_unavailable");
  }
  if (input.required_streaming && eligibleCandidates.length === 0) {
    flags.add("streaming_unavailable");
  }
  if (input.required_tools && eligibleCandidates.length === 0) {
    flags.add("tools_unavailable");
  }
  if (input.required_vision && eligibleCandidates.length === 0) {
    flags.add("vision_unavailable");
  }

  return MODEL_FALLBACK_GOVERNANCE_FLAGS.filter((flag) => flags.has(flag));
}

function hasActionableGovernanceRejection(
  candidates: readonly ModelResolverCandidate[],
  reason: Extract<
    ModelResolverRejectionReason,
    "cloud_not_allowed" | "disabled"
  >,
): boolean {
  return candidates.some(
    (candidate) =>
      candidate.rejection_reasons.includes(reason) &&
      !candidate.rejection_reasons.includes("capability_mismatch") &&
      !candidate.rejection_reasons.includes("streaming_required") &&
      !candidate.rejection_reasons.includes("tools_required") &&
      !candidate.rejection_reasons.includes("vision_required"),
  );
}

function createTimestamp(options: ModelFallbackPlanOptions): {
  readonly planning_timestamp?: number;
} {
  return options.now ? { planning_timestamp: options.now() } : {};
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
