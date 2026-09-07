"use server";
// Presence · the one write the screen can make: answer a "needs you".
// A server action, so it never depends on the webview's fetch metadata
// headers; the decision still enters the frozen operator path
// (decideAsOperator → resumeApproval) with the view-bound token and hash.
export interface PresenceDecideInput {
  executionId: string;
  decision: "APPROVED_ONCE" | "DENIED";
  decisionToken: string;
  boundHash: string;
}

export interface PresenceDecideOutcome {
  ok: boolean;
  status?: string;
  message: string;
}

export async function decidePresenceAction(
  input: PresenceDecideInput,
): Promise<PresenceDecideOutcome> {
  const [{ decideAsOperator }, { getDb }, { recordEvent }, { toolRuntime }] =
    await Promise.all([
      import("@/lib/approvals/operator-decisions"),
      import("@/lib/db"),
      import("@/lib/telemetry"),
      import("@/lib/tools"),
    ]);
  const result = await decideAsOperator({
    db: getDb(),
    runtime: toolRuntime,
    executionId: input.executionId,
    decision: input.decision,
    decisionToken: input.decisionToken,
    boundHash: input.boundHash,
    recordEvent,
  });
  const body = result.body as {
    ok: boolean;
    status?: string;
    message?: string;
  };
  return {
    ok: body.ok,
    ...(body.status ? { status: body.status } : {}),
    message: body.message ?? (body.ok ? "Done." : "That did not go through."),
  };
}
