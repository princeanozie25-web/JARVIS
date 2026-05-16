import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { canExecuteRequest, usage } from "@/lib/cost";
import { loadSystemPrompt } from "@/lib/prompts";
import { registry } from "@/lib/providers";
import { clientKeyFromRequest, rateLimiter } from "@/lib/rate-limit";
import { recordEvent } from "@/lib/telemetry";
import type { Message } from "@/lib/types";

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
    recordEvent({
      event_type: "validation_failure",
      success: false,
      error_class: "InvalidJSON",
      notes: "request body was not valid JSON",
    });
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = ChatRequestSchema.safeParse(payload);
  if (!parsed.success) {
    recordEvent({
      event_type: "validation_failure",
      success: false,
      error_class: "ZodError",
      notes: parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
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
    recordEvent({
      event_type: "rate_limited",
      success: false,
      notes: `client=${clientKey} limit=${limit.limit}/${limit.windowMs}ms retryAfterMs=${limit.retryAfterMs}`,
    });
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
    recordEvent({
      event_type: "cost_denied",
      success: false,
      notes: `period=${guard.period} spent=${guard.spent} limit=${guard.limit}`,
    });
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

  const startedAt = Date.now();
  let systemPromptHash = "";
  try {
    const systemPrompt = loadSystemPrompt();
    systemPromptHash = systemPrompt.hash;
    const messages: Message[] = [
      { role: "system", content: systemPrompt.content },
      ...parsed.data.messages,
    ];

    const provider = registry.get("openai");
    const streamResult = await provider.stream(messages, {
      model: config.openai.model,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of streamResult.stream) {
            controller.enqueue(encoder.encode(chunk));
          }
          const final = await streamResult.done;

          usage.record(final.costUsd);

          recordEvent({
            event_type: "model_call",
            success: true,
            model_id: final.modelId,
            latency_ms: final.latencyMs,
            cost_usd: final.costUsd,
            notes: `prompt_hash=${systemPromptHash}${
              final.inputTokens !== undefined
                ? ` input_tokens=${final.inputTokens}`
                : ""
            }${
              final.outputTokens !== undefined
                ? ` output_tokens=${final.outputTokens}`
                : ""
            }`,
          });

          controller.close();
        } catch (error) {
          console.error("CHAT API STREAM ERROR:", error);
          recordEvent({
            event_type: "provider_error",
            success: false,
            model_id: config.openai.model,
            latency_ms: Date.now() - startedAt,
            error_class:
              error instanceof Error
                ? error.constructor.name
                : "UnknownError",
            notes: error instanceof Error ? error.message : String(error),
          });
          controller.error(error);
        }
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("CHAT API ERROR:", error);

    recordEvent({
      event_type: "provider_error",
      success: false,
      model_id: config.openai.model,
      latency_ms: Date.now() - startedAt,
      error_class:
        error instanceof Error ? error.constructor.name : "UnknownError",
      notes: error instanceof Error ? error.message : String(error),
    });

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
