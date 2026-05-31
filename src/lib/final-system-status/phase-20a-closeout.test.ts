import { describe, expect, it } from "vitest";

import * as finalSystemStatus from "./index";
import {
  FINAL_SYSTEM_PHASE_IDS,
  PHASE_20A_CLOSEOUT_CHECK_IDS,
  PHASE_20A_MODULE_IDS,
  Phase20ACloseoutReportSchema,
  buildFinalGovernanceReadinessSummary,
  buildPhase20ACloseoutReport,
  getCriticalDisabledFeatures,
  getExecutableAuthoritySurfaces,
  getFinalAuthoritySurfaceInventory,
  getNetworkCapableAuthoritySurfaces,
  listBlockedOrMissingFinalSystemItems,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "approve",
  "retry",
  "run",
  "mutate",
  "dispatch",
  "execute",
  "callTool",
] as const;

const FORBIDDEN_CLOSEOUT_KEYS = [
  "raw_payload",
  "raw_payloads",
  "raw_prompt",
  "raw_model_output",
  "raw_voice_transcript",
  "raw_ocr_text",
  "raw_frame",
  "action_payload",
  "tool_arguments",
  "mutation_enabled",
  "dispatch_enabled",
  "execution_enabled",
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

describe("Phase 20A.6 final readiness layer closeout", () => {
  it("builds a typed deterministic metadata-only closeout report", () => {
    const report = buildPhase20ACloseoutReport();

    expect(Phase20ACloseoutReportSchema.safeParse(report).success).toBe(true);
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(buildPhase20ACloseoutReport()),
    );
    expect(report).toMatchObject({
      closeout_version: "20A.6",
      report_id: "phase-20a-final-readiness-layer-closeout",
      verdict: "pass",
      deterministic: true,
      metadata_only: true,
      read_only: true,
    });
  });

  it("includes every Phase 20A module and closeout check", () => {
    const report = buildPhase20ACloseoutReport();

    expect(report.included_modules).toEqual([...PHASE_20A_MODULE_IDS]);
    expect(report.checks.map((check) => check.check_id)).toEqual([
      ...PHASE_20A_CLOSEOUT_CHECK_IDS,
    ]);

    for (const check of report.checks) {
      expect(check.passed).toBe(true);
      expect(check.metadata_only).toBe(true);
      expect(check.read_only).toBe(true);
      expect(report.included_modules).toContain(check.evidence_id);
    }
  });

  it("proves phase coverage matches Phases 10 through 19", () => {
    expect(buildPhase20ACloseoutReport().phase_coverage_ids).toEqual([
      ...FINAL_SYSTEM_PHASE_IDS,
    ]);
  });

  it("keeps blocked or missing phase reporting aligned with the registry", () => {
    const report = buildPhase20ACloseoutReport();
    const blockedOrMissing = listBlockedOrMissingFinalSystemItems();

    expect(report.blocked_or_missing_phase_ids).toEqual(
      blockedOrMissing.map((record) => record.phase_id),
    );
    expect(report.blocked_or_missing_phase_ids).toEqual([]);
  });

  it("proves critical disabled features remain disabled", () => {
    const report = buildPhase20ACloseoutReport();
    const criticalFeatures = getCriticalDisabledFeatures();

    expect(report.critical_disabled_feature_count).toBe(
      criticalFeatures.length,
    );

    for (const feature of criticalFeatures) {
      expect(feature.final_phase20_posture).toMatch(/^remains_disabled/);
      expect(feature.creates_new_capability).toBe(false);
      expect(feature.creates_new_authority).toBe(false);
      expect(feature.performs_side_effect).toBe(false);
    }
  });

  it("proves authority-surface posture holds", () => {
    const report = buildPhase20ACloseoutReport();

    expect(report.authority_surface_count).toBe(
      getFinalAuthoritySurfaceInventory().length,
    );
    expect(report.runtime_capable_surface_count).toBe(
      getExecutableAuthoritySurfaces().length,
    );
    expect(report.network_capable_surface_count).toBe(
      getNetworkCapableAuthoritySurfaces().length,
    );

    for (const surface of getExecutableAuthoritySurfaces()) {
      expect(surface.approval_requirement).not.toBe(
        "disabled_no_approval_path",
      );

      if (surface.approval_requirement === "not_applicable") {
        expect(surface.governance_notes).toMatch(
          /governance|governed|local-first|redaction|cost|advisory/i,
        );
      }
    }
  });

  it("includes the governance summary and declares Phase 20B readiness", () => {
    const report = buildPhase20ACloseoutReport();
    const governanceSummary = buildFinalGovernanceReadinessSummary();

    expect(report.governance_summary_id).toBe(governanceSummary.summary_id);
    expect(report.phase20a_complete).toBe(true);
    expect(
      report.phase20b_ready_for_packaging_bootstrap_onboarding_hardening,
    ).toBe(true);
  });

  it("proves Phase 20A capability neutrality with zero-count constraints", () => {
    expect(buildPhase20ACloseoutReport().capability_neutrality).toEqual({
      runtime_hook_count: 0,
      provider_call_count: 0,
      network_call_count: 0,
      ui_route_count: 0,
      room_device_command_count: 0,
      approval_bypass_count: 0,
      runtime_filesystem_mutation_count: 0,
      authority_surface_delta_count: 0,
      phase20_capability_delta_count: 0,
      metadata_only: true,
      read_only: true,
    });
  });

  it("does not expose forbidden raw, mutating, or runtime affordance field names", () => {
    const keys = collectKeys(buildPhase20ACloseoutReport());

    for (const forbiddenKey of FORBIDDEN_CLOSEOUT_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }
  });

  it("exports no execution or mutation affordance names", () => {
    const exportedFunctionNames = Object.entries(finalSystemStatus)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
