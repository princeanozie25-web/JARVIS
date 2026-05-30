import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as redTeamSandbox from "./index";
import {
  CAI_MOCK_PROVIDER_DISABLED_CAPABILITIES,
  CAI_MOCK_PROVIDER_FINDING_KINDS,
  CAI_MOCK_PROVIDER_VERSION,
  CaiMockProviderResultSchema,
  buildCaiAdapterRunRequest,
  buildCaiMockFindingFixture,
  buildDeniedDestructiveActionProposal,
  buildDeniedPublicInternetScanProposal,
  buildSafeLocalhostStaticAnalysisProposal,
  createCaiMockProvider,
  getCaiProviderManifest,
  listCaiMockProviderDisabledCapabilities,
  runCaiMockDryRun,
} from "./index";

const MOCK_PROVIDER_SOURCE = "src/lib/red-team-sandbox/cai-mock-provider.ts";

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

describe("Phase 19D.8 CAI mock dry-run provider", () => {
  it("mock provider can be created", () => {
    expect(createCaiMockProvider()).toMatchObject({
      provider_id: "cai-mock-provider:phase-19d",
      provider_version: "19D.8",
      metadata_only: true,
      read_only: true,
      dry_run_only: true,
    });
    expect(CAI_MOCK_PROVIDER_VERSION).toBe("19D.8");
  });

  it("health and status are metadata-only", () => {
    const health = createCaiMockProvider().health();

    expect(health).toMatchObject({
      provider_id: "cai-mock-provider:phase-19d",
      provider_version: "19D.8",
      status: "disabled",
      manifest_execution_state: "disabled",
      metadata_only: true,
      read_only: true,
      deterministic: true,
      cai_installed: false,
      cai_imported: false,
      cai_called: false,
      execution_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
      process_spawn_enabled: false,
    });
  });

  it("safe request returns deterministic dry-run result", () => {
    const request = buildCaiAdapterRunRequest({
      request_id: "cai-adapter-request:safe-mock-provider",
      proposal: buildSafeLocalhostStaticAnalysisProposal(),
    });
    const result = runCaiMockDryRun(request);

    expect(result).toMatchObject({
      result_id: "cai-mock-result:safe-mock-provider",
      request_id: "cai-adapter-request:safe-mock-provider",
      proposal_id: "red-team-proposal:safe-localhost-static-analysis",
      provider_id: "cai-mock-provider:phase-19d",
      provider_version: "19D.8",
      status: "dry_run_metadata_ready",
      accepted: true,
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      synthetic_only: true,
      raw_value_included: false,
      cai_installed: false,
      cai_imported: false,
      cai_called: false,
      execution_enabled: false,
      subprocess_launch_enabled: false,
      process_spawn_enabled: false,
      command_execution_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
      database_read_enabled: false,
      approval_decision_enabled: false,
      authority_token_creation_enabled: false,
      phase_18_bypass_enabled: false,
    });
    expect(result.validation_result.verdict).toBe("allowed_metadata_only");
    expect(result.audit_envelope).toMatchObject({
      metadata_only: true,
      read_only: true,
      cai_called: false,
      execution_enabled: false,
      subprocess_launch_enabled: false,
      network_scan_enabled: false,
      filesystem_read_enabled: false,
    });
    expect(result.findings.map((finding) => finding.finding_kind)).toEqual(
      CAI_MOCK_PROVIDER_FINDING_KINDS,
    );
    expect(CaiMockProviderResultSchema.safeParse(result).success).toBe(true);
    expect(JSON.stringify(runCaiMockDryRun(request))).toBe(
      JSON.stringify(runCaiMockDryRun(request)),
    );
  });

  it("findings are synthetic and metadata-only", () => {
    const findings = buildCaiMockFindingFixture();

    expect(findings.map((finding) => finding.finding_kind)).toEqual([
      "static_analysis_note",
      "configuration_review_note",
      "dependency_inventory_note",
      "sandbox_boundary_note",
    ]);
    expect(
      findings.every(
        (finding) =>
          finding.synthetic_only &&
          finding.metadata_only &&
          finding.read_only &&
          !finding.raw_value_included,
      ),
    ).toBe(true);
  });

  it("forbidden scope and action requests fail", () => {
    const publicResult = runCaiMockDryRun(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:mock-public-target",
        proposal: buildDeniedPublicInternetScanProposal(),
      }),
    );
    const destructiveResult = runCaiMockDryRun(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:mock-destructive-action",
        proposal: buildDeniedDestructiveActionProposal(),
      }),
    );

    expect(publicResult).toMatchObject({
      accepted: false,
      status: "rejected",
      findings: [],
      execution_enabled: false,
      cai_called: false,
    });
    expect(
      publicResult.validation_result.violations.map((item) => item.reason_code),
    ).toEqual(
      expect.arrayContaining([
        "forbidden_target_scope",
        "forbidden_action_class",
      ]),
    );
    expect(destructiveResult).toMatchObject({
      accepted: false,
      status: "rejected",
      findings: [],
      execution_enabled: false,
      cai_called: false,
    });
    expect(
      destructiveResult.validation_result.violations.map(
        (item) => item.reason_code,
      ),
    ).toContain("forbidden_action_class");
  });

  it("missing approval metadata fails", () => {
    const result = runCaiMockDryRun(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:mock-missing-approval",
        proposal: {
          ...buildSafeLocalhostStaticAnalysisProposal(),
          approval_metadata: null,
        },
      }),
    );

    expect(result).toMatchObject({
      accepted: false,
      status: "rejected",
      findings: [],
      execution_enabled: false,
      cai_called: false,
    });
    expect(
      result.validation_result.violations.map((item) => item.reason_code),
    ).toContain("missing_approval_metadata");
  });

  it("non-dry-run request fails", () => {
    const request = {
      ...buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:mock-not-dry-run",
        proposal: buildSafeLocalhostStaticAnalysisProposal(),
      }),
      dry_run_required: false,
    };

    expect(runCaiMockDryRun(request)).toMatchObject({
      request_id: "cai-adapter-request:mock-not-dry-run",
      proposal_id: "red-team-proposal:safe-localhost-static-analysis",
      accepted: false,
      status: "rejected",
      findings: [],
      audit_envelope: null,
      execution_enabled: false,
      cai_called: false,
    });
  });

  it("execution state remains disabled and disabled capabilities are listed", () => {
    expect(getCaiProviderManifest()).toMatchObject({
      install_state: "not_installed",
      execution_state: "disabled",
      execution_enabled: false,
      cai_imported: false,
      cai_called: false,
      cai_installed: false,
    });
    expect(listCaiMockProviderDisabledCapabilities()).toEqual(
      CAI_MOCK_PROVIDER_DISABLED_CAPABILITIES,
    );
    expect(createCaiMockProvider().listDisabledCapabilities()).toEqual(
      CAI_MOCK_PROVIDER_DISABLED_CAPABILITIES,
    );
  });

  it("source has no CAI import, child process, filesystem, database, or network usage", () => {
    const source = readFileSync(MOCK_PROVIDER_SOURCE, "utf8");

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
