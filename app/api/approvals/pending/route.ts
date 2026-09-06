import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  isOperatorRequestAllowed,
  listPendingForOperator,
} from "@/lib/approvals/operator-decisions";

// E-046 — the operator's view of the Human Gate queue: trusted canonical
// effect + fenced untrusted text + a per-row, single-use decision token bound
// to the hash the operator is looking at. Loopback + same-origin only.

export async function GET(req: Request) {
  if (!isOperatorRequestAllowed(req, { mutating: false })) {
    return NextResponse.json(
      { ok: false, message: "request denied" },
      { status: 403 },
    );
  }
  const pending = listPendingForOperator(getDb(), Date.now());
  return NextResponse.json({ ok: true, pending, metadata_only: true });
}
