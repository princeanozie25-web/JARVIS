import { describe, expect, it } from "vitest";

import * as crossPhaseAudit from "./index";
import {
  AUDIT_EVIDENCE_IDS,
  GOVERNANCE_AUDIT_FINDING_IDS,
  GovernanceAuditReportSchema,
  buildGovernanceAuditReport,
} from "./index";

const REQUIRED_FINDING_IDS = [
  "governance-audit:approval-boundaries",
  "governance-audit:authority-surfaces",
  "governance-audit:execution-gating",
  "governance-audit:local-first-posture",
  "governance-audit:cloud-gated-posture",
  "governance-audit:governance-visualizer-posture",
  "governance-audit:approval-runtime-posture",
  "governance-audit:room-runtime-governance",
  "governance-audit:model-runtime-governance",
  "governance-audit:voice-governance",
  "governance-audit:vision-governance",
  "governance-audit:scheduler-governance",
  "governance-audit:red-team-governance",
  "governance-audit:bootstrap-onboarding-governance",
  "governance-audit:portfolio-demo-governance",
] as const;

const REQUIRED_SURFACES = [
  "audit-surface:phase-13-model-runtime",
  "audit-surface:phase-14-voice-runtime",
  "audit-surface:phase-15-vision-runtime",
  "audit-surface:phase-16-room-runtime",
  "audit-surface:phase-17-scheduled-assistance",
  "audit-surface:phase-18-approval-runtime",
  "audit-surface:phase-19-fortress-layer",
  "audit-surface:phase-20b-bootstrap",
  "audit-surface:phase-20c-onboarding",
  "audit-surface:phase-20d-portfolio",
] as const;

const FORBIDDEN_EXPORT_NAMES = [
  "install",
  "run",
  "exec",
  "spawn",
  "mutate",
  "callProvider",
  "createUiRoute",
  "executeAudit",
  "inspectFilesystem",
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

describe("Phase 20E.5 governance boundary audit", () => {
  it("produces deterministic typed metadata-only governance audit output", () => {
    const report = buildGovernanceAuditReport();

    expect(GovernanceAuditReportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(buildGovernanceAuditReport()),
    );
    expect(report).toMatchObject({
      report_version: "20E.5",
      report_id: "phase-20e5-governance-boundary-audit",
      phase: "20E.5",
      verdict: "pass_with_warnings",
      source_summary: {
        evaluator_version: "20E.4",
        phase20a_complete: true,
        phase20b_complete: true,
        phase20c_complete: true,
        phase20d_complete: true,
        governance_ready_for_phase20_hardening: true,
        metadata_only_sources: true,
      },
    });
  }, 15000);

  it("generates every required governance finding", () => {
    const report = buildGovernanceAuditReport();

    expect(report.findings.map((finding) => finding.finding_id)).toEqual([
      ...REQUIRED_FINDING_IDS,
    ]);
    expect(report.findings.map((finding) => finding.finding_id)).toEqual([
      ...GOVERNANCE_AUDIT_FINDING_IDS,
    ]);
    expect(report.findings).toHaveLength(15);
  });

  it("covers approval, runtime, bootstrap, onboarding, and portfolio governance surfaces", () => {
    const report = buildGovernanceAuditReport();
    const surfaceIds = new Set(
      report.findings.flatMap((finding) => finding.audit_surface_ids),
    );

    for (const surfaceId of REQUIRED_SURFACES) {
      expect(surfaceIds.has(surfaceId)).toBe(true);
    }

    expect(
      report.findings.find(
        (finding) =>
          finding.finding_id === "governance-audit:approval-runtime-posture",
      ),
    ).toMatchObject({
      severity: "critical",
      audit_surface_ids: ["audit-surface:phase-18-approval-runtime"],
      status: "pass",
    });
  });

  it("classifies blocking findings, warnings, and deferred posture correctly", () => {
    const report = buildGovernanceAuditReport();

    expect(report.blocking_findings).toEqual([]);
    expect(report.summary.blocking_count).toBe(0);
    expect(report.summary.fail_count).toBe(0);
    expect(report.summary.warning_count).toBeGreaterThan(0);
    expect(report.summary.deferred_count).toBeGreaterThan(0);
    expect(report.warnings.every((finding) => finding.warning)).toBe(true);
    expect(
      report.findings.find(
        (finding) => finding.finding_id === "governance-audit:voice-governance",
      ),
    ).toMatchObject({
      status: "deferred",
      blocking: false,
    });
  });

  it("aligns summary counts with findings", () => {
    const report = buildGovernanceAuditReport();

    expect(report.summary).toMatchObject({
      report_version: "20E.5",
      finding_count: report.findings.length,
      critical_count: 4,
      high_count: 8,
      medium_count: 3,
      low_count: 0,
      governance_ready: true,
      phase20e_governance_audit_metadata_only: true,
      phase20e_capability_neutral: true,
    });
    expect(
      report.summary.pass_count +
        report.summary.warning_count +
        report.summary.pending_count +
        report.summary.deferred_count +
        report.summary.fail_count,
    ).toBe(report.findings.length);
    expect(report.summary.evidence_reference_count).toBe(
      report.findings.reduce(
        (count, finding) => count + finding.evidence_ids.length,
        0,
      ),
    );
  });

  it("links every finding to known evidence ids", () => {
    const evidenceIds = new Set(AUDIT_EVIDENCE_IDS);
    const report = buildGovernanceAuditReport();

    expect(
      report.findings.every((finding) => finding.evidence_ids.length > 0),
    ).toBe(true);

    for (const finding of report.findings) {
      for (const evidenceId of finding.evidence_ids) {
        expect(evidenceIds.has(evidenceId)).toBe(true);
      }
    }
  });

  it("declares no runtime, filesystem, network, provider, UI, authority, source material, or capability affordances", () => {
    const report = buildGovernanceAuditReport();

    for (const posture of [
      report.posture,
      report.summary.posture,
      ...report.findings.map((finding) => finding.posture),
    ]) {
      expect(posture.audit_execution_enabled).toBe(false);
      expect(posture.filesystem_inspection_enabled).toBe(false);
      expect(posture.runtime_execution_enabled).toBe(false);
      expect(posture.provider_call_enabled).toBe(false);
      expect(posture.network_call_enabled).toBe(false);
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

  it("exports no audit execution, UI route, provider, authority, or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(crossPhaseAudit)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }

    expect(exportedFunctionNames).toEqual(
      expect.arrayContaining(["buildGovernanceAuditReport"]),
    );
  });
});
