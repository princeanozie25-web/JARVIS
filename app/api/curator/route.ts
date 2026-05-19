import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  applyCuratorAction,
  archiveCuratorTarget,
  mergeSummaries,
  readCuratorWorkspace,
  safeDeleteCuratorTarget,
  splitSummaryIntoManualNotes,
} from "@/lib/curator";

const targetTypeSchema = z.enum(["summary", "candidate", "curator_record"]);

const curatorActionSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.enum(["mark_important", "demote"]),
    targetType: targetTypeSchema,
    targetId: z.string().trim().min(1).max(300),
  }),
  z.object({
    operation: z.literal("archive"),
    targetType: targetTypeSchema,
    targetId: z.string().trim().min(1).max(300),
  }),
  z.object({
    operation: z.literal("delete"),
    targetType: targetTypeSchema,
    targetId: z.string().trim().min(1).max(300),
  }),
  z.object({
    operation: z.literal("merge_summaries"),
    summaryHashes: z.array(z.string().trim().min(1).max(300)).min(2).max(10),
    title: z.string().trim().min(1).max(200),
    mergedText: z.string().trim().min(1).max(10_000),
  }),
  z.object({
    operation: z.literal("split_summary"),
    summaryHash: z.string().trim().min(1).max(300),
    notes: z
      .array(
        z.object({
          title: z.string().trim().min(1).max(200),
          content: z.string().trim().min(1).max(5_000),
        }),
      )
      .min(1)
      .max(10),
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 50);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 100)
      : 50;

  const result = readCuratorWorkspace(getDb(), { limit });
  if (!result.ok) return blockedResponse(result);

  return NextResponse.json(result.value);
}

export async function POST(req: Request) {
  const parsed = curatorActionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const db = getDb();
  const body = parsed.data;
  const result = (() => {
    switch (body.operation) {
      case "mark_important":
      case "demote":
        return applyCuratorAction(db, {
          action: body.operation,
          targetType: body.targetType,
          targetId: body.targetId,
        });
      case "archive":
        return archiveCuratorTarget(db, {
          targetType: body.targetType,
          targetId: body.targetId,
        });
      case "delete":
        return safeDeleteCuratorTarget(db, {
          targetType: body.targetType,
          targetId: body.targetId,
        });
      case "merge_summaries":
        return mergeSummaries(db, {
          summaryHashes: body.summaryHashes,
          title: body.title,
          mergedText: body.mergedText,
        });
      case "split_summary":
        return splitSummaryIntoManualNotes(db, {
          summaryHash: body.summaryHash,
          notes: body.notes,
        });
    }
  })();

  if (!result.ok) return blockedResponse(result);

  return NextResponse.json({
    ok: true,
    result: result.value,
  });
}
