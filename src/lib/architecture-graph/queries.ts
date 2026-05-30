import { z } from "zod";

import {
  ArchitectureGraphActivitySummarySchema,
  ArchitectureGraphEdgeSchema,
  ArchitectureGraphHealthSchema,
  ArchitectureGraphNodeSchema,
  type ArchitectureGraphActivitySummary,
  type ArchitectureGraphEdge,
  type ArchitectureGraphHealth,
  type ArchitectureGraphNode,
} from "./contracts";
import {
  getArchitectureGraphNodeById,
  getStaticArchitectureGraph,
} from "./static-registry";

const ARCHITECTURE_GRAPH_MAX_PATH_DEPTH = 8 as const;
const ARCHITECTURE_GRAPH_DEFAULT_PATH_DEPTH = 6 as const;

const ArchitectureGraphNodeIdSchema = z
  .string()
  .trim()
  .regex(/^arch-node:[a-z0-9._:-]+$/);
const ArchitectureGraphEdgeIdSchema = z
  .string()
  .trim()
  .regex(/^arch-edge:[a-z0-9._:-]+$/);

export const ArchitectureGraphPathResultSchema = z.strictObject({
  found: z.boolean(),
  from_node_id: z.string().trim().min(1).max(160),
  to_node_id: z.string().trim().min(1).max(160),
  node_ids: z.array(ArchitectureGraphNodeIdSchema),
  edge_ids: z.array(ArchitectureGraphEdgeIdSchema),
  max_depth: z
    .number()
    .int()
    .nonnegative()
    .max(ARCHITECTURE_GRAPH_MAX_PATH_DEPTH),
  forbidden_edges_included: z.boolean(),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  bounded: z.literal(true),
  executable_payload_included: z.literal(false),
  action_executed: z.literal(false),
  dispatch_performed: z.literal(false),
  mutation_performed: z.literal(false),
  authority_surface_created: z.literal(false),
});

export const ArchitectureGraphNodeSummarySchema = z.strictObject({
  node: ArchitectureGraphNodeSchema,
  inbound_edge_count: z.number().int().nonnegative(),
  outbound_edge_count: z.number().int().nonnegative(),
  dependency_count: z.number().int().nonnegative(),
  dependent_count: z.number().int().nonnegative(),
  forbidden_edge_count: z.number().int().nonnegative(),
  governance_edge_count: z.number().int().nonnegative(),
  read_edge_count: z.number().int().nonnegative(),
  write_edge_count: z.number().int().nonnegative(),
  health: ArchitectureGraphHealthSchema,
  recent_activity_summary: ArchitectureGraphActivitySummarySchema,
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  execution_inferred: z.literal(false),
  executable_payload_included: z.literal(false),
  action_executed: z.literal(false),
  dispatch_performed: z.literal(false),
  mutation_performed: z.literal(false),
});

export type ArchitectureGraphPathResult = z.infer<
  typeof ArchitectureGraphPathResultSchema
>;
export type ArchitectureGraphNodeSummary = z.infer<
  typeof ArchitectureGraphNodeSummarySchema
>;

function copyNode(node: ArchitectureGraphNode): ArchitectureGraphNode {
  return ArchitectureGraphNodeSchema.parse(JSON.parse(JSON.stringify(node)));
}

function copyEdge(edge: ArchitectureGraphEdge): ArchitectureGraphEdge {
  return ArchitectureGraphEdgeSchema.parse(JSON.parse(JSON.stringify(edge)));
}

function copyHealth(health: ArchitectureGraphHealth): ArchitectureGraphHealth {
  return ArchitectureGraphHealthSchema.parse(
    JSON.parse(JSON.stringify(health)),
  );
}

function copyActivity(
  activity: ArchitectureGraphActivitySummary,
): ArchitectureGraphActivitySummary {
  return ArchitectureGraphActivitySummarySchema.parse(
    JSON.parse(JSON.stringify(activity)),
  );
}

function knownNode(id: string): ArchitectureGraphNode | null {
  return getArchitectureGraphNodeById(id as ArchitectureGraphNode["node_id"]);
}

