import { z } from "zod";

export const ARCHITECTURE_GRAPH_CONTRACT_VERSION = "19A.1" as const;

export const ARCHITECTURE_GRAPH_NODE_KINDS = [
  "phase",
  "module",
  "adapter",
  "provider",
  "store",
  "ui_surface",
  "governance_boundary",
  "runtime_surface",
  "external_capability",
] as const;

export const ARCHITECTURE_GRAPH_EDGE_KINDS = [
  "depends_on",
  "reads_from",
  "writes_to",
  "gates",
  "observes",
  "dispatches_to",
  "projects_to",
  "renders",
  "forbidden",
] as const;

export const ARCHITECTURE_GRAPH_LAYERS = [
  "static_design",
  "observed_runtime",
  "governance",
  "discrepancy",
] as const;

export const ARCHITECTURE_GRAPH_HEALTH_STATUSES = [
  "unknown",
  "healthy",
  "attention",
  "degraded",
] as const;

export const ARCHITECTURE_GRAPH_DISCREPANCY_KINDS = [
  "designed_but_unobserved",
  "observed_but_undocumented",
  "forbidden_edge_observed",
  "missing_governance_boundary",
] as const;

export const ARCHITECTURE_GRAPH_GOVERNANCE_BOUNDARY_KINDS = [
  "approval_gate",
  "read_only_boundary",
  "redaction_boundary",
  "runtime_tripwire",
] as const;

export const ARCHITECTURE_GRAPH_FORBIDDEN_RAW_KEYS = [
  "executable_payload",
  "execution_payload",
  "action_payload",
  "tool_args",
  "tool_arguments",
  "raw_prompt",
  "prompt",
  "raw_model_output",
  "model_output",
  "raw_voice_transcript",
  "voice_transcript",
  "raw_ocr_text",
  "ocr_text",
  "raw_frame",
  "raw_frames",
  "frame",
  "frames",
  "secret",
  "secrets",
] as const;

export type ArchitectureGraphNodeKind =
  (typeof ARCHITECTURE_GRAPH_NODE_KINDS)[number];
export type ArchitectureGraphEdgeKind =
  (typeof ARCHITECTURE_GRAPH_EDGE_KINDS)[number];
export type ArchitectureGraphLayer = (typeof ARCHITECTURE_GRAPH_LAYERS)[number];
export type ArchitectureGraphHealthStatus =
  (typeof ARCHITECTURE_GRAPH_HEALTH_STATUSES)[number];
export type ArchitectureGraphDiscrepancyKind =
  (typeof ARCHITECTURE_GRAPH_DISCREPANCY_KINDS)[number];
export type ArchitectureGraphGovernanceBoundaryKind =
  (typeof ARCHITECTURE_GRAPH_GOVERNANCE_BOUNDARY_KINDS)[number];

export const ArchitectureGraphNodeKindSchema = z.enum(
  ARCHITECTURE_GRAPH_NODE_KINDS,
);
export const ArchitectureGraphEdgeKindSchema = z.enum(
  ARCHITECTURE_GRAPH_EDGE_KINDS,
);
export const ArchitectureGraphLayerSchema = z.enum(ARCHITECTURE_GRAPH_LAYERS);
export const ArchitectureGraphHealthStatusSchema = z.enum(
  ARCHITECTURE_GRAPH_HEALTH_STATUSES,
);
export const ArchitectureGraphDiscrepancyKindSchema = z.enum(
  ARCHITECTURE_GRAPH_DISCREPANCY_KINDS,
);
export const ArchitectureGraphGovernanceBoundaryKindSchema = z.enum(
  ARCHITECTURE_GRAPH_GOVERNANCE_BOUNDARY_KINDS,
);

