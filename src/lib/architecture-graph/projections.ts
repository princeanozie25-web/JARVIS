import { z } from "zod";

import {
  ArchitectureGraphEdgeKindSchema,
  ArchitectureGraphHealthStatusSchema,
  ArchitectureGraphLayerSchema,
  ArchitectureGraphNodeKindSchema,
  type ArchitectureGraph,
  type ArchitectureGraphEdge,
  type ArchitectureGraphNode,
  validateArchitectureGraphMetadata,
} from "./contracts";
import {
  getArchitectureGraphEdgesForNode,
  getArchitectureGraphNodeById,
  getStaticArchitectureGraph,
} from "./static-registry";
import { summarizeArchitectureNode } from "./queries";

export const ARCHITECTURE_GRAPH_PROJECTION_CONTRACT_VERSION = "19A.4" as const;

export const ARCHITECTURE_GRAPH_PROJECTION_GROUPS = [
  "phases",
  "data",
  "runtime",
  "governance",
  "surfaces",
  "modules",
  "adapters",
] as const;

export const ARCHITECTURE_GRAPH_PROJECTION_STYLE_TOKENS = [
  "solid",
  "read",
  "write",
  "guarded",
  "tripwire",
] as const;

export const ARCHITECTURE_GRAPH_PROJECTION_POLICY_STATUSES = [
  "normal",
  "governed",
  "tripwire",
] as const;

export const ArchitectureGraphProjectionGroupIdSchema = z.enum(
  ARCHITECTURE_GRAPH_PROJECTION_GROUPS,
);
export const ArchitectureGraphProjectionStyleTokenSchema = z.enum(
  ARCHITECTURE_GRAPH_PROJECTION_STYLE_TOKENS,
);
export const ArchitectureGraphProjectionPolicyStatusSchema = z.enum(
  ARCHITECTURE_GRAPH_PROJECTION_POLICY_STATUSES,
);

const ProjectionNodeIdSchema = z
  .string()
  .trim()
  .regex(/^arch-node:[a-z0-9._:-]+$/);
const ProjectionEdgeIdSchema = z
  .string()
  .trim()
  .regex(/^arch-edge:[a-z0-9._:-]+$/);

