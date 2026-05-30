import { describe, expect, it } from "vitest";

import * as redTeamSandbox from "./index";
import {
  RED_TEAM_FORBIDDEN_ACTION_CLASSES,
  RED_TEAM_FORBIDDEN_TARGET_SCOPES,
  RED_TEAM_SUPPORTED_ACTION_CLASSES,
  RED_TEAM_SUPPORTED_TARGET_SCOPES,
  assertRedTeamSandboxSafe,
  buildDeniedDestructiveActionProposal,
  buildDeniedPublicInternetScanProposal,
  buildRedTeamAuthorizationSummary,
  buildRedTeamRunPlan,
  buildSafeLocalhostStaticAnalysisProposal,
  getRedTeamAuthorizationPolicy,
  getRedTeamSandboxProfile,
  getRedTeamSandboxProfileById,
  listRedTeamAllowedActionClasses,
  listRedTeamAllowedTargetScopes,
  listRedTeamForbiddenActionClasses,
  listRedTeamForbiddenTargetScopes,
  listRedTeamSandboxForbiddenAffordanceNames,
  listRedTeamSandboxForbiddenFieldNames,
  listRedTeamSandboxProfiles,
  listRedTeamSandboxViolationsForProposal,
  scanRedTeamSandboxSafety,
  summarizeRedTeamRunPlan,
  summarizeRedTeamRunProposal,
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
  "createTool",
  "createApproval",
] as const;

