import { describe, expect, it } from "vitest";

import * as crossPhaseAudit from "./index";
import {
  AUDIT_EVIDENCE_IDS,
  AUTHORITY_SURFACE_AUDIT_FINDING_IDS,
  AuthoritySurfaceAuditReportSchema,
  buildAuthoritySurfaceAuditReport,
  type AuthoritySurfaceAuditReport,
} from "./index";

const REQUIRED_AUTHORITY_SURFACE_IDS = [
  "authority-surface:model-runtime",
  "authority-surface:local-providers",
  "authority-surface:cloud-providers",
  "authority-surface:voice-runtime",
  "authority-surface:vision-runtime",
  "authority-surface:room-adapter-runtime",
  "authority-surface:scheduler-routines",
  "authority-surface:approval-service",
  "authority-surface:tool-runtime",
  "authority-surface:command-center-ui",
  "authority-surface:architecture-graph",
  "authority-surface:telemetry-cockpit",
  "authority-surface:governance-visualizer",
  "authority-surface:red-team-sandbox-cai",
  "authority-surface:event-store-persistence",
  "authority-surface:project-intelligence",
  "authority-surface:memory-bridge",
] as const;

const EXECUTION_CAPABLE_SURFACES = [
  "authority-surface:model-runtime",
  "authority-surface:local-providers",
  "authority-surface:voice-runtime",
  "authority-surface:vision-runtime",
  "authority-surface:room-adapter-runtime",
  "authority-surface:scheduler-routines",
  "authority-surface:approval-service",
  "authority-surface:tool-runtime",
  "authority-surface:red-team-sandbox-cai",
] as const;

