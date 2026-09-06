import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  decideAsOperator,
  isOperatorRequestAllowed,
} from "@/lib/approvals/operator-decisions";
import { recordEvent } from "@/lib/telemetry";
import { toolRuntime } from "@/lib/tools";

// E-046 — the operator decides a pending approval from a loopback surface.
// Verifies the view-bound decision token + the hash the operator saw, then
// enters the frozen `resumeApproval` (token check, FC-2 revalidation, the same
// runtime.runTool call site the chat inlet uses). Rejections are uniform.

const DecideSchema = z.object({
  decision: z.enum(["APPROVED_ONCE", "APPROVED_SESSION", "DENIED"]),
  decisionToken: z.string().min(16).max(200),
  boundHash: z.string().min(1).max(200),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ executionId: string }> },
) {
  if (!isOperatorRequestAllowed(req, { mutating: true })) {
    return NextResponse.json(
      { ok: false, message: "request denied" },
      { status: 403 },
    );
  }
  const { executionId } = await context.params;
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "request denied" },
      { status: 401 },
    );
  }
  const parsed = DecideSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "request denied" },
      { status: 401 },
    );
  }
  const result = await decideAsOperator({
    db: getDb(),
    runtime: toolRuntime,
    executionId,
    decision: parsed.data.decision,
    decisionToken: parsed.data.decisionToken,
    boundHash: parsed.data.boundHash,
    signal: req.signal,
    recordEvent,
  });
  return NextResponse.json(result.body, { status: result.httpStatus });
}
