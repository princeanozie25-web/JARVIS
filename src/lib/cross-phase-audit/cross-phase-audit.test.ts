import { describe, expect, it } from "vitest";

import * as crossPhaseAudit from "./index";
import {
  AUDIT_DIMENSION_IDS,
  AUDIT_EXPECTATION_IDS,
  AUDIT_PHASE_IDS,
  AUDIT_SURFACE_IDS,
  CROSS_PHASE_AUDIT_CONTRACT,
  CrossPhaseAuditContractSchema,
  getAuditDimensions,
  getAuditExpectations,
  getAuditSurfaces,
  getCrossPhaseAuditContract,
  summarizeCrossPhaseAuditContract,
} from "./index";

const REQUIRED_SURFACE_IDS = [
  "audit-surface:phase-10-room-os",
  "audit-surface:phase-11-persistence",
  "audit-surface:phase-12-command-center",
  "audit-surface:phase-13-model-runtime",
  "audit-surface:phase-14-voice-runtime",
  "audit-surface:phase-15-vision-runtime",
  "audit-surface:phase-16-room-runtime",
  "audit-surface:phase-17-scheduled-assistance",
  "audit-surface:phase-18-approval-runtime",
  "audit-surface:phase-19-fortress-layer",
  "audit-surface:phase-20a-readiness",
  "audit-surface:phase-20b-bootstrap",
  "audit-surface:phase-20c-onboarding",
  "audit-surface:phase-20d-portfolio",
] as const;

const REQUIRED_DIMENSION_IDS = [
  "audit-dimension:governance",
  "audit-dimension:authority-surfaces",
  "audit-dimension:disabled-features",
  "audit-dimension:approval-boundaries",
  "audit-dimension:local-first-posture",
  "audit-dimension:provider-posture",
  "audit-dimension:redaction-posture",
  "audit-dimension:replay-safety",
  "audit-dimension:observability",
  "audit-dimension:auditability",
  "audit-dimension:onboarding-readiness",
  "audit-dimension:portfolio-readiness",
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

describe("Phase 20E.1 cross-phase audit contract", () => {
  it("exposes a deterministic typed metadata-only audit contract", () => {
    const contract = getCrossPhaseAuditContract();

    expect(CrossPhaseAuditContractSchema.safeParse(contract).success).toBe(
      true,
    );
    expect(JSON.stringify(contract)).toBe(
      JSON.stringify(getCrossPhaseAuditContract()),
    );
    expect(contract).toMatchObject({
      contract_version: "20E.1",
      contract_id: "phase-20e1-cross-phase-audit-contract",
      phase: "20E.1",
      posture: {
        contract_only: true,
        metadata_only: true,
        read_only: true,
        deterministic: true,
        audit_execution_enabled: false,
        filesystem_inspection_enabled: false,
        runtime_execution_enabled: false,
        provider_call_enabled: false,
        network_call_enabled: false,
        ui_route_created: false,
        approval_bypass_created: false,
        authority_surface_created: false,
        capability_created: false,
        source_material_exposure_enabled: false,
      },
    });
  });

  it("is frozen and returns defensive copies", () => {
    expect(Object.isFrozen(CROSS_PHASE_AUDIT_CONTRACT)).toBe(true);
    expect(Object.isFrozen(CROSS_PHASE_AUDIT_CONTRACT.surfaces)).toBe(true);
    expect(Object.isFrozen(CROSS_PHASE_AUDIT_CONTRACT.surfaces[0])).toBe(true);

    const contract = getCrossPhaseAuditContract();
    contract.surfaces[0].phase_label = "Mutated";
    contract.dimensions[0].label = "Mutated";
    contract.expectations[0].evidence_guidance.push("mutation");

    expect(getCrossPhaseAuditContract().surfaces[0]).toMatchObject({
      surface_id: "audit-surface:phase-10-room-os",
      phase_label: "Phase 10 Room OS",
    });
    expect(getAuditDimensions()[0]).toMatchObject({
      dimension_id: "audit-dimension:governance",
      label: "Governance",
    });
    expect(getAuditExpectations()[0].evidence_guidance).toEqual([
      "phase closeout metadata",
      "Phase 20A governance summary",
    ]);
  });

  it("represents all required phases and audit surfaces", () => {
    const surfaces = getAuditSurfaces();

    expect(surfaces.map((surface) => surface.surface_id)).toEqual([
      ...REQUIRED_SURFACE_IDS,
    ]);
    expect(surfaces.map((surface) => surface.surface_id)).toEqual([
      ...AUDIT_SURFACE_IDS,
    ]);
    expect(surfaces.map((surface) => surface.phase_id)).toEqual([
      ...AUDIT_PHASE_IDS,
    ]);
    expect(
      surfaces.every(
        (surface) =>
          surface.dimension_ids.length === AUDIT_DIMENSION_IDS.length &&
          surface.expectation_ids.length === AUDIT_EXPECTATION_IDS.length,
      ),
    ).toBe(true);
  });

  it("represents all audit dimensions and expectations", () => {
    const dimensions = getAuditDimensions();
    const expectations = getAuditExpectations();
    const expectationIds = new Set(
      expectations.map((expectation) => expectation.expectation_id),
    );

    expect(dimensions.map((dimension) => dimension.dimension_id)).toEqual([
      ...REQUIRED_DIMENSION_IDS,
    ]);
    expect(dimensions.map((dimension) => dimension.dimension_id)).toEqual([
      ...AUDIT_DIMENSION_IDS,
    ]);
    expect(
      expectations.map((expectation) => expectation.expectation_id),
    ).toEqual([...AUDIT_EXPECTATION_IDS]);

    for (const dimension of dimensions) {
      expect(expectationIds.has(dimension.expectation_id)).toBe(true);
    }
    expect(
      expectations.every((expectation) => expectation.future_audit_only),
    ).toBe(true);
  });

  it("summarizes the contract consistently", () => {
    const contract = getCrossPhaseAuditContract();
    const summary = summarizeCrossPhaseAuditContract();

    expect(summary).toMatchObject({
      contract_version: "20E.1",
      surface_count: 14,
      dimension_count: 12,
      expectation_count: 12,
      represented_phase_count: 14,
      critical_expectation_count: 4,
      high_expectation_count: 4,
      medium_expectation_count: 4,
      low_expectation_count: 0,
      phase20e_contract_only: true,
      phase20e_capability_neutral: true,
    });
    expect(summary.surface_count).toBe(contract.surfaces.length);
    expect(summary.dimension_count).toBe(contract.dimensions.length);
    expect(summary.expectation_count).toBe(contract.expectations.length);
  });

  it("declares no audit execution, filesystem inspection, runtime, provider, network, UI, authority, source material, or capability affordances", () => {
    const contract = getCrossPhaseAuditContract();
    const summary = summarizeCrossPhaseAuditContract();

    for (const posture of [
      contract.posture,
      summary.posture,
      ...contract.surfaces.map((surface) => surface.posture),
      ...contract.dimensions.map((dimension) => dimension.posture),
      ...contract.expectations.map((expectation) => expectation.posture),
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
      expect(collectKeys({ contract, summary })).not.toContain(
        forbiddenFieldName,
      );
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
      expect.arrayContaining([
        "getCrossPhaseAuditContract",
        "getAuditSurfaces",
        "getAuditDimensions",
        "getAuditExpectations",
        "summarizeCrossPhaseAuditContract",
      ]),
    );
  });
});
