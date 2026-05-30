"use client";

import { useMemo, useState } from "react";

import {
  assertRedTeamSandboxSafe,
  buildDeniedDestructiveActionProposal,
  buildDeniedPublicInternetScanProposal,
  buildRedTeamAuditPreview,
  buildRedTeamAuthorizationSummary,
  buildRedTeamRunPlan,
  buildSafeLocalhostStaticAnalysisProposal,
  listRedTeamAllowedActionClasses,
  listRedTeamAllowedTargetScopes,
  listRedTeamForbiddenActionClasses,
  listRedTeamForbiddenTargetScopes,
  listRedTeamSandboxProfiles,
  listRedTeamSandboxViolationsForProposal,
  scanRedTeamSandboxSafety,
  summarizeRedTeamRunPlan,
  summarizeRedTeamRunProposal,
  type RedTeamRunProposal,
  type RedTeamSandboxViolation,
} from "@/lib/red-team-sandbox";

type TargetScopeFilter = string;
type ActionClassFilter = string;
type VerdictFilter = "all" | "allowed metadata only" | "denied only";
type SeverityFilter = "all" | "warning" | "error";

export interface RedTeamSandboxViewerProfile {
  profile_id: string;
  label: string;
  allowed_scope_count: number;
  forbidden_scope_count: number;
  allowed_action_count: number;
  forbidden_action_count: number;
  allowed_scopes: readonly string[];
  forbidden_scopes: readonly string[];
  allowed_action_classes: readonly string[];
  forbidden_action_classes: readonly string[];
  authorization_summary: RedTeamSandboxViewerAuthorizationSummary;
  disabled_capabilities: readonly string[];
  metadata_only: true;
  read_only: true;
}

export interface RedTeamSandboxViewerAuthorizationSummary {
  policy_id: string;
  phase_18_approval_metadata: string;
  preview_first: string;
  per_class_authorization: string;
  target_whitelist: string;
  external_targets: string;
  authority_grant: string;
  permission_inferred: false;
  metadata_only: true;
  read_only: true;
}

export interface RedTeamSandboxViewerProposalCard {
  proposal_id: string;
  label: string;
  target_scope_label: string;
  action_class_label: string;
  verdict_label: VerdictFilter;
  violation_count: number;
  preview_required: boolean;
  approval_metadata_present: boolean;
  audit_preview_summary: RedTeamSandboxViewerAuditSummary;
  violations: readonly RedTeamSandboxViewerViolation[];
  metadata_only: true;
  read_only: true;
}

export interface RedTeamSandboxViewerAuditSummary {
  audit_preview_id: string;
  verdict_label: string;
  approval_required: true;
  preview_first_required: true;
  raw_payload_included: false;
  shell_commands_included: false;
  secrets_included: false;
  metadata_only: true;
  read_only: true;
}

export interface RedTeamSandboxViewerViolation {
  violation_id: string;
  proposal_id: string;
  proposal_label: string;
  kind_label: string;
  path: string;
  field_name: string;
  severity: "warning" | "error";
  redacted_sample: string;
  sample_class: string;
  recommendation: string;
  denied_only: true;
  metadata_only: true;
  read_only: true;
}

export interface RedTeamSandboxViewerModel {
  allowed_target_scopes: readonly string[];
  forbidden_target_scopes: readonly string[];
  allowed_action_classes: readonly string[];
  forbidden_action_classes: readonly string[];
  target_scope_filters: readonly string[];
  action_class_filters: readonly string[];
  profiles: readonly RedTeamSandboxViewerProfile[];
  proposals: readonly RedTeamSandboxViewerProposalCard[];
  violations: readonly RedTeamSandboxViewerViolation[];
  disabled_capabilities: readonly string[];
  projection_safety_checked: true;
  metadata_only: true;
  read_only: true;
}

export interface RedTeamSandboxViewerControls {
  selectedProfileId?: string;
  selectedProposalId?: string;
  selectedViolationId?: string;
  targetScopeFilter?: TargetScopeFilter;
  actionClassFilter?: ActionClassFilter;
  verdictFilter?: VerdictFilter;
  severityFilter?: SeverityFilter;
  showDeniedExamples?: boolean;
  showDisabledCapabilities?: boolean;
  searchQuery?: string;
}

