import { NextResponse } from "next/server";
import { getDb, listRollbacks } from "@/lib/db";
import { summarizeRollback } from "@/lib/rollbacks/visibility";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json(
      { message: "sessionId is required." },
      { status: 400 },
    );
  }

  const limit = Number(url.searchParams.get("limit") ?? "20");
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), 100)
    : 20;
  const rollbacks = listRollbacks(getDb(), {
    sessionId,
    limit: safeLimit,
  }).map((row) => summarizeRollback(row));

  return NextResponse.json({ sessionId, rollbacks });
}
