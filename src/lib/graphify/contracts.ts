import { z } from "zod";

import type { ArchitectureGraph } from "../architecture-graph";

export const GRAPHIFY_OVERLAY_VERSION = "phase21j.graphify-overlay.v1" as const;
export const GRAPHIFY_UPSTREAM_REPOSITORY =
  "https://github.com/safishamsi/graphify" as const;

export const GRAPHIFY_SOURCE_KINDS = [
  "graph_json",
  "networkx_node_link",
  "manual_import",
] as const;

export const GRAPHIFY_NODE_KINDS = [
  "code",
  "document",
  "paper",
  "image",
  "rationale",
  "concept",
  "unknown",
] as const;

export const GRAPHIFY_EDGE_CONFIDENCE_TAGS = [
  "EXTRACTED",
  "INFERRED",
  "AMBIGUOUS",
  "UNKNOWN",
] as const;

export const GRAPHIFY_BASELINE_EDGE_KINDS = [
  "contains",
  "calls",
  "imports",
  "imports_from",
  "implements",
  "references",
  "uses",
  "instantiates",
  "method",
  "semantically_similar_to",
  "unknown",
] as const;

export const GRAPHIFY_DISCREPANCY_KINDS = [
  "designed_not_found",
  "observed_not_designed",
  "graphify_only",
  "missing_test_coverage",
  "undocumented_module",
  "unknown",
] as const;

const BoundedIdSchema = z.string().trim().min(1).max(260);
const BoundedLabelSchema = z.string().trim().min(1).max(260);
const BoundedPathSchema = z.string().trim().min(1).max(500);

export const GraphifySourceKindSchema = z.enum(GRAPHIFY_SOURCE_KINDS);
export const GraphifyNodeKindSchema = z.enum(GRAPHIFY_NODE_KINDS);
export const GraphifyEdgeConfidenceTagSchema = z.enum(
  GRAPHIFY_EDGE_CONFIDENCE_TAGS,
);
export const GraphifyDiscrepancyKindSchema = z.enum(GRAPHIFY_DISCREPANCY_KINDS);

export const GraphifyMetadataSchema = z.strictObject({
  source_id: BoundedIdSchema,
  source_kind: GraphifySourceKindSchema,
  repo_path: BoundedPathSchema.nullable(),
  generated_at: z.string().datetime().nullable(),
  upstream_repository: z.literal(GRAPHIFY_UPSTREAM_REPOSITORY),
  graph_format: z.literal("networkx_node_link"),
  extraction_metadata: z.record(z.string(), z.unknown()).default({}),
  data_source_only: z.literal(true),
  runtime_execution_attempted: z.literal(false),
  repository_mutation_attempted: z.literal(false),
});

export const GraphifySourceSchema = z.strictObject({
  source_id: BoundedIdSchema,
  source_kind: GraphifySourceKindSchema,
  repo_path: BoundedPathSchema.nullable(),
  generated_at: z.string().datetime().nullable(),
  metadata_only: z.literal(true),
  data_source_only: z.literal(true),
});

export const GraphifyRawNodeSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    label: z.union([z.string(), z.number()]).transform(String),
    file_type: z.union([z.string(), z.number()]).transform(String).optional(),
    source_file: z.union([z.string(), z.number()]).transform(String).optional(),
    source_location: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional(),
    community: z.union([z.string(), z.number()]).transform(String).optional(),
  })
  .passthrough();

export const GraphifyRawEdgeSchema = z
  .object({
    source: z.union([z.string(), z.number()]).transform(String).optional(),
    target: z.union([z.string(), z.number()]).transform(String).optional(),
    from: z.union([z.string(), z.number()]).transform(String).optional(),
    to: z.union([z.string(), z.number()]).transform(String).optional(),
    relation: z.union([z.string(), z.number()]).transform(String).optional(),
    confidence: z.union([z.string(), z.number()]).transform(String).optional(),
    confidence_score: z.number().min(0).max(1).optional(),
    source_file: z.union([z.string(), z.number()]).transform(String).optional(),
    source_location: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional(),
  })
  .passthrough()
  .superRefine((edge, ctx) => {
    const source = edge.source ?? edge.from;
    const target = edge.target ?? edge.to;
    if (!source || !target) {
      ctx.addIssue({
        code: "custom",
        message: "Graphify edges require source/target or from/to endpoints.",
      });
    }
  });

