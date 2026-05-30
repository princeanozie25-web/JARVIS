import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import * as redTeamSandbox from "./index";
import {
  CAI_APPROVAL_BINDING_DISABLED_CAPABILITIES,
  CAI_APPROVAL_BINDING_VERSION,
  CAI_APPROVAL_DENIED_REASONS,
  CAI_APPROVAL_REQUIRED_EVIDENCE_IDS,
  CaiApprovalAuditPreviewSchema,
  CaiApprovalBindingResultSchema,
  CaiApprovalProposalSchema,
  buildCaiAdapterRunRequest,
  buildCaiApprovalAuditPreview,
  buildCaiApprovalProposal,
  buildDeniedDestructiveActionProposal,
  buildDeniedPublicInternetScanProposal,
  buildSafeLocalhostStaticAnalysisProposal,
  listCaiApprovalBindingDisabledCapabilities,
  validateCaiApprovalProposal,
  assertCaiRequiresApproval,
} from "./index";

const APPROVAL_BINDING_SOURCE =
  "src/lib/red-team-sandbox/cai-approval-binding.ts";

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
  "createApprovalDecision",
  "createAuthorityToken",
] as const;

function exportedFunctionNames(): readonly string[] {
  return Object.entries(redTeamSandbox)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name);
}

describe("Phase 19D.9 CAI approval binding contract", () => {
  it("builds an approval proposal for a safe dry-run request", () => {
    const request = buildCaiAdapterRunRequest({
      request_id: "cai-adapter-request:cai-approval-safe",
      proposal: buildSafeLocalhostStaticAnalysisProposal(),
    });
    const proposal = buildCaiApprovalProposal(request);

    expect(CAI_APPROVAL_BINDING_VERSION).toBe("19D.9");
    expect(proposal).toMatchObject({
      cai_approval_proposal_id: "cai-approval-proposal:cai-approval-safe",
      request_id: "cai-adapter-request:cai-approval-safe",
      proposal_id: "red-team-proposal:safe-localhost-static-analysis",
      target_scope: "localhost_only",
      action_class: "static_analysis",
      approval_required: true,
      approval_metadata_present: true,
      dry_run_required: true,
      dry_run_first: true,
      allowed_target_scope: true,
      allowed_action_class: true,
      denied_reasons: [],
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      raw_payload_included: false,
      shell_commands_included: false,
      secrets_included: false,
      executable_content_included: false,
      approval_decision_created: false,
      authority_token_created: false,
      execution_plan_dispatch_enabled: false,
      command_execution_enabled: false,
      cai_execution_enabled: false,
    });
    expect(proposal.required_evidence.map((item) => item.evidence_id)).toEqual(
      CAI_APPROVAL_REQUIRED_EVIDENCE_IDS,
    );
    expect(CaiApprovalProposalSchema.safeParse(proposal).success).toBe(true);
  });

  it("validates safe approval proposal metadata", () => {
    const proposal = buildCaiApprovalProposal(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:cai-approval-validate",
        proposal: buildSafeLocalhostStaticAnalysisProposal(),
      }),
    );
    const result = validateCaiApprovalProposal(proposal);

    expect(result).toMatchObject({
      binding_result_id: "cai-approval-binding-result:cai-approval-validate",
      valid: true,
      denied_reasons: [],
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      approval_decision_created: false,
      authority_token_created: false,
      execution_plan_dispatch_enabled: false,
      command_execution_enabled: false,
      cai_execution_enabled: false,
    });
    expect(CaiApprovalBindingResultSchema.safeParse(result).success).toBe(true);
    expect(() => assertCaiRequiresApproval(proposal)).not.toThrow();
  });

  it("builds a metadata-only audit preview", () => {
    const proposal = buildCaiApprovalProposal(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:cai-approval-audit",
        proposal: buildSafeLocalhostStaticAnalysisProposal(),
      }),
    );
    const preview = buildCaiApprovalAuditPreview(proposal);

    expect(preview).toMatchObject({
      audit_preview_id: "cai-approval-audit:cai-approval-audit",
      cai_approval_proposal_id: "cai-approval-proposal:cai-approval-audit",
      proposal_id: "red-team-proposal:safe-localhost-static-analysis",
      target_scope: "localhost_only",
      action_class: "static_analysis",
      approval_required: true,
      dry_run_required: true,
      denied_reasons: [],
      metadata_only: true,
      read_only: true,
      deterministic: true,
      redaction_safe: true,
      raw_payload_included: false,
      shell_commands_included: false,
      secrets_included: false,
      executable_content_included: false,
      approval_decision_created: false,
      authority_token_created: false,
      execution_plan_dispatch_enabled: false,
      command_execution_enabled: false,
      cai_execution_enabled: false,
    });
    expect(CaiApprovalAuditPreviewSchema.safeParse(preview).success).toBe(true);
  });

  it("fails when approval metadata is missing", () => {
    const request = buildCaiAdapterRunRequest({
      request_id: "cai-adapter-request:cai-approval-missing-metadata",
      proposal: {
        ...buildSafeLocalhostStaticAnalysisProposal(),
        approval_metadata: null,
      },
    });
    const proposal = buildCaiApprovalProposal(request);

    expect(proposal.denied_reasons).toEqual(
      expect.arrayContaining([
        "missing_phase_18_approval_metadata",
        "unsafe_request_metadata",
      ]),
    );
    expect(validateCaiApprovalProposal(proposal).valid).toBe(false);
    expect(() => assertCaiRequiresApproval(proposal)).toThrow(
      /requires inert Phase 18 metadata/,
    );
  });

  it("fails when request is not dry-run-first", () => {
    const request = {
      ...buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:cai-approval-not-dry-run",
        proposal: buildSafeLocalhostStaticAnalysisProposal(),
      }),
      dry_run_required: false,
    };
    const proposal = buildCaiApprovalProposal(request);

    expect(proposal.denied_reasons).toEqual(
      expect.arrayContaining([
        "metadata_contract_rejected",
        "non_dry_run_request",
      ]),
    );
    expect(validateCaiApprovalProposal(proposal).valid).toBe(false);
  });

  it("fails forbidden target scopes and action classes", () => {
    const publicTargetProposal = buildCaiApprovalProposal(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:cai-approval-public-target",
        proposal: buildDeniedPublicInternetScanProposal(),
      }),
    );
    const destructiveProposal = buildCaiApprovalProposal(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:cai-approval-destructive-action",
        proposal: buildDeniedDestructiveActionProposal(),
      }),
    );

    expect(publicTargetProposal.denied_reasons).toEqual(
      expect.arrayContaining([
        "forbidden_target_scope",
        "forbidden_action_class",
        "unsafe_request_metadata",
      ]),
    );
    expect(destructiveProposal.denied_reasons).toEqual(
      expect.arrayContaining([
        "forbidden_action_class",
        "unsafe_request_metadata",
      ]),
    );
    expect(validateCaiApprovalProposal(publicTargetProposal).valid).toBe(false);
    expect(validateCaiApprovalProposal(destructiveProposal).valid).toBe(false);
  });

  it("creates no approval decision, authority token, execution, or dispatch affordance", () => {
    const proposal = buildCaiApprovalProposal(
      buildCaiAdapterRunRequest({
        request_id: "cai-adapter-request:cai-approval-disabled-flags",
        proposal: buildSafeLocalhostStaticAnalysisProposal(),
      }),
    );
    const result = validateCaiApprovalProposal(proposal);

    expect(proposal).toMatchObject({
      approval_decision_created: false,
      authority_token_created: false,
      execution_plan_dispatch_enabled: false,
      command_execution_enabled: false,
      cai_execution_enabled: false,
    });
    expect(result.audit_preview).toMatchObject({
      approval_decision_created: false,
      authority_token_created: false,
      execution_plan_dispatch_enabled: false,
      command_execution_enabled: false,
      cai_execution_enabled: false,
    });
    expect(listCaiApprovalBindingDisabledCapabilities()).toEqual(
      CAI_APPROVAL_BINDING_DISABLED_CAPABILITIES,
    );
    expect(CAI_APPROVAL_DENIED_REASONS).toEqual([
      "missing_phase_18_approval_metadata",
      "non_dry_run_request",
      "forbidden_target_scope",
      "forbidden_action_class",
      "unsafe_request_metadata",
      "provider_executable_state",
      "metadata_contract_rejected",
    ]);
  });

  it("source has no CAI import, child process, filesystem, database, or network usage", () => {
    const source = readFileSync(APPROVAL_BINDING_SOURCE, "utf8");

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
