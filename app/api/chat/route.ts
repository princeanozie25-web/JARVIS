import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/src/lib/config";
import { canExecuteRequest, usage } from "@/src/lib/cost";
import { registry } from "@/src/lib/providers";

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
    const provider = registry.get("openai");
    const result = await provider.generate(parsed.data.messages, {
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
