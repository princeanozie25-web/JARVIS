import { describe, expect, it } from "vitest";

import * as onboardingReadiness from "./index";
import {
  ONBOARDING_DEFERRED_ITEM_IDS,
  ONBOARDING_GATE_IDS,
  ONBOARDING_READINESS_CATEGORIES,
  ONBOARDING_READINESS_CONTRACT,
  ONBOARDING_STEP_IDS,
  OnboardingReadinessContractSchema,
  getDeferredOnboardingItems,
  getOnboardingGates,
  getOnboardingReadinessContract,
  getOnboardingSteps,
  summarizeOnboardingReadiness,
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

describe("Phase 20C.1 onboarding readiness contract", () => {
  it("exposes a typed deterministic metadata-only onboarding contract", () => {
    const contract = getOnboardingReadinessContract();

    expect(OnboardingReadinessContractSchema.safeParse(contract).success).toBe(
      true,
    );
    expect(JSON.stringify(contract)).toBe(
      JSON.stringify(getOnboardingReadinessContract()),
    );
    expect(contract).toMatchObject({
      contract_version: "20C.1",
      contract_id: "phase-20c1-onboarding-readiness-contract",
      phase: "20C.1",
      categories: [...ONBOARDING_READINESS_CATEGORIES],
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
    expect(Object.isFrozen(ONBOARDING_READINESS_CONTRACT)).toBe(true);
    expect(Object.isFrozen(ONBOARDING_READINESS_CONTRACT.steps)).toBe(true);
    expect(Object.isFrozen(ONBOARDING_READINESS_CONTRACT.gates)).toBe(true);
    expect(Object.isFrozen(ONBOARDING_READINESS_CONTRACT.deferred_items)).toBe(
      true,
    );

    const contract = getOnboardingReadinessContract();
    contract.steps[0].label = "Mutated By Test";
    contract.gates[0].label = "Mutated Gate";
    contract.deferred_items[0].label = "Mutated Deferred";

    expect(getOnboardingReadinessContract().steps[0]).toMatchObject({
      step_id: "onboarding-step:clone-readiness",
      label: "Clone readiness",
    });
    expect(getOnboardingReadinessContract().gates[0]).toMatchObject({
      gate_id: "onboarding-gate:phase-20a-governance-ready",
      label: "Phase 20A governance ready",
    });
    expect(getOnboardingReadinessContract().deferred_items[0]).toMatchObject({
      deferred_item_id: "onboarding-deferred:real-device-onboarding",
      label: "Real device onboarding",
    });
  });

  it("represents required onboarding categories and ordered steps", () => {
    const steps = getOnboardingSteps();
    const categories = new Set([
      ...steps.map((step) => step.category),
      ...getDeferredOnboardingItems().map((item) => item.category),
    ]);

    for (const category of ONBOARDING_READINESS_CATEGORIES) {
      expect(categories.has(category)).toBe(true);
    }

    expect(steps.map((step) => step.step_id)).toEqual([...ONBOARDING_STEP_IDS]);
    expect(steps.map((step) => step.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("represents onboarding gates", () => {
    const gates = getOnboardingGates();

    expect(gates.map((gate) => gate.gate_id)).toEqual([...ONBOARDING_GATE_IDS]);
    expect(gates.every((gate) => gate.satisfied_by_contract)).toBe(true);
    expect(gates.flatMap((gate) => gate.evidence_ids)).toEqual(
      expect.arrayContaining([
        "phase-20a-final-readiness-layer-closeout",
        "phase-20b-bootstrap-readiness-closeout",
        "phase-20b7:doctor-cli-adapter",
        "phase-18:approval-gated-execution-layer",
      ]),
    );
  });

  it("represents deferred real-device and wake-word posture", () => {
    const deferredItems = getDeferredOnboardingItems();

    expect(deferredItems.map((item) => item.deferred_item_id)).toEqual([
      ...ONBOARDING_DEFERRED_ITEM_IDS,
    ]);
    expect(deferredItems.every((item) => item.remains_disabled)).toBe(true);
    expect(
      deferredItems
        .filter((item) => item.architecture_amendment_required)
        .map((item) => item.deferred_item_id),
    ).toEqual([
      "onboarding-deferred:wake-word",
      "onboarding-deferred:conversation-mode-architecture-amendment",
    ]);
    expect(
      deferredItems.find(
        (item) =>
          item.deferred_item_id ===
          "onboarding-deferred:real-device-onboarding",
      ),
    ).toMatchObject({
      future_phase_posture: "deferred_to_later_phase_with_approval_governance",
    });
  });

  it("summarizes onboarding readiness from the contract", () => {
    const summary = summarizeOnboardingReadiness();

    expect(summary).toMatchObject({
      contract_version: "20C.1",
      step_count: 12,
      gate_count: 6,
      deferred_item_count: 5,
      category_counts: {
        clone: 1,
        dependencies: 1,
        environment: 1,
        doctor: 1,
        demo: 1,
        fake_room: 1,
        local_model: 1,
        voice: 3,
        vision: 1,
        command_center: 2,
        packaging: 1,
        deferred: 3,
      },
      local_first_step_count: 12,
      cloud_gated_step_count: 4,
      disabled_by_default_step_count: 4,
      approval_guarded_step_count: 5,
      architecture_amendment_deferred_count: 2,
      phase20c_contract_only: true,
      phase20c_capability_neutral: true,
    });
  });

  it("declares no installer, shell, mutation, network, provider, runtime, UI, approval-bypass, authority, or capability affordances", () => {
    const contract = getOnboardingReadinessContract();
    const summary = summarizeOnboardingReadiness();

    for (const posture of [
      contract.safety_posture,
      summary.safety_posture,
      ...contract.steps.map((step) => step.safety_posture),
      ...contract.gates.map((gate) => gate.safety_posture),
      ...contract.deferred_items.map((item) => item.safety_posture),
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
      expect(collectKeys({ contract, summary })).not.toContain(
        forbiddenFieldName,
      );
    }
  });

  it("exports no UI route, installer, runtime execution, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(onboardingReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "getDeferredOnboardingItems",
        "getOnboardingGates",
        "getOnboardingReadinessContract",
        "getOnboardingSteps",
        "summarizeOnboardingReadiness",
      ]),
    );
  });
});
