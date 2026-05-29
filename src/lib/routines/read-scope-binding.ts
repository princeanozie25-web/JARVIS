import { z } from "zod";

import {
  DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES,
  ScheduledAssistanceReadScopeSchema,
  ScheduledAssistanceReadScopeSurfaceSchema,
  evaluateScheduledAssistanceReadScope,
  type ScheduledAssistanceReadScope,
  type ScheduledAssistanceReadScopeSurface,
} from "./read-scope";
import { ScheduledAssistanceRoutineKindSchema } from "./runtime-contract";

export const ROUTINE_READ_SCOPE_BINDING_REASONS = [
  "scope_allowed",
  "undeclared_scope",
  "unknown_surface",
  "raw_payload_forbidden",
  "write_forbidden",
  "network_forbidden",
  "pii_forbidden",
  "secrets_forbidden",
  "routine_unknown",
] as const;

export type RoutineReadScopeBindingReason =
  (typeof ROUTINE_READ_SCOPE_BINDING_REASONS)[number];

const RoutineIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/);

const ScopeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^scope:[a-z0-9._:-]+$/);

export const RoutineReadScopeBindingReasonSchema = z.enum(
  ROUTINE_READ_SCOPE_BINDING_REASONS,
);

export const RoutineReadScopeBindingRoutineSchema = z.object({
  routine_id: RoutineIdSchema,
  routine_kind: ScheduledAssistanceRoutineKindSchema,
});

export const RoutineReadScopeAllowedScopeSchema = z.strictObject({
  scope_id: ScopeIdSchema,
  surface_kind: ScheduledAssistanceReadScopeSurfaceSchema,
  row_cap: z.number().int().positive().max(1_000),
  read_only: z.literal(true),
  metadata_only: z.literal(true),
  raw_payload_allowed: z.literal(false),
  pii_allowed: z.literal(false),
  secrets_allowed: z.literal(false),
  network_allowed: z.literal(false),
  write_allowed: z.literal(false),
});

export const RoutineReadScopeDeniedScopeSchema = z.strictObject({
  scope_id: z.string().trim().min(1).max(160),
  surface_kind: z.string().trim().min(1).max(120),
  reason: RoutineReadScopeBindingReasonSchema,
  read_only: z.literal(true),
  metadata_only: z.literal(true),
  raw_payload_allowed: z.literal(false),
  pii_allowed: z.literal(false),
  secrets_allowed: z.literal(false),
  network_allowed: z.literal(false),
  write_allowed: z.literal(false),
});

export const RoutineReadScopeBindingDecisionSchema = z.strictObject({
  routine_id: RoutineIdSchema,
  routine_kind: ScheduledAssistanceRoutineKindSchema,
  binding_complete: z.boolean(),
  allowed_read_scopes: z.array(RoutineReadScopeAllowedScopeSchema),
  denied_read_scopes: z.array(RoutineReadScopeDeniedScopeSchema),
  metadata_only: z.literal(true),
  collector_execution_supported: z.literal(false),
  collector_execution_attempted: z.literal(false),
  db_read_supported: z.literal(false),
  db_read_performed: z.literal(false),
  event_store_read_supported: z.literal(false),
  event_store_read_performed: z.literal(false),
  report_generation_supported: z.literal(false),
  report_generated: z.literal(false),
  suggestion_generation_supported: z.literal(false),
  suggestion_generated: z.literal(false),
  persistence_supported: z.literal(false),
  persisted: z.literal(false),
  network_called: z.literal(false),
  cloud_called: z.literal(false),
  tool_called: z.literal(false),
  memory_written: z.literal(false),
  project_mutated: z.literal(false),
  device_action_executed: z.literal(false),
  approval_executed: z.literal(false),
});

export type RoutineReadScopeAllowedScope = z.infer<
  typeof RoutineReadScopeAllowedScopeSchema
>;
export type RoutineReadScopeDeniedScope = z.infer<
  typeof RoutineReadScopeDeniedScopeSchema
>;
export type RoutineReadScopeBindingDecision = z.infer<
  typeof RoutineReadScopeBindingDecisionSchema
>;
export type RoutineReadScopeBindingRoutine = z.infer<
  typeof RoutineReadScopeBindingRoutineSchema
>;

export const DEFAULT_ROUTINE_READ_SCOPE_BINDINGS = {
  daily_self_audit: [
    "approvals_metadata",
    "tool_call_metadata",
    "model_cost_metadata",
    "vision_replay_metadata",
    "environment_room_event_metadata",
    "project_ledger_metadata",
    "router_decision_metadata",
    "safety_classifier_metadata",
  ],
  cost_report: ["tool_call_metadata", "model_cost_metadata"],
  project_progress: ["project_ledger_metadata", "router_decision_metadata"],
  calibration_diff: [
    "model_cost_metadata",
    "router_decision_metadata",
    "safety_classifier_metadata",
  ],
  next_action_suggest: [
    "approvals_metadata",
    "project_ledger_metadata",
    "router_decision_metadata",
    "safety_classifier_metadata",
  ],
} as const satisfies Record<
  z.infer<typeof ScheduledAssistanceRoutineKindSchema>,
  readonly ScheduledAssistanceReadScopeSurface[]
>;

