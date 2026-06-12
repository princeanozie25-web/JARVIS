import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SYSTEM_CHATTERBOX_URL,
  DEFAULT_SYSTEM_KOKORO_URL,
  createChatterboxSpeechProvider,
  createKokoroSpeechProvider,
} from "./chatterbox-provider";
import { speechProviders } from "./registry";

describe("system Chatterbox speech provider", () => {
  it("registers Chatterbox and Kokoro for system-wide speech output", () => {
    expect(speechProviders.get("chatterbox-tts-server")).toMatchObject({
      id: "chatterbox-tts-server",
      enabled: false,
      status: "unavailable",
      metadata: {
        runsLocally: true,
        requiresNetwork: false,
        storesAudio: false,
        supportsStreaming: false,
      },
    });
    expect(speechProviders.get("kokoro")).toMatchObject({
      id: "kokoro",
      enabled: false,
      status: "unavailable",
    });
  });

  it("synthesizes assistant prose through the local Chatterbox endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "audio/wav" },
      }),
    );
    const provider = createChatterboxSpeechProvider({
      fetchImpl: fetchMock,
      now: () => 22,
      newId: () => "speech-audio-1",
    });

    const result = await provider.synthesize({
      text: "Safe assistant prose.",
      source: "assistant_prose",
      chunkId: "chunk-1",
    });

    expect(result).toMatchObject({
      status: "completed",
      providerId: "chatterbox-tts-server",
      audio: {
        id: "speech-audio-1",
        chunkId: "chunk-1",
        mimeType: "audio/wav",
        byteLength: 4,
        createdAt: 22,
        source: "local_tts",
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_SYSTEM_CHATTERBOX_URL}/tts`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Safe assistant prose."),
      }),
    );
  });

  it("uses Kokoro as the second local provider in the system chain", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([5, 6]), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      }),
    );
    const provider = createKokoroSpeechProvider({
      fetchImpl: fetchMock,
      newId: () => "kokoro-audio-1",
    });

    const result = await provider.synthesize({
      text: "Safe assistant prose.",
      source: "assistant_prose",
      chunkId: "chunk-2",
    });

    expect(result).toMatchObject({
      status: "completed",
      providerId: "kokoro",
      audio: {
        id: "kokoro-audio-1",
        mimeType: "audio/mpeg",
        byteLength: 2,
      },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_SYSTEM_KOKORO_URL}/v1/audio/speech`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Safe assistant prose."),
      }),
    );
  });

  it("blocks unsafe speech classes and non-loopback endpoints", async () => {
    const fetchMock = vi.fn();
    const provider = createChatterboxSpeechProvider({ fetchImpl: fetchMock });

    await expect(
      provider.synthesize({ text: "tool output", source: "tool_output" }),
    ).resolves.toMatchObject({
      status: "blocked",
      reason: "tool_output_blocked",
      audio: null,
    });

    const remoteProvider = createChatterboxSpeechProvider({
      baseUrl: "https://example.com",
      fetchImpl: fetchMock,
    });
    await expect(
      remoteProvider.synthesize({
        text: "Safe assistant prose.",
        source: "assistant_prose",
      }),
    ).resolves.toMatchObject({
      status: "error",
      errorMessage: "non_loopback_tts_endpoint_blocked",
      audio: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
