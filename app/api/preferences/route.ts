import { NextResponse } from "next/server";
import { z } from "zod";
import {
  addPreference,
  getDb,
  listEffectivePreferences,
  listPreferences,
} from "@/lib/db";

const addPreferenceSchema = z.object({
  key: z.string().trim().min(1),
  value: z.string().trim().min(1),
  category: z.string().trim().min(1),
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 100);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 200)
      : 100;
  const db = getDb();

  const history = listPreferences(db, {
    includeSuperseded: true,
    limit,
  });
  if (!history.ok) return blockedResponse(history);

  const current = listEffectivePreferences(db, { limit });
  if (!current.ok) return blockedResponse(current);

  return NextResponse.json({
    preferences: history.value,
    current: current.value,
  });
}

export async function POST(req: Request) {
  const parsed = addPreferenceSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const created = addPreference(getDb(), {
    key: parsed.data.key,
    value: parsed.data.value,
    category: parsed.data.category,
    effectiveFrom: parsed.data.effectiveFrom,
  });

  if (!created.ok) return blockedResponse(created);

  return NextResponse.json({
    ok: true,
    preference: created.value,
  });
}
