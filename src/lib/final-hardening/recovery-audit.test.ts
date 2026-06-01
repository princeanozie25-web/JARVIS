import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  FINAL_FAILURE_MODE_IDS,
  RecoveryFallbackAuditReportSchema,
  buildRecoveryFallbackAuditReport,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
  "executeHardening",
  "recover",
  "autoFix",
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

describe("Phase 20F.5 recovery fallback audit", () => {
  it("produces deterministic typed metadata-only audit output", () => {
    const report = buildRecoveryFallbackAuditReport();

    expect(RecoveryFallbackAuditReportSchema.safeParse(report).success).toBe(
      true,
    );
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(buildRecoveryFallbackAuditReport()),
    );
    expect(report).toMatchObject({
      report_version: "20F.5",
      report_id: "phase-20f5-recovery-fallback-audit",
      phase: "20F.5",
    });
  });

  it("covers every final failure mode", () => {
    const report = buildRecoveryFallbackAuditReport();

    expect(report.findings).toHaveLength(24);
    expect(report.findings.map((finding) => finding.failure_mode_id)).toEqual([
      ...FINAL_FAILURE_MODE_IDS,
    ]);
    expect(report.summary).toMatchObject({
      finding_count: 24,
      covered_failure_mode_count: 24,
      covered_surface_count: 21,
    });
  });

  it("represents fallback, safe-default, recovery, user-visible, and audit/log posture", () => {
    const report = buildRecoveryFallbackAuditReport();

    for (const finding of report.findings) {
      expect(finding.fallback_behavior.length).toBeGreaterThan(0);
      expect(finding.safe_default.length).toBeGreaterThan(0);
      expect(finding.recovery_guidance.length).toBeGreaterThan(0);
      expect(finding.user_visible_error_posture.length).toBeGreaterThan(0);
      expect(finding.audit_log_posture).toContain("metadata-only");
      expect(finding.deferred_limitation_posture.length).toBeGreaterThan(0);
      expect(finding.passed).toBe(true);
    }

    expect(report.summary).toMatchObject({
      fallback_behavior_count: 24,
      safe_default_count: 24,
      recovery_guidance_count: 24,
      user_visible_error_count: 24,
      audit_log_posture_count: 24,
      failed_finding_count: 0,
    });
  });

  it("keeps cloud fallback opt-in, disabled, or gated", () => {
    const report = buildRecoveryFallbackAuditReport();
    const cloudFindings = report.findings.filter((finding) =>
      finding.cloud_fallback_posture.includes("governance-gated"),
    );

    expect(cloudFindings).toHaveLength(7);
    expect(report.summary.cloud_gated_posture_count).toBe(7);
    expect(cloudFindings.map((finding) => finding.failure_mode_id)).toEqual(
      expect.arrayContaining([
        "final-failure-mode:cloud-provider-requested-but-disabled",
        "final-failure-mode:unsafe-cloud-fallback-request",
        "final-failure-mode:local-first-fallback-unavailable",
      ]),
    );
  });

  it("declares no unsafe auto-recovery posture", () => {
    const report = buildRecoveryFallbackAuditReport();

    expect(report.summary.unsafe_auto_recovery_count).toBe(0);
    expect(
      report.findings.every(
        (finding) =>
          !finding.unsafe_auto_recovery_represented &&
          !finding.recovery_execution_enabled,
      ),
    ).toBe(true);
    expect(report.final_recovery_statement).toContain(
      "no recovery action, runtime check, provider call, or automation is enabled",
    );
  });

  it("classifies blocking, warning, and deferred findings", () => {
    const report = buildRecoveryFallbackAuditReport();

    expect(report.blocking_findings).toHaveLength(14);
    expect(report.warnings).toHaveLength(5);
    expect(report.deferred_findings).toHaveLength(5);
    expect(report.summary).toMatchObject({
      blocking_count: 14,
      warning_count: 5,
      deferred_count: 5,
    });
    expect(
      report.blocking_findings.map((finding) => finding.failure_mode_id),
    ).toEqual(
      expect.arrayContaining([
        "final-failure-mode:sqlite-event-store-unavailable",
        "final-failure-mode:approval-runtime-unavailable",
      ]),
    );
    expect(
      report.deferred_findings.map((finding) => finding.failure_mode_id),
    ).toEqual(
      expect.arrayContaining([
        "final-failure-mode:voice-runtime-unavailable",
        "final-failure-mode:red-team-sandbox-disabled-misconfigured",
      ]),
    );
  });

  it("aligns summary counts with findings and evaluator summary", () => {
    const report = buildRecoveryFallbackAuditReport();

    expect(report.evaluator_summary).toMatchObject({
      result_count: 24,
      pending_count: 24,
      blocking_result_count: 14,
      represented_failure_mode_count: 24,
      represented_surface_count: 21,
    });
    expect(report.summary.finding_count).toBe(report.findings.length);
    expect(report.summary.blocking_count).toBe(report.blocking_findings.length);
    expect(report.summary.warning_count).toBe(report.warnings.length);
    expect(report.summary.deferred_count).toBe(report.deferred_findings.length);
  });

  it("declares no recovery execution, filesystem, runtime, provider, network, process, UI, authority, source material, recovery automation, or capability affordances", () => {
    const report = buildRecoveryFallbackAuditReport();

    for (const posture of [
      report.posture,
      report.summary.posture,
      ...report.findings.map((finding) => finding.posture),
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
      expect(collectKeys(report)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no recovery execution, UI route, provider, authority, recovery automation, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalHardening)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildRecoveryFallbackAuditReport"]),
    );
  });
});
