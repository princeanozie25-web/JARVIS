import { describe, expect, it } from "vitest";

import * as onboardingReadiness from "./index";
import {
  ONBOARDING_DEFERRED_ITEM_IDS,
  ONBOARDING_GATE_IDS,
  ONBOARDING_READINESS_CATEGORIES,
  ONBOARDING_STEP_IDS,
  ONBOARDING_STEP_RECORD_IDS,
  ONBOARDING_STEP_REGISTRY,
  ONBOARDING_STEP_REGISTRY_VERSION,
  OnboardingStepRegistrySchema,
  getBlockingOnboardingSteps,
  getDeferredOnboardingSteps,
  getOnboardingStepRegistry,
  getOnboardingStepsByCategory,
  summarizeOnboardingStepRegistry,
} from "./index";

const REQUIRED_STEP_IDS = [
  "onboarding-sequence:clone-repository",
  "onboarding-sequence:install-dependencies",
  "onboarding-sequence:prepare-env-file",
  "onboarding-sequence:run-doctor",
  "onboarding-sequence:run-tests",
  "onboarding-sequence:start-dev-runtime",
  "onboarding-sequence:open-command-center",
  "onboarding-sequence:enable-demo-mode",
  "onboarding-sequence:verify-fake-room",
  "onboarding-sequence:verify-local-model-readiness",
  "onboarding-sequence:verify-voice-readiness",
  "onboarding-sequence:verify-vision-readiness",
  "onboarding-sequence:verify-first-safe-run",
  "onboarding-sequence:defer-real-device-onboarding",
  "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
] as const;

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

