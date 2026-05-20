import { describe, expect, it, vi } from "vitest";
import { disabledTranscriptionProvider } from "./disabled-provider";
import { InMemoryTranscriptionJobManager } from "./jobs";
import type {
  TranscriptionInput,
  TranscriptionJobTelemetryEvent,
  TranscriptionProvider,
  TranscriptionResult,
} from "./types";

const transientInput: TranscriptionInput = {
  captureSessionId: "secret-capture-session",
  chunks: [
    {
      sessionId: "secret-capture-session",
      capturedAt: 10,
      sampleRate: 48_000,
      pcm: new Float32Array([0.123, 0.456]),
    },
  ],
  sampleRate: 48_000,
  durationMs: 250,
};

function createManager() {
  let id = 0;
  let now = 1_000;
  const telemetry: TranscriptionJobTelemetryEvent[] = [];
  return {
    telemetry,
    manager: new InMemoryTranscriptionJobManager({
      newId: () => `job-${++id}`,
      now: () => now++,
      emitTelemetry: (event) => {
        telemetry.push(event);
      },
    }),
  };
}

function createProvider(
  overrides: Partial<TranscriptionProvider> = {},
): TranscriptionProvider {
  return {
    id: "test-provider",
    enabled: true,
    status: "ready",
    capabilities: {
      supportsStreaming: false,
      supportsPartialResults: false,
      runsLocally: true,
      requiresNetwork: false,
      storesAudio: false,
    },
    transcribe: vi.fn().mockResolvedValue({
      status: "completed",
      providerId: "test-provider",
      text: "",
    } satisfies TranscriptionResult),
    ...overrides,
  };
}

describe("InMemoryTranscriptionJobManager", () => {
  it("rejects jobs when the provider is disabled", async () => {
    const { manager, telemetry } = createManager();

    await expect(
      manager.startJob({
        provider: disabledTranscriptionProvider,
        input: transientInput,
        source: "ptt_capture",
      }),
    ).resolves.toMatchObject({
      id: "job-1",
      providerId: "disabled-local-placeholder",
      status: "rejected",
      source: "ptt_capture",
      error: "provider_disabled",
    });

    expect(manager.hasTransientAudioReferences()).toBe(false);
    expect(telemetry).toEqual([
      expect.objectContaining({
        eventType: "transcription_job_rejected",
        providerId: "disabled-local-placeholder",
        status: "rejected",
        success: false,
      }),
    ]);
  });

  it("rejects jobs when the provider is unavailable", async () => {
    const { manager } = createManager();
    const provider = createProvider({
      status: "not_installed",
      transcribe: vi.fn(),
    });

    await expect(
      manager.startJob({
        provider,
        input: transientInput,
        source: "ptt_capture",
      }),
    ).resolves.toMatchObject({
      status: "rejected",
      error: "provider_unavailable",
    });

    expect(provider.transcribe).not.toHaveBeenCalled();
    expect(manager.hasTransientAudioReferences()).toBe(false);
  });

  it("blocks duplicate active jobs", async () => {
    const { manager } = createManager();
    let resolveTranscription:
      | ((result: TranscriptionResult) => void)
      | undefined;
    const provider = createProvider({
      transcribe: vi.fn(
        () =>
          new Promise<TranscriptionResult>((resolve) => {
            resolveTranscription = resolve;
          }),
      ),
    });

    const first = manager.startJob({
      provider,
      input: transientInput,
      source: "ptt_capture",
    });
    expect(manager.hasTransientAudioReferences()).toBe(true);

    await expect(
      manager.startJob({
        provider,
        input: transientInput,
        source: "ptt_capture",
      }),
    ).resolves.toMatchObject({
      status: "rejected",
      error: "Transcription job already active: job-1",
    });

    resolveTranscription?.({
      status: "completed",
      providerId: "test-provider",
      text: "",
    });
    await first;
  });

  it("cancels an active job and clears transient audio references", async () => {
    const { manager, telemetry } = createManager();
    let resolveTranscription:
      | ((result: TranscriptionResult) => void)
      | undefined;
    const provider = createProvider({
      transcribe: vi.fn(
        () =>
          new Promise<TranscriptionResult>((resolve) => {
            resolveTranscription = resolve;
          }),
      ),
    });

    const running = manager.startJob({
      provider,
      input: transientInput,
      source: "ptt_capture",
    });

    await expect(manager.cancel("job-1")).resolves.toMatchObject({
      status: "cancelled",
    });
    expect(manager.hasTransientAudioReferences()).toBe(false);

    resolveTranscription?.({
      status: "completed",
      providerId: "test-provider",
      text: "",
    });
    await expect(running).resolves.toMatchObject({ status: "cancelled" });
    expect(telemetry.map((event) => event.eventType)).toContain(
      "transcription_job_cancelled",
    );
  });

  it("clears transient audio references after completed and failed jobs", async () => {
    const completed = createManager();
    await expect(
      completed.manager.startJob({
        provider: createProvider(),
        input: transientInput,
        source: "ptt_capture",
      }),
    ).resolves.toMatchObject({ status: "completed" });
    expect(completed.manager.hasTransientAudioReferences()).toBe(false);

    const failed = createManager();
    await expect(
      failed.manager.startJob({
        provider: createProvider({
          transcribe: vi.fn().mockRejectedValue(new Error("local failure")),
        }),
        input: transientInput,
        source: "ptt_capture",
      }),
    ).resolves.toMatchObject({ status: "failed", error: "local failure" });
    expect(failed.manager.hasTransientAudioReferences()).toBe(false);
  });

  it("emits telemetry without raw audio or transcript content", async () => {
    const { manager, telemetry } = createManager();
    await manager.startJob({
      provider: createProvider({
        transcribe: vi.fn().mockResolvedValue({
          status: "completed",
          providerId: "test-provider",
          text: "secret transcript text",
        }),
      }),
      input: transientInput,
      source: "ptt_capture",
    });

    const serialized = JSON.stringify(telemetry);
    expect(serialized).toContain("transcription_job_started");
    expect(serialized).toContain("transcription_job_completed");
    expect(serialized).not.toContain("secret-capture-session");
    expect(serialized).not.toContain("0.123");
    expect(serialized).not.toContain("secret transcript text");
  });
});