export const GraphifyCompatibleJsonSchema = z
  .object({
    directed: z.boolean().optional(),
    multigraph: z.boolean().optional(),
    graph: z.record(z.string(), z.unknown()).optional(),
    nodes: z.array(GraphifyRawNodeSchema).min(1),
    edges: z.array(GraphifyRawEdgeSchema).optional(),
    links: z.array(GraphifyRawEdgeSchema).optional(),
  })
  .passthrough()
  .superRefine((graph, ctx) => {
    if (!graph.edges && !graph.links) {
      ctx.addIssue({
        code: "custom",
        message: "Graphify graph requires edges or links array.",
      });
    }
  });

export const GraphifyNodeSchema = z.strictObject({
  node_id: BoundedIdSchema,
  original_id: BoundedIdSchema,
  label: BoundedLabelSchema,
  node_kind: GraphifyNodeKindSchema,
  raw_file_type: z.string().trim().min(1).max(120),
  source_file: BoundedPathSchema.nullable(),
  source_location: z.string().trim().min(1).max(120).nullable(),
  community: z.string().trim().min(1).max(120).nullable(),
  unknown_kind: z.boolean(),
  metadata_only: z.literal(true),
  data_source_only: z.literal(true),
});

export const GraphifyEdgeSchema = z.strictObject({
  edge_id: BoundedIdSchema,
  source_node_id: BoundedIdSchema,
  target_node_id: BoundedIdSchema,
  original_source_id: BoundedIdSchema,
  original_target_id: BoundedIdSchema,
  relation: z.string().trim().min(1).max(160),
  normalized_relation: z.string().trim().min(1).max(160),
  confidence: GraphifyEdgeConfidenceTagSchema,
  confidence_score: z.number().min(0).max(1).nullable(),
  source_file: BoundedPathSchema.nullable(),
  source_location: z.string().trim().min(1).max(120).nullable(),
  unknown_relation: z.boolean(),
  metadata_only: z.literal(true),
  data_source_only: z.literal(true),
});

export const GraphifyGraphSchema = z.strictObject({
  graph_id: BoundedIdSchema,
  metadata: GraphifyMetadataSchema,
  nodes: z.array(GraphifyNodeSchema),
  edges: z.array(GraphifyEdgeSchema),
  hyperedges: z.array(z.record(z.string(), z.unknown())).default([]),
  summary: z.strictObject({
    node_count: z.number().int().nonnegative(),
    edge_count: z.number().int().nonnegative(),
    unknown_node_kind_count: z.number().int().nonnegative(),
    unknown_edge_kind_count: z.number().int().nonnegative(),
    extracted_edge_count: z.number().int().nonnegative(),
    inferred_edge_count: z.number().int().nonnegative(),
    ambiguous_edge_count: z.number().int().nonnegative(),
    metadata_only: z.literal(true),
    read_only: z.literal(true),
  }),
  data_source_only: z.literal(true),
  read_only: z.literal(true),
  runtime_execution_attempted: z.literal(false),
  repository_mutation_attempted: z.literal(false),
});

export const GraphifyCoverageMetadataSchema = z.strictObject({
  node_id: BoundedIdSchema,
  has_test_coverage: z.boolean(),
  has_doc_coverage: z.boolean(),
});

export const GraphifyOverlayNodeSchema = z.strictObject({
  overlay_node_id: BoundedIdSchema,
  label: BoundedLabelSchema,
  design_node_id: BoundedIdSchema.nullable(),
  graphify_node_id: BoundedIdSchema.nullable(),
  present_in_design: z.boolean(),
  present_in_graphify: z.boolean(),
  present_in_observed: z.boolean(),
  metadata_only: z.literal(true),
});

