import { describe, expect, it } from "vitest";

import { buildPhase21RealizationReport } from ".";

describe("Phase 21 realization bundle status report", () => {
  it("classifies every Phase 21 capability from 21A through 21K", () => {
    const report = buildPhase21RealizationReport();
    const byId = new Map(report.slices.map((slice) => [slice.slice_id, slice]));

    expect(report.title).toBe("Phase 21 final closeout status report");
    expect(report.slices.map((slice) => slice.slice_id)).toEqual([
      "21A",
      "21B-R",
      "21C",
      "21D",
      "21E",
      "21F-R",
      "21G-R",
      "21H",
      "21I-R",
      "21J",
      "21K",
    ]);
    expect(byId.get("21A")).toMatchObject({
      classification: "realized",
      execution_enabled: true,
      adapter_or_writer_injected: true,
    });
    expect(byId.get("21B-R")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
    });
    expect(byId.get("21C")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      adapter_or_writer_injected: true,
    });
    expect(byId.get("21D")).toMatchObject({
      classification: "realized",
      execution_enabled: true,
      adapter_or_writer_injected: true,
    });
    expect(byId.get("21E")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
      adapter_or_writer_injected: true,
    });
    expect(byId.get("21F-R")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      adapter_or_writer_injected: true,
    });
    expect(byId.get("21G-R")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
      adapter_or_writer_injected: true,
    });
    expect(byId.get("21H")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      adapter_or_writer_injected: true,
    });
    expect(byId.get("21I-R")).toMatchObject({
      classification: "execution_enabled",
      execution_enabled: true,
      approval_gated: true,
    });
    expect(byId.get("21J")).toMatchObject({
      classification: "realized",
      execution_enabled: false,
    });
    expect(byId.get("21K")).toMatchObject({
      classification: "realized",
      execution_enabled: false,
    });
  });

  it("reports Phase 21 closeout unblocked and Expansion Era Refresh permitted", () => {
    const report = buildPhase21RealizationReport();

    expect(report.remaining_avoidable_scaffold_only_work).toEqual([]);
    expect(report.phase_21_closeout_unblocked).toBe(true);
    expect(report.phase_21_may_close).toBe(true);
    expect(report.expansion_era_refresh_may_begin).toBe(true);
    expect(report.closeout_note).toContain("does not itself perform");
    expect(report.governance).toMatchObject({
      approval_lifecycle_required_for_side_effects: true,
      no_auto_execution: true,
      no_silent_writes: true,
      no_background_sync: true,
      no_raw_email_job_vault_or_social_body_telemetry: true,
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
      if (["21B-R", "21E", "21G-R", "21I-R"].includes(slice.slice_id)) {
        expect(slice.approval_gated).toBe(true);
      }
    }
  });
});
