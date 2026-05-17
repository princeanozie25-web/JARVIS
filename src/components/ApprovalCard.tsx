import type { ApiApprovalDecision } from "@/lib/db/node";
import type { SafetyTag } from "@/lib/router";

export interface ApprovalCardDetails {
  executionId: string;
  toolId: string;
  toolName: string;
  scopeHash: string;
  requiredSafetyTag: SafetyTag;
  safetyTag: SafetyTag;
  summary: string;
  approvalExpiresAt: number;
  approvalToken: string;
  status: "pending" | "submitting" | "approved" | "denied" | "expired";
}

export interface ApprovalCardProps {
  approval: ApprovalCardDetails;
  onDecision: (decision: ApiApprovalDecision) => void;
}

export function ApprovalCard({ approval, onDecision }: ApprovalCardProps) {
  const disabled = approval.status !== "pending";
  const allowSessionApproval = approval.requiredSafetyTag !== "CONFIRM_ALWAYS";

  return (
    <div className="mt-3 border border-amber-500/50 bg-amber-950/40 p-4 rounded-lg">
      <p className="text-sm text-amber-200 uppercase mb-2">Tool approval</p>
      <div className="space-y-1 text-sm text-amber-50">
        <p className="font-semibold">{approval.toolName}</p>
        <p className="text-amber-100 break-words">{approval.summary}</p>
        <p className="text-amber-200 break-words">
          Scope: {approval.scopeHash}
        </p>
        <p className="text-amber-200">
          Safety: {approval.safetyTag} -&gt; {approval.requiredSafetyTag}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDecision("APPROVED_ONCE")}
          className="rounded-lg bg-white text-black px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Approve Once
        </button>
        {allowSessionApproval ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onDecision("APPROVED_SESSION")}
            className="rounded-lg bg-amber-300 text-black px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Approve Session
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDecision("DENIED")}
          className="rounded-lg border border-amber-300 text-amber-100 px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
