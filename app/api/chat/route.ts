import { NextResponse } from "next/server";
import { ChatRequestSchema } from "@/lib/chat/schema";
import { config } from "@/lib/config";
import { canExecuteRequest, usage } from "@/lib/cost";
import { loadSystemPrompt } from "@/lib/prompts";
import { registry } from "@/lib/providers";
import type { StreamEvent } from "@/lib/providers";
import { clientKeyFromRequest, rateLimiter } from "@/lib/rate-limit";
import { recordEvent } from "@/lib/telemetry";
import type { Message } from "@/lib/types";

function sseEncode(event: StreamEvent, encoder: TextEncoder): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

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
      { status: 400 },
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
      { status: 400 },
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
      },
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
      { status: 429 },
    );
  }

  const providerId = parsed.data.provider ?? "openai";
  const providerModel =
    providerId === "anthropic" ? config.anthropic.model : config.openai.model;

  const startedAt = Date.now();
  let systemPromptHash = "";
  try {
    const systemPrompt = loadSystemPrompt();
    systemPromptHash = systemPrompt.hash;
    const messages: Message[] = [
      { role: "system", content: systemPrompt.content },
      ...parsed.data.messages,
    ];

    const ac = new AbortController();
    const onClientAbort = () => ac.abort(req.signal.reason);
    if (req.signal.aborted) {
      ac.abort(req.signal.reason);
    } else {
      req.signal.addEventListener("abort", onClientAbort);
    }

    const provider = registry.get(providerId);
    const streamResult = await provider.stream(messages, {
      model: providerModel,
      signal: ac.signal,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of streamResult.events) {
            controller.enqueue(sseEncode(event, encoder));

            if (event.type === "done") {
              const final = event.result;
              usage.record(final.costUsd);
              recordEvent({
                event_type: "model_call",
                success: true,
                model_id: final.modelId,
                latency_ms: final.latencyMs,
                time_to_first_token_ms: final.timeToFirstTokenMs,
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
            } else if (event.type === "error") {
              if (ac.signal.aborted) {
                recordEvent({
                  event_type: "client_disconnect",
                  success: false,
                  model_id: providerModel,
                  latency_ms: Date.now() - startedAt,
                  notes: event.message,
                });
              } else {
                recordEvent({
                  event_type: "provider_error",
                  success: false,
                  model_id: providerModel,
                  latency_ms: Date.now() - startedAt,
                  error_class: "StreamError",
                  notes: event.message,
                });
              }
            }
          }
          controller.close();
        } catch (error) {
          console.error("CHAT API STREAM ERROR:", error);
          recordEvent({
            event_type: "provider_error",
            success: false,
            model_id: providerModel,
            latency_ms: Date.now() - startedAt,
            error_class:
              error instanceof Error ? error.constructor.name : "UnknownError",
            notes: error instanceof Error ? error.message : String(error),
          });
          controller.error(error);
        } finally {
          req.signal.removeEventListener("abort", onClientAbort);
        }
      },
      cancel(reason) {
        ac.abort(reason);
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("CHAT API ERROR:", error);

    recordEvent({
      event_type: "provider_error",
      success: false,
      model_id: providerModel,
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
      },
    );
  }
}
