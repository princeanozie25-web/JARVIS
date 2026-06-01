import { z } from "zod";

import {
  ONBOARDING_READINESS_CATEGORIES,
  OnboardingReadinessCategorySchema,
  OnboardingSafetyPostureSchema,
  type OnboardingSafetyPosture,
} from "./contracts";
import {
  ONBOARDING_PROGRESS_MODEL_VERSION,
  OnboardingProgressEvidenceSchema,
  OnboardingProgressStatusSchema,
  OnboardingProgressSummarySchema,
  OnboardingStepProgressSchema,
  createInitialOnboardingProgress,
  getBlockedOnboardingProgress,
  getDeferredOnboardingProgress,
  getOnboardingProgressByStatus,
  summarizeOnboardingProgress,
  type OnboardingProgressStatus,
  type OnboardingStepProgress,
} from "./progress";
import {
  OnboardingStepBlockingPostureSchema,
  OnboardingStepRecordIdSchema,
} from "./steps";

export const ONBOARDING_REPORT_VERSION = "20C.4" as const;

export const ONBOARDING_REPORT_VERDICTS = [
  "ready",
  "blocked",
  "warning",
  "deferred",
  "in_progress",
] as const;

export const ONBOARDING_REPORT_SECTION_IDS = [
  "summary",
  "blocked_steps",
  "deferred_steps",
  "warning_skipped_steps",
  "category_breakdown",
  "gate_dependency_readiness",
  "remediation_hints",
  "readiness_statements",
  "evidence_metadata",
] as const;

export type OnboardingReportVerdict =
  (typeof ONBOARDING_REPORT_VERDICTS)[number];
export type OnboardingReportSectionId =
  (typeof ONBOARDING_REPORT_SECTION_IDS)[number];

export const OnboardingReportVerdictSchema = z.enum(ONBOARDING_REPORT_VERDICTS);
export const OnboardingReportSectionIdSchema = z.enum(
  ONBOARDING_REPORT_SECTION_IDS,
);

export const OnboardingReportStepRefSchema = z.strictObject({
  step_id: OnboardingStepRecordIdSchema,
  title: z.string().trim().min(1).max(160),
  category: OnboardingReadinessCategorySchema,
  status: OnboardingProgressStatusSchema,
  blocking_posture: OnboardingStepBlockingPostureSchema,
  deferred: z.boolean(),
  remediation_hint: z.string().trim().min(1).max(360),
  evidence_ids: z.array(z.string().trim().min(1).max(180)).min(1),
  metadata_only: z.literal(true),
});

export const OnboardingCategoryBreakdownSchema = z.strictObject({
  category: OnboardingReadinessCategorySchema,
  total_count: z.number().int().nonnegative(),
  not_started_count: z.number().int().nonnegative(),
  ready_count: z.number().int().nonnegative(),
  blocked_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  skipped_count: z.number().int().nonnegative(),
  deferred_count: z.number().int().nonnegative(),
  complete_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
});

export const OnboardingGateDependencyReadinessSchema = z.strictObject({
  gate_status_count: z.number().int().nonnegative(),
  ready_gate_count: z.number().int().nonnegative(),
  blocked_gate_count: z.number().int().nonnegative(),
  dependency_status_count: z.number().int().nonnegative(),
  pending_dependency_count: z.number().int().nonnegative(),
  blocked_dependency_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
});

export const OnboardingReadinessStatementsSchema = z.strictObject({
  demo_fake_room: z.string().trim().min(1).max(420),
  first_safe_run: z.string().trim().min(1).max(420),
  deferred_real_device: z.string().trim().min(1).max(420),
  deferred_wake_word_conversation_mode: z.string().trim().min(1).max(420),
  metadata_only: z.literal(true),
});

export const OnboardingRemediationHintSchema = z.strictObject({
  step_id: OnboardingStepRecordIdSchema,
  hint: z.string().trim().min(1).max(360),
  metadata_only: z.literal(true),
});

