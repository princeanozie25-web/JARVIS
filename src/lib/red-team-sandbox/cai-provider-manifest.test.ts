import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as redTeamSandbox from "./index";
import {
  CAI_ADAPTER_MODES,
  CAI_PROVIDER_DISABLED_CAPABILITIES,
  CAI_PROVIDER_MANIFEST_VERSION,
  CAI_PROVIDER_READINESS_CHECK_IDS,
  RED_TEAM_FORBIDDEN_ACTION_CLASSES,
  RED_TEAM_FORBIDDEN_TARGET_SCOPES,
  RED_TEAM_SUPPORTED_ACTION_CLASSES,
  RED_TEAM_SUPPORTED_TARGET_SCOPES,
  CaiProviderManifestSchema,
  CaiProviderReadinessReportSchema,
  assertCaiProviderNotExecutable,
  buildCaiProviderReadinessReport,
  getCaiProviderManifest,
  listCaiProviderDisabledCapabilities,
} from "./index";

const MANIFEST_SOURCE = "src/lib/red-team-sandbox/cai-provider-manifest.ts";

const FORBIDDEN_EXPORT_NAMES = [
  "execute",
  "retry",
  "approve",
  "dispatch",
  "mutate",
  "scanNetwork",
  "installCai",
  "importCai",
  "callCai",
  "createSidecar",
  "spawnProcess",
] as const;

function exportedFunctionNames(): readonly string[] {
  return Object.entries(redTeamSandbox)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name);
}

