import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RedTeamSandboxPage from "../../app/audit/red-team-sandbox/page";
import {
  buildRedTeamSandboxViewerModel,
  buildRedTeamSandboxViewerState,
  filterRedTeamSandboxViewerProposals,
  filterRedTeamSandboxViewerViolations,
} from "../../components/red-team-sandbox/RedTeamSandboxViewer";
import * as redTeamSandbox from "./index";
import {
  PHASE_19D_CLOSEOUT_CHECK_IDS,
  PHASE_19D_DISABLED_CAPABILITIES,
  PHASE_19D_VIEWER_LOCAL_CONTROLS,
  PHASE_19D_VIEWER_REQUIRED_SECTIONS,
  Phase19DCloseoutReportSchema,
  assertPhase19DCloseoutPasses,
  buildCaiAdapterRunRequest,
  buildCaiApprovalProposal,
  buildCaiLocalhostExecutionReadinessReport,
  buildCaiProviderReadinessReport,
  buildDeniedDestructiveActionProposal,
  buildDeniedPublicInternetScanProposal,
  buildPhase19DCloseoutReport,
  buildSafeLocalhostStaticAnalysisProposal,
  getCaiProviderManifest,
  listPhase19DDisabledCapabilities,
  runCaiMockDryRun,
  validateRedTeamRunProposal,
} from "./index";

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
  "createTool",
  "createApproval",
  "createAuthorityToken",
] as const;

