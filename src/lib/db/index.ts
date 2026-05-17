import "server-only";

export { applyMigrations, SCHEMA_SQL } from "./schema";
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
export { insertTelemetryEvent, listTelemetryEvents } from "./telemetry";
export type { TelemetryRow } from "./telemetry";
export { createToolCall, listToolCalls, updateToolCall } from "./tool-calls";
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
  denyApproval,
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
  CreatePendingApprovalInput,
  PendingApproval,
  RecordApprovalInput,
} from "./approvals";
export { listRollbacks, recordRollback } from "./rollbacks";
export type {
  RecordRollbackInput,
  RollbackKind,
  RollbackRow,
} from "./rollbacks";
