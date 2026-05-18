import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, updateMemoryCandidateStatus } from "@/lib/db";

const ReviewCandidateRequestSchema = z.object({
  status: z.literal("rejected"),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let payload: unknown = {};
  try {
    const text = await req.text();
    payload = text.trim() ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = ReviewCandidateRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid request body. Only rejection is enabled in 3C.6.",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const candidate = updateMemoryCandidateStatus(
    getDb(),
    id,
    parsed.data.status,
  );
  if (!candidate) {
    return NextResponse.json(
      { message: "Memory candidate not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ candidate });
}
