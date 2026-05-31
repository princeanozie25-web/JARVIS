import { describe, expect, it } from "vitest";

import * as finalSystemStatus from "./index";
import {
  FINAL_SYSTEM_PHASE_IDS,
  FINAL_SYSTEM_STATUS_REGISTRY,
  FinalReadinessSummarySchema,
  FinalSystemStatusRecordSchema,
  buildFinalReadinessSummary,
  getFinalSystemPhaseStatus,
  listAuthorityBearingFinalSystemSurfaces,
  listBlockedOrMissingFinalSystemItems,
  listDisabledFeatureFinalSystemSurfaces,
  listFinalSystemPhaseStatuses,
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

const FORBIDDEN_FIELD_NAMES = [
  "approve",
  "retry",
  "run",
  "mutate",
  "dispatch",
  "execute",
  "callTool",
  "payload",
] as const;

const RISKY_SURFACE_PHASES = [
  "phase-12",
  "phase-13",
  "phase-14",
  "phase-15",
  "phase-16",
  "phase-17",
  "phase-18",
  "phase-19",
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

describe("Phase 20A.1 final system status registry", () => {
  it("represents every completed core phase from Phase 10 through Phase 19 exactly once", () => {
    const statuses = listFinalSystemPhaseStatuses();

    expect(statuses.map((status) => status.phase_id)).toEqual([
      ...FINAL_SYSTEM_PHASE_IDS,
    ]);
    expect(new Set(statuses.map((status) => status.phase_id)).size).toBe(
      FINAL_SYSTEM_PHASE_IDS.length,
    );

    for (const status of statuses) {
      expect(FinalSystemStatusRecordSchema.safeParse(status).success).toBe(
        true,
      );
      expect(status.status).toMatch(/^complete/);
      expect(status.phase20_new_capability_introduced).toBe(false);
    }
  });

  it("keeps the static registry frozen and returns defensive-copy-safe records", () => {
    expect(Object.isFrozen(FINAL_SYSTEM_STATUS_REGISTRY)).toBe(true);
    expect(Object.isFrozen(FINAL_SYSTEM_STATUS_REGISTRY[0])).toBe(true);
    expect(Object.isFrozen(FINAL_SYSTEM_STATUS_REGISTRY[0].evidence)).toBe(
      true,
    );

    const phase10 = getFinalSystemPhaseStatus("phase-10");
    expect(phase10).toMatchObject({
      phase_id: "phase-10",
      phase_name: "Phase 10 Room OS Foundation",
    });

    if (phase10) {
      phase10.phase_name = "Mutated By Test";
      phase10.evidence[0].summary = "Mutated Evidence";
    }

    const freshPhase10 = getFinalSystemPhaseStatus("phase-10");
    expect(freshPhase10).toMatchObject({
      phase_id: "phase-10",
      phase_name: "Phase 10 Room OS Foundation",
    });
    expect(freshPhase10?.evidence[0].summary).toBe(
      "Bootstrap, doctor, and room registry contracts cover the local room substrate entry points.",
    );
  });

  it("builds a metadata-only final readiness summary without blocked or missing phases", () => {
    const summary = buildFinalReadinessSummary();

    expect(FinalReadinessSummarySchema.safeParse(summary).success).toBe(true);
    expect(summary).toMatchObject({
      contract_version: "20A.1",
      phase_count: 10,
      represented_phase_ids: [...FINAL_SYSTEM_PHASE_IDS],
      status_counts: {
        complete: 8,
        complete_with_notes: 2,
        blocked: 0,
        missing: 0,
        unknown: 0,
      },
      final_audit_status: "clear_with_notes",
      packaging_status: "clear_with_notes",
      move_in_status: "clear_with_notes",
      onboarding_status: "clear_with_notes",
      portfolio_status: "clear_with_notes",
      blocked_or_missing_count: 0,
      metadata_only: true,
      read_only: true,
      raw_payload_included: false,
    });

    expect(listBlockedOrMissingFinalSystemItems()).toEqual([]);
  });

  it("lists authority-bearing surfaces and requires approval or governance posture for each", () => {
    const authoritySurfaces = listAuthorityBearingFinalSystemSurfaces();

    expect(authoritySurfaces.map((record) => record.phase_id)).toEqual([
      "phase-16",
      "phase-18",
      "phase-19",
    ]);

    for (const record of authoritySurfaces) {
      expect(record.authority_posture.authority_bearing).toBe(true);
      expect(record.authority_posture.posture).not.toBe("no_authority_surface");
      expect(record.authority_posture.governance_summary).toMatch(
        /approval|governance/i,
      );
      expect(record.authority_posture.governance_refs.length).toBeGreaterThan(
        0,
      );
      expect(
        record.authority_posture.new_authority_surface_created_by_phase_20,
      ).toBe(false);
    }
  });

  it("declares disabled-feature posture for phases with risky surfaces", () => {
    const disabledSurfaces = listDisabledFeatureFinalSystemSurfaces();
    const disabledSurfacePhaseIds = disabledSurfaces.map(
      (record) => record.phase_id,
    );

    for (const phaseId of RISKY_SURFACE_PHASES) {
      expect(disabledSurfacePhaseIds).toContain(phaseId);
    }

    for (const record of disabledSurfaces) {
      expect(record.disabled_feature_posture.summary.length).toBeGreaterThan(0);

      for (const surface of record.disabled_feature_posture.surfaces) {
        expect(surface.remains_disabled).toBe(true);
        expect(surface.enablement_requires_future_governance).toBe(true);
      }
    }
  });

  it("proves Phase 20A.1 introduces no provider calls, routes, room control, raw payloads, or new capability flags", () => {
    const summary = buildFinalReadinessSummary();

    expect(summary.phase20_capability_posture).toEqual({
      new_capabilities_introduced: false,
      new_authority_surface_created: false,
      execution_hooks_added: false,
      provider_calls_enabled: false,
      network_calls_enabled: false,
      filesystem_mutation_enabled: false,
      route_added: false,
      room_device_control_enabled: false,
    });

    for (const record of listFinalSystemPhaseStatuses()) {
      expect(record).toMatchObject({
        metadata_only: true,
        read_only: true,
        provider_calls_enabled: false,
        network_calls_enabled: false,
        filesystem_mutation_enabled: false,
        route_added: false,
        routine_execution_enabled: false,
        room_device_control_enabled: false,
        raw_payload_included: false,
        phase20_new_capability_introduced: false,
      });
      expect(record.phase_id).not.toBe("phase-20");
    }
  });

  it("exports no execution hooks or active mutating affordance names", () => {
    const exportedFunctionNames = Object.entries(finalSystemStatus)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });

  it("does not expose mutating field names or raw payload fields", () => {
    const allKeys = collectKeys({
      records: listFinalSystemPhaseStatuses(),
      summary: buildFinalReadinessSummary(),
    });

    for (const forbiddenName of FORBIDDEN_FIELD_NAMES) {
      expect(allKeys).not.toContain(forbiddenName);
    }

    expect(allKeys).not.toContain("raw_prompt");
    expect(allKeys).not.toContain("raw_model_output");
    expect(allKeys).not.toContain("raw_voice_transcript");
    expect(allKeys).not.toContain("raw_ocr_text");
    expect(allKeys).not.toContain("raw_frame");
    expect(allKeys).not.toContain("secret");
  });
});
