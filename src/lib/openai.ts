import OpenAI from "openai";
import { config } from "./config";
import type { Message } from "./types";

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export async function generateOpenAIResponse(messages: Message[]) {
  const response = await openai.chat.completions.create({
    model: config.openai.model,
    messages,
  });

  return response.choices[0]?.message?.content ?? "No response generated.";
}