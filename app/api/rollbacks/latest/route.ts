import { NextResponse } from "next/server";
import { getDb, listRollbacks } from "@/lib/db";
import { latestAvailableRollback } from "@/lib/rollbacks/visibility";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json(
      { message: "sessionId is required." },
      { status: 400 },
    );
  }

  const latest = latestAvailableRollback(
    listRollbacks(getDb(), { sessionId, limit: 100 }),
  );

  return NextResponse.json({ sessionId, latest });
}
