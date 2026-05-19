import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  generateReflectionPrompt,
  REFLECTION_PROMPT_TEMPLATE_TYPES,
} from "@/lib/reflection-prompts";

const templateTypeSchema = z.enum(REFLECTION_PROMPT_TEMPLATE_TYPES);

const requestSchema = z.object({
  templateType: templateTypeSchema.optional(),
  limit: z.number().int().min(1).max(10).optional(),
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
  const templateParam = url.searchParams.get("templateType");
  const templateType = templateParam
    ? templateTypeSchema.safeParse(templateParam)
    : null;
  if (templateType && !templateType.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid reflection prompt template" },
      { status: 400 },
    );
  }

  const limitParam = Number(url.searchParams.get("limit") ?? 5);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(Math.trunc(limitParam), 10)
      : 5;

  const result = generateReflectionPrompt(getDb(), {
    templateType: templateType?.success ? templateType.data : undefined,
    limit,
  });
  if (!result.ok) return blockedResponse(result);

  return NextResponse.json({ prompt: result.prompt });
}

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = generateReflectionPrompt(getDb(), parsed.data);
  if (!result.ok) return blockedResponse(result);
  return NextResponse.json({ prompt: result.prompt });
}
