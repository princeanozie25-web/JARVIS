import { describe, expect, it } from "vitest";
import { evaluateSpeechSafetyPolicy } from "./safety-policy";

describe("evaluateSpeechSafetyPolicy", () => {
  it("allows assistant prose", () => {
    expect(
      evaluateSpeechSafetyPolicy({
        text: "Here is the short answer in plain language.",
        source: "assistant_prose",
      }),
    ).toEqual({ allowed: true });
  });

  it("blocks restricted content classes", () => {
    expect(
      evaluateSpeechSafetyPolicy({
        text: "Tool returned secret output.",
        source: "tool_output",
      }),
    ).toEqual({ allowed: false, reason: "tool_output_blocked" });

    expect(
      evaluateSpeechSafetyPolicy({
        text: "```ts\nconsole.log('no')\n```",
        source: "assistant_prose",
      }),
    ).toEqual({ allowed: false, reason: "code_block_blocked" });

    expect(
      evaluateSpeechSafetyPolicy({
        text: "Runtime command completed.",
        source: "audit_runtime_output",
      }),
    ).toEqual({ allowed: false, reason: "audit_runtime_output_blocked" });

    expect(
      evaluateSpeechSafetyPolicy({
        text: "Private preference.",
        source: "assistant_prose",
        contentTags: ["personal_context"],
      }),
    ).toEqual({ allowed: false, reason: "personal_context_blocked" });

    expect(
      evaluateSpeechSafetyPolicy({
        text: "Private preference.",
        source: "personal_context",
      }),
    ).toEqual({ allowed: false, reason: "personal_context_blocked" });

    expect(
      evaluateSpeechSafetyPolicy({
        text: "<personal_context>Private preference.</personal_context>",
        source: "assistant_prose",
      }),
    ).toEqual({ allowed: false, reason: "personal_context_blocked" });
  });
});
