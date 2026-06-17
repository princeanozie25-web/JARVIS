// WorkflowBox v1a — public surface: the personal-scale project model, its single
// SQLite-backed mutation API, and conversation -> draft materialization. No UI
// (that is v1b). A clean SUBSET of the Enterprise-Brain WorkflowBox primitive.

export type {
  NodeStatus,
  EffectClass,
  NodeLayout,
  WorkNode,
  Project,
  WorkNodeInput,
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
} from "./types";

export {
  createProject,
  getProject,
  listProjects,
  addNode,
  updateNode,
  removeNode,
  removeProject,
  findDependencyCycle,
  WorkflowBoxError,
} from "./store";
export type { WorkflowBoxErrorCode, WorkflowBoxOptions } from "./store";

export {
  materializeProjectFromConversation,
  draftToCreateInput,
} from "./materialize";
export type { MaterializeOptions } from "./materialize";
