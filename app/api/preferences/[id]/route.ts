import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, supersedePreference } from "@/lib/db";

const supersedePreferenceSchema = z.object({
  value: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  effectiveFrom: z.number().int().positive().optional(),
});

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

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = supersedePreferenceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = supersedePreference(getDb(), id, {
    value: parsed.data.value,
    category: parsed.data.category,
    effectiveFrom: parsed.data.effectiveFrom,
    writeContext: {
      origin: "user_ui",
      feature_id: "preferences",
      operation: "supersede_preference",
      approved_manual_flow: true,
    },
  });

  if (!result.ok) {
    if (result.status === "blocked") return blockedResponse(result);
    return NextResponse.json(
      { ok: false, status: "not_found", id: result.id },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    preference: result.value,
  });
}
