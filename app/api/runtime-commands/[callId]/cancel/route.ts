import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { cancelRuntimeCommandCall } from "@/lib/runtime-commands";
import { emitRuntimeApiTelemetry, runtimeApiDenied } from "../../shared";

export async function POST(
  _req: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const { callId } = await context.params;
  const db = getDb();
  const cancelled = cancelRuntimeCommandCall({ commandCallId: callId, db });
  if (!cancelled) {
    return runtimeApiDenied(db, {
      action: "cancel",
      status: 404,
      reason: "active_runtime_command_not_found",
      callId,
    });
  }

  emitRuntimeApiTelemetry(db, {
    eventType: "runtime_api_request",
    success: true,
    action: "cancel",
    callId,
  });
  return NextResponse.json({ ok: true, context: cancelled });
}
