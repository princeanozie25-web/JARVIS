import { describe, expect, it } from "vitest";

import * as finalSystemStatus from "./index";
import {
  FINAL_SYSTEM_PHASE_IDS,
  FinalReadinessReportSchema,
  buildFinalReadinessReport,
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

const FORBIDDEN_RAW_KEYS = [
  "raw_prompt",
  "raw_model_output",
  "raw_voice_transcript",
  "raw_ocr_text",
  "raw_frame",
  "secret",
  "secrets",
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

describe("Phase 20A.2 final readiness report generator", () => {
  it("builds a typed metadata-only report from the final-system-status registry", () => {
    const report = buildFinalReadinessReport();

    expect(FinalReadinessReportSchema.safeParse(report).success).toBe(true);
    expect(report).toMatchObject({
      report_version: "20A.2",
      report_id: "phase-20a2-final-readiness-report",
      generated_from: "final-system-status-registry",
      deterministic: true,
      metadata_only: true,
      read_only: true,
      no_ui_route_added: true,
      provider_calls_enabled: false,
      network_calls_enabled: false,
      filesystem_mutation_enabled: false,
      execution_hooks_added: false,
      room_device_actions_enabled: false,
      approval_bypass_enabled: false,
      raw_payloads_included: false,
      phase20_new_capabilities_introduced: false,
    });
  });

  it("is deterministic across repeated builds", () => {
    expect(JSON.stringify(buildFinalReadinessReport())).toBe(
      JSON.stringify(buildFinalReadinessReport()),
    );
  });

  it("covers phases 10 through 19 and separates complete-with-notes phases", () => {
    const report = buildFinalReadinessReport();

    expect(report.phase_coverage).toMatchObject({
      represented_phase_ids: [...FINAL_SYSTEM_PHASE_IDS],
      all_core_phases_represented: true,
      blocked_or_missing_phase_ids: [],
      metadata_only: true,
      read_only: true,
    });
    expect(report.phase_coverage.complete_with_notes_phase_ids).toEqual([
      "phase-10",
      "phase-19",
    ]);
    expect(report.summary.completed_phase_count).toBe(8);
    expect(report.summary.complete_with_notes_phase_count).toBe(2);
    expect(report.summary.blocked_or_missing_phase_count).toBe(0);
  });

  it("includes required readiness sections for final audits and Phase 20 packaging work", () => {
    const report = buildFinalReadinessReport();
    const categories = report.readiness_categories.map(
      (section) => section.category,
    );

    expect(categories).toEqual([
      "final_audit",
      "packaging",
      "move_in",
      "onboarding",
      "portfolio",
      "disabled_feature_matrix",
    ]);
    expect(report.packaging_readiness.phase_ids).toContain("phase-11");
    expect(report.move_in_readiness.phase_ids).toContain("phase-16");
    expect(report.portfolio_readiness.phase_ids).toContain("phase-19");
    expect(report.packaging_readiness.status).toBe("clear_with_notes");
    expect(report.move_in_readiness.status).toBe("clear_with_notes");
    expect(report.portfolio_readiness.status).toBe("clear_with_notes");
  });

  it("summarizes authority-bearing surfaces with governance posture only", () => {
    const report = buildFinalReadinessReport();

    expect(
      report.authority_surfaces.map((surface) => surface.phase_id),
    ).toEqual(["phase-16", "phase-18", "phase-19"]);

    for (const surface of report.authority_surfaces) {
      expect(surface.governance_summary).toMatch(/approval|governance/i);
      expect(surface.governance_refs.length).toBeGreaterThan(0);
      expect(surface.new_authority_surface_created_by_phase_20).toBe(false);
      expect(surface.metadata_only).toBe(true);
      expect(surface.read_only).toBe(true);
    }
  });

  it("summarizes disabled-feature posture without enabling any surface", () => {
    const report = buildFinalReadinessReport();
    const surfaces = report.disabled_features.flatMap(
      (section) => section.surfaces,
    );

    expect(surfaces.length).toBe(report.summary.disabled_feature_surface_count);
    expect(surfaces.length).toBeGreaterThan(0);

    for (const surface of surfaces) {
      expect(surface.remains_disabled).toBe(true);
      expect(surface.enablement_requires_future_governance).toBe(true);
    }
  });

  it("emits a final governance verdict that preserves Phase 20 constraints", () => {
    const report = buildFinalReadinessReport();

    expect(report.governance_verdict).toEqual({
      verdict: "pass_with_notes",
      summary:
        "Final governance posture remains local-first, replay-safe, approval-gated, redaction-aware, metadata-only, and non-authoritative for Phase 20A.2.",
      approval_bypass_detected: false,
      new_phase20_capabilities_introduced: false,
      execution_hooks_added: false,
      provider_calls_enabled: false,
      network_calls_enabled: false,
      room_device_control_enabled: false,
      raw_payloads_included: false,
      metadata_only: true,
      read_only: true,
    });
  });

  it("contains no raw payload keys or mutating/action fields", () => {
    const keys = collectKeys(buildFinalReadinessReport());

    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(forbiddenKey);
    }

    expect(keys).not.toContain("payload");
    expect(keys).not.toContain("action_payload");
    expect(keys).not.toContain("tool_arguments");
    expect(keys).not.toContain("mutation_enabled");
    expect(keys).not.toContain("dispatch_enabled");
  });

  it("exports no execution hooks or active mutating affordance names", () => {
    const exportedFunctionNames = Object.entries(finalSystemStatus)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
