import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  VOICE_PRIVACY_CONTENT_CLASSES,
  VOICE_PRIVACY_SPEAKABLE_CONTENT_CLASSES,
  assertVoiceContentSpeakableByDefault,
  classifyVoiceContentPrivacy,
  isVoiceContentSpeakableByDefault,
} from "../../src/lib/voice-runtime";

describe("Phase 14A.3 voice privacy guards", () => {
  it("defines the privacy content classes and default speakable class", () => {
    expect(VOICE_PRIVACY_CONTENT_CLASSES).toEqual([
      "assistant_prose",
      "tool_output",
      "code_block",
      "approval_prompt",
      "personal_context",
      "file_content",
      "error_stack",
      "audit_log",
      "transcript",
    ]);
    expect(VOICE_PRIVACY_SPEAKABLE_CONTENT_CLASSES).toEqual([
      "assistant_prose",
    ]);
  });

  it("allows only assistant prose by default", () => {
    expect(classifyVoiceContentPrivacy("assistant_prose")).toEqual({
      allowed: true,
      content_class: "assistant_prose",
      reason: null,
      redaction_status: "metadata_only",
    });
    expect(isVoiceContentSpeakableByDefault("assistant_prose")).toBe(true);
    expect(
      assertVoiceContentSpeakableByDefault("assistant_prose"),
    ).toMatchObject({
      allowed: true,
      content_class: "assistant_prose",
    });
  });

  it.each([
    ["tool_output", "tool_output_blocked"],
    ["code_block", "code_block_blocked"],
    ["approval_prompt", "approval_prompt_blocked"],
    ["personal_context", "personal_context_blocked"],
    ["file_content", "file_content_blocked"],
    ["error_stack", "error_stack_blocked"],
    ["audit_log", "audit_log_blocked"],
    ["transcript", "transcript_blocked"],
  ] as const)("denies sensitive class %s", (contentClass, reason) => {
    expect(classifyVoiceContentPrivacy(contentClass)).toEqual({
      allowed: false,
      content_class: contentClass,
      reason,
      redaction_status: "withheld",
    });
    expect(isVoiceContentSpeakableByDefault(contentClass)).toBe(false);
    expect(() => assertVoiceContentSpeakableByDefault(contentClass)).toThrow(
      reason,
    );
  });

  it("fails closed on unknown content classes", () => {
    expect(classifyVoiceContentPrivacy("unknown")).toEqual({
      allowed: false,
      content_class: null,
      reason: "unknown_content_class",
      redaction_status: "withheld",
    });
    expect(isVoiceContentSpeakableByDefault("unknown")).toBe(false);
  });

  it("does not introduce runtime, mic, playback, Tauri, cloud, persistence, or provider execution wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-runtime/privacy.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|AudioContext|MediaRecorder|navigator\./i,
    );
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|autoplay.*true|play\(/i,
    );
    expect(source).not.toMatch(/tauri|invoke\(|global-hotkey|globalShortcut/i);
    expect(source).not.toMatch(/ffmpeg|whisper|piper|spawn\(|exec\(/i);
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /appendEvent|appendFile|writeFile|event-store|telemetryStore|persistTelemetry|database|sqlite/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|router\.|scheduler|setInterval|while\s*\(\s*true\s*\)/i,
    );
  });
});