export const GraphifyOverlayEdgeSchema = z.strictObject({
  overlay_edge_id: BoundedIdSchema,
  label: BoundedLabelSchema,
  design_edge_id: BoundedIdSchema.nullable(),
  graphify_edge_id: BoundedIdSchema.nullable(),
  present_in_design: z.boolean(),
  present_in_graphify: z.boolean(),
  present_in_observed: z.boolean(),
  metadata_only: z.literal(true),
});

export const GraphifyOverlayDiscrepancySchema = z.strictObject({
  discrepancy_id: BoundedIdSchema,
  kind: GraphifyDiscrepancyKindSchema,
  node_id: BoundedIdSchema.nullable(),
  edge_id: BoundedIdSchema.nullable(),
  summary: z.string().trim().min(1).max(320),
  metadata_only: z.literal(true),
  read_only: z.literal(true),
  remediation_executed: z.literal(false),
});

export const GraphifyObservedRuntimeMetadataSchema = z.strictObject({
  observed_node_ids: z.array(BoundedIdSchema).default([]),
  observed_edge_ids: z.array(BoundedIdSchema).default([]),
});

export const GraphifyOverlaySchema = z.strictObject({
  overlay_id: BoundedIdSchema,
  graphify_graph_id: BoundedIdSchema,
  architecture_graph_id: BoundedIdSchema,
  nodes: z.array(GraphifyOverlayNodeSchema),
  edges: z.array(GraphifyOverlayEdgeSchema),
  discrepancies: z.array(GraphifyOverlayDiscrepancySchema),
  summary: z.strictObject({
    designed_not_found_count: z.number().int().nonnegative(),
    observed_not_designed_count: z.number().int().nonnegative(),
    graphify_only_count: z.number().int().nonnegative(),
    missing_test_coverage_count: z.number().int().nonnegative(),
    undocumented_module_count: z.number().int().nonnegative(),
    metadata_only: z.literal(true),
    read_only: z.literal(true),
  }),
  graphify_is_governance_truth: z.literal(false),
  data_source_only: z.literal(true),
  execution_attempted: z.literal(false),
  mutation_attempted: z.literal(false),
});

export const GraphifyOverlayCloseoutReportSchema = z.strictObject({
  closeout_version: z.literal(GRAPHIFY_OVERLAY_VERSION),
  title: z.literal(
    "Graphify overlay complete as read-only architecture data source",
  ),
  status: z.literal("read_only_overlay_complete"),
  components: z.array(
    z.enum([
      "graphify_source_contract",
      "graphify_normalization",
      "designed_vs_observed_overlay",
      "discrepancy_model",
    ]),
  ),
  governance: z.strictObject({
    graphify_data_source_only: z.literal(true),
    architecture_governance_truth_remains_authoritative: z.literal(true),
    graphify_governance_truth: z.literal(false),
    graphify_execution_supported: z.literal(false),
    shell_execution_supported: z.literal(false),
    repository_mutation_supported: z.literal(false),
    filesystem_write_supported: z.literal(false),
    database_write_supported: z.literal(false),
    network_call_supported: z.literal(false),
    provider_model_call_supported: z.literal(false),
    telemetry_write_supported: z.literal(false),
    ui_route_added: z.literal(false),
    graph_driven_execution_supported: z.literal(false),
    authority_escalation_supported: z.literal(false),
  }),
  readme_safe_wording: z.array(z.string().trim().min(1).max(260)),
  upstream_reference: z.literal(GRAPHIFY_UPSTREAM_REPOSITORY),
});

export type GraphifySourceKind = z.infer<typeof GraphifySourceKindSchema>;
export type GraphifyNodeKind = z.infer<typeof GraphifyNodeKindSchema>;
export type GraphifyEdgeConfidenceTag = z.infer<
  typeof GraphifyEdgeConfidenceTagSchema
>;
export type GraphifyDiscrepancyKind = z.infer<
  typeof GraphifyDiscrepancyKindSchema
>;
export type GraphifyMetadata = z.infer<typeof GraphifyMetadataSchema>;
export type GraphifySource = z.infer<typeof GraphifySourceSchema>;
export type GraphifyNode = z.infer<typeof GraphifyNodeSchema>;
export type GraphifyEdge = z.infer<typeof GraphifyEdgeSchema>;
export type GraphifyGraph = z.infer<typeof GraphifyGraphSchema>;
export type GraphifyCoverageMetadata = z.infer<
  typeof GraphifyCoverageMetadataSchema