export function evaluateRoutineReadScopeBinding(
  routine: unknown,
  scopeRegistry: unknown = DEFAULT_SCHEDULED_ASSISTANCE_READ_SCOPES,
): RoutineReadScopeBindingDecision {
  const parsedRoutine = RoutineReadScopeBindingRoutineSchema.safeParse(routine);
  const parsedScopes = z
    .array(ScheduledAssistanceReadScopeSchema)
    .safeParse(scopeRegistry);

  if (!parsedRoutine.success) {
    return bindingDecision({
      routine_id: "routine:invalid",
      routine_kind: "daily_self_audit",
      allowed_read_scopes: [],
      denied_read_scopes: [
        deniedScope({
          scope_id: "scope:invalid",
          surface_kind: "unknown",
          reason: "routine_unknown",
        }),
      ],
    });
  }

  if (!parsedScopes.success) {
    return bindingDecision({
      routine_id: parsedRoutine.data.routine_id,
      routine_kind: parsedRoutine.data.routine_kind,
      allowed_read_scopes: [],
      denied_read_scopes: [
        deniedScope({
          scope_id: "scope:invalid",
          surface_kind: "unknown",
          reason: "undeclared_scope",
        }),
      ],
    });
  }

  const requestedScopes =
    DEFAULT_ROUTINE_READ_SCOPE_BINDINGS[parsedRoutine.data.routine_kind];
  const allowed: RoutineReadScopeAllowedScope[] = [];
  const denied: RoutineReadScopeDeniedScope[] = [];

  for (const surfaceKind of requestedScopes) {
    const scope = parsedScopes.data.find(
      (candidate) => candidate.surface_kind === surfaceKind,
    );
    if (!scope) {
      denied.push(
        deniedScope({
          scope_id: `scope:${surfaceKind}`,
          surface_kind: surfaceKind,
          reason: "undeclared_scope",
        }),
      );
      continue;
    }

    const scopeDecision = evaluateScheduledAssistanceReadScope(scope);
    if (scopeDecision.allowed) {
      allowed.push(allowedScope(scope));
    } else {
      denied.push(
        deniedScope({
          scope_id: scope.scope_id,
          surface_kind: scope.surface_kind,
          reason: scopeDecision.reason,
        }),
      );
    }
  }

  for (const scope of parsedScopes.data) {
    if (!isDeclaredSurface(scope.surface_kind)) {
      denied.push(
        deniedScope({
          scope_id: scope.scope_id,
          surface_kind: scope.surface_kind,
          reason: "unknown_surface",
        }),
      );
    }
  }

  return bindingDecision({
    routine_id: parsedRoutine.data.routine_id,
    routine_kind: parsedRoutine.data.routine_kind,
    allowed_read_scopes: allowed,
    denied_read_scopes: denied,
  });
}

function bindingDecision(input: {
  readonly routine_id: string;
  readonly routine_kind: z.infer<typeof ScheduledAssistanceRoutineKindSchema>;
  readonly allowed_read_scopes: readonly RoutineReadScopeAllowedScope[];
  readonly denied_read_scopes: readonly RoutineReadScopeDeniedScope[];
}): RoutineReadScopeBindingDecision {
  return RoutineReadScopeBindingDecisionSchema.parse({
    routine_id: input.routine_id,
    routine_kind: input.routine_kind,
    binding_complete: input.denied_read_scopes.length === 0,
    allowed_read_scopes: input.allowed_read_scopes,
    denied_read_scopes: input.denied_read_scopes,
    metadata_only: true,
    collector_execution_supported: false,
    collector_execution_attempted: false,
    db_read_supported: false,
    db_read_performed: false,
    event_store_read_supported: false,
    event_store_read_performed: false,
    report_generation_supported: false,
    report_generated: false,
    suggestion_generation_supported: false,
    suggestion_generated: false,
    persistence_supported: false,
    persisted: false,
    network_called: false,
    cloud_called: false,
    tool_called: false,
    memory_written: false,
    project_mutated: false,
    device_action_executed: false,
    approval_executed: false,
  });
}

function allowedScope(
  scope: ScheduledAssistanceReadScope,
): RoutineReadScopeAllowedScope {
  return RoutineReadScopeAllowedScopeSchema.parse({
    scope_id: scope.scope_id,
    surface_kind: scope.surface_kind,
    row_cap: scope.row_cap,
    read_only: true,
    metadata_only: true,
    raw_payload_allowed: false,
    pii_allowed: false,
    secrets_allowed: false,
    network_allowed: false,
    write_allowed: false,
  });
}

function deniedScope(input: {
  readonly scope_id: string;
  readonly surface_kind: string;
  readonly reason: RoutineReadScopeBindingReason;
}): RoutineReadScopeDeniedScope {
  return RoutineReadScopeDeniedScopeSchema.parse({
    scope_id: input.scope_id,
    surface_kind: input.surface_kind,
    reason: input.reason,
    read_only: true,
    metadata_only: true,
    raw_payload_allowed: false,
    pii_allowed: false,
    secrets_allowed: false,
    network_allowed: false,
    write_allowed: false,
  });
}

function isDeclaredSurface(
  surfaceKind: string,
): surfaceKind is ScheduledAssistanceReadScopeSurface {
  return ScheduledAssistanceReadScopeSurfaceSchema.safeParse(surfaceKind)
    .success;
}
