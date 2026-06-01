import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  FINAL_HARDENING_CONTRACT,
  FinalHardeningContractSchema,
  HARDENING_DIMENSION_IDS,
  HARDENING_EXPECTATION_IDS,
  HARDENING_FAILURE_MODE_IDS,
  HARDENING_RECOVERY_POSTURES,
  HARDENING_SURFACE_IDS,
  getFinalHardeningContract,
  getHardeningExpectations,
  getHardeningFailureModes,
  getHardeningSurfaces,
  summarizeFinalHardeningContract,
} from "./index";

const REQUIRED_SURFACE_IDS = [
  "hardening-surface:model-runtime-unavailable",
  "hardening-surface:provider-disabled-misconfigured",
  "hardening-surface:sqlite-event-store-unavailable",
  "hardening-surface:projection-read-failure",
  "hardening-surface:tauri-command-center-startup-failure",
  "hardening-surface:doctor-bootstrap-failure",
  "hardening-surface:onboarding-demo-readiness-failure",
  "hardening-surface:voice-runtime-unavailable",
  "hardening-surface:vision-runtime-unavailable",
  "hardening-surface:room-adapter-unavailable",
  "hardening-surface:fake-room-failure",
  "hardening-surface:scheduler-stalled-disabled",
  "hardening-surface:approval-runtime-unavailable",
  "hardening-surface:red-team-sandbox-disabled-misconfigured",
  "hardening-surface:telemetry-audit-report-unavailable",
  "hardening-surface:packaging-build-failure",
  "hardening-surface:configuration-missing-invalid",
  "hardening-surface:environment-unsupported",
  "hardening-surface:disk-memory-constraints",
  "hardening-surface:local-first-fallback-posture",
  "hardening-surface:cloud-provider-opt-in-gated",
] as const;

const REQUIRED_DIMENSION_IDS = [
  "hardening-dimension:failure-mode",
  "hardening-dimension:fallback-behavior",
  "hardening-dimension:user-visible-error-posture",
  "hardening-dimension:audit-log-posture",
  "hardening-dimension:safe-default",
  "hardening-dimension:disabled-deferred-posture",
  "hardening-dimension:recovery-guidance",
  "hardening-dimension:blocking-severity",
] as const;

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
  "executeHardening",
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

