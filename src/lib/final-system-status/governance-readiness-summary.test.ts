import { describe, expect, it } from "vitest";

import * as finalSystemStatus from "./index";
import {
  FINAL_SYSTEM_PHASE_IDS,
  FinalGovernanceReadinessSummarySchema,
  buildFinalGovernanceReadinessSummary,
  getCriticalDisabledFeatures,
  getExecutableAuthoritySurfaces,
  getFinalAuthoritySurfaceInventory,
  getNetworkCapableAuthoritySurfaces,
  listBlockedOrMissingFinalSystemItems,
  summarizeAuthoritySurfacePosture,
  summarizeDisabledFeaturePosture,
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

const FORBIDDEN_SUMMARY_KEYS = [
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

describe("Phase 20A.5 final governance readiness summary", () => {
  it("builds a typed deterministic metadata-only summary from existing Phase 20A modules", () => {
    const summary = buildFinalGovernanceReadinessSummary();

    expect(
      FinalGovernanceReadinessSummarySchema.safeParse(summary).success,
    ).toBe(true);
    expect(JSON.stringify(summary)).toBe(
      JSON.stringify(buildFinalGovernanceReadinessSummary()),
    );
    expect(summary).toMatchObject({
      summary_version: "20A.5",
      summary_id: "phase-20a5-final-governance-readiness-summary",
      verdict: "governance_ready_for_phase20_hardening",
      governance_ready_for_phase20_hardening: true,
      derived_from: [
        "phase-20a1:final-system-status-registry",
        "phase-20a2:final-readiness-report",
        "phase-20a3:final-disabled-feature-matrix",
        "phase-20a4:final-authority-surface-inventory",
      ],
      deterministic: true,
      metadata_only: true,
      read_only: true,
    });
  });

  it("keeps phases 10 through 19 represented", () => {
    const summary = buildFinalGovernanceReadinessSummary();

    expect(summary.phase_coverage).toEqual({
      phases_10_19_represented: true,
      represented_phase_ids: [...FINAL_SYSTEM_PHASE_IDS],
      registry_phase_count: 10,
      report_phase_count: 10,
      metadata_only: true,
      read_only: true,
    });
  });

  it("reports no blocked or missing items unless the registry reports them", () => {
    const summary = buildFinalGovernanceReadinessSummary();
    const blockedOrMissing = listBlockedOrMissingFinalSystemItems();

    expect(summary.blocked_missing).toEqual({
      blocked_or_missing_count: blockedOrMissing.length,
      blocked_or_missing_phase_ids: blockedOrMissing.map(
        (record) => record.phase_id,
      ),
      none_reported_unless_registry_reports_them: true,
      metadata_only: true,
      read_only: true,
    });
    expect(summary.blocked_missing.blocked_or_missing_count).toBe(0);
  });

  it("derives disabled-feature readiness from the final disabled-feature matrix", () => {
    const summary = buildFinalGovernanceReadinessSummary();
    const disabledFeatureSummary = summarizeDisabledFeaturePosture();
    const criticalFeatures = getCriticalDisabledFeatures();

    expect(summary.disabled_features).toMatchObject({
      feature_count: disabledFeatureSummary.feature_count,
      critical_feature_count: disabledFeatureSummary.critical_feature_count,
      all_features_remain_disabled: true,
      all_critical_features_remain_disabled: true,
      no_phase20_capability_created_by_matrix: true,
      metadata_only: true,
      read_only: true,
    });

    for (const feature of criticalFeatures) {
      expect(feature.final_phase20_posture).toMatch(/^remains_disabled/);
      expect(feature.creates_new_capability).toBe(false);
      expect(feature.creates_new_authority).toBe(false);
      expect(feature.performs_side_effect).toBe(false);
    }
  });

  it("derives authority-surface readiness from the final authority inventory", () => {
    const summary = buildFinalGovernanceReadinessSummary();
    const authoritySummary = summarizeAuthoritySurfacePosture();

    expect(summary.authority_surfaces).toEqual({
      surface_count: authoritySummary.surface_count,
      authority_surfaces_documented: true,
      approval_required_surface_count:
        authoritySummary.approval_required_surface_count,
      execution_capable_surface_count:
        authoritySummary.executable_surface_count,
      network_capable_surface_count:
        authoritySummary.network_capable_surface_count,
      new_authority_surface_count: 0,
      metadata_only: true,
      read_only: true,
    });
  });

  it("requires execution-capable surfaces to have approval or governance posture", () => {
    const summary = buildFinalGovernanceReadinessSummary();

    expect(
      summary.approval_governance
        .execution_capable_surfaces_have_governance_posture,
    ).toBe(true);

    for (const surface of getExecutableAuthoritySurfaces()) {
      expect(surface.execute_authority).not.toBe("none");
      expect(surface.auto_approval_allowed).toBe(false);
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

  it("confirms network-capable surfaces are local-first, cloud-gated, or whitelisted", () => {
    const summary = buildFinalGovernanceReadinessSummary();

    expect(summary.network_governance).toMatchObject({
      network_capable_surfaces_governed: true,
      network_calls_performed: false,
      metadata_only: true,
      read_only: true,
    });
    expect(summary.network_governance.network_capable_surface_ids).toEqual(
      getNetworkCapableAuthoritySurfaces().map((surface) => surface.surface_id),
    );

    for (const surface of getNetworkCapableAuthoritySurfaces()) {
      expect(summary.network_governance.allowed_network_postures).toContain(
        surface.network_posture,
      );
    }
  });

  it("confirms there is no auto-approval or source-material-allowed posture", () => {
    const summary = buildFinalGovernanceReadinessSummary();

    expect(summary.approval_governance).toMatchObject({
      auto_approval_surface_count: 0,
      auto_approval_posture_present: false,
    });
    expect(summary.source_material).toEqual({
      source_material_allowed_surface_count: 0,
      source_material_allowed_posture_present: false,
      redaction_or_metadata_only_posture: true,
      metadata_only: true,
      read_only: true,
    });

    for (const surface of getFinalAuthoritySurfaceInventory()) {
      expect(surface.auto_approval_allowed).toBe(false);
      expect(surface.raw_payload_posture).not.toContain("allowed");
    }
  });

  it("reports Phase 20 capability-neutral posture", () => {
    expect(
      buildFinalGovernanceReadinessSummary().capability_neutrality,
    ).toEqual({
      phase20_capability_neutral: true,
      no_new_phase20_capability: true,
      no_new_authority_surface: true,
      no_provider_call: true,
      no_network_call: true,
      no_runtime_filesystem_mutation: true,
      no_execution_hook: true,
      no_room_device_action: true,
      no_approval_bypass: true,
      metadata_only: true,
      read_only: true,
    });
  });

  it("does not expose raw, mutating, or execution field names", () => {
    const keys = collectKeys(buildFinalGovernanceReadinessSummary());

    for (const forbiddenKey of FORBIDDEN_SUMMARY_KEYS) {
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
