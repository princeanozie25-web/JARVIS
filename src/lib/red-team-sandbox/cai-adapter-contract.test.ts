import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as redTeamSandbox from "./index";
import {
  CAI_ADAPTER_CAPABILITIES,
  CAI_ADAPTER_CONTRACT_VERSION,
  CAI_ADAPTER_DISABLED_CAPABILITY_FLAGS,
  CAI_ADAPTER_DISABLED_REASONS,
  CAI_ADAPTER_MODES,
  CaiAdapterDryRunResultSchema,
  CaiAdapterHealthSchema,
  buildCaiAdapterRunRequest,
  buildDeniedDestructiveActionProposal,
  buildDeniedPublicInternetScanProposal,
  buildSafeLocalhostStaticAnalysisProposal,
  createMockCaiAdapter,
  getDefaultCaiAdapterHealth,
} from "./index";

const ADAPTER_SOURCE = "src/lib/red-team-sandbox/cai-adapter-contract.ts";

const FORBIDDEN_EXPORT_NAMES = [
  "execute",
  "retry",
  "approve",
  "dispatch",
  "mutate",
  "scanNetwork",
  "installCai",
  "callCai",
  "createSidecar",
  "spawnProcess",
] as const;

function exportedFunctionNames(): readonly string[] {
  return Object.entries(redTeamSandbox)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name);
}

