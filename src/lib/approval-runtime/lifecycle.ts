import { z } from "zod";

import {
  APPROVAL_LIFECYCLE_STAGES,
  ApprovalLifecycleStageSchema,
  type ApprovalLifecycleStage,
} from "./types";

export const APPROVAL_ALLOWED_TRANSITIONS = {
  PROPOSED: ["REVIEW_PENDING"],
  REVIEW_PENDING: ["APPROVED", "DENIED", "EXPIRED"],
  APPROVED: ["EXECUTION_PENDING", "EXPIRED"],
  DENIED: [],
  EXPIRED: [],
  EXECUTION_PENDING: ["EXECUTED", "FAILED"],
  EXECUTED: ["VERIFICATION_PENDING", "FAILED"],
  VERIFICATION_PENDING: ["VERIFIED", "FAILED"],
  VERIFIED: [],
  FAILED: ["COMPENSATION_AVAILABLE"],
  COMPENSATION_AVAILABLE: [],
} as const satisfies Record<
  ApprovalLifecycleStage,
  readonly ApprovalLifecycleStage[]
>;

export const APPROVAL_TERMINAL_STAGES = [
  "DENIED",
  "EXPIRED",
  "VERIFIED",
] as const satisfies readonly ApprovalLifecycleStage[];

export const APPROVAL_TRANSITION_VALIDATION_REASONS = [
  "allowed_transition",
  "invalid_stage",
  "invalid_transition",
] as const;

export type ApprovalTransitionValidationReason =
  (typeof APPROVAL_TRANSITION_VALIDATION_REASONS)[number];

export const ApprovalAllowedTransitionMapSchema = z.strictObject({
  PROPOSED: z.array(ApprovalLifecycleStageSchema),
  REVIEW_PENDING: z.array(ApprovalLifecycleStageSchema),
  APPROVED: z.array(ApprovalLifecycleStageSchema),
  DENIED: z.array(ApprovalLifecycleStageSchema),
  EXPIRED: z.array(ApprovalLifecycleStageSchema),
  EXECUTION_PENDING: z.array(ApprovalLifecycleStageSchema),
  EXECUTED: z.array(ApprovalLifecycleStageSchema),
  VERIFICATION_PENDING: z.array(ApprovalLifecycleStageSchema),
  VERIFIED: z.array(ApprovalLifecycleStageSchema),
  FAILED: z.array(ApprovalLifecycleStageSchema),
  COMPENSATION_AVAILABLE: z.array(ApprovalLifecycleStageSchema),
});

export const ApprovalStageTransitionDeclarationSchema = z.strictObject({
  from_stage: ApprovalLifecycleStageSchema,
  to_stage: ApprovalLifecycleStageSchema,
  transition_allowed: z.literal(true),
  declaration_only: z.literal(true),
  metadata_only: z.literal(true),
  advances_state: z.literal(false),
  executes_action: z.literal(false),
  grants_authority: z.literal(false),
});

export const ApprovalTransitionValidationSchema = z.strictObject({
  valid: z.boolean(),
  reason: z.enum(APPROVAL_TRANSITION_VALIDATION_REASONS),
  from_stage: ApprovalLifecycleStageSchema.nullable(),
  to_stage: ApprovalLifecycleStageSchema.nullable(),
  metadata_only: z.literal(true),
  declaration_only: z.literal(true),
  state_advanced: z.literal(false),
  action_executed: z.literal(false),
  authority_granted: z.literal(false),
});

export type ApprovalStageTransitionDeclaration = z.infer<
  typeof ApprovalStageTransitionDeclarationSchema
>;
export type ApprovalTransitionValidation = z.infer<
  typeof ApprovalTransitionValidationSchema
>;

export const APPROVAL_STAGE_TRANSITION_DECLARATIONS =
  APPROVAL_LIFECYCLE_STAGES.flatMap((from_stage) =>
    APPROVAL_ALLOWED_TRANSITIONS[from_stage].map((to_stage) =>
      ApprovalStageTransitionDeclarationSchema.parse({
        from_stage,
        to_stage,
        transition_allowed: true,
        declaration_only: true,
        metadata_only: true,
        advances_state: false,
        executes_action: false,
        grants_authority: false,
      }),
    ),
  );

export function isApprovalLifecycleStage(
  stage: unknown,
): stage is ApprovalLifecycleStage {
  return ApprovalLifecycleStageSchema.safeParse(stage).success;
}

export function getAllowedApprovalLifecycleTransitions(
  stage: ApprovalLifecycleStage,
): readonly ApprovalLifecycleStage[] {
  return APPROVAL_ALLOWED_TRANSITIONS[stage];
}

export function validateApprovalStageTransitionDeclaration(input: {
  readonly from_stage: unknown;
  readonly to_stage: unknown;
}): ApprovalTransitionValidation {
  const fromStage = ApprovalLifecycleStageSchema.safeParse(input.from_stage);
  const toStage = ApprovalLifecycleStageSchema.safeParse(input.to_stage);

  if (!fromStage.success || !toStage.success) {
    return ApprovalTransitionValidationSchema.parse({
      valid: false,
      reason: "invalid_stage",
      from_stage: fromStage.success ? fromStage.data : null,
      to_stage: toStage.success ? toStage.data : null,
      metadata_only: true,
      declaration_only: true,
      state_advanced: false,
      action_executed: false,
      authority_granted: false,
    });
  }

  const allowedTransitions = APPROVAL_ALLOWED_TRANSITIONS[
    fromStage.data
  ] as readonly ApprovalLifecycleStage[];
  const allowed = allowedTransitions.includes(toStage.data);

  return ApprovalTransitionValidationSchema.parse({
    valid: allowed,
    reason: allowed ? "allowed_transition" : "invalid_transition",
    from_stage: fromStage.data,
    to_stage: toStage.data,
    metadata_only: true,
    declaration_only: true,
    state_advanced: false,
    action_executed: false,
    authority_granted: false,
  });
}
