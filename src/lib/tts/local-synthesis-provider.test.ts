import { describe, expect, it, vi } from "vitest";
import { InMemorySpeechQueueManager } from "./queue";
import {
  createLocalTtsSynthesisProvider,
  speechInputFromChunk,
  synthesizeQueuedSpeechItem,
  type LocalTtsSynthesisTelemetryEvent,
} from "./local-synthesis-provider";
import type {
  LocalTtsSynthesisHandle,
  LocalTtsSynthesisOutput,
} from "./local-runtime";
import type {
  LocalSpeechProviderConfig,
  SpeechChunk,
  SpeechProviderMetadata,
  SpeechProviderStatus,
} from "./types";

const config: LocalSpeechProviderConfig = {
  binaryPath: "C:\\local\\tts.exe",
  voiceModelPath: "C:\\local\\voice.onnx",
  speakerId: "jarvis",
  sampleRate: 24_000,
  startupTimeoutMs: 1,
  executionTimeoutMs: 5,
};

function chunk(text = "Assistant prose for local synthesis."): SpeechChunk {
  return {
    id: "chunk-1",
    text,
    index: 0,
    createdAt: 100,
    source: "assistant_prose",
  };
}

function createHandle(
  output: Partial<LocalTtsSynthesisOutput> = {},
): LocalTtsSynthesisHandle {
  return {
    shutdown: vi.fn().mockResolvedValue(undefined),
    synthesize: vi.fn().mockResolvedValue({
      data: new Uint8Array([1, 2, 3, 4]),
      mimeType: "audio/wav",
      durationMs: 250,
      sampleRate: 24_000,
      ...output,
    }),
  };
}

function createProvider(input: {
  handle?: LocalTtsSynthesisHandle | null;
  enabled?: boolean;
  status?: SpeechProviderStatus;
  telemetry?: LocalTtsSynthesisTelemetryEvent[];
  metadata?: SpeechProviderMetadata;
  now?: () => number;
}) {
  return createLocalTtsSynthesisProvider({
    enabled: input.enabled ?? true,
    status: input.status ?? "ready",
    handle: input.handle === undefined ? createHandle() : input.handle,
    config,
    metadata: input.metadata,
    now: input.now,
    newId: () => "audio-1",
    emitTelemetry: (event) => input.telemetry?.push(event),
  });
}

