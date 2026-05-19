import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { denyRuntimeCommandCall } from "@/lib/runtime-commands";
import { emitRuntimeApiTelemetry, runtimeApiDenied } from "../../shared";

const denySchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const { callId } = await context.params;
  const db = getDb();
  const parsed = denySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return runtimeApiDenied(db, {
      action: "deny",
      status: 400,
      reason: "invalid_request",
      callId,
    });
  }

  const result = denyRuntimeCommandCall(db, {
    callId,
    reason: parsed.data.reason,
  });
  if (!result.ok) {
    return runtimeApiDenied(db, {
      action: "deny",
      status: result.status === "not_found" ? 404 : 409,
      reason: result.reason,
      callId,
    });
  }

  emitRuntimeApiTelemetry(db, {
    eventType: "runtime_api_request",
    success: true,
    action: "deny",
    callId,
    commandId: result.call.command_id,
  });
  return NextResponse.json({ ok: true, call: result.call });
}