export const OnboardingReportSectionSchema = z.strictObject({
  section_id: OnboardingReportSectionIdSchema,
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(420),
  step_ids: z.array(OnboardingStepRecordIdSchema),
  metadata_only: z.literal(true),
});

export const OnboardingReportSchema = z.strictObject({
  report_version: z.literal(ONBOARDING_REPORT_VERSION),
  source_progress_model_version: z.literal(ONBOARDING_PROGRESS_MODEL_VERSION),
  report_id: z.literal("phase-20c4-onboarding-report"),
  verdict: OnboardingReportVerdictSchema,
  summary: OnboardingProgressSummarySchema,
  blocked_steps: z.array(OnboardingReportStepRefSchema),
  deferred_steps: z.array(OnboardingReportStepRefSchema),
  warning_steps: z.array(OnboardingReportStepRefSchema),
  skipped_steps: z.array(OnboardingReportStepRefSchema),
  category_breakdown: z.array(OnboardingCategoryBreakdownSchema),
  gate_dependency_readiness: OnboardingGateDependencyReadinessSchema,
  remediation_hints: z.array(OnboardingRemediationHintSchema),
  readiness_statements: OnboardingReadinessStatementsSchema,
  evidence_metadata: z.array(OnboardingProgressEvidenceSchema),
  sections: z.array(OnboardingReportSectionSchema),
  report_generation_only: z.literal(true),
  phase20c_capability_neutral: z.literal(true),
  safety_posture: OnboardingSafetyPostureSchema,
});

export type OnboardingReport = z.infer<typeof OnboardingReportSchema>;
export type OnboardingReportSection = z.infer<
  typeof OnboardingReportSectionSchema
>;
export type OnboardingCategoryBreakdown = z.infer<
  typeof OnboardingCategoryBreakdownSchema
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

function copyReport(report: OnboardingReport): OnboardingReport {
  return OnboardingReportSchema.parse(JSON.parse(JSON.stringify(report)));
}

function stepRefFromProgress(
  progress: OnboardingStepProgress,
): z.infer<typeof OnboardingReportStepRefSchema> {
  return OnboardingReportStepRefSchema.parse({
    step_id: progress.step_id,
    title: progress.title,
    category: progress.category,
    status: progress.status,
    blocking_posture: progress.blocking_posture,
    deferred: progress.deferred,
    remediation_hint: progress.remediation_hint,
    evidence_ids: progress.evidence.map((evidence) => evidence.evidence_id),
    metadata_only: true,
  });
}

function isReadyLike(status: OnboardingProgressStatus): boolean {
  return status === "ready" || status === "complete";
}

function determineVerdict(
  progress: readonly OnboardingStepProgress[],
): OnboardingReportVerdict {
  const hasBlockedStep = progress.some((item) => item.status === "blocked");
  const hasBlockedGate = progress.some((item) =>
    item.gate_statuses.some((gate) => gate.status === "blocked"),
  );
  const hasBlockedDependency = progress.some((item) =>
    item.dependency_statuses.some(
      (dependency) => dependency.status === "blocked",
    ),
  );

  if (hasBlockedStep || hasBlockedGate || hasBlockedDependency) {
    return "blocked";
  }

  if (
    progress.some(
      (item) =>
        item.status === "warning" ||
        item.status === "skipped" ||
        item.gate_statuses.some((gate) => gate.status === "warning") ||
        item.dependency_statuses.some(
          (dependency) => dependency.status === "warning",
        ),
    )
  ) {
    return "warning";
  }

  const nonDeferred = progress.filter((item) => !item.deferred);
  const allNonDeferredReady = nonDeferred.every((item) =>
    isReadyLike(item.status),
  );
  const hasDeferredScope = progress.some(
    (item) => item.deferred || item.status === "deferred",
  );

  if (allNonDeferredReady && hasDeferredScope) {
    return "deferred";
  }

  if (allNonDeferredReady) {
    return "ready";
  }

  return "in_progress";
}

