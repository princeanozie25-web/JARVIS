import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { emitMemorySurfacedTelemetry } from "@/lib/memory/surfaced-telemetry";

const MemorySurfacedRequestSchema = z.object({
  sessionId: z.string().min(1).max(200).optional(),
  executionId: z.string().min(1).max(200).optional(),
  retrievalMode: z
    .enum(["keyword_only", "vector_only", "hybrid"])
    .default("keyword_only"),
  memoryIds: z.array(z.string().min(1).max(200)).max(20).default([]),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = MemorySurfacedRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request body.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const surfaced = emitMemorySurfacedTelemetry(getDb(), {
    memoryIds: parsed.data.memoryIds,
    retrievalMode: parsed.data.retrievalMode,
    sessionId: parsed.data.sessionId,
    executionId: parsed.data.executionId,
  });

  return NextResponse.json({ ok: true, surfaced });
}
