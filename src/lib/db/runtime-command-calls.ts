import type DatabaseType from "better-sqlite3";
import type { ReversibilityClass } from "../tools/types";
import { insertTelemetryEvent } from "./telemetry";

export const RUNTIME_COMMAND_CALL_STATUSES = [
  "pending",
  "approved",
  "denied",
  "running",
  "completed",
  "failed",
  "timeout",
  "cancelled",
] as const;

export type RuntimeCommandCallStatus =
  (typeof RUNTIME_COMMAND_CALL_STATUSES)[number];

export interface RuntimeCommandCallRow {
  id: string;
  session_id: string;
  command_id: string;
  command: string;
  argv_json: string;
  working_directory: string;
  required_safety_tag: string;
  reversibility_class: ReversibilityClass;
  status: RuntimeCommandCallStatus;
  proposed_at: number;
  approved_at: number | null;
  started_at: number | null;
  completed_at: number | null;
  stdout_ref: string | null;
  stderr_ref: string | null;
  exit_code: number | null;
  error_class: string | null;
  error_message: string | null;
}

export interface CreateRuntimeCommandCallInput {
  id: string;
  sessionId: string;
  commandId: string;
  command: string;
  argv: string[];
  workingDirectory: string;
  requiredSafetyTag: string;
  reversibilityClass: ReversibilityClass;
  status?: RuntimeCommandCallStatus;
  proposedAt: number;
  approvedAt?: number | null;
  startedAt?: number | null;
  completedAt?: number | null;
  stdoutRef?: string | null;
  stderrRef?: string | null;
  exitCode?: number | null;
  errorClass?: string | null;
  errorMessage?: string | null;
}

export interface ListRuntimeCommandCallsInput {
  sessionId?: string;
  commandId?: string;
  status?: RuntimeCommandCallStatus;
  limit?: number;
}

export interface UpdateRuntimeCommandCallStatusInput {
  status: RuntimeCommandCallStatus;
  at?: number;
  exitCode?: number | null;
  errorClass?: string | null;
  errorMessage?: string | null;
}

export interface AttachRuntimeCommandOutputRefsInput {
  stdoutRef?: string | null;
  stderrRef?: string | null;
}

function requireRuntimeCommandCallStatus(
  status: string,
): RuntimeCommandCallStatus {
  if (
    !RUNTIME_COMMAND_CALL_STATUSES.includes(status as RuntimeCommandCallStatus)
  ) {
    throw new Error(`Invalid runtime command call status: ${status}`);
  }
  return status as RuntimeCommandCallStatus;
}

function requireTrimmed(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return 200;
  if (!Number.isFinite(limit)) return 200;
  return Math.min(Math.max(Math.trunc(limit), 1), 500);
}

