import { NextResponse } from "next/server";
import { z } from "zod";
import { SUPPORTED_PROVIDERS } from "@/lib/chat/schema";
import { getDb, listMemoryCandidates } from "@/lib/db";
import { MEMORY_CANDIDATE_STATUSES } from "@/lib/db/memory-candidates";
import { generateMemoryCandidates } from "@/lib/memory-candidates";

const GenerateCandidatesRequestSchema = z.object({
  sessionId: z.string().min(1),
  provider: z.enum(SUPPORTED_PROVIDERS).optional(),
});

function optionalParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name)?.trim();
  return value ? value : undefined;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") ?? 50);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 100)
      : 50;
  const status = optionalParam(url, "status");

  return NextResponse.json({
    candidates: listMemoryCandidates(getDb(), {
      sessionId: optionalParam(url, "sessionId"),
      status: MEMORY_CANDIDATE_STATUSES.includes(
        status as (typeof MEMORY_CANDIDATE_STATUSES)[number],
      )
        ? (status as (typeof MEMORY_CANDIDATE_STATUSES)[number])
        : undefined,
      limit,
    }),
  });
}

export async function POST(req: Request) {
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

  const parsed = GenerateCandidatesRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid request body.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await generateMemoryCandidates({
    db: getDb(),
    sessionId: parsed.data.sessionId,
    requestedProvider: parsed.data.provider,
    signal: req.signal,
  });

  if (!result.ok) {
    const status = result.status === "empty_session" ? 404 : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