describe("Phase 19D.2 red-team sandbox queries and safety guard", () => {
  it("allowed and forbidden scope queries work deterministically", () => {
    expect(listRedTeamAllowedTargetScopes()).toEqual(
      RED_TEAM_SUPPORTED_TARGET_SCOPES,
    );
    expect(listRedTeamForbiddenTargetScopes()).toEqual(
      RED_TEAM_FORBIDDEN_TARGET_SCOPES,
    );
    expect(JSON.stringify(listRedTeamAllowedTargetScopes())).toBe(
      JSON.stringify(listRedTeamAllowedTargetScopes()),
    );
  });

  it("allowed and forbidden action class queries work deterministically", () => {
    expect(listRedTeamAllowedActionClasses()).toEqual(
      RED_TEAM_SUPPORTED_ACTION_CLASSES,
    );
    expect(listRedTeamForbiddenActionClasses()).toEqual(
      RED_TEAM_FORBIDDEN_ACTION_CLASSES,
    );
    expect(JSON.stringify(listRedTeamForbiddenActionClasses())).toBe(
      JSON.stringify(listRedTeamForbiddenActionClasses()),
    );
  });

  it("profile lookup works and unknown IDs fail closed", () => {
    const profile = getRedTeamSandboxProfile();

    expect(listRedTeamSandboxProfiles()).toHaveLength(1);
    expect(getRedTeamSandboxProfileById(profile.profile_id)).toMatchObject({
      profile_id: "red-team-profile:phase-19d-local-sandbox",
      metadata_only: true,
      read_only: true,
    });
    expect(
      getRedTeamSandboxProfileById("red-team-profile:not-real"),
    ).toBeNull();
  });

  it("profile query output is defensive-copy-safe", () => {
    const profile = listRedTeamSandboxProfiles()[0];
    profile.label = "Mutated Profile";

    expect(listRedTeamSandboxProfiles()[0].label).toBe(
      "Phase 19D Local Red-Team Sandbox",
    );
  });

  it("proposal and plan summaries are metadata-only and never infer permission", () => {
    const proposal = buildSafeLocalhostStaticAnalysisProposal();
    const plan = buildRedTeamRunPlan(proposal);

    expect(summarizeRedTeamRunProposal(proposal)).toMatchObject({
      proposal_id: "red-team-proposal:safe-localhost-static-analysis",
      target_scope: "localhost_only",
      action_class: "static_analysis",
      verdict: "allowed_metadata_only",
      violation_count: 0,
      approval_required: true,
      approval_metadata_present: true,
      dry_run_required: true,
      execution_inferred: false,
      permission_inferred: false,
      metadata_only: true,
      read_only: true,
    });
    expect(summarizeRedTeamRunPlan(plan)).toMatchObject({
      plan_id: "red-team-plan:safe-localhost-static-analysis",
      verdict: "allowed_metadata_only",
      dry_run_first: true,
      execution_enabled: false,
      command_execution_enabled: false,
      network_scan_enabled: false,
      execution_inferred: false,
      permission_inferred: false,
      metadata_only: true,
      read_only: true,
    });
    expect(summarizeRedTeamRunProposal({ proposal_id: "bad" })).toBeNull();
    expect(summarizeRedTeamRunPlan({ plan_id: "bad" })).toBeNull();
  });

  it("authorization summary remains approval-gated metadata only", () => {
    expect(
      buildRedTeamAuthorizationSummary(getRedTeamAuthorizationPolicy()),
    ).toMatchObject({
      requires_phase_18_approval_metadata: true,
      dry_run_first_required: true,
      per_action_class_authorization_required: true,
      target_whitelist_required: true,
      external_targets_allowed: false,
      approval_bypass_allowed: false,
      authority_grant_allowed: false,
      execution_inferred: false,
      permission_inferred: false,
      metadata_only: true,
      read_only: true,
    });
  });

  it("violations for bad proposals are surfaced as metadata", () => {
    expect(
      listRedTeamSandboxViolationsForProposal(
        buildDeniedPublicInternetScanProposal(),
      ).map((violation) => violation.reason_code),
    ).toEqual(
      expect.arrayContaining([
        "forbidden_target_scope",
        "forbidden_action_class",
      ]),
    );
    expect(
      listRedTeamSandboxViolationsForProposal(
        buildDeniedDestructiveActionProposal(),
      ).map((violation) => violation.reason_code),
    ).toContain("forbidden_action_class");
  });

  it("current safe fixtures and query outputs pass safety scan", () => {
    const proposal = buildSafeLocalhostStaticAnalysisProposal();
    const plan = buildRedTeamRunPlan(proposal);
    const safeTargets = [
      getRedTeamSandboxProfile(),
      proposal,
      plan,
      summarizeRedTeamRunProposal(proposal),
      summarizeRedTeamRunPlan(plan),
      buildRedTeamAuthorizationSummary(),
    ];

    for (const target of safeTargets) {
      expect(scanRedTeamSandboxSafety(target)).toMatchObject({
        passed: true,
        violation_count: 0,
        metadata_only: true,
        read_only: true,
        diagnostics_only: true,
        raw_value_included: false,
      });
      expect(() => assertRedTeamSandboxSafe(target)).not.toThrow();
    }
  });

  it("rejects injected shell, exploit, network, credential, and secret payloads", () => {
    const result = scanRedTeamSandboxSafety(
      {
        z_shell: "rm -rf C:/Users/princ/Documents/jarvis",
        exploit_note: "reverse shell payload=redacted",
        network_note: "nmap -A 203.0.113.10",
        credential_note: "password spray against redacted target",
        secret_note: "Bearer abcdefghijklmnopqrstuvwxyz",
      },
      "query_result",
    );

    expect(result.passed).toBe(false);
    expect(result.violations.map((violation) => violation.kind)).toEqual(
      expect.arrayContaining([
        "shell_command",
        "exploit_payload",
        "network_scan_command",
        "credential_attack",
        "secret_material",
      ]),
    );
    expect(JSON.stringify(result)).not.toContain("rm -rf");
    expect(JSON.stringify(result)).not.toContain("reverse shell");
    expect(JSON.stringify(result)).not.toContain("203.0.113.10");
    expect(JSON.stringify(result)).not.toContain("password spray");
    expect(JSON.stringify(result)).not.toContain("abcdefghijklmnopqrstuvwxyz");
  });

  it("rejects external URLs, external IPs, and unsafe filesystem paths", () => {
    const result = scanRedTeamSandboxSafety(
      {
        external_url: "https://redacted.example",
        external_ip: "192.168.1.20",
        filesystem_path: "C:\\Users\\princ\\Documents\\jarvis\\.env.local",
      },
      "query_result",
    );

    expect(result.passed).toBe(false);
    expect(result.violations.map((violation) => violation.kind)).toEqual([
      "external_target",
      "external_target",
      "unsafe_filesystem_path",
    ]);
    expect(JSON.stringify(result)).not.toContain("redacted.example");
    expect(JSON.stringify(result)).not.toContain("192.168.1.20");
    expect(JSON.stringify(result)).not.toContain(".env.local");
  });

  it("rejects raw tool args, approval tokens, and authority token creation fields", () => {
    const result = scanRedTeamSandboxSafety(
      {
        tool_arguments: { target: "localhost" },
        approval_token: "redacted-approval-token",
        create_authority_token: false,
      },
      "query_result",
    );

    expect(result.passed).toBe(false);
    expect(result.violations.map((violation) => violation.kind)).toEqual([
      "approval_token",
      "authority_token_creation",
      "raw_tool_arguments",
    ]);
    expect(JSON.stringify(result)).not.toContain("redacted-approval-token");
  });

  it("rejects CAI execution and sidecar affordance names", () => {
    const result = scanRedTeamSandboxSafety(
      {
        call_cai: false,
        python_sidecar: false,
      },
      "query_result",
    );

    expect(result.passed).toBe(false);
    expect(result.violations.map((violation) => violation.kind)).toEqual([
      "cai_execution_affordance",
      "cai_sidecar_affordance",
    ]);
  });

  it("rejects action affordance names", () => {
    const result = scanRedTeamSandboxSafety(
      {
        execute: false,
        dispatch: false,
        approve: false,
      },
      "query_result",
    );

    expect(result.passed).toBe(false);
    expect(result.violations.map((violation) => violation.kind)).toEqual([
      "action_affordance",
      "action_affordance",
      "action_affordance",
    ]);
  });

  it("diagnostics do not leak raw values and violation order is deterministic", () => {
    const target = {
      z_shell: "rm -rf private-value",
      approval_token: "approval-token-private-value",
      call_cai: "python -m cai run private-value",
    };

    expect(JSON.stringify(scanRedTeamSandboxSafety(target))).toBe(
      JSON.stringify(scanRedTeamSandboxSafety(target)),
    );
    expect(
      scanRedTeamSandboxSafety(target).violations.map(
        (violation) => violation.path,
      ),
    ).toEqual(["$.approval_token", "$.call_cai", "$.z_shell"]);
    expect(JSON.stringify(scanRedTeamSandboxSafety(target))).not.toContain(
      "private-value",
    );
  });

  it("lists forbidden red-team field and affordance names", () => {
    expect(listRedTeamSandboxForbiddenFieldNames()).toEqual(
      expect.arrayContaining([
        "executable_payload",
        "shell_command",
        "network_scan",
        "exploit_payload",
        "credential",
        "secret",
        "tool_arguments",
        "approval_token",
        "authority_token",
        "external_target",
        "filesystem_path",
      ]),
    );
    expect(listRedTeamSandboxForbiddenAffordanceNames()).toEqual(
      expect.arrayContaining([
        "run",
        "execute",
        "dispatch",
        "mutate",
        "approve",
        "call_cai",
        "install_cai",
        "python_sidecar",
      ]),
    );
  });

  it("exports no forbidden execution, approval, mutation, or CAI affordance names", () => {
    const exportedFunctionNames = Object.entries(redTeamSandbox)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    for (const forbiddenName of FORBIDDEN_EXPORT_NAMES) {
      expect(exportedFunctionNames).not.toContain(forbiddenName);
    }
  });
});