describe("Phase 19D.7 CAI provider manifest and readiness", () => {
  it("manifest exists, is deterministic, and declares CAI as not installed", () => {
    const manifest = getCaiProviderManifest();

    expect(manifest).toMatchObject({
      manifest_id: "cai-provider-manifest:phase-19d",
      manifest_version: "19D.7",
      provider_id: "provider:cai",
      provider_name: "CAI Red-Team Provider",
      provider_kind: "cai",
      install_state: "not_installed",
      execution_state: "disabled",
      required_sandbox_profile_id: "red-team-profile:phase-19d-local-sandbox",
      approval_required: true,
      dry_run_required: true,
      localhost_only_required: true,
      audit_required: true,
      metadata_only: true,
      read_only: true,
      deterministic: true,
      cai_imported: false,
      cai_called: false,
      cai_installed: false,
      execution_enabled: false,
      subprocess_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
      database_read_enabled: false,
    });
    expect(manifest.supported_adapter_modes).toEqual(CAI_ADAPTER_MODES);
    expect(CaiProviderManifestSchema.safeParse(manifest).success).toBe(true);
    expect(JSON.stringify(getCaiProviderManifest())).toBe(
      JSON.stringify(getCaiProviderManifest()),
    );
  });

  it("package and runtime requirements are metadata-only and disabled", () => {
    const manifest = getCaiProviderManifest();

    expect(manifest.package_requirement).toMatchObject({
      package_id: "cai-provider-package:cai",
      package_name: "cai",
      package_kind: "future_optional_provider",
      install_state: "not_installed",
      import_enabled: false,
      package_call_enabled: false,
      metadata_only: true,
      read_only: true,
    });
    expect(manifest.runtime_requirement).toMatchObject({
      runtime_id: "cai-provider-runtime:python-sidecar",
      runtime_kind: "python_sidecar_reserved",
      execution_state: "disabled",
      python_sidecar_enabled: false,
      subprocess_enabled: false,
      process_spawn_enabled: false,
      command_execution_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
      database_read_enabled: false,
      metadata_only: true,
      read_only: true,
    });
  });

  it("readiness report is deterministic and non-executable", () => {
    const report = buildCaiProviderReadinessReport();

    expect(report).toMatchObject({
      report_id: "cai-provider-readiness:phase-19d",
      manifest_version: CAI_PROVIDER_MANIFEST_VERSION,
      provider_id: "provider:cai",
      install_state: "not_installed",
      execution_state: "disabled",
      ready_for_installation: false,
      executable: false,
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      cai_imported: false,
      cai_called: false,
      cai_installed: false,
      python_sidecar_created: false,
      subprocess_spawned: false,
      command_executed: false,
      network_scan_performed: false,
      filesystem_read: false,
      database_read: false,
      approval_decision_created: false,
      authority_token_created: false,
      phase_18_bypass_enabled: false,
    });
    expect(report.checks.map((check) => check.check_id)).toEqual(
      CAI_PROVIDER_READINESS_CHECK_IDS,
    );
    expect(report.checks.every((check) => check.passed)).toBe(true);
    expect(CaiProviderReadinessReportSchema.safeParse(report).success).toBe(
      true,
    );
    expect(JSON.stringify(buildCaiProviderReadinessReport())).toBe(
      JSON.stringify(buildCaiProviderReadinessReport()),
    );
  });

  it("readiness checks include required disabled capabilities", () => {
    const disabledCapabilities = listCaiProviderDisabledCapabilities();

    expect(disabledCapabilities).toEqual(CAI_PROVIDER_DISABLED_CAPABILITIES);
    expect(disabledCapabilities).toEqual(
      expect.arrayContaining([
        "CAI installation",
        "CAI import",
        "CAI execution",
        "Python sidecar",
        "subprocess launch",
        "process spawn",
        "command execution",
        "network scanning",
        "external target access",
        "filesystem reads",
        "database reads",
        "repo mutation",
        "approval decisions",
        "authority token creation",
        "Phase 18 bypass",
      ]),
    );
    expect(
      buildCaiProviderReadinessReport()
        .checks.map((check) => check.disabled_capability)
        .filter(Boolean),
    ).toEqual(
      expect.arrayContaining([
        "CAI installation",
        "Python sidecar",
        "CAI execution",
        "subprocess launch",
        "network scanning",
        "external target access",
      ]),
    );
  });

  it("assertCaiProviderNotExecutable passes", () => {
    expect(() => assertCaiProviderNotExecutable()).not.toThrow();
  });

  it("allowed and forbidden scopes align with red-team sandbox contracts", () => {
    const manifest = getCaiProviderManifest();

    expect(manifest.allowed_target_scopes).toEqual(
      RED_TEAM_SUPPORTED_TARGET_SCOPES,
    );
    expect(manifest.forbidden_target_scopes).toEqual(
      RED_TEAM_FORBIDDEN_TARGET_SCOPES,
    );
  });

  it("allowed and forbidden action classes align with red-team sandbox contracts", () => {
    const manifest = getCaiProviderManifest();

    expect(manifest.allowed_action_classes).toEqual(
      RED_TEAM_SUPPORTED_ACTION_CLASSES,
    );
    expect(manifest.forbidden_action_classes).toEqual(
      RED_TEAM_FORBIDDEN_ACTION_CLASSES,
    );
  });

  it("manifest outputs are defensive-copy-safe", () => {
    const manifest = getCaiProviderManifest();
    manifest.allowed_target_scopes[0] = "synthetic_fixture_only";
    manifest.package_requirement.package_name = "cai";

    expect(getCaiProviderManifest().allowed_target_scopes).toEqual(
      RED_TEAM_SUPPORTED_TARGET_SCOPES,
    );
    expect(getCaiProviderManifest().package_requirement).toMatchObject({
      package_name: "cai",
      install_state: "not_installed",
    });
  });

  it("source has no CAI import, sidecar, process, filesystem, database, or network usage", () => {
    const source = readFileSync(MANIFEST_SOURCE, "utf8");

    expect(source).not.toMatch(/from\s+["']cai["']|require\(["']cai["']\)/i);
    expect(source).not.toMatch(/from\s+["'](?:node:)?child_process["']/);
    expect(source).not.toMatch(/require\(["'](?:node:)?child_process["']\)/);
    expect(source).not.toMatch(/\bspawn\s*\(|\bexec\s*\(|\bfork\s*\(/);
    expect(source).not.toMatch(/from\s+["'](?:node:)?fs["']/);
    expect(source).not.toMatch(/from\s+["'](?:node:)?net["']/);
    expect(source).not.toMatch(/from\s+["'](?:node:)?http["']/);
    expect(source).not.toMatch(/from\s+["'](?:node:)?https["']/);
    expect(source).not.toMatch(/from\s+["'].*database/i);
  });

  it("exports no execution, approval, mutation, process, or CAI action affordances", () => {
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames()).not.toContain(forbiddenName);
    }
  });
});
