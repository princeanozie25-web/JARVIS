import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { VoiceRestrictedContentBoundary } from "./restricted-content-boundary";
import type {
  VoiceOrchestrationTelemetryEvent,
  VoiceRestrictedContentClassification,
  VoiceRestrictedContentDescriptor,
} from "./types";

function createIdGenerator(prefix: string) {
  let next = 1;
  return () => `${prefix}-${next++}`;
}

function createHarness() {
  const telemetry: VoiceOrchestrationTelemetryEvent[] = [];
  const boundary = new VoiceRestrictedContentBoundary({
    newId: createIdGenerator("restricted-decision"),
    now: () => 7_000,
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
  });
  return { boundary, telemetry };
}

function contentDescriptor(
  input: Partial<VoiceRestrictedContentDescriptor> = {},
): VoiceRestrictedContentDescriptor {
  return {
    id: input.id ?? "content-descriptor-1",
    sessionId: input.sessionId ?? "session-1",
    classification: input.classification ?? "assistant_prose_metadata",
    createdAt: 6_900,
    turnId: "turn-1",
    contentRefId: "content-ref-1",
    sourceId: "source-1",
    voiceTurnState: "waiting_for_send",
    ...input,
  };
}

function descriptorWithUnsafePayloads(
  input: Partial<VoiceRestrictedContentDescriptor> = {},
): VoiceRestrictedContentDescriptor {
  return contentDescriptor({
    contentText: "secret content text payload",
    toolOutput: "secret tool output payload",
    fileContent: "secret file content payload",
    codeBlock: "secret code block payload",
    personalContext: "secret personal_context payload",
    auditLog: "secret audit log payload",
    runtimeOutput: "secret runtime output payload",
    transcript: "secret transcript payload",
    spokenText: "secret spoken payload",
    assistantBody: "secret assistant body payload",
    audio: "secret audio payload",
    audioUrl: "secret audio url payload",
    pcm: "secret pcm payload",
    ...input,
  } as unknown as Partial<VoiceRestrictedContentDescriptor>);
}

function expectMetadataOnly(
  records: unknown,
  telemetry: VoiceOrchestrationTelemetryEvent[],
): void {
  const serialized = JSON.stringify({ records, telemetry });
  expect(serialized).not.toContain("secret content text payload");
  expect(serialized).not.toContain("secret tool output payload");
  expect(serialized).not.toContain("secret file content payload");
  expect(serialized).not.toContain("secret code block payload");
  expect(serialized).not.toContain("secret personal_context payload");
  expect(serialized).not.toContain("secret audit log payload");
  expect(serialized).not.toContain("secret runtime output payload");
  expect(serialized).not.toContain("secret transcript payload");
  expect(serialized).not.toContain("secret spoken payload");
  expect(serialized).not.toContain("secret assistant body payload");
  expect(serialized).not.toContain("secret audio payload");
  expect(serialized).not.toContain("secret audio url payload");
  expect(serialized).not.toContain("secret pcm payload");

  for (const event of telemetry) {
    expect(Object.keys(event)).not.toEqual(
      expect.arrayContaining([
        "contentText",
        "contentBody",
        "toolOutput",
        "fileContent",
        "codeBlock",
        "personalContext",
        "auditLog",
        "runtimeOutput",
        "transcript",
        "spokenText",
        "assistantBody",
        "audio",
        "audioUrl",
        "pcm",
      ]),
    );
  }
}

