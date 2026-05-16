export { applyMigrations, SCHEMA_SQL } from "./schema";
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
