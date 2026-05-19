import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getDb,
  getGoal,
  GOAL_STATUSES,
  touchGoal,
  updateGoalStatus,
} from "@/lib/db";

const updateGoalSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    status: z.enum(GOAL_STATUSES),
    completedAt: z.number().int().positive().nullable().optional(),
  }),
  z.object({
    action: z.literal("touch"),
  }),
]);

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

function notFoundResponse(id: string) {
  return NextResponse.json(
    { ok: false, status: "not_found", id },
    { status: 404 },
  );
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = getGoal(getDb(), id, {
    accessContext: {
      caller: "api.goals",
      feature_id: "goals",
      purpose: "get_goal",
      personal_context: true,
    },
  });
  if (!result.ok) return blockedResponse(result);
  if (!result.value) return notFoundResponse(id);

  return NextResponse.json({
    goal: result.value,
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = updateGoalSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result =
    parsed.data.action === "touch"
      ? touchGoal(getDb(), id, {
          writeContext: {
            origin: "user_ui",
            feature_id: "goals",
            operation: "touch_goal",
            approved_manual_flow: true,
          },
        })
      : updateGoalStatus(getDb(), id, {
          status: parsed.data.status,
          completedAt: parsed.data.completedAt,
          writeContext: {
            origin: "user_ui",
            feature_id: "goals",
            operation: "update_goal_status",
            approved_manual_flow: true,
          },
        });

  if (!result.ok) {
    if (result.status === "blocked") return blockedResponse(result);
    return notFoundResponse(result.id);
  }

  return NextResponse.json({
    ok: true,
    goal: result.value,
  });
}
