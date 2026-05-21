import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  emitMetadataOnlyVoiceTelemetry,
  sanitizeVoiceTelemetryEvent,
  VOICE_TELEMETRY_ALLOWED_KEYS,
  VOICE_TELEMETRY_FORBIDDEN_KEY_LIST,
} from "./telemetry-hygiene";
import type { VoiceOrchestrationTelemetryEvent } from "./types";

function baseEvent(
  input: Partial<VoiceOrchestrationTelemetryEvent> = {},
): VoiceOrchestrationTelemetryEvent {
  return {
    eventType: "voice_privacy_policy_evaluated",
    sessionId: "session-1",
    state: "waiting_for_send",
    success: true,
    ...input,
  };
}

function expectNoSensitivePayload(serialized: string): void {
  expect(serialized).not.toContain("secret transcript payload");
  expect(serialized).not.toContain("secret spoken payload");
  expect(serialized).not.toContain("secret assistant payload");
  expect(serialized).not.toContain("secret tool output payload");
  expect(serialized).not.toContain("secret file content payload");
  expect(serialized).not.toContain("secret code payload");
  expect(serialized).not.toContain("secret personal context payload");
  expect(serialized).not.toContain("secret audit payload");
  expect(serialized).not.toContain("secret approval payload");
  expect(serialized).not.toContain("approval-id-secret");
  expect(serialized).not.toContain("secret-api-key");
  expect(serialized).not.toContain("secret-provider-secret");
  expect(serialized).not.toContain("secret request payload");
  expect(serialized).not.toContain("secret raw audio payload");
  expect(serialized).not.toContain("secret audio data payload");
  expect(serialized).not.toContain("secret audio blob payload");
  expect(serialized).not.toContain("secret audio url payload");
  expect(serialized).not.toContain("secret pcm payload");
}

