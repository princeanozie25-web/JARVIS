import { NextResponse } from "next/server";
import { generateOpenAIResponse } from "@/src/lib/openai";
import type { ChatRequest } from "@/src/lib/types";
export async function POST(req: Request) {
  try {
    const body: ChatRequest = await req.json();

    const response = await generateOpenAIResponse(body.messages);

    return NextResponse.json({
      message: response,
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