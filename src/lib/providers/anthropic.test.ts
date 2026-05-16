import { describe, expect, it } from "vitest";
import { splitSystemPrompt } from "./anthropic-messages";
import type { Message } from "../types";

describe("splitSystemPrompt", () => {
  it("returns undefined system when no system messages are present", () => {
    const messages: Message[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ];

    expect(splitSystemPrompt(messages)).toEqual({
      system: undefined,
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    });
  });

  it("extracts a single system message and strips it from the messages array", () => {
    const messages: Message[] = [
      { role: "system", content: "you are JARVIS" },
      { role: "user", content: "hi" },
    ];

    expect(splitSystemPrompt(messages)).toEqual({
      system: "you are JARVIS",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("joins multiple system messages with a blank line", () => {
    const messages: Message[] = [
      { role: "system", content: "first" },
      { role: "user", content: "hi" },
      { role: "system", content: "second" },
    ];

    expect(splitSystemPrompt(messages)).toEqual({
      system: "first\n\nsecond",
      messages: [{ role: "user", content: "hi" }],
    });
  });
});
