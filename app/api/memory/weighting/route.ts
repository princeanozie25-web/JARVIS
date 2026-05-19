import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { readPassiveMemoryWeighting } from "@/lib/memory-weighting";

const itemTypeSchema = z.enum(["long_term_memory", "memory_candidate"]);

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
  const itemTypeParam = url.searchParams.get("itemType");
  const itemType = itemTypeParam
    ? itemTypeSchema.safeParse(itemTypeParam)
    : null;
  if (itemType && !itemType.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid memory weighting item type" },
      { status: 400 },
    );
  }

  const limitParam = Number(url.searchParams.get("limit") ?? 100);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 200)
      : 100;

  const result = readPassiveMemoryWeighting(getDb(), {
    itemType: itemType?.success ? itemType.data : undefined,
    limit,
  });
  if (!result.ok) return blockedResponse(result);

  return NextResponse.json({
    weights: result.weights,
  });
}
