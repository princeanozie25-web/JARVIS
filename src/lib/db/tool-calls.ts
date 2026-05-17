import type DatabaseType from "better-sqlite3";

export type ToolCallStatus =
  | "PENDING"
  | "AWAITING_APPROVAL"
  | "EXECUTING"
  | "COMPLETED"
  | "DENIED"
  | "ERROR"
  | "TIMEOUT"
  | "CANCELLED";

export interface ToolCallRow {
  execution_id: string;
  session_id: string;
  tool_id: string;
  tool_name: string;
  status: ToolCallStatus;
  safety_tag: string;
  required_safety_tag: string;
  scope_hash: string;
  input_json: string;
  output_json: string | null;
  error_message: string | null;
  proposed_at: number;
  started_at: number | null;
  completed_at: number | null;
  timeout_ms: number;
  rollback_id: string | null;
}

export interface CreateToolCallInput {
  execution_id: string;
  session_id: string;
  tool_id: string;
  tool_name: string;
  status: ToolCallStatus;
  safety_tag: string;
  required_safety_tag: string;
  scope_hash: string;
  input_json: string;
  proposed_at: number;
  timeout_ms: number;
  output_json?: string | null;
  error_message?: string | null;
  started_at?: number | null;
  completed_at?: number | null;
  rollback_id?: string | null;
}

export type UpdateToolCallInput = Partial<
  Pick<
    ToolCallRow,
    | "status"
    | "output_json"
    | "error_message"
    | "started_at"
    | "completed_at"
    | "rollback_id"
  >
>;

export function createToolCall(
  db: DatabaseType.Database,
  input: CreateToolCallInput,
): void {
  db.prepare(
    `INSERT INTO tool_calls (
       execution_id, session_id, tool_id, tool_name, status, safety_tag,
       required_safety_tag, scope_hash, input_json, output_json, error_message,
       proposed_at, started_at, completed_at, timeout_ms, rollback_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.execution_id,
    input.session_id,
    input.tool_id,
    input.tool_name,
    input.status,
    input.safety_tag,
    input.required_safety_tag,
    input.scope_hash,
    input.input_json,
    input.output_json ?? null,
    input.error_message ?? null,
    input.proposed_at,
    input.started_at ?? null,
    input.completed_at ?? null,
    input.timeout_ms,
    input.rollback_id ?? null,
  );
}

export function updateToolCall(
  db: DatabaseType.Database,
  executionId: string,
  input: UpdateToolCallInput,
): void {
  const entries = Object.entries(input).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) return;

  const assignments = entries.map(([key]) => `${key} = ?`).join(", ");
  const values = entries.map(([, value]) => value);
  db.prepare(`UPDATE tool_calls SET ${assignments} WHERE execution_id = ?`).run(
    ...values,
    executionId,
  );
}

export function setToolCallRollbackId(
  db: DatabaseType.Database,
  executionId: string,
  rollbackId: string,
): void {
  const result = db
    .prepare("UPDATE tool_calls SET rollback_id = ? WHERE execution_id = ?")
    .run(rollbackId, executionId);
  if (result.changes !== 1) {
    throw new Error("Matching tool call row was not found.");
  }
}

export function getToolCall(
  db: DatabaseType.Database,
  executionId: string,
): ToolCallRow | undefined {
  return db
    .prepare("SELECT * FROM tool_calls WHERE execution_id = ?")
    .get(executionId) as ToolCallRow | undefined;
}

export function listToolCalls(
  db: DatabaseType.Database,
  opts: { sessionId?: string; limit?: number } = {},
): ToolCallRow[] {
  const limit = opts.limit ?? 200;
  if (opts.sessionId) {
    return db
      .prepare(
        `SELECT * FROM tool_calls
         WHERE session_id = ?
         ORDER BY proposed_at DESC
         LIMIT ?`,
      )
      .all(opts.sessionId, limit) as ToolCallRow[];
  }

  return db
    .prepare(`SELECT * FROM tool_calls ORDER BY proposed_at DESC LIMIT ?`)
    .all(limit) as ToolCallRow[];
}
