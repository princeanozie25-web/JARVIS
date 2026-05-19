import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { readTimelineIndex, TIMELINE_ENTRY_TYPES } from "@/lib/timeline";

const timelineTypeSchema = z.enum(TIMELINE_ENTRY_TYPES);

function blockedResponse(result: { reason: string; featureId: string }) {
  return NextResponse.json(
    {
      ok: false,
      status: "blocked",
      featureId: result.featureId,
      reason: result.reason,
    },
    { status: 403 },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const typeParam = url.searchParams.get("type");
  const type = typeParam ? timelineTypeSchema.safeParse(typeParam) : null;
  if (type && !type.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid timeline type" },
      { status: 400 },
    );
  }

  const limitParam = Number(url.searchParams.get("limit") ?? 100);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 200)
      : 100;
  const project = url.searchParams.get("project")?.trim() || undefined;

  const result = readTimelineIndex(getDb(), {
    type: type?.success ? type.data : undefined,
    project,
    limit,
  });
  if (!result.ok) return blockedResponse(result);

  return NextResponse.json({
    entries: result.entries,
  });
}
