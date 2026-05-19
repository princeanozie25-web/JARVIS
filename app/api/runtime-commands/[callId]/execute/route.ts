import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { executeRuntimeCommand } from "@/lib/runtime-commands";
import { emitRuntimeApiTelemetry, runtimeApiDenied } from "../../shared";

export async function POST(
  _req: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const { callId } = await context.params;
  const db = getDb();
  const result = await executeRuntimeCommand(db, { callId });
  if (!result.ok) {
    return runtimeApiDenied(db, {
      action: "execute",
      status: result.status === "not_found" ? 404 : 409,
      reason: result.reason,
      callId,
      commandId: result.call?.command_id,
    });
  }

  emitRuntimeApiTelemetry(db, {
    eventType: "runtime_api_request",
    success: true,
    action: "execute",
    callId,
    commandId: result.call.command_id,
  });
  return NextResponse.json({ ok: true, result });
}
