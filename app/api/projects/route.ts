import { NextResponse } from "next/server";
import { getDb, getProjectState, listProjectStates } from "@/lib/db";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId")?.trim();
  const limitParam = Number(url.searchParams.get("limit") ?? 50);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 100)
      : 50;

  if (projectId) {
    return NextResponse.json({
      project: getProjectState(getDb(), projectId) ?? null,
    });
  }

  return NextResponse.json({
    projects: listProjectStates(getDb(), { limit }),
  });
}
