import { describe, expect, it } from "vitest";

import * as onboardingReadiness from "./index";
import {
  ONBOARDING_READINESS_CATEGORIES,
  ONBOARDING_REPORT_VERSION,
  OnboardingReportSchema,
  buildInitialOnboardingReport,
  buildOnboardingReportFromProgress,
  createInitialOnboardingProgress,
  type OnboardingStepProgress,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
] as const;

const FORBIDDEN_FIELD_NAMES = [
  "command",
  "shell_command",
  "install_command",
  "action_payload",
  "provider_payload",
  "raw_payload",
] as const;

function collectKeys(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.flatMap(collectKeys);
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => [
    key,
    ...collectKeys(value),
  ]);
}

function cloneProgress(
  progress: readonly OnboardingStepProgress[],
): OnboardingStepProgress[] {
  return JSON.parse(JSON.stringify(progress)) as OnboardingStepProgress[];
}

function completeNonDeferredProgress(): OnboardingStepProgress[] {
  return cloneProgress(createInitialOnboardingProgress()).map((item) => ({
    ...item,
    status: item.deferred ? ("deferred" as const) : ("complete" as const),
    dependency_statuses: item.dependency_statuses.map((dependency) => ({
      ...dependency,
      status: "complete" as const,
    })),
  }));
}

