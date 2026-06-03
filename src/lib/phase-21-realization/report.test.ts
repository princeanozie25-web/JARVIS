import { describe, expect, it } from "vitest";

import { buildPhase21RealizationReport } from ".";

describe("Phase 21 realization bundle status report", () => {
  it("classifies the remaining blocker slices as realized or execution enabled", () => {
    const report = buildPhase21RealizationReport();
    const byId = new Map(report.slices.map((slice) => [slice.slice_id, slice]));

    expect(byId.get("21F-R")).toMatchObject({
      classification: "realized",
      execution_enabled: true,
      adapter_or_writer_injected: true,
    });
    expect(byId.get("21G-R")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
      adapter_or_writer_injected: true,
    });
    expect(byId.get("21B-R")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
    });
    expect(byId.get("21I-R")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
    });
  });

  it("reports Phase 21 closeout unblocked without claiming Phase 21 closed", () => {
    const report = buildPhase21RealizationReport();

    expect(report.remaining_avoidable_scaffold_only_work).toEqual([]);
    expect(report.phase_21_closeout_unblocked).toBe(true);
    expect(report.closeout_note).toContain("does not itself close Phase 21");
    expect(report.governance).toMatchObject({
      approval_lifecycle_required_for_side_effects: true,
      no_auto_execution: true,
      no_silent_writes: true,
      no_background_sync: true,
      no_raw_email_job_or_vault_body_telemetry: true,
      injected_boundary_required_for_provider_network_tool_calls: true,
      phase_21_closed_claimed: false,
    });
  });

  it("keeps every realized side-effect path governed and metadata-only", () => {
    const report = buildPhase21RealizationReport();

    for (const slice of report.slices) {
      expect(slice.telemetry_metadata_only).toBe(true);
      expect(slice.auto_execution_enabled).toBe(false);
      expect(slice.silent_write_enabled).toBe(false);
      expect(slice.raw_payload_telemetry_enabled).toBe(false);
      if (slice.slice_id !== "21F-R") {
        expect(slice.approval_gated).toBe(true);
      }
    }
  });
});
