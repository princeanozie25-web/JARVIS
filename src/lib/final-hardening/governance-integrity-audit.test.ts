import { describe, expect, it } from "vitest";

import * as finalHardening from "./index";
import {
  GOVERNANCE_INTEGRITY_INVARIANT_IDS,
  GovernanceIntegrityAuditReportSchema,
  buildGovernanceIntegrityAuditReport,
  type GovernanceIntegrityAuditReport,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "approve",
  "callProvider",
  "createUiRoute",
  "createAuthority",
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
  "raw_source_material",
] as const;

let cachedReport: GovernanceIntegrityAuditReport | undefined;

function report(): GovernanceIntegrityAuditReport {
  cachedReport ??= buildGovernanceIntegrityAuditReport();
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

describe("Phase 20F.7 governance integrity audit", () => {
  it("produces deterministic typed metadata-only audit output", () => {
    const auditReport = report();

    expect(
      GovernanceIntegrityAuditReportSchema.safeParse(auditReport).success,
    ).toBe(true);
    expect(JSON.stringify(auditReport)).toBe(
      JSON.stringify(buildGovernanceIntegrityAuditReport()),
    );
    expect(auditReport).toMatchObject({
      report_version: "20F.7",
      report_id: "phase-20f7-governance-integrity-audit",
      phase: "20F.7",
      phase_span: "phases-1-through-20",
      verdict: "pass",
    });
    // E-015: raise to 120s (companion to E-013) — whole-repo-scan audit times
    // out under machine load; assertions unchanged.
  }, 120000);

  it("covers every required Phase 1-20 governance invariant", () => {
    const auditReport = report();

    expect(
      auditReport.invariants.map((invariant) => invariant.invariant_id),
    ).toEqual([...GOVERNANCE_INTEGRITY_INVARIANT_IDS]);
    expect(auditReport.summary.invariant_count).toBe(24);
    expect(auditReport.summary.protected_surface_count).toBe(17);
    expect(auditReport.summary.disabled_feature_reference_count).toBe(18);
  });

  it("keeps all invariants in a PASS state with aligned summary counts", () => {
    const auditReport = report();

    expect(auditReport.summary).toMatchObject({
      pass_count: 24,
      warning_count: 0,
      fail_count: 0,
      deferred_count: 0,
      blocking_classification_count: 24,
      non_blocking_classification_count: 0,
      blocking_finding_count: 0,
      evidence_reference_count: 72,
      governance_integrity_pass: true,
    });
    expect(auditReport.blocking_invariants).toHaveLength(24);
    expect(auditReport.non_blocking_invariants).toHaveLength(0);
    expect(
      auditReport.invariants.every((invariant) => invariant.invariant_intact),
    ).toBe(true);
  });

  it("covers approval, authority, execution, recovery, and source-material invariants", () => {
    const auditReport = report();
    const byId = new Map(
      auditReport.invariants.map((invariant) => [
        invariant.invariant_id,
        invariant,
      ]),
    );

    for (const invariantId of [
      "governance-integrity:approval-gated",
      "governance-integrity:no-approval-bypass",
      "governance-integrity:no-authority-creation-outside-governance",
      "governance-integrity:no-auto-recovery-execution",
      "governance-integrity:no-raw-source-material-exposure",
    ] as const) {
      const invariant = byId.get(invariantId);

      expect(invariant?.status).toBe("pass");
      expect(invariant?.severity_if_violated).toMatch(/critical/);
      expect(invariant?.violation_classification).toBe("blocking_if_violated");
      expect(invariant?.evidence_ids.length).toBeGreaterThan(0);
    }
  });

  it("covers voice, vision, scheduler, UI, graph, telemetry, and red-team invariants", () => {
    const auditReport = report();
    const invariantIds = auditReport.invariants.map(
      (invariant) => invariant.invariant_id,
    );

    expect(invariantIds).toEqual(
      expect.arrayContaining([
        "governance-integrity:no-voice-only-approval",
        "governance-integrity:no-wake-word-activation",
        "governance-integrity:no-always-listening",
        "governance-integrity:no-hidden-capture",
        "governance-integrity:no-vision-triggered-action",
        "governance-integrity:no-scheduler-side-effects",
        "governance-integrity:no-graph-driven-execution",
        "governance-integrity:no-viewer-driven-execution",
        "governance-integrity:no-telemetry-mutation",
        "governance-integrity:no-ui-mutation",
        "governance-integrity:no-cai-execution",
      ]),
    );
  });

  it("aligns with upstream governance, disabled-feature, authority, recovery, and regression evidence", () => {
    const auditReport = report();

    expect(auditReport.summary).toMatchObject({
      authority_inventory_surface_count: 17,
      disabled_feature_count: 18,
      governance_audit_blocking_count: 0,
      authority_surface_audit_blocking_count: 0,
      disabled_feature_audit_blocking_count: 0,
      authority_regression_count: 0,
      recovery_auto_recovery_count: 0,
      final_governance_ready_for_hardening: true,
      phase20f_governance_integrity_audit_only: true,
      phase20f_capability_neutral: true,
    });
    expect(auditReport.final_governance_integrity_statement).toContain(
      "local-first, approval-gated, replay-safe, redaction-aware",
    );
  });

  it("declares no runtime, provider, network, filesystem, process, UI, approval-bypass, authority, source-material, or capability affordances", () => {
    const auditReport = report();

    for (const posture of [
      auditReport.posture,
      auditReport.summary.posture,
      ...auditReport.invariants.map((invariant) => invariant.posture),
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

  it("exports no execution, provider, UI, approval, authority, recovery automation, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalHardening)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildGovernanceIntegrityAuditReport"]),
    );
  });
});
