export {
  ARCHITECTURE_GRAPH_CONTRACT_VERSION,
  ARCHITECTURE_GRAPH_DISCREPANCY_KINDS,
  ARCHITECTURE_GRAPH_EDGE_KINDS,
  ARCHITECTURE_GRAPH_FORBIDDEN_RAW_KEYS,
  ARCHITECTURE_GRAPH_GOVERNANCE_BOUNDARY_KINDS,
  ARCHITECTURE_GRAPH_HEALTH_STATUSES,
  ARCHITECTURE_GRAPH_LAYERS,
  ARCHITECTURE_GRAPH_NODE_KINDS,
  ArchitectureGraphActivitySummarySchema,
  ArchitectureGraphDiscrepancyKindSchema,
  ArchitectureGraphDiscrepancySchema,
  ArchitectureGraphEdgeKindSchema,
  ArchitectureGraphEdgeSchema,
  ArchitectureGraphGovernanceBoundaryKindSchema,
  ArchitectureGraphGovernanceBoundarySchema,
  ArchitectureGraphHealthSchema,
  ArchitectureGraphHealthStatusSchema,
  ArchitectureGraphLayerSchema,
  ArchitectureGraphNodeKindSchema,
  ArchitectureGraphNodeSchema,
  ArchitectureGraphSchema,
  ArchitectureGraphValidationReasonSchema,
  ArchitectureGraphValidationResultSchema,
  validateArchitectureGraphMetadata,
} from "./contracts";

export type {
  ArchitectureGraph,
  ArchitectureGraphActivitySummary,
  ArchitectureGraphDiscrepancy,
  ArchitectureGraphDiscrepancyKind,
  ArchitectureGraphEdge,
  ArchitectureGraphEdgeKind,
  ArchitectureGraphGovernanceBoundary,
  ArchitectureGraphGovernanceBoundaryKind,
  ArchitectureGraphHealth,
  ArchitectureGraphHealthStatus,
  ArchitectureGraphLayer,
  ArchitectureGraphNode,
  ArchitectureGraphNodeKind,
  ArchitectureGraphValidationResult,
} from "./contracts";

export {
  PHASE_19A1_SAMPLE_ARCHITECTURE_GRAPH,
  buildPhase19A1SampleArchitectureGraph,
} from "./fixtures";

export {
  getArchitectureGraphEdgesForNode,
  getArchitectureGraphNodeById,
  getStaticArchitectureGraph,
  listArchitectureGraphEdges,
  listArchitectureGraphNodes,
} from "./static-registry";