describe("voice telemetry hygiene", () => {
  it("strips forbidden top-level keys and keeps allowed metadata keys", () => {
    const result = sanitizeVoiceTelemetryEvent({
      ...baseEvent({
        chunkId: "chunk-1",
        chunkIndex: 1,
        voicePrivacyDecision: "allowed_metadata_only",
        voicePrivacyAllowed: true,
      }),
      transcript: "secret transcript payload",
      spokenText: "secret spoken payload",
      assistantBody: "secret assistant payload",
      toolOutput: "secret tool output payload",
      fileContent: "secret file content payload",
      code: "secret code payload",
      codeBlock: "secret code payload",
      personalContext: "secret personal context payload",
      auditLog: "secret audit payload",
      approvalPayload: "secret approval payload",
      approvalRequestId: "approval-id-secret",
      apiKey: "secret-api-key",
      providerSecret: "secret-provider-secret",
      requestPayload: "secret request payload",
      rawAudio: "secret raw audio payload",
      audioData: "secret audio data payload",
      audioBlob: "secret audio blob payload",
      audioUrl: "secret audio url payload",
      pcm: "secret pcm payload",
      unexpectedPayload: "secret unexpected payload",
    });

    expect(result.event).toEqual(
      expect.objectContaining({
        eventType: "voice_privacy_policy_evaluated",
        sessionId: "session-1",
        state: "waiting_for_send",
        success: true,
        chunkId: "chunk-1",
        chunkIndex: 1,
        voicePrivacyDecision: "allowed_metadata_only",
        voicePrivacyAllowed: true,
      }),
    );
    expect(result.removedKeys).toEqual(
      expect.arrayContaining([
        "transcript",
        "spokenText",
        "assistantBody",
        "toolOutput",
        "fileContent",
        "code",
        "codeBlock",
        "personalContext",
        "auditLog",
        "approvalPayload",
        "approvalRequestId",
        "apiKey",
        "providerSecret",
        "requestPayload",
        "rawAudio",
        "audioData",
        "audioBlob",
        "audioUrl",
        "pcm",
        "unexpectedPayload",
      ]),
    );
    for (const key of Object.keys(result.event)) {
      expect(VOICE_TELEMETRY_ALLOWED_KEYS.has(key)).toBe(true);
    }
    expectNoSensitivePayload(JSON.stringify(result));
  });

  it("drops nested forbidden payloads and nested non-scalar data", () => {
    const result = sanitizeVoiceTelemetryEvent({
      ...baseEvent({ error: "metadata_stream_failed" }),
      nested: {
        transcriptText: "secret transcript payload",
        child: {
          audioData: "secret audio data payload",
          assistantText: "secret assistant payload",
        },
      },
      chunkId: {
        audioUrl: "secret audio url payload",
      },
    });

    expect(result.event).toEqual(
      expect.objectContaining({
        eventType: "voice_privacy_policy_evaluated",
        sessionId: "session-1",
        state: "waiting_for_send",
        success: true,
        error: "metadata_stream_failed",
      }),
    );
    expect(result.event).not.toHaveProperty("chunkId");
    expect(result.removedKeys).toEqual(
      expect.arrayContaining([
        "nested",
        "nested.transcriptText",
        "nested.child.audioData",
        "nested.child.assistantText",
        "chunkId",
        "chunkId.audioUrl",
      ]),
    );
    expectNoSensitivePayload(JSON.stringify(result));
  });

  it("redacts unsafe allowed scalar values without logging the payload", () => {
    const result = sanitizeVoiceTelemetryEvent(
      baseEvent({
        error: "secret transcript payload with spaces",
        chunkId: "secret raw audio payload",
      }),
    );

    expect(result.event).toEqual(
      expect.objectContaining({
        error: "redacted_metadata_only",
        chunkId: "redacted_metadata_only",
      }),
    );
    expect(result.redactedKeys).toEqual(
      expect.arrayContaining(["error", "chunkId"]),
    );
    expectNoSensitivePayload(JSON.stringify(result));
  });

  it("emits only sanitized metadata through the shared wrapper", async () => {
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];

    const result = await emitMetadataOnlyVoiceTelemetry(
      (event) => {
        telemetry.push(event);
      },
      {
        ...baseEvent({ eventType: "voice_realtime_pipeline_failed" }),
        transcript: "secret transcript payload",
        audioData: "secret audio data payload",
      } as unknown as VoiceOrchestrationTelemetryEvent,
    );

    expect(result.removedKeys).toEqual(
      expect.arrayContaining(["transcript", "audioData"]),
    );
    expect(telemetry).toHaveLength(1);
    expect(telemetry[0]).toEqual(
      expect.objectContaining({
        eventType: "voice_realtime_pipeline_failed",
        sessionId: "session-1",
      }),
    );
    expectNoSensitivePayload(JSON.stringify({ telemetry, result }));
  });

  it("keeps every current voice-streaming emitter on the hygiene wrapper", () => {
    const dir = join(process.cwd(), "src/lib/voice-streaming");
    const files = readdirSync(dir)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => file !== "telemetry-hygiene.ts");

    for (const file of files) {
      const source = readFileSync(join(dir, file), "utf8");
      expect(source).not.toMatch(/opts\.emitTelemetry\?\.\(/);
      if (source.includes("emitTelemetry?:")) {
        expect(source).toContain("emitMetadataOnlyVoiceTelemetry");
      }
    }
  });

  it("keeps telemetry metadata-only under stress", async () => {
    const telemetry: VoiceOrchestrationTelemetryEvent[] = [];

    for (let index = 0; index < 100; index += 1) {
      await emitMetadataOnlyVoiceTelemetry(
        (event) => {
          telemetry.push(event);
        },
        {
          ...baseEvent({
            eventType:
              index % 2 === 0
                ? "voice_cloud_budget_denied"
                : "voice_runtime_boundary_voice_approval_rejected",
            sessionId: `session-${index}`,
            chunkIndex: index,
            error:
              index % 3 === 0
                ? "secret assistant payload with spaces"
                : "metadata_only_denial",
          }),
          transcript: "secret transcript payload",
          requestPayload: {
            assistantBody: "secret assistant payload",
            rawAudio: "secret raw audio payload",
          },
          nested: {
            approvalPayload: "secret approval payload",
            apiKey: "secret-api-key",
            providerSecret: "secret-provider-secret",
          },
        } as unknown as VoiceOrchestrationTelemetryEvent,
      );
    }

    expect(telemetry).toHaveLength(100);
    for (const event of telemetry) {
      for (const key of Object.keys(event)) {
        expect(VOICE_TELEMETRY_ALLOWED_KEYS.has(key)).toBe(true);
        expect(
          VOICE_TELEMETRY_FORBIDDEN_KEY_LIST.includes(
            key as (typeof VOICE_TELEMETRY_FORBIDDEN_KEY_LIST)[number],
          ),
        ).toBe(false);
      }
    }
    expectNoSensitivePayload(JSON.stringify(telemetry));
  });

  it("does not introduce mic, audio, cloud, network, API key, runtime, approval, playback, chat, device, or browser wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/telemetry-hygiene.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["'][^"']*(openai|realtime|sdk)/i);
    expect(source).not.toMatch(
      /new\s+OpenAI|OpenAI\(|WebSocket|createRealtime/i,
    );
    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|EventSource|https?:\/\//i,
    );
    expect(source).not.toMatch(/process\.env|Authorization/i);
    expect(source).not.toMatch(/from\s+["'][^"']*(tts|playback)/i);
    expect(source).not.toMatch(/captureAudio|uploadAudio|uploadTranscript/i);
    expect(source).not.toMatch(/microphone|mediaDevices|getUserMedia/i);
    expect(source).not.toMatch(/runtime-commands|executeRuntime|runTool/i);
    expect(source).not.toMatch(/approveRuntime|executeApproval|bypass/i);
    expect(source).not.toMatch(
      /from\s+["'][^"']*(synthesis|tts)|synthesize\(|HTMLAudioElement|startPlayback|\.play\(/i,
    );
    expect(source).not.toMatch(/\/api\/chat|submitChat|autoSubmit/i);
    expect(source).not.toMatch(
      /keyboard|addEventListener|window\.|document\./i,
    );
    expect(source).not.toMatch(/wake\s*word|always[-_\s]?listening/i);
  });
});
