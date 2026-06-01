import { describe, expect, it } from "vitest";

import * as crossPhaseAudit from "./index";
import {
  AUDIT_DIMENSION_IDS,
  AUDIT_EVIDENCE_IDS,
  AUDIT_SURFACE_IDS,
  CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY,
  CrossPhaseAuditEvidenceRegistrySchema,
  getAuditEvidenceByDimension,
  getAuditEvidenceBySurfaceId,
  getCrossPhaseAuditEvidenceRegistry,
  getHighConfidenceAuditEvidence,
  summarizeCrossPhaseAuditEvidence,
} from "./index";

const REQUIRED_EVIDENCE_IDS = [
  "audit-evidence:phase-20a-readiness-governance-closeout",
  "audit-evidence:phase-20b-bootstrap-doctor-closeout",
  "audit-evidence:phase-20c-onboarding-move-in-closeout",
  "audit-evidence:phase-20d-portfolio-demo-closeout",
  "audit-evidence:final-system-status-registry",
  "audit-evidence:disabled-feature-matrix",
  "audit-evidence:authority-surface-inventory",
  "audit-evidence:governance-readiness-summary",
  "audit-evidence:bootstrap-doctor-report-path",
  "audit-evidence:onboarding-report-path",
  "audit-evidence:portfolio-report-path",
  "audit-evidence:architecture-graph",
  "audit-evidence:governance-visualizer",
  "audit-evidence:telemetry-cockpit",
  "audit-evidence:red-team-sandbox-cai-posture",
  "audit-evidence:approval-runtime-closeout",
  "audit-evidence:model-runtime-closeout",
  "audit-evidence:voice-runtime-closeout",
  "audit-evidence:vision-runtime-closeout",
  "audit-evidence:room-runtime-closeout",
  "audit-evidence:scheduler-closeout",
  "audit-evidence:persistence-closeout",
  "audit-evidence:command-center-closeout",
] as const;