describe("Phase 20C.4 onboarding report generator", () => {
  it("builds a deterministic typed initial onboarding report", () => {
    const report = buildInitialOnboardingReport();

    expect(OnboardingReportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(buildInitialOnboardingReport()),
    );
    expect(report).toMatchObject({
      report_version: ONBOARDING_REPORT_VERSION,
      source_progress_model_version: "20C.3",
      report_id: "phase-20c4-onboarding-report",
      verdict: "in_progress",
      report_generation_only: true,
      phase20c_capability_neutral: true,
      summary: {
        total_count: 15,
        status_counts: {
          not_started: 13,
          deferred: 2,
        },
      },
    });
  });

  it("builds a report from explicit progress and surfaces blocked, warning, and skipped sections", () => {
    const progress = cloneProgress(createInitialOnboardingProgress());
    progress[0].status = "blocked";
    progress[1].status = "warning";
    progress[2].status = "skipped";
    progress[3].gate_statuses[0].status = "blocked";
    progress[4].dependency_statuses[0].status = "blocked";

    const report = buildOnboardingReportFromProgress(progress);

    expect(report.verdict).toBe("blocked");
    expect(report.blocked_steps.map((step) => step.step_id)).toEqual([
      "onboarding-sequence:clone-repository",
    ]);
    expect(report.warning_steps.map((step) => step.step_id)).toEqual([
      "onboarding-sequence:install-dependencies",
    ]);
    expect(report.skipped_steps.map((step) => step.step_id)).toEqual([
      "onboarding-sequence:prepare-env-file",
    ]);
    expect(report.gate_dependency_readiness).toMatchObject({
      blocked_gate_count: 1,
      blocked_dependency_count: 1,
    });
    expect(
      report.sections.find((section) => section.section_id === "blocked_steps"),
    ).toMatchObject({
      step_ids: ["onboarding-sequence:clone-repository"],
    });
  });

  it("uses deterministic verdict behavior for ready, deferred, warning, and blocked states", () => {
    const readyProgress = cloneProgress(createInitialOnboardingProgress()).map(
      (item) => ({
        ...item,
        status: "complete" as const,
        deferred: false,
        deferred_item_ids: [],
        dependency_statuses: item.dependency_statuses.map((dependency) => ({
          ...dependency,
          status: "complete" as const,
        })),
      }),
    );
    expect(buildOnboardingReportFromProgress(readyProgress).verdict).toBe(
      "ready",
    );

    expect(
      buildOnboardingReportFromProgress(completeNonDeferredProgress()).verdict,
    ).toBe("deferred");

    const warningProgress = completeNonDeferredProgress();
    warningProgress[1].status = "warning";
    expect(buildOnboardingReportFromProgress(warningProgress).verdict).toBe(
      "warning",
    );

    const blockedProgress = completeNonDeferredProgress();
    blockedProgress[1].status = "blocked";
    expect(buildOnboardingReportFromProgress(blockedProgress).verdict).toBe(
      "blocked",
    );
  });

  it("matches category breakdown to supplied progress", () => {
    const progress = completeNonDeferredProgress();
    const report = buildOnboardingReportFromProgress(progress);

    for (const category of ONBOARDING_READINESS_CATEGORIES) {
      const categoryProgress = progress.filter(
        (item) => item.category === category,
      );
      expect(
        report.category_breakdown.find(
          (breakdown) => breakdown.category === category,
        ),
      ).toMatchObject({
        category,
        total_count: categoryProgress.length,
        complete_count: categoryProgress.filter(
          (item) => item.status === "complete",
        ).length,
        deferred_count: categoryProgress.filter((item) => item.deferred).length,
        metadata_only: true,
      });
    }
  });

  it("surfaces remediation hints and source evidence metadata", () => {
    const report = buildInitialOnboardingReport();

    expect(report.remediation_hints).toEqual(
      expect.arrayContaining([
        {
          step_id: "onboarding-sequence:clone-repository",
          hint: "Complete this documented onboarding step manually and verify its gate metadata before treating dependent steps as ready.",
          metadata_only: true,
        },
        {
          step_id: "onboarding-sequence:defer-real-device-onboarding",
          hint: "Deferred by onboarding readiness contract; keep disabled until a future approved architecture update or authority expansion.",
          metadata_only: true,
        },
      ]),
    );
    expect(report.evidence_metadata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence_id: "phase-20c3:progress:onboarding-sequence:run-doctor",
          source_step_id: "onboarding-sequence:run-doctor",
          collected_at: null,
          metadata_only: true,
        }),
      ]),
    );
  });

  it("includes demo, fake-room, first-safe-run, and deferred-scope readiness statements", () => {
    const report = buildInitialOnboardingReport();

    expect(report.readiness_statements.demo_fake_room).toContain("Demo mode");
    expect(report.readiness_statements.demo_fake_room).toContain("fake-room");
    expect(report.readiness_statements.first_safe_run).toContain(
      "approval-governed",
    );
    expect(report.readiness_statements.deferred_real_device).toContain(
      "Real device onboarding",
    );
    expect(
      report.readiness_statements.deferred_wake_word_conversation_mode,
    ).toContain("Wake-word and conversation-mode");
  });

  it("represents deferred real-device and wake-word/conversation-mode posture", () => {
    const report = buildInitialOnboardingReport();

    expect(report.deferred_steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          step_id: "onboarding-sequence:defer-real-device-onboarding",
          status: "deferred",
          deferred: true,
        }),
        expect.objectContaining({
          step_id:
            "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
          status: "deferred",
          deferred: true,
        }),
      ]),
    );
  });

  it("declares no installer, shell, mutation, network, provider, runtime, UI, authority, source material, or capability affordances", () => {
    const report = buildInitialOnboardingReport();

    expect(report.safety_posture.installer_automation_enabled).toBe(false);
    expect(report.safety_posture.shell_execution_enabled).toBe(false);
    expect(report.safety_posture.process_spawn_enabled).toBe(false);
    expect(report.safety_posture.filesystem_mutation_enabled).toBe(false);
    expect(report.safety_posture.network_call_enabled).toBe(false);
    expect(report.safety_posture.provider_call_enabled).toBe(false);
    expect(report.safety_posture.runtime_execution_enabled).toBe(false);
    expect(report.safety_posture.ui_route_created).toBe(false);
    expect(report.safety_posture.approval_bypass_created).toBe(false);
    expect(report.safety_posture.authority_surface_created).toBe(false);
    expect(report.safety_posture.capability_created).toBe(false);
    expect(report.safety_posture.source_material_exposure_enabled).toBe(false);

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(report)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no installer, runtime execution, UI route, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(onboardingReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "buildOnboardingReportFromProgress",
        "buildInitialOnboardingReport",
      ]),
    );
  });
});