describe("Phase 20F.1 final hardening contract", () => {
  it("exposes a deterministic typed metadata-only hardening contract", () => {
    const contract = getFinalHardeningContract();

    expect(FinalHardeningContractSchema.safeParse(contract).success).toBe(true);
    expect(JSON.stringify(contract)).toBe(
      JSON.stringify(getFinalHardeningContract()),
    );
    expect(contract).toMatchObject({
      contract_version: "20F.1",
      contract_id: "phase-20f1-final-hardening-contract",
      phase: "20F.1",
      posture: {
        contract_only: true,
        metadata_only: true,
        read_only: true,
        deterministic: true,
        hardening_execution_enabled: false,
        filesystem_inspection_enabled: false,
        runtime_execution_enabled: false,
        provider_call_enabled: false,
        network_call_enabled: false,
        shell_process_execution_enabled: false,
        ui_route_created: false,
        approval_bypass_created: false,
        authority_surface_created: false,
        capability_created: false,
        source_material_exposure_enabled: false,
      },
    });
  });

  it("is frozen and returns defensive copies", () => {
    expect(Object.isFrozen(FINAL_HARDENING_CONTRACT)).toBe(true);
    expect(Object.isFrozen(FINAL_HARDENING_CONTRACT.surfaces)).toBe(true);
    expect(Object.isFrozen(FINAL_HARDENING_CONTRACT.surfaces[0])).toBe(true);
    expect(Object.isFrozen(FINAL_HARDENING_CONTRACT.failure_modes)).toBe(true);

    const contract = getFinalHardeningContract();
    contract.surfaces[0].label = "Mutated";
    contract.surfaces[0].recovery_guidance.push("mutation");
    contract.failure_modes[0].label = "Mutated";
    contract.expectations[0].verification_guidance.push("mutation");

    expect(getFinalHardeningContract().surfaces[0]).toMatchObject({
      surface_id: "hardening-surface:model-runtime-unavailable",
      label: "Model runtime unavailable",
    });
    expect(getHardeningFailureModes()[0]).toMatchObject({
      failure_mode_id: "hardening-failure-mode:model-runtime-unavailable",
      label: "Model runtime unavailable",
    });
    expect(getHardeningExpectations()[0].verification_guidance).toEqual([
      "failure-mode metadata",
      "surface coverage metadata",
    ]);
  });

  it("represents every required hardening surface and failure mode", () => {
    const surfaces = getHardeningSurfaces();
    const failureModes = getHardeningFailureModes();
    const failureModeIds = new Set(
      failureModes.map((failureMode) => failureMode.failure_mode_id),
    );

    expect(surfaces.map((surface) => surface.surface_id)).toEqual([
      ...REQUIRED_SURFACE_IDS,
    ]);
    expect(surfaces.map((surface) => surface.surface_id)).toEqual([
      ...HARDENING_SURFACE_IDS,
    ]);
    expect(
      failureModes.map((failureMode) => failureMode.failure_mode_id),
    ).toEqual([...HARDENING_FAILURE_MODE_IDS]);

    for (const surface of surfaces) {
      expect(failureModeIds.has(surface.failure_mode_id)).toBe(true);
      expect(surface.dimension_ids).toEqual([...HARDENING_DIMENSION_IDS]);
      expect(surface.expectation_ids).toEqual([...HARDENING_EXPECTATION_IDS]);
    }
  });

  it("represents every required hardening dimension and expectation", () => {
    const contract = getFinalHardeningContract();
    const expectations = getHardeningExpectations();
    const expectationIds = new Set(
      expectations.map((expectation) => expectation.expectation_id),
    );

    expect(
      contract.dimensions.map((dimension) => dimension.dimension_id),
    ).toEqual([...REQUIRED_DIMENSION_IDS]);
    expect(
      contract.dimensions.map((dimension) => dimension.dimension_id),
    ).toEqual([...HARDENING_DIMENSION_IDS]);
    expect(
      expectations.map((expectation) => expectation.expectation_id),
    ).toEqual([...HARDENING_EXPECTATION_IDS]);

    for (const dimension of contract.dimensions) {
      expect(expectationIds.has(dimension.expectation_id)).toBe(true);
    }
    expect(
      expectations.every((expectation) => expectation.future_hardening_only),
    ).toBe(true);
  });

  it("represents fallback, safe-default, disabled/deferred, and recovery posture", () => {
    const surfaces = getHardeningSurfaces();
    const recoveryPostures = new Set(
      surfaces.map((surface) => surface.recovery_posture),
    );

    for (const surface of surfaces) {
      expect(surface.fallback_behavior.length).toBeGreaterThan(0);
      expect(surface.user_visible_error_posture.length).toBeGreaterThan(0);
      expect(surface.audit_log_posture).toContain("metadata-only");
      expect(surface.safe_default.length).toBeGreaterThan(0);
      expect(surface.disabled_deferred_posture.length).toBeGreaterThan(0);
      expect(surface.recovery_guidance.length).toBeGreaterThan(0);
    }

    expect([...recoveryPostures].sort()).toEqual(
      [...HARDENING_RECOVERY_POSTURES].sort(),
    );
  });

  it("summarizes the hardening contract consistently", () => {
    const contract = getFinalHardeningContract();
    const summary = summarizeFinalHardeningContract();

    expect(summary).toMatchObject({
      contract_version: "20F.1",
      surface_count: 21,
      failure_mode_count: 21,
      dimension_count: 8,
      expectation_count: 8,
      critical_surface_count: 8,
      high_surface_count: 6,
      medium_surface_count: 7,
      low_surface_count: 0,
      recovery_posture_count: 6,
      safe_default_surface_count: 21,
      fallback_surface_count: 21,
      phase20f_contract_only: true,
      phase20f_capability_neutral: true,
    });
    expect(summary.surface_count).toBe(contract.surfaces.length);
    expect(summary.failure_mode_count).toBe(contract.failure_modes.length);
    expect(summary.dimension_count).toBe(contract.dimensions.length);
    expect(summary.expectation_count).toBe(contract.expectations.length);
  });

  it("declares no hardening execution, filesystem, runtime, provider, network, process, UI, authority, source material, or capability affordances", () => {
    const contract = getFinalHardeningContract();
    const summary = summarizeFinalHardeningContract();

    for (const posture of [
      contract.posture,
      summary.posture,
      ...contract.surfaces.map((surface) => surface.posture),
      ...contract.failure_modes.map((failureMode) => failureMode.posture),
      ...contract.dimensions.map((dimension) => dimension.posture),
      ...contract.expectations.map((expectation) => expectation.posture),
    ]) {
      expect(posture.hardening_execution_enabled).toBe(false);
      expect(posture.filesystem_inspection_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
      expect(posture.shell_process_execution_enabled).toBe(false);
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

  it("exports no hardening execution, UI route, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalHardening)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining([
        "getFinalHardeningContract",
        "getHardeningSurfaces",
        "getHardeningFailureModes",
        "getHardeningExpectations",
        "summarizeFinalHardeningContract",
      ]),
    );
  });
});
