import { describe, expect, it } from "vitest";

import * as architectureGraph from "./index";
import {
  PHASE_19A_CLOSEOUT_CHECK_IDS,
  PHASE_19A_DISABLED_CAPABILITIES,
  Phase19ACloseoutReportSchema,
  assertPhase19ACloseoutPasses,
  buildArchitectureGraphProjection,
  buildPhase19ACloseoutReport,
  listPhase19ADisabledCapabilities,
  scanArchitectureGraphSafety,
  validateArchitectureGraphMetadata,
  getStaticArchitectureGraph,
} from "./index";

const FORBIDDEN_EXPORT_NAMES = [
  "execute",
  "retry",
  "approve",
  "run",
  "mutate",
  "dispatch",
  "callTool",
] as const;

const FORBIDDEN_RAW_KEYS = [
  "raw_prompt",
  "prompt",
  "raw_model_output",
  "model_output",
  "tool_args",
  "tool_arguments",
  "approval_token",
  "raw_approval_token",
  "raw_voice_transcript",
  "voice_transcript",
  "raw_audio_reference",
  "audio_reference",
  "raw_ocr_text",
  "ocr_text",
  "raw_frame",
  "frame",
  "raw_screenshot",
  "screenshot",
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

describe("Phase 19A.6 architecture graph closeout guard", () => {
  it("returns PASS WITH NOTES for the current implementation", () => {
    expect(buildPhase19ACloseoutReport()).toMatchObject({
      report_version: "19A.6",
      report_id: "phase-19a-architecture-graph-closeout",
      verdict: "PASS_WITH_NOTES",
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      ready_for_future_ui_rendering: true,
      ui_rendered: false,
      react_flow_or_d3_added: false,
      source_imports_parsed: false,
      filesystem_read: false,
      database_read: false,
      telemetry_ingested: false,
      runtime_observer_created: false,
      authority_surface_created: false,
      side_effects_performed: false,
      phase_18_boundaries_modified: false,
    });
    expect(
      Phase19ACloseoutReportSchema.safeParse(buildPhase19ACloseoutReport())
        .success,
    ).toBe(true);
  });

  it("contains every required closeout check", () => {
    expect(
      buildPhase19ACloseoutReport().checks.map((check) => check.check_id),
    ).toEqual(PHASE_19A_CLOSEOUT_CHECK_IDS);
    expect(
      buildPhase19ACloseoutReport().checks.every((check) => check.passed),
    ).toBe(true);
  });

  it("lists all disabled Phase 19A capabilities", () => {
    expect(listPhase19ADisabledCapabilities()).toEqual(
      PHASE_19A_DISABLED_CAPABILITIES,
    );
    expect(listPhase19ADisabledCapabilities()).toEqual(
      expect.arrayContaining([
        "UI rendering",
        "React Flow/D3 graph rendering",
        "source import parsing",
        "filesystem scanning",
        "database reads",
        "telemetry ingestion",
        "runtime observers",
        "observed runtime graph",
        "graph-driven execution",
        "run/retry/approve/execute/mutate/dispatch affordances",
        "tool calls",
        "approval decisions",
        "authority token creation",
        "side effects",
      ]),
    );
  });

  it("assertion helper passes for current implementation", () => {
    expect(() => assertPhase19ACloseoutPasses()).not.toThrow();
  });

  it("report output is deterministic", () => {
    expect(JSON.stringify(buildPhase19ACloseoutReport())).toBe(
      JSON.stringify(buildPhase19ACloseoutReport()),
    );
  });

  it("report output is defensive-copy-safe", () => {
    const report = buildPhase19ACloseoutReport();
    report.checks[0].label = "Mutated Closeout Report";
    report.disabled_capabilities[0] = "side effects";

    const freshReport = buildPhase19ACloseoutReport();
    expect(freshReport.checks[0]).toMatchObject({
      check_id: "phase_19a1_contracts_exist",
      label: "Phase 19A.1 graph contracts exist.",
    });
    expect(freshReport.disabled_capabilities[0]).toBe("UI rendering");
  });

  it("closeout output does not leak forbidden raw data", () => {
    const report = buildPhase19ACloseoutReport();
    const keys = collectKeys(report);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(scanArchitectureGraphSafety(report)).toMatchObject({
      valid: true,
      violation_count: 0,
      metadata_only: true,
      read_only: true,
    });
  });

  it("architecture graph suite remains aligned with Phase 19A.1 through 19A.5", () => {
    expect(
      validateArchitectureGraphMetadata(getStaticArchitectureGraph()),
    ).toMatchObject({
      valid: true,
      reason: "valid_architecture_graph_metadata",
    });
    expect(buildArchitectureGraphProjection()).toMatchObject({
      contract_version: "19A.4",
      underlying_graph_validated: true,
      raw_fields_exposed: false,
      action_affordances_exposed: false,
    });
    expect(
      buildPhase19ACloseoutReport().evidence.map((item) => item.source_slice),
    ).toEqual(["19A.1", "19A.2", "19A.3", "19A.4", "19A.5"]);
  });

  it("closeout exports introduce no execution affordance names", () => {
    const exportedFunctionNames = Object.entries(architectureGraph)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
