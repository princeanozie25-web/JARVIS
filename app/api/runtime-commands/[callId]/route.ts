import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getRuntimeCommandCall } from "@/lib/db/runtime-command-calls";
import { emitRuntimeApiTelemetry, runtimeApiDenied } from "../shared";

export async function GET(
  _req: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const { callId } = await context.params;
  const db = getDb();
  const call = getRuntimeCommandCall(db, callId);
  if (!call) {
    return runtimeApiDenied(db, {
      action: "detail",
      status: 404,
      reason: "not_found",
      callId,
    });
  }

  emitRuntimeApiTelemetry(db, {
    eventType: "runtime_api_request",
    success: true,
    action: "detail",
    callId,
    commandId: call.command_id,
  });
  return NextResponse.json({ ok: true, call });
}
