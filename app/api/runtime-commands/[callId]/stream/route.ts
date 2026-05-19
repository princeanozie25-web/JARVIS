import { getDb } from "@/lib/db";
import { getRuntimeCommandCall } from "@/lib/db/runtime-command-calls";
import { streamRuntimeCommandExecution } from "@/lib/runtime-commands";
import { emitRuntimeApiTelemetry, runtimeApiDenied } from "../../shared";

export async function POST(
  _req: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const { callId } = await context.params;
  const db = getDb();
  const call = getRuntimeCommandCall(db, callId);
  if (!call) {
    return runtimeApiDenied(db, {
      action: "stream",
      status: 404,
      reason: "not_found",
      callId,
    });
  }
  if (call.status !== "approved") {
    return runtimeApiDenied(db, {
      action: "stream",
      status: 409,
      reason: "Runtime command call must be approved before execution.",
      callId,
      commandId: call.command_id,
    });
  }

  const runtimeStream = streamRuntimeCommandExecution(db, { callId });
  const encoder = new TextEncoder();

  emitRuntimeApiTelemetry(db, {
    eventType: "runtime_api_request",
    success: true,
    action: "stream",
    callId,
  });

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runtimeStream.events) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
        await runtimeStream.result;
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ callId: string }> },
) {
  const accept = req.headers.get("accept") ?? "";
  if (!accept.includes("application/x-ndjson") && !accept.includes("*/*")) {
    const { callId } = await context.params;
    return runtimeApiDenied(getDb(), {
      action: "stream",
      status: 406,
      reason: "ndjson_required",
      callId,
    });
  }
  return POST(req, context);
}
