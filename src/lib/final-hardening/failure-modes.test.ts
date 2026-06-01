import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  FAILURE_MODE_BLOCKING_POSTURES,
  FAILURE_MODE_CATEGORIES,
  FINAL_FAILURE_MODES,
  FINAL_FAILURE_MODE_IDS,
  FinalFailureModeRegistrySchema,
  getBlockingFailureModes,
  getFailureModesBySeverity,
  getFailureModesBySurface,
  getFinalFailureModeRegistry,
  getHardeningSurfaces,
  summarizeFinalFailureModes,
} from "./index";

const REQUIRED_FAILURE_MODE_IDS = [
  "final-failure-mode:model-runtime-unavailable",
  "final-failure-mode:local-model-missing",
  "final-failure-mode:provider-disabled-misconfigured",
  "final-failure-mode:cloud-provider-requested-but-disabled",
  "final-failure-mode:sqlite-event-store-unavailable",
  "final-failure-mode:projection-read-failure",
  "final-failure-mode:command-center-startup-failure",
  "final-failure-mode:tauri-binding-startup-failure",
  "final-failure-mode:doctor-bootstrap-failure",
  "final-failure-mode:onboarding-demo-readiness-failure",
  "final-failure-mode:voice-runtime-unavailable",
  "final-failure-mode:vision-runtime-unavailable",
  "final-failure-mode:room-adapter-unavailable",
  "final-failure-mode:fake-room-failure",
  "final-failure-mode:scheduler-disabled-stalled",
  "final-failure-mode:approval-runtime-unavailable",
  "final-failure-mode:red-team-sandbox-disabled-misconfigured",
  "final-failure-mode:telemetry-audit-report-unavailable",
  "final-failure-mode:packaging-build-failure",
  "final-failure-mode:configuration-missing-invalid",
  "final-failure-mode:unsupported-environment-platform",
  "final-failure-mode:disk-memory-constraints",
  "final-failure-mode:local-first-fallback-unavailable",
  "final-failure-mode:unsafe-cloud-fallback-request",
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

describe("Phase 20F.2 failure mode registry", () => {
  it("exposes deterministic typed metadata-only failure mode records", () => {
    const registry = getFinalFailureModeRegistry();

    expect(FinalFailureModeRegistrySchema.safeParse(registry).success).toBe(
      true,
    );
    expect(JSON.stringify(registry)).toBe(
      JSON.stringify(getFinalFailureModeRegistry()),
    );
    expect(registry.map((failureMode) => failureMode.failure_id)).toEqual([
      ...REQUIRED_FAILURE_MODE_IDS,
    ]);
    expect(registry.map((failureMode) => failureMode.failure_id)).toEqual([
      ...FINAL_FAILURE_MODE_IDS,
    ]);
  });

  it("is frozen and returns defensive copies", () => {
    expect(Object.isFrozen(FINAL_FAILURE_MODES)).toBe(true);
    expect(Object.isFrozen(FINAL_FAILURE_MODES[0])).toBe(true);
    expect(Object.isFrozen(FINAL_FAILURE_MODES[0].recovery_guidance)).toBe(
      true,
    );

    const registry = getFinalFailureModeRegistry();
    registry[0].title = "Mutated";
    registry[0].recovery_guidance.push("mutation");

    expect(getFinalFailureModeRegistry()[0]).toMatchObject({
      failure_id: "final-failure-mode:model-runtime-unavailable",
      title: "Model runtime unavailable",
      recovery_guidance: [
        "Review local model readiness",
        "Use doctor report metadata",
      ],
    });
  });

  it("aligns every failure mode to a known Phase 20F.1 hardening surface", () => {
    const knownSurfaceIds = new Set(
      getHardeningSurfaces().map((surface) => surface.surface_id),
    );

    for (const failureMode of getFinalFailureModeRegistry()) {
      expect(knownSurfaceIds.has(failureMode.hardening_surface_id)).toBe(true);
    }

    expect(
      getFailureModesBySurface("hardening-surface:model-runtime-unavailable"),
    ).toHaveLength(2);
    expect(
      getFailureModesBySurface("hardening-surface:cloud-provider-opt-in-gated"),
    ).toHaveLength(2);
  });

  it("represents fallback, safe default, user-visible, audit/log, recovery, and deferred posture", () => {
    const registry = getFinalFailureModeRegistry();

    for (const failureMode of registry) {
      expect(failureMode.expected_fallback_behavior.length).toBeGreaterThan(0);
      expect(failureMode.safe_default.length).toBeGreaterThan(0);
      expect(failureMode.user_visible_error_posture.length).toBeGreaterThan(0);
      expect(failureMode.audit_log_posture).toContain("metadata-only");
      expect(failureMode.recovery_guidance.length).toBeGreaterThan(0);
      expect(failureMode.deferred_limitation_posture.length).toBeGreaterThan(0);
    }

    expect(
      new Set(registry.map((failureMode) => failureMode.category)),
    ).toEqual(new Set(FAILURE_MODE_CATEGORIES));
    expect(
      new Set(registry.map((failureMode) => failureMode.blocking_posture)),
    ).toEqual(new Set(FAILURE_MODE_BLOCKING_POSTURES));
  });

  it("filters blocking failure modes", () => {
    const blockingModes = getBlockingFailureModes();

    expect(blockingModes).toHaveLength(14);
    expect(
      blockingModes.every((failureMode) =>
        ["blocks_startup", "blocks_surface"].includes(
          failureMode.blocking_posture,
        ),
      ),
    ).toBe(true);
    expect(blockingModes.map((failureMode) => failureMode.failure_id)).toEqual(
      expect.arrayContaining([
        "final-failure-mode:sqlite-event-store-unavailable",
        "final-failure-mode:approval-runtime-unavailable",
        "final-failure-mode:unsafe-cloud-fallback-request",
      ]),
    );
  });

  it("filters failure modes by severity", () => {
    expect(getFailureModesBySeverity("critical")).toHaveLength(10);
    expect(getFailureModesBySeverity("high")).toHaveLength(7);
    expect(getFailureModesBySeverity("medium")).toHaveLength(7);
    expect(getFailureModesBySeverity("low")).toHaveLength(0);
    expect(
      getFailureModesBySeverity("critical").every(
        (failureMode) => failureMode.severity === "critical",
      ),
    ).toBe(true);
  });

  it("summarizes the registry consistently", () => {
    const registry = getFinalFailureModeRegistry();
    const summary = summarizeFinalFailureModes();

    expect(summary).toMatchObject({
      registry_version: "20F.2",
      failure_mode_count: 24,
      category_count: 18,
      represented_surface_count: 21,
      critical_count: 10,
      high_count: 7,
      medium_count: 7,
      low_count: 0,
      blocking_count: 14,
      warning_count: 5,
      deferred_count: 5,
      recovery_guidance_count: 48,
      phase20f_registry_only: true,
      phase20f_capability_neutral: true,
    });
    expect(summary.failure_mode_count).toBe(registry.length);
  });

  it("declares no hardening execution, filesystem, runtime, provider, network, process, UI, authority, source material, or capability affordances", () => {
    const registry = getFinalFailureModeRegistry();
    const summary = summarizeFinalFailureModes();

    for (const posture of [
      summary.posture,
      ...registry.map((failureMode) => failureMode.posture),
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
      expect(collectKeys({ registry, summary })).not.toContain(
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
        "getFinalFailureModeRegistry",
        "getFailureModesBySurface",
        "getBlockingFailureModes",
        "getFailureModesBySeverity",
        "summarizeFinalFailureModes",
      ]),
    );
  });
});