describe("createLocalTtsSynthesisProvider", () => {
  it("refuses synthesis when disabled, unready, or missing a runtime handle", async () => {
    const handle = createHandle();

    await expect(
      createProvider({ handle, enabled: false }).synthesize(
        speechInputFromChunk(chunk()),
      ),
    ).resolves.toMatchObject({
      status: "disabled",
      providerId: "local-tts-placeholder",
      audio: null,
      reason: "provider_disabled",
    });
    await expect(
      createProvider({ handle, status: "not_installed" }).synthesize(
        speechInputFromChunk(chunk()),
      ),
    ).resolves.toMatchObject({
      status: "disabled",
      audio: null,
      reason: "provider_unavailable",
    });
    await expect(
      createProvider({ handle: null }).synthesize(
        speechInputFromChunk(chunk()),
      ),
    ).resolves.toMatchObject({
      status: "disabled",
      audio: null,
      reason: "provider_unavailable",
    });
    expect(handle.synthesize).not.toHaveBeenCalled();
  });

  it("returns transient local audio metadata after successful synthesis", async () => {
    let now = 1_000;
    const telemetry: LocalTtsSynthesisTelemetryEvent[] = [];
    const handle = createHandle();
    const provider = createProvider({
      handle,
      telemetry,
      now: () => now++,
    });

    await expect(
      provider.synthesize(speechInputFromChunk(chunk())),
    ).resolves.toEqual({
      status: "completed",
      providerId: "local-tts-placeholder",
      audio: {
        id: "audio-1",
        chunkId: "chunk-1",
        mimeType: "audio/wav",
        durationMs: 250,
        sampleRate: 24_000,
        byteLength: 4,
        createdAt: 1_001,
        source: "local_tts",
        data: new Uint8Array([1, 2, 3, 4]),
      },
    });
    expect(handle.synthesize).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Assistant prose for local synthesis.",
        speakerId: "jarvis",
        sampleRate: 24_000,
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(telemetry.map((event) => event.eventType)).toEqual([
      "local_tts_synthesis_started",
      "local_tts_synthesis_completed",
    ]);
  });

  it("aborts synthesis on execution timeout", async () => {
    let aborted = false;
    const telemetry: LocalTtsSynthesisTelemetryEvent[] = [];
    const handle: LocalTtsSynthesisHandle = {
      shutdown: vi.fn().mockResolvedValue(undefined),
      synthesize: vi.fn(
        (_input, options) =>
          new Promise<LocalTtsSynthesisOutput>(() => {
            options?.signal?.addEventListener("abort", () => {
              aborted = true;
            });
          }),
      ),
    };
    const provider = createProvider({ handle, telemetry });

    await expect(
      provider.synthesize(speechInputFromChunk(chunk())),
    ).resolves.toMatchObject({
      status: "error",
      audio: null,
      errorMessage: "synthesis_timeout",
    });
    expect(aborted).toBe(true);
    expect(telemetry).toContainEqual(
      expect.objectContaining({
        eventType: "local_tts_synthesis_failed",
        error: "synthesis_timeout",
      }),
    );
  });

  it("propagates abort and cleans up the in-flight execution", async () => {
    let aborted = false;
    const controller = new AbortController();
    const handle: LocalTtsSynthesisHandle = {
      shutdown: vi.fn().mockResolvedValue(undefined),
      synthesize: vi.fn(
        (_input, options) =>
          new Promise<LocalTtsSynthesisOutput>((_resolve, reject) => {
            options?.signal?.addEventListener("abort", () => {
              aborted = true;
              reject(
                Object.assign(new Error("aborted with secret text"), {
                  name: "AbortError",
                }),
              );
            });
          }),
      ),
    };
    const provider = createProvider({ handle });

    const running = provider.synthesize(speechInputFromChunk(chunk()), {
      signal: controller.signal,
    });
    controller.abort();

    await expect(running).resolves.toMatchObject({
      status: "error",
      audio: null,
      errorMessage: "synthesis_aborted",
    });
    expect(aborted).toBe(true);
  });

  it("sanitizes synthesis failures", async () => {
    const telemetry: LocalTtsSynthesisTelemetryEvent[] = [];
    const secretFailure = "secret assistant text in failure";
    const handle: LocalTtsSynthesisHandle = {
      shutdown: vi.fn().mockResolvedValue(undefined),
      synthesize: vi.fn().mockRejectedValue(new Error(secretFailure)),
    };
    const provider = createProvider({ handle, telemetry });

    await expect(
      provider.synthesize(speechInputFromChunk(chunk())),
    ).resolves.toMatchObject({
      status: "error",
      audio: null,
      errorMessage: "synthesis_failed",
    });
    expect(JSON.stringify(telemetry)).not.toContain(secretFailure);
  });

  it("refuses unsafe runtime metadata before calling the handle", async () => {
    const handle = createHandle();
    const provider = createProvider({
      handle,
      metadata: {
        runsLocally: true,
        requiresNetwork: true,
        storesAudio: false,
        supportsStreaming: false,
      },
    });

    await expect(
      provider.synthesize(speechInputFromChunk(chunk())),
    ).resolves.toMatchObject({
      status: "error",
      audio: null,
      errorMessage: "synthesis_failed",
    });
    expect(handle.synthesize).not.toHaveBeenCalled();
  });

  it("marks a queue item ready after successful synthesis", async () => {
    const manager = new InMemorySpeechQueueManager({
      newId: () => "queue-1",
      now: () => 1_000,
    });
    const item = manager.enqueue(chunk());
    if (!item.ok) throw new Error("Expected queue enqueue to succeed");
    const active = manager.startNext();
    if (!active) throw new Error("Expected active queue item");

    const provider = createProvider({ handle: createHandle() });

    await expect(
      synthesizeQueuedSpeechItem({
        provider,
        item: active,
        markReady: (itemId) => manager.markReady(itemId),
        fail: (itemId, error) => manager.fail(itemId, error),
      }),
    ).resolves.toMatchObject({
      item: { id: "queue-1", status: "ready" },
      result: { status: "completed", audio: expect.any(Object) },
    });
    expect(manager.getItem("queue-1")).toMatchObject({
      status: "ready",
    });
    expect(manager.getItem("queue-1")).not.toHaveProperty("audio");
  });

  it("marks a queue item failed with sanitized metadata after synthesis failure", async () => {
    const manager = new InMemorySpeechQueueManager({
      newId: () => "queue-1",
      now: () => 1_000,
    });
    const item = manager.enqueue(chunk());
    if (!item.ok) throw new Error("Expected queue enqueue to succeed");
    const active = manager.startNext();
    if (!active) throw new Error("Expected active queue item");
    const provider = createProvider({ status: "not_installed" });

    await expect(
      synthesizeQueuedSpeechItem({
        provider,
        item: active,
        markReady: (itemId) => manager.markReady(itemId),
        fail: (itemId, error) => manager.fail(itemId, error),
      }),
    ).resolves.toMatchObject({
      item: {
        id: "queue-1",
        status: "failed",
        error: "queue_item_failed",
      },
      result: { status: "disabled", audio: null },
    });
    expect(manager.getItem("queue-1")).not.toHaveProperty("audio");
  });

  it("refuses blocked content before calling the runtime", async () => {
    const handle = createHandle();
    const provider = createProvider({ handle });

    await expect(
      provider.synthesize({
        text: "```ts\nconsole.log('silent')\n```",
        source: "assistant_prose",
        chunkId: "chunk-code",
      }),
    ).resolves.toMatchObject({
      status: "blocked",
      audio: null,
      reason: "code_block_blocked",
    });
    await expect(
      provider.synthesize({
        text: "Tool output.",
        source: "tool_output",
        chunkId: "chunk-tool",
      }),
    ).resolves.toMatchObject({
      status: "blocked",
      audio: null,
      reason: "tool_output_blocked",
    });
    expect(handle.synthesize).not.toHaveBeenCalled();
  });

  it("keeps text and audio bytes out of telemetry", async () => {
    const telemetry: LocalTtsSynthesisTelemetryEvent[] = [];
    const secretText = "Assistant prose text that must not leak.";
    const provider = createProvider({
      handle: createHandle({ data: new Uint8Array([9, 8, 7]) }),
      telemetry,
    });

    await provider.synthesize(speechInputFromChunk(chunk(secretText)));

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("local_tts_synthesis_started");
    expect(serialized).toContain("local_tts_synthesis_completed");
    expect(serialized).not.toContain(secretText);
    expect(serialized).not.toContain("9,8,7");
    expect(serialized).not.toContain("data");
  });
});
