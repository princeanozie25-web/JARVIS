import { describe, expect, it } from "vitest";

import * as redTeamSandbox from "./index";
import {
  RED_TEAM_FORBIDDEN_ACTION_CLASSES,
  RED_TEAM_FORBIDDEN_TARGET_SCOPES,
  RED_TEAM_SANDBOX_CONTRACT_VERSION,
  RED_TEAM_SUPPORTED_ACTION_CLASSES,
  RED_TEAM_SUPPORTED_TARGET_SCOPES,
  RedTeamAuditPreviewSchema,
  RedTeamRunPlanSchema,
  RedTeamRunProposalSchema,
  RedTeamSandboxProfileSchema,
  buildDeniedDestructiveActionProposal,
  buildDeniedPublicInternetScanProposal,
  buildRedTeamAuditPreview,
  buildRedTeamRunPlan,
  buildSafeLocalhostStaticAnalysisProposal,
  getRedTeamAuthorizationPolicy,
  getRedTeamSandboxProfile,
  listRedTeamSandboxFixtures,
  validateRedTeamAuditPreview,
  validateRedTeamRunPlan,
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
  "createTool",
  "createApproval",
] as const;

const FORBIDDEN_RAW_KEYS = [
  "command",
  "shell_command",
  "executable_payload",
  "raw_payload",
  "raw_prompt",
  "model_output",
  "tool_args",
  "credential",
  "credentials",
  "password",
  "secret",
  "secrets",
  "api_key",
  "access_token",
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

function reasonCodes(result: ReturnType<typeof validateRedTeamRunProposal>) {
  return result.violations.map((violation) => violation.reason_code);
}

describe("Phase 19D.1 red-team sandbox contracts", () => {
  it("declares target scopes, action classes, and sandbox profile metadata", () => {
    expect(RED_TEAM_SANDBOX_CONTRACT_VERSION).toBe("19D.1");
    expect(RED_TEAM_SUPPORTED_TARGET_SCOPES).toEqual([
      "localhost_only",
      "repo_static_analysis_only",
      "synthetic_fixture_only",
    ]);
    expect(RED_TEAM_FORBIDDEN_TARGET_SCOPES).toEqual([
      "public_internet",
      "private_lan",
      "third_party",
      "credentialed_external_system",
      "unknown",
    ]);
    expect(RED_TEAM_SUPPORTED_ACTION_CLASSES).toEqual([
      "read_only_recon",
      "static_analysis",
      "configuration_review",
      "dependency_inventory",
      "synthetic_attack_simulation",
    ]);
    expect(RED_TEAM_FORBIDDEN_ACTION_CLASSES).toEqual([
      "exploit_execution",
      "credential_attack",
      "persistence",
      "lateral_movement",
      "data_exfiltration",
      "destructive_action",
      "network_scan_external",
      "privilege_escalation",
    ]);
    expect(
      RedTeamSandboxProfileSchema.safeParse(getRedTeamSandboxProfile()).success,
    ).toBe(true);
    expect(getRedTeamSandboxProfile()).toMatchObject({
      metadata_only: true,
      read_only: true,
      deterministic: true,
      disabled_authority_flags: {
        cai_installed: false,
        cai_execution_enabled: false,
        command_execution_enabled: false,
        network_scan_enabled: false,
        filesystem_read_enabled: false,
        database_read_enabled: false,
        repo_mutation_enabled: false,
        phase_18_bypass_enabled: false,
      },
    });
  });

  it("safe localhost static analysis proposal validates", () => {
    const proposal = buildSafeLocalhostStaticAnalysisProposal();
    const validation = validateRedTeamRunProposal(proposal);

    expect(RedTeamRunProposalSchema.safeParse(proposal).success).toBe(true);
    expect(validation).toMatchObject({
      verdict: "allowed_metadata_only",
      violation_count: 0,
      metadata_only: true,
      read_only: true,
      redaction_safe: true,
      raw_value_included: false,
    });
    expect(proposal).toMatchObject({
      action_class: "static_analysis",
      dry_run_required: true,
      execution_enabled: false,
      network_scan_enabled: false,
      phase_18_bypass_enabled: false,
      approval_metadata: {
        approval_required: true,
        phase_18_lifecycle_required: true,
        approval_metadata_present: true,
        approval_created: false,
        authority_granted: false,
      },
    });
  });

  it("public internet target is denied", () => {
    const validation = validateRedTeamRunProposal(
      buildDeniedPublicInternetScanProposal(),
    );

    expect(validation.verdict).toBe("denied");
    expect(reasonCodes(validation)).toEqual(
      expect.arrayContaining([
        "forbidden_target_scope",
        "forbidden_action_class",
      ]),
    );
  });

  it("external network scan is denied even with localhost target metadata", () => {
    const proposal = {
      ...buildSafeLocalhostStaticAnalysisProposal(),
      action_class: "network_scan_external",
    };
    const validation = validateRedTeamRunProposal(proposal);

    expect(validation.verdict).toBe("denied");
    expect(reasonCodes(validation)).toContain("forbidden_action_class");
  });

  it("external network targets beyond localhost are rejected", () => {
    const proposal = {
      ...buildSafeLocalhostStaticAnalysisProposal(),
      target: {
        ...buildSafeLocalhostStaticAnalysisProposal().target,
        target_reference: "https://redacted.example",
      },
    };
    const validation = validateRedTeamRunProposal(proposal);

    expect(validation.verdict).toBe("denied");
    expect(reasonCodes(validation)).toContain(
      "external_network_target_detected",
    );
    expect(JSON.stringify(validation)).not.toContain("redacted.example");
  });

  it("destructive action is denied", () => {
    const validation = validateRedTeamRunProposal(
      buildDeniedDestructiveActionProposal(),
    );

    expect(validation.verdict).toBe("denied");
    expect(reasonCodes(validation)).toContain("forbidden_action_class");
  });

  it("credential attack is denied", () => {
    const validation = validateRedTeamRunProposal({
      ...buildSafeLocalhostStaticAnalysisProposal(),
      action_class: "credential_attack",
    });

    expect(validation.verdict).toBe("denied");
    expect(reasonCodes(validation)).toContain("forbidden_action_class");
  });

  it("missing approval metadata fails", () => {
    const validation = validateRedTeamRunProposal({
      ...buildSafeLocalhostStaticAnalysisProposal(),
      approval_metadata: null,
    });

    expect(validation.verdict).toBe("denied");
    expect(reasonCodes(validation)).toContain("missing_approval_metadata");
  });

  it("non-dry-run plan fails", () => {
    const plan = {
      ...buildRedTeamRunPlan(buildSafeLocalhostStaticAnalysisProposal()),
      dry_run_first: false,
    };
    const validation = validateRedTeamRunPlan(plan);

    expect(RedTeamRunPlanSchema.safeParse(plan).success).toBe(true);
    expect(validation.verdict).toBe("denied");
    expect(validation.violations).toEqual([
      expect.objectContaining({
        reason_code: "non_dry_run_plan",
        path: "$.dry_run_first",
        raw_value_included: false,
      }),
    ]);
  });

  it("executable and shell payloads are rejected without leaking values", () => {
    const executableValidation = validateRedTeamRunProposal({
      ...buildSafeLocalhostStaticAnalysisProposal(),
      executable_payload: "function attack() { return true; }",
    });
    const shellValidation = validateRedTeamRunProposal({
      ...buildSafeLocalhostStaticAnalysisProposal(),
      shell_command: "rm -rf C:/Users/princ/Documents/jarvis",
    });

    expect(reasonCodes(executableValidation)).toEqual(
      expect.arrayContaining([
        "executable_payload_detected",
        "metadata_contract_rejected",
      ]),
    );
    expect(reasonCodes(shellValidation)).toEqual(
      expect.arrayContaining([
        "shell_command_detected",
        "metadata_contract_rejected",
      ]),
    );
    expect(JSON.stringify(executableValidation)).not.toContain(
      "function attack",
    );
    expect(JSON.stringify(shellValidation)).not.toContain("rm -rf");
  });

  it("secrets and tokens are rejected without leaking values", () => {
    const validation = validateRedTeamRunProposal({
      ...buildSafeLocalhostStaticAnalysisProposal(),
      access_token: "Bearer abcdefghijklmnopqrstuvwxyz",
    });

    expect(validation.verdict).toBe("denied");
    expect(reasonCodes(validation)).toEqual(
      expect.arrayContaining([
        "secret_material_detected",
        "metadata_contract_rejected",
      ]),
    );
    expect(JSON.stringify(validation)).not.toContain(
      "abcdefghijklmnopqrstuvwxyz",
    );
  });

  it("audit preview is metadata-only and validates", () => {
    const preview = buildRedTeamAuditPreview(
      buildSafeLocalhostStaticAnalysisProposal(),
    );

    expect(RedTeamAuditPreviewSchema.safeParse(preview).success).toBe(true);
    expect(validateRedTeamAuditPreview(preview)).toMatchObject({
      verdict: "allowed_metadata_only",
      violation_count: 0,
      metadata_only: true,
      read_only: true,
      redaction_safe: true,
      raw_value_included: false,
    });
    expect(preview).toMatchObject({
      verdict: "allowed_metadata_only",
      approval_required: true,
      dry_run_first_required: true,
      raw_payload_included: false,
      shell_commands_included: false,
      secrets_included: false,
      metadata_only: true,
      read_only: true,
      redaction_safe: true,
    });
    expect(
      Object.values(preview.disabled_authority_flags).every(
        (value) => value === false,
      ),
    ).toBe(true);
  });

  it("fixtures are deterministic and defensive-copy-safe", () => {
    const fixtures = listRedTeamSandboxFixtures();
    fixtures[0].target.label = "Mutated Fixture";

    expect(
      listRedTeamSandboxFixtures().map((item) => item.proposal_id),
    ).toEqual([
      "red-team-proposal:safe-localhost-static-analysis",
      "red-team-proposal:denied-public-internet-scan",
      "red-team-proposal:denied-destructive-action",
    ]);
    expect(listRedTeamSandboxFixtures()[0].target.label).toBe(
      "Localhost static metadata target",
    );
    expect(JSON.stringify(listRedTeamSandboxFixtures())).toBe(
      JSON.stringify(listRedTeamSandboxFixtures()),
    );
  });

  it("contracts contain no forbidden raw keys in safe outputs", () => {
    const safeOutputs = [
      getRedTeamSandboxProfile(),
      getRedTeamAuthorizationPolicy(),
      buildSafeLocalhostStaticAnalysisProposal(),
      buildRedTeamRunPlan(buildSafeLocalhostStaticAnalysisProposal()),
      buildRedTeamAuditPreview(buildSafeLocalhostStaticAnalysisProposal()),
    ];
    const keys = collectKeys(safeOutputs);

    for (const key of FORBIDDEN_RAW_KEYS) {
      expect(keys).not.toContain(key);
    }
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