>;
export type GraphifyOverlayNode = z.infer<typeof GraphifyOverlayNodeSchema>;
export type GraphifyOverlayEdge = z.infer<typeof GraphifyOverlayEdgeSchema>;
export type GraphifyOverlayDiscrepancy = z.infer<
  typeof GraphifyOverlayDiscrepancySchema
>;
export type GraphifyObservedRuntimeMetadata = z.infer<
  typeof GraphifyObservedRuntimeMetadataSchema
>;
export type GraphifyOverlay = z.infer<typeof GraphifyOverlaySchema>;
export type GraphifyOverlayCloseoutReport = z.infer<
  typeof GraphifyOverlayCloseoutReportSchema
>;

export function validateGraphifyGraph(input: unknown): boolean {
  return GraphifyCompatibleJsonSchema.safeParse(input).success;
}

export function normalizeGraphifyGraph(input: {
  readonly source: GraphifySource;
  readonly graph: unknown;
}): GraphifyGraph {
  const source = GraphifySourceSchema.parse(input.source);
  const raw = GraphifyCompatibleJsonSchema.parse(input.graph);
  const rawEdges = raw.edges ?? raw.links ?? [];
  const nodeMap = new Map<string, GraphifyNode>();

  for (const rawNode of raw.nodes) {
    const originalId = rawNode.id;
    const nodeId = normalizeGraphifyId(originalId);
    if (nodeMap.has(nodeId)) continue;
    const rawFileType = String(rawNode.file_type ?? "concept");
    const nodeKind = toNodeKind(rawFileType);
    nodeMap.set(
      nodeId,
      GraphifyNodeSchema.parse({
        node_id: nodeId,
        original_id: originalId,
        label: rawNode.label,
        node_kind: nodeKind,
        raw_file_type: rawFileType,
        source_file: normalizePath(rawNode.source_file),
        source_location: rawNode.source_location ?? null,
        community: rawNode.community ?? null,
        unknown_kind: nodeKind === "unknown",
        metadata_only: true,
        data_source_only: true,
      }),
    );
  }

  const edgeMap = new Map<string, GraphifyEdge>();
  for (const rawEdge of rawEdges) {
    const originalSource = rawEdge.source ?? rawEdge.from;
    const originalTarget = rawEdge.target ?? rawEdge.to;
    if (!originalSource || !originalTarget) continue;
    const sourceNodeId = normalizeGraphifyId(originalSource);
    const targetNodeId = normalizeGraphifyId(originalTarget);
    const relation = String(rawEdge.relation ?? "unknown");
    const normalizedRelation = normalizeRelation(relation);
    const edgeId = `graphify-edge:${sourceNodeId}:${normalizedRelation}:${targetNodeId}`;
    if (edgeMap.has(edgeId)) continue;
    const confidence = toConfidence(rawEdge.confidence);
    edgeMap.set(
      edgeId,
      GraphifyEdgeSchema.parse({
        edge_id: edgeId,
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        original_source_id: originalSource,
        original_target_id: originalTarget,
        relation,
        normalized_relation: normalizedRelation,
        confidence,
        confidence_score:
          rawEdge.confidence_score ??
          (confidence === "EXTRACTED"
            ? 1
            : confidence === "UNKNOWN"
              ? null
              : 0.5),
        source_file: normalizePath(rawEdge.source_file),
        source_location: rawEdge.source_location ?? null,
        unknown_relation: !GRAPHIFY_BASELINE_EDGE_KINDS.includes(
          normalizedRelation as (typeof GRAPHIFY_BASELINE_EDGE_KINDS)[number],
        ),
        metadata_only: true,
        data_source_only: true,
      }),
    );
  }

  const nodes = [...nodeMap.values()].sort((left, right) =>
    left.node_id.localeCompare(right.node_id),
  );
  const edges = [...edgeMap.values()].sort((left, right) =>
    left.edge_id.localeCompare(right.edge_id),
  );
  const hyperedges = Array.isArray(raw.graph?.hyperedges)
    ? raw.graph.hyperedges.filter(isRecord)
    : [];

  return GraphifyGraphSchema.parse({
    graph_id: `graphify-graph:${source.source_id}`,
    metadata: {
      source_id: source.source_id,
      source_kind: source.source_kind,
      repo_path: source.repo_path,
      generated_at: source.generated_at,
      upstream_repository: GRAPHIFY_UPSTREAM_REPOSITORY,
      graph_format: "networkx_node_link",
      extraction_metadata: isRecord(raw.graph) ? raw.graph : {},
      data_source_only: true,
      runtime_execution_attempted: false,
      repository_mutation_attempted: false,
    },
    nodes,
    edges,
    hyperedges,
    summary: summarizeGraphifyGraph({ nodes, edges }),
    data_source_only: true,
    read_only: true,
    runtime_execution_attempted: false,
    repository_mutation_attempted: false,
  });
}