function buildCategoryBreakdown(
  progress: readonly OnboardingStepProgress[],
): OnboardingCategoryBreakdown[] {
  return ONBOARDING_READINESS_CATEGORIES.map((category) => {
    const categoryProgress = progress.filter(
      (item) => item.category === category,
    );

    return OnboardingCategoryBreakdownSchema.parse({
      category,
      total_count: categoryProgress.length,
      not_started_count: categoryProgress.filter(
        (item) => item.status === "not_started",
      ).length,
      ready_count: categoryProgress.filter((item) => item.status === "ready")
        .length,
      blocked_count: categoryProgress.filter(
        (item) => item.status === "blocked",
      ).length,
      warning_count: categoryProgress.filter(
        (item) => item.status === "warning",
      ).length,
      skipped_count: categoryProgress.filter(
        (item) => item.status === "skipped",
      ).length,
      deferred_count: categoryProgress.filter(
        (item) => item.status === "deferred" || item.deferred,
      ).length,
      complete_count: categoryProgress.filter(
        (item) => item.status === "complete",
      ).length,
      metadata_only: true,
    });
  });
}

function buildGateDependencyReadiness(
  progress: readonly OnboardingStepProgress[],
): z.infer<typeof OnboardingGateDependencyReadinessSchema> {
  const gateStatuses = progress.flatMap((item) => item.gate_statuses);
  const dependencyStatuses = progress.flatMap(
    (item) => item.dependency_statuses,
  );

  return OnboardingGateDependencyReadinessSchema.parse({
    gate_status_count: gateStatuses.length,
    ready_gate_count: gateStatuses.filter((gate) => gate.status === "ready")
      .length,
    blocked_gate_count: gateStatuses.filter((gate) => gate.status === "blocked")
      .length,
    dependency_status_count: dependencyStatuses.length,
    pending_dependency_count: dependencyStatuses.filter(
      (dependency) => dependency.status === "not_started",
    ).length,
    blocked_dependency_count: dependencyStatuses.filter(
      (dependency) => dependency.status === "blocked",
    ).length,
    metadata_only: true,
  });
}

function buildReadinessStatements(
  progress: readonly OnboardingStepProgress[],
): z.infer<typeof OnboardingReadinessStatementsSchema> {
  const demo = progress.find(
    (item) => item.step_id === "onboarding-sequence:enable-demo-mode",
  );
  const fakeRoom = progress.find(
    (item) => item.step_id === "onboarding-sequence:verify-fake-room",
  );
  const firstSafeRun = progress.find(
    (item) => item.step_id === "onboarding-sequence:verify-first-safe-run",
  );
  const realDevice = progress.find(
    (item) =>
      item.step_id === "onboarding-sequence:defer-real-device-onboarding",
  );
  const wakeWord = progress.find(
    (item) =>
      item.step_id ===
      "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
  );

  return OnboardingReadinessStatementsSchema.parse({
    demo_fake_room: `Demo mode is ${demo?.status ?? "not_started"} and fake-room verification is ${fakeRoom?.status ?? "not_started"}; both remain metadata-only and simulation-first.`,
    first_safe_run: `First safe run is ${firstSafeRun?.status ?? "not_started"} and remains approval-governed, local-first, and non-autonomous.`,
    deferred_real_device: `Real device onboarding is ${realDevice?.status ?? "deferred"} and remains deferred until a future approved authority expansion.`,
    deferred_wake_word_conversation_mode: `Wake-word and conversation-mode amendment is ${wakeWord?.status ?? "deferred"} and remains disabled until architecture is updated.`,
    metadata_only: true,
  });
}