export const ArchitectureGraphHealthSchema = z.strictObject({
  status: ArchitectureGraphHealthStatusSchema,
  summary: z.string().trim().min(1).max(240),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const ArchitectureGraphActivitySummarySchema = z.strictObject({
  observed_call_count: z.number().int().nonnegative(),
  observed_write_count: z.literal(0),
  observed_dispatch_count: z.literal(0),
  observed_execution_count: z.literal(0),
  last_observed_at_ms: z.number().int().nonnegative().nullable(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  raw_event_payload_included: z.literal(false),
  telemetry_ingested: z.literal(false),
});

export const ArchitectureGraphNodeSchema = z.strictObject({
  node_id: z
    .string()
    .trim()
    .regex(/^arch-node:[a-z0-9._:-]+$/),
  label: z.string().trim().min(1).max(160),
  kind: ArchitectureGraphNodeKindSchema,
  layer: ArchitectureGraphLayerSchema,
  phase_ref: z.string().trim().min(1).max(32).nullable(),
  health: ArchitectureGraphHealthSchema,
  activity_summary: ArchitectureGraphActivitySummarySchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  executable_payload_included: z.literal(false),
  tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_voice_transcript_included: z.literal(false),
  raw_ocr_text_included: z.literal(false),
  raw_frame_included: z.literal(false),
  secret_material_included: z.literal(false),
  authority_surface_created: z.literal(false),
  execution_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
});

export const ArchitectureGraphEdgeSchema = z.strictObject({
  edge_id: z
    .string()
    .trim()
    .regex(/^arch-edge:[a-z0-9._:-]+$/),
  from_node_id: z
    .string()
    .trim()
    .regex(/^arch-node:[a-z0-9._:-]+$/),
  to_node_id: z
    .string()
    .trim()
    .regex(/^arch-node:[a-z0-9._:-]+$/),
  kind: ArchitectureGraphEdgeKindSchema,
  layer: ArchitectureGraphLayerSchema,
  label: z.string().trim().min(1).max(180),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  executable_action_enabled: z.literal(false),
  dispatch_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
  authority_grant_enabled: z.literal(false),
  forbidden_edge_tripwire_only: z.boolean(),
  forbidden_edge_executes: z.literal(false),
  raw_payload_included: z.literal(false),
  tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_voice_transcript_included: z.literal(false),
  raw_ocr_text_included: z.literal(false),
  raw_frame_included: z.literal(false),
  secret_material_included: z.literal(false),
});

export const ArchitectureGraphDiscrepancySchema = z.strictObject({
  discrepancy_id: z
    .string()
    .trim()
    .regex(/^arch-discrepancy:[a-z0-9._:-]+$/),
  kind: ArchitectureGraphDiscrepancyKindSchema,
  node_id: z
    .string()
    .trim()
    .regex(/^arch-node:[a-z0-9._:-]+$/)
    .nullable(),
  edge_id: z
    .string()
    .trim()
    .regex(/^arch-edge:[a-z0-9._:-]+$/)
    .nullable(),
  summary: z.string().trim().min(1).max(240),
  layer: z.literal("discrepancy"),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  creates_runtime_observer: z.literal(false),
  executes_remediation: z.literal(false),
});

export const ArchitectureGraphGovernanceBoundarySchema = z.strictObject({
  boundary_id: z
    .string()
    .trim()
    .regex(/^arch-boundary:[a-z0-9._:-]+$/),
  label: z.string().trim().min(1).max(160),
  kind: ArchitectureGraphGovernanceBoundaryKindSchema,
  governed_node_ids: z.array(
    z
      .string()
      .trim()
      .regex(/^arch-node:[a-z0-9._:-]+$/),
  ),
  governed_edge_ids: z.array(
    z
      .string()
      .trim()
      .regex(/^arch-edge:[a-z0-9._:-]+$/),
  ),
  layer: z.literal("governance"),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  approval_required_for_side_effects: z.literal(true),
  authority_grant_enabled: z.literal(false),
  execution_enabled: z.literal(false),
  dispatch_enabled: z.literal(false),
  mutation_enabled: z.literal(false),
});

export const ArchitectureGraphSchema = z.strictObject({
  contract_version: z.literal(ARCHITECTURE_GRAPH_CONTRACT_VERSION),
  graph_id: z
    .string()
    .trim()
    .regex(/^architecture-graph:[a-z0-9._:-]+$/),
  generated_from: z.enum(["static_fixture", "metadata_projection"]),
  created_at_source: z.literal("contract_metadata"),
  layers: z.array(ArchitectureGraphLayerSchema).min(1),
  nodes: z.array(ArchitectureGraphNodeSchema).min(1),
  edges: z.array(ArchitectureGraphEdgeSchema),
  discrepancies: z.array(ArchitectureGraphDiscrepancySchema),
  governance_boundaries: z.array(ArchitectureGraphGovernanceBoundarySchema),
  health: ArchitectureGraphHealthSchema,
  activity_summary: ArchitectureGraphActivitySummarySchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  source_imports_parsed: z.literal(false),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  telemetry_ingested: z.literal(false),
  runtime_observers_created: z.literal(false),
  ui_rendered: z.literal(false),
  executable_payload_included: z.literal(false),
  tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_voice_transcript_included: z.literal(false),
  raw_ocr_text_included: z.literal(false),
  raw_frame_included: z.literal(false),
  secret_material_included: z.literal(false),
  approval_boundary_weakened: z.literal(false),
  authority_surface_created: z.literal(false),
  execution_enabled: z.literal(false),
  retry_enabled: z.literal(false),
  approve_enabled: z.literal(false),
  run_enabled: z.literal(false),
  mutate_enabled: z.literal(false),
  dispatch_enabled: z.literal(false),
});

export const ArchitectureGraphValidationReasonSchema = z.enum([
  "valid_architecture_graph_metadata",
  "invalid_graph_shape",
  "duplicate_node_id",
  "duplicate_edge_id",
  "missing_node_reference",
  "forbidden_raw_field",
  "executable_payload_present",
  "edge_declares_executable_action",
  "forbidden_edge_not_tripwire_metadata",
]);

export const ArchitectureGraphValidationResultSchema = z.strictObject({
  valid: z.boolean(),
  reason: ArchitectureGraphValidationReasonSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  checked_at_source: z.literal("architecture_graph_contract_validator"),
  filesystem_read: z.literal(false),
  database_read: z.literal(false),
  telemetry_ingested: z.literal(false),
  runtime_observer_created: z.literal(false),
  executable_payload_included: z.literal(false),
  tool_arguments_included: z.literal(false),
  raw_prompt_included: z.literal(false),
  raw_model_output_included: z.literal(false),
  raw_voice_transcript_included: z.literal(false),
  raw_ocr_text_included: z.literal(false),
  raw_frame_included: z.literal(false),
  secret_material_included: z.literal(false),
  action_executed: z.literal(false),
  dispatch_performed: z.literal(false),
  mutation_performed: z.literal(false),
  authority_surface_created: z.literal(false),
});

export type ArchitectureGraphHealth = z.infer<
  typeof ArchitectureGraphHealthSchema
>;
export type ArchitectureGraphActivitySummary = z.infer<
  typeof ArchitectureGraphActivitySummarySchema
>;
export type ArchitectureGraphNode = z.infer<typeof ArchitectureGraphNodeSchema>;
export type ArchitectureGraphEdge = z.infer<typeof ArchitectureGraphEdgeSchema>;
export type ArchitectureGraphDiscrepancy = z.infer<
  typeof ArchitectureGraphDiscrepancySchema
>;
export type ArchitectureGraphGovernanceBoundary = z.infer<
  typeof ArchitectureGraphGovernanceBoundarySchema
>;
export type ArchitectureGraph = z.infer<typeof ArchitectureGraphSchema>;
export type ArchitectureGraphValidationResult = z.infer<
  typeof ArchitectureGraphValidationResultSchema
>;

function validationResult(input: {
  readonly valid: boolean;
  readonly reason: z.infer<typeof ArchitectureGraphValidationReasonSchema>;
}): ArchitectureGraphValidationResult {
  return ArchitectureGraphValidationResultSchema.parse({
    valid: input.valid,
    reason: input.reason,
    metadata_only: true,
    read_only: true,
    checked_at_source: "architecture_graph_contract_validator",
    filesystem_read: false,
    database_read: false,
    telemetry_ingested: false,
    runtime_observer_created: false,
    executable_payload_included: false,
    tool_arguments_included: false,
    raw_prompt_included: false,
    raw_model_output_included: false,
    raw_voice_transcript_included: false,
    raw_ocr_text_included: false,
    raw_frame_included: false,
    secret_material_included: false,
    action_executed: false,
    dispatch_performed: false,
    mutation_performed: false,
    authority_surface_created: false,
  });
}

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

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function hasForbiddenRawKey(input: unknown): boolean {
  const forbiddenKeys = new Set<string>(ARCHITECTURE_GRAPH_FORBIDDEN_RAW_KEYS);
  return collectKeys(input).some((key) => forbiddenKeys.has(key));
}

function hasExecutablePayloadMarker(input: unknown): boolean {
  if (!input || typeof input !== "object") {
    return false;
  }

  const record = input as Record<string, unknown>;
  return (
    record.executable_payload_included === true ||
    record.execution_enabled === true ||
    record.executable_action_enabled === true ||
    record.dispatch_enabled === true ||
    record.mutation_enabled === true ||
    Object.values(record).some(hasExecutablePayloadMarker)
  );
}

function edgeDeclaresExecutableAction(edge: ArchitectureGraphEdge): boolean {
  return (
    edge.executable_action_enabled ||
    edge.dispatch_enabled ||
    edge.mutation_enabled ||
    edge.authority_grant_enabled
  );
}

function forbiddenEdgeIsInertTripwire(edge: ArchitectureGraphEdge): boolean {
  if (edge.kind !== "forbidden") {
    return true;
  }

  return edge.forbidden_edge_tripwire_only && !edge.forbidden_edge_executes;
}

export function validateArchitectureGraphMetadata(
  input: unknown,
): ArchitectureGraphValidationResult {
  if (hasForbiddenRawKey(input)) {
    return validationResult({
      valid: false,
      reason: "forbidden_raw_field",
    });
  }

  if (hasExecutablePayloadMarker(input)) {
    return validationResult({
      valid: false,
      reason: "executable_payload_present",
    });
  }

  const parsed = ArchitectureGraphSchema.safeParse(input);
  if (!parsed.success) {
    return validationResult({
      valid: false,
      reason: "invalid_graph_shape",
    });
  }

  const nodeIds = parsed.data.nodes.map((node) => node.node_id);
  if (hasDuplicate(nodeIds)) {
    return validationResult({
      valid: false,
      reason: "duplicate_node_id",
    });
  }

  const edgeIds = parsed.data.edges.map((edge) => edge.edge_id);
  if (hasDuplicate(edgeIds)) {
    return validationResult({
      valid: false,
      reason: "duplicate_edge_id",
    });
  }

  const nodeIdSet = new Set(nodeIds);
  const hasMissingEdgeNode = parsed.data.edges.some(
    (edge) =>
      !nodeIdSet.has(edge.from_node_id) || !nodeIdSet.has(edge.to_node_id),
  );
  const hasMissingBoundaryNode = parsed.data.governance_boundaries
    .flatMap((boundary) => boundary.governed_node_ids)
    .some((nodeId) => !nodeIdSet.has(nodeId));
  if (hasMissingEdgeNode || hasMissingBoundaryNode) {
    return validationResult({
      valid: false,
      reason: "missing_node_reference",
    });
  }

  const edgeIdSet = new Set(edgeIds);
  const hasMissingBoundaryEdge = parsed.data.governance_boundaries
    .flatMap((boundary) => boundary.governed_edge_ids)
    .some((edgeId) => !edgeIdSet.has(edgeId));
  const hasMissingDiscrepancyEdge = parsed.data.discrepancies.some(
    (discrepancy) =>
      discrepancy.edge_id !== null && !edgeIdSet.has(discrepancy.edge_id),
  );
  const hasMissingDiscrepancyNode = parsed.data.discrepancies.some(
    (discrepancy) =>
      discrepancy.node_id !== null && !nodeIdSet.has(discrepancy.node_id),
  );
  if (
    hasMissingBoundaryEdge ||
    hasMissingDiscrepancyEdge ||
    hasMissingDiscrepancyNode
  ) {
    return validationResult({
      valid: false,
      reason: "missing_node_reference",
    });
  }

  if (parsed.data.edges.some(edgeDeclaresExecutableAction)) {
    return validationResult({
      valid: false,
      reason: "edge_declares_executable_action",
    });
  }

  if (!parsed.data.edges.every(forbiddenEdgeIsInertTripwire)) {
    return validationResult({
      valid: false,
      reason: "forbidden_edge_not_tripwire_metadata",
    });
  }

  return validationResult({
    valid: true,
    reason: "valid_architecture_graph_metadata",
  });
}
