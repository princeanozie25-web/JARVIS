import { describe, expect, it } from "vitest";

import * as onboardingReadiness from "./index";
import {
  ONBOARDING_PROGRESS_MODEL_VERSION,
  ONBOARDING_PROGRESS_STATUSES,
  ONBOARDING_STEP_RECORD_IDS,
  OnboardingStepProgressSchema,
  createInitialOnboardingProgress,
  getBlockedOnboardingProgress,
  getDeferredOnboardingProgress,
  getOnboardingProgressByStatus,
  getOnboardingStepRegistry,
  summarizeOnboardingProgress,
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

describe("Phase 20C.3 onboarding progress model", () => {
  it("creates deterministic initial progress for every onboarding step", () => {
    const progress = createInitialOnboardingProgress();

    expect(progress.map((item) => item.step_id)).toEqual([
      ...ONBOARDING_STEP_RECORD_IDS,
    ]);
    expect(
      progress.every((item) => item.progress_model_version === "20C.3"),
    ).toBe(true);
    expect(JSON.stringify(progress)).toBe(
      JSON.stringify(createInitialOnboardingProgress()),
    );

    for (const item of progress) {
      expect(OnboardingStepProgressSchema.safeParse(item).success).toBe(true);
    }
  });

  it("returns defensive copies", () => {
    const progress = createInitialOnboardingProgress();
    progress[0].status = "complete";
    progress[0].gate_statuses[0].status = "blocked";
    progress[0].evidence[0].source_reference = "mutated";

    const fresh = createInitialOnboardingProgress()[0];
    expect(fresh).toMatchObject({
      step_id: "onboarding-sequence:clone-repository",
      status: "not_started",
      gate_statuses: [
        {
          gate_id: "onboarding-gate:phase-20b-bootstrap-ready",
          status: "ready",
        },
      ],
      evidence: [
        {
          source_reference: "README clone and local workspace reference",
          metadata_only: true,
        },
      ],
    });
  });

  it("supports every progress status in summaries and status filtering", () => {
    const statuses = [...ONBOARDING_PROGRESS_STATUSES];
    const progress = cloneProgress(createInitialOnboardingProgress()).map(
      (item, index) => ({
        ...item,
        status: statuses[index % statuses.length],
      }),
    );
    const summary = summarizeOnboardingProgress(progress);

    for (const status of statuses) {
      expect(summary.status_counts[status]).toBe(
        progress.filter((item) => item.status === status).length,
      );
      expect(getOnboardingProgressByStatus(progress, status)).toEqual(
        progress.filter((item) => item.status === status),
      );
    }
  });

  it("classifies blocked and deferred progress from supplied metadata", () => {
    const progress = cloneProgress(createInitialOnboardingProgress());
    progress[0].status = "blocked";
    progress[1].status = "warning";
    progress[2].status = "skipped";

    expect(
      getBlockedOnboardingProgress(progress).map((item) => item.step_id),
    ).toEqual(["onboarding-sequence:clone-repository"]);
    expect(
      getDeferredOnboardingProgress(progress).map((item) => item.step_id),
    ).toEqual([
      "onboarding-sequence:defer-real-device-onboarding",
      "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
    ]);

    expect(summarizeOnboardingProgress(progress)).toMatchObject({
      blocked_count: 1,
      warning_count: 1,
      deferred_count: 2,
    });
  });

  it("summarizes initial progress with counts that match the registry", () => {
    const progress = createInitialOnboardingProgress();
    const registry = getOnboardingStepRegistry();
    const summary = summarizeOnboardingProgress(progress);

    expect(summary).toMatchObject({
      progress_model_version: ONBOARDING_PROGRESS_MODEL_VERSION,
      total_count: 15,
      status_counts: {
        not_started: 13,
        ready: 0,
        blocked: 0,
        warning: 0,
        skipped: 0,
        deferred: 2,
        complete: 0,
      },
      blocking_count: 8,
      non_blocking_count: 5,
      deferred_count: 2,
      blocked_count: 0,
      warning_count: 0,
      complete_count: 0,
      phase20c_progress_model_only: true,
      phase20c_capability_neutral: true,
    });
    expect(summary.total_count).toBe(registry.steps.length);
    expect(summary.gate_status_count).toBe(
      progress.reduce((count, item) => count + item.gate_statuses.length, 0),
    );
    expect(summary.dependency_status_count).toBe(
      progress.reduce(
        (count, item) => count + item.dependency_statuses.length,
        0,
      ),
    );
    expect(summary.evidence_count).toBe(progress.length);
  });

  it("represents gate, dependency, and evidence metadata without observations", () => {
    const progress = createInitialOnboardingProgress();
    const runDoctor = progress.find(
      (item) => item.step_id === "onboarding-sequence:run-doctor",
    );
    const openCommandCenter = progress.find(
      (item) => item.step_id === "onboarding-sequence:open-command-center",
    );

    expect(runDoctor).toMatchObject({
      gate_statuses: [
        {
          gate_id: "onboarding-gate:phase-20b-bootstrap-ready",
          status: "ready",
          metadata_only: true,
        },
        {
          gate_id: "onboarding-gate:doctor-cli-report-available",
          status: "ready",
          metadata_only: true,
        },
      ],
      dependency_statuses: [
        {
          dependency_step_id: "onboarding-sequence:prepare-env-file",
          status: "not_started",
          metadata_only: true,
        },
      ],
    });
    expect(openCommandCenter?.evidence[0]).toMatchObject({
      evidence_id:
        "phase-20c3:progress:onboarding-sequence:open-command-center",
      collected_at: null,
      metadata_only: true,
    });
  });

  it("represents deferred real-device and wake-word/conversation-mode progress", () => {
    const deferredProgress = getDeferredOnboardingProgress(
      createInitialOnboardingProgress(),
    );

    expect(deferredProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          step_id: "onboarding-sequence:defer-real-device-onboarding",
          status: "deferred",
          deferred: true,
          deferred_item_ids: ["onboarding-deferred:real-device-onboarding"],
        }),
        expect.objectContaining({
          step_id:
            "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
          status: "deferred",
          deferred: true,
          deferred_item_ids: [
            "onboarding-deferred:wake-word",
            "onboarding-deferred:conversation-mode-architecture-amendment",
          ],
        }),
      ]),
    );
  });

  it("declares no installer, shell, mutation, network, provider, runtime, UI, authority, source material, or capability affordances", () => {
    const progress = createInitialOnboardingProgress();
    const summary = summarizeOnboardingProgress(progress);

    for (const posture of [
      summary.safety_posture,
      ...progress.map((item) => item.safety_posture),
    ]) {
      expect(posture.installer_automation_enabled).toBe(false);
      expect(posture.shell_execution_enabled).toBe(false);
      expect(posture.process_spawn_enabled).toBe(false);
      expect(posture.filesystem_mutation_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.ui_route_created).toBe(false);
      expect(posture.approval_bypass_created).toBe(false);
      expect(posture.authority_surface_created).toBe(false);
      expect(posture.capability_created).toBe(false);
      expect(posture.source_material_exposure_enabled).toBe(false);
    }

    for (const evidence of progress.flatMap((item) => item.evidence)) {
      expect(evidence.metadata_only).toBe(true);
      expect(evidence.collected_at).toBeNull();
    }

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys({ progress, summary })).not.toContain(
        forbiddenFieldName,
      );
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
        "createInitialOnboardingProgress",
        "summarizeOnboardingProgress",
        "getOnboardingProgressByStatus",
        "getBlockedOnboardingProgress",
        "getDeferredOnboardingProgress",
      ]),
    );
  });
});