export interface RedTeamSandboxViewerState {
  selected_profile_id: string;
  selected_proposal_id: string;
  selected_violation_id: string;
  target_scope_filter: TargetScopeFilter;
  action_class_filter: ActionClassFilter;
  verdict_filter: VerdictFilter;
  severity_filter: SeverityFilter;
  show_denied_examples: boolean;
  show_disabled_capabilities: boolean;
  search_query: string;
  visible_profiles: readonly RedTeamSandboxViewerProfile[];
  visible_proposals: readonly RedTeamSandboxViewerProposalCard[];
  visible_violations: readonly RedTeamSandboxViewerViolation[];
  selected_profile: RedTeamSandboxViewerProfile;
  selected_proposal: RedTeamSandboxViewerProposalCard;
  selected_violation: RedTeamSandboxViewerViolation;
  metadata_only: true;
  read_only: true;
}

const ALL_FILTER = "all" as const;

const VERDICT_FILTERS: readonly VerdictFilter[] = [
  "all",
  "allowed metadata only",
  "denied only",
];

const SEVERITY_FILTERS: readonly SeverityFilter[] = ["all", "warning", "error"];

const DISABLED_CAPABILITY_LABELS = [
  "CAI inactive",
  "Sidecar absent",
  "Command use off",
  "External probing off",
  "Filesystem reads off",
  "Database reads off",
  "Repo changes off",
  "Tool creation off",
  "Decision handling off",
  "Authority materials off",
  "Phase 18 bypass off",
] as const;

const SCOPE_LABELS: Record<string, string> = {
  localhost_only: "localhost only",
  repo_static_analysis_only: "repo static analysis only",
  synthetic_fixture_only: "synthetic fixture only",
  public_internet: "public internet",
  private_lan: "private LAN",
  third_party: "third party",
  credentialed_external_system: "credentialed external system",
  unknown: "unknown",
};

const ACTION_LABELS: Record<string, string> = {
  read_only_recon: "read-only reconnaissance",
  static_analysis: "static analysis",
  configuration_review: "configuration review",
  dependency_inventory: "dependency inventory",
  synthetic_attack_simulation: "synthetic attack simulation",
  exploit_execution: "exploit payload class",
  credential_attack: "credential attack",
  persistence: "persistence",
  lateral_movement: "lateral movement",
  data_exfiltration: "data exfiltration",
  destructive_action: "destructive action",
  network_scan_external: "external network probe",
  privilege_escalation: "privilege escalation",
};

export function buildRedTeamSandboxViewerModel(): RedTeamSandboxViewerModel {
  const safeProposal = buildSafeLocalhostStaticAnalysisProposal();
  const deniedPublicProposal = buildDeniedPublicInternetScanProposal();
  const deniedDestructiveProposal = buildDeniedDestructiveActionProposal();
  const allowedTargetScopes =
    listRedTeamAllowedTargetScopes().map(labelForScope);
  const forbiddenTargetScopes =
    listRedTeamForbiddenTargetScopes().map(labelForScope);
  const allowedActionClasses =
    listRedTeamAllowedActionClasses().map(labelForActionClass);
  const forbiddenActionClasses =
    listRedTeamForbiddenActionClasses().map(labelForActionClass);
  const proposals = [
    proposalCard("Safe localhost static analysis proposal", safeProposal),
    proposalCard("Denied public internet proposal", deniedPublicProposal),
    proposalCard(
      "Denied destructive action proposal",
      deniedDestructiveProposal,
    ),
  ];
  const model: RedTeamSandboxViewerModel = {
    allowed_target_scopes: allowedTargetScopes,
    forbidden_target_scopes: forbiddenTargetScopes,
    allowed_action_classes: allowedActionClasses,
    forbidden_action_classes: forbiddenActionClasses,
    target_scope_filters: [
      ALL_FILTER,
      ...allowedTargetScopes,
      ...forbiddenTargetScopes,
    ],
    action_class_filters: [
      ALL_FILTER,
      ...allowedActionClasses,
      ...forbiddenActionClasses,
    ],
    profiles: listRedTeamSandboxProfiles().map((profile) => {
      const summary = buildRedTeamAuthorizationSummary();
      return {
        profile_id: profile.profile_id,
        label: profile.label,
        allowed_scope_count: profile.allowed_target_scopes.length,
        forbidden_scope_count: profile.forbidden_target_scopes.length,
        allowed_action_count: profile.allowed_action_classes.length,
        forbidden_action_count: profile.forbidden_action_classes.length,
        allowed_scopes: allowedTargetScopes,
        forbidden_scopes: forbiddenTargetScopes,
        allowed_action_classes: allowedActionClasses,
        forbidden_action_classes: forbiddenActionClasses,
        authorization_summary: {
          policy_id: summary.policy_id,
          phase_18_approval_metadata: "required",
          preview_first: "required",
          per_class_authorization: "required",
          target_whitelist: "required",
          external_targets: "blocked",
          authority_grant: "blocked",
          permission_inferred: false,
          metadata_only: true,
          read_only: true,
        },
        disabled_capabilities: [...DISABLED_CAPABILITY_LABELS],
        metadata_only: true,
        read_only: true,
      };
    }),
    proposals,
    violations: proposals.flatMap((proposal) => proposal.violations),
    disabled_capabilities: [...DISABLED_CAPABILITY_LABELS],
    projection_safety_checked: true,
    metadata_only: true,
    read_only: true,
  };

  assertRedTeamSandboxSafe(model);
  const safety = scanRedTeamSandboxSafety(model, "query_result");
  if (!safety.passed) {
    throw new Error("Red-team sandbox viewer model withheld by safety guard");
  }

  return model;
}

