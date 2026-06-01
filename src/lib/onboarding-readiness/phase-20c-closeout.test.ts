import { describe, expect, it } from "vitest";

import * as onboardingReadiness from "./index";
import {
  PHASE_20C_CLOSEOUT_CHECK_IDS,
  Phase20CCloseoutReportSchema,
  buildPhase20CCloseoutReport,
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

describe("Phase 20C.6 onboarding readiness closeout", () => {
  it("builds a deterministic typed closeout report", () => {
    const report = buildPhase20CCloseoutReport();

    expect(Phase20CCloseoutReportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(buildPhase20CCloseoutReport()),
    );
    expect(report).toMatchObject({
      closeout_version: "20C.6",
      closeout_id: "phase-20c6-onboarding-readiness-closeout",
      phase: "20C",
      verdict: "passed",
      phase_20c_complete: true,
      next_phase_ready: true,
      module_presence: {
        onboarding_readiness_contract: true,
        onboarding_step_registry: true,
        onboarding_progress_model: true,
        onboarding_report_generator: true,
        move_in_readiness_checklist: true,
      },
    });
  });

  it("includes all Phase 20C closeout checks and passes them", () => {
    const report = buildPhase20CCloseoutReport();

    expect(report.checks.map((check) => check.check_id)).toEqual([
      ...PHASE_20C_CLOSEOUT_CHECK_IDS,
    ]);
    expect(report.checks.every((check) => check.passed)).toBe(true);
    expect(report.checks.every((check) => check.metadata_only)).toBe(true);
  });

  it("represents clone to first-safe-run flow", () => {
    const report = buildPhase20CCloseoutReport();

    expect(report.flow_coverage).toMatchObject({
      clone_to_bootstrap_to_doctor_to_demo_to_first_safe_run_represented: true,
      represented_step_ids: [
        "onboarding-sequence:clone-repository",
        "onboarding-sequence:install-dependencies",
        "onboarding-sequence:prepare-env-file",
        "onboarding-sequence:run-doctor",
        "onboarding-sequence:enable-demo-mode",
        "onboarding-sequence:verify-fake-room",
        "onboarding-sequence:verify-first-safe-run",
      ],
    });
  });

  it("represents required onboarding gates", () => {
    const report = buildPhase20CCloseoutReport();

    expect(report.required_gate_ids).toEqual([
      "onboarding-gate:phase-20a-governance-ready",
      "onboarding-gate:phase-20b-bootstrap-ready",
      "onboarding-gate:doctor-cli-report-available",
      "onboarding-gate:demo-mode-metadata-ready",
      "onboarding-gate:first-safe-run-approval-governed",
      "onboarding-gate:no-new-capabilities",
    ]);
    expect(
      report.checks.find(
        (check) => check.check_id === "phase-20c:required-gates-represented",
      ),
    ).toMatchObject({ passed: true });
  });

  it("represents deferred real-device, wake-word/conversation-mode, and voice-authorisation posture", () => {
    const report = buildPhase20CCloseoutReport();

    expect(report.deferred_posture).toMatchObject({
      real_device_hue_onboarding_deferred: true,
      wake_word_conversation_mode_architecture_amendment_deferred: true,
      voice_authorisation_tier_amendment_deferred: true,
      deferred_checklist_item_ids: [
        "move-in:real-hue-device-onboarding-deferred",
        "move-in:wake-word-conversation-mode-amendment-deferred",
        "move-in:voice-authorisation-tiers-deferred",
      ],
    });
  });

  it("represents the final approval safety reminder", () => {
    const report = buildPhase20CCloseoutReport();

    expect(report.final_approval_safety_reminder_present).toBe(true);
    expect(
      report.checks.find(
        (check) =>
          check.check_id === "phase-20c:final-approval-safety-reminder",
      ),
    ).toMatchObject({
      passed: true,
      evidence_ids: ["move-in:final-safety-approval-reminder"],
    });
  });

  it("declares no installer, shell, mutation, network, provider, runtime, UI, authority, source material, or capability posture", () => {
    const report = buildPhase20CCloseoutReport();

    expect(report.safety_posture_summary).toMatchObject({
      installer_automation_absent: true,
      shell_process_execution_absent: true,
      filesystem_mutation_absent: true,
      network_provider_calls_absent: true,
      runtime_execution_absent: true,
      ui_route_absent: true,
      approval_bypass_absent: true,
      authority_surface_absent: true,
      source_material_exposure_absent: true,
      metadata_only: true,
    });
    expect(report.safety_posture).toMatchObject({
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
    });

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(report)).not.toContain(forbiddenFieldName);
    }
  });

  it("declares Phase 20C complete and next-phase ready", () => {
    const report = buildPhase20CCloseoutReport();

    expect(report.phase_20c_complete).toBe(true);
    expect(report.next_phase_ready).toBe(true);
    expect(report.next_phase_readiness_statement).toContain(
      "Phase 20D portfolio/demo readiness or final hardening",
    );
  });

  it("exports no setup, runtime execution, UI route, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(onboardingReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildPhase20CCloseoutReport"]),
    );
  });
});
