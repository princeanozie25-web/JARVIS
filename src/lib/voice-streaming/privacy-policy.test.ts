import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoicePrivacyPolicy } from "./privacy-policy";
import type {
  VoiceOrchestrationTelemetryEvent,
  VoicePrivacyPolicyClassification,
  VoicePrivacyPolicyDescriptor,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function createHarness() {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const policy = new VoicePrivacyPolicy({
    newId: createIdGenerator("privacy-record"),
    now: () => 13_000,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  return { policy, telemetry };
}

function descriptor(
  input: Partial<VoicePrivacyPolicyDescriptor> = {},
): VoicePrivacyPolicyDescriptor {
  return {
    id: input.id ?? "privacy-descriptor-1",
    sessionId: input.sessionId ?? "session-1",
    classification: input.classification ?? "local_voice_metadata",
    createdAt: 12_900,
    turnId: "turn-1",
    sourceId: "source-1",
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function descriptorWithUnsafePayloads(
  input: Partial<VoicePrivacyPolicyDescriptor> = {},
): VoicePrivacyPolicyDescriptor {
  return descriptor({
    transcript: "secret transcript payload",
    spokenText: "secret spoken payload",
    assistantBody: "secret assistant body payload",
    toolOutput: "secret tool output payload",
    fileContent: "secret file content payload",
    codeBlock: "secret code block payload",
    personalContext: "secret personal_context payload",
    auditLog: "secret audit log payload",
    approvalPayload: "secret approval payload",
    approvalRequestId: "approval-request-secret",
    apiKey: "secret api key payload",
    providerSecret: "secret provider secret payload",
    requestPayload: "secret request payload",
    rawAudio: "secret raw audio payload",
    audioUrl: "secret audio url payload",
    blob: "secret audio blob payload",
    pcm: "secret pcm payload",
    audio: "secret audio data payload",
    ...input,
  } as unknown as Partial<VoicePrivacyPolicyDescriptor>);
}

function expectMetadataOnly(
  records: unknown,
  telemetry: VoiceOrchestrationTelemetryEvent[],
): void {
  const serialized = JSON.stringify({ records, telemetry });
  expect(serialized).not.toContain("secret transcript payload");
  expect(serialized).not.toContain("secret spoken payload");
  expect(serialized).not.toContain("secret assistant body payload");
  expect(serialized).not.toContain("secret tool output payload");
  expect(serialized).not.toContain("secret file content payload");
  expect(serialized).not.toContain("secret code block payload");
  expect(serialized).not.toContain("secret personal_context payload");
  expect(serialized).not.toContain("secret audit log payload");
  expect(serialized).not.toContain("secret approval payload");
  expect(serialized).not.toContain("approval-request-secret");
  expect(serialized).not.toContain("secret api key payload");
  expect(serialized).not.toContain("secret provider secret payload");
  expect(serialized).not.toContain("secret request payload");
  expect(serialized).not.toContain("secret raw audio payload");
  expect(serialized).not.toContain("secret audio url payload");
  expect(serialized).not.toContain("secret audio blob payload");
  expect(serialized).not.toContain("secret pcm payload");
  expect(serialized).not.toContain("secret audio data payload");

  for (const event of telemetry) {
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "transcript",
        "spokenText",
        "assistantBody",
        "toolOutput",
        "fileContent",
        "codeBlock",
        "personalContext",
        "auditLog",
        "approvalPayload",
        "approvalRequestId",
        "apiKey",
        "providerSecret",
        "requestPayload",
        "rawAudio",
        "audioUrl",
        "blob",
        "pcm",
        "audio",
      ]),
    );
  }
}

describe("VoicePrivacyPolicy", () => {
  it("allows local voice metadata only", async () => {
    const { policy, telemetry } = createHarness();

    const result = await policy.evaluate(
      descriptorWithUnsafePayloads({
        classification: "local_voice_metadata",
      }),
    );

    expect(result).toEqual({
      descriptor: {
        id: "privacy-descriptor-1",
        sessionId: "session-1",
        classification: "local_voice_metadata",
        createdAt: 12_900,
        turnId: "turn-1",
        sourceId: "source-1",
        voiceTurnState: "waiting_for_send",
      },
      record: {
        id: "privacy-record-1",
        descriptorId: "privacy-descriptor-1",
        sessionId: "session-1",
        classification: "local_voice_metadata",
        decision: "allowed_metadata_only",
        allowed: true,
        createdAt: 13_000,
        turnId: "turn-1",
        sourceId: "source-1",
      },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_privacy_policy_allowed",
        voicePrivacyAllowed: true,
      }),
    );
    expectMetadataOnly(result, telemetry);
  });

  it.each([
    ["raw_audio", "denied_raw_audio_retention"],
    ["transcript_text", "denied_transcript_upload"],
    ["assistant_speech_text", "denied_speech_text_retention"],
    ["synthesized_audio", "denied_audio_upload"],
    ["audio_url", "denied_audio_upload"],
    ["cloud_voice_request", "denied_cloud_request"],
  ] satisfies Array<[VoicePrivacyPolicyClassification, string]>)(
    "denies %s as %s",
    async (classification, decision) => {
      const { policy, telemetry } = createHarness();

      const result = await policy.evaluate(
        descriptorWithUnsafePayloads({ classification }),
      );

      expect(result.record).toEqual(
        expect.objectContaining({
          classification,
          decision,
          allowed: false,
        }),
      );
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType: "voice_privacy_policy_denied",
          voicePrivacyClassification: classification,
          voicePrivacyDecision: decision,
          voicePrivacyAllowed: false,
        }),
      );
      expectMetadataOnly(result, telemetry);
    },
  );

  it("denies unknown payload descriptors", async () => {
    const { policy, telemetry } = createHarness();

    const result = await policy.evaluate(
      descriptorWithUnsafePayloads({
        classification: "mystery_payload",
      } as unknown as Partial<VoicePrivacyPolicyDescriptor>),
    );

    expect(result).toEqual(
      expect.objectContaining({
        descriptor: expect.objectContaining({
          classification: "unknown_payload",
        }),
        record: expect.objectContaining({
          classification: "unknown_payload",
          decision: "denied_unknown_payload",
          allowed: false,
        }),
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_privacy_policy_unknown_payload",
        voicePrivacyDecision: "denied_unknown_payload",
      }),
    );
    expectMetadataOnly(result, telemetry);
  });

  it("emits evaluated telemetry for every descriptor without payload bodies", async () => {
    const { policy, telemetry } = createHarness();

    await policy.evaluate(
      descriptorWithUnsafePayloads({ classification: "local_voice_metadata" }),
    );
    await policy.evaluate(
      descriptorWithUnsafePayloads({ id: "raw", classification: "raw_audio" }),
    );

    expect(telemetry).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "voice_privacy_policy_evaluated",
          voicePrivacyDescriptorId: "privacy-descriptor-1",
        }),
        expect.objectContaining({
          eventType: "voice_privacy_policy_evaluated",
          voicePrivacyDescriptorId: "raw",
        }),
      ]),
    );
    expectMetadataOnly({ telemetry }, telemetry);
  });

  it("does not introduce mic, audio, cloud, network, API key, runtime, approval, playback, chat, device, or browser wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-streaming/privacy-policy.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["'][^"']*(openai|realtime|sdk)/i);
    expect(source).not.toMatch(
      /new\s+OpenAI|OpenAI\(|WebSocket|createRealtime/i,
    );
    expect(source).not.toMatch(
      /fetch\(|XMLHttpRequest|EventSource|https?:\/\//i,
    );
    expect(source).not.toMatch(/process\.env|api[_-]?key|Authorization/i);
    expect(source).not.toMatch(/providerSecret|clientSecret|secretKey/i);
    expect(source).not.toMatch(/from\s+["'][^"']*(tts|audio|playback)/i);
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
