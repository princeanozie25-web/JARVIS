import { NextResponse } from "next/server";
import { config } from "@/src/lib/config";
import { registry } from "@/src/lib/providers";
import type { ChatRequest } from "@/src/lib/types";

export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();

    const provider = registry.get("openai");
    const result = await provider.generate(body.messages, {
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
