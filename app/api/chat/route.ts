import { NextResponse } from "next/server";
import { z } from "zod";
import { config } from "@/src/lib/config";
import { registry } from "@/src/lib/providers";

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

  try {
    const provider = registry.get("openai");
    const result = await provider.generate(parsed.data.messages, {
      model: config.openai.model,
    });

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
