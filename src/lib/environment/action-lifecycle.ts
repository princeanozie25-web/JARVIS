import { z } from "zod";
import { EnvironmentActionIntentSourceSurfaceSchema } from "./action-intent";
import {
  EnvironmentDryRunActionPlanSchema,
  type EnvironmentDryRunActionPlan,
} from "./action-planner";
import { EnvironmentIdSchema } from "./types";

export const ENVIRONMENT_ACTION_LIFECYCLE_STATES = [
  "proposed",
  "denied",
  "requires_approval",
  "approved",
  "expired",
  "cancelled",
] as const;

export const ENVIRONMENT_ACTION_APPROVAL_SURFACES = [
  "chat",
  "api",
  "test",
] as const;

export const ENVIRONMENT_ACTION_LIFECYCLE_TRANSITION_REASONS = [
  "proposal_created",
  "policy_denied",
  "restricted_requires_approval",
  "metadata_approved",
  "proposal_expired",
  "proposal_cancelled",
  "voice_approval_not_allowed",
  "denied_proposal_not_approvable",
  "expired_proposal_not_approvable",
  "cancelled_proposal_not_approvable",
  "already_approved",
] as const;

export type EnvironmentActionLifecycleState =
  (typeof ENVIRONMENT_ACTION_LIFECYCLE_STATES)[number];
export type EnvironmentActionApprovalSurface =
  (typeof ENVIRONMENT_ACTION_APPROVAL_SURFACES)[number];
export type EnvironmentActionLifecycleTransitionReason =
  (typeof ENVIRONMENT_ACTION_LIFECYCLE_TRANSITION_REASONS)[number];

export const EnvironmentActionLifecycleStateSchema = z.enum(
  ENVIRONMENT_ACTION_LIFECYCLE_STATES,
);
export const EnvironmentActionApprovalSurfaceSchema = z.enum(
  ENVIRONMENT_ACTION_APPROVAL_SURFACES,
);
export const EnvironmentActionLifecycleTransitionReasonSchema = z.enum(
  ENVIRONMENT_ACTION_LIFECYCLE_TRANSITION_REASONS,
);

export const EnvironmentActionApprovalMetadataSchema = z.strictObject({
  approvalRequired: z.boolean(),
  approvalId: EnvironmentIdSchema.nullable(),
  approvalSurface: EnvironmentActionApprovalSurfaceSchema.nullable(),
  approvedByActorId: EnvironmentIdSchema.nullable(),
  approvedAt: z.number().int().nonnegative().nullable(),
  expiresAt: z.number().int().nonnegative().nullable(),
  sessionApprovalAllowed: z.literal(false),
  metadataOnly: z.literal(true),
});

export const EnvironmentActionLifecycleProposalSchema = z.strictObject({
  kind: z.literal("environment.action.lifecycle_proposal"),
  id: EnvironmentIdSchema,
  plan: EnvironmentDryRunActionPlanSchema,
  sourceSurface: EnvironmentActionIntentSourceSurfaceSchema,
  state: EnvironmentActionLifecycleStateSchema,
  reason: EnvironmentActionLifecycleTransitionReasonSchema,
  createdAt: z.number().int().nonnegative(),
  stateChangedAt: z.number().int().nonnegative(),
  cancelledAt: z.number().int().nonnegative().nullable(),
  deniedAt: z.number().int().nonnegative().nullable(),
  expiredAt: z.number().int().nonnegative().nullable(),
  approval: EnvironmentActionApprovalMetadataSchema,
  approvalLifecycleOnly: z.literal(true),
  executed: z.literal(false),
  verified: z.literal(false),
  commandsIssued: z.literal(0),
  physicalSideEffects: z.literal(false),
  metadataOnly: z.literal(true),
  canonical: z.literal(false),
  authoritative: z.literal(false),
});

export type EnvironmentActionApprovalMetadata = z.infer<
  typeof EnvironmentActionApprovalMetadataSchema
>;
export type EnvironmentActionLifecycleProposal = z.infer<
  typeof EnvironmentActionLifecycleProposalSchema
