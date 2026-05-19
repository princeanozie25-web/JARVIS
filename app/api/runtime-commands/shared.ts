import { NextResponse } from "next/server";
import type DatabaseType from "better-sqlite3";
import { insertTelemetryEvent } from "@/lib/db/telemetry";

export function emitRuntimeApiTelemetry(
  db: DatabaseType.Database,
  input: {
    eventType: "runtime_api_request" | "runtime_api_denied";
    success: boolean;
    action: string;
    callId?: string;
    commandId?: string;
    reason?: string;
  },
): void {
  insertTelemetryEvent(db, {
    timestamp: Date.now(),
    event_type: input.eventType,
    success: input.success,
    execution_id: input.callId,
    tool_name: input.commandId,
    notes: [
      `action=${input.action}`,
      input.callId ? `call_id=${input.callId}` : undefined,
      input.commandId ? `command_id=${input.commandId}` : undefined,
      input.reason ? `reason=${input.reason}` : undefined,
    ]
      .filter(Boolean)
      .join(" "),
  });
}

export function runtimeApiDenied(
  db: DatabaseType.Database,
  input: {
    action: string;
    status: number;
    reason: string;
    callId?: string;
    commandId?: string;
  },
) {
  emitRuntimeApiTelemetry(db, {
    eventType: "runtime_api_denied",
    success: false,
    action: input.action,
    callId: input.callId,
    commandId: input.commandId,
    reason: input.reason,
  });
  return NextResponse.json(
    {
      ok: false,
      status: "denied",
      reason: input.reason,
    },
    { status: input.status },
  );
}