export function summarizeGraphifyGraph(
  graph: Pick<GraphifyGraph, "nodes" | "edges">,
): GraphifyGraph["summary"] {
  const nodes = graph.nodes.map((node) => GraphifyNodeSchema.parse(node));
  const edges = graph.edges.map((edge) => GraphifyEdgeSchema.parse(edge));
  return {
    node_count: nodes.length,
    edge_count: edges.length,
    unknown_node_kind_count: nodes.filter((node) => node.unknown_kind).length,
    unknown_edge_kind_count: edges.filter((edge) => edge.unknown_relation)
      .length,
    extracted_edge_count: edges.filter(
      (edge) => edge.confidence === "EXTRACTED",
    ).length,
    inferred_edge_count: edges.filter((edge) => edge.confidence === "INFERRED")
      .length,
    ambiguous_edge_count: edges.filter(
      (edge) => edge.confidence === "AMBIGUOUS",
    ).length,
    metadata_only: true,
    read_only: true,
  };
}

export function buildGraphifyOverlay(input: {
  readonly designedGraph: ArchitectureGraph;
  readonly graphifyGraph: GraphifyGraph;
  readonly observedRuntime?: GraphifyObservedRuntimeMetadata;
  readonly coverage?: readonly GraphifyCoverageMetadata[];
}): GraphifyOverlay {
  const designedGraph = input.designedGraph;
  const graphifyGraph = GraphifyGraphSchema.parse(input.graphifyGraph);
  const observed = GraphifyObservedRuntimeMetadataSchema.parse(
    input.observedRuntime ?? {},
  );
  const coverage = (input.coverage ?? []).map((item) =>
    GraphifyCoverageMetadataSchema.parse(item),
  );

  const designNodeKeys = new Map(
    designedGraph.nodes.map((node) => [
      comparisonKey(node.label, node.node_id),
      node,
    ]),
  );
  const graphifyNodeKeys = new Map(
    graphifyGraph.nodes.map((node) => [
      comparisonKey(node.label, node.node_id),
      node,
    ]),
  );
  const nodes: GraphifyOverlayNode[] = [];
  const discrepancies: GraphifyOverlayDiscrepancy[] = [];

  for (const [key, designNode] of designNodeKeys) {
    const graphifyNode = graphifyNodeKeys.get(key) ?? null;
    nodes.push(
      GraphifyOverlayNodeSchema.parse({
        overlay_node_id: `graphify-overlay-node:${key}`,
        label: designNode.label,
        design_node_id: designNode.node_id,
        graphify_node_id: graphifyNode?.node_id ?? null,
        present_in_design: true,
        present_in_graphify: !!graphifyNode,
        present_in_observed: observed.observed_node_ids.includes(
          designNode.node_id,
        ),
        metadata_only: true,
      }),
    );
    if (!graphifyNode) {
      discrepancies.push(
        discrepancy(
          "designed_not_found",
          `designed-not-found:${key}`,
          designNode.node_id,
          null,
          `Designed node '${designNode.label}' was not present in supplied Graphify metadata.`,
        ),
      );
    }
  }

  for (const [key, graphifyNode] of graphifyNodeKeys) {
    if (designNodeKeys.has(key)) continue;
    nodes.push(
      GraphifyOverlayNodeSchema.parse({
        overlay_node_id: `graphify-overlay-node:${key}`,
        label: graphifyNode.label,
        design_node_id: null,
        graphify_node_id: graphifyNode.node_id,
        present_in_design: false,
        present_in_graphify: true,
        present_in_observed: observed.observed_node_ids.includes(
          graphifyNode.node_id,
        ),
        metadata_only: true,
      }),
    );
    discrepancies.push(
      discrepancy(
        "graphify_only",
        `graphify-only-node:${key}`,
        graphifyNode.node_id,
        null,
        `Graphify node '${graphifyNode.label}' is not represented in the designed architecture graph.`,
      ),
    );
  }

  for (const observedNodeId of observed.observed_node_ids) {
    const observedKnown =
      designedGraph.nodes.some((node) => node.node_id === observedNodeId) ||
      graphifyGraph.nodes.some((node) => node.node_id === observedNodeId);
    if (!observedKnown) {
      discrepancies.push(
        discrepancy(
          "observed_not_designed",
          `observed-node:${normalizeGraphifyId(observedNodeId)}`,
          observedNodeId,
          null,
          `Observed runtime node '${observedNodeId}' is not represented in design or Graphify metadata.`,
        ),
      );
    }
  }

  const designEdgeKeys = new Set(
    designedGraph.edges.map((edge) =>
      comparisonEdgeKey(edge.from_node_id, edge.kind, edge.to_node_id),
    ),
  );
  const edges = graphifyGraph.edges.map((edge) => {
    const edgeKey = comparisonEdgeKey(
      edge.source_node_id,
      edge.normalized_relation,
      edge.target_node_id,
    );
    const presentInDesign = designEdgeKeys.has(edgeKey);
    if (!presentInDesign) {
      discrepancies.push(
        discrepancy(
          "graphify_only",
          `graphify-only-edge:${edge.edge_id}`,
          null,
          edge.edge_id,
          `Graphify edge '${edge.source_node_id} --${edge.normalized_relation}--> ${edge.target_node_id}' is not represented in design metadata.`,
        ),
      );
    }
    return GraphifyOverlayEdgeSchema.parse({
      overlay_edge_id: `graphify-overlay-edge:${edge.edge_id}`,
      label: edge.normalized_relation,
      design_edge_id: presentInDesign ? edgeKey : null,
      graphify_edge_id: edge.edge_id,
      present_in_design: presentInDesign,
      present_in_graphify: true,
      present_in_observed: observed.observed_edge_ids.includes(edge.edge_id),
      metadata_only: true,
    });
  });

  for (const item of coverage) {
    if (!item.has_test_coverage) {
      discrepancies.push(
        discrepancy(
          "missing_test_coverage",
          `missing-test:${item.node_id}`,
          item.node_id,
          null,
          `Graphify node '${item.node_id}' is represented without supplied test coverage metadata.`,
        ),
      );
    }
    if (!item.has_doc_coverage) {
      discrepancies.push(
        discrepancy(
          "undocumented_module",
          `undocumented:${item.node_id}`,
          item.node_id,
          null,
          `Graphify node '${item.node_id}' is represented without supplied documentation coverage metadata.`,
        ),
      );
    }
  }

  return GraphifyOverlaySchema.parse({
    overlay_id: `graphify-overlay:${graphifyGraph.graph_id}`,
    graphify_graph_id: graphifyGraph.graph_id,
    architecture_graph_id: designedGraph.graph_id,
    nodes: nodes.sort((left, right) =>
      left.overlay_node_id.localeCompare(right.overlay_node_id),
    ),
    edges: edges.sort((left, right) =>
      left.overlay_edge_id.localeCompare(right.overlay_edge_id),
    ),
    discrepancies: discrepancies.sort((left, right) =>
      left.discrepancy_id.localeCompare(right.discrepancy_id),
    ),
    summary: summarizeGraphifyOverlay(discrepancies),
    graphify_is_governance_truth: false,
    data_source_only: true,
    execution_attempted: false,
    mutation_attempted: false,
  });
}