>;

export type EnvironmentActionLifecycleTransitionResult =
  | {
      ok: true;
      proposal: EnvironmentActionLifecycleProposal;
      reason: EnvironmentActionLifecycleTransitionReason;
    }
  | {
      ok: false;
      proposal: EnvironmentActionLifecycleProposal;
      reason: EnvironmentActionLifecycleTransitionReason;
      executed: false;
      verified: false;
      commandsIssued: 0;
      physicalSideEffects: false;
    };

export interface CreateEnvironmentActionLifecycleProposalInput {
  id: string;
  plan: EnvironmentDryRunActionPlan;
  nowMs: number;
  expiresAt?: number | null;
}

export interface ApproveEnvironmentActionLifecycleProposalInput {
  proposal: EnvironmentActionLifecycleProposal;
  approvedAt: number;
  approvalId: string;
  approvedByActorId?: string | null;
  approvalSurface: EnvironmentActionApprovalSurface;
}

export interface ExpireEnvironmentActionLifecycleProposalInput {
  proposal: EnvironmentActionLifecycleProposal;
  nowMs: number;
}

export interface CancelEnvironmentActionLifecycleProposalInput {
  proposal: EnvironmentActionLifecycleProposal;
  cancelledAt: number;
}

function noExecutionFailure(input: {
  proposal: EnvironmentActionLifecycleProposal;
  reason: EnvironmentActionLifecycleTransitionReason;
}): EnvironmentActionLifecycleTransitionResult {
  return {
    ok: false,
    proposal: input.proposal,
    reason: input.reason,
    executed: false,
    verified: false,
    commandsIssued: 0,
    physicalSideEffects: false,
  };
}

function initialState(plan: EnvironmentDryRunActionPlan): {
  state: EnvironmentActionLifecycleState;
  reason: EnvironmentActionLifecycleTransitionReason;
  deniedAt: number | null;
} {
  if (plan.planDecision === "denied") {
    return {
      state: "denied",
      reason: "policy_denied",
      deniedAt: 0,
    };
  }
  if (plan.planDecision === "requires_approval") {
    return {
      state: "requires_approval",
      reason: "restricted_requires_approval",
      deniedAt: null,
    };
  }
  return {
    state: "proposed",
    reason: "proposal_created",
    deniedAt: null,
  };
}

function withNoExecutionMarkers(
  proposal: Omit<
    EnvironmentActionLifecycleProposal,
    | "approvalLifecycleOnly"
    | "executed"
    | "verified"
    | "commandsIssued"
    | "physicalSideEffects"
    | "metadataOnly"
    | "canonical"
    | "authoritative"
  >,
): EnvironmentActionLifecycleProposal {
  return EnvironmentActionLifecycleProposalSchema.parse({
    ...proposal,
    approvalLifecycleOnly: true,
    executed: false,
    verified: false,
    commandsIssued: 0,
    physicalSideEffects: false,
    metadataOnly: true,
    canonical: false,
    authoritative: false,
  });
}

function transitionProposal(
  proposal: EnvironmentActionLifecycleProposal,
  changes: Partial<EnvironmentActionLifecycleProposal>,
): EnvironmentActionLifecycleProposal {
  return withNoExecutionMarkers({
    ...proposal,
    ...changes,
  });
}

function isExpired(
  proposal: EnvironmentActionLifecycleProposal,
  nowMs: number,
): boolean {
  return (
    proposal.approval.expiresAt !== null && nowMs >= proposal.approval.expiresAt
  );
}

export function createEnvironmentActionLifecycleProposal(
  input: CreateEnvironmentActionLifecycleProposalInput,
): EnvironmentActionLifecycleProposal {
  const plan = EnvironmentDryRunActionPlanSchema.parse(input.plan);
  const state = initialState(plan);

  return withNoExecutionMarkers({
    kind: "environment.action.lifecycle_proposal",
    id: input.id,
    plan,
    sourceSurface: plan.sourceSurface,
    state: state.state,
    reason: state.reason,
    createdAt: input.nowMs,
    stateChangedAt: input.nowMs,
    cancelledAt: null,
    deniedAt: state.deniedAt === 0 ? input.nowMs : null,
    expiredAt: null,
    approval: {
      approvalRequired: plan.approvalRequired,
      approvalId: null,
      approvalSurface: null,
      approvedByActorId: null,
      approvedAt: null,
      expiresAt: input.expiresAt ?? null,
      sessionApprovalAllowed: false,
      metadataOnly: true,
    },
  });
}