export function buildRedTeamSandboxViewerState(
  model: RedTeamSandboxViewerModel,
  controls: RedTeamSandboxViewerControls = {},
): RedTeamSandboxViewerState {
  const targetScopeFilter = controls.targetScopeFilter ?? ALL_FILTER;
  const actionClassFilter = controls.actionClassFilter ?? ALL_FILTER;
  const verdictFilter = controls.verdictFilter ?? ALL_FILTER;
  const severityFilter = controls.severityFilter ?? ALL_FILTER;
  const showDeniedExamples = controls.showDeniedExamples ?? true;
  const showDisabledCapabilities = controls.showDisabledCapabilities ?? true;
  const searchQuery = controls.searchQuery ?? "";
  const visibleProfiles = filterRedTeamSandboxViewerProfiles(
    model,
    searchQuery,
  );
  const visibleProposals = filterRedTeamSandboxViewerProposals(model, {
    targetScopeFilter,
    actionClassFilter,
    verdictFilter,
    showDeniedExamples,
    searchQuery,
  });
  const visibleViolations = filterRedTeamSandboxViewerViolations(model, {
    severityFilter,
    showDeniedExamples,
    searchQuery,
  });
  const selectedProfile =
    selectProfile(model, controls.selectedProfileId, visibleProfiles) ??
    model.profiles[0];
  const selectedProposal =
    selectProposal(model, controls.selectedProposalId, visibleProposals) ??
    model.proposals[0];
  const selectedViolation =
    selectViolation(model, controls.selectedViolationId, visibleViolations) ??
    model.violations[0];

  return {
    selected_profile_id: selectedProfile.profile_id,
    selected_proposal_id: selectedProposal.proposal_id,
    selected_violation_id: selectedViolation.violation_id,
    target_scope_filter: targetScopeFilter,
    action_class_filter: actionClassFilter,
    verdict_filter: verdictFilter,
    severity_filter: severityFilter,
    show_denied_examples: showDeniedExamples,
    show_disabled_capabilities: showDisabledCapabilities,
    search_query: searchQuery,
    visible_profiles: visibleProfiles,
    visible_proposals: visibleProposals,
    visible_violations: visibleViolations,
    selected_profile: selectedProfile,
    selected_proposal: selectedProposal,
    selected_violation: selectedViolation,
    metadata_only: true,
    read_only: true,
  };
}

export function filterRedTeamSandboxViewerProfiles(
  model: RedTeamSandboxViewerModel,
  searchQuery: string,
): readonly RedTeamSandboxViewerProfile[] {
  const search = searchQuery.trim().toLowerCase();
  if (!search) {
    return model.profiles;
  }
  return model.profiles.filter((profile) =>
    [profile.profile_id, profile.label].some((value) =>
      value.toLowerCase().includes(search),
    ),
  );
}