export function summarizeGraphifyOverlay(
  discrepancies: readonly GraphifyOverlayDiscrepancy[],
): GraphifyOverlay["summary"] {
  const parsed = discrepancies.map((item) =>
    GraphifyOverlayDiscrepancySchema.parse(item),
  );
  return {
    designed_not_found_count: parsed.filter(
      (item) => item.kind === "designed_not_found",
    ).length,
    observed_not_designed_count: parsed.filter(
      (item) => item.kind === "observed_not_designed",
    ).length,
    graphify_only_count: parsed.filter((item) => item.kind === "graphify_only")
      .length,
    missing_test_coverage_count: parsed.filter(
      (item) => item.kind === "missing_test_coverage",
    ).length,
    undocumented_module_count: parsed.filter(
      (item) => item.kind === "undocumented_module",
    ).length,
    metadata_only: true,
    read_only: true,
  };
}

export function buildGraphifyOverlayCloseoutReport(): GraphifyOverlayCloseoutReport {
  return GraphifyOverlayCloseoutReportSchema.parse({
    closeout_version: GRAPHIFY_OVERLAY_VERSION,
    title: "Graphify overlay complete as read-only architecture data source",
    status: "read_only_overlay_complete",
    components: [
      "graphify_source_contract",
      "graphify_normalization",
      "designed_vs_observed_overlay",
      "discrepancy_model",
    ],
    governance: {
      graphify_data_source_only: true,
      architecture_governance_truth_remains_authoritative: true,
      graphify_governance_truth: false,
      graphify_execution_supported: false,
      shell_execution_supported: false,
      repository_mutation_supported: false,
      filesystem_write_supported: false,
      database_write_supported: false,
      network_call_supported: false,
      provider_model_call_supported: false,
      telemetry_write_supported: false,
      ui_route_added: false,
      graph_driven_execution_supported: false,
      authority_escalation_supported: false,
    },
    readme_safe_wording: [
      "Graphify overlay is complete as a read-only architecture data source.",
      "It accepts supplied Graphify-compatible graph.json data, normalizes nodes and edges, and compares it with JARVIS design metadata.",
      "Graphify does not become governance truth, execute checks, mutate the repo, or drive runtime behavior.",
    ],
    upstream_reference: GRAPHIFY_UPSTREAM_REPOSITORY,
  });
}

