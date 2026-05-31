import { describe, expect, it } from "vitest";

import * as bootstrapReadiness from "./index";
import {
  BOOTSTRAP_CATEGORIES,
  BOOTSTRAP_REQUIREMENT_IDS,
  BOOTSTRAP_VALIDATION_TARGET_IDS,
  DOCTOR_CHECK_IDS,
  DOCTOR_CHECK_REGISTRY,
  DoctorCheckRegistrySchema,
  getBootstrapReadinessContract,
  getDoctorCheckRegistry,
  getDoctorChecksByCategory,
  getRequiredDoctorChecks,
  summarizeDoctorCheckRegistry,
} from "./index";

const REQUIRED_CHECK_IDS = [
  "doctor-check:node-version",
  "doctor-check:package-manager-availability",
  "doctor-check:typescript-tooling",
  "doctor-check:platform-support",
  "doctor-check:required-project-directories",
  "doctor-check:required-config-files",
  "doctor-check:required-env-file-example",
  "doctor-check:required-registries",
  "doctor-check:sqlite-readiness",
  "doctor-check:tauri-readiness",
  "doctor-check:local-first-cloud-gated-posture",
  "doctor-check:disabled-provider-posture",
] as const;

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "bootstrap",
  "run",
  "exec",
  "spawn",
  "mutate",
  "probe",
  "callProvider",
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