const SAFE_AUTHORITY_POSTURES = [
  "metadata_only",
  "read_only",
  "approval_gated_reference",
  "sandboxed_reference",
  "deferred_disabled_reference",
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

describe("Phase 20E.2 cross-phase audit evidence registry", () => {
  it("exposes a deterministic typed metadata-only evidence registry", () => {
    const registry = getCrossPhaseAuditEvidenceRegistry();

    expect(
      CrossPhaseAuditEvidenceRegistrySchema.safeParse(registry).success,
    ).toBe(true);
    expect(JSON.stringify(registry)).toBe(
      JSON.stringify(getCrossPhaseAuditEvidenceRegistry()),
    );
    expect(registry).toMatchObject({
      registry_version: "20E.2",
      source_contract_version: "20E.1",
      registry_id: "phase-20e2-cross-phase-audit-evidence-registry",
      phase: "20E.2",
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
    expect(Object.isFrozen(CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY)).toBe(true);
    expect(Object.isFrozen(CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence)).toBe(
      true,
    );
    expect(
      Object.isFrozen(CROSS_PHASE_AUDIT_EVIDENCE_REGISTRY.evidence[0]),
    ).toBe(true);

    const registry = getCrossPhaseAuditEvidenceRegistry();
    registry.evidence[0].title = "Mutated";
    registry.evidence[0].audit_dimension_ids.push("audit-dimension:governance");
    registry.evidence[0].related_audit_surface_ids.push(
      "audit-surface:phase-20a-readiness",
    );

    expect(getCrossPhaseAuditEvidenceRegistry().evidence[0]).toMatchObject({
      evidence_id: "audit-evidence:phase-20a-readiness-governance-closeout",
      title: "Phase 20A readiness/governance closeout",
      audit_dimension_ids: [
        "audit-dimension:governance",
        "audit-dimension:authority-surfaces",
        "audit-dimension:disabled-features",
        "audit-dimension:approval-boundaries",
      ],
      related_audit_surface_ids: ["audit-surface:phase-20a-readiness"],
    });
  });

  it("represents every required evidence source", () => {
    const registry = getCrossPhaseAuditEvidenceRegistry();

    expect(registry.evidence.map((record) => record.evidence_id)).toEqual([
      ...REQUIRED_EVIDENCE_IDS,
    ]);
    expect(registry.evidence.map((record) => record.evidence_id)).toEqual([
      ...AUDIT_EVIDENCE_IDS,
    ]);
    expect(registry.evidence).toHaveLength(23);
  });

  it("aligns dimensions and related surfaces with the Phase 20E.1 audit contract", () => {
    const registry = getCrossPhaseAuditEvidenceRegistry();
    const dimensionIds = new Set(AUDIT_DIMENSION_IDS);
    const surfaceIds = new Set(AUDIT_SURFACE_IDS);

    for (const record of registry.evidence) {
      expect(record.audit_dimension_ids.length).toBeGreaterThan(0);
      expect(record.related_audit_surface_ids.length).toBeGreaterThan(0);

      for (const dimensionId of record.audit_dimension_ids) {
        expect(dimensionIds.has(dimensionId)).toBe(true);
      }

      for (const surfaceId of record.related_audit_surface_ids) {
        expect(surfaceIds.has(surfaceId)).toBe(true);
      }
    }
  });

  it("filters evidence by dimension, surface id, and confidence", () => {
    expect(
      getAuditEvidenceByDimension("audit-dimension:portfolio-readiness").map(
        (record) => record.evidence_id,
      ),
    ).toEqual([
      "audit-evidence:phase-20d-portfolio-demo-closeout",
      "audit-evidence:portfolio-report-path",
      "audit-evidence:command-center-closeout",
    ]);
    expect(
      getAuditEvidenceBySurfaceId(
        "audit-surface:phase-18-approval-runtime",
      ).map((record) => record.evidence_id),
    ).toEqual([
      "audit-evidence:authority-surface-inventory",
      "audit-evidence:governance-readiness-summary",
      "audit-evidence:governance-visualizer",
      "audit-evidence:approval-runtime-closeout",
    ]);
    expect(getHighConfidenceAuditEvidence()).toHaveLength(13);
  });

  it("declares safe payload and authority posture for every evidence source", () => {
    const registry = getCrossPhaseAuditEvidenceRegistry();

    expect(
      registry.evidence.every(
        (record) =>
          !["raw_payload_allowed", "source_material_allowed"].includes(
            record.payload_posture,
          ),
      ),
    ).toBe(true);
    expect(
      registry.evidence.every((record) =>
        SAFE_AUTHORITY_POSTURES.includes(record.authority_posture),
      ),
    ).toBe(true);
    expect(
      registry.evidence.find(
        (record) =>
          record.evidence_id === "audit-evidence:red-team-sandbox-cai-posture",
      ),
    ).toMatchObject({
      payload_posture: "synthetic_metadata_only",
      authority_posture: "sandboxed_reference",
    });
  });

  it("summarizes evidence consistently", () => {
    const summary = summarizeCrossPhaseAuditEvidence();

    expect(summary).toMatchObject({
      registry_version: "20E.2",
      evidence_count: 23,
      high_confidence_count: 13,
      medium_confidence_count: 10,
      low_confidence_count: 0,
      dimension_reference_count: 76,
      surface_reference_count: 37,
      metadata_safe_count: 23,
      phase20e_evidence_registry_only: true,
      phase20e_capability_neutral: true,
      evidence_type_counts: {
        phase_closeout: 4,
        registry: 1,
        matrix: 1,
        inventory: 1,
        summary: 1,
        report_path: 3,
        architecture_graph: 1,
        visualizer: 1,
        observability_surface: 1,
        sandbox_posture: 1,
        runtime_closeout: 6,
        persistence_closeout: 1,
        command_center_closeout: 1,
      },
    });
  });

  it("declares no audit execution, filesystem inspection, runtime, provider, network, UI, authority, source material, or capability affordances", () => {
    const registry = getCrossPhaseAuditEvidenceRegistry();
    const summary = summarizeCrossPhaseAuditEvidence();

    for (const posture of [
      registry.posture,
      summary.posture,
      ...registry.evidence.map((record) => record.posture),
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
      expect(collectKeys({ registry, summary })).not.toContain(
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
        "getCrossPhaseAuditEvidenceRegistry",
        "getAuditEvidenceByDimension",
        "getAuditEvidenceBySurfaceId",
        "getHighConfidenceAuditEvidence",
        "summarizeCrossPhaseAuditEvidence",
      ]),
    );
  });
});
