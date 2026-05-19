import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoal, getDb, GOAL_STATUSES, listGoals } from "@/lib/db";

const createGoalSchema = z.object({
  title: z.string().trim().min(1),
  parentId: z.string().trim().min(1).nullable().optional(),
});

const goalStatusSchema = z.enum(GOAL_STATUSES);

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
  const statusParam = url.searchParams.get("status");
  const status = statusParam ? goalStatusSchema.safeParse(statusParam) : null;
  if (status && !status.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid goal status" },
      { status: 400 },
    );
  }

  const limitParam = Number(url.searchParams.get("limit") ?? 100);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 200)
      : 100;

  const result = listGoals(getDb(), {
    status: status?.success ? status.data : undefined,
    limit,
    accessContext: {
      caller: "api.goals",
      feature_id: "goals",
      purpose: "list_goals",
      personal_context: true,
    },
  });
  if (!result.ok) return blockedResponse(result);

  return NextResponse.json({
    goals: result.value,
  });
}

export async function POST(req: Request) {
  const parsed = createGoalSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = createGoal(getDb(), {
    title: parsed.data.title,
    parentId: parsed.data.parentId,
  });
  if (!result.ok) return blockedResponse(result);

  return NextResponse.json({
    ok: true,
    goal: result.value,
  });
}