describe("Phase 20B.2 doctor check registry", () => {
  it("exposes a typed deterministic metadata-only doctor check registry", () => {
    const registry = getDoctorCheckRegistry();

    expect(DoctorCheckRegistrySchema.safeParse(registry).success).toBe(true);
    expect(registry).toMatchObject({
      registry_version: "20B.2",
      registry_id: "phase-20b2-doctor-check-registry",
      phase: "20B.2",
      source_contract_version: "20B.1",
      categories: [...BOOTSTRAP_CATEGORIES],
      metadata_only: true,
      read_only: true,
      deterministic: true,
      executes_checks: false,
      shell_execution_enabled: false,
      filesystem_inspection_enabled: false,
      process_spawn_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      install_action_enabled: false,
      mutation_enabled: false,
      ui_route_created: false,
      authority_surface_created: false,
      capability_created: false,
    });
  });

  it("is frozen, deterministic, and defensive-copy safe", () => {
    expect(Object.isFrozen(DOCTOR_CHECK_REGISTRY)).toBe(true);
    expect(Object.isFrozen(DOCTOR_CHECK_REGISTRY.checks)).toBe(true);
    expect(Object.isFrozen(DOCTOR_CHECK_REGISTRY.checks[0])).toBe(true);

    expect(JSON.stringify(getDoctorCheckRegistry())).toBe(
      JSON.stringify(getDoctorCheckRegistry()),
    );

    const registry = getDoctorCheckRegistry();
    registry.checks[0].label = "Mutated By Test";
    registry.checks[0].expected_posture.local_first = false;

    expect(getDoctorCheckRegistry().checks[0]).toMatchObject({
      check_id: "doctor-check:node-version",
      label: "Node.js version",
      expected_posture: {
        local_first: true,
      },
    });
  });

  it("represents required doctor categories and checks", () => {
    const registry = getDoctorCheckRegistry();

    expect(registry.checks.map((check) => check.check_id)).toEqual([
      ...DOCTOR_CHECK_IDS,
    ]);

    for (const category of BOOTSTRAP_CATEGORIES) {
      expect(getDoctorChecksByCategory(category).length).toBeGreaterThan(0);
    }

    expect(getRequiredDoctorChecks().map((check) => check.check_id)).toEqual([
      ...REQUIRED_CHECK_IDS,
    ]);
  });

  it("covers fresh-machine bootstrap readiness areas", () => {
    const checks = getDoctorCheckRegistry().checks;

    expect(checks.map((check) => check.check_id)).toEqual([
      "doctor-check:node-version",
      "doctor-check:package-manager-availability",
      "doctor-check:typescript-tooling",
      "doctor-check:platform-support",
      "doctor-check:required-project-directories",
      "doctor-check:required-config-files",
      "doctor-check:required-env-file-example",
      "doctor-check:required-registries",
      "doctor-check:sqlite-readiness",
      "doctor-check:tauri-readiness",
      "doctor-check:ollama-local-model-runtime",
      "doctor-check:voice-runtime-prerequisites",
      "doctor-check:vision-runtime-prerequisites",
      "doctor-check:local-first-cloud-gated-posture",
      "doctor-check:disabled-provider-posture",
    ]);
  });

  it("aligns every check with bootstrap readiness categories and source ids", () => {
    const contract = getBootstrapReadinessContract();
    const sourceRequirementIds = new Set(BOOTSTRAP_REQUIREMENT_IDS);
    const sourceTargetIds = new Set(BOOTSTRAP_VALIDATION_TARGET_IDS);
    const sourceCategories = new Set(contract.categories);

    for (const check of getDoctorCheckRegistry().checks) {
      expect(sourceCategories.has(check.category)).toBe(true);

      for (const requirementId of check.source_requirement_ids) {
        expect(sourceRequirementIds.has(requirementId)).toBe(true);
      }

      for (const targetId of check.source_validation_target_ids) {
        expect(sourceTargetIds.has(targetId)).toBe(true);
      }
    }
  });

  it("declares no execution, install, mutation, provider, network, process, filesystem inspection, UI, authority, or capability behavior", () => {
    for (const check of getDoctorCheckRegistry().checks) {
      expect(check.executes_check).toBe(false);
      expect(check.shell_execution_enabled).toBe(false);
      expect(check.filesystem_inspection_enabled).toBe(false);
      expect(check.process_spawn_enabled).toBe(false);
      expect(check.network_call_enabled).toBe(false);
      expect(check.provider_call_enabled).toBe(false);
      expect(check.install_action_enabled).toBe(false);
      expect(check.mutation_enabled).toBe(false);
      expect(check.ui_route_created).toBe(false);
      expect(check.authority_surface_created).toBe(false);
      expect(check.capability_created).toBe(false);
      expect(check.expected_posture.shell_execution_enabled).toBe(false);
      expect(check.expected_posture.filesystem_inspection_enabled).toBe(false);
      expect(check.expected_posture.process_spawn_enabled).toBe(false);
      expect(check.expected_posture.network_call_enabled).toBe(false);
      expect(check.expected_posture.provider_call_enabled).toBe(false);
      expect(check.expected_posture.install_action_enabled).toBe(false);
      expect(check.expected_posture.mutation_enabled).toBe(false);
    }
  });

  it("represents disabled, cloud-gated, local-first, and provider-disabled posture", () => {
    const checks = getDoctorCheckRegistry().checks;

    expect(checks.every((check) => check.expected_posture.local_first)).toBe(
      true,
    );
    expect(
      checks
        .filter((check) => check.expected_posture.cloud_gated)
        .map((check) => check.check_id),
    ).toEqual([
      "doctor-check:required-env-file-example",
      "doctor-check:required-registries",
      "doctor-check:ollama-local-model-runtime",
      "doctor-check:voice-runtime-prerequisites",
      "doctor-check:vision-runtime-prerequisites",
      "doctor-check:local-first-cloud-gated-posture",
      "doctor-check:disabled-provider-posture",
    ]);
    expect(
      checks
        .filter((check) => check.expected_posture.disabled_by_default)
        .map((check) => check.check_id),
    ).toEqual([
      "doctor-check:required-env-file-example",
      "doctor-check:voice-runtime-prerequisites",
      "doctor-check:vision-runtime-prerequisites",
      "doctor-check:local-first-cloud-gated-posture",
      "doctor-check:disabled-provider-posture",
    ]);
    expect(
      checks.every(
        (check) => check.expected_posture.provider_disabled_by_default,
      ),
    ).toBe(true);
  });

  it("summarizes registry counts from check metadata", () => {
    const checks = getDoctorCheckRegistry().checks;
    const summary = summarizeDoctorCheckRegistry();

    expect(summary).toMatchObject({
      registry_version: "20B.2",
      source_contract_version: "20B.1",
      check_count: checks.length,
      required_check_count: REQUIRED_CHECK_IDS.length,
      category_counts: {
        environment: 4,
        runtime: 5,
        project: 4,
        validation: 2,
      },
      local_first_check_count: checks.length,
      cloud_gated_check_count: 7,
      disabled_by_default_check_count: 5,
      provider_disabled_by_default_check_count: checks.length,
      future_doctor_target_count: checks.length,
      metadata_only: true,
      read_only: true,
      deterministic: true,
      executes_checks: false,
      shell_execution_enabled: false,
      filesystem_inspection_enabled: false,
      process_spawn_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      install_action_enabled: false,
      mutation_enabled: false,
      authority_surface_created: false,
      capability_created: false,
    });
  });

  it("does not expose shell, install, action, provider, or raw payload fields", () => {
    const keys = collectKeys({
      registry: getDoctorCheckRegistry(),
      summary: summarizeDoctorCheckRegistry(),
    });

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(keys).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no runtime check execution affordance names", () => {
    const exportedFunctionNames = Object.entries(bootstrapReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
