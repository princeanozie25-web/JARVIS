import { describe, expect, it } from "vitest";

import * as finalSystemStatus from "./index";
import {
  FINAL_AUTHORITY_SURFACE_IDS,
  FINAL_AUTHORITY_SURFACE_INVENTORY,
  FinalAuthoritySurfaceRecordSchema,
  getAuthoritySurfacesRequiringApproval,
  getExecutableAuthoritySurfaces,
  getFinalAuthoritySurfaceInventory,
  getNetworkCapableAuthoritySurfaces,
  summarizeAuthoritySurfacePosture,
} from "./index";

const REQUIRED_AUTHORITY_SURFACE_IDS = [
  "authority-surface:model-runtime",
  "authority-surface:local-providers",
  "authority-surface:cloud-providers",
  "authority-surface:voice-runtime",
  "authority-surface:vision-runtime",
  "authority-surface:room-adapter-runtime",
  "authority-surface:scheduler-routines",
  "authority-surface:approval-service",
  "authority-surface:tool-runtime",
  "authority-surface:command-center-ui",
  "authority-surface:architecture-graph",
  "authority-surface:telemetry-cockpit",
  "authority-surface:governance-visualizer",
  "authority-surface:red-team-sandbox-cai",
  "authority-surface:event-store-persistence",
  "authority-surface:project-intelligence",
  "authority-surface:memory-bridge",
] as const;

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
  "raw_payload",
  "raw_payloads",
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