function emitRuntimeCommandCallTelemetry(
  db: DatabaseType.Database,
  input: {
    eventType:
      | "runtime_command_call_created"
      | "runtime_command_call_updated"
      | "runtime_command_output_ref_attached";
    timestamp: number;
    success: boolean;
    callId: string;
    commandId?: string;
    status?: RuntimeCommandCallStatus;
  },
): void {
  insertTelemetryEvent(db, {
    timestamp: input.timestamp,
    event_type: input.eventType,
    success: input.success,
    execution_id: input.callId,
    tool_name: input.commandId,
    notes: [
      `call_id=${input.callId}`,
      input.commandId ? `command_id=${input.commandId}` : undefined,
      input.status ? `status=${input.status}` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
  });
}

export function createRuntimeCommandCall(
  db: DatabaseType.Database,
  input: CreateRuntimeCommandCallInput,
): RuntimeCommandCallRow {
  const status = requireRuntimeCommandCallStatus(input.status ?? "pending");
  const row = {
    id: requireTrimmed(input.id, "id"),
    session_id: requireTrimmed(input.sessionId, "sessionId"),
    command_id: requireTrimmed(input.commandId, "commandId"),
    command: requireTrimmed(input.command, "command"),
    argv_json: JSON.stringify(input.argv),
    working_directory: requireTrimmed(
      input.workingDirectory,
      "workingDirectory",
    ),
    required_safety_tag: requireTrimmed(
      input.requiredSafetyTag,
      "requiredSafetyTag",
    ),
    reversibility_class: input.reversibilityClass,
    status,
    proposed_at: input.proposedAt,
    approved_at: input.approvedAt ?? null,
    started_at: input.startedAt ?? null,
    completed_at: input.completedAt ?? null,
    stdout_ref: input.stdoutRef ?? null,
    stderr_ref: input.stderrRef ?? null,
    exit_code: input.exitCode ?? null,
    error_class: input.errorClass ?? null,
    error_message: input.errorMessage ?? null,
  } satisfies RuntimeCommandCallRow;

  db.prepare(
    `INSERT INTO runtime_command_calls (
       id, session_id, command_id, command, argv_json, working_directory,
       required_safety_tag, reversibility_class, status, proposed_at,
       approved_at, started_at, completed_at, stdout_ref, stderr_ref,
       exit_code, error_class, error_message
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.session_id,
    row.command_id,
    row.command,
    row.argv_json,
    row.working_directory,
    row.required_safety_tag,
    row.reversibility_class,
    row.status,
    row.proposed_at,
    row.approved_at,
    row.started_at,
    row.completed_at,
    row.stdout_ref,
    row.stderr_ref,
    row.exit_code,
    row.error_class,
    row.error_message,
  );

  emitRuntimeCommandCallTelemetry(db, {
    eventType: "runtime_command_call_created",
    timestamp: row.proposed_at,
    success: true,
    callId: row.id,
    commandId: row.command_id,
    status: row.status,
  });

  return row;
}

export function getRuntimeCommandCall(
  db: DatabaseType.Database,
  id: string,
): RuntimeCommandCallRow | undefined {
  return db
    .prepare("SELECT * FROM runtime_command_calls WHERE id = ?")
    .get(id) as RuntimeCommandCallRow | undefined;
}

export function listRuntimeCommandCalls(
  db: DatabaseType.Database,
  input: ListRuntimeCommandCallsInput = {},
): RuntimeCommandCallRow[] {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (input.sessionId) {
    where.push("session_id = ?");
    params.push(input.sessionId);
  }
  if (input.commandId) {
    where.push("command_id = ?");
    params.push(input.commandId);
  }
  if (input.status) {
    where.push("status = ?");
    params.push(requireRuntimeCommandCallStatus(input.status));
  }

  return db
    .prepare(
      `SELECT *
       FROM runtime_command_calls
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY proposed_at DESC
       LIMIT ?`,
    )
    .all(...params, normalizeLimit(input.limit)) as RuntimeCommandCallRow[];
}

export function updateRuntimeCommandCallStatus(
  db: DatabaseType.Database,
  id: string,
  input: UpdateRuntimeCommandCallStatusInput,
): RuntimeCommandCallRow | undefined {
  const status = requireRuntimeCommandCallStatus(input.status);
  const at = input.at ?? Date.now();
  const approvedAt = status === "approved" ? at : undefined;
  const startedAt = status === "running" ? at : undefined;
  const completedAt = [
    "completed",
    "failed",
    "timeout",
    "cancelled",
    "denied",
  ].includes(status)
    ? at
    : undefined;

  db.prepare(
    `UPDATE runtime_command_calls
     SET status = ?,
         approved_at = COALESCE(?, approved_at),
         started_at = COALESCE(?, started_at),
         completed_at = COALESCE(?, completed_at),
         exit_code = COALESCE(?, exit_code),
         error_class = COALESCE(?, error_class),
         error_message = COALESCE(?, error_message)
     WHERE id = ?`,
  ).run(
    status,
    approvedAt ?? null,
    startedAt ?? null,
    completedAt ?? null,
    input.exitCode ?? null,
    input.errorClass ?? null,
    input.errorMessage ?? null,
    id,
  );

  const row = getRuntimeCommandCall(db, id);
  if (row) {
    emitRuntimeCommandCallTelemetry(db, {
      eventType: "runtime_command_call_updated",
      timestamp: at,
      success: true,
      callId: row.id,
      commandId: row.command_id,
      status: row.status,
    });
  }
  return row;
}

export function attachRuntimeCommandOutputRefs(
  db: DatabaseType.Database,
  id: string,
  input: AttachRuntimeCommandOutputRefsInput,
): RuntimeCommandCallRow | undefined {
  db.prepare(
    `UPDATE runtime_command_calls
     SET stdout_ref = COALESCE(?, stdout_ref),
         stderr_ref = COALESCE(?, stderr_ref)
     WHERE id = ?`,
  ).run(input.stdoutRef ?? null, input.stderrRef ?? null, id);

  const row = getRuntimeCommandCall(db, id);
  if (row) {
    emitRuntimeCommandCallTelemetry(db, {
      eventType: "runtime_command_output_ref_attached",
      timestamp: Date.now(),
      success: true,
      callId: row.id,
      commandId: row.command_id,
      status: row.status,
    });
  }
  return row;
}
