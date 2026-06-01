import { describe, expect, it } from "vitest";

import * as crossPhaseAudit from "./index";
import {
  AUDIT_EVIDENCE_IDS,
  DISABLED_FEATURE_AUDIT_FINDING_IDS,
  DisabledFeatureAuditReportSchema,
  buildDisabledFeatureAuditReport,
} from "./index";

const REQUIRED_FINDING_IDS = [
  "disabled-feature-audit:wake-word",
  "disabled-feature-audit:conversation-mode",
  "disabled-feature-audit:voice-authorisation-tiers",
  "disabled-feature-audit:always-listening",
  "disabled-feature-audit:hidden-background-capture",
  "disabled-feature-audit:autonomous-device-execution",
  "disabled-feature-audit:auto-approval",
  "disabled-feature-audit:voice-only-approval",
  "disabled-feature-audit:public-remote-dashboards",
  "disabled-feature-audit:graph-driven-execution",
  "disabled-feature-audit:payload-telemetry-ui-exposure",
  "disabled-feature-audit:ungoverned-provider-escalation",
  "disabled-feature-audit:cai-non-whitelisted-targets",
  "disabled-feature-audit:scheduler-side-effects",
  "disabled-feature-audit:routine-chaining",
  "disabled-feature-audit:unapproved-room-device-actions",
  "disabled-feature-audit:whole-home-multi-room",
] as const;

const CRITICAL_FEATURE_IDS = [
  "disabled-feature:wake-word",
  "disabled-feature:always-listening",
  "disabled-feature:hidden-capture",
  "disabled-feature:background-camera",
  "disabled-feature:autonomous-device-execution",
  "disabled-feature:auto-approval",
  "disabled-feature:voice-only-approval",
  "disabled-feature:public-remote-dashboards",
  "disabled-feature:graph-driven-execution",
  "disabled-feature:raw-payload-telemetry-ui-exposure",
  "disabled-feature:ungoverned-provider-escalation",
  "disabled-feature:cai-non-whitelisted-targets",
  "disabled-feature:scheduler-side-effects",
  "disabled-feature:unapproved-room-device-actions",
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

describe("Phase 20E.6 disabled-feature audit", () => {
  it("produces deterministic typed metadata-only disabled-feature audit output", () => {
    const report = buildDisabledFeatureAuditReport();

    expect(DisabledFeatureAuditReportSchema.safeParse(report).success).toBe(
      true,
    );
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(buildDisabledFeatureAuditReport()),
    );
    expect(report).toMatchObject({
      report_version: "20E.6",
      report_id: "phase-20e6-disabled-feature-audit",
      phase: "20E.6",
      verdict: "pass_with_deferred_notes",
      posture: {
        metadata_only: true,
        read_only: true,
        deterministic: true,
        audit_execution_enabled: false,
      },
    });
  }, 15000);

  it("covers every required disabled-feature audit focus", () => {
    const report = buildDisabledFeatureAuditReport();

    expect(report.findings.map((finding) => finding.finding_id)).toEqual([
      ...REQUIRED_FINDING_IDS,
    ]);
    expect(report.findings.map((finding) => finding.finding_id)).toEqual([
      ...DISABLED_FEATURE_AUDIT_FINDING_IDS,
    ]);
    expect(report.findings).toHaveLength(17);
  });

  it("represents wake-word, conversation mode, and voice-authorisation as deferred architecture posture, not enabled", () => {
    const report = buildDisabledFeatureAuditReport();

    for (const findingId of [
      "disabled-feature-audit:wake-word",
      "disabled-feature-audit:conversation-mode",
      "disabled-feature-audit:voice-authorisation-tiers",
    ]) {
      expect(
        report.findings.find((finding) => finding.finding_id === findingId),
      ).toMatchObject({
        status: "deferred",
        represented_as_disabled_or_deferred: true,
        architecture_amendment_required: true,
        blocking: false,
      });
    }

    expect(
      report.findings.find(
        (finding) =>
          finding.finding_id ===
          "disabled-feature-audit:voice-authorisation-tiers",
      ),
    ).toMatchObject({
      disabled_posture:
        "No voice-only approval, auto-approval, or new voice authority tier is enabled.",
    });
  });

  it("keeps critical disabled features represented as disabled or deferred", () => {
    const report = buildDisabledFeatureAuditReport();
    const representedFeatureIds = new Set(
      report.findings
        .filter((finding) => finding.represented_as_disabled_or_deferred)
        .flatMap((finding) => finding.feature_ids),
    );

    for (const featureId of CRITICAL_FEATURE_IDS) {
      expect(representedFeatureIds.has(featureId)).toBe(true);
    }

    expect(report.findings.every((finding) => finding.status !== "fail")).toBe(
      true,
    );
    expect(
      report.findings.every(
        (finding) => finding.represented_as_disabled_or_deferred,
      ),
    ).toBe(true);
  });

  it("classifies blocking findings and summary counts correctly", () => {
    const report = buildDisabledFeatureAuditReport();

    expect(report.blocking_findings).toEqual([]);
    expect(report.summary).toMatchObject({
      report_version: "20E.6",
      finding_count: 17,
      represented_count: 17,
      fail_count: 0,
      blocking_count: 0,
      critical_count: 16,
      high_count: 1,
      medium_count: 0,
      low_count: 0,
      architecture_amendment_required_count: 5,
      matrix_feature_count: 18,
      matrix_critical_feature_count: 17,
      deferred_move_in_item_count: 3,
      all_required_disabled_features_represented: true,
      phase20e_disabled_feature_audit_metadata_only: true,
      phase20e_capability_neutral: true,
    });
    expect(
      report.summary.pass_count +
        report.summary.warning_count +
        report.summary.pending_count +
        report.summary.deferred_count +
        report.summary.fail_count,
    ).toBe(report.findings.length);
  });

  it("links every finding to known cross-phase evidence ids", () => {
    const evidenceIds = new Set(AUDIT_EVIDENCE_IDS);
    const report = buildDisabledFeatureAuditReport();

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
    const report = buildDisabledFeatureAuditReport();

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
      expect.arrayContaining(["buildDisabledFeatureAuditReport"]),
    );
  });
});