export const ArchitectureGraphProjectionActivitySummarySchema = z.strictObject({
  observed_call_count: z.number().int().nonnegative(),
  observed_write_count: z.literal(0),
  observed_dispatch_count: z.literal(0),
  observed_execution_count: z.literal(0),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const ArchitectureGraphProjectionNodeSchema = z.strictObject({
  id: ProjectionNodeIdSchema,
  label: z.string().trim().min(1).max(160),
  kind: ArchitectureGraphNodeKindSchema,
  phase_id: z.string().trim().min(1).max(32).nullable(),
  subsystem_id: z.string().trim().min(1).max(120),
  health: ArchitectureGraphHealthStatusSchema,
  activity_summary: ArchitectureGraphProjectionActivitySummarySchema,
  inbound_edge_count: z.number().int().nonnegative(),
  outbound_edge_count: z.number().int().nonnegative(),
  governance_edge_count: z.number().int().nonnegative(),
  forbidden_edge_count: z.number().int().nonnegative(),
  read_edge_count: z.number().int().nonnegative(),
  write_edge_count: z.number().int().nonnegative(),
  display_group: ArchitectureGraphProjectionGroupIdSchema,
  tags: z.array(z.string().trim().min(1).max(80)),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  ui_safe: z.literal(true),
});

export const ArchitectureGraphProjectionEdgeSchema = z.strictObject({
  id: ProjectionEdgeIdSchema,
  from: ProjectionNodeIdSchema,
  to: ProjectionNodeIdSchema,
  kind: ArchitectureGraphEdgeKindSchema,
  layer: ArchitectureGraphLayerSchema,
  policy_status: ArchitectureGraphProjectionPolicyStatusSchema,
  tripwire: z.boolean(),
  label: z.string().trim().min(1).max(180),
  display_style_token: ArchitectureGraphProjectionStyleTokenSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  ui_safe: z.literal(true),
});

export const ArchitectureGraphProjectionGroupSchema = z.strictObject({
  id: ArchitectureGraphProjectionGroupIdSchema,
  label: z.string().trim().min(1).max(80),
  node_ids: z.array(ProjectionNodeIdSchema),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const ArchitectureGraphProjectionLegendSchema = z.strictObject({
  edge_kind: ArchitectureGraphEdgeKindSchema,
  label: z.string().trim().min(1).max(120),
  display_style_token: ArchitectureGraphProjectionStyleTokenSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const ArchitectureGraphProjectionWarningSchema = z.strictObject({
  id: z
    .string()
    .trim()
    .regex(/^arch-warning:[a-z0-9._:-]+$/),
  edge_id: ProjectionEdgeIdSchema,
  from: ProjectionNodeIdSchema,
  to: ProjectionNodeIdSchema,
  label: z.string().trim().min(1).max(180),
  policy_status: z.literal("tripwire"),
  severity: z.literal("warning"),
  tripwire: z.literal(true),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const ArchitectureGraphProjectionStatsSchema = z.strictObject({
  node_count: z.number().int().nonnegative(),
  edge_count: z.number().int().nonnegative(),
  forbidden_edge_count: z.number().int().nonnegative(),
  governance_edge_count: z.number().int().nonnegative(),
  read_edge_count: z.number().int().nonnegative(),
  write_edge_count: z.number().int().nonnegative(),
  static_edge_count: z.number().int().nonnegative(),
  observed_edge_count: z.number().int().nonnegative(),
  discrepancy_count: z.number().int().nonnegative(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export const ArchitectureGraphProjectionSchema = z.strictObject({
  contract_version: z.literal(ARCHITECTURE_GRAPH_PROJECTION_CONTRACT_VERSION),
  projection_id: z
    .string()
    .trim()
    .regex(/^architecture-graph-projection:[a-z0-9._:-]+$/),
  graph_id: z
    .string()
    .trim()
    .regex(/^architecture-graph:[a-z0-9._:-]+$/),
  scope: z.enum(["full_graph", "node_focus"]),
  focus_node_id: ProjectionNodeIdSchema.nullable(),
  nodes: z.array(ArchitectureGraphProjectionNodeSchema),
  edges: z.array(ArchitectureGraphProjectionEdgeSchema),
  groups: z.array(ArchitectureGraphProjectionGroupSchema),
  legend: z.array(ArchitectureGraphProjectionLegendSchema),
  warnings: z.array(ArchitectureGraphProjectionWarningSchema),
  stats: ArchitectureGraphProjectionStatsSchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  ui_safe: z.literal(true),
  underlying_graph_validated: z.literal(true),
  raw_fields_exposed: z.literal(false),
  action_affordances_exposed: z.literal(false),
});

export type ArchitectureGraphProjectionActivitySummary = z.infer<
  typeof ArchitectureGraphProjectionActivitySummarySchema
>;
export type ArchitectureGraphProjectionNode = z.infer<
  typeof ArchitectureGraphProjectionNodeSchema
>;
export type ArchitectureGraphProjectionEdge = z.infer<
  typeof ArchitectureGraphProjectionEdgeSchema
>;
export type ArchitectureGraphProjectionGroup = z.infer<
  typeof ArchitectureGraphProjectionGroupSchema
>;
export type ArchitectureGraphProjectionLegend = z.infer<
  typeof ArchitectureGraphProjectionLegendSchema
>;
export type ArchitectureGraphProjectionWarning = z.infer<
  typeof ArchitectureGraphProjectionWarningSchema
>;
export type ArchitectureGraphProjectionStats = z.infer<
  typeof ArchitectureGraphProjectionStatsSchema
>;
export type ArchitectureGraphProjection = z.infer<
  typeof ArchitectureGraphProjectionSchema
>;

function copyProjection<T>(schema: z.ZodType<T>, value: T): T {
  return schema.parse(JSON.parse(JSON.stringify(value)));
}

function assertValidGraph(graph: ArchitectureGraph): void {
  const validation = validateArchitectureGraphMetadata(graph);
  if (!validation.valid) {
    throw new Error(
      `Invalid architecture graph metadata: ${validation.reason}`,
    );
  }
}

function subsystemId(nodeId: string): string {
  return nodeId.replace(/^arch-node:/, "");
}

function displayGroupForNode(
  node: ArchitectureGraphNode,
): z.infer<typeof ArchitectureGraphProjectionGroupIdSchema> {
  if (node.kind === "phase") {
    return "phases";
  }
  if (node.kind === "store") {
    return "data";
  }
  if (node.kind === "runtime_surface") {
    return "runtime";
  }
  if (node.kind === "governance_boundary") {
    return "governance";
  }
  if (node.kind === "ui_surface") {
    return "surfaces";
  }
  if (node.kind === "adapter" || node.kind === "provider") {
    return "adapters";
  }

  return "modules";
}

function styleForEdge(
  edge: ArchitectureGraphEdge,
): z.infer<typeof ArchitectureGraphProjectionStyleTokenSchema> {
  if (edge.kind === "forbidden") {
    return "tripwire";
  }
  if (edge.kind === "gates") {
    return "guarded";
  }
  if (edge.kind === "reads_from") {
    return "read";
  }
  if (edge.kind === "writes_to") {
    return "write";
  }

  return "solid";
}

function policyStatusForEdge(
  edge: ArchitectureGraphEdge,
): z.infer<typeof ArchitectureGraphProjectionPolicyStatusSchema> {
  if (edge.kind === "forbidden") {
    return "tripwire";
  }
  if (edge.layer === "governance" || edge.kind === "gates") {
    return "governed";
  }

  return "normal";
}

function projectNode(
  node: ArchitectureGraphNode,
): ArchitectureGraphProjectionNode {
  const summary = summarizeArchitectureNode(node.node_id);
  if (!summary) {
    throw new Error(`Missing architecture node summary: ${node.node_id}`);
  }

  return ArchitectureGraphProjectionNodeSchema.parse({
    id: node.node_id,
    label: node.label,
    kind: node.kind,
    phase_id: node.phase_ref,
    subsystem_id: subsystemId(node.node_id),
    health: summary.health.status,
    activity_summary: {
      observed_call_count: summary.recent_activity_summary.observed_call_count,
      observed_write_count: 0,
      observed_dispatch_count: 0,
      observed_execution_count: 0,
      metadata_only: true,
      read_only: true,
    },
    inbound_edge_count: summary.inbound_edge_count,
    outbound_edge_count: summary.outbound_edge_count,
    governance_edge_count: summary.governance_edge_count,
    forbidden_edge_count: summary.forbidden_edge_count,
    read_edge_count: summary.read_edge_count,
    write_edge_count: summary.write_edge_count,
    display_group: displayGroupForNode(node),
    tags: [
      `kind:${node.kind}`,
      `layer:${node.layer}`,
      ...(node.phase_ref ? [`phase:${node.phase_ref}`] : []),
    ],
    metadata_only: true,
    read_only: true,
    ui_safe: true,
  });
}

function projectEdge(
  edge: ArchitectureGraphEdge,
): ArchitectureGraphProjectionEdge {
  return ArchitectureGraphProjectionEdgeSchema.parse({
    id: edge.edge_id,
    from: edge.from_node_id,
    to: edge.to_node_id,
    kind: edge.kind,
    layer: edge.layer,
    policy_status: policyStatusForEdge(edge),
    tripwire: edge.kind === "forbidden",
    label: edge.label,
    display_style_token: styleForEdge(edge),
    metadata_only: true,
    read_only: true,
    ui_safe: true,
  });
}

function groupLabel(
  groupId: z.infer<typeof ArchitectureGraphProjectionGroupIdSchema>,
): string {
  switch (groupId) {
    case "phases":
      return "Phases";
    case "data":
      return "Data";
    case "runtime":
      return "Runtime";
    case "governance":
      return "Governance";
    case "surfaces":
      return "Surfaces";
    case "modules":
      return "Modules";
    case "adapters":
      return "Adapters";
  }
}

function buildGroups(
  nodes: readonly ArchitectureGraphProjectionNode[],
): readonly ArchitectureGraphProjectionGroup[] {
  return ARCHITECTURE_GRAPH_PROJECTION_GROUPS.map((groupId) =>
    ArchitectureGraphProjectionGroupSchema.parse({
      id: groupId,
      label: groupLabel(groupId),
      node_ids: nodes
        .filter((node) => node.display_group === groupId)
        .map((node) => node.id),
      metadata_only: true,
      read_only: true,
    }),
  ).filter((group) => group.node_ids.length > 0);
}

function buildLegend(): readonly ArchitectureGraphProjectionLegend[] {
  return [
    ["depends_on", "Depends on", "solid"],
    ["reads_from", "Reads from", "read"],
    ["writes_to", "Writes to", "write"],
    ["gates", "Governance gate", "guarded"],
    ["observes", "Observes", "solid"],
    ["dispatches_to", "Dispatches to", "solid"],
    ["projects_to", "Projects to", "solid"],
    ["renders", "Renders", "solid"],
    ["forbidden", "Forbidden tripwire", "tripwire"],
  ].map(([edge_kind, label, display_style_token]) =>
    ArchitectureGraphProjectionLegendSchema.parse({
      edge_kind,
      label,
      display_style_token,
      metadata_only: true,
      read_only: true,
    }),
  );
}

function warningId(edgeId: string): `arch-warning:${string}` {
  return `arch-warning:${edgeId.replace(/^arch-edge:/, "")}`;
}

function buildWarnings(
  edges: readonly ArchitectureGraphEdge[],
): readonly ArchitectureGraphProjectionWarning[] {
  return edges
    .filter((edge) => edge.kind === "forbidden")
    .map((edge) =>
      ArchitectureGraphProjectionWarningSchema.parse({
        id: warningId(edge.edge_id),
        edge_id: edge.edge_id,
        from: edge.from_node_id,
        to: edge.to_node_id,
        label: edge.label,
        policy_status: "tripwire",
        severity: "warning",
        tripwire: true,
        metadata_only: true,
        read_only: true,
      }),
    );
}

function buildStatsFromGraph(graph: {
  readonly nodes: readonly ArchitectureGraphNode[];
  readonly edges: readonly ArchitectureGraphEdge[];
  readonly discrepancies: readonly ArchitectureGraph["discrepancies"][number][];
}): ArchitectureGraphProjectionStats {
  return ArchitectureGraphProjectionStatsSchema.parse({
    node_count: graph.nodes.length,
    edge_count: graph.edges.length,
    forbidden_edge_count: graph.edges.filter(
      (edge) => edge.kind === "forbidden",
    ).length,
    governance_edge_count: graph.edges.filter(
      (edge) => edge.layer === "governance",
    ).length,
    read_edge_count: graph.edges.filter((edge) => edge.kind === "reads_from")
      .length,
    write_edge_count: graph.edges.filter((edge) => edge.kind === "writes_to")
      .length,
    static_edge_count: graph.edges.filter(
      (edge) => edge.layer === "static_design",
    ).length,
    observed_edge_count: graph.edges.filter(
      (edge) => edge.layer === "observed_runtime",
    ).length,
    discrepancy_count: graph.discrepancies.length,
    metadata_only: true,
    read_only: true,
  });
}

function buildProjection(input: {
  readonly graph: ArchitectureGraph;
  readonly nodes: readonly ArchitectureGraphNode[];
  readonly edges: readonly ArchitectureGraphEdge[];
  readonly scope: "full_graph" | "node_focus";
  readonly focus_node_id: string | null;
  readonly projection_id: `architecture-graph-projection:${string}`;
}): ArchitectureGraphProjection {
  const projectionNodes = input.nodes.map(projectNode);
  const projectionEdges = input.edges.map(projectEdge);

  return ArchitectureGraphProjectionSchema.parse({
    contract_version: ARCHITECTURE_GRAPH_PROJECTION_CONTRACT_VERSION,
    projection_id: input.projection_id,
    graph_id: input.graph.graph_id,
    scope: input.scope,
    focus_node_id: input.focus_node_id,
    nodes: projectionNodes,
    edges: projectionEdges,
    groups: buildGroups(projectionNodes),
    legend: buildLegend(),
    warnings: buildWarnings(input.edges),
    stats: buildStatsFromGraph({
      nodes: input.nodes,
      edges: input.edges,
      discrepancies: input.graph.discrepancies,
    }),
    metadata_only: true,
    read_only: true,
    ui_safe: true,
    underlying_graph_validated: true,
    raw_fields_exposed: false,
    action_affordances_exposed: false,
  });
}

export function buildArchitectureGraphProjection(): ArchitectureGraphProjection {
  const graph = getStaticArchitectureGraph();
  assertValidGraph(graph);

  return copyProjection(
    ArchitectureGraphProjectionSchema,
    buildProjection({
      graph,
      nodes: graph.nodes,
      edges: graph.edges,
      scope: "full_graph",
      focus_node_id: null,
      projection_id: "architecture-graph-projection:static-full",
    }),
  );
}

export function buildArchitectureGraphProjectionForNode(
  nodeId: string,
): ArchitectureGraphProjection | null {
  const graph = getStaticArchitectureGraph();
  assertValidGraph(graph);

  const focusNode = getArchitectureGraphNodeById(
    nodeId as ArchitectureGraphNode["node_id"],
  );
  if (!focusNode) {
    return null;
  }

  const adjacentEdges = getArchitectureGraphEdgesForNode(focusNode.node_id);
  const adjacentNodeIds = new Set<string>([focusNode.node_id]);
  for (const edge of adjacentEdges) {
    adjacentNodeIds.add(edge.from_node_id);
    adjacentNodeIds.add(edge.to_node_id);
  }

  const nodes = graph.nodes.filter((node) => adjacentNodeIds.has(node.node_id));
  const edgeIds = new Set(adjacentEdges.map((edge) => edge.edge_id));
  const edges = graph.edges.filter((edge) => edgeIds.has(edge.edge_id));

  return copyProjection(
    ArchitectureGraphProjectionSchema,
    buildProjection({
      graph,
      nodes,
      edges,
      scope: "node_focus",
      focus_node_id: focusNode.node_id,
      projection_id: `architecture-graph-projection:node-${subsystemId(
        focusNode.node_id,
      )}`,
    }),
  );
}

export function buildArchitectureGraphProjectionStats(): ArchitectureGraphProjectionStats {
  return copyProjection(
    ArchitectureGraphProjectionStatsSchema,
    buildArchitectureGraphProjection().stats,
  );
}

export function listArchitectureGraphProjectionWarnings(): readonly ArchitectureGraphProjectionWarning[] {
  return buildArchitectureGraphProjection().warnings.map((warning) =>
    copyProjection(ArchitectureGraphProjectionWarningSchema, warning),
  );
}