describe("Phase 19D.6 CAI adapter contract", () => {
  it("declares adapter modes, capabilities, disabled reasons, and disabled defaults", () => {
    expect(CAI_ADAPTER_CONTRACT_VERSION).toBe("19D.6");
    expect(CAI_ADAPTER_MODES).toEqual([
      "disabled",
      "mock",
      "dry_run_only",
      "localhost_only_reserved",
    ]);
    expect(CAI_ADAPTER_CAPABILITIES).toEqual([
      "metadata_health",
      "capability_description",
      "sandbox_validation",
      "dry_run_metadata",
      "audit_envelope_metadata",
    ]);
    expect(CAI_ADAPTER_DISABLED_REASONS).toEqual(
      expect.arrayContaining([
        "cai_not_installed",
        "cai_execution_disabled",
        "python_sidecar_disabled",
        "subprocess_launch_disabled",
        "network_scan_disabled",
        "filesystem_read_disabled",
        "phase_18_approval_required",
        "metadata_only_contract",
      ]),
    );
    expect(Object.values(CAI_ADAPTER_DISABLED_CAPABILITY_FLAGS)).toEqual(
      Object.values(CAI_ADAPTER_DISABLED_CAPABILITY_FLAGS).map(() => false),
    );
  });

  it("adapter defaults disabled with no execution, sidecar, network, or filesystem capability", () => {
    expect(getDefaultCaiAdapterHealth()).toMatchObject({
      adapter_id: "cai-adapter:mock-metadata-only",
      contract_version: "19D.6",
      mode: "disabled",
      health: "disabled_metadata_only",
      metadata_only: true,
      read_only: true,
      deterministic: true,
      cai_installed: false,
      cai_called: false,
      execution_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
      subprocess_launch_enabled: false,
      python_sidecar_enabled: false,
      raw_value_included: false,
    });
    expect(
      CaiAdapterHealthSchema.safeParse(getDefaultCaiAdapterHealth()).success,
    ).toBe(true);
  });

  it("mock adapter health is metadata-only", () => {
    const adapter = createMockCaiAdapter();

    expect(adapter).toMatchObject({
      adapter_id: "cai-adapter:mock-metadata-only",
      mode: "mock",
      metadata_only: true,
      read_only: true,
    });
    expect(adapter.health()).toMatchObject({
      mode: "mock",
      health: "mock_metadata_ready",
      metadata_only: true,
      read_only: true,
      cai_called: false,
      execution_enabled: false,
      subprocess_launch_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
    });
  });

  it("mock adapter capabilities are metadata-only", () => {
    const capabilities = createMockCaiAdapter().describeCapabilities();

    expect(capabilities.map((item) => item.capability)).toEqual(
      CAI_ADAPTER_CAPABILITIES,
    );
    expect(
      capabilities.every(
        (item) =>
          item.metadata_only &&
          item.read_only &&
          !item.execution_enabled &&
          !item.cai_call_enabled &&
          !item.subprocess_launch_enabled &&
          !item.network_scan_enabled &&
          !item.filesystem_read_enabled,
      ),
    ).toBe(true);
  });

  it("dry-run builds metadata for a safe localhost static-analysis request", () => {
    const adapter = createMockCaiAdapter();
    const request = buildCaiAdapterRunRequest({
      request_id: "cai-adapter-request:safe-localhost-static-analysis",
      proposal: buildSafeLocalhostStaticAnalysisProposal(),
    });
    const result = adapter.buildDryRun(request);

    expect(result).toMatchObject({
      result_id: "cai-adapter-dry-run:safe-localhost-static-analysis",
      request_id: "cai-adapter-request:safe-localhost-static-analysis",
      proposal_id: "red-team-proposal:safe-localhost-static-analysis",
      mode: "mock",
      accepted: true,
      verdict: "metadata_dry_run_ready",
      metadata_only: true,
      read_only: true,
      redaction_safe: true,
      deterministic: true,
      raw_value_included: false,
      cai_called: false,
      execution_enabled: false,
      subprocess_launch_enabled: false,
      process_spawn_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
      database_read_enabled: false,
    });
    expect(result.validation_result.verdict).toBe("allowed_metadata_only");
    expect(result.plan_metadata).toMatchObject({
      dry_run_first: true,
      execution_enabled: false,
      command_execution_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
      database_read_enabled: false,
      repo_mutation_enabled: false,
    });
    expect(result.audit_envelope).toMatchObject({
      metadata_only: true,
      read_only: true,
      cai_called: false,
      execution_enabled: false,
      subprocess_launch_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
    });
    expect(CaiAdapterDryRunResultSchema.safeParse(result).success).toBe(true);
  });

  it("dry-run rejects forbidden scopes and actions", () => {
    const adapter = createMockCaiAdapter();
    const publicTargetResult = adapter.buildDryRun(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:denied-public-internet",
        proposal: buildDeniedPublicInternetScanProposal(),
      }),
    );
    const destructiveResult = adapter.buildDryRun(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:denied-destructive",
        proposal: buildDeniedDestructiveActionProposal(),
      }),
    );

    expect(publicTargetResult).toMatchObject({
      accepted: false,
      verdict: "rejected",
      plan_metadata: null,
      execution_enabled: false,
      cai_called: false,
    });
    expect(publicTargetResult.validation_result.verdict).toBe("denied");
    expect(
      publicTargetResult.validation_result.violations.map(
        (violation) => violation.reason_code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "forbidden_target_scope",
        "forbidden_action_class",
      ]),
    );
    expect(destructiveResult).toMatchObject({
      accepted: false,
      verdict: "rejected",
      plan_metadata: null,
      execution_enabled: false,
      cai_called: false,
    });
    expect(destructiveResult.validation_result.verdict).toBe("denied");
  });

  it("dry-run rejects missing approval metadata", () => {
    const adapter = createMockCaiAdapter();
    const result = adapter.buildDryRun(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:missing-approval-metadata",
        proposal: {
          ...buildSafeLocalhostStaticAnalysisProposal(),
          approval_metadata: null,
        },
      }),
    );

    expect(result).toMatchObject({
      accepted: false,
      verdict: "rejected",
      plan_metadata: null,
      execution_enabled: false,
      cai_called: false,
    });
    expect(
      result.validation_result.violations.map((item) => item.reason_code),
    ).toContain("missing_approval_metadata");
  });

  it("source contains no subprocess, CAI package, filesystem, database, or network imports", () => {
    const source = readFileSync(ADAPTER_SOURCE, "utf8");

    expect(source).not.toMatch(/from\s+["'](?:node:)?child_process["']/);
    expect(source).not.toMatch(/require\(["'](?:node:)?child_process["']\)/);
    expect(source).not.toMatch(/\bspawn\s*\(|\bexec\s*\(|\bfork\s*\(/);
    expect(source).not.toMatch(/from\s+["']cai["']|require\(["']cai["']\)/i);
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
