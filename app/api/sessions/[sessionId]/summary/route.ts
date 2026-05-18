import { NextResponse } from "next/server";
import { z } from "zod";
import { SUPPORTED_PROVIDERS } from "@/lib/chat/schema";
import { getDb } from "@/lib/db";
import { generateSessionSummary } from "@/lib/session-summary";

const GenerateSummaryRequestSchema = z.object({
  provider: z.enum(SUPPORTED_PROVIDERS).optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
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

  const parsed = GenerateSummaryRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request body.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await generateSessionSummary({
    db: getDb(),
    sessionId,
    requestedProvider: parsed.data.provider,
    signal: req.signal,
  });

  if (!result.ok) {
    const status = result.status === "empty_session" ? 404 : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
