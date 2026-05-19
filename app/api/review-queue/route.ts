import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  dismissReviewItem,
  HUMAN_REVIEW_STATUSES,
  listReviewItems,
  updateReviewItemStatus,
} from "@/lib/human-review";

const statusSchema = z.enum(HUMAN_REVIEW_STATUSES);

const updateSchema = z.object({
  id: z.string().trim().min(1).max(500),
  status: statusSchema,
  decisionReason: z.string().trim().max(1_000).optional().nullable(),
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
  const statusParam = url.searchParams.get("status");
  const parsedStatus = statusParam ? statusSchema.safeParse(statusParam) : null;

  if (parsedStatus && !parsedStatus.success) {
    return NextResponse.json(
      { ok: false, error: "invalid status" },
      { status: 400 },
    );
  }

  const result = listReviewItems(getDb(), {
    limit,
    status: parsedStatus?.success ? parsedStatus.data : undefined,
  });
  if (!result.ok) return blockedResponse(result);

  return NextResponse.json({ items: result.value });
}

export async function PATCH(req: Request) {
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = getDb();
  const body = parsed.data;
  const result =
    body.status === "dismissed"
      ? dismissReviewItem(db, {
          id: body.id,
          decisionReason: body.decisionReason,
        })
      : updateReviewItemStatus(db, {
          id: body.id,
          status: body.status,
          decisionReason: body.decisionReason,
        });

  if (!result.ok) return blockedResponse(result);
  return NextResponse.json({ ok: true, item: result.value });
}
