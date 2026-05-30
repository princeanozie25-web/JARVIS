import { z } from "zod";

import {
  GovernanceBoundaryEdgeSchema,
  GovernanceBoundaryGateTypeSchema,
  GovernanceBoundaryNodeIdSchema,
  GovernanceBoundaryNodeSchema,
  GovernanceBoundaryPolicyKindSchema,
  GovernanceBoundaryTripwireSchema,
  GovernanceBoundaryTrustClassSchema,
  buildGovernanceBoundaryProjection,
  type GovernanceBoundaryEdge,
  type GovernanceBoundaryGateType,
  type GovernanceBoundaryNode,
  type GovernanceBoundaryNodeId,
  type GovernanceBoundaryPolicyKind,
  type GovernanceBoundaryTripwire,
  type GovernanceBoundaryTrustClass,
} from "./contracts";

export const GovernanceBoundaryNodeSummarySchema = z.strictObject({
  node_id: GovernanceBoundaryNodeIdSchema,
  label: z.string().trim().min(1).max(120),
  trust_class: GovernanceBoundaryTrustClassSchema,
  inbound_edge_count: z.number().int().nonnegative(),
  outbound_edge_count: z.number().int().nonnegative(),
  allowed_edge_count: z.number().int().nonnegative(),
  gated_edge_count: z.number().int().nonnegative(),
  forbidden_edge_count: z.number().int().nonnegative(),
  tripwire_count: z.number().int().nonnegative(),
  disabled_capabilities_visible: z.literal(true),
  execution_inferred: z.literal(false),
  authority_surface_created: z.literal(false),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
});

export type GovernanceBoundaryNodeSummary = z.infer<
  typeof GovernanceBoundaryNodeSummarySchema
>;

function copyNode(node: GovernanceBoundaryNode): GovernanceBoundaryNode {
  return GovernanceBoundaryNodeSchema.parse(JSON.parse(JSON.stringify(node)));
}

function copyEdge(edge: GovernanceBoundaryEdge): GovernanceBoundaryEdge {
  return GovernanceBoundaryEdgeSchema.parse(JSON.parse(JSON.stringify(edge)));
}

function copyTripwire(
  tripwire: GovernanceBoundaryTripwire,
): GovernanceBoundaryTripwire {
  return GovernanceBoundaryTripwireSchema.parse(
    JSON.parse(JSON.stringify(tripwire)),
  );
}

function projection() {
  return buildGovernanceBoundaryProjection();
}

function edgePolicyTrustClass(
  edge: GovernanceBoundaryEdge,
): GovernanceBoundaryTrustClass {
  const policy = projection().policies.find(
    (item) => item.policy_id === edge.policy_id,
  );
  return policy?.trust_class ?? "forbidden";
}

export function listGovernanceBoundaryNodes(): readonly GovernanceBoundaryNode[] {
  return projection().nodes.map(copyNode);
}

export function listGovernanceBoundaryEdges(): readonly GovernanceBoundaryEdge[] {
  return projection().edges.map(copyEdge);
}

export function getGovernanceBoundaryNodeById(
  id: string,
): GovernanceBoundaryNode | null {
  const parsed = GovernanceBoundaryNodeIdSchema.safeParse(id);
  if (!parsed.success) {
    return null;
  }

  const node = projection().nodes.find((item) => item.node_id === parsed.data);
  return node ? copyNode(node) : null;
}

export function getGovernanceBoundaryEdgesForNode(
  nodeId: string,
): readonly GovernanceBoundaryEdge[] {
  const parsed = GovernanceBoundaryNodeIdSchema.safeParse(nodeId);
  if (!parsed.success || !getGovernanceBoundaryNodeById(parsed.data)) {
    return [];
  }

  return projection()
    .edges.filter(
      (edge) =>
        edge.from_node_id === parsed.data || edge.to_node_id === parsed.data,
    )
    .map(copyEdge);
}

