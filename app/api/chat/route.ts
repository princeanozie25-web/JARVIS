import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/src/lib/config";
import { canExecuteRequest, usage } from "@/src/lib/cost";
import { loadSystemPrompt } from "@/src/lib/prompts";
import { registry } from "@/src/lib/providers";
import { clientKeyFromRequest, rateLimiter } from "@/src/lib/rate-limit";
import type { Message } from "@/src/lib/types";

const PLACEHOLDER_COST_PER_REQUEST_USD = 0.001;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1, "content must be a non-empty string"),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1, "messages must not be empty"),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = ChatRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Invalid request body.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const clientKey = clientKeyFromRequest(req);
  const limit = rateLimiter.check(clientKey);
  if (!limit.ok) {
    const retryAfterSec = Math.ceil(limit.retryAfterMs / 1000);
    return NextResponse.json(
      {
        message: limit.message,
        reason: "rate_limited",
        limit: limit.limit,
        windowMs: limit.windowMs,
        retryAfterMs: limit.retryAfterMs,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      }
    );
  }

  const guard = canExecuteRequest();
  if (!guard.ok) {
    return NextResponse.json(
      {
        message: guard.message,
        reason: guard.reason,
        period: guard.period,
        spent: guard.spent,
        limit: guard.limit,
      },
      { status: 429 }
    );
  }

  try {
    const systemPrompt = loadSystemPrompt();
    const messages: Message[] = [
      { role: "system", content: systemPrompt.content },
      ...parsed.data.messages,
    ];

    const provider = registry.get("openai");
    const result = await provider.generate(messages, {
      model: config.openai.model,
    });

    usage.record(PLACEHOLDER_COST_PER_REQUEST_USD);

    return NextResponse.json({
      message: result.content,
    });
  } catch (error) {
    console.error("CHAT API ERROR:", error);

    return NextResponse.json(
      {
        message: "Something went wrong.",
      },
      {
        status: 500,
      }
    );
  }
}