export function filterRedTeamSandboxViewerProposals(
  model: RedTeamSandboxViewerModel,
  filters: {
    readonly targetScopeFilter: TargetScopeFilter;
    readonly actionClassFilter: ActionClassFilter;
    readonly verdictFilter: VerdictFilter;
    readonly showDeniedExamples: boolean;
    readonly searchQuery: string;
  },
): readonly RedTeamSandboxViewerProposalCard[] {
  const search = filters.searchQuery.trim().toLowerCase();
  return model.proposals.filter((proposal) => {
    if (
      !filters.showDeniedExamples &&
      proposal.verdict_label === "denied only"
    ) {
      return false;
    }
    if (
      filters.targetScopeFilter !== ALL_FILTER &&
      proposal.target_scope_label !== filters.targetScopeFilter
    ) {
      return false;
    }
    if (
      filters.actionClassFilter !== ALL_FILTER &&
      proposal.action_class_label !== filters.actionClassFilter
    ) {
      return false;
    }
    if (
      filters.verdictFilter !== ALL_FILTER &&
      proposal.verdict_label !== filters.verdictFilter
    ) {
      return false;
    }
    if (!search) {
      return true;
    }
    return [
      proposal.proposal_id,
      proposal.label,
      proposal.target_scope_label,
      proposal.action_class_label,
      proposal.verdict_label,
    ].some((value) => value.toLowerCase().includes(search));
  });
}

export function filterRedTeamSandboxViewerViolations(
  model: RedTeamSandboxViewerModel,
  filters: {
    readonly severityFilter: SeverityFilter;
    readonly showDeniedExamples: boolean;
    readonly searchQuery: string;
  },
): readonly RedTeamSandboxViewerViolation[] {
  const search = filters.searchQuery.trim().toLowerCase();
  return model.violations.filter((violation) => {
    if (!filters.showDeniedExamples) {
      return false;
    }
    if (
      filters.severityFilter !== ALL_FILTER &&
      violation.severity !== filters.severityFilter
    ) {
      return false;
    }
    if (!search) {
      return true;
    }
    return [
      violation.violation_id,
      violation.proposal_id,
      violation.proposal_label,
      violation.kind_label,
      violation.path,
      violation.field_name,
      violation.severity,
    ].some((value) => value.toLowerCase().includes(search));
  });
}

