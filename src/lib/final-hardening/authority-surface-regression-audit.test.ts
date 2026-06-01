import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  AUTHORITY_SURFACE_REGRESSION_FINDING_IDS,
  AuthoritySurfaceRegressionAuditReportSchema,
  buildAuthoritySurfaceRegressionAuditReport,
  type AuthoritySurfaceRegressionAuditReport,
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

let cachedReport: AuthoritySurfaceRegressionAuditReport | undefined;

function report(): AuthoritySurfaceRegressionAuditReport {
  cachedReport ??= buildAuthoritySurfaceRegressionAuditReport();
  return cachedReport;
}

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

describe("Phase 20F.6 authority surface regression audit", () => {
  it("produces deterministic typed metadata-only audit output", () => {
    const auditReport = report();

    expect(
      AuthoritySurfaceRegressionAuditReportSchema.safeParse(auditReport)
        .success,
    ).toBe(true);
    expect(JSON.stringify(auditReport)).toBe(
      JSON.stringify(buildAuthoritySurfaceRegressionAuditReport()),
    );
    expect(auditReport).toMatchObject({
      report_version: "20F.6",
      report_id: "phase-20f6-authority-surface-regression-audit",
      phase: "20F.6",
    });
  }, 45000);

  it("covers all expected regression findings", () => {
    const auditReport = report();

    expect(auditReport.findings.map((finding) => finding.finding_id)).toEqual([
      ...AUTHORITY_SURFACE_REGRESSION_FINDING_IDS,
    ]);
    expect(auditReport.summary.finding_count).toBe(19);
    expect(auditReport.summary.represented_authority_surface_count).toBe(17);
    expect(auditReport.summary.related_failure_mode_count).toBe(22);
  });

  it("classifies risky paths as blocked, warning-only, disabled, or deferred", () => {
    const auditReport = report();

    expect(auditReport.blocked_findings).toHaveLength(8);
    expect(auditReport.warnings).toHaveLength(4);
    expect(auditReport.disabled_findings).toHaveLength(6);
    expect(auditReport.deferred_findings).toHaveLength(1);
    expect(auditReport.summary).toMatchObject({
      blocked_count: 8,
      warning_only_count: 4,
      disabled_count: 6,
      deferred_count: 1,
      regression_count: 0,
    });
  });

  it("denies approval bypass, authority creation, authority tokens, and execution dispatch", () => {
    const auditReport = report();

    for (const finding of auditReport.findings) {
      expect(finding.approval_bypass_denied).toBe(true);
      expect(finding.authority_creation_denied).toBe(true);
      expect(finding.authority_token_creation_denied).toBe(true);
      expect(finding.execution_dispatch_denied).toBe(true);
      expect(finding.read_only_viewer_dispatch_denied).toBe(true);
      expect(finding.regression_detected).toBe(false);
    }

    expect(auditReport.summary).toMatchObject({
      approval_bypass_denied_count: 19,
      authority_creation_denied_count: 19,
      execution_dispatch_denied_count: 19,
    });
  });

  it("denies graph execution, voice-only approval, scheduler effects, vision actions, UI mutation, CAI execution, and auto-recovery", () => {
    const auditReport = report();

    for (const finding of auditReport.findings) {
      expect(finding.graph_driven_execution_denied).toBe(true);
      expect(finding.voice_only_approval_denied).toBe(true);
      expect(finding.scheduler_side_effects_denied).toBe(true);
      expect(finding.vision_triggered_actions_denied).toBe(true);
      expect(finding.telemetry_ui_mutation_denied).toBe(true);
      expect(finding.cai_execution_denied).toBe(true);
      expect(finding.auto_recovery_denied).toBe(true);
    }

    expect(auditReport.summary.auto_recovery_denied_count).toBe(19);
    expect(auditReport.summary.recovery_audit_auto_recovery_count).toBe(0);
  });

  it("denies source material exposure, network expansion, unsafe background behavior, and public dashboards", () => {
    const auditReport = report();

    for (const finding of auditReport.findings) {
      expect(finding.source_material_exposure_denied).toBe(true);
      expect(finding.network_expansion_denied).toBe(true);
      expect(finding.unsafe_background_behavior_denied).toBe(true);
      expect(finding.public_remote_dashboard_denied).toBe(true);
      expect(finding.metadata_contract_boundary_preserved).toBe(true);
    }

    expect(auditReport.summary).toMatchObject({
      source_material_exposure_denied_count: 19,
      network_expansion_denied_count: 19,
      unsafe_background_behavior_denied_count: 19,
      metadata_contract_boundary_preserved_count: 19,
    });
  });

  it("aligns with existing authority, recovery, and hardening metadata sources", () => {
    const auditReport = report();

    expect(auditReport.summary).toMatchObject({
      authority_inventory_surface_count: 17,
      authority_audit_blocking_count: 0,
      hardening_evaluator_result_count: 24,
      phase20f_authority_regression_audit_only: true,
      phase20f_capability_neutral: true,
    });
    expect(auditReport.final_regression_statement).toContain(
      "finds no execution dispatch, approval bypass, authority creation",
    );
  });

  it("declares no filesystem, runtime, provider, network, process, UI, authority, source material, recovery automation, or capability affordances", () => {
    const auditReport = report();

    for (const posture of [
      auditReport.posture,
      auditReport.summary.posture,
      ...auditReport.findings.map((finding) => finding.posture),
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
      expect(collectKeys(auditReport)).not.toContain(forbiddenFieldName);
    }
  });

  it("exports no hardening execution, UI route, provider, authority, recovery automation, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalHardening)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildAuthoritySurfaceRegressionAuditReport"]),
    );
  });
});
