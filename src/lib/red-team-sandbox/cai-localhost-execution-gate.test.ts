import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as redTeamSandbox from "./index";
import {
  CAI_LOCALHOST_EXECUTION_BLOCKER_IDS,
  CAI_LOCALHOST_EXECUTION_DISABLED_CAPABILITIES,
  CAI_LOCALHOST_EXECUTION_GATE_VERSION,
  CAI_LOCALHOST_EXECUTION_MODES,
  CAI_LOCALHOST_EXECUTION_PREREQUISITE_IDS,
  CaiLocalhostExecutionReadinessReportSchema,
  assertCaiLocalhostExecutionBlocked,
  buildCaiLocalhostExecutionReadinessReport,
  listCaiLocalhostExecutionBlockers,
  listCaiLocalhostExecutionDisabledCapabilities,
  listCaiLocalhostExecutionPrerequisites,
} from "./index";

const LOCALHOST_GATE_SOURCE =
  "src/lib/red-team-sandbox/cai-localhost-execution-gate.ts";

const FORBIDDEN_EXPORT_NAMES = [
  "execute",
  "retry",
  "approve",
  "dispatch",
  "mutate",
  "installCai",
  "importCai",
  "callCai",
  "createSidecar",
  "spawnProcess",
  "createApprovalDecision",
  "createAuthorityToken",
] as const;

function exportedFunctionNames(): readonly string[] {
  return Object.entries(redTeamSandbox)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name);
}

describe("Phase 19D.10 CAI localhost execution readiness gate", () => {
  it("builds a deterministic blocked readiness report", () => {
    const report = buildCaiLocalhostExecutionReadinessReport();

    expect(CAI_LOCALHOST_EXECUTION_GATE_VERSION).toBe("19D.10");
    expect(report).toMatchObject({
      report_id: "cai-localhost-execution-readiness:phase-19d",
      report_version: "19D.10",
      verdict: "blocked",
      provider_install_state: "not_installed",
      provider_execution_state: "disabled",
      adapter_mode: "disabled",
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      raw_value_included: false,
      cai_installed: false,
      cai_imported: false,
      cai_called: false,
      execution_enabled: false,
      subprocess_launch_enabled: false,
      process_spawn_enabled: false,
      command_execution_enabled: false,
      network_scan_enabled: false,
      external_targets_enabled: false,
      filesystem_read_enabled: false,
      database_read_enabled: false,
      approval_decision_exists: false,
      authority_token_exists: false,
      python_sidecar_exists: false,
      phase_18_bypass_enabled: false,
    });
    expect(report.gate).toMatchObject({
      gate_id: "cai-localhost-execution-gate:phase-19d",
      mode: "disabled",
      verdict: "blocked",
      localhost_only_required: true,
      approval_decision_required: true,
      one_action_authority_token_required: true,
      dry_run_required: true,
      audit_preview_required: true,
      result_verification_required: true,
      execution_enabled: false,
      cai_execution_enabled: false,
      subprocess_launch_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
      database_read_enabled: false,
      approval_decision_created: false,
      authority_token_created: false,
      python_sidecar_created: false,
    });
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(buildCaiLocalhostExecutionReadinessReport()),
    );
    expect(
      CaiLocalhostExecutionReadinessReportSchema.safeParse(report).success,
    ).toBe(true);
  });

  it("declares complete prerequisites", () => {
    const prerequisites = listCaiLocalhostExecutionPrerequisites();

    expect(prerequisites.map((item) => item.prerequisite_id)).toEqual(
      CAI_LOCALHOST_EXECUTION_PREREQUISITE_IDS,
    );
    expect(prerequisites).toHaveLength(12);
    expect(
      prerequisites.every(
        (item) =>
          item.required && item.modeled && item.metadata_only && item.read_only,
      ),
    ).toBe(true);
    expect(
      prerequisites
        .filter((item) => !item.satisfied)
        .map((item) => item.prerequisite_id),
    ).toEqual(
      expect.arrayContaining([
        "cai_installed",
        "cai_adapter_enabled",
        "dry_run_completed",
        "phase_18_approval_decision_exists",
        "one_action_authority_token_exists",
        "execution_timeout_configured",
        "network_egress_blocked_except_localhost",
        "result_verification_configured",
      ]),
    );
  });

  it("lists default blockers for missing CAI, execution, approval, authority, and sidecar", () => {
    const blockers = listCaiLocalhostExecutionBlockers();

    expect(blockers.map((item) => item.blocker_id)).toEqual(
      CAI_LOCALHOST_EXECUTION_BLOCKER_IDS,
    );
    expect(blockers.map((item) => item.blocker_id)).toEqual(
      expect.arrayContaining([
        "cai_not_installed",
        "execution_disabled",
        "no_real_approval_decision",
        "no_authority_token",
        "no_sidecar",
      ]),
    );
    expect(
      blockers.every(
        (item) =>
          item.blocking &&
          item.metadata_only &&
          item.read_only &&
          !item.raw_value_included,
      ),
    ).toBe(true);
  });

  it("keeps current execution mode disabled or mock dry-run only", () => {
    expect(CAI_LOCALHOST_EXECUTION_MODES).toEqual([
      "disabled",
      "mock_dry_run_only",
      "localhost_execution_reserved",
    ]);
    expect(["disabled", "mock_dry_run_only"]).toContain(
      buildCaiLocalhostExecutionReadinessReport().gate.mode,
    );
  });

  it("lists disabled capabilities for real execution and external effects", () => {
    expect(listCaiLocalhostExecutionDisabledCapabilities()).toEqual(
      CAI_LOCALHOST_EXECUTION_DISABLED_CAPABILITIES,
    );
    expect(listCaiLocalhostExecutionDisabledCapabilities()).toEqual(
      expect.arrayContaining([
        "real execution",
        "network scan",
        "subprocess launch",
        "CAI sidecar",
        "external targets",
        "approval decision creation",
        "authority token creation",
      ]),
    );
  });

  it("assertion helper passes while localhost execution remains blocked", () => {
    expect(() => assertCaiLocalhostExecutionBlocked()).not.toThrow();
  });

  it("source has no CAI import, child process, filesystem, database, or network usage", () => {
    const source = readFileSync(LOCALHOST_GATE_SOURCE, "utf8");

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

  it("exports no forbidden execution or authority affordances", () => {
    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames()).not.toContain(forbiddenName);
    }
  });
});