const UI_OBSERVABILITY_SURFACES = [
  "authority-surface:command-center-ui",
  "authority-surface:architecture-graph",
  "authority-surface:telemetry-cockpit",
  "authority-surface:governance-visualizer",
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

let cachedReport: AuthoritySurfaceAuditReport | undefined;

function report(): AuthoritySurfaceAuditReport {
  cachedReport ??= buildAuthoritySurfaceAuditReport();
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

describe("Phase 20E.7 authority surface audit", () => {
  it("produces deterministic typed metadata-only authority audit output", () => {
    const authorityReport = report();

    expect(
      AuthoritySurfaceAuditReportSchema.safeParse(authorityReport).success,
    ).toBe(true);
    expect(JSON.stringify(authorityReport)).toBe(
      JSON.stringify(buildAuthoritySurfaceAuditReport()),
    );
    expect(authorityReport).toMatchObject({
      report_version: "20E.7",
      report_id: "phase-20e7-authority-surface-audit",
      phase: "20E.7",
      verdict: "pass_with_warnings",
      posture: {
        metadata_only: true,
        read_only: true,
        deterministic: true,
        audit_execution_enabled: false,
      },
    });
  }, 15000);

  it("covers every required authority surface", () => {
    const authorityReport = report();

    expect(
      authorityReport.findings.map((finding) => finding.authority_surface_id),
    ).toEqual([...REQUIRED_AUTHORITY_SURFACE_IDS]);
    expect(
      authorityReport.findings.map((finding) => finding.finding_id),
    ).toEqual([...AUTHORITY_SURFACE_AUDIT_FINDING_IDS]);
    expect(authorityReport.findings).toHaveLength(17);
    expect(authorityReport.summary.inventory_surface_count).toBe(17);
  });

  it("verifies execution-capable surfaces have governance posture", () => {
    const authorityReport = report();

    for (const surfaceId of EXECUTION_CAPABLE_SURFACES) {
      expect(
        authorityReport.findings.find(
          (finding) => finding.authority_surface_id === surfaceId,
        ),
      ).toMatchObject({
        represented_in_inventory: true,
        execution_governed: true,
        blocking: false,
      });
    }
  });

  it("verifies network-capable surfaces remain local-first, cloud-gated, or whitelisted", () => {
    const authorityReport = report();

    for (const surfaceId of [
      "authority-surface:cloud-providers",
      "authority-surface:room-adapter-runtime",
      "authority-surface:red-team-sandbox-cai",
    ]) {
      expect(
        authorityReport.findings.find(
          (finding) => finding.authority_surface_id === surfaceId,
        ),
      ).toMatchObject({
        network_governed: true,
        blocking: false,
      });
    }
  });

  it("verifies UI and observability surfaces remain read-only", () => {
    const authorityReport = report();

    for (const surfaceId of UI_OBSERVABILITY_SURFACES) {
      expect(
        authorityReport.findings.find(
          (finding) => finding.authority_surface_id === surfaceId,
        ),
      ).toMatchObject({
        ui_observability_read_only: true,
        status: "warning",
        blocking: false,
      });
    }
  });

  it("verifies red-team and CAI posture remains sandboxed and whitelisted", () => {
    const authorityReport = report();

    expect(
      authorityReport.findings.find(
        (finding) =>
          finding.authority_surface_id ===
          "authority-surface:red-team-sandbox-cai",
      ),
    ).toMatchObject({
      sandbox_whitelist_governed: true,
      status: "deferred",
      blocking: false,
      evidence_ids: expect.arrayContaining([
        "audit-evidence:red-team-sandbox-cai-posture",
      ]),
    });
  });

  it("keeps auto-approval denied and payload exposure denied for every surface", () => {
    const authorityReport = report();

    expect(
      authorityReport.findings.every((finding) => finding.auto_approval_denied),
    ).toBe(true);
    expect(
      authorityReport.findings.every(
        (finding) => finding.payload_exposure_denied,
      ),
    ).toBe(true);
    expect(authorityReport.summary.auto_approval_denied_count).toBe(17);
    expect(authorityReport.summary.payload_exposure_denied_count).toBe(17);
  });

  it("classifies blocking, warning, deferred, and summary counts correctly", () => {
    const authorityReport = report();

    expect(authorityReport.blocking_findings).toEqual([]);
    expect(authorityReport.summary).toMatchObject({
      report_version: "20E.7",
      finding_count: 17,
      represented_count: 17,
      pass_count: 9,
      warning_count: 4,
      pending_count: 0,
      deferred_count: 4,
      fail_count: 0,
      blocking_count: 0,
      critical_count: 6,
      high_count: 4,
      medium_count: 7,
      low_count: 0,
      execution_governed_count: 17,
      network_governed_count: 17,
      read_only_ui_observability_count: 17,
      sandbox_whitelist_governed_count: 17,
      governance_audit_blocking_count: 0,
      disabled_feature_audit_blocking_count: 0,
      all_authority_surfaces_governed: true,
      phase20e_authority_audit_metadata_only: true,
      phase20e_capability_neutral: true,
    });
    expect(
      authorityReport.summary.pass_count +
        authorityReport.summary.warning_count +
        authorityReport.summary.pending_count +
        authorityReport.summary.deferred_count +
        authorityReport.summary.fail_count,
    ).toBe(authorityReport.findings.length);
  });

  it("links every finding to known cross-phase evidence ids", () => {
    const evidenceIds = new Set(AUDIT_EVIDENCE_IDS);
    const authorityReport = report();

    expect(
      authorityReport.findings.every(
        (finding) => finding.evidence_ids.length > 0,
      ),
    ).toBe(true);

    for (const finding of authorityReport.findings) {
      for (const evidenceId of finding.evidence_ids) {
        expect(evidenceIds.has(evidenceId)).toBe(true);
      }
    }
  });

  it("declares no runtime, filesystem, network, provider, UI, authority, source material, or capability affordances", () => {
    const authorityReport = report();

    for (const posture of [
      authorityReport.posture,
      authorityReport.summary.posture,
      ...authorityReport.findings.map((finding) => finding.posture),
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
      expect(collectKeys(authorityReport)).not.toContain(forbiddenFieldName);
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
      expect.arrayContaining(["buildAuthoritySurfaceAuditReport"]),
    );
  });
});
