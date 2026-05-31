import { describe, expect, it } from "vitest";

import * as bootstrapReadiness from "./index";
import {
  BOOTSTRAP_CATEGORIES,
  BOOTSTRAP_READINESS_CONTRACT,
  BOOTSTRAP_REQUIREMENT_IDS,
  BOOTSTRAP_VALIDATION_TARGET_IDS,
  BootstrapReadinessContractSchema,
  getBootstrapReadinessContract,
  getBootstrapRequirements,
  getBootstrapValidationTargets,
  summarizeBootstrapReadiness,
} from "./index";

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

describe("Phase 20B.1 bootstrap readiness contract", () => {
  it("exposes a typed metadata-only bootstrap readiness contract", () => {
    const contract = getBootstrapReadinessContract();

    expect(BootstrapReadinessContractSchema.safeParse(contract).success).toBe(
      true,
    );
    expect(contract).toMatchObject({
      contract_version: "20B.1",
      contract_id: "phase-20b1-bootstrap-readiness-contract",
      phase: "20B.1",
      categories: [...BOOTSTRAP_CATEGORIES],
      posture: {
        contract_layer_only: true,
        metadata_only: true,
        read_only: true,
        deterministic: true,
        performs_installation: false,
        executes_shell: false,
        mutates_environment: false,
        mutates_filesystem: false,
        calls_network: false,
        contacts_provider: false,
        adds_runtime_hook: false,
        adds_bootstrap_automation: false,
        creates_authority_surface: false,
        creates_capability: false,
      },
    });
  });

  it("is deterministic, frozen, and defensive-copy safe", () => {
    expect(Object.isFrozen(BOOTSTRAP_READINESS_CONTRACT)).toBe(true);
    expect(Object.isFrozen(BOOTSTRAP_READINESS_CONTRACT.requirements)).toBe(
      true,
    );
    expect(
      Object.isFrozen(BOOTSTRAP_READINESS_CONTRACT.validation_targets),
    ).toBe(true);

    expect(JSON.stringify(getBootstrapReadinessContract())).toBe(
      JSON.stringify(getBootstrapReadinessContract()),
    );

    const contract = getBootstrapReadinessContract();
    contract.requirements[0].label = "Mutated By Test";
    contract.validation_targets[0].label = "Mutated Target";

    expect(getBootstrapReadinessContract().requirements[0]).toMatchObject({
      requirement_id: "bootstrap-req:node",
      label: "Node.js runtime",
    });
    expect(getBootstrapReadinessContract().validation_targets[0]).toMatchObject(
      {
        target_id: "bootstrap-validation:node-version",
        label: "Node version expectation",
      },
    );
  });

  it("represents every required bootstrap category", () => {
    const requirements = getBootstrapRequirements();
    const categories = new Set(requirements.map((item) => item.category));

    for (const category of BOOTSTRAP_CATEGORIES) {
      expect(categories.has(category)).toBe(true);
    }

    expect(requirements.map((item) => item.requirement_id)).toEqual([
      ...BOOTSTRAP_REQUIREMENT_IDS,
    ]);
  });

  it("describes environment, runtime, project, and validation prerequisites", () => {
    const requirements = getBootstrapRequirements();

    expect(
      requirements
        .filter((item) => item.category === "environment")
        .map((item) => item.requirement_id),
    ).toEqual([
      "bootstrap-req:node",
      "bootstrap-req:npm-pnpm",
      "bootstrap-req:typescript",
      "bootstrap-req:platform-support",
    ]);
    expect(
      requirements
        .filter((item) => item.category === "runtime")
        .map((item) => item.requirement_id),
    ).toEqual([
      "bootstrap-req:ollama",
      "bootstrap-req:local-model-runtime",
      "bootstrap-req:sqlite",
      "bootstrap-req:tauri",
      "bootstrap-req:voice-runtime-prerequisites",
      "bootstrap-req:vision-runtime-prerequisites",
    ]);
    expect(
      requirements
        .filter((item) => item.category === "project")
        .map((item) => item.requirement_id),
    ).toEqual([
      "bootstrap-req:required-directories",
      "bootstrap-req:required-config-files",
      "bootstrap-req:required-env-files",
      "bootstrap-req:required-registries",
    ]);
    expect(
      requirements
        .filter((item) => item.category === "validation")
        .map((item) => item.requirement_id),
    ).toEqual([
      "bootstrap-req:readiness-checks",
      "bootstrap-req:doctor-integration-targets",
      "bootstrap-req:verification-expectations",
    ]);
  });

  it("represents validation targets and doctor integration targets", () => {
    const targets = getBootstrapValidationTargets();

    expect(targets.map((target) => target.target_id)).toEqual([
      ...BOOTSTRAP_VALIDATION_TARGET_IDS,
    ]);

    const doctorTargets = targets.filter(
      (target) => target.doctor_integration_target,
    );
    expect(doctorTargets.map((target) => target.target_id)).toEqual([
      "bootstrap-validation:node-version",
      "bootstrap-validation:package-manager",
      "bootstrap-validation:platform-family",
      "bootstrap-validation:ollama-local-runtime",
      "bootstrap-validation:tauri-toolchain",
      "bootstrap-validation:voice-local-prerequisites",
      "bootstrap-validation:vision-local-prerequisites",
      "bootstrap-validation:env-safe-defaults",
      "bootstrap-validation:doctor-readiness",
    ]);

    for (const target of targets) {
      expect(target.executes_check).toBe(false);
      expect(target.shell_command_included).toBe(false);
      expect(target.installs_dependency).toBe(false);
      expect(target.mutates_environment).toBe(false);
      expect(target.mutates_filesystem).toBe(false);
      expect(target.calls_network).toBe(false);
      expect(target.contacts_provider).toBe(false);
    }
  });

  it("captures disabled-by-default, local-first, and cloud-gated posture", () => {
    const requirements = getBootstrapRequirements();

    expect(
      requirements
        .filter((item) => item.disabled_by_default)
        .map((item) => item.requirement_id),
    ).toEqual([
      "bootstrap-req:voice-runtime-prerequisites",
      "bootstrap-req:vision-runtime-prerequisites",
      "bootstrap-req:required-env-files",
    ]);
    expect(requirements.every((item) => item.local_first)).toBe(true);
    expect(
      requirements
        .filter((item) => item.cloud_gated)
        .map((item) => item.requirement_id),
    ).toEqual([
      "bootstrap-req:local-model-runtime",
      "bootstrap-req:voice-runtime-prerequisites",
      "bootstrap-req:vision-runtime-prerequisites",
      "bootstrap-req:required-env-files",
      "bootstrap-req:required-registries",
    ]);
  });

  it("summarizes readiness counts from the contract", () => {
    const requirements = getBootstrapRequirements();
    const targets = getBootstrapValidationTargets();
    const summary = summarizeBootstrapReadiness();

    expect(summary).toMatchObject({
      contract_version: "20B.1",
      requirement_count: requirements.length,
      validation_target_count: targets.length,
      category_counts: {
        environment: 4,
        runtime: 6,
        project: 4,
        validation: 3,
      },
      required_count: 12,
      optional_count: 2,
      disabled_by_default_count: 3,
      local_first_count: requirements.length,
      cloud_gated_count: 5,
      doctor_integration_target_count: 9,
      metadata_only: true,
      read_only: true,
      deterministic: true,
      installation_executed: false,
      shell_invocation_enabled: false,
      filesystem_mutation_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      runtime_hook_enabled: false,
      authority_surface_created: false,
      capability_created: false,
    });
  });

  it("contains no execution hooks, shell or install actions, mutation affordances, provider/network side effects, or capability creation", () => {
    for (const requirement of getBootstrapRequirements()) {
      expect(requirement.installation_executed).toBe(false);
      expect(requirement.shell_invocation_enabled).toBe(false);
      expect(requirement.filesystem_mutation_enabled).toBe(false);
      expect(requirement.network_call_enabled).toBe(false);
      expect(requirement.provider_call_enabled).toBe(false);
      expect(requirement.runtime_hook_enabled).toBe(false);
      expect(requirement.authority_surface_created).toBe(false);
      expect(requirement.capability_created).toBe(false);
    }

    const contract = getBootstrapReadinessContract();
    expect(contract.posture.performs_installation).toBe(false);
    expect(contract.posture.executes_shell).toBe(false);
    expect(contract.posture.adds_bootstrap_automation).toBe(false);
    expect(contract.posture.creates_capability).toBe(false);
  });

  it("does not expose shell command, install command, or action payload fields", () => {
    const keys = collectKeys({
      contract: getBootstrapReadinessContract(),
      summary: summarizeBootstrapReadiness(),
    });

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(keys).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no execution, install, mutation, or provider affordance names", () => {
    const exportedFunctionNames = Object.entries(bootstrapReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
