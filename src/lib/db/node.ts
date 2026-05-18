export { applyMigrations, listSchemaMigrations, SCHEMA_SQL } from "./schema";
export type { SchemaMigrationRow } from "./schema";
export { getDb, closeDb } from "./client-node";
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
export { insertTelemetryEvent, listTelemetryEvents } from "./telemetry";
export type { TelemetryRow } from "./telemetry";
export {
  deleteLongTermMemory,
  insertLongTermMemory,
  listLongTermMemory,
  normalizeMemorySearchLimit,
  searchLongTermMemory,
} from "./memory";
export type {
  InsertLongTermMemoryInput,
  SearchLongTermMemoryInput,
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
