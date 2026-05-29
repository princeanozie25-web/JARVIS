import { z } from "zod";

export const SCHEDULED_ASSISTANCE_READ_SCOPE_SURFACES = [
  "approvals_metadata",
  "tool_call_metadata",
  "model_cost_metadata",
  "vision_replay_metadata",
  "environment_room_event_metadata",
  "project_ledger_metadata",
  "router_decision_metadata",
  "safety_classifier_metadata",
] as const;

export const SCHEDULED_ASSISTANCE_READ_SCOPE_DENIAL_REASONS = [
  "scope_allowed",
  "unknown_surface",
  "raw_payload_forbidden",
  "write_forbidden",
  "network_forbidden",
  "pii_forbidden",
  "secrets_forbidden",
] as const;

export type ScheduledAssistanceReadScopeSurface =
  (typeof SCHEDULED_ASSISTANCE_READ_SCOPE_SURFACES)[number];
export type ScheduledAssistanceReadScopeDenialReason =
  (typeof SCHEDULED_ASSISTANCE_READ_SCOPE_DENIAL_REASONS)[number];

const ScopeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^scope:[a-z0-9._:-]+$/);

export const ScheduledAssistanceReadScopeSurfaceSchema = z.enum(
  SCHEDULED_ASSISTANCE_READ_SCOPE_SURFACES,
);
export const ScheduledAssistanceReadScopeDenialReasonSchema = z.enum(
  SCHEDULED_ASSISTANCE_READ_SCOPE_DENIAL_REASONS,
);

export const ScheduledAssistanceReadScopeSchema = z.strictObject({
  scope_id: ScopeIdSchema,
  surface_kind: z.string().trim().min(1).max(120),
  read_only: z.boolean(),
  metadata_only: z.boolean(),
  raw_payload_allowed: z.boolean(),
  pii_allowed: z.boolean(),
  secrets_allowed: z.boolean(),
  network_allowed: z.boolean(),
  write_allowed: z.boolean(),
  row_cap: z.number().int().positive().max(1_000),
});

export const ScheduledAssistanceReadScopeDecisionSchema = z.strictObject({
  scope_id: ScopeIdSchema,
  surface_kind: z.string().trim().min(1).max(120),
  allowed: z.boolean(),
  reason: ScheduledAssistanceReadScopeDenialReasonSchema,
  read_only: z.literal(true),
  metadata_only: z.literal(true),
  raw_payload_allowed: z.literal(false),
  pii_allowed: z.literal(false),
  secrets_allowed: z.literal(false),
  network_allowed: z.literal(false),
  write_allowed: z.literal(false),
  row_cap: z.number().int().positive().max(1_000),
  collector_implemented: z.literal(false),
  db_read_performed: z.literal(false),
  event_store_read_performed: z.literal(false),
  report_generated: z.literal(false),
  suggestion_generated: z.literal(false),
  persisted: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  device_action_executed: z.literal(false),
  approval_executed: z.literal(false),
  cloud_called: z.literal(false),
});

export type ScheduledAssistanceReadScope = z.infer<
  typeof ScheduledAssistanceReadScopeSchema
>;
export type ScheduledAssistanceReadScopeDecision = z.infer<
  typeof ScheduledAssistanceReadScopeDecisionSchema
>;

function scope(
  surfaceKind: ScheduledAssistanceReadScopeSurface,
): ScheduledAssistanceReadScope {
  return ScheduledAssistanceReadScopeSchema.parse({
    scope_id: `scope:${surfaceKind}`,
    surface_kind: surfaceKind,
    read_only: true,
    metadata_only: true,
    raw_payload_allowed: false,
    pii_allowed: false,
    secrets_allowed: false,
    network_allowed: false,
    write_allowed: false,
    row_cap: 250,
  });
}

export const DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES =
  SCHEDULED_ASSISTANCE_READ_SCOPE_SURFACES.map(scope);

export function evaluateScheduledAssistanceReadScope(
  input: unknown,
): ScheduledAssistanceReadScopeDecision {
  const parsed = ScheduledAssistanceReadScopeSchema.safeParse(input);
  if (!parsed.success) {
    return decision({
      scope_id: "scope:invalid",
      surface_kind: "unknown",
      allowed: false,
      reason: "unknown_surface",
      row_cap: 1,
    });
  }

  const scopeInput = parsed.data;
  if (!isAllowedSurface(scopeInput.surface_kind)) {
    return decision({
      scope_id: scopeInput.scope_id,
      surface_kind: scopeInput.surface_kind,
      allowed: false,
      reason: "unknown_surface",
      row_cap: scopeInput.row_cap,
    });
  }
  if (!scopeInput.read_only || scopeInput.write_allowed) {
    return decision({
      scope_id: scopeInput.scope_id,
      surface_kind: scopeInput.surface_kind,
      allowed: false,
      reason: "write_forbidden",
      row_cap: scopeInput.row_cap,
    });
  }
  if (!scopeInput.metadata_only || scopeInput.raw_payload_allowed) {
    return decision({
      scope_id: scopeInput.scope_id,
      surface_kind: scopeInput.surface_kind,
      allowed: false,
      reason: "raw_payload_forbidden",
      row_cap: scopeInput.row_cap,
    });
  }
  if (scopeInput.pii_allowed) {
    return decision({
      scope_id: scopeInput.scope_id,
      surface_kind: scopeInput.surface_kind,
      allowed: false,
      reason: "pii_forbidden",
      row_cap: scopeInput.row_cap,
    });
  }
  if (scopeInput.secrets_allowed) {
    return decision({
      scope_id: scopeInput.scope_id,
      surface_kind: scopeInput.surface_kind,
      allowed: false,
      reason: "secrets_forbidden",
      row_cap: scopeInput.row_cap,
    });
  }
  if (scopeInput.network_allowed) {
    return decision({
      scope_id: scopeInput.scope_id,
      surface_kind: scopeInput.surface_kind,
      allowed: false,
      reason: "network_forbidden",
      row_cap: scopeInput.row_cap,
    });
  }

  return decision({
    scope_id: scopeInput.scope_id,
    surface_kind: scopeInput.surface_kind,
    allowed: true,
    reason: "scope_allowed",
    row_cap: scopeInput.row_cap,
  });
}

function decision(input: {
  readonly scope_id: string;
  readonly surface_kind: string;
  readonly allowed: boolean;
  readonly reason: ScheduledAssistanceReadScopeDenialReason;
  readonly row_cap: number;
}): ScheduledAssistanceReadScopeDecision {
  return ScheduledAssistanceReadScopeDecisionSchema.parse({
    scope_id: input.scope_id,
    surface_kind: input.surface_kind,
    allowed: input.allowed,
    reason: input.reason,
    read_only: true,
    metadata_only: true,
    raw_payload_allowed: false,
    pii_allowed: false,
    secrets_allowed: false,
    network_allowed: false,
    write_allowed: false,
    row_cap: input.row_cap,
    collector_implemented: false,
    db_read_performed: false,
    event_store_read_performed: false,
    report_generated: false,
    suggestion_generated: false,
    persisted: false,
    tool_called: false,
    memory_written: false,
    project_mutated: false,
    device_action_executed: false,
    approval_executed: false,
    cloud_called: false,
  });
}

function isAllowedSurface(
  surfaceKind: string,
): surfaceKind is ScheduledAssistanceReadScopeSurface {
  return SCHEDULED_ASSISTANCE_READ_SCOPE_SURFACES.includes(
    surfaceKind as ScheduledAssistanceReadScopeSurface,
  );
}