const FORBIDDEN_RAW_KEYS = [
  "prompt",
  "raw_prompt",
  "model_output",
  "raw_model_output",
  "tool_args",
  "tool_arguments",
  "approval_token",
  "raw_approval_token",
  "voice_transcript",
  "raw_voice_transcript",
  "audio",
  "raw_audio",
  "ocr_text",
  "raw_ocr_text",
  "frame",
  "raw_frame",
  "screenshot",
  "raw_screenshot",
  "api_key",
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

describe("Phase 19D.11 final CAI-governed red-team closeout", () => {
  it("returns PASS WITH NOTES for the current implementation", () => {
    expect(buildPhase19DCloseoutReport()).toMatchObject({
      report_version: "19D.11",
      report_id: "phase-19d-cai-governed-red-team-closeout",
      verdict: "PASS_WITH_NOTES",
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      feature_complete_for_phase_19d: true,
      cai_governed_ready: true,
      cai_executing: false,
      cai_integration_path_modeled: true,
      real_cai_execution_blocked_until_future_enablement: true,
      viewer_route: "/audit/red-team-sandbox",
      viewer_route_visible: true,
      viewer_sections: PHASE_19D_VIEWER_REQUIRED_SECTIONS,
      viewer_local_controls: PHASE_19D_VIEWER_LOCAL_CONTROLS,
      viewer_safety_guarded_before_render: true,
      denied_examples_denied_only: true,
      cai_installed: false,
      cai_imported: false,
      cai_called: false,
      cai_provider_install_state: "not_installed",
      cai_provider_execution_state: "disabled",
      localhost_execution_gate_verdict: "blocked",
      python_sidecar_created: false,
      command_executed: false,
      process_spawned: false,
      filesystem_read: false,
      database_read: false,
      network_scan_performed: false,
      repo_mutated: false,
      tool_created: false,
      approval_decision_created: false,
      authority_token_created: false,
      phase_18_bypass_enabled: false,
      side_effects_performed: false,
      phase_18_boundaries_modified: false,
    });
    expect(
      Phase19DCloseoutReportSchema.safeParse(buildPhase19DCloseoutReport())
        .success,
    ).toBe(true);
  });

  it("contains every required closeout check", () => {
    const report = buildPhase19DCloseoutReport();

    expect(report.checks.map((check) => check.check_id)).toEqual(
      PHASE_19D_CLOSEOUT_CHECK_IDS,
    );
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it("lists all disabled Phase 19D capabilities", () => {
    expect(listPhase19DDisabledCapabilities()).toEqual(
      PHASE_19D_DISABLED_CAPABILITIES,
    );
    expect(listPhase19DDisabledCapabilities()).toEqual(
      expect.arrayContaining([
        "CAI installation",
        "CAI import",
        "CAI real execution",
        "Python sidecar",
        "command execution",
        "process spawn",
        "network scanning",
        "public internet target access",
        "private LAN target access",
        "third-party target access",
        "credential attacks",
        "exploit execution",
        "destructive actions",
        "persistence/lateral movement",
        "data exfiltration",
        "filesystem reads",
        "database reads",
        "repo mutation",
        "tool creation",
        "approval decisions",
        "authority token creation",
        "Phase 18 bypass",
        "side effects",
      ]),
    );
  });

  it("safe fixtures pass and unsafe fixtures fail", () => {
    expect(
      validateRedTeamRunProposal(buildSafeLocalhostStaticAnalysisProposal())
        .verdict,
    ).toBe("allowed_metadata_only");
    expect(
      validateRedTeamRunProposal(buildDeniedPublicInternetScanProposal())
        .verdict,
    ).toBe("denied");
    expect(
      validateRedTeamRunProposal(buildDeniedDestructiveActionProposal())
        .verdict,
    ).toBe("denied");
  });

  it("includes viewer route and inspection/filtering evidence", () => {
    const report = buildPhase19DCloseoutReport();

    expect(report.viewer_route).toBe("/audit/red-team-sandbox");
    expect(report.evidence.map((item) => item.source_slice)).toEqual([
      "19D.1",
      "19D.2",
      "19D.3",
      "19D.4",
      "19D.5",
      "19D.6",
      "19D.7",
      "19D.8",
      "19D.9",
      "19D.10",
      "19D.11",
    ]);
    expect(report.checks.map((check) => check.check_id)).toEqual(
      expect.arrayContaining([
        "phase_19d3_visible_route_exists",
        "phase_19d4_inspection_filtering_exists",
        "viewer_renders_required_sections",
        "local_selection_search_filtering_supported",
        "phase_19d_cai_governed_ready_not_executing",
      ]),
    );
  });

  it("includes CAI modeled-but-not-executable evidence", () => {
    const report = buildPhase19DCloseoutReport();
    const checkIds = report.checks.map((check) => check.check_id);

    expect(checkIds).toEqual(
      expect.arrayContaining([
        "phase_19d6_cai_adapter_contract_exists",
        "phase_19d7_cai_provider_manifest_readiness_exists",
        "phase_19d8_cai_mock_dry_run_provider_exists",
        "phase_19d9_cai_approval_binding_exists",
        "phase_19d10_cai_localhost_execution_gate_exists",
        "mock_dry_run_metadata_only_synthetic",
        "cai_provider_not_installed",
        "cai_execution_state_disabled",
        "localhost_execution_gate_blocked",
        "every_cai_proposal_requires_approval_metadata",
        "every_cai_request_is_dry_run_first",
      ]),
    );
    expect(report.evidence.map((item) => item.evidence_id)).toEqual(
      expect.arrayContaining([
        "phase-19d-evidence:cai-adapter-contract",
        "phase-19d-evidence:cai-provider-manifest",
        "phase-19d-evidence:cai-mock-provider",
        "phase-19d-evidence:cai-approval-binding",
        "phase-19d-evidence:cai-localhost-gate",
        "phase-19d-evidence:final-cai-closeout",
      ]),
    );
    expect(report.cai_integration_path_modeled).toBe(true);
    expect(report.real_cai_execution_blocked_until_future_enablement).toBe(
      true,
    );
  });

  it("proves CAI is modeled but not installed or executed", () => {
    const manifest = getCaiProviderManifest();
    const readiness = buildCaiProviderReadinessReport();
    const gate = buildCaiLocalhostExecutionReadinessReport();

    expect(manifest).toMatchObject({
      install_state: "not_installed",
      execution_state: "disabled",
      cai_imported: false,
      cai_called: false,
      cai_installed: false,
      execution_enabled: false,
    });
    expect(readiness).toMatchObject({
      executable: false,
      cai_imported: false,
      cai_called: false,
      cai_installed: false,
      command_executed: false,
      approval_decision_created: false,
      authority_token_created: false,
    });
    expect(gate).toMatchObject({
      verdict: "blocked",
      execution_enabled: false,
      approval_decision_exists: false,
      authority_token_exists: false,
      python_sidecar_exists: false,
    });
  });

  it("includes mock provider, approval binding, and localhost gate proof", () => {
    const request = buildCaiAdapterRunRequest({
      request_id: "cai-adapter-request:phase-19d-closeout-test",
      proposal: buildSafeLocalhostStaticAnalysisProposal(),
    });
    const dryRun = runCaiMockDryRun(request);
    const approvalProposal = buildCaiApprovalProposal(request);
    const gate = buildCaiLocalhostExecutionReadinessReport();

    expect(dryRun).toMatchObject({
      accepted: true,
      metadata_only: true,
      synthetic_only: true,
      cai_called: false,
      execution_enabled: false,
      subprocess_launch_enabled: false,
      process_spawn_enabled: false,
      network_scan_enabled: false,
    });
    expect(approvalProposal).toMatchObject({
      approval_required: true,
      approval_metadata_present: true,
      dry_run_required: true,
      dry_run_first: true,
      approval_decision_created: false,
      authority_token_created: false,
      execution_plan_dispatch_enabled: false,
      cai_execution_enabled: false,
    });
    expect(gate.verdict).toBe("blocked");
  });

  it("assertion helper passes for the current implementation", () => {
    expect(() => assertPhase19DCloseoutPasses()).not.toThrow();
  });

  it("report output is deterministic", () => {
    expect(JSON.stringify(buildPhase19DCloseoutReport())).toBe(
      JSON.stringify(buildPhase19DCloseoutReport()),
    );
  });

  it("report output is defensive-copy-safe", () => {
    const report = buildPhase19DCloseoutReport();
    report.checks[0].label = "Mutated Closeout Report";
    report.disabled_capabilities[0] = "side effects";

    const freshReport = buildPhase19DCloseoutReport();
    expect(freshReport.checks[0]).toMatchObject({
      check_id: "phase_19d1_contracts_validators_fixtures_exist",
      label: "Phase 19D.1 sandbox contracts, validators, and fixtures exist.",
    });
    expect(freshReport.disabled_capabilities[0]).toBe("CAI installation");
  });

  it("closeout output does not leak forbidden raw data", () => {
    const report = buildPhase19DCloseoutReport();
    const keys = collectKeys(report);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
    expect(JSON.stringify(report)).not.toMatch(
      /sk-[a-z0-9_-]{10,}|api[_-]?key|bearer\s+[a-z0-9._-]{12,}|password\s*[:=]/i,
    );
  });

  it("viewer route renders the final read-only sandbox feature", () => {
    const html = renderToStaticMarkup(createElement(RedTeamSandboxPage));

    expect(html).toContain('data-red-team-sandbox-viewer="read-only"');
    expect(html).toContain('data-projection-safety-checked="true"');
    expect(html).toContain("Red-Team Sandbox");
    expect(html).toContain("Sandbox status");
    expect(html).toContain("Allowed Target Scopes");
    expect(html).toContain("Forbidden Target Scopes");
    expect(html).toContain("Allowed Action Classes");
    expect(html).toContain("Forbidden Action Classes");
    expect(html).toContain("Sandbox Profiles");
    expect(html).toContain("Proposal Summaries");
    expect(html).toContain("Safety Violations and Warnings");
    expect(html).toContain("Profile Inspection");
    expect(html).toContain("Proposal Inspection");
    expect(html).toContain("Warning Inspection");
    expect(html).toContain("Search sandbox");
    expect(html).toContain("Inspect profile");
    expect(html).toContain("Inspect proposal");
    expect(html).toContain("Inspect warning");
    expect(html).not.toMatch(
      /\b(approve|retry|run|mutate|dispatch|execute|tool-call)\b/i,
    );
    expect(html).not.toMatch(
      /raw_payload|tool_args|raw_prompt|model output|voice transcript|ocr text|frame bytes|secret|approval token|shell_command|executable_payload/i,
    );
    expect(html).not.toMatch(
      /call cai|install cai|python sidecar|start sidecar|cai sidecar|cai execute|cai run/i,
    );
  });

  it("viewer helpers prove Phase 19D is feature-complete, not CAI-executing", () => {
    const model = buildRedTeamSandboxViewerModel();
    const state = buildRedTeamSandboxViewerState(model, {
      selectedProfileId: "red-team-profile:phase-19d-local-sandbox",
      selectedProposalId: "red-team-proposal:denied-public-internet-scan",
      targetScopeFilter: "public internet",
      actionClassFilter: "all",
      verdictFilter: "denied only",
      severityFilter: "error",
      showDeniedExamples: true,
      showDisabledCapabilities: true,
      searchQuery: "public",
    });

    expect(state).toMatchObject({
      metadata_only: true,
      read_only: true,
      selected_profile_id: "red-team-profile:phase-19d-local-sandbox",
      selected_proposal_id: "red-team-proposal:denied-public-internet-scan",
      target_scope_filter: "public internet",
      verdict_filter: "denied only",
      severity_filter: "error",
      search_query: "public",
    });
    expect(state.visible_proposals.map((proposal) => proposal.label)).toEqual([
      "Denied public internet proposal",
    ]);
    expect(state.visible_violations.length).toBeGreaterThan(0);
  });

  it("filter helpers remain local, read-only, and deterministic", () => {
    const model = buildRedTeamSandboxViewerModel();
    const before = JSON.stringify(model);
    const deniedProposals = filterRedTeamSandboxViewerProposals(model, {
      targetScopeFilter: "all",
      actionClassFilter: "all",
      verdictFilter: "denied only",
      showDeniedExamples: true,
      searchQuery: "",
    });
    const actionViolations = filterRedTeamSandboxViewerViolations(model, {
      severityFilter: "all",
      showDeniedExamples: true,
      searchQuery: "forbidden action",
    });

    expect(deniedProposals.map((proposal) => proposal.verdict_label)).toEqual([
      "denied only",
      "denied only",
    ]);
    expect(actionViolations.length).toBeGreaterThan(0);
    expect(JSON.stringify(model)).toBe(before);
    expect(JSON.stringify(deniedProposals)).toBe(
      JSON.stringify(
        filterRedTeamSandboxViewerProposals(model, {
          targetScopeFilter: "all",
          actionClassFilter: "all",
          verdictFilter: "denied only",
          showDeniedExamples: true,
          searchQuery: "",
        }),
      ),
    );
  });

  it("closeout exports introduce no forbidden affordance names", () => {
    const exportedFunctionNames = Object.entries(redTeamSandbox)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
