import { z } from "zod";

import {
  RED_TEAM_FORBIDDEN_ACTION_CLASSES,
  RED_TEAM_FORBIDDEN_TARGET_SCOPES,
  RED_TEAM_SUPPORTED_ACTION_CLASSES,
  RED_TEAM_SUPPORTED_TARGET_SCOPES,
  RedTeamActionClassSchema,
  RedTeamAuthorizationPolicySchema,
  RedTeamRunPlanSchema,
  RedTeamRunProposalSchema,
  RedTeamSandboxProfileSchema,
  RedTeamSandboxVerdictSchema,
  RedTeamSandboxViolationSchema,
  RedTeamTargetScopeSchema,
  buildRedTeamRunPlan,
  getRedTeamAuthorizationPolicy,
  getRedTeamSandboxProfile,
  validateRedTeamRunPlan,
  validateRedTeamRunProposal,
  type RedTeamActionClass,
  type RedTeamAuthorizationPolicy,
  type RedTeamRunProposal,
  type RedTeamSandboxProfile,
  type RedTeamSandboxViolation,
  type RedTeamTargetScope,
} from "./contracts";

export const RedTeamRunProposalSummarySchema = z.strictObject({
  proposal_id: z
    .string()
    .trim()
    .regex(/^red-team-proposal:/),
  target_scope: RedTeamTargetScopeSchema,
  action_class: RedTeamActionClassSchema,
  verdict: RedTeamSandboxVerdictSchema,
  violation_count: z.number().int().nonnegative(),
  approval_required: z.literal(true),
  approval_metadata_present: z.boolean(),
  dry_run_required: z.boolean(),
  execution_inferred: z.literal(false),
  permission_inferred: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const RedTeamRunPlanSummarySchema = z.strictObject({
  plan_id: z
    .string()
    .trim()
    .regex(/^red-team-plan:/),
  proposal_id: z
    .string()
    .trim()
    .regex(/^red-team-proposal:/),
  target_scope: RedTeamTargetScopeSchema,
  action_class: RedTeamActionClassSchema,
  verdict: RedTeamSandboxVerdictSchema,
  violation_count: z.number().int().nonnegative(),
  dry_run_first: z.boolean(),
  execution_enabled: z.literal(false),
  command_execution_enabled: z.literal(false),
  network_scan_enabled: z.literal(false),
  execution_inferred: z.literal(false),
  permission_inferred: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const RedTeamAuthorizationSummarySchema = z.strictObject({
  policy_id: z
    .string()
    .trim()
    .regex(/^red-team-policy:/),
  requires_phase_18_approval_metadata: z.literal(true),
  dry_run_first_required: z.literal(true),
  per_action_class_authorization_required: z.literal(true),
  target_whitelist_required: z.literal(true),
  external_targets_allowed: z.literal(false),
  approval_bypass_allowed: z.literal(false),
  authority_grant_allowed: z.literal(false),
  execution_inferred: z.literal(false),
  permission_inferred: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export type RedTeamRunProposalSummary = z.infer<
  typeof RedTeamRunProposalSummarySchema
>;
export type RedTeamRunPlanSummary = z.infer<typeof RedTeamRunPlanSummarySchema>;
export type RedTeamAuthorizationSummary = z.infer<
  typeof RedTeamAuthorizationSummarySchema
>;

function copyProfile(profile: RedTeamSandboxProfile): RedTeamSandboxProfile {
  return RedTeamSandboxProfileSchema.parse(JSON.parse(JSON.stringify(profile)));
}

function copyViolation(
  violation: RedTeamSandboxViolation,
): RedTeamSandboxViolation {
  return RedTeamSandboxViolationSchema.parse(
    JSON.parse(JSON.stringify(violation)),
  );
}

export function listRedTeamAllowedTargetScopes(): readonly RedTeamTargetScope[] {
  return [...RED_TEAM_SUPPORTED_TARGET_SCOPES];
}

export function listRedTeamForbiddenTargetScopes(): readonly RedTeamTargetScope[] {
  return [...RED_TEAM_FORBIDDEN_TARGET_SCOPES];
}

export function listRedTeamAllowedActionClasses(): readonly RedTeamActionClass[] {
  return [...RED_TEAM_SUPPORTED_ACTION_CLASSES];
}

export function listRedTeamForbiddenActionClasses(): readonly RedTeamActionClass[] {
  return [...RED_TEAM_FORBIDDEN_ACTION_CLASSES];
}

export function listRedTeamSandboxProfiles(): readonly RedTeamSandboxProfile[] {
  return [copyProfile(getRedTeamSandboxProfile())];
}

export function getRedTeamSandboxProfileById(
  id: string,
): RedTeamSandboxProfile | null {
  return (
    listRedTeamSandboxProfiles().find((profile) => profile.profile_id === id) ??
    null
  );
}

export function listRedTeamSandboxViolationsForProposal(
  proposal: unknown,
): readonly RedTeamSandboxViolation[] {
  return validateRedTeamRunProposal(proposal).violations.map(copyViolation);
}

export function summarizeRedTeamRunProposal(
  proposal: unknown,
): RedTeamRunProposalSummary | null {
  const parsed = RedTeamRunProposalSchema.safeParse(proposal);
  if (!parsed.success) {
    return null;
  }

  const validation = validateRedTeamRunProposal(parsed.data);
  return RedTeamRunProposalSummarySchema.parse({
    proposal_id: parsed.data.proposal_id,
    target_scope: parsed.data.target.scope,
    action_class: parsed.data.action_class,
    verdict: validation.verdict,
    violation_count: validation.violation_count,
    approval_required: true,
    approval_metadata_present: Boolean(parsed.data.approval_metadata),
    dry_run_required: parsed.data.dry_run_required,
    execution_inferred: false,
    permission_inferred: false,
    metadata_only: true,
    read_only: true,
  });
}

export function summarizeRedTeamRunPlan(
  plan: unknown,
): RedTeamRunPlanSummary | null {
  const parsed = RedTeamRunPlanSchema.safeParse(plan);
  if (!parsed.success) {
    return null;
  }

  const validation = validateRedTeamRunPlan(parsed.data);
  return RedTeamRunPlanSummarySchema.parse({
    plan_id: parsed.data.plan_id,
    proposal_id: parsed.data.proposal_id,
    target_scope: parsed.data.target_scope,
    action_class: parsed.data.action_class,
    verdict: validation.verdict,
    violation_count: validation.violation_count,
    dry_run_first: parsed.data.dry_run_first,
    execution_enabled: false,
    command_execution_enabled: false,
    network_scan_enabled: false,
    execution_inferred: false,
    permission_inferred: false,
    metadata_only: true,
    read_only: true,
  });
}

export function buildRedTeamAuthorizationSummary(
  policy: RedTeamAuthorizationPolicy = getRedTeamAuthorizationPolicy(),
): RedTeamAuthorizationSummary {
  const parsed = RedTeamAuthorizationPolicySchema.parse(policy);
  return RedTeamAuthorizationSummarySchema.parse({
    policy_id: parsed.policy_id,
    requires_phase_18_approval_metadata:
      parsed.requires_phase_18_approval_metadata,
    dry_run_first_required: parsed.dry_run_first_required,
    per_action_class_authorization_required:
      parsed.per_action_class_authorization_required,
    target_whitelist_required: parsed.target_whitelist_required,
    external_targets_allowed: false,
    approval_bypass_allowed: false,
    authority_grant_allowed: false,
    execution_inferred: false,
    permission_inferred: false,
    metadata_only: true,
    read_only: true,
  });
}

export function buildRedTeamPlanSummaryForProposal(
  proposal: RedTeamRunProposal,
): RedTeamRunPlanSummary {
  const plan = buildRedTeamRunPlan(proposal);
  const summary = summarizeRedTeamRunPlan(plan);
  if (!summary) {
    throw new Error("Red-team run plan summary could not be built");
  }
  return summary;
}