function buildSections(
  verdict: OnboardingReportVerdict,
  blockedSteps: readonly z.infer<typeof OnboardingReportStepRefSchema>[],
  deferredSteps: readonly z.infer<typeof OnboardingReportStepRefSchema>[],
  warningSteps: readonly z.infer<typeof OnboardingReportStepRefSchema>[],
  skippedSteps: readonly z.infer<typeof OnboardingReportStepRefSchema>[],
): OnboardingReportSection[] {
  return [
    {
      section_id: "summary",
      title: "Summary",
      summary: `Onboarding report verdict is ${verdict}.`,
      step_ids: [],
      metadata_only: true,
    },
    {
      section_id: "blocked_steps",
      title: "Blocked Steps",
      summary: `${blockedSteps.length} blocked onboarding step(s).`,
      step_ids: blockedSteps.map((step) => step.step_id),
      metadata_only: true,
    },
    {
      section_id: "deferred_steps",
      title: "Deferred Steps",
      summary: `${deferredSteps.length} deferred onboarding step(s).`,
      step_ids: deferredSteps.map((step) => step.step_id),
      metadata_only: true,
    },
    {
      section_id: "warning_skipped_steps",
      title: "Warning And Skipped Steps",
      summary: `${warningSteps.length} warning step(s) and ${skippedSteps.length} skipped step(s).`,
      step_ids: [
        ...warningSteps.map((step) => step.step_id),
        ...skippedSteps.map((step) => step.step_id),
      ],
      metadata_only: true,
    },
    {
      section_id: "category_breakdown",
      title: "Category Breakdown",
      summary: "Category counts are derived from supplied progress records.",
      step_ids: [],
      metadata_only: true,
    },
    {
      section_id: "gate_dependency_readiness",
      title: "Gate And Dependency Readiness",
      summary:
        "Gate and dependency readiness is summarized from metadata-only progress placeholders.",
      step_ids: [],
      metadata_only: true,
    },
    {
      section_id: "remediation_hints",
      title: "Remediation Hints",
      summary:
        "Remediation hints are copied from progress metadata without executing onboarding.",
      step_ids: [],
      metadata_only: true,
    },
    {
      section_id: "readiness_statements",
      title: "Readiness Statements",
      summary:
        "Demo, fake-room, first-safe-run, and deferred-scope statements are metadata-only.",
      step_ids: [],
      metadata_only: true,
    },
    {
      section_id: "evidence_metadata",
      title: "Evidence Metadata",
      summary:
        "Evidence metadata contains references only and no source material.",
      step_ids: [],
      metadata_only: true,
    },
  ].map((section) => OnboardingReportSectionSchema.parse(section));
}

export function buildOnboardingReportFromProgress(
  progress: readonly OnboardingStepProgress[],
): OnboardingReport {
  const parsed = progress.map((item) =>
    OnboardingStepProgressSchema.parse(item),
  );
  const summary = summarizeOnboardingProgress(parsed);
  const blockedSteps =
    getBlockedOnboardingProgress(parsed).map(stepRefFromProgress);
  const deferredSteps =
    getDeferredOnboardingProgress(parsed).map(stepRefFromProgress);
  const warningSteps = getOnboardingProgressByStatus(parsed, "warning").map(
    stepRefFromProgress,
  );
  const skippedSteps = getOnboardingProgressByStatus(parsed, "skipped").map(
    stepRefFromProgress,
  );
  const verdict = determineVerdict(parsed);

  return copyReport(
    OnboardingReportSchema.parse({
      report_version: ONBOARDING_REPORT_VERSION,
      source_progress_model_version: ONBOARDING_PROGRESS_MODEL_VERSION,
      report_id: "phase-20c4-onboarding-report",
      verdict,
      summary,
      blocked_steps: blockedSteps,
      deferred_steps: deferredSteps,
      warning_steps: warningSteps,
      skipped_steps: skippedSteps,
      category_breakdown: buildCategoryBreakdown(parsed),
      gate_dependency_readiness: buildGateDependencyReadiness(parsed),
      remediation_hints: parsed.map((item) => ({
        step_id: item.step_id,
        hint: item.remediation_hint,
        metadata_only: true,
      })),
      readiness_statements: buildReadinessStatements(parsed),
      evidence_metadata: parsed.flatMap((item) => item.evidence),
      sections: buildSections(
        verdict,
        blockedSteps,
        deferredSteps,
        warningSteps,
        skippedSteps,
      ),
      report_generation_only: true,
      phase20c_capability_neutral: true,
      safety_posture: SAFETY_POSTURE,
    }),
  );
}

export function buildInitialOnboardingReport(): OnboardingReport {
  return buildOnboardingReportFromProgress(createInitialOnboardingProgress());
}