export function approveEnvironmentActionLifecycleProposal(
  input: ApproveEnvironmentActionLifecycleProposalInput,
): EnvironmentActionLifecycleTransitionResult {
  const proposal = EnvironmentActionLifecycleProposalSchema.parse(
    input.proposal,
  );

  if (proposal.sourceSurface === "voice") {
    return noExecutionFailure({
      proposal,
      reason: "voice_approval_not_allowed",
    });
  }
  if (proposal.state === "denied") {
    return noExecutionFailure({
      proposal,
      reason: "denied_proposal_not_approvable",
    });
  }
  if (proposal.state === "cancelled") {
    return noExecutionFailure({
      proposal,
      reason: "cancelled_proposal_not_approvable",
    });
  }
  if (proposal.state === "expired" || isExpired(proposal, input.approvedAt)) {
    return noExecutionFailure({
      proposal: expireEnvironmentActionLifecycleProposal({
        proposal,
        nowMs: input.approvedAt,
      }).proposal,
      reason: "expired_proposal_not_approvable",
    });
  }
  if (proposal.state === "approved") {
    return noExecutionFailure({
      proposal,
      reason: "already_approved",
    });
  }

  const approved = transitionProposal(proposal, {
    state: "approved",
    reason: "metadata_approved",
    stateChangedAt: input.approvedAt,
    approval: {
      ...proposal.approval,
      approvalId: input.approvalId,
      approvalSurface: input.approvalSurface,
      approvedByActorId: input.approvedByActorId ?? null,
      approvedAt: input.approvedAt,
      sessionApprovalAllowed: false,
      metadataOnly: true,
    },
  });

  return {
    ok: true,
    proposal: approved,
    reason: "metadata_approved",
  };
}

export function expireEnvironmentActionLifecycleProposal(
  input: ExpireEnvironmentActionLifecycleProposalInput,
): EnvironmentActionLifecycleTransitionResult {
  const proposal = EnvironmentActionLifecycleProposalSchema.parse(
    input.proposal,
  );

  if (
    proposal.state === "denied" ||
    proposal.state === "cancelled" ||
    proposal.state === "approved"
  ) {
    return noExecutionFailure({
      proposal,
      reason:
        proposal.state === "cancelled"
          ? "cancelled_proposal_not_approvable"
          : proposal.state === "denied"
            ? "denied_proposal_not_approvable"
            : "already_approved",
    });
  }

  const expired = transitionProposal(proposal, {
    state: "expired",
    reason: "proposal_expired",
    stateChangedAt: input.nowMs,
    expiredAt: input.nowMs,
  });

  return {
    ok: true,
    proposal: expired,
    reason: "proposal_expired",
  };
}

export function cancelEnvironmentActionLifecycleProposal(
  input: CancelEnvironmentActionLifecycleProposalInput,
): EnvironmentActionLifecycleTransitionResult {
  const proposal = EnvironmentActionLifecycleProposalSchema.parse(
    input.proposal,
  );

  if (proposal.state === "expired") {
    return noExecutionFailure({
      proposal,
      reason: "expired_proposal_not_approvable",
    });
  }
  if (proposal.state === "approved") {
    return noExecutionFailure({
      proposal,
      reason: "already_approved",
    });
  }

  const cancelled = transitionProposal(proposal, {
    state: "cancelled",
    reason: "proposal_cancelled",
    stateChangedAt: input.cancelledAt,
    cancelledAt: input.cancelledAt,
  });

  return {
    ok: true,
    proposal: cancelled,
    reason: "proposal_cancelled",
  };
}