export function getGovernanceBoundaryInboundEdges(
  nodeId: string,
): readonly GovernanceBoundaryEdge[] {
  const parsed = GovernanceBoundaryNodeIdSchema.safeParse(nodeId);
  if (!parsed.success || !getGovernanceBoundaryNodeById(parsed.data)) {
    return [];
  }

  return projection()
    .edges.filter((edge) => edge.to_node_id === parsed.data)
    .map(copyEdge);
}

export function getGovernanceBoundaryOutboundEdges(
  nodeId: string,
): readonly GovernanceBoundaryEdge[] {
  const parsed = GovernanceBoundaryNodeIdSchema.safeParse(nodeId);
  if (!parsed.success || !getGovernanceBoundaryNodeById(parsed.data)) {
    return [];
  }

  return projection()
    .edges.filter((edge) => edge.from_node_id === parsed.data)
    .map(copyEdge);
}

export function listGovernanceBoundaryEdgesByPolicy(
  policy: string,
): readonly GovernanceBoundaryEdge[] {
  const parsed = GovernanceBoundaryPolicyKindSchema.safeParse(policy);
  if (!parsed.success) {
    return [];
  }

  return projection()
    .edges.filter((edge) => edge.policy === parsed.data)
    .map(copyEdge);
}

export function listGovernanceBoundaryEdgesByGate(
  gateType: string,
): readonly GovernanceBoundaryEdge[] {
  const parsed = GovernanceBoundaryGateTypeSchema.safeParse(gateType);
  if (!parsed.success) {
    return [];
  }

  return projection()
    .edges.filter((edge) => edge.gate_type === parsed.data)
    .map(copyEdge);
}

export function listGovernanceBoundaryEdgesByTrustClass(
  trustClass: string,
): readonly GovernanceBoundaryEdge[] {
  const parsed = GovernanceBoundaryTrustClassSchema.safeParse(trustClass);
  if (!parsed.success) {
    return [];
  }

  return projection()
    .edges.filter((edge) => edgePolicyTrustClass(edge) === parsed.data)
    .map(copyEdge);
}

export function listGovernanceBoundaryTripwiresForNode(
  nodeId: string,
): readonly GovernanceBoundaryTripwire[] {
  const nodeEdges = getGovernanceBoundaryEdgesForNode(nodeId);
  if (nodeEdges.length === 0) {
    return [];
  }

  const tripwireIds = new Set(
    nodeEdges
      .map((edge) => edge.tripwire_id)
      .filter((tripwireId): tripwireId is string => Boolean(tripwireId)),
  );

  return projection()
    .tripwires.filter((tripwire) => tripwireIds.has(tripwire.tripwire_id))
    .map(copyTripwire);
}

export function summarizeGovernanceBoundaryNode(
  nodeId: string,
): GovernanceBoundaryNodeSummary | null {
  const node = getGovernanceBoundaryNodeById(nodeId);
  if (!node) {
    return null;
  }

  const inboundEdges = getGovernanceBoundaryInboundEdges(node.node_id);
  const outboundEdges = getGovernanceBoundaryOutboundEdges(node.node_id);
  const allEdges = [...inboundEdges, ...outboundEdges];

  return GovernanceBoundaryNodeSummarySchema.parse({
    node_id: node.node_id as GovernanceBoundaryNodeId,
    label: node.label,
    trust_class: node.trust_class,
    inbound_edge_count: inboundEdges.length,
    outbound_edge_count: outboundEdges.length,
    allowed_edge_count: allEdges.filter((edge) => edge.policy === "allowed")
      .length,
    gated_edge_count: allEdges.filter((edge) => edge.policy === "gated").length,
    forbidden_edge_count: allEdges.filter((edge) => edge.policy === "forbidden")
      .length,
    tripwire_count: listGovernanceBoundaryTripwiresForNode(node.node_id).length,
    disabled_capabilities_visible: true,
    execution_inferred: false,
    authority_surface_created: false,
    metadata_only: true,
    read_only: true,
  });
}

export type {
  GovernanceBoundaryGateType,
  GovernanceBoundaryPolicyKind,
  GovernanceBoundaryTrustClass,
};