export function RedTeamSandboxViewer() {
  const model = useMemo(() => buildRedTeamSandboxViewerModel(), []);
  const [selectedProfileId, setSelectedProfileId] = useState(
    model.profiles[0].profile_id,
  );
  const [selectedProposalId, setSelectedProposalId] = useState(
    model.proposals[0].proposal_id,
  );
  const [selectedViolationId, setSelectedViolationId] = useState(
    model.violations[0].violation_id,
  );
  const [targetScopeFilter, setTargetScopeFilter] =
    useState<TargetScopeFilter>(ALL_FILTER);
  const [actionClassFilter, setActionClassFilter] =
    useState<ActionClassFilter>(ALL_FILTER);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>(ALL_FILTER);
  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>(ALL_FILTER);
  const [showDeniedExamples, setShowDeniedExamples] = useState(true);
  const [showDisabledCapabilities, setShowDisabledCapabilities] =
    useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const state = useMemo(
    () =>
      buildRedTeamSandboxViewerState(model, {
        selectedProfileId,
        selectedProposalId,
        selectedViolationId,
        targetScopeFilter,
        actionClassFilter,
        verdictFilter,
        severityFilter,
        showDeniedExamples,
        showDisabledCapabilities,
        searchQuery,
      }),
    [
      actionClassFilter,
      model,
      searchQuery,
      selectedProfileId,
      selectedProposalId,
      selectedViolationId,
      severityFilter,
      showDeniedExamples,
      showDisabledCapabilities,
      targetScopeFilter,
      verdictFilter,
    ],
  );

  return (
    <main
      data-red-team-sandbox-viewer="read-only"
      data-metadata-only={String(model.metadata_only)}
      data-read-only={String(model.read_only)}
      data-projection-safety-checked={String(model.projection_safety_checked)}
      className="min-h-screen bg-[#050608] px-6 py-8 text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(248,113,113,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,0.035)_1px,transparent_1px)] bg-[size:82px_82px]"
      />
      <div className="relative mx-auto grid max-w-7xl gap-6">
        <header className="border border-white/10 bg-white/[0.035] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.35)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-100/70">
            Phase 19D governed sandbox
          </p>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-4xl font-semibold tracking-normal text-white sm:text-5xl">
                Red-Team Sandbox
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300/75">
                Read-only contract surface for future CAI integration:
                whitelist-bound, preview-first, approval-gated, and denied by
                default outside safe scopes.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:min-w-[34rem]">
              <Stat label="Sandbox status" value="inactive" />
              <Stat label="Safety guard" value="checked" />
              <Stat
                label="Allowed scopes"
                value={model.allowed_target_scopes.length}
              />
              <Stat
                label="Denied examples"
                value={
                  model.proposals.filter(
                    (proposal) => proposal.verdict_label === "denied only",
                  ).length
                }
              />
            </dl>
          </div>
        </header>

        {state.show_disabled_capabilities ? (
          <section
            aria-label="Red-team disabled capability indicators"
            className="grid gap-3 border border-white/10 bg-slate-950/62 p-5 md:grid-cols-3 xl:grid-cols-4"
          >
            {model.disabled_capabilities.map((capability) => (
              <Capability key={capability} label={capability} />
            ))}
          </section>
        ) : null}

        <section
          aria-label="Red-team local filters"
          className="grid gap-4 border border-white/10 bg-slate-950/62 p-5"
        >
          <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto_auto_auto] xl:items-end">
            <label className="grid gap-2 text-sm text-slate-300">
              <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Search sandbox
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Profile, proposal, warning, or id"
                className="border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
                aria-label="Search red-team sandbox metadata"
              />
            </label>
            <FilterSelect
              label="Target scope"
              value={targetScopeFilter}
              options={model.target_scope_filters}
              onChange={setTargetScopeFilter}
            />
            <FilterSelect
              label="Action class"
              value={actionClassFilter}
              options={model.action_class_filters}
              onChange={setActionClassFilter}
            />
            <FilterSelect
              label="Verdict"
              value={verdictFilter}
              options={VERDICT_FILTERS}
              onChange={(value) => setVerdictFilter(value as VerdictFilter)}
            />
            <FilterSelect
              label="Severity"
              value={severityFilter}
              options={SEVERITY_FILTERS}
              onChange={(value) => setSeverityFilter(value as SeverityFilter)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterToggle
              active={showDeniedExamples}
              label="Denied Examples"
              onClick={() => setShowDeniedExamples((current) => !current)}
            />
            <FilterToggle
              active={showDisabledCapabilities}
              label="Disabled Capabilities"
              onClick={() => setShowDisabledCapabilities((current) => !current)}
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <TokenList
            title="Allowed Target Scopes"
            items={model.allowed_target_scopes}
            tone="safe"
          />
          <TokenList
            title="Forbidden Target Scopes"
            items={model.forbidden_target_scopes}
            tone="blocked"
          />
          <TokenList
            title="Allowed Action Classes"
            items={model.allowed_action_classes}
            tone="safe"
          />
          <TokenList
            title="Forbidden Action Classes"
            items={model.forbidden_action_classes}
            tone="blocked"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.72fr)]">
          <section className="grid gap-4">
            <section aria-label="Red-team sandbox profiles">
              <h2 className="mb-4 text-2xl font-semibold text-white">
                Sandbox Profiles
              </h2>
              <div className="grid gap-3">
                {state.visible_profiles.map((profile) => (
                  <ProfileCard
                    key={profile.profile_id}
                    profile={profile}
                    selected={profile.profile_id === state.selected_profile_id}
                    onSelect={() => setSelectedProfileId(profile.profile_id)}
                  />
                ))}
              </div>
            </section>

            <section aria-label="Red-team proposal summaries">
              <h2 className="mb-4 text-2xl font-semibold text-white">
                Proposal Summaries
              </h2>
              <div className="grid gap-4 lg:grid-cols-3">
                {state.visible_proposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.proposal_id}
                    card={proposal}
                    selected={
                      proposal.proposal_id === state.selected_proposal_id
                    }
                    tone={
                      proposal.verdict_label === "denied only"
                        ? "blocked"
                        : "safe"
                    }
                    onSelect={() => setSelectedProposalId(proposal.proposal_id)}
                  />
                ))}
              </div>
            </section>

            <section
              aria-label="Red-team safety warnings"
              className="border border-amber-100/15 bg-amber-300/[0.045] p-5"
            >
              <h2 className="text-xl font-semibold text-amber-50">
                Safety Violations and Warnings
              </h2>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {state.visible_violations.map((violation) => (
                  <ViolationCard
                    key={violation.violation_id}
                    violation={violation}
                    selected={
                      violation.violation_id === state.selected_violation_id
                    }
                    onSelect={() =>
                      setSelectedViolationId(violation.violation_id)
                    }
                  />
                ))}
              </div>
            </section>
          </section>

          <section className="grid gap-4 xl:sticky xl:top-6 xl:self-start">
            <ProfileDetail profile={state.selected_profile} />
            <ProposalDetail proposal={state.selected_proposal} />
            <ViolationDetail violation={state.selected_violation} />
          </section>
        </section>
      </div>
    </main>
  );
}