describe("Phase 20A.4 final authority surface inventory", () => {
  it("represents every required authority-bearing or authority-adjacent surface", () => {
    const inventory = getFinalAuthoritySurfaceInventory();
    const surfaceIds = inventory.map((surface) => surface.surface_id);

    expect(surfaceIds).toEqual([...FINAL_AUTHORITY_SURFACE_IDS]);

    for (const requiredSurfaceId of REQUIRED_AUTHORITY_SURFACE_IDS) {
      expect(surfaceIds).toContain(requiredSurfaceId);
    }

    for (const surface of inventory) {
      expect(FinalAuthoritySurfaceRecordSchema.safeParse(surface).success).toBe(
        true,
      );
      expect(surface.metadata_only).toBe(true);
      expect(surface.read_only).toBe(true);
      expect(surface.deterministic).toBe(true);
      expect(surface.inventory_only).toBe(true);
      expect(surface.disabled_feature_dependencies.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic, frozen, and defensive-copy safe", () => {
    expect(Object.isFrozen(FINAL_AUTHORITY_SURFACE_INVENTORY)).toBe(true);
    expect(Object.isFrozen(FINAL_AUTHORITY_SURFACE_INVENTORY[0])).toBe(true);
    expect(
      Object.isFrozen(
        FINAL_AUTHORITY_SURFACE_INVENTORY[0].disabled_feature_dependencies,
      ),
    ).toBe(true);

    expect(JSON.stringify(getFinalAuthoritySurfaceInventory())).toBe(
      JSON.stringify(getFinalAuthoritySurfaceInventory()),
    );

    const modelRuntime = getFinalAuthoritySurfaceInventory()[0];
    modelRuntime.label = "Mutated Surface";
    modelRuntime.disabled_feature_dependencies.push(
      "disabled-feature:auto-approval",
    );

    expect(getFinalAuthoritySurfaceInventory()[0]).toMatchObject({
      surface_id: "authority-surface:model-runtime",
      label: "Model Runtime",
      disabled_feature_dependencies: [
        "disabled-feature:remote-cloud-defaults",
        "disabled-feature:ungoverned-provider-escalation",
        "disabled-feature:raw-payload-telemetry-ui-exposure",
      ],
    });
  });

  it("requires approval or governance posture for execution-capable surfaces", () => {
    const executableSurfaceIds = getExecutableAuthoritySurfaces().map(
      (surface) => surface.surface_id,
    );

    expect(executableSurfaceIds).toEqual([
      "authority-surface:model-runtime",
      "authority-surface:local-providers",
      "authority-surface:voice-runtime",
      "authority-surface:vision-runtime",
      "authority-surface:room-adapter-runtime",
      "authority-surface:scheduler-routines",
      "authority-surface:approval-service",
      "authority-surface:tool-runtime",
      "authority-surface:red-team-sandbox-cai",
    ]);

    for (const surface of getExecutableAuthoritySurfaces()) {
      expect(surface.execute_authority).not.toBe("none");
      expect(surface.execute_authority).not.toBe("cloud_runtime_disabled");
      expect(surface.governance_notes).toMatch(
        /approval|governance|governed|local-first|redaction|cost|advisory/i,
      );

      if (
        ["approval_gated_runtime", "sandbox_dry_run_only"].includes(
          surface.execute_authority,
        )
      ) {
        expect(surface.approval_requirement).not.toBe("not_applicable");
      }
    }
  });

  it("requires local-first, disabled, or whitelist posture for network-capable surfaces", () => {
    const networkSurfaceIds = getNetworkCapableAuthoritySurfaces().map(
      (surface) => surface.surface_id,
    );

    expect(networkSurfaceIds).toEqual([
      "authority-surface:cloud-providers",
      "authority-surface:room-adapter-runtime",
      "authority-surface:red-team-sandbox-cai",
    ]);

    for (const surface of getNetworkCapableAuthoritySurfaces()) {
      expect([
        "lan_local_only",
        "cloud_disabled_by_default",
        "cloud_opt_in_gated",
        "sandbox_whitelist_only",
      ]).toContain(surface.network_posture);
      expect(surface.governance_notes).toMatch(
        /local|disabled|whitelist|governance|gated/i,
      );
      expect(surface.network_call_performed).toBe(false);
    }
  });

  it("has no auto-approved surface and no raw payload-allowed posture", () => {
    for (const surface of getFinalAuthoritySurfaceInventory()) {
      expect(surface.auto_approval_allowed).toBe(false);
      expect(surface.raw_payload_posture).not.toContain("allowed");
      expect(surface.raw_payload_field_included).toBe(false);
      expect(surface.creates_new_authority_surface).toBe(false);
      expect(surface.reclassifies_existing_surface).toBe(false);
      expect(surface.weakens_disabled_feature_matrix).toBe(false);
    }
  });

  it("lists approval-required surfaces without inventing approval bypass", () => {
    const approvalSurfaceIds = getAuthoritySurfacesRequiringApproval().map(
      (surface) => surface.surface_id,
    );

    expect(approvalSurfaceIds).toEqual([
      "authority-surface:cloud-providers",
      "authority-surface:voice-runtime",
      "authority-surface:room-adapter-runtime",
      "authority-surface:scheduler-routines",
      "authority-surface:approval-service",
      "authority-surface:tool-runtime",
      "authority-surface:red-team-sandbox-cai",
    ]);

    for (const surface of getAuthoritySurfacesRequiringApproval()) {
      expect(surface.approval_requirement).not.toBe("not_applicable");
      expect(surface.auto_approval_allowed).toBe(false);
    }
  });

  it("summary counts match the inventory", () => {
    const inventory = getFinalAuthoritySurfaceInventory();
    const approvalRequired = getAuthoritySurfacesRequiringApproval();
    const executable = getExecutableAuthoritySurfaces();
    const networkCapable = getNetworkCapableAuthoritySurfaces();
    const summary = summarizeAuthoritySurfacePosture();

    expect(summary).toMatchObject({
      inventory_version: "20A.4",
      surface_count: inventory.length,
      approval_required_surface_count: approvalRequired.length,
      executable_surface_count: executable.length,
      network_capable_surface_count: networkCapable.length,
      auto_approved_surface_count: 0,
      raw_payload_allowed_surface_count: 0,
      new_authority_surface_count: 0,
      metadata_only: true,
      read_only: true,
      deterministic: true,
    });
  });

  it("does not expose forbidden raw payload fields", () => {
    const keys = collectKeys({
      inventory: getFinalAuthoritySurfaceInventory(),
      summary: summarizeAuthoritySurfacePosture(),
    });

    for (const forbiddenKey of FORBIDDEN_RAW_KEYS) {
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