describe("VoiceRestrictedContentBoundary", () => {
  it("allows assistant prose metadata without accepting text", async () => {
    const { boundary, telemetry } = createHarness();

    const result = await boundary.evaluateDescriptor(
      descriptorWithUnsafePayloads({
        classification: "assistant_prose_metadata",
      }),
    );

    expect(result).toEqual({
      descriptor: {
        id: "content-descriptor-1",
        sessionId: "session-1",
        classification: "assistant_prose_metadata",
        createdAt: 6_900,
        turnId: "turn-1",
        contentRefId: "content-ref-1",
        sourceId: "source-1",
        terminal: undefined,
        voiceTurnState: "waiting_for_send",
      },
      record: {
        id: "restricted-decision-1",
        descriptorId: "content-descriptor-1",
        sessionId: "session-1",
        classification: "assistant_prose_metadata",
        decision: "allowed_for_speech_metadata",
        createdAt: 7_000,
        turnId: "turn-1",
        contentRefId: "content-ref-1",
        sourceId: "source-1",
      },
    });
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_restricted_content_descriptor_received",
        restrictedContentClassification: "assistant_prose_metadata",
      }),
    );
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_restricted_content_allowed",
        restrictedContentDecision: "allowed_for_speech_metadata",
        success: true,
      }),
    );
    expectMetadataOnly(boundary.getDecisions(), telemetry);
  });

  it.each([
    "tool_output",
    "file_content",
    "code_block",
    "personal_context",
    "audit_log",
    "runtime_output",
    "transcript",
    "unknown_restricted",
  ] satisfies VoiceRestrictedContentClassification[])(
    "blocks %s from speech",
    async (classification) => {
      const { boundary, telemetry } = createHarness();

      const result = await boundary.evaluateDescriptor(
        descriptorWithUnsafePayloads({ classification }),
      );

      expect(result.record).toEqual(
        expect.objectContaining({
          classification,
          decision: "blocked_from_speech",
        }),
      );
      expect(telemetry).toContainEqual(
        expect.objectContaining({
          eventType: "voice_restricted_content_blocked",
          restrictedContentClassification: classification,
          restrictedContentDecision: "blocked_from_speech",
          success: false,
        }),
      );
      expectMetadataOnly(boundary.getDecisions(), telemetry);
    },
  );

  it("makes duplicate descriptors idempotent no-ops", async () => {
    const { boundary, telemetry } = createHarness();
    const descriptor = contentDescriptor({
      classification: "tool_output",
    });

    const first = await boundary.evaluateDescriptor(descriptor);
    const duplicate = await boundary.evaluateDescriptor(descriptor);

    expect(first.record).toEqual(
      expect.objectContaining({
        decision: "blocked_from_speech",
      }),
    );
    expect(duplicate.record).toEqual(
      expect.objectContaining({
        decision: "no_op",
      }),
    );
    expect(boundary.getDecisions("session-1")).toHaveLength(1);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_restricted_content_noop",
        restrictedContentDecision: "no_op",
      }),
    );
    expectMetadataOnly(boundary.getDecisions(), telemetry);
  });

  it("treats terminal descriptors as no-ops", async () => {
    const { boundary, telemetry } = createHarness();

    const result = await boundary.evaluateDescriptor(
      contentDescriptor({
        terminal: true,
        classification: "assistant_prose_metadata",
      }),
    );

    expect(result.record).toEqual(
      expect.objectContaining({
        decision: "no_op",
      }),
    );
    expect(boundary.getDecisions("session-1")).toEqual([]);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "voice_restricted_content_noop",
        restrictedContentDecision: "no_op",
      }),
    );
  });

  it("does not keep text or audio-like payloads in records or telemetry", async () => {
    const { boundary, telemetry } = createHarness();

    const result = await boundary.evaluateDescriptor(
      descriptorWithUnsafePayloads({
        classification: "unknown_restricted",
      }),
    );

    expect(Object.keys(result.descriptor)).not.toEqual(
      expect.arrayContaining([
        "contentText",
        "toolOutput",
        "fileContent",
        "codeBlock",
        "personalContext",
        "auditLog",
        "runtimeOutput",
        "transcript",
        "spokenText",
        "assistantBody",
        "audio",
        "audioUrl",
        "pcm",
      ]),
    );
    expectMetadataOnly(
      { result, stored: boundary.getDecisions("session-1") },
      telemetry,
    );
  });

  it("does not introduce TTS, playback, runtime, approval, chat, cloud, mic, UI, or browser wiring", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/lib/voice-streaming/restricted-content-boundary.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["'][^"']*(tts|audio|playback)/i);
    expect(source).not.toMatch(
      /synthesize|HTMLAudioElement|startPlayback|\.play\(/i,
    );
    expect(source).not.toMatch(/runtime-commands|executeRuntime|runTool/i);
    expect(source).not.toMatch(/approveRuntime|executeApproval|bypass/i);
    expect(source).not.toMatch(/\/api\/chat|submitChat|autoSubmit/i);
    expect(source).not.toMatch(/OpenAI|chat\.completions|\/realtime/i);
    expect(source).not.toMatch(/cloud\s*(stream|streaming)|cloudStreaming/i);
    expect(source).not.toMatch(/microphone|navigator|mediaDevices/i);
    expect(source).not.toMatch(
      /keyboard|addEventListener|window\.|document\./i,
    );
    expect(source).not.toMatch(/wake\s*word|always[-_\s]?listening/i);
  });
});
