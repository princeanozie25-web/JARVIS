import { describe, expect, it } from "vitest";

import * as governanceVisualizer from "./index";
import {
  PHASE_19C_CLOSEOUT_CHECK_IDS,
  PHASE_19C_DISABLED_CAPABILITIES,
  PHASE_19C_VIEWER_LOCAL_CONTROLS,
  PHASE_19C_VIEWER_REQUIRED_SECTIONS,
  Phase19CCloseoutReportSchema,
  assertPhase19CCloseoutPasses,
  buildPhase19CCloseoutReport,
  buildGovernanceBoundaryProjection,
  listPhase19CDisabledCapabilities,
  scanGovernanceBoundarySafety,
  validateGovernanceBoundaryProjection,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "execute",
  "retry",
  "approve",
  "run",
  "mutate",
  "dispatch",
  "callTool",
  "grantAuthority",
  "editPolicy",
] as const;

const FORBIDDEN_RAW_KEYS = [
  "prompt",
  "raw_prompt",
  "model_output",
  "raw_model_output",
  "tool_args",
  "tool_arguments",
  "approval_token",
  "raw_approval_token",
  "voice_transcript",
  "raw_voice_transcript",
  "audio",
  "raw_audio",
  "ocr_text",
  "raw_ocr_text",
  "frame",
  "raw_frame",
  "screenshot",
  "raw_screenshot",
  "api_key",
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

describe("Phase 19C.5 governance boundary final feature closeout", () => {
  it("returns PASS WITH NOTES for the current implementation", () => {
    expect(buildPhase19CCloseoutReport()).toMatchObject({
      report_version: "19C.5",
      report_id: "phase-19c-governance-boundary-closeout",
      verdict: "PASS_WITH_NOTES",
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      feature_complete_for_phase_19c: true,
      foundation_only: false,
      viewer_route: "/audit/governance-boundaries",
      viewer_route_visible: true,
      viewer_sections: PHASE_19C_VIEWER_REQUIRED_SECTIONS,
      viewer_local_controls: PHASE_19C_VIEWER_LOCAL_CONTROLS,
      viewer_safety_guarded_before_render: true,
      tripwires_warning_only: true,
      forbidden_edges_non_executable: true,
      graph_chart_libraries_added: false,
      filesystem_read: false,
      database_read: false,
      telemetry_ingested: false,
      runtime_observer_created: false,
      authority_surface_created: false,
      approval_policy_mutated: false,
      side_effects_performed: false,
      phase_18_boundaries_modified: false,
    });
    expect(
      Phase19CCloseoutReportSchema.safeParse(buildPhase19CCloseoutReport())
        .success,
    ).toBe(true);
  });

  it("contains every required closeout check", () => {
    const report = buildPhase19CCloseoutReport();

    expect(report.checks.map((check) => check.check_id)).toEqual(
      PHASE_19C_CLOSEOUT_CHECK_IDS,
    );
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it("lists all disabled Phase 19C capabilities", () => {
    expect(listPhase19CDisabledCapabilities()).toEqual(
      PHASE_19C_DISABLED_CAPABILITIES,
    );
    expect(listPhase19CDisabledCapabilities()).toEqual(
      expect.arrayContaining([
        "graph/chart libraries",
        "execution",
        "approval decisions",
        "approval policy mutation",
        "trust-class mutation",
        "runtime control",
        "filesystem reads",
        "database reads",
        "telemetry ingestion",
        "runtime observers",
        "authority surfaces",
        "authority token creation",
        "side effects",
        "graph-driven execution",
        "policy editing from UI",
      ]),
    );
  });

  it("assertion helper passes for the current implementation", () => {
    expect(() => assertPhase19CCloseoutPasses()).not.toThrow();
  });

  it("report output is deterministic", () => {
    expect(JSON.stringify(buildPhase19CCloseoutReport())).toBe(
      JSON.stringify(buildPhase19CCloseoutReport()),
    );
  });

  it("report output is defensive-copy-safe", () => {
    const report = buildPhase19CCloseoutReport();
    report.checks[0].label = "Mutated Closeout Report";
    report.disabled_capabilities[0] = "side effects";

    const freshReport = buildPhase19CCloseoutReport();
    expect(freshReport.checks[0]).toMatchObject({
      check_id: "phase_19c1_contracts_projection_exist",
      label: "Phase 19C.1 contracts and projection exist.",
    });
    expect(freshReport.disabled_capabilities[0]).toBe("graph/chart libraries");
  });

  it("closeout output does not leak forbidden raw data", () => {
    const report = buildPhase19CCloseoutReport();
    const keys = collectKeys(report);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(scanGovernanceBoundarySafety(report)).toMatchObject({
      passed: true,
      violation_count: 0,
      metadata_only: true,
      read_only: true,
    });
  });

  it("governance visualizer suite remains aligned with Phase 19C.1 through 19C.5", () => {
    expect(
      validateGovernanceBoundaryProjection(buildGovernanceBoundaryProjection()),
    ).toMatchObject({
      valid: true,
      reason: "valid_governance_boundary_projection",
    });
    expect(buildGovernanceBoundaryProjection()).toMatchObject({
      contract_version: "19C.1",
      metadata_only: true,
      read_only: true,
      redaction_safe: true,
      filesystem_read: false,
      database_read: false,
      telemetry_ingested: false,
      runtime_observer_created: false,
      authority_surface_created: false,
      phase_18_boundaries_modified: false,
    });
    expect(
      buildPhase19CCloseoutReport().evidence.map((item) => item.source_slice),
    ).toEqual(["19C.1", "19C.2", "19C.3", "19C.4", "19C.5"]);
  });

  it("closeout exports introduce no forbidden affordance names", () => {
    const exportedFunctionNames = Object.entries(governanceVisualizer)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
