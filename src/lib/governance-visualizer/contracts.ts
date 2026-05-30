import { z } from "zod";

export const GOVERNANCE_BOUNDARY_CONTRACT_VERSION = "19C.1" as const;

export const GOVERNANCE_BOUNDARY_NODE_IDS = [
  "governance-node:voice-runtime",
  "governance-node:vision-runtime",
  "governance-node:scheduler",
  "governance-node:approval-runtime",
  "governance-node:tool-runtime",
  "governance-node:command-center",
  "governance-node:telemetry-cockpit",
  "governance-node:architecture-graph",
  "governance-node:room-runtime",
  "governance-node:room-adapters",
  "governance-node:event-store",
  "governance-node:observability-api",
  "governance-node:memory-bridge",
  "governance-node:local-providers",
  "governance-node:cloud-providers",
] as const;

export const GOVERNANCE_BOUNDARY_EDGE_POLICIES = [
  "allowed",
  "gated",
  "forbidden",
] as const;

export const GOVERNANCE_BOUNDARY_GATE_TYPES = [
  "approval",
  "consent",
  "budget",
  "user_present",
  "kill_switch",
  "local_only",
  "disabled_feature",
] as const;

export const GOVERNANCE_BOUNDARY_TRUST_CLASSES = [
  "observe_only",
  "safe_mutate",
  "restricted_mutate",
  "forbidden",
] as const;

export const GOVERNANCE_BOUNDARY_SEVERITIES = [
  "info",
  "warning",
  "critical",
] as const;

export const GOVERNANCE_BOUNDARY_FORBIDDEN_RAW_KEYS = [
  "executable_payload",
  "execution_payload",
  "tool_args",
  "tool_arguments",
  "approval_token",
  "raw_approval_token",
  "raw_prompt",
  "prompt",
  "raw_output",
  "raw_model_output",
  "model_output",
  "raw_voice",
  "raw_voice_transcript",
  "voice_transcript",
  "raw_ocr",
  "raw_ocr_text",
  "ocr_text",
  "raw_frame",
  "raw_frames",
  "frame",
  "frames",
  "secret",
  "secrets",
  "api_key",
] as const;

export type GovernanceBoundaryNodeId =
  (typeof GOVERNANCE_BOUNDARY_NODE_IDS)[number];
export type GovernanceBoundaryPolicyKind =
  (typeof GOVERNANCE_BOUNDARY_EDGE_POLICIES)[number];
export type GovernanceBoundaryGateType =
  (typeof GOVERNANCE_BOUNDARY_GATE_TYPES)[number];
export type GovernanceBoundaryTrustClass =
  (typeof GOVERNANCE_BOUNDARY_TRUST_CLASSES)[number];
export type GovernanceBoundarySeverity =
  (typeof GOVERNANCE_BOUNDARY_SEVERITIES)[number];

export const GovernanceBoundaryNodeIdSchema = z.enum(
  GOVERNANCE_BOUNDARY_NODE_IDS,
);
export const GovernanceBoundaryPolicyKindSchema = z.enum(
  GOVERNANCE_BOUNDARY_EDGE_POLICIES,
);
export const GovernanceBoundaryGateTypeSchema = z.enum(
  GOVERNANCE_BOUNDARY_GATE_TYPES,
);
export const GovernanceBoundaryTrustClassSchema = z.enum(
  GOVERNANCE_BOUNDARY_TRUST_CLASSES,
);
export const GovernanceBoundarySeveritySchema = z.enum(
  GOVERNANCE_BOUNDARY_SEVERITIES,
);

const GovernanceIdSchema = z
  .string()
  .trim()
  .regex(/^governance-[a-z]+:[a-z0-9._:-]+$/);

export const GovernanceBoundaryDisabledCapabilityFlagsSchema = z.strictObject({
  execution_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  dispatch_enabled: z.literal(false),
  approval_decision_enabled: z.literal(false),
  approval_grant_enabled: z.literal(false),
  authority_surface_enabled: z.literal(false),
  runtime_control_enabled: z.literal(false),
  telemetry_ingestion_enabled: z.literal(false),
  filesystem_read_enabled: z.literal(false),
  database_read_enabled: z.literal(false),
  runtime_observer_enabled: z.literal(false),
  network_call_enabled: z.literal(false),
});

