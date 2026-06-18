// WorkflowBox v1a — public surface: the personal-scale project model, its single
// SQLite-backed mutation API, and conversation -> draft materialization. No UI
// (that is v1b). A clean SUBSET of the Enterprise-Brain WorkflowBox primitive.

export type {
  NodeStatus,
  EffectClass,
  NodeLayout,
  SubItem,
  WorkNode,
  Project,
  WorkNodeInput,
  SubItemInput,
  UpdateSubItemInput,
  CreateProjectInput,
  UpdateNodeInput,
  ConversationContext,
  DraftNodeSpec,
  Decomposer,
  DraftProject,
} from "./types";
export {
  statusFromPercent,
  clampPercent,
  reconcileProgress,
  computeRollupPercent,
  computeNodePercent,
  binaryDoneFromProgress,
} from "./types";

export {
  createProject,
  getProject,
  listProjects,
  addNode,
  updateNode,
  removeNode,
  removeProject,
  addSubItem,
  toggleSubItem,
  updateSubItem,
  removeSubItem,
  findDependencyCycle,
  WorkflowBoxError,
} from "./store";
export type { WorkflowBoxErrorCode, WorkflowBoxOptions } from "./store";

export {
  buildWorkflowLaneViewModel,
  LANE_GOVERNANCE_CONTRACT,
} from "./lane-view";
export type {
  WorkflowLaneViewModel,
  LaneProjectView,
  LaneNodeView,
  LaneSubItemView,
} from "./lane-view";

export { buildWorkflowMapViewModel } from "./map-view";
export type {
  WorkflowMapViewModel,
  MapProjectView,
  MapNodeView,
  MapEdgeView,
} from "./map-view";

export {
  materializeProjectFromConversation,
  draftToCreateInput,
} from "./materialize";
export type { MaterializeOptions } from "./materialize";