function proposalCard(
  label: string,
  proposal: RedTeamRunProposal,
): RedTeamSandboxViewerProposalCard {
  const summary = summarizeRedTeamRunProposal(proposal);
  const planSummary = summarizeRedTeamRunPlan(buildRedTeamRunPlan(proposal));
  const auditPreview = buildRedTeamAuditPreview(proposal);
  if (!summary || !planSummary) {
    throw new Error(
      `Missing red-team sandbox summary for ${proposal.proposal_id}`,
    );
  }

  return {
    proposal_id: proposal.proposal_id,
    label,
    target_scope_label: labelForScope(summary.target_scope),
    action_class_label: labelForActionClass(summary.action_class),
    verdict_label:
      summary.verdict === "allowed_metadata_only"
        ? "allowed metadata only"
        : "denied only",
    violation_count: auditPreview.violation_reason_codes.length,
    preview_required: summary.dry_run_required && planSummary.dry_run_first,
    approval_metadata_present: summary.approval_metadata_present,
    audit_preview_summary: {
      audit_preview_id: auditPreview.audit_preview_id,
      verdict_label:
        auditPreview.verdict === "allowed_metadata_only"
          ? "allowed metadata only"
          : "denied only",
      approval_required: true,
      preview_first_required: true,
      raw_payload_included: false,
      shell_commands_included: false,
      secrets_included: false,
      metadata_only: true,
      read_only: true,
    },
    violations: listRedTeamSandboxViolationsForProposal(proposal).map(
      (violation) => viewerViolation(label, proposal.proposal_id, violation),
    ),
    metadata_only: true,
    read_only: true,
  };
}

function viewerViolation(
  proposalLabel: string,
  proposalId: string,
  violation: RedTeamSandboxViolation,
): RedTeamSandboxViewerViolation {
  return {
    violation_id: `${proposalId}:${violation.violation_id}`,
    proposal_id: proposalId,
    proposal_label: proposalLabel,
    kind_label: violation.reason_code.replaceAll("_", " "),
    path: violation.path,
    field_name: violation.field_name ?? "metadata",
    severity: violation.severity,
    redacted_sample: violation.redacted_sample,
    sample_class: "metadata",
    recommendation: recommendationForViolation(violation.reason_code),
    denied_only: true,
    metadata_only: true,
    read_only: true,
  };
}

function recommendationForViolation(reasonCode: string): string {
  if (reasonCode === "forbidden_target_scope") {
    return "Keep the target inside localhost, repo-static, or synthetic fixture metadata.";
  }
  if (reasonCode === "forbidden_action_class") {
    return "Keep action classes in read-only reconnaissance, static analysis, configuration review, dependency inventory, or synthetic simulation.";
  }
  if (reasonCode === "missing_approval_metadata") {
    return "Attach Phase 18 approval metadata before any future sandbox integration can proceed.";
  }
  return "Keep this item as denied-only sandbox metadata.";
}

function labelForScope(value: string): string {
  return SCOPE_LABELS[value] ?? value.replaceAll("_", " ");
}

function labelForActionClass(value: string): string {
  return ACTION_LABELS[value] ?? value.replaceAll("_", " ");
}

function selectProfile(
  model: RedTeamSandboxViewerModel,
  profileId: string | undefined,
  visibleProfiles: readonly RedTeamSandboxViewerProfile[],
): RedTeamSandboxViewerProfile | null {
  if (profileId) {
    const visibleMatch = visibleProfiles.find(
      (profile) => profile.profile_id === profileId,
    );
    if (visibleMatch) return visibleMatch;
  }
  return visibleProfiles[0] ?? model.profiles[0] ?? null;
}

function selectProposal(
  model: RedTeamSandboxViewerModel,
  proposalId: string | undefined,
  visibleProposals: readonly RedTeamSandboxViewerProposalCard[],
): RedTeamSandboxViewerProposalCard | null {
  if (proposalId) {
    const visibleMatch = visibleProposals.find(
      (proposal) => proposal.proposal_id === proposalId,
    );
    if (visibleMatch) return visibleMatch;
  }
  return visibleProposals[0] ?? model.proposals[0] ?? null;
}