export const GovernanceBoundaryNodeSchema = z.strictObject({
  node_id: GovernanceBoundaryNodeIdSchema,
  label: z.string().trim().min(1).max(120),
  subsystem_ref: z.string().trim().min(1).max(80),
  trust_class: GovernanceBoundaryTrustClassSchema,
  disabled_capability_flags: GovernanceBoundaryDisabledCapabilityFlagsSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  executable_payload_included: z.literal(false),
  tool_arguments_included: z.literal(false),
  approval_token_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_output_included: z.literal(false),
  raw_voice_included: z.literal(false),
  raw_ocr_included: z.literal(false),
  raw_frame_included: z.literal(false),
  secret_material_included: z.literal(false),
});

export const GovernanceBoundaryPolicySchema = z.strictObject({
  policy_id: GovernanceIdSchema.regex(/^governance-policy:/),
  label: z.string().trim().min(1).max(160),
  policy: GovernanceBoundaryPolicyKindSchema,
  gate_type: GovernanceBoundaryGateTypeSchema.nullable(),
  trust_class: GovernanceBoundaryTrustClassSchema,
  disabled_capability_flags: GovernanceBoundaryDisabledCapabilityFlagsSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  creates_authority_surface: z.literal(false),
  executes_policy: z.literal(false),
});

