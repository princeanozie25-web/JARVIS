import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  RUNTIME_COMMAND_CALL_STATUSES,
  listRuntimeCommandCalls,
} from "@/lib/db/runtime-command-calls";
import {
  getRuntimeCommand,
  getRuntimeWorkspaceConfig,
  listRuntimeCommands,
  proposeRuntimeCommandCall,
} from "@/lib/runtime-commands";
import { emitRuntimeApiTelemetry, runtimeApiDenied } from "./shared";

const proposeRuntimeCommandSchema = z.object({
  sessionId: z.string().trim().min(1),
  commandId: z.string().trim().min(1),
  argv: z.array(z.string()).optional(),
  workingDirectory: z.string().trim().min(1).optional(),
});

const listRuntimeCommandCallsSchema = z.object({
  status: z.enum(RUNTIME_COMMAND_CALL_STATUSES).optional(),
  commandId: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export async function GET(req: Request) {
  const db = getDb();
  const url = new URL(req.url);
  const parsed = listRuntimeCommandCallsSchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    commandId: url.searchParams.get("commandId") ?? undefined,
    sessionId: url.searchParams.get("sessionId") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return runtimeApiDenied(db, {
      action: "list",
      status: 400,
      reason: "invalid_request",
    });
  }

  emitRuntimeApiTelemetry(db, {
    eventType: "runtime_api_request",
    success: true,
    action: "list",
  });
  return NextResponse.json({
    commands: listRuntimeCommands({ db }),
    calls: listRuntimeCommandCalls(db, parsed.data),
    workspaceRoot: getRuntimeWorkspaceConfig().workspaceRoot,
  });
}

export async function POST(req: Request) {
  const db = getDb();
  const parsed = proposeRuntimeCommandSchema.safeParse(await req.json());
  if (!parsed.success) {
    return runtimeApiDenied(db, {
      action: "propose",
      status: 400,
      reason: "invalid_request",
    });
  }

  let workingDirectory = parsed.data.workingDirectory;
  try {
    const spec = getRuntimeCommand(parsed.data.commandId, { db });
    workingDirectory ??=
      spec.workingDirectoryPolicy.type === "repo_root" ? "repo_root" : "none";
  } catch {
    return runtimeApiDenied(db, {
      action: "propose",
      status: 404,
      reason: "command_not_found",
      commandId: parsed.data.commandId,
    });
  }

  const result = proposeRuntimeCommandCall(db, {
    sessionId: parsed.data.sessionId,
    commandId: parsed.data.commandId,
    argv: parsed.data.argv,
    workingDirectory,
  });
  if (!result.ok) {
    return runtimeApiDenied(db, {
      action: "propose",
      status: result.status === "disabled" ? 403 : 400,
      reason: result.reason,
      commandId: parsed.data.commandId,
    });
  }

  emitRuntimeApiTelemetry(db, {
    eventType: "runtime_api_request",
    success: true,
    action: "propose",
    callId: result.callId,
    commandId: result.call.command_id,
  });
  return NextResponse.json(
    {
      ok: true,
      callId: result.callId,
      call: result.call,
      approval: result.approval,
    },
    { status: 201 },
  );
}
