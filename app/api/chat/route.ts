import { NextResponse } from "next/server";
import { ChatRequestSchema } from "@/lib/chat/schema";
import {
  PROVIDER_TOOL_IDS,
  streamWithReadOnlyToolContinuation,
} from "@/lib/chat/tool-continuation";
import { canExecuteRequest, usage } from "@/lib/cost";
import {
  createSessionIfMissing,
  getDb,
  insertMessageIfMissing,
} from "@/lib/db";
import { loadSystemPrompt } from "@/lib/prompts";
import { registry } from "@/lib/providers";
import { clientKeyFromRequest, rateLimiter } from "@/lib/rate-limit";
import { enforceRouterSafety, routeMessages } from "@/lib/router";
import { encodeSseEvent } from "@/lib/streaming/sse";
import { recordEvent } from "@/lib/telemetry";
import { providerToolMetadata, toolRuntime, tools } from "@/lib/tools";
import type { Message } from "@/lib/types";

const SSE_HEARTBEAT_MS = 15_000;

function persistIncomingMessages(
  sessionId: string,
  messages: Array<Message & { id?: string }>,
): void {
  try {
    const db = getDb();
    const now = Date.now();
    createSessionIfMissing(db, sessionId, now);

    for (const [index, message] of messages.entries()) {
      insertMessageIfMissing(db, {
        id: message.id ?? globalThis.crypto.randomUUID(),
        session_id: sessionId,
        role: message.role,
        content: message.content,
        created_at: now + index,
      });
    }
  } catch (error) {
    console.warn(
      "[chat] failed to persist incoming messages",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function persistAssistantMessage(
  sessionId: string,
  messageId: string,
  content: string,
): void {
  try {
    const db = getDb();
    const now = Date.now();
    createSessionIfMissing(db, sessionId, now);
    insertMessageIfMissing(db, {
      id: messageId,
      session_id: sessionId,
      role: "assistant",
      content,
      created_at: now,
    });
  } catch (error) {
    console.warn(
      "[chat] failed to persist assistant message",
      error instanceof Error ? error.message : String(error),
    );
  }
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

  const sessionId = parsed.data.sessionId ?? globalThis.crypto.randomUUID();

  const clientKey = clientKeyFromRequest(req);
  const limit = rateLimiter.check(clientKey);
  if (!limit.ok) {
    recordEvent({
      event_type: "rate_limited",
      success: false,
      session_id: sessionId,
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
      session_id: sessionId,
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

  const routerDecision = routeMessages(parsed.data.messages, {
    requestedProvider: parsed.data.provider,
  });
  const providerId = routerDecision.selection.providerId;
  const modelEntry = routerDecision.selection.model;
  const providerModel = modelEntry.modelName;
  const safetyResponse = enforceRouterSafety(routerDecision);
  if (safetyResponse) {
    recordEvent({
      event_type: safetyResponse.eventType,
      success: false,
      session_id: sessionId,
      model_id: providerModel,
      intent: routerDecision.intent.intent,
      safety_tag: routerDecision.safety.safetyTag,
      tier: routerDecision.capability.tier,
      notes: routerDecision.safety.reason,
    });
    return NextResponse.json(safetyResponse.body, {
      status: safetyResponse.status,
    });
  }

  const assistantMessageId =
    parsed.data.assistantMessageId ?? globalThis.crypto.randomUUID();

  persistIncomingMessages(sessionId, parsed.data.messages);

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
    const providerTools = providerToolMetadata(tools, (toolId) =>
      PROVIDER_TOOL_IDS.has(toolId),
    );

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, SSE_HEARTBEAT_MS);

        try {
          for await (const event of streamWithReadOnlyToolContinuation({
            provider,
            messages,
            model: providerModel,
            signal: ac.signal,
            providerTools,
            runtime: toolRuntime,
            registry: tools,
            db: getDb(),
            sessionId,
            assistantMessageId,
            decision: routerDecision,
            recordEvent,
          })) {
            controller.enqueue(encoder.encode(encodeSseEvent(event)));

            if (event.type === "done") {
              const final = event.result;
              persistAssistantMessage(
                sessionId,
                assistantMessageId,
                final.content,
              );
              usage.record(final.costUsd);
              recordEvent({
                event_type: "model_call",
                success: true,
                session_id: sessionId,
                model_id: final.modelId,
                intent: routerDecision.intent.intent,
                safety_tag: routerDecision.safety.safetyTag,
                tier: routerDecision.capability.tier,
                latency_ms: final.latencyMs,
                time_to_first_token_ms: final.timeToFirstTokenMs,
                input_tokens: final.inputTokens,
                output_tokens: final.outputTokens,
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
                  session_id: sessionId,
                  model_id: providerModel,
                  intent: routerDecision.intent.intent,
                  safety_tag: routerDecision.safety.safetyTag,
                  tier: routerDecision.capability.tier,
                  latency_ms: Date.now() - startedAt,
                  notes: event.message,
                });
              } else {
                recordEvent({
                  event_type: "provider_error",
                  success: false,
                  session_id: sessionId,
                  model_id: providerModel,
                  intent: routerDecision.intent.intent,
                  safety_tag: routerDecision.safety.safetyTag,
                  tier: routerDecision.capability.tier,
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
            session_id: sessionId,
            model_id: providerModel,
            intent: routerDecision.intent.intent,
            safety_tag: routerDecision.safety.safetyTag,
            tier: routerDecision.capability.tier,
            latency_ms: Date.now() - startedAt,
            error_class:
              error instanceof Error ? error.constructor.name : "UnknownError",
            notes: error instanceof Error ? error.message : String(error),
          });
          controller.error(error);
        } finally {
          clearInterval(heartbeat);
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
        "X-Accel-Buffering": "no",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("CHAT API ERROR:", error);

    recordEvent({
      event_type: "provider_error",
      success: false,
      session_id: sessionId,
      model_id: providerModel,
      intent: routerDecision.intent.intent,
      safety_tag: routerDecision.safety.safetyTag,
      tier: routerDecision.capability.tier,
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