function edgesForNode(id: string): readonly ArchitectureGraphEdge[] {
  if (!knownNode(id)) {
    return [];
  }

  return getStaticArchitectureGraph()
    .edges.filter((edge) => edge.from_node_id === id || edge.to_node_id === id)
    .map(copyEdge);
}

function outboundEdgesForNode(id: string): readonly ArchitectureGraphEdge[] {
  if (!knownNode(id)) {
    return [];
  }

  return getStaticArchitectureGraph()
    .edges.filter((edge) => edge.from_node_id === id)
    .map(copyEdge);
}

function inboundEdgesForNode(id: string): readonly ArchitectureGraphEdge[] {
  if (!knownNode(id)) {
    return [];
  }

  return getStaticArchitectureGraph()
    .edges.filter((edge) => edge.to_node_id === id)
    .map(copyEdge);
}

function nodesByIds(ids: readonly string[]): readonly ArchitectureGraphNode[] {
  const graph = getStaticArchitectureGraph();
  const nodeMap = new Map(graph.nodes.map((node) => [node.node_id, node]));

  return ids
    .map((id) => nodeMap.get(id))
    .filter((node): node is ArchitectureGraphNode => !!node)
    .map(copyNode);
}

function pathResult(input: {
  readonly found: boolean;
  readonly from_node_id: string;
  readonly to_node_id: string;
  readonly node_ids: readonly string[];
  readonly edge_ids: readonly string[];
  readonly max_depth: number;
  readonly forbidden_edges_included: boolean;
}): ArchitectureGraphPathResult {
  return ArchitectureGraphPathResultSchema.parse({
    found: input.found,
    from_node_id: input.from_node_id,
    to_node_id: input.to_node_id,
    node_ids: input.node_ids,
    edge_ids: input.edge_ids,
    max_depth: input.max_depth,
    forbidden_edges_included: input.forbidden_edges_included,
    metadata_only: true,
    read_only: true,
    bounded: true,
    executable_payload_included: false,
    action_executed: false,
    dispatch_performed: false,
    mutation_performed: false,
    authority_surface_created: false,
  });
}

export function getArchitectureNodeDependencies(
  nodeId: string,
): readonly ArchitectureGraphNode[] {
  const targetIds = outboundEdgesForNode(nodeId)
    .filter((edge) => edge.kind !== "forbidden")
    .map((edge) => edge.to_node_id);

  return nodesByIds([...new Set(targetIds)]);
}

export function getArchitectureNodeDependents(
  nodeId: string,
): readonly ArchitectureGraphNode[] {
  const sourceIds = inboundEdgesForNode(nodeId)
    .filter((edge) => edge.kind !== "forbidden")
    .map((edge) => edge.from_node_id);

  return nodesByIds([...new Set(sourceIds)]);
}

export function getArchitectureNodeInboundEdges(
  nodeId: string,
): readonly ArchitectureGraphEdge[] {
  return inboundEdgesForNode(nodeId);
}

export function getArchitectureNodeOutboundEdges(
  nodeId: string,
): readonly ArchitectureGraphEdge[] {
  return outboundEdgesForNode(nodeId);
}

export function getArchitectureNodeForbiddenEdges(
  nodeId: string,
): readonly ArchitectureGraphEdge[] {
  return edgesForNode(nodeId).filter((edge) => edge.kind === "forbidden");
}

export function getArchitectureNodeGovernanceEdges(
  nodeId: string,
): readonly ArchitectureGraphEdge[] {
  return edgesForNode(nodeId).filter((edge) => edge.layer === "governance");
}

export function getArchitectureNodeReadEdges(
  nodeId: string,
): readonly ArchitectureGraphEdge[] {
  return edgesForNode(nodeId).filter((edge) => edge.kind === "reads_from");
}

export function getArchitectureNodeWriteEdges(
  nodeId: string,
): readonly ArchitectureGraphEdge[] {
  return edgesForNode(nodeId).filter((edge) => edge.kind === "writes_to");
}