function selectViolation(
  model: RedTeamSandboxViewerModel,
  violationId: string | undefined,
  visibleViolations: readonly RedTeamSandboxViewerViolation[],
): RedTeamSandboxViewerViolation | null {
  if (violationId) {
    const visibleMatch = visibleViolations.find(
      (violation) => violation.violation_id === violationId,
    );
    if (visibleMatch) return visibleMatch;
  }
  return visibleViolations[0] ?? model.violations[0] ?? null;
}

function Stat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-slate-100">{value}</dd>
    </div>
  );
}

function Capability({ label }: { readonly label: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-100">off</dd>
    </div>
  );
}

function TokenList({
  title,
  items,
  tone,
}: {
  readonly title: string;
  readonly items: readonly string[];
  readonly tone: "safe" | "blocked";
}) {
  return (
    <section className="border border-white/10 bg-slate-950/62 p-5">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <ul className="mt-4 grid gap-2">
        {items.map((item) => (
          <li
            key={item}
            className={`border px-3 py-2 text-sm ${
              tone === "safe"
                ? "border-emerald-100/15 bg-emerald-300/[0.045] text-emerald-50/85"
                : "border-rose-100/15 bg-rose-300/[0.045] text-rose-50/85"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProfileCard({
  profile,
  selected,
  onSelect,
}: {
  readonly profile: RedTeamSandboxViewerProfile;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <article
      className={`border p-5 ${
        selected
          ? "border-cyan-200/50 bg-cyan-300/[0.055]"
          : "border-white/10 bg-slate-950/62"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-cyan-100/60">
        {profile.profile_id}
      </p>
      <h3 className="mt-2 text-xl font-semibold text-white">{profile.label}</h3>
      <dl className="mt-4 grid gap-2 text-sm md:grid-cols-3">
        <Detail
          label="Allowed scopes"
          value={String(profile.allowed_scope_count)}
        />
        <Detail
          label="Denied scopes"
          value={String(profile.forbidden_scope_count)}
        />
        <Detail
          label="Allowed classes"
          value={String(profile.allowed_action_count)}
        />
      </dl>
      <button
        type="button"
        onClick={onSelect}
        className="mt-4 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 hover:bg-white/[0.07]"
      >
        Inspect profile
      </button>
    </article>
  );
}

function ProposalCard({
  card,
  tone,
  selected,
  onSelect,
}: {
  readonly card: RedTeamSandboxViewerProposalCard;
  readonly tone: "safe" | "blocked";
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <article
      className={`border p-5 ${
        selected
          ? "border-cyan-200/50 bg-cyan-300/[0.055]"
          : tone === "safe"
            ? "border-emerald-100/15 bg-emerald-300/[0.045]"
            : "border-rose-100/15 bg-rose-300/[0.045]"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
        {card.proposal_id}
      </p>
      <h3 className="mt-2 text-xl font-semibold text-white">{card.label}</h3>
      <dl className="mt-4 grid gap-2 text-sm">
        <Detail label="Target scope" value={card.target_scope_label} />
        <Detail label="Action class" value={card.action_class_label} />
        <Detail label="Verdict" value={card.verdict_label} />
        <Detail
          label="Preview first"
          value={card.preview_required ? "required" : "blocked"}
        />
        <Detail
          label="Approval metadata"
          value={card.approval_metadata_present ? "present" : "missing"}
        />
        <Detail label="Warnings" value={String(card.violation_count)} />
      </dl>
      <button
        type="button"
        onClick={onSelect}
        className="mt-4 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 hover:bg-white/[0.07]"
      >
        Inspect proposal
      </button>
    </article>
  );
}

function ViolationCard({
  violation,
  selected,
  onSelect,
}: {
  readonly violation: RedTeamSandboxViewerViolation;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <article
      className={`border p-4 ${
        selected
          ? "border-cyan-200/50 bg-cyan-300/[0.055]"
          : "border-amber-100/15 bg-black/20"
      }`}
    >
      <h3 className="text-lg font-semibold text-amber-50">
        {violation.proposal_label}
      </h3>
      <p className="mt-2 text-sm text-amber-50/85">
        {violation.kind_label}
        <span className="ml-2 text-xs uppercase tracking-[0.14em] text-amber-100/55">
          denied only
        </span>
      </p>
      <button
        type="button"
        onClick={onSelect}
        className="mt-4 border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 hover:bg-white/[0.07]"
      >
        Inspect warning
      </button>
    </article>
  );
}

function ProfileDetail({
  profile,
}: {
  readonly profile: RedTeamSandboxViewerProfile;
}) {
  return (
    <aside
      data-red-team-profile-detail="read-only"
      className="border border-white/10 bg-slate-950/72 p-5"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">
        Profile Inspection
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        {profile.label}
      </h2>
      <dl className="mt-4 grid gap-2 text-sm">
        <Detail label="Profile id" value={profile.profile_id} />
        <Detail
          label="Allowed scopes"
          value={profile.allowed_scopes.join(", ")}
        />
        <Detail
          label="Forbidden scopes"
          value={profile.forbidden_scopes.join(", ")}
        />
        <Detail
          label="Allowed action classes"
          value={profile.allowed_action_classes.join(", ")}
        />
        <Detail
          label="Forbidden action classes"
          value={profile.forbidden_action_classes.join(", ")}
        />
        <Detail
          label="Phase 18 metadata"
          value={profile.authorization_summary.phase_18_approval_metadata}
        />
        <Detail
          label="Preview first"
          value={profile.authorization_summary.preview_first}
        />
        <Detail
          label="Target whitelist"
          value={profile.authorization_summary.target_whitelist}
        />
        <Detail
          label="Authority grant"
          value={profile.authorization_summary.authority_grant}
        />
        <Detail
          label="Disabled capabilities"
          value={profile.disabled_capabilities.join(", ")}
        />
      </dl>
    </aside>
  );
}

function ProposalDetail({
  proposal,
}: {
  readonly proposal: RedTeamSandboxViewerProposalCard;
}) {
  return (
    <aside
      data-red-team-proposal-detail="read-only"
      className="border border-white/10 bg-slate-950/72 p-5"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">
        Proposal Inspection
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        {proposal.label}
      </h2>
      <dl className="mt-4 grid gap-2 text-sm">
        <Detail label="Proposal id" value={proposal.proposal_id} />
        <Detail label="Target scope" value={proposal.target_scope_label} />
        <Detail label="Action class" value={proposal.action_class_label} />
        <Detail
          label="Approval metadata state"
          value={proposal.approval_metadata_present ? "present" : "missing"}
        />
        <Detail
          label="Preview state"
          value={proposal.preview_required ? "required" : "blocked"}
        />
        <Detail label="Verdict" value={proposal.verdict_label} />
        <Detail
          label="Audit preview"
          value={proposal.audit_preview_summary.audit_preview_id}
        />
        <Detail
          label="Payload material"
          value={String(proposal.audit_preview_summary.raw_payload_included)}
        />
        <Detail
          label="Warning count"
          value={String(proposal.violation_count)}
        />
      </dl>
    </aside>
  );
}

function ViolationDetail({
  violation,
}: {
  readonly violation: RedTeamSandboxViewerViolation;
}) {
  return (
    <aside
      data-red-team-violation-detail="read-only"
      className="border border-white/10 bg-slate-950/72 p-5"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/60">
        Warning Inspection
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        {violation.kind_label}
      </h2>
      <dl className="mt-4 grid gap-2 text-sm">
        <Detail label="Violation kind" value={violation.kind_label} />
        <Detail label="Path" value={violation.path} />
        <Detail label="Field name" value={violation.field_name} />
        <Detail label="Severity" value={violation.severity} />
        <Detail label="Redacted sample" value={violation.redacted_sample} />
        <Detail label="Sample class" value={violation.sample_class} />
        <Detail label="Recommendation" value={violation.recommendation} />
      </dl>
    </aside>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      <span className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none"
        aria-label={`Filter by ${label.toLowerCase()}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterToggle({
  active,
  label,
  onClick,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
        active
          ? "border-cyan-200/40 bg-cyan-300/[0.075] text-cyan-50"
          : "border-white/10 bg-white/[0.03] text-slate-400"
      }`}
    >
      {active ? "Show" : "Hide"} {label}
    </button>
  );
}

function Detail({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="border border-white/10 bg-white/[0.03] px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-slate-200">{value}</dd>
    </div>
  );
}