function normalizeGraphifyId(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRelation(value: string): string {
  return normalizeGraphifyId(value).replace(/-/g, "_") || "unknown";
}

function normalizePath(value: string | undefined): string | null {
  return value ? value.replace(/\\/g, "/") : null;
}

function toNodeKind(value: string): GraphifyNodeKind {
  const normalized = value.toLowerCase().replace(/[-\s]+/g, "_");
  if (GRAPHIFY_NODE_KINDS.includes(normalized as GraphifyNodeKind)) {
    return normalized as GraphifyNodeKind;
  }
  return "unknown";
}

function toConfidence(value: string | undefined): GraphifyEdgeConfidenceTag {
  const normalized = value?.toUpperCase();
  if (
    GRAPHIFY_EDGE_CONFIDENCE_TAGS.includes(
      normalized as GraphifyEdgeConfidenceTag,
    )
  ) {
    return normalized as GraphifyEdgeConfidenceTag;
  }
  return "UNKNOWN";
}

function comparisonKey(label: string, fallbackId: string): string {
  return normalizeGraphifyId(label || fallbackId);
}

function comparisonEdgeKey(
  source: string,
  relation: string,
  target: string,
): string {
  return `${normalizeGraphifyId(source)}:${normalizeRelation(relation)}:${normalizeGraphifyId(target)}`;
}

function discrepancy(
  kind: GraphifyDiscrepancyKind,
  id: string,
  nodeId: string | null,
  edgeId: string | null,
  summary: string,
): GraphifyOverlayDiscrepancy {
  return GraphifyOverlayDiscrepancySchema.parse({
    discrepancy_id: `graphify-discrepancy:${normalizeGraphifyId(id)}`,
    kind,
    node_id: nodeId,
    edge_id: edgeId,
    summary,
    metadata_only: true,
    read_only: true,
    remediation_executed: false,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
