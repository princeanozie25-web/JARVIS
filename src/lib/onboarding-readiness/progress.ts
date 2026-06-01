import { z } from "zod";

import {
  ONBOARDING_READINESS_CATEGORIES,
  OnboardingDeferredItemIdSchema,
  OnboardingGateIdSchema,
  OnboardingReadinessCategorySchema,
  OnboardingSafetyPostureSchema,
  type OnboardingReadinessCategory,
  type OnboardingSafetyPosture,
} from "./contracts";
import {
  ONBOARDING_STEP_REGISTRY_VERSION,
  OnboardingStepBlockingPostureSchema,
  OnboardingStepRecordIdSchema,
  getOnboardingStepRegistry,
  type OnboardingStepRecord,
} from "./steps";

export const ONBOARDING_PROGRESS_MODEL_VERSION = "20C.3" as const;

export const ONBOARDING_PROGRESS_STATUSES = [
  "not_started",
  "ready",
  "blocked",
  "warning",
  "skipped",
  "deferred",
  "complete",
] as const;

export type OnboardingProgressStatus =
  (typeof ONBOARDING_PROGRESS_STATUSES)[number];

export const OnboardingProgressStatusSchema = z.enum(
  ONBOARDING_PROGRESS_STATUSES,
);

export const OnboardingProgressEvidenceSchema = z.strictObject({
  evidence_id: z.string().trim().min(1).max(180),
  source_step_id: OnboardingStepRecordIdSchema,
  source_reference: z.string().trim().min(1).max(240),
  collected_at: z.null(),
  metadata_only: z.literal(true),
});

export const OnboardingGateProgressSchema = z.strictObject({
  gate_id: OnboardingGateIdSchema,
  status: OnboardingProgressStatusSchema,
  metadata_only: z.literal(true),
});

export const OnboardingDependencyProgressSchema = z.strictObject({
  dependency_step_id: OnboardingStepRecordIdSchema,
  status: OnboardingProgressStatusSchema,
  metadata_only: z.literal(true),
});

export const OnboardingStepProgressSchema = z.strictObject({
  progress_model_version: z.literal(ONBOARDING_PROGRESS_MODEL_VERSION),
  source_step_registry_version: z.literal(ONBOARDING_STEP_REGISTRY_VERSION),
  step_id: OnboardingStepRecordIdSchema,
  title: z.string().trim().min(1).max(160),
  category: OnboardingReadinessCategorySchema,
  sequence_order: z.number().int().positive(),
  status: OnboardingProgressStatusSchema,
  gate_statuses: z.array(OnboardingGateProgressSchema),
  dependency_statuses: z.array(OnboardingDependencyProgressSchema),
  blocking_posture: OnboardingStepBlockingPostureSchema,
  deferred: z.boolean(),
  deferred_item_ids: z.array(OnboardingDeferredItemIdSchema),
  remediation_hint: z.string().trim().min(1).max(360),
  evidence: z.array(OnboardingProgressEvidenceSchema).min(1),
  progress_model_only: z.literal(true),
  safety_posture: OnboardingSafetyPostureSchema,
});

export const OnboardingProgressSummarySchema = z.strictObject({
  progress_model_version: z.literal(ONBOARDING_PROGRESS_MODEL_VERSION),
  total_count: z.number().int().nonnegative(),
  status_counts: z.record(
    OnboardingProgressStatusSchema,
    z.number().int().nonnegative(),
  ),
  category_counts: z.record(
    OnboardingReadinessCategorySchema,
    z.number().int().nonnegative(),
  ),
  blocking_count: z.number().int().nonnegative(),
  non_blocking_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  complete_count: z.number().int().nonnegative(),
  gate_status_count: z.number().int().nonnegative(),
  dependency_status_count: z.number().int().nonnegative(),
  evidence_count: z.number().int().nonnegative(),
  phase20c_progress_model_only: z.literal(true),
  phase20c_capability_neutral: z.literal(true),
  safety_posture: OnboardingSafetyPostureSchema,
});

export type OnboardingProgressEvidence = z.infer<
  typeof OnboardingProgressEvidenceSchema
>;
export type OnboardingStepProgress = z.infer<
  typeof OnboardingStepProgressSchema
>;
export type OnboardingProgressSummary = z.infer<
  typeof OnboardingProgressSummarySchema
>;

const SAFETY_POSTURE: OnboardingSafetyPosture = {
  contract_only: true,
  metadata_only: true,
  read_only: true,
  deterministic: true,
  installer_automation_enabled: false,
  shell_execution_enabled: false,
  process_spawn_enabled: false,
  filesystem_mutation_enabled: false,
  network_call_enabled: false,
  provider_call_enabled: false,
  runtime_execution_enabled: false,
  ui_route_created: false,
  approval_bypass_created: false,
  authority_surface_created: false,
  capability_created: false,
  source_material_exposure_enabled: false,
};

function copyProgress(
  progress: OnboardingStepProgress,
): OnboardingStepProgress {
  return OnboardingStepProgressSchema.parse(
    JSON.parse(JSON.stringify(progress)),
  );
}

