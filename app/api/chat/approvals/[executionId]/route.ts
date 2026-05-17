import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { resumeApproval } from "@/lib/chat/tool-approvals";
import { recordEvent } from "@/lib/telemetry";
import { toolRuntime } from "@/lib/tools";

const ApprovalRequestSchema = z.object({
  decision: z.enum(["APPROVED_ONCE", "APPROVED_SESSION", "DENIED"]),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await context.params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = ApprovalRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid request body.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const result = await resumeApproval({
    db: getDb(),
    runtime: toolRuntime,
    executionId,
    decision: parsed.data.decision,
    signal: req.signal,
    recordEvent,
  });

  return NextResponse.json(result.body, { status: result.httpStatus });
}