describe("Phase 20C.2 onboarding step registry", () => {
  it("exposes a typed deterministic metadata-only step registry", () => {
    const registry = getOnboardingStepRegistry();

    expect(OnboardingStepRegistrySchema.safeParse(registry).success).toBe(true);
    expect(JSON.stringify(registry)).toBe(
      JSON.stringify(getOnboardingStepRegistry()),
    );
    expect(registry).toMatchObject({
      registry_version: ONBOARDING_STEP_REGISTRY_VERSION,
      source_contract_version: "20C.1",
      registry_id: "phase-20c2-onboarding-step-registry",
      phase: "20C.2",
      safety_posture: {
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
      },
    });
  });

  it("is frozen and returns defensive copies", () => {
    expect(Object.isFrozen(ONBOARDING_STEP_REGISTRY)).toBe(true);
    expect(Object.isFrozen(ONBOARDING_STEP_REGISTRY.steps)).toBe(true);
    expect(Object.isFrozen(ONBOARDING_STEP_REGISTRY.steps[0])).toBe(true);

    const registry = getOnboardingStepRegistry();
    registry.steps[0].title = "Mutated By Test";
    registry.steps[0].safety_notes.push("mutation");

    const cloneStep = getOnboardingStepRegistry().steps[0];
    expect(cloneStep).toMatchObject({
      step_id: "onboarding-sequence:clone-repository",
      title: "Clone repository",
      safety_notes: [
        "This record documents clone readiness only and does not create clone automation.",
      ],
    });
  });

  it("represents the required onboarding sequence with stable unique ordering", () => {
    const steps = getOnboardingStepRegistry().steps;

    expect(steps.map((step) => step.step_id)).toEqual([...REQUIRED_STEP_IDS]);
    expect(steps.map((step) => step.step_id)).toEqual([
      ...ONBOARDING_STEP_RECORD_IDS,
    ]);
    expect(steps.map((step) => step.sequence_order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
    expect(new Set(steps.map((step) => step.sequence_order)).size).toBe(
      steps.length,
    );
  });

  it("references only known gates, dependencies, source contract steps, and deferred ids", () => {
    const steps = getOnboardingStepRegistry().steps;
    const stepIds = new Set(steps.map((step) => step.step_id));
    const sequenceByStepId = new Map(
      steps.map((step) => [step.step_id, step.sequence_order]),
    );

    for (const step of steps) {
      for (const gateId of step.gate_ids) {
        expect([...ONBOARDING_GATE_IDS]).toContain(gateId);
      }

      for (const dependencyStepId of step.dependency_step_ids) {
        expect(stepIds.has(dependencyStepId)).toBe(true);
        expect(sequenceByStepId.get(dependencyStepId)).toBeLessThan(
          step.sequence_order,
        );
      }

      for (const contractStepId of step.source_contract_step_ids) {
        expect([...ONBOARDING_STEP_IDS]).toContain(contractStepId);
      }

      for (const deferredItemId of step.deferred_item_ids) {
        expect([...ONBOARDING_DEFERRED_ITEM_IDS]).toContain(deferredItemId);
      }
    }
  });

  it("groups blocking and deferred onboarding steps", () => {
    expect(getBlockingOnboardingSteps().map((step) => step.step_id)).toEqual([
      "onboarding-sequence:clone-repository",
      "onboarding-sequence:install-dependencies",
      "onboarding-sequence:prepare-env-file",
      "onboarding-sequence:run-doctor",
      "onboarding-sequence:run-tests",
      "onboarding-sequence:start-dev-runtime",
      "onboarding-sequence:open-command-center",
      "onboarding-sequence:verify-first-safe-run",
    ]);

    expect(getDeferredOnboardingSteps().map((step) => step.step_id)).toEqual([
      "onboarding-sequence:defer-real-device-onboarding",
      "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
    ]);
    expect(
      getOnboardingStepsByCategory("voice").map((step) => step.step_id),
    ).toEqual([
      "onboarding-sequence:verify-voice-readiness",
      "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
    ]);
  });

  it("represents deferred real-device and wake-word/conversation-mode posture", () => {
    const deferredSteps = getDeferredOnboardingSteps();

    expect(
      deferredSteps.find(
        (step) =>
          step.step_id === "onboarding-sequence:defer-real-device-onboarding",
      ),
    ).toMatchObject({
      deferred: true,
      blocking_posture: "deferred",
      deferred_item_ids: ["onboarding-deferred:real-device-onboarding"],
    });
    expect(
      deferredSteps.find(
        (step) =>
          step.step_id ===
          "onboarding-sequence:defer-wake-word-conversation-mode-amendment",
      ),
    ).toMatchObject({
      deferred: true,
      blocking_posture: "deferred",
      deferred_item_ids: [
        "onboarding-deferred:wake-word",
        "onboarding-deferred:conversation-mode-architecture-amendment",
      ],
    });
  });

  it("summarizes the registry with counts that match the records", () => {
    const registry = getOnboardingStepRegistry();
    const summary = summarizeOnboardingStepRegistry();

    expect(summary).toMatchObject({
      registry_version: "20C.2",
      step_count: 15,
      blocking_step_count: 8,
      non_blocking_step_count: 5,
      deferred_step_count: 2,
      category_counts: {
        clone: 1,
        dependencies: 1,
        environment: 1,
        doctor: 2,
        demo: 1,
        fake_room: 1,
        local_model: 1,
        voice: 2,
        vision: 1,
        command_center: 2,
        packaging: 1,
        deferred: 1,
      },
      phase20c_step_registry_only: true,
      phase20c_capability_neutral: true,
    });
    expect(summary.step_count).toBe(registry.steps.length);
    expect(summary.gate_reference_count).toBe(
      registry.steps.reduce((count, step) => count + step.gate_ids.length, 0),
    );
    expect(summary.dependency_reference_count).toBe(
      registry.steps.reduce(
        (count, step) => count + step.dependency_step_ids.length,
        0,
      ),
    );

    for (const category of ONBOARDING_READINESS_CATEGORIES) {
      expect(summary.category_counts[category]).toBe(
        registry.steps.filter((step) => step.category === category).length,
      );
    }
  });

  it("declares no installer, shell, mutation, network, provider, runtime, UI, authority, or capability affordances", () => {
    const registry = getOnboardingStepRegistry();
    const summary = summarizeOnboardingStepRegistry();

    for (const posture of [
      registry.safety_posture,
      summary.safety_posture,
      ...registry.steps.map((step) => step.safety_posture),
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

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys({ registry, summary })).not.toContain(
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
        "getOnboardingStepRegistry",
        "getOnboardingStepsByCategory",
        "getBlockingOnboardingSteps",
        "getDeferredOnboardingSteps",
        "summarizeOnboardingStepRegistry",
      ]),
    );
  });
});