export function findArchitecturePath(
  fromNodeId: string,
  toNodeId: string,
  options: {
    readonly includeForbiddenEdges?: boolean;
    readonly maxDepth?: number;
  } = {},
): ArchitectureGraphPathResult {
  const fromNode = knownNode(fromNodeId);
  const toNode = knownNode(toNodeId);
  const maxDepth = Math.min(
    Math.max(options.maxDepth ?? ARCHITECTURE_GRAPH_DEFAULT_PATH_DEPTH, 0),
    ARCHITECTURE_GRAPH_MAX_PATH_DEPTH,
  );
  const includeForbiddenEdges = options.includeForbiddenEdges === true;

  if (!fromNode || !toNode) {
    return pathResult({
      found: false,
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      node_ids: [],
      edge_ids: [],
      max_depth: maxDepth,
      forbidden_edges_included: includeForbiddenEdges,
    });
  }

  if (fromNodeId === toNodeId) {
    return pathResult({
      found: true,
      from_node_id: fromNodeId,
      to_node_id: toNodeId,
      node_ids: [fromNodeId],
      edge_ids: [],
      max_depth: maxDepth,
      forbidden_edges_included: includeForbiddenEdges,
    });
  }

  const graph = getStaticArchitectureGraph();
  const queue: {
    readonly node_id: string;
    readonly node_ids: readonly string[];
    readonly edge_ids: readonly string[];
    readonly depth: number;
  }[] = [
    {
      node_id: fromNodeId,
      node_ids: [fromNodeId],
      edge_ids: [],
      depth: 0,
    },
  ];
  const visited = new Set([fromNodeId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= maxDepth) {
      continue;
    }

    const nextEdges = graph.edges.filter(
      (edge) =>
        edge.from_node_id === current.node_id &&
        (includeForbiddenEdges || edge.kind !== "forbidden"),
    );

    for (const edge of nextEdges) {
      if (visited.has(edge.to_node_id)) {
        continue;
      }

      const nextNodeIds = [...current.node_ids, edge.to_node_id];
      const nextEdgeIds = [...current.edge_ids, edge.edge_id];
      if (edge.to_node_id === toNodeId) {
        return pathResult({
          found: true,
          from_node_id: fromNodeId,
          to_node_id: toNodeId,
          node_ids: nextNodeIds,
          edge_ids: nextEdgeIds,
          max_depth: maxDepth,
          forbidden_edges_included: includeForbiddenEdges,
        });
      }

      visited.add(edge.to_node_id);
      queue.push({
        node_id: edge.to_node_id,
        node_ids: nextNodeIds,
        edge_ids: nextEdgeIds,
        depth: current.depth + 1,
      });
    }
  }

  return pathResult({
    found: false,
    from_node_id: fromNodeId,
    to_node_id: toNodeId,
    node_ids: [],
    edge_ids: [],
    max_depth: maxDepth,
    forbidden_edges_included: includeForbiddenEdges,
  });
}

export function summarizeArchitectureNode(
  nodeId: string,
): ArchitectureGraphNodeSummary | null {
  const node = knownNode(nodeId);
  if (!node) {
    return null;
  }

  const inboundEdges = getArchitectureNodeInboundEdges(nodeId);
  const outboundEdges = getArchitectureNodeOutboundEdges(nodeId);
  const dependencies = getArchitectureNodeDependencies(nodeId);
  const dependents = getArchitectureNodeDependents(nodeId);
  const forbiddenEdges = getArchitectureNodeForbiddenEdges(nodeId);
  const governanceEdges = getArchitectureNodeGovernanceEdges(nodeId);
  const readEdges = getArchitectureNodeReadEdges(nodeId);
  const writeEdges = getArchitectureNodeWriteEdges(nodeId);

  return ArchitectureGraphNodeSummarySchema.parse({
    node: copyNode(node),
    inbound_edge_count: inboundEdges.length,
    outbound_edge_count: outboundEdges.length,
    dependency_count: dependencies.length,
    dependent_count: dependents.length,
    forbidden_edge_count: forbiddenEdges.length,
    governance_edge_count: governanceEdges.length,
    read_edge_count: readEdges.length,
    write_edge_count: writeEdges.length,
    health: copyHealth(node.health),
    recent_activity_summary: copyActivity(node.activity_summary),
    metadata_only: true,
    read_only: true,
    execution_inferred: false,
    executable_payload_included: false,
    action_executed: false,
    dispatch_performed: false,
    mutation_performed: false,
  });
}