function copyProgressList(
  progress: readonly OnboardingStepProgress[],
): readonly OnboardingStepProgress[] {
  return progress.map(copyProgress);
}

function initialStatusForStep(
  step: OnboardingStepRecord,
): OnboardingProgressStatus {
  return step.deferred ? "deferred" : "not_started";
}

function remediationHintForStep(step: OnboardingStepRecord): string {
  if (step.deferred) {
    return "Deferred by onboarding readiness contract; keep disabled until a future approved architecture update or authority expansion.";
  }

  if (step.blocking_posture === "blocking") {
    return "Complete this documented onboarding step manually and verify its gate metadata before treating dependent steps as ready.";
  }

  return "Optional readiness step; review documentation and keep local-first, approval-gated posture intact.";
}

function progressFromStep(step: OnboardingStepRecord): OnboardingStepProgress {
  return OnboardingStepProgressSchema.parse({
    progress_model_version: ONBOARDING_PROGRESS_MODEL_VERSION,
    source_step_registry_version: ONBOARDING_STEP_REGISTRY_VERSION,
    step_id: step.step_id,
    title: step.title,
    category: step.category,
    sequence_order: step.sequence_order,
    status: initialStatusForStep(step),
    gate_statuses: step.gate_ids.map((gateId) => ({
      gate_id: gateId,
      status: step.deferred ? "deferred" : "ready",
      metadata_only: true,
    })),
    dependency_statuses: step.dependency_step_ids.map((dependencyStepId) => ({
      dependency_step_id: dependencyStepId,
      status: "not_started",
      metadata_only: true,
    })),
    blocking_posture: step.blocking_posture,
    deferred: step.deferred,
    deferred_item_ids: step.deferred_item_ids,
    remediation_hint: remediationHintForStep(step),
    evidence: [
      {
        evidence_id: `phase-20c3:progress:${step.step_id}`,
        source_step_id: step.step_id,
        source_reference: step.expected_reference,
        collected_at: null,
        metadata_only: true,
      },
    ],
    progress_model_only: true,
    safety_posture: SAFETY_POSTURE,
  });
}

export function createInitialOnboardingProgress(): readonly OnboardingStepProgress[] {
  return getOnboardingStepRegistry()
    .steps.map(progressFromStep)
    .map(copyProgress);
}

export function summarizeOnboardingProgress(
  progress: readonly OnboardingStepProgress[],
): OnboardingProgressSummary {
  const parsed = progress.map((item) =>
    OnboardingStepProgressSchema.parse(item),
  );
  const statusCounts = Object.fromEntries(
    ONBOARDING_PROGRESS_STATUSES.map((status) => [
      status,
      parsed.filter((item) => item.status === status).length,
    ]),
  ) as Record<OnboardingProgressStatus, number>;
  const categoryCounts = Object.fromEntries(
    ONBOARDING_READINESS_CATEGORIES.map((category) => [
      category,
      parsed.filter((item) => item.category === category).length,
    ]),
  ) as Record<OnboardingReadinessCategory, number>;

  return OnboardingProgressSummarySchema.parse({
    progress_model_version: ONBOARDING_PROGRESS_MODEL_VERSION,
    total_count: parsed.length,
    status_counts: statusCounts,
    category_counts: categoryCounts,
    blocking_count: parsed.filter(
      (item) => item.blocking_posture === "blocking",
    ).length,
    non_blocking_count: parsed.filter(
      (item) => item.blocking_posture === "non_blocking",
    ).length,
    deferred_count: parsed.filter((item) => item.deferred).length,
    blocked_count: statusCounts.blocked,
    warning_count: statusCounts.warning,
    complete_count: statusCounts.complete,
    gate_status_count: parsed.reduce(
      (count, item) => count + item.gate_statuses.length,
      0,
    ),
    dependency_status_count: parsed.reduce(
      (count, item) => count + item.dependency_statuses.length,
      0,
    ),
    evidence_count: parsed.reduce(
      (count, item) => count + item.evidence.length,
      0,
    ),
    phase20c_progress_model_only: true,
    phase20c_capability_neutral: true,
    safety_posture: SAFETY_POSTURE,
  });
}

export function getOnboardingProgressByStatus(
  progress: readonly OnboardingStepProgress[],
  status: OnboardingProgressStatus,
): readonly OnboardingStepProgress[] {
  return copyProgressList(
    progress
      .map((item) => OnboardingStepProgressSchema.parse(item))
      .filter((item) => item.status === status),
  );
}

export function getBlockedOnboardingProgress(
  progress: readonly OnboardingStepProgress[],
): readonly OnboardingStepProgress[] {
  return getOnboardingProgressByStatus(progress, "blocked");
}

export function getDeferredOnboardingProgress(
  progress: readonly OnboardingStepProgress[],
): readonly OnboardingStepProgress[] {
  return progress
    .map((item) => OnboardingStepProgressSchema.parse(item))
    .filter((item) => item.deferred || item.status === "deferred")
    .map(copyProgress);
}
