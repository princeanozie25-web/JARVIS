"use server";

// E-047 — the cockpit Human Gate's server transport: two Next server actions
// (the E-019/E-020 pattern), so the cockpit component never fetches or polls.
//   read   -> the operator's pending rows (E-046 listPendingForOperator),
//             mapped to a serializable view with the channels kept apart
//   decide -> E-046 decideAsOperator -> the frozen resumeApproval -> the same
//             runtime.runTool site the chat inlet uses
// Server actions are same-origin by construction (Next's action CSRF check),
// which is the EoP-17 control for this transport.

// The DB / runtime / telemetry modules carry Next's `server-only` guard and
// are loaded lazily INSIDE the actions, so importing the page (which existing
// tests render under vitest) stays inert — the E-019/E-020 actions' discipline.
import type {
  CockpitGateDecideInput,
  CockpitGateOutcome,
  CockpitGateView,
} from "@/components/working/gate-view";

function trustedEffect(row: {
  canonical_effect_json: string | null;
  tool_id: string;
  bound_hash: string;
}): string {
  if (row.canonical_effect_json) {
    try {
      const effect = JSON.parse(row.canonical_effect_json) as Record<
        string,
        unknown
      >;
      const parts = ["capability", "mutation_type", "risk_class", "target"]
        .map((k) =>
          typeof effect[k] === "string" ? `${k}=${effect[k] as string}` : null,
        )
        .filter(Boolean);
      if (parts.length > 0) return parts.join(" · ");
    } catch {
      // fall through to the tool/scope statement
    }
  }
  return `${row.tool_id} · scope ${row.bound_hash.slice(0, 12)}`;
}

export async function readOperatorGateAction(): Promise<CockpitGateView> {
  const [{ listPendingForOperator }, { getDb }] = await Promise.all([
    import("@/lib/approvals/operator-decisions"),
    import("@/lib/db"),
  ]);
  const now = Date.now();
  const rows = listPendingForOperator(getDb(), now);
  return {
    provenance: "live",
    readAt: now,
    rows: rows.map((r) => ({
      executionId: r.execution_id,
      toolId: r.tool_id,
      toolName: r.tool_name ?? r.tool_id,
      safetyTag: r.required_safety_tag ?? "CONFIRM",
      canonicalEffect: trustedEffect(r),
      untrustedClientText: r.untrusted_client_text,
      boundHash: r.bound_hash,
      decisionToken: r.decision_token,
      expiresAt: r.expires_at,
      operatorTokenAvailable: r.operator_token_available,
    })),
  };
}

export async function decideOperatorGateAction(
  input: CockpitGateDecideInput,
): Promise<CockpitGateOutcome> {
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
    reason?: string;
    message?: string;
  };
  return {
    ok: body.ok,
    ...(body.status ? { status: body.status } : {}),
    ...(body.reason ? { reason: body.reason } : {}),
    message:
      body.message ?? (body.ok ? "Decision applied." : "Decision rejected."),
  };
}
