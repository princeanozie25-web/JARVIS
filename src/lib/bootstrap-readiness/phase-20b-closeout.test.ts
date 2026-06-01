import { describe, expect, it } from "vitest";

import * as bootstrapReadiness from "./index";
import {
  DOCTOR_CHECK_IDS,
  PHASE_20B_CLOSEOUT_CHECK_IDS,
  PHASE_20B_MODULE_IDS,
  Phase20BCloseoutReportSchema,
  buildPhase20BCloseoutReport,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "autoFix",
  "fix",
  "repair",
  "mutate",
  "callProvider",
  "createUiRoute",
  "createAuthoritySurface",
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

describe("Phase 20B.8 bootstrap readiness closeout", () => {
  it("builds a deterministic typed closeout report", () => {
    const report = buildPhase20BCloseoutReport();

    expect(Phase20BCloseoutReportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(buildPhase20BCloseoutReport()),
    );
    expect(report).toMatchObject({
      closeout_version: "20B.8",
      phase: "20B.8",
      verdict: "passed",
      phase_20b_complete: true,
      phase_20c_ready: true,
    });
  });

  it("includes every Phase 20B module and closeout check", () => {
    const report = buildPhase20BCloseoutReport();

    expect(report.module_ids).toEqual([...PHASE_20B_MODULE_IDS]);
    expect(report.checks.map((check) => check.check_id)).toEqual([
      ...PHASE_20B_CLOSEOUT_CHECK_IDS,
    ]);
    expect(report.summary.module_count).toBe(PHASE_20B_MODULE_IDS.length);
    expect(report.summary.closeout_check_count).toBe(
      PHASE_20B_CLOSEOUT_CHECK_IDS.length,
    );
  });

  it("includes every existing doctor check without adding new checks", () => {
    const report = buildPhase20BCloseoutReport();

    expect(report.doctor_check_ids).toEqual([...DOCTOR_CHECK_IDS]);
    expect(report.summary.doctor_check_count).toBe(DOCTOR_CHECK_IDS.length);
  });

  it("represents safe local runtime and CLI adapter readiness", () => {
    const report = buildPhase20BCloseoutReport();

    expect(report.supported_safe_runtime_check_ids).toEqual([
      "doctor-check:node-version",
      "doctor-check:package-manager-availability",
      "doctor-check:platform-support",
      "doctor-check:required-project-directories",
      "doctor-check:required-config-files",
      "doctor-check:required-env-file-example",
    ]);
    expect(
      report.checks.find(
        (check) => check.check_id === "phase-20b:safe-local-runtime-present",
      )?.evidence_ids,
    ).toEqual(["20B.6"]);
    expect(
      report.checks.find(
        (check) => check.check_id === "phase-20b:doctor-cli-adapter-present",
      )?.evidence_ids,
    ).toEqual(["20B.7"]);
  });

  it("keeps unsupported runtime and provider checks pending or skipped only", () => {
    const report = buildPhase20BCloseoutReport();

    expect(report.unsupported_check_posture).toBe("pending_or_skipped_only");
    expect(report.unsupported_runtime_provider_check_ids).toEqual([
      "doctor-check:typescript-tooling",
      "doctor-check:required-registries",
      "doctor-check:sqlite-readiness",
      "doctor-check:tauri-readiness",
      "doctor-check:ollama-local-model-runtime",
      "doctor-check:voice-runtime-prerequisites",
      "doctor-check:vision-runtime-prerequisites",
      "doctor-check:local-first-cloud-gated-posture",
      "doctor-check:disabled-provider-posture",
    ]);
    expect(report.summary.unsupported_runtime_provider_check_count).toBe(9);
    expect(report.summary.pending_placeholder_count).toBe(
      DOCTOR_CHECK_IDS.length,
    );
  });

  it("declares no install, auto-fix, mutation, network, provider, or runtime expansion posture", () => {
    const report = buildPhase20BCloseoutReport();

    expect(report.posture).toMatchObject({
      creates_doctor_checks: false,
      adds_runtime_execution: false,
      installation_enabled: false,
      auto_fix_enabled: false,
      filesystem_mutation_enabled: false,
      network_call_enabled: false,
      provider_call_enabled: false,
      ollama_call_enabled: false,
      tauri_execution_enabled: false,
      voice_runtime_execution_enabled: false,
      vision_runtime_execution_enabled: false,
    });

    for (const check of report.checks) {
      expect(check.creates_doctor_check).toBe(false);
      expect(check.executes_unsupported_runtime).toBe(false);
      expect(check.installs_dependency).toBe(false);
      expect(check.auto_fix_enabled).toBe(false);
      expect(check.mutates_filesystem).toBe(false);
      expect(check.calls_network).toBe(false);
      expect(check.contacts_provider).toBe(false);
    }
  });

  it("declares no UI route, approval bypass, authority surface, capability, or raw payload exposure", () => {
    const report = buildPhase20BCloseoutReport();

    expect(report.posture).toMatchObject({
      approval_bypass_created: false,
      ui_route_created: false,
      authority_surface_created: false,
      capability_created: false,
      raw_payload_exposure_enabled: false,
    });

    for (const check of report.checks) {
      expect(check.creates_ui_route).toBe(false);
      expect(check.creates_authority_surface).toBe(false);
      expect(check.exposes_raw_payload).toBe(false);
    }

    for (const forbiddenFieldName of FORBIDDEN_FIELD_NAMES) {
      expect(collectKeys(report)).not.toContain(forbiddenFieldName);
    }
  });

  it("declares Phase 20B complete and Phase 20C-ready", () => {
    const report = buildPhase20BCloseoutReport();

    expect(report.phase_20b_complete).toBe(true);
    expect(report.phase_20c_ready).toBe(true);
    expect(
      report.checks.find(
        (check) => check.check_id === "phase-20b:phase-20c-ready",
      ),
    ).toMatchObject({
      status: "passed",
      evidence_ids: ["phase-20c:ready"],
    });
  });

  it("exports no install, auto-fix, UI route, authority, provider, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(bootstrapReadiness)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toContain("buildPhase20BCloseoutReport");
  });
});
