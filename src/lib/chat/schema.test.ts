import { describe, expect, it } from "vitest";
import {
  ChatRequestSchema,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_CHAT_MESSAGES,
} from "./schema";

describe("ChatRequestSchema", () => {
  it("accepts up to 50 valid messages", () => {
    const messages = Array.from({ length: MAX_CHAT_MESSAGES }, () => ({
      role: "user",
      content: "hello",
    }));

    expect(ChatRequestSchema.safeParse({ messages }).success).toBe(true);
  });

  it("rejects more than 50 messages", () => {
    const messages = Array.from({ length: MAX_CHAT_MESSAGES + 1 }, () => ({
      role: "user",
      content: "hello",
    }));

    expect(ChatRequestSchema.safeParse({ messages }).success).toBe(false);
  });

  it("rejects messages over 4000 characters", () => {
    const content = "a".repeat(MAX_CHAT_MESSAGE_CHARS + 1);

    expect(
      ChatRequestSchema.safeParse({
        messages: [{ role: "user", content }],
      }).success,
    ).toBe(false);
  });
});
