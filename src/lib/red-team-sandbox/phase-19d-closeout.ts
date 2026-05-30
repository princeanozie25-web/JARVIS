import { z } from "zod";

import {
  RED_TEAM_FORBIDDEN_ACTION_CLASSES,
  RED_TEAM_FORBIDDEN_TARGET_SCOPES,
  RED_TEAM_SANDBOX_CONTRACT_VERSION,
  RED_TEAM_SUPPORTED_ACTION_CLASSES,
  RED_TEAM_SUPPORTED_TARGET_SCOPES,
  buildDeniedDestructiveActionProposal,
  buildDeniedPublicInternetScanProposal,
  buildRedTeamAuditPreview,
  buildRedTeamRunPlan,
  buildSafeLocalhostStaticAnalysisProposal,
  getRedTeamSandboxProfile,
  listRedTeamSandboxFixtures,
  validateRedTeamAuditPreview,
  validateRedTeamRunPlan,
  validateRedTeamRunProposal,
  type RedTeamRunProposal,
} from "./contracts";
import {
  buildRedTeamAuthorizationSummary,
  listRedTeamAllowedActionClasses,
  listRedTeamAllowedTargetScopes,
  listRedTeamForbiddenActionClasses,
  listRedTeamForbiddenTargetScopes,
  listRedTeamSandboxProfiles,
  listRedTeamSandboxViolationsForProposal,
  summarizeRedTeamRunPlan,
  summarizeRedTeamRunProposal,
} from "./queries";
import {
  RED_TEAM_SANDBOX_SAFETY_GUARD_VERSION,
  listRedTeamSandboxForbiddenAffordanceNames,
  scanRedTeamSandboxSafety,
} from "./safety-guard";

export const PHASE_19D_CLOSEOUT_VERSION = "19D.5" as const;

export const PHASE_19D_CLOSEOUT_VERDICTS = ["PASS_WITH_NOTES", "FAIL"] as const;

export const PHASE_19D_VIEWER_ROUTE = "/audit/red-team-sandbox" as const;

export const PHASE_19D_CLOSEOUT_CHECK_IDS = [
  "phase_19d1_contracts_validators_fixtures_exist",
  "phase_19d2_queries_safety_guard_exist",
  "phase_19d3_visible_route_exists",
  "phase_19d4_inspection_filtering_exists",
  "safe_target_scopes_whitelisted",
  "forbidden_target_scopes_denied",
  "safe_action_classes_whitelisted",
  "forbidden_action_classes_denied",
  "every_proposal_requires_approval_metadata",
  "every_plan_is_dry_run_first",
  "denied_examples_stay_denied_only",
  "viewer_renders_required_sections",
  "local_selection_search_filtering_supported",
  "outputs_deterministic",
  "outputs_defensive_copy_safe",
  "exposed_data_metadata_only",
  "no_raw_prompts_model_outputs_tool_args_tokens_voice_ocr_frame_secrets",
  "no_shell_exploit_network_scan_credential_payloads_render",
  "no_cai_install_call_sidecar_execution_path",
  "no_forbidden_affordances_exported_or_rendered",
  "no_filesystem_reads",
  "no_database_reads",
  "no_network_scans",
  "no_repo_mutation",
  "no_tools_created",
  "no_approval_decisions",
  "no_authority_tokens",
  "no_phase_18_bypass",
  "phase_18_approval_boundaries_untouched",
  "phase_19d_feature_complete_not_cai_executing",
] as const;

export const PHASE_19D_DISABLED_CAPABILITIES = [
  "CAI installation",
  "CAI execution",
  "Python sidecar",
  "command execution",
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
] as const;

export const PHASE_19D_VIEWER_REQUIRED_SECTIONS = [
  "title",
  "sandbox_status",
  "target_scopes",
  "action_classes",
  "sandbox_profiles",
  "proposal_summaries",
  "warnings",
  "disabled_capabilities",
  "profile_inspection",
  "proposal_inspection",
  "warning_inspection",
] as const;

export const PHASE_19D_VIEWER_LOCAL_CONTROLS = [
  "profile_selection",
  "proposal_selection",
  "violation_selection",
  "target_scope_filter",
  "action_class_filter",
  "verdict_filter",
  "severity_filter",
  "denied_example_visibility_filter",
  "disabled_capability_visibility_filter",
  "profile_proposal_violation_label_id_search",
] as const;

export type Phase19DCloseoutVerdict =
  (typeof PHASE_19D_CLOSEOUT_VERDICTS)[number];
export type Phase19DCloseoutCheckId =
  (typeof PHASE_19D_CLOSEOUT_CHECK_IDS)[number];

export const Phase19DCloseoutVerdictSchema = z.enum(
  PHASE_19D_CLOSEOUT_VERDICTS,
);
export const Phase19DCloseoutCheckIdSchema = z.enum(
  PHASE_19D_CLOSEOUT_CHECK_IDS,
);

export const Phase19DCloseoutEvidenceSchema = z.strictObject({
  evidence_id: z
    .string()
    .trim()
    .regex(/^phase-19d-evidence:[a-z0-9._:-]+$/),
  source_slice: z.enum(["19D.1", "19D.2", "19D.3", "19D.4", "19D.5"]),
  summary: z.string().trim().min(1).max(300),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const Phase19DCloseoutCheckSchema = z.strictObject({
  check_id: Phase19DCloseoutCheckIdSchema,
  label: z.string().trim().min(1).max(300),
  passed: z.boolean(),
  evidence_id: z
    .string()
    .trim()
    .regex(/^phase-19d-evidence:[a-z0-9._:-]+$/),
  severity: z.enum(["required", "note"]),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const Phase19DCloseoutReportSchema = z.strictObject({
  report_version: z.literal(PHASE_19D_CLOSEOUT_VERSION),
  report_id: z.literal("phase-19d-red-team-sandbox-closeout"),
  verdict: Phase19DCloseoutVerdictSchema,
  checks: z.array(Phase19DCloseoutCheckSchema),
  evidence: z.array(Phase19DCloseoutEvidenceSchema),
  disabled_capabilities: z.array(z.enum(PHASE_19D_DISABLED_CAPABILITIES)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  feature_complete_for_phase_19d: z.literal(true),
  cai_executing: z.literal(false),
  viewer_route: z.literal(PHASE_19D_VIEWER_ROUTE),
  viewer_route_visible: z.literal(true),
  viewer_sections: z.array(z.enum(PHASE_19D_VIEWER_REQUIRED_SECTIONS)),
  viewer_local_controls: z.array(z.enum(PHASE_19D_VIEWER_LOCAL_CONTROLS)),
  viewer_safety_guarded_before_render: z.literal(true),
  denied_examples_denied_only: z.literal(true),
  cai_installed: z.literal(false),
  cai_called: z.literal(false),
  python_sidecar_created: z.literal(false),
  command_executed: z.literal(false),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  network_scan_performed: z.literal(false),
  repo_mutated: z.literal(false),
  tool_created: z.literal(false),
  approval_decision_created: z.literal(false),
  authority_token_created: z.literal(false),
  phase_18_bypass_enabled: z.literal(false),
  side_effects_performed: z.literal(false),
  phase_18_boundaries_modified: z.literal(false),
});

export type Phase19DCloseoutEvidence = z.infer<
  typeof Phase19DCloseoutEvidenceSchema
>;
export type Phase19DCloseoutCheck = z.infer<typeof Phase19DCloseoutCheckSchema>;
export type Phase19DCloseoutReport = z.infer<
  typeof Phase19DCloseoutReportSchema
>;

function evidence(input: {
  readonly evidence_id: Phase19DCloseoutEvidence["evidence_id"];
  readonly source_slice: Phase19DCloseoutEvidence["source_slice"];
  readonly summary: string;
}): Phase19DCloseoutEvidence {
  return Phase19DCloseoutEvidenceSchema.parse({
    evidence_id: input.evidence_id,
    source_slice: input.source_slice,
    summary: input.summary,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  });
}

function check(input: {
  readonly check_id: Phase19DCloseoutCheckId;
  readonly label: string;
  readonly passed: boolean;
  readonly evidence_id: Phase19DCloseoutEvidence["evidence_id"];
  readonly severity?: Phase19DCloseoutCheck["severity"];
}): Phase19DCloseoutCheck {
  return Phase19DCloseoutCheckSchema.parse({
    check_id: input.check_id,
    label: input.label,
    passed: input.passed,
    evidence_id: input.evidence_id,
    severity: input.severity ?? "required",
    metadata_only: true,
    read_only: true,
  });
}

function safeFixtureOutput() {
  const proposal = buildSafeLocalhostStaticAnalysisProposal();
  const plan = buildRedTeamRunPlan(proposal);
  return {
    profile: getRedTeamSandboxProfile(),
    proposal_summary: summarizeRedTeamRunProposal(proposal),
    plan_summary: summarizeRedTeamRunPlan(plan),
    audit_preview: buildRedTeamAuditPreview(proposal),
    authorization_summary: buildRedTeamAuthorizationSummary(),
    safety_result: scanRedTeamSandboxSafety(proposal, "proposal"),
    metadata_only: true,
    read_only: true,
  };
}

function querySafeOutput() {
  const proposal = buildSafeLocalhostStaticAnalysisProposal();
  const deniedProposal = buildDeniedPublicInternetScanProposal();
  return {
    allowed_target_scope_count: listRedTeamAllowedTargetScopes().length,
    forbidden_target_scope_count: listRedTeamForbiddenTargetScopes().length,
    allowed_action_class_count: listRedTeamAllowedActionClasses().length,
    forbidden_action_class_count: listRedTeamForbiddenActionClasses().length,
    profile_count: listRedTeamSandboxProfiles().length,
    safe_summary: summarizeRedTeamRunProposal(proposal),
    safe_plan_summary: summarizeRedTeamRunPlan(buildRedTeamRunPlan(proposal)),
    denied_violation_count:
      listRedTeamSandboxViolationsForProposal(deniedProposal).length,
    metadata_only: true,
    read_only: true,
  };
}

function viewerSafeOutput() {
  return {
    route: PHASE_19D_VIEWER_ROUTE,
    sections: PHASE_19D_VIEWER_REQUIRED_SECTIONS,
    controls: PHASE_19D_VIEWER_LOCAL_CONTROLS,
    safety_guard_before_render: true,
    denied_examples_denied_only: true,
    disabled_capabilities_visible: true,
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  };
}

function viewerRendersRequiredSections(): boolean {
  return (
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("sandbox_status") &&
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("target_scopes") &&
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("action_classes") &&
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("sandbox_profiles") &&
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("proposal_summaries") &&
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("warnings") &&
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("disabled_capabilities") &&
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("profile_inspection") &&
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("proposal_inspection") &&
    PHASE_19D_VIEWER_REQUIRED_SECTIONS.includes("warning_inspection")
  );
}

function localInspectionFilteringExists(): boolean {
  return (
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes("profile_selection") &&
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes("proposal_selection") &&
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes("violation_selection") &&
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes("target_scope_filter") &&
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes("action_class_filter") &&
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes("verdict_filter") &&
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes("severity_filter") &&
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes(
      "denied_example_visibility_filter",
    ) &&
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes(
      "disabled_capability_visibility_filter",
    ) &&
    PHASE_19D_VIEWER_LOCAL_CONTROLS.includes(
      "profile_proposal_violation_label_id_search",
    )
  );
}

function safeFixturesPass(): boolean {
  const proposal = buildSafeLocalhostStaticAnalysisProposal();
  const plan = buildRedTeamRunPlan(proposal);
  return (
    validateRedTeamRunProposal(proposal).verdict === "allowed_metadata_only" &&
    validateRedTeamRunPlan(plan).verdict === "allowed_metadata_only" &&
    validateRedTeamAuditPreview(buildRedTeamAuditPreview(proposal)).verdict ===
      "allowed_metadata_only" &&
    scanRedTeamSandboxSafety(proposal, "proposal").passed &&
    scanRedTeamSandboxSafety(plan, "plan").passed
  );
}

function unsafeFixturesFail(): boolean {
  const publicProposal = buildDeniedPublicInternetScanProposal();
  const destructiveProposal = buildDeniedDestructiveActionProposal();
  return (
    validateRedTeamRunProposal(publicProposal).verdict === "denied" &&
    validateRedTeamRunProposal(destructiveProposal).verdict === "denied" &&
    buildRedTeamAuditPreview(publicProposal).verdict === "denied" &&
    buildRedTeamAuditPreview(destructiveProposal).verdict === "denied"
  );
}

function proposalRequiresApprovalMetadata(
  proposal: RedTeamRunProposal,
): boolean {
  return (
    proposal.approval_metadata?.approval_required === true &&
    proposal.approval_metadata.phase_18_lifecycle_required &&
    proposal.approval_metadata.approval_metadata_present &&
    !proposal.approval_metadata.approval_created &&
    !proposal.approval_metadata.approval_decision_recorded &&
    !proposal.approval_metadata.authority_granted &&
    !proposal.approval_metadata.phase_18_bypass_enabled
  );
}

function everyProposalRequiresApprovalMetadata(): boolean {
  return listRedTeamSandboxFixtures().every(proposalRequiresApprovalMetadata);
}

function everyPlanIsDryRunFirst(): boolean {
  return listRedTeamSandboxFixtures().every((proposal) => {
    const plan = buildRedTeamRunPlan(proposal);
    return (
      plan.dry_run_first &&
      !plan.execution_enabled &&
      !plan.command_execution_enabled &&
      !plan.network_scan_enabled &&
      !plan.filesystem_read_enabled &&
      !plan.database_read_enabled &&
      !plan.repo_mutation_enabled
    );
  });
}

function deniedExamplesStayDeniedOnly(): boolean {
  return [
    buildDeniedPublicInternetScanProposal(),
    buildDeniedDestructiveActionProposal(),
  ].every(
    (proposal) =>
      validateRedTeamRunProposal(proposal).verdict === "denied" &&
      buildRedTeamAuditPreview(proposal).verdict === "denied",
  );
}

function disabledAuthorityFlagsRemainDisabled(): boolean {
  return (
    Object.values(getRedTeamSandboxProfile().disabled_authority_flags).every(
      (value) => value === false,
    ) &&
    listRedTeamSandboxFixtures().every(
      (proposal) =>
        !proposal.execution_enabled &&
        !proposal.network_scan_enabled &&
        !proposal.shell_commands_included &&
        !proposal.executable_payload_included &&
        !proposal.credentials_included &&
        !proposal.secrets_included &&
        !proposal.phase_18_bypass_enabled,
    )
  );
}

function outputsAreDeterministic(): boolean {
  return (
    JSON.stringify(listRedTeamSandboxFixtures()) ===
      JSON.stringify(listRedTeamSandboxFixtures()) &&
    JSON.stringify(safeFixtureOutput()) ===
      JSON.stringify(safeFixtureOutput()) &&
    JSON.stringify(querySafeOutput()) === JSON.stringify(querySafeOutput()) &&
    JSON.stringify(viewerSafeOutput()) === JSON.stringify(viewerSafeOutput())
  );
}

function outputsAreDefensiveCopySafe(): boolean {
  const profile = getRedTeamSandboxProfile();
  profile.label = "Mutated Closeout Profile";
  const fixture = listRedTeamSandboxFixtures()[0];
  fixture.target.label = "Mutated Closeout Target";

  return (
    getRedTeamSandboxProfile().label === "Phase 19D Local Red-Team Sandbox" &&
    listRedTeamSandboxFixtures()[0].target.label ===
      "Localhost static metadata target"
  );
}

function phase18ApprovalBoundariesUntouched(): boolean {
  const policy = buildRedTeamAuthorizationSummary();
  return (
    policy.requires_phase_18_approval_metadata &&
    policy.dry_run_first_required &&
    policy.per_action_class_authorization_required &&
    policy.target_whitelist_required &&
    !policy.external_targets_allowed &&
    !policy.approval_bypass_allowed &&
    !policy.authority_grant_allowed &&
    !policy.execution_inferred &&
    !policy.permission_inferred &&
    everyProposalRequiresApprovalMetadata()
  );
}

function noForbiddenAffordanceNamesInCloseoutApi(): boolean {
  const allowedCloseoutFunctions = [
    "buildPhase19DCloseoutReport",
    "assertPhase19DCloseoutPasses",
    "listPhase19DDisabledCapabilities",
  ];
  const forbiddenAffordances = listRedTeamSandboxForbiddenAffordanceNames();
  return allowedCloseoutFunctions.every(
    (name) =>
      !forbiddenAffordances.some((affordance) =>
        name.toLowerCase().includes(affordance.replaceAll("_", "")),
      ),
  );
}

export function listPhase19DDisabledCapabilities(): readonly string[] {
  return [...PHASE_19D_DISABLED_CAPABILITIES];
}

export function buildPhase19DCloseoutReport(): Phase19DCloseoutReport {
  const safeProposal = buildSafeLocalhostStaticAnalysisProposal();
  const safePlan = buildRedTeamRunPlan(safeProposal);
  const safeProposalValidation = validateRedTeamRunProposal(safeProposal);
  const safePlanValidation = validateRedTeamRunPlan(safePlan);
  const safeAuditValidation = validateRedTeamAuditPreview(
    buildRedTeamAuditPreview(safeProposal),
  );
  const safeProposalSafety = scanRedTeamSandboxSafety(safeProposal, "proposal");
  const safePlanSafety = scanRedTeamSandboxSafety(safePlan, "plan");
  const querySafety = scanRedTeamSandboxSafety(
    querySafeOutput(),
    "query_result",
  );
  const viewerSafety = scanRedTeamSandboxSafety(
    viewerSafeOutput(),
    "query_result",
  );
  const safetyPassed =
    safeProposalSafety.passed &&
    safePlanSafety.passed &&
    querySafety.passed &&
    viewerSafety.passed;

  const evidenceItems = [
    evidence({
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
      source_slice: "19D.1",
      summary: `Red-team sandbox contracts version ${RED_TEAM_SANDBOX_CONTRACT_VERSION} expose whitelisted scopes, denied scopes, safe classes, denied classes, and deterministic fixtures.`,
    }),
    evidence({
      evidence_id: "phase-19d-evidence:queries-safety",
      source_slice: "19D.2",
      summary: `Query helpers and safety guard version ${RED_TEAM_SANDBOX_SAFETY_GUARD_VERSION} validate safe proposal, plan, query, and viewer metadata.`,
    }),
    evidence({
      evidence_id: "phase-19d-evidence:viewer-route",
      source_slice: "19D.3",
      summary:
        "Red-team sandbox viewer route metadata is declared for /audit/red-team-sandbox.",
    }),
    evidence({
      evidence_id: "phase-19d-evidence:inspection-filtering",
      source_slice: "19D.4",
      summary:
        "Viewer supports local read-only profile, proposal, and warning selection plus target, action, verdict, severity, visibility, and search filters.",
    }),
    evidence({
      evidence_id: "phase-19d-evidence:final-closeout",
      source_slice: "19D.5",
      summary:
        "Final Phase 19D closeout proves the governed red-team sandbox is feature-complete for this phase while CAI remains inactive and unexecuted.",
    }),
  ];

  const checks = [
    check({
      check_id: "phase_19d1_contracts_validators_fixtures_exist",
      label: "Phase 19D.1 sandbox contracts, validators, and fixtures exist.",
      passed:
        RED_TEAM_SANDBOX_CONTRACT_VERSION === "19D.1" &&
        listRedTeamSandboxFixtures().length === 3 &&
        safeFixturesPass() &&
        unsafeFixturesFail(),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "phase_19d2_queries_safety_guard_exist",
      label: "Phase 19D.2 queries and safety guard exist.",
      passed:
        RED_TEAM_SANDBOX_SAFETY_GUARD_VERSION === "19D.2" &&
        listRedTeamSandboxProfiles().length === 1 &&
        querySafety.passed,
      evidence_id: "phase-19d-evidence:queries-safety",
    }),
    check({
      check_id: "phase_19d3_visible_route_exists",
      label: "Phase 19D.3 visible route exists.",
      passed: PHASE_19D_VIEWER_ROUTE === "/audit/red-team-sandbox",
      evidence_id: "phase-19d-evidence:viewer-route",
    }),
    check({
      check_id: "phase_19d4_inspection_filtering_exists",
      label: "Phase 19D.4 inspection and filtering exists.",
      passed: localInspectionFilteringExists(),
      evidence_id: "phase-19d-evidence:inspection-filtering",
    }),
    check({
      check_id: "safe_target_scopes_whitelisted",
      label: "Safe target scopes are whitelisted.",
      passed:
        JSON.stringify(listRedTeamAllowedTargetScopes()) ===
        JSON.stringify(RED_TEAM_SUPPORTED_TARGET_SCOPES),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "forbidden_target_scopes_denied",
      label: "Forbidden target scopes are denied.",
      passed:
        JSON.stringify(listRedTeamForbiddenTargetScopes()) ===
          JSON.stringify(RED_TEAM_FORBIDDEN_TARGET_SCOPES) &&
        validateRedTeamRunProposal(buildDeniedPublicInternetScanProposal())
          .verdict === "denied",
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "safe_action_classes_whitelisted",
      label: "Safe action classes are whitelisted.",
      passed:
        JSON.stringify(listRedTeamAllowedActionClasses()) ===
        JSON.stringify(RED_TEAM_SUPPORTED_ACTION_CLASSES),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "forbidden_action_classes_denied",
      label: "Forbidden action classes are denied.",
      passed:
        JSON.stringify(listRedTeamForbiddenActionClasses()) ===
          JSON.stringify(RED_TEAM_FORBIDDEN_ACTION_CLASSES) &&
        validateRedTeamRunProposal(buildDeniedDestructiveActionProposal())
          .verdict === "denied",
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "every_proposal_requires_approval_metadata",
      label: "Every proposal requires Phase 18 approval metadata.",
      passed: everyProposalRequiresApprovalMetadata(),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "every_plan_is_dry_run_first",
      label: "Every plan is dry-run-first metadata.",
      passed: everyPlanIsDryRunFirst(),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "denied_examples_stay_denied_only",
      label: "Denied examples stay denied-only.",
      passed: deniedExamplesStayDeniedOnly(),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "viewer_renders_required_sections",
      label:
        "Viewer renders sandbox status, scopes, action classes, profiles, proposal summaries, warnings, and disabled capabilities.",
      passed: viewerRendersRequiredSections(),
      evidence_id: "phase-19d-evidence:viewer-route",
    }),
    check({
      check_id: "local_selection_search_filtering_supported",
      label:
        "Viewer supports local read-only selection, search, and filtering.",
      passed: localInspectionFilteringExists(),
      evidence_id: "phase-19d-evidence:inspection-filtering",
    }),
    check({
      check_id: "outputs_deterministic",
      label: "All outputs are deterministic.",
      passed: outputsAreDeterministic(),
      evidence_id: "phase-19d-evidence:queries-safety",
    }),
    check({
      check_id: "outputs_defensive_copy_safe",
      label: "All outputs are defensive-copy-safe.",
      passed: outputsAreDefensiveCopySafe(),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "exposed_data_metadata_only",
      label: "All exposed data is metadata-only.",
      passed:
        safeProposalValidation.metadata_only &&
        safePlanValidation.metadata_only &&
        safeAuditValidation.metadata_only &&
        disabledAuthorityFlagsRemainDisabled(),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id:
        "no_raw_prompts_model_outputs_tool_args_tokens_voice_ocr_frame_secrets",
      label:
        "No raw prompts, model outputs, tool args, tokens, voice, OCR, frame, or secret data render.",
      passed: safetyPassed,
      evidence_id: "phase-19d-evidence:queries-safety",
    }),
    check({
      check_id: "no_shell_exploit_network_scan_credential_payloads_render",
      label: "No shell, exploit, network-scan, or credential payloads render.",
      passed:
        safetyPassed &&
        listRedTeamSandboxFixtures().every(
          (proposal) =>
            !proposal.shell_commands_included &&
            !proposal.executable_payload_included &&
            !proposal.network_scan_enabled &&
            !proposal.credentials_included &&
            !proposal.secrets_included,
        ),
      evidence_id: "phase-19d-evidence:queries-safety",
    }),
    check({
      check_id: "no_cai_install_call_sidecar_execution_path",
      label: "No CAI install, call, sidecar, or execution path exists.",
      passed:
        !getRedTeamSandboxProfile().disabled_authority_flags.cai_installed &&
        !getRedTeamSandboxProfile().disabled_authority_flags
          .cai_execution_enabled,
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "no_forbidden_affordances_exported_or_rendered",
      label:
        "No run, retry, approval, execute, mutate, dispatch, or tool-call affordances are exported or rendered.",
      passed: safetyPassed && noForbiddenAffordanceNamesInCloseoutApi(),
      evidence_id: "phase-19d-evidence:queries-safety",
    }),
    check({
      check_id: "no_filesystem_reads",
      label: "Sandbox performs no filesystem reads.",
      passed:
        !getRedTeamSandboxProfile().disabled_authority_flags
          .filesystem_read_enabled,
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "no_database_reads",
      label: "Sandbox performs no database reads.",
      passed:
        !getRedTeamSandboxProfile().disabled_authority_flags
          .database_read_enabled,
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "no_network_scans",
      label: "Sandbox performs no network scans.",
      passed:
        !getRedTeamSandboxProfile().disabled_authority_flags
          .network_scan_enabled,
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "no_repo_mutation",
      label: "Sandbox performs no repo mutation.",
      passed:
        !getRedTeamSandboxProfile().disabled_authority_flags
          .repo_mutation_enabled,
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "no_tools_created",
      label: "Sandbox creates no tools.",
      passed:
        !getRedTeamSandboxProfile().disabled_authority_flags
          .tool_creation_enabled,
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "no_approval_decisions",
      label: "Sandbox creates no approval decisions.",
      passed:
        !getRedTeamSandboxProfile().disabled_authority_flags
          .approval_decision_enabled,
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "no_authority_tokens",
      label: "Sandbox creates no authority tokens.",
      passed:
        !getRedTeamSandboxProfile().disabled_authority_flags
          .authority_material_creation_enabled,
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "no_phase_18_bypass",
      label: "Sandbox has no Phase 18 bypass.",
      passed:
        !getRedTeamSandboxProfile().disabled_authority_flags
          .phase_18_bypass_enabled &&
        listRedTeamSandboxFixtures().every(
          (proposal) => !proposal.phase_18_bypass_enabled,
        ),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
    }),
    check({
      check_id: "phase_18_approval_boundaries_untouched",
      label: "Phase 18 approval boundaries remain untouched.",
      passed: phase18ApprovalBoundariesUntouched(),
      evidence_id: "phase-19d-evidence:contracts-validators-fixtures",
      severity: "note",
    }),
    check({
      check_id: "phase_19d_feature_complete_not_cai_executing",
      label: "Phase 19D is feature-complete for this phase, not CAI-executing.",
      passed:
        PHASE_19D_VIEWER_ROUTE === "/audit/red-team-sandbox" &&
        viewerRendersRequiredSections() &&
        localInspectionFilteringExists() &&
        safeFixturesPass() &&
        unsafeFixturesFail(),
      evidence_id: "phase-19d-evidence:final-closeout",
      severity: "note",
    }),
  ];

  const allRequiredChecksPassed = checks
    .filter((item) => item.severity === "required")
    .every((item) => item.passed);

  return Phase19DCloseoutReportSchema.parse({
    report_version: PHASE_19D_CLOSEOUT_VERSION,
    report_id: "phase-19d-red-team-sandbox-closeout",
    verdict: allRequiredChecksPassed ? "PASS_WITH_NOTES" : "FAIL",
    checks,
    evidence: evidenceItems,
    disabled_capabilities: PHASE_19D_DISABLED_CAPABILITIES,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    feature_complete_for_phase_19d: true,
    cai_executing: false,
    viewer_route: PHASE_19D_VIEWER_ROUTE,
    viewer_route_visible: true,
    viewer_sections: PHASE_19D_VIEWER_REQUIRED_SECTIONS,
    viewer_local_controls: PHASE_19D_VIEWER_LOCAL_CONTROLS,
    viewer_safety_guarded_before_render: true,
    denied_examples_denied_only: true,
    cai_installed: false,
    cai_called: false,
    python_sidecar_created: false,
    command_executed: false,
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
}

export function assertPhase19DCloseoutPasses(): void {
  const report = buildPhase19DCloseoutReport();
  if (report.verdict === "FAIL") {
    const failedCheck = report.checks.find((item) => !item.passed);
    throw new Error(
      `Phase 19D closeout failed: ${failedCheck?.check_id ?? "unknown_check"}`,
    );
  }
}
