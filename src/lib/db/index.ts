import "server-only";

export { applyMigrations, listSchemaMigrations, SCHEMA_SQL } from "./schema";
export type { SchemaMigrationRow } from "./schema";
export { getDb, closeDb } from "./client";
export {
  createSessionIfMissing,
  createSession,
  touchSession,
  getSession,
  listSessions,
} from "./sessions";
export type { SessionRow } from "./sessions";
export {
  appendMessage,
  insertMessageIfMissing,
  listMessages,
} from "./messages";
export type { MessageRole, MessageRow } from "./messages";
export {
  computeSessionSummaryHash,
  createSessionSummary,
  deleteSessionSummary,
  getLatestSessionSummary,
  getSessionSummary,
  listSessionSummaries,
  saveSessionSummary,
  updateSessionSummary,
} from "./session-summaries";
export type {
  CreateSessionSummaryInput,
  SaveSessionSummaryInput,
  SessionSummaryRow,
  UpdateSessionSummaryInput,
} from "./session-summaries";
export {
  getProjectState,
  listProjectStates,
  upsertProjectState,
} from "./project-state";
export type { ProjectStateRow, UpsertProjectStateInput } from "./project-state";
export { getRegisteredProject, listRegisteredProjects } from "./projects";
export type {
  InsertRegisteredProjectInput,
  ListRegisteredProjectsInput,
  ProjectRow,
} from "./projects";
export {
  countProjectSources,
  getProjectSource,
  insertProjectSource,
  listProjectSources,
  updateProjectSourceIndexMetadata,
} from "./project-sources";
export type {
  InsertProjectSourceInput,
  ProjectSourceRow,
} from "./project-sources";
export {
  ACTIVE_PROJECT_INDEX_SNAPSHOT_STATUSES,
  finishProjectIndexSnapshot,
  getProjectIndexSnapshot,
  hasActiveProjectIndexSnapshot,
  insertProjectIndexSnapshot,
  listProjectIndexSnapshots,
} from "./project-index-snapshots";
export type {
  InsertProjectIndexSnapshotInput,
  ProjectIndexSnapshotRow,
} from "./project-index-snapshots";
export {
  getProjectBlocker,
  getProjectBlockerByOrigin,
  getProjectArtifactCounts,
  getProjectDecision,
  getProjectTask,
  getProjectTaskByOrigin,
  getProjectThread,
  insertProjectBlocker,
  insertProjectDecision,
  insertProjectTask,
  insertProjectThread,
  listProjectBlockers,
  listProjectDecisions,
  listOpenProjectBlockers,
  listPromotedProjectTasks,
  listProjectTasks,
  listProjectThreads,
} from "./project-artifacts";
export type {
  InsertProjectBlockerInput,
  InsertProjectDecisionInput,
  InsertProjectTaskInput,
  InsertProjectThreadInput,
  ProjectArtifactCounts,
  ProjectBlockerRow,
  ProjectDecisionRow,
  ProjectTaskRow,
  ProjectThreadRow,
} from "./project-artifacts";
export {
  createMemoryCandidate,
  listMemoryCandidates,
  MEMORY_CANDIDATE_STATUSES,
  updateMemoryCandidateStatus,
} from "./memory-candidates";
export type {
  CreateMemoryCandidateInput,
  ListMemoryCandidatesInput,
  MemoryCandidateRow,
  MemoryCandidateStatus,
} from "./memory-candidates";
export {
  addPreference,
  getEffectivePreference,
  listEffectivePreferences,
  listPreferences,
  supersedePreference,
} from "./preferences";
export type {
  AddPreferenceInput,
  ListPreferencesInput,
  PreferenceRow,
  PreferenceResult,
  SupersedePreferenceInput,
  SupersedePreferenceResult,
} from "./preferences";
export {
  createGoal,
  getGoal,
  GOAL_STATUSES,
  isGoalCompletedStatus,
  listGoals,
  touchGoal,
  updateGoalStatus,
} from "./goals";
export type {
  CreateGoalInput,
  GoalMutationResult,
  GoalResult,
  GoalRow,
  GoalStatus,
  ListGoalsInput,
  UpdateGoalStatusInput,
} from "./goals";
export type { CuratorAuditRow, CuratorRecordRow } from "../curator";
export { insertTelemetryEvent, listTelemetryEvents } from "./telemetry";
export type { TelemetryRow } from "./telemetry";
export {
  deleteLongTermMemory,
  findCachedEmbeddingByContentHash,
  getLongTermMemory,
  getMemoryEmbedding,
  insertLongTermMemory,
  listMemoryEmbeddingsForVectorSync,
  listLongTermMemory,
  listLongTermMemoryByIds,
  normalizeMemorySearchLimit,
  searchLongTermMemory,
  upsertMemoryEmbedding,
} from "./memory";
export type {
  InsertLongTermMemoryInput,
  MemoryEmbeddingRow,
  SearchLongTermMemoryInput,
  UpsertMemoryEmbeddingInput,
} from "./memory";
export {
  createToolCall,
  getToolCall,
  listToolCalls,
  updateToolCall,
} from "./tool-calls";
export type {
  CreateToolCallInput,
  ToolCallRow,
  ToolCallStatus,
  UpdateToolCallInput,
} from "./tool-calls";
export {
  attachRuntimeCommandOutputRefs,
  createRuntimeCommandCall,
  getRuntimeCommandCall,
  listRuntimeCommandCalls,
  RUNTIME_COMMAND_CALL_STATUSES,
  updateRuntimeCommandCallStatus,
} from "./runtime-command-calls";
export type {
  AttachRuntimeCommandOutputRefsInput,
  CreateRuntimeCommandCallInput,
  ListRuntimeCommandCallsInput,
  RuntimeCommandCallRow,
  RuntimeCommandCallStatus,
  UpdateRuntimeCommandCallStatusInput,
} from "./runtime-command-calls";
export {
  approveApproval,
  cancelApproval,
  consumeApproval,
  createPendingApproval,
  decideApprovalByExecution,
  denyApproval,
  expirePendingApprovals,
  getApprovalByExecution,
  getActiveApproval,
  hashApprovalToken,
  recordApproval,
  verifyToolApproval,
} from "./approvals";
export type {
  ApprovalDecision,
  ApprovalLifecycleState,
  ApprovalRow,
  ApprovalVerificationResult,
  ApprovalVerificationStatus,
  ApiApprovalDecision,
  CreatePendingApprovalInput,
  PendingApproval,
  RecordApprovalInput,
} from "./approvals";
export {
  getLatestRollbackForSession,
  getLatestAvailableRollbackForSession,
  getLatestUnappliedRollbackForSession,
  getRollback,
  listRollbacks,
  markRollbackApplied,
  recordRollback,
  recordRollbackForToolCall,
} from "./rollbacks";
export type {
  RecordRollbackInput,
  RollbackKind,
  RollbackRow,
} from "./rollbacks";