export const GovernanceBoundaryEdgeSchema = z.strictObject({
  edge_id: GovernanceIdSchema.regex(/^governance-edge:/),
  from_node_id: GovernanceBoundaryNodeIdSchema,
  to_node_id: GovernanceBoundaryNodeIdSchema,
  label: z.string().trim().min(1).max(180),
  policy: GovernanceBoundaryPolicyKindSchema,
  gate_type: GovernanceBoundaryGateTypeSchema.nullable(),
  policy_id: GovernanceIdSchema.regex(/^governance-policy:/),
  tripwire_id: GovernanceIdSchema.regex(/^governance-tripwire:/).nullable(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  forbidden_tripwire_only: z.boolean(),
  disabled_feature_boundary: z.boolean(),
  executable_action_enabled: z.literal(false),
  dispatch_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  approval_decision_enabled: z.literal(false),
  authority_grant_enabled: z.literal(false),
  runtime_control_enabled: z.literal(false),
  raw_payload_included: z.literal(false),
  tool_arguments_included: z.literal(false),
  approval_token_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_output_included: z.literal(false),
  raw_voice_included: z.literal(false),
  raw_ocr_included: z.literal(false),
  raw_frame_included: z.literal(false),
  secret_material_included: z.literal(false),
});

export const GovernanceBoundaryTripwireSchema = z.strictObject({
  tripwire_id: GovernanceIdSchema.regex(/^governance-tripwire:/),
  edge_id: GovernanceIdSchema.regex(/^governance-edge:/),
  label: z.string().trim().min(1).max(180),
  severity: GovernanceBoundarySeveritySchema,
  observed: z.literal(false),
  armed_metadata_only: z.literal(true),
  acknowledgement_required_metadata: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  creates_runtime_observer: z.literal(false),
  executes_response: z.literal(false),
  persists_acknowledgement: z.literal(false),
});

export const GovernanceBoundaryWarningSchema = z.strictObject({
  warning_id: GovernanceIdSchema.regex(/^governance-warning:/),
  node_id: GovernanceBoundaryNodeIdSchema.nullable(),
  edge_id: GovernanceIdSchema.regex(/^governance-edge:/).nullable(),
  tripwire_id: GovernanceIdSchema.regex(/^governance-tripwire:/).nullable(),
  severity: GovernanceBoundarySeveritySchema,
  label: z.string().trim().min(1).max(180),
  recommendation: z.string().trim().min(1).max(220),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  informational_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export const GovernanceBoundaryStatsSchema = z.strictObject({
  node_count: z.number().int().nonnegative(),
  edge_count: z.number().int().nonnegative(),
  allowed_edge_count: z.number().int().nonnegative(),
  gated_edge_count: z.number().int().nonnegative(),
  forbidden_edge_count: z.number().int().nonnegative(),
  tripwire_count: z.number().int().nonnegative(),
  warning_count: z.number().int().nonnegative(),
  disabled_feature_boundary_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const GovernanceBoundaryProjectionSchema = z.strictObject({
  projection_id: z.literal("governance-boundary:phase-19c1-projection"),
  contract_version: z.literal(GOVERNANCE_BOUNDARY_CONTRACT_VERSION),
  generated_from: z.literal("deterministic_governance_boundary_metadata"),
  nodes: z
    .array(GovernanceBoundaryNodeSchema)
    .length(GOVERNANCE_BOUNDARY_NODE_IDS.length),
  edges: z.array(GovernanceBoundaryEdgeSchema).min(1),
  policies: z.array(GovernanceBoundaryPolicySchema).min(1),
  tripwires: z.array(GovernanceBoundaryTripwireSchema),
  warnings: z.array(GovernanceBoundaryWarningSchema),
  stats: GovernanceBoundaryStatsSchema,
  disabled_capability_flags: GovernanceBoundaryDisabledCapabilityFlagsSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  deterministic: z.literal(true),
  redaction_safe: z.literal(true),
  defensive_copy_safe: z.literal(true),
  payload_classes_exposed: z.array(z.never()),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  telemetry_ingested: z.literal(false),
  runtime_observer_created: z.literal(false),
  authority_surface_created: z.literal(false),
  side_effects_performed: z.literal(false),
  phase_18_boundaries_modified: z.literal(false),
});

export const GovernanceBoundaryValidationSchema = z.strictObject({
  valid: z.boolean(),
  reason: z.enum([
    "valid_governance_boundary_projection",
    "schema_rejected",
    "duplicate_node_id",
    "duplicate_edge_id",
    "missing_node_reference",
    "missing_policy_reference",
    "missing_tripwire_reference",
    "forbidden_field_name",
    "executable_payload_detected",
    "disabled_capability_enabled",
    "forbidden_edge_not_tripwire_metadata",
  ]),
  violation_paths: z.array(z.string().trim().min(1).max(260)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_value_included: z.literal(false),
});

export type GovernanceBoundaryNode = z.infer<
  typeof GovernanceBoundaryNodeSchema
>;
export type GovernanceBoundaryEdge = z.infer<
  typeof GovernanceBoundaryEdgeSchema
>;
export type GovernanceBoundaryPolicy = z.infer<
  typeof GovernanceBoundaryPolicySchema
>;
export type GovernanceBoundaryTripwire = z.infer<
  typeof GovernanceBoundaryTripwireSchema
>;
export type GovernanceBoundaryWarning = z.infer<
  typeof GovernanceBoundaryWarningSchema
>;
export type GovernanceBoundaryStats = z.infer<
  typeof GovernanceBoundaryStatsSchema
>;
export type GovernanceBoundaryProjection = z.infer<
  typeof GovernanceBoundaryProjectionSchema
>;
export type GovernanceBoundaryValidation = z.infer<
  typeof GovernanceBoundaryValidationSchema
>;

const DISABLED_CAPABILITY_FLAGS =
  GovernanceBoundaryDisabledCapabilityFlagsSchema.parse({
    execution_enabled: false,
    mutation_enabled: false,
    dispatch_enabled: false,
    approval_decision_enabled: false,
    approval_grant_enabled: false,
    authority_surface_enabled: false,
    runtime_control_enabled: false,
    telemetry_ingestion_enabled: false,
    filesystem_read_enabled: false,
    database_read_enabled: false,
    runtime_observer_enabled: false,
    network_call_enabled: false,
  });

const NODE_METADATA: Record<
  GovernanceBoundaryNodeId,
  { readonly label: string; readonly trust_class: GovernanceBoundaryTrustClass }
> = {
  "governance-node:voice-runtime": {
    label: "Voice Runtime",
    trust_class: "observe_only",
  },
  "governance-node:vision-runtime": {
    label: "Vision Runtime",
    trust_class: "observe_only",
  },
  "governance-node:scheduler": {
    label: "Scheduler",
    trust_class: "observe_only",
  },
  "governance-node:approval-runtime": {
    label: "Approval Runtime",
    trust_class: "safe_mutate",
  },
  "governance-node:tool-runtime": {
    label: "Tool Runtime",
    trust_class: "restricted_mutate",
  },
  "governance-node:command-center": {
    label: "Command Center",
    trust_class: "observe_only",
  },
  "governance-node:telemetry-cockpit": {
    label: "Telemetry Cockpit",
    trust_class: "observe_only",
  },
  "governance-node:architecture-graph": {
    label: "Architecture Graph",
    trust_class: "observe_only",
  },
  "governance-node:room-runtime": {
    label: "Room Runtime",
    trust_class: "observe_only",
  },
  "governance-node:room-adapters": {
    label: "Room Adapters",
    trust_class: "restricted_mutate",
  },
  "governance-node:event-store": {
    label: "Event Store",
    trust_class: "restricted_mutate",
  },
  "governance-node:observability-api": {
    label: "Observability API",
    trust_class: "observe_only",
  },
  "governance-node:memory-bridge": {
    label: "Memory Bridge",
    trust_class: "restricted_mutate",
  },
  "governance-node:local-providers": {
    label: "Local Providers",
    trust_class: "safe_mutate",
  },
  "governance-node:cloud-providers": {
    label: "Cloud Providers",
    trust_class: "restricted_mutate",
  },
};

function copyProjection<T>(schema: z.ZodType<T>, value: T): T {
  return schema.parse(JSON.parse(JSON.stringify(value)));
}

function node(nodeId: GovernanceBoundaryNodeId): GovernanceBoundaryNode {
  const metadata = NODE_METADATA[nodeId];
  return GovernanceBoundaryNodeSchema.parse({
    node_id: nodeId,
    label: metadata.label,
    subsystem_ref: metadata.label.toLowerCase().replaceAll(" ", "_"),
    trust_class: metadata.trust_class,
    disabled_capability_flags: DISABLED_CAPABILITY_FLAGS,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    executable_payload_included: false,
    tool_arguments_included: false,
    approval_token_included: false,
    raw_prompt_included: false,
    raw_output_included: false,
    raw_voice_included: false,
    raw_ocr_included: false,
    raw_frame_included: false,
    secret_material_included: false,
  });
}

function policy(input: {
  readonly slug: string;
  readonly label: string;
  readonly policy: GovernanceBoundaryPolicyKind;
  readonly gateType: GovernanceBoundaryGateType | null;
  readonly trustClass: GovernanceBoundaryTrustClass;
}): GovernanceBoundaryPolicy {
  return GovernanceBoundaryPolicySchema.parse({
    policy_id: `governance-policy:${input.slug}`,
    label: input.label,
    policy: input.policy,
    gate_type: input.gateType,
    trust_class: input.trustClass,
    disabled_capability_flags: DISABLED_CAPABILITY_FLAGS,
    metadata_only: true,
    read_only: true,
    creates_authority_surface: false,
    executes_policy: false,
  });
}

function edge(input: {
  readonly slug: string;
  readonly from: GovernanceBoundaryNodeId;
  readonly to: GovernanceBoundaryNodeId;
  readonly label: string;
  readonly policy: GovernanceBoundaryPolicyKind;
  readonly gateType: GovernanceBoundaryGateType | null;
  readonly tripwireSlug?: string;
  readonly disabledFeatureBoundary?: boolean;
}): GovernanceBoundaryEdge {
  return GovernanceBoundaryEdgeSchema.parse({
    edge_id: `governance-edge:${input.slug}`,
    from_node_id: input.from,
    to_node_id: input.to,
    label: input.label,
    policy: input.policy,
    gate_type: input.gateType,
    policy_id: `governance-policy:${input.policy}${
      input.gateType ? `-${input.gateType}` : ""
    }`,
    tripwire_id: input.tripwireSlug
      ? `governance-tripwire:${input.tripwireSlug}`
      : null,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    forbidden_tripwire_only: input.policy === "forbidden",
    disabled_feature_boundary: input.disabledFeatureBoundary ?? false,
    executable_action_enabled: false,
    dispatch_enabled: false,
    mutation_enabled: false,
    approval_decision_enabled: false,
    authority_grant_enabled: false,
    runtime_control_enabled: false,
    raw_payload_included: false,
    tool_arguments_included: false,
    approval_token_included: false,
    raw_prompt_included: false,
    raw_output_included: false,
    raw_voice_included: false,
    raw_ocr_included: false,
    raw_frame_included: false,
    secret_material_included: false,
  });
}

function tripwire(input: {
  readonly slug: string;
  readonly edgeSlug: string;
  readonly label: string;
  readonly severity?: GovernanceBoundarySeverity;
}): GovernanceBoundaryTripwire {
  return GovernanceBoundaryTripwireSchema.parse({
    tripwire_id: `governance-tripwire:${input.slug}`,
    edge_id: `governance-edge:${input.edgeSlug}`,
    label: input.label,
    severity: input.severity ?? "critical",
    observed: false,
    armed_metadata_only: true,
    acknowledgement_required_metadata: true,
    metadata_only: true,
    read_only: true,
    creates_runtime_observer: false,
    executes_response: false,
    persists_acknowledgement: false,
  });
}

function warning(input: {
  readonly slug: string;
  readonly nodeId?: GovernanceBoundaryNodeId | null;
  readonly edgeSlug?: string | null;
  readonly tripwireSlug?: string | null;
  readonly label: string;
  readonly recommendation: string;
  readonly severity?: GovernanceBoundarySeverity;
}): GovernanceBoundaryWarning {
  return GovernanceBoundaryWarningSchema.parse({
    warning_id: `governance-warning:${input.slug}`,
    node_id: input.nodeId ?? null,
    edge_id: input.edgeSlug ? `governance-edge:${input.edgeSlug}` : null,
    tripwire_id: input.tripwireSlug
      ? `governance-tripwire:${input.tripwireSlug}`
      : null,
    severity: input.severity ?? "warning",
    label: input.label,
    recommendation: input.recommendation,
    metadata_only: true,
    read_only: true,
    informational_only: true,
    raw_value_included: false,
  });
}

function createPolicies(): GovernanceBoundaryPolicy[] {
  return [
    policy({
      slug: "allowed",
      label: "Allowed read-only metadata path",
      policy: "allowed",
      gateType: null,
      trustClass: "observe_only",
    }),
    policy({
      slug: "gated-approval",
      label: "Approval-gated future side-effect path",
      policy: "gated",
      gateType: "approval",
      trustClass: "restricted_mutate",
    }),
    policy({
      slug: "gated-consent",
      label: "Consent-gated provider path",
      policy: "gated",
      gateType: "consent",
      trustClass: "restricted_mutate",
    }),
    policy({
      slug: "gated-budget",
      label: "Budget-gated cloud provider path",
      policy: "gated",
      gateType: "budget",
      trustClass: "restricted_mutate",
    }),
    policy({
      slug: "gated-user_present",
      label: "User-present gated interaction path",
      policy: "gated",
      gateType: "user_present",
      trustClass: "safe_mutate",
    }),
    policy({
      slug: "gated-kill_switch",
      label: "Kill-switch protected runtime path",
      policy: "gated",
      gateType: "kill_switch",
      trustClass: "restricted_mutate",
    }),
    policy({
      slug: "gated-local_only",
      label: "Local-only provider boundary",
      policy: "gated",
      gateType: "local_only",
      trustClass: "safe_mutate",
    }),
    policy({
      slug: "forbidden-disabled_feature",
      label: "Disabled feature or forbidden path",
      policy: "forbidden",
      gateType: "disabled_feature",
      trustClass: "forbidden",
    }),
  ];
}

function createEdges(): GovernanceBoundaryEdge[] {
  return [
    edge({
      slug: "command-center-observes-observability-api",
      from: "governance-node:command-center",
      to: "governance-node:observability-api",
      label: "Command Center observes Observability API metadata",
      policy: "allowed",
      gateType: null,
    }),
    edge({
      slug: "telemetry-cockpit-observes-observability-api",
      from: "governance-node:telemetry-cockpit",
      to: "governance-node:observability-api",
      label: "Telemetry Cockpit observes projection metadata",
      policy: "allowed",
      gateType: null,
    }),
    edge({
      slug: "architecture-graph-observes-boundary-metadata",
      from: "governance-node:architecture-graph",
      to: "governance-node:observability-api",
      label: "Architecture Graph observes boundary metadata",
      policy: "allowed",
      gateType: null,
    }),
    edge({
      slug: "observability-api-reads-event-store",
      from: "governance-node:observability-api",
      to: "governance-node:event-store",
      label: "Observability API reads Event Store projections",
      policy: "allowed",
      gateType: null,
    }),
    edge({
      slug: "voice-runtime-local-providers",
      from: "governance-node:voice-runtime",
      to: "governance-node:local-providers",
      label: "Voice Runtime stays inside local provider boundary",
      policy: "gated",
      gateType: "local_only",
    }),
    edge({
      slug: "cloud-providers-budget-consent",
      from: "governance-node:command-center",
      to: "governance-node:cloud-providers",
      label: "Cloud Providers require consent and budget metadata",
      policy: "gated",
      gateType: "budget",
    }),
    edge({
      slug: "approval-runtime-gates-tool-runtime",
      from: "governance-node:approval-runtime",
      to: "governance-node:tool-runtime",
      label: "Approval Runtime gates Tool Runtime",
      policy: "gated",
      gateType: "approval",
    }),
    edge({
      slug: "room-runtime-kill-switch-room-adapters",
      from: "governance-node:room-runtime",
      to: "governance-node:room-adapters",
      label: "Room Runtime is kill-switch gated before adapters",
      policy: "gated",
      gateType: "kill_switch",
    }),
    edge({
      slug: "memory-bridge-approval-gated",
      from: "governance-node:memory-bridge",
      to: "governance-node:approval-runtime",
      label: "Memory Bridge mutations require approval metadata",
      policy: "gated",
      gateType: "approval",
    }),
    edge({
      slug: "voice-approval-grant-forbidden",
      from: "governance-node:voice-runtime",
      to: "governance-node:approval-runtime",
      label: "Voice to Approval Grant is forbidden",
      policy: "forbidden",
      gateType: "disabled_feature",
      tripwireSlug: "voice-approval-grant",
      disabledFeatureBoundary: true,
    }),
    edge({
      slug: "voice-tool-execution-forbidden",
      from: "governance-node:voice-runtime",
      to: "governance-node:tool-runtime",
      label: "Voice to Tool Execution is forbidden",
      policy: "forbidden",
      gateType: "disabled_feature",
      tripwireSlug: "voice-tool-execution",
      disabledFeatureBoundary: true,
    }),
    edge({
      slug: "vision-room-action-forbidden",
      from: "governance-node:vision-runtime",
      to: "governance-node:room-adapters",
      label: "Vision to Room Action is forbidden",
      policy: "forbidden",
      gateType: "disabled_feature",
      tripwireSlug: "vision-room-action",
      disabledFeatureBoundary: true,
    }),
    edge({
      slug: "scheduler-tool-execution-forbidden",
      from: "governance-node:scheduler",
      to: "governance-node:tool-runtime",
      label: "Scheduler to Tool Execution is forbidden",
      policy: "forbidden",
      gateType: "disabled_feature",
      tripwireSlug: "scheduler-tool-execution",
      disabledFeatureBoundary: true,
    }),
    edge({
      slug: "scheduler-approval-decision-forbidden",
      from: "governance-node:scheduler",
      to: "governance-node:approval-runtime",
      label: "Scheduler to Approval Decision is forbidden",
      policy: "forbidden",
      gateType: "disabled_feature",
      tripwireSlug: "scheduler-approval-decision",
      disabledFeatureBoundary: true,
    }),
    edge({
      slug: "command-center-runtime-mutation-forbidden",
      from: "governance-node:command-center",
      to: "governance-node:room-runtime",
      label: "Command Center to Runtime Mutation is forbidden",
      policy: "forbidden",
      gateType: "disabled_feature",
      tripwireSlug: "command-center-runtime-mutation",
      disabledFeatureBoundary: true,
    }),
    edge({
      slug: "architecture-graph-execution-forbidden",
      from: "governance-node:architecture-graph",
      to: "governance-node:tool-runtime",
      label: "Architecture Graph to Execution is forbidden",
      policy: "forbidden",
      gateType: "disabled_feature",
      tripwireSlug: "architecture-graph-execution",
      disabledFeatureBoundary: true,
    }),
    edge({
      slug: "telemetry-cockpit-mutation-forbidden",
      from: "governance-node:telemetry-cockpit",
      to: "governance-node:tool-runtime",
      label: "Telemetry Cockpit to Mutation is forbidden",
      policy: "forbidden",
      gateType: "disabled_feature",
      tripwireSlug: "telemetry-cockpit-mutation",
      disabledFeatureBoundary: true,
    }),
  ];
}

function createTripwires(): GovernanceBoundaryTripwire[] {
  return [
    tripwire({
      slug: "voice-approval-grant",
      edgeSlug: "voice-approval-grant-forbidden",
      label: "Voice path must never grant approval authority",
    }),
    tripwire({
      slug: "voice-tool-execution",
      edgeSlug: "voice-tool-execution-forbidden",
      label: "Voice path must never invoke tool execution",
    }),
    tripwire({
      slug: "vision-room-action",
      edgeSlug: "vision-room-action-forbidden",
      label: "Vision path must never trigger room action",
    }),
    tripwire({
      slug: "scheduler-tool-execution",
      edgeSlug: "scheduler-tool-execution-forbidden",
      label: "Scheduler path must never execute tools",
    }),
    tripwire({
      slug: "scheduler-approval-decision",
      edgeSlug: "scheduler-approval-decision-forbidden",
      label: "Scheduler path must never decide approvals",
    }),
    tripwire({
      slug: "command-center-runtime-mutation",
      edgeSlug: "command-center-runtime-mutation-forbidden",
      label: "Command Center path must never mutate runtime state",
    }),
    tripwire({
      slug: "architecture-graph-execution",
      edgeSlug: "architecture-graph-execution-forbidden",
      label: "Architecture Graph path must never execute",
    }),
    tripwire({
      slug: "telemetry-cockpit-mutation",
      edgeSlug: "telemetry-cockpit-mutation-forbidden",
      label: "Telemetry Cockpit path must never mutate",
    }),
  ];
}

function createWarnings(): GovernanceBoundaryWarning[] {
  return [
    warning({
      slug: "forbidden-paths-tripwire-only",
      label: "Forbidden paths are represented as metadata tripwires only",
      recommendation:
        "Render forbidden paths as warnings without creating acknowledgement or execution flows.",
      severity: "critical",
    }),
    warning({
      slug: "disabled-feature-boundaries",
      label: "Disabled-feature boundaries remain non-operational",
      recommendation:
        "Keep disabled capabilities visible without adding runtime control.",
      severity: "warning",
    }),
  ];
}

function statsForProjection(input: {
  readonly nodes: readonly GovernanceBoundaryNode[];
  readonly edges: readonly GovernanceBoundaryEdge[];
  readonly tripwires: readonly GovernanceBoundaryTripwire[];
  readonly warnings: readonly GovernanceBoundaryWarning[];
}): GovernanceBoundaryStats {
  return GovernanceBoundaryStatsSchema.parse({
    node_count: input.nodes.length,
    edge_count: input.edges.length,
    allowed_edge_count: input.edges.filter((edge) => edge.policy === "allowed")
      .length,
    gated_edge_count: input.edges.filter((edge) => edge.policy === "gated")
      .length,
    forbidden_edge_count: input.edges.filter(
      (edge) => edge.policy === "forbidden",
    ).length,
    tripwire_count: input.tripwires.length,
    warning_count: input.warnings.length,
    disabled_feature_boundary_count: input.edges.filter(
      (edge) => edge.disabled_feature_boundary,
    ).length,
    metadata_only: true,
    read_only: true,
  });
}

function createGovernanceBoundaryProjection(): GovernanceBoundaryProjection {
  const nodes = GOVERNANCE_BOUNDARY_NODE_IDS.map(node);
  const edges = createEdges();
  const tripwires = createTripwires();
  const warnings = createWarnings();

  return GovernanceBoundaryProjectionSchema.parse({
    projection_id: "governance-boundary:phase-19c1-projection",
    contract_version: GOVERNANCE_BOUNDARY_CONTRACT_VERSION,
    generated_from: "deterministic_governance_boundary_metadata",
    nodes,
    edges,
    policies: createPolicies(),
    tripwires,
    warnings,
    stats: statsForProjection({ nodes, edges, tripwires, warnings }),
    disabled_capability_flags: DISABLED_CAPABILITY_FLAGS,
    metadata_only: true,
    read_only: true,
    deterministic: true,
    redaction_safe: true,
    defensive_copy_safe: true,
    payload_classes_exposed: [],
    filesystem_read: false,
    database_read: false,
    telemetry_ingested: false,
    runtime_observer_created: false,
    authority_surface_created: false,
    side_effects_performed: false,
    phase_18_boundaries_modified: false,
  });
}

const STATIC_GOVERNANCE_BOUNDARY_PROJECTION =
  createGovernanceBoundaryProjection();

function collectValidationViolations(
  input: unknown,
  path: string,
  violations: Map<string, GovernanceBoundaryValidation["reason"]>,
): void {
  if (typeof input === "string") {
    if (
      /^\s*(function\s|async\s*\(|\([^)]*\)\s*=>|rm\s+-rf|curl\s+https?:\/\/|powershell\s+-|bash\s+-c|cmd\s+\/c)/i.test(
        input,
      )
    ) {
      violations.set(path, "executable_payload_detected");
    }
    return;
  }

  if (Array.isArray(input)) {
    input.forEach((item, index) => {
      collectValidationViolations(item, `${path}[${index}]`, violations);
    });
    return;
  }

  if (!input || typeof input !== "object") {
    return;
  }

  for (const [key, value] of Object.entries(input)) {
    const childPath = `${path}.${key}`;
    if (
      GOVERNANCE_BOUNDARY_FORBIDDEN_RAW_KEYS.includes(
        key.trim().toLowerCase() as never,
      )
    ) {
      violations.set(childPath, "forbidden_field_name");
      continue;
    }
    if (key.endsWith("_enabled") && key !== "metadata_only" && value === true) {
      violations.set(childPath, "disabled_capability_enabled");
      continue;
    }
    collectValidationViolations(value, childPath, violations);
  }
}

function duplicateValue(values: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

export function validateGovernanceBoundaryProjection(
  input: unknown,
): GovernanceBoundaryValidation {
  const parsed = GovernanceBoundaryProjectionSchema.safeParse(input);
  const violations = new Map<string, GovernanceBoundaryValidation["reason"]>();
  collectValidationViolations(input, "$", violations);

  if (!parsed.success) {
    violations.set("$", "schema_rejected");
  } else {
    const projection = parsed.data;
    const nodeIds = new Set(
      projection.nodes.map((nodeItem) => nodeItem.node_id),
    );
    const edgeIds = new Set(
      projection.edges.map((edgeItem) => edgeItem.edge_id),
    );
    const policyIds = new Set(
      projection.policies.map((policyItem) => policyItem.policy_id),
    );
    const tripwireIds = new Set(
      projection.tripwires.map((tripwireItem) => tripwireItem.tripwire_id),
    );
    const duplicateNodeId = duplicateValue(
      projection.nodes.map((nodeItem) => nodeItem.node_id),
    );
    const duplicateEdgeId = duplicateValue(
      projection.edges.map((edgeItem) => edgeItem.edge_id),
    );

    if (duplicateNodeId) {
      violations.set(`$.nodes.${duplicateNodeId}`, "duplicate_node_id");
    }
    if (duplicateEdgeId) {
      violations.set(`$.edges.${duplicateEdgeId}`, "duplicate_edge_id");
    }

    projection.edges.forEach((edgeItem) => {
      if (
        !nodeIds.has(edgeItem.from_node_id) ||
        !nodeIds.has(edgeItem.to_node_id)
      ) {
        violations.set(edgeItem.edge_id, "missing_node_reference");
      }
      if (!policyIds.has(edgeItem.policy_id)) {
        violations.set(edgeItem.policy_id, "missing_policy_reference");
      }
      if (edgeItem.tripwire_id && !tripwireIds.has(edgeItem.tripwire_id)) {
        violations.set(edgeItem.tripwire_id, "missing_tripwire_reference");
      }
      if (
        edgeItem.policy === "forbidden" &&
        (!edgeItem.forbidden_tripwire_only ||
          edgeItem.executable_action_enabled ||
          edgeItem.dispatch_enabled ||
          edgeItem.mutation_enabled ||
          edgeItem.authority_grant_enabled)
      ) {
        violations.set(
          edgeItem.edge_id,
          "forbidden_edge_not_tripwire_metadata",
        );
      }
    });

    projection.tripwires.forEach((tripwireItem) => {
      if (!edgeIds.has(tripwireItem.edge_id)) {
        violations.set(tripwireItem.edge_id, "missing_tripwire_reference");
      }
    });
  }

  const [firstReason] = [...violations.values()];
  return GovernanceBoundaryValidationSchema.parse({
    valid: violations.size === 0,
    reason: firstReason ?? "valid_governance_boundary_projection",
    violation_paths: [...violations.keys()].sort(),
    metadata_only: true,
    read_only: true,
    raw_value_included: false,
  });
}

export function buildGovernanceBoundaryProjection(): GovernanceBoundaryProjection {
  return copyProjection(
    GovernanceBoundaryProjectionSchema,
    STATIC_GOVERNANCE_BOUNDARY_PROJECTION,
  );
}

export function buildGovernanceBoundaryStats(): GovernanceBoundaryStats {
  return copyProjection(
    GovernanceBoundaryStatsSchema,
    buildGovernanceBoundaryProjection().stats,
  );
}

export function listGovernanceBoundaryWarnings(): readonly GovernanceBoundaryWarning[] {
  return buildGovernanceBoundaryProjection().warnings.map((item) =>
    copyProjection(GovernanceBoundaryWarningSchema, item),
  );
}

export function listGovernanceBoundaryTripwires(): readonly GovernanceBoundaryTripwire[] {
  return buildGovernanceBoundaryProjection().tripwires.map((item) =>
    copyProjection(GovernanceBoundaryTripwireSchema, item),
  );
}
