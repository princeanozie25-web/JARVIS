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

export {
  ArchitectureGraphNodeSummarySchema,
  ArchitectureGraphPathResultSchema,
  findArchitecturePath,
  getArchitectureNodeDependencies,
  getArchitectureNodeDependents,
  getArchitectureNodeForbiddenEdges,
  getArchitectureNodeGovernanceEdges,
  getArchitectureNodeInboundEdges,
  getArchitectureNodeOutboundEdges,
  getArchitectureNodeReadEdges,
  getArchitectureNodeWriteEdges,
  summarizeArchitectureNode,
} from "./queries";

export type {
  ArchitectureGraphNodeSummary,
  ArchitectureGraphPathResult,
} from "./queries";

export {
  ARCHITECTURE_GRAPH_PROJECTION_CONTRACT_VERSION,
  ARCHITECTURE_GRAPH_PROJECTION_GROUPS,
  ARCHITECTURE_GRAPH_PROJECTION_POLICY_STATUSES,
  ARCHITECTURE_GRAPH_PROJECTION_STYLE_TOKENS,
  ArchitectureGraphProjectionActivitySummarySchema,
  ArchitectureGraphProjectionEdgeSchema,
  ArchitectureGraphProjectionGroupIdSchema,
  ArchitectureGraphProjectionGroupSchema,
  ArchitectureGraphProjectionLegendSchema,
  ArchitectureGraphProjectionNodeSchema,
  ArchitectureGraphProjectionPolicyStatusSchema,
  ArchitectureGraphProjectionSchema,
  ArchitectureGraphProjectionStatsSchema,
  ArchitectureGraphProjectionStyleTokenSchema,
  ArchitectureGraphProjectionWarningSchema,
  buildArchitectureGraphProjection,
  buildArchitectureGraphProjectionForNode,
  buildArchitectureGraphProjectionStats,
  listArchitectureGraphProjectionWarnings,
} from "./projections";

export type {
  ArchitectureGraphProjection,
  ArchitectureGraphProjectionActivitySummary,
  ArchitectureGraphProjectionEdge,
  ArchitectureGraphProjectionGroup,
  ArchitectureGraphProjectionLegend,
  ArchitectureGraphProjectionNode,
  ArchitectureGraphProjectionStats,
  ArchitectureGraphProjectionWarning,
} from "./projections";

export {
  ARCHITECTURE_GRAPH_SAFETY_GUARD_VERSION,
  ARCHITECTURE_GRAPH_SAFETY_SCAN_TARGETS,
  ARCHITECTURE_GRAPH_SAFETY_SEVERITIES,
  ARCHITECTURE_GRAPH_SAFETY_VIOLATION_KINDS,
  ArchitectureGraphSafetyPolicySchema,
  ArchitectureGraphSafetyResultSchema,
  ArchitectureGraphSafetyScanTargetSchema,
  ArchitectureGraphSafetyViolationKindSchema,
  ArchitectureGraphSafetyViolationSchema,
  DEFAULT_ARCHITECTURE_GRAPH_SAFETY_POLICY,
  assertArchitectureGraphProjectionSafe,
  assertArchitectureGraphSafe,
  listArchitectureGraphForbiddenAffordanceNames,
  listArchitectureGraphForbiddenFieldNames,
  scanArchitectureGraphProjectionSafety,
  scanArchitectureGraphSafety,
} from "./safety-guard";

export type {
  ArchitectureGraphSafetyPolicy,
  ArchitectureGraphSafetyResult,
  ArchitectureGraphSafetyScanTarget,
  ArchitectureGraphSafetyViolation,
  ArchitectureGraphSafetyViolationKind,
} from "./safety-guard";

export {
  PHASE_19A_CLOSEOUT_CHECK_IDS,
  PHASE_19A_CLOSEOUT_VERDICTS,
  PHASE_19A_CLOSEOUT_VERSION,
  PHASE_19A_DISABLED_CAPABILITIES,
  Phase19ACloseoutCheckIdSchema,
  Phase19ACloseoutCheckSchema,
  Phase19ACloseoutEvidenceSchema,
  Phase19ACloseoutReportSchema,
  Phase19ACloseoutVerdictSchema,
  assertPhase19ACloseoutPasses,
  buildPhase19ACloseoutReport,
  listPhase19ADisabledCapabilities,
} from "./phase-19a-closeout";

export type {
  Phase19ACloseoutCheck,
  Phase19ACloseoutCheckId,
  Phase19ACloseoutEvidence,
  Phase19ACloseoutReport,
  Phase19ACloseoutVerdict,
} from "./phase-19a-closeout";
