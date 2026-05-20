import { describe, expect, it, vi } from "vitest";
import { InMemoryTranscriptionJobManager } from "./jobs";
import {
  createLocalWhisperTranscriptionProvider,
  type LocalWhisperTranscriptionProviderOptions,
} from "./local-whisper-provider";
import {
  LocalWhisperRuntime,
  type LocalWhisperRuntimeConfig,
  type LocalWhisperRuntimeHandle,
  type LocalWhisperRuntimeTranscription,
} from "./local-whisper-runtime";
import { localWhisperPlaceholderConfig } from "./local-whisper-placeholder";
import { InMemoryVoiceTranscriptDraftManager } from "./transcript-drafts";
import type {
  LocalTranscriptionTelemetryEvent,
  TranscriptionInput,
  TranscriptionJobTelemetryEvent,
  TranscriptionResult,
  VoiceTranscriptDraftTelemetryEvent,
} from "./types";

const config: LocalWhisperRuntimeConfig = {
  ...localWhisperPlaceholderConfig,
  enabled: true,
  binaryPath: "C:\\local\\whisper.exe",
  modelPath: "C:\\local\\ggml-base.bin",
  startupTimeoutMs: 5,
  executionTimeoutMs: 5,
};

const input: TranscriptionInput = {
  captureSessionId: "capture-secret",
  chunks: [
    {
      sessionId: "capture-secret",
      capturedAt: 1,
      sampleRate: 48_000,
      pcm: new Float32Array([0.1, 0.2]),
    },
  ],
  sampleRate: 48_000,
  durationMs: 125,
};

function createRuntime(handle: LocalWhisperRuntimeHandle) {
  return new LocalWhisperRuntime({
    config,
    fileExists: vi.fn().mockResolvedValue(true),
    launchRuntime: vi.fn().mockResolvedValue(handle),
  });
}

function createProvider(
  opts: Partial<LocalWhisperTranscriptionProviderOptions> & {
    handle: LocalWhisperRuntimeHandle;
    telemetry?: LocalTranscriptionTelemetryEvent[];
  },
) {
  const telemetry = opts.telemetry ?? [];
  return createLocalWhisperTranscriptionProvider({
    config,
    runtime: opts.runtime ?? createRuntime(opts.handle),
    emitTelemetry: (event) => {
      telemetry.push(event);
    },
    now: opts.now,
    status: opts.status,
  });
}

describe("createLocalWhisperTranscriptionProvider", () => {
  it("runs a successful local transcription job and creates a review draft", async () => {
    const localTelemetry: LocalTranscriptionTelemetryEvent[] = [];
    const jobTelemetry: TranscriptionJobTelemetryEvent[] = [];
    const draftTelemetry: VoiceTranscriptDraftTelemetryEvent[] = [];
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const handle: LocalWhisperRuntimeHandle = {
      shutdown,
      transcribe: vi.fn().mockResolvedValue({
        text: " local transcript ",
        confidence: 0.91,
        language: "en",
      }),
    };
    const provider = createProvider({ handle, telemetry: localTelemetry });
    const draftManager = new InMemoryVoiceTranscriptDraftManager({
      newId: () => "draft-1",
      now: () => 2_000,
      emitTelemetry: (event) => {
        draftTelemetry.push(event);
      },
    });
    const jobManager = new InMemoryTranscriptionJobManager({
      newId: () => "job-1",
      now: () => 1_000,
      emitTelemetry: (event) => {
        jobTelemetry.push(event);
      },
      onCompletedResult: async ({ job, result }) => {
        await draftManager.createDraft({
          result,
          sourceJobId: job.id,
        });
      },
    });

    await expect(
      jobManager.startJob({ provider, input, source: "ptt_capture" }),
    ).resolves.toMatchObject({
      id: "job-1",
      status: "completed",
    });

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(draftManager.getDraft()).toMatchObject({
      id: "draft-1",
      text: "local transcript",
      sourceJobId: "job-1",
      confidence: 0.91,
      language: "en",
      status: "draft",
    });
    expect(localTelemetry.map((event) => event.eventType)).toEqual([
      "local_transcription_started",
      "local_transcription_completed",
    ]);
    expect(JSON.stringify(localTelemetry)).not.toContain("local transcript");
    expect(JSON.stringify(jobTelemetry)).not.toContain("capture-secret");
    expect(draftTelemetry.map((event) => event.eventType)).toEqual([
      "transcript_draft_created",
    ]);
  });

  it("handles local transcription timeout and shuts down the runtime", async () => {
    let aborted = false;
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const handle: LocalWhisperRuntimeHandle = {
      shutdown,
      transcribe: vi.fn(
        (_input, signal) =>
          new Promise<LocalWhisperRuntimeTranscription>(() => {
            signal.addEventListener("abort", () => {
              aborted = true;
            });
          }),
      ),
    };
    const localTelemetry: LocalTranscriptionTelemetryEvent[] = [];
    const provider = createProvider({ handle, telemetry: localTelemetry });

    await expect(provider.transcribe(input)).resolves.toMatchObject({
      status: "error",
      reason: "transcription_failed",
      errorMessage: "Local Whisper transcription timed out.",
    });

    expect(aborted).toBe(true);
    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(localTelemetry).toContainEqual(
      expect.objectContaining({
        eventType: "local_transcription_failed",
        error: "timeout",
      }),
    );
  });

  it("cleans up after failed local transcription", async () => {
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const handle: LocalWhisperRuntimeHandle = {
      shutdown,
      transcribe: vi.fn().mockRejectedValue(new Error("local runtime failed")),
    };
    const provider = createProvider({ handle });

    await expect(provider.transcribe(input)).resolves.toMatchObject({
      status: "error",
      errorMessage: "local runtime failed",
    });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("cancels a running transcription job and clears transient audio references", async () => {
    let rejectTranscription: ((reason: Error) => void) | undefined;
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const handle: LocalWhisperRuntimeHandle = {
      shutdown,
      transcribe: vi.fn(
        (_input, signal) =>
          new Promise<LocalWhisperRuntimeTranscription>((_, reject) => {
            rejectTranscription = reject;
            signal.addEventListener("abort", () => {
              reject(new Error("cancelled"));
            });
          }),
      ),
    };
    const provider = createProvider({ handle });
    const jobManager = new InMemoryTranscriptionJobManager({
      newId: () => "job-1",
    });

    const running = jobManager.startJob({
      provider,
      input,
      source: "ptt_capture",
    });
    await expect(jobManager.cancel("job-1")).resolves.toMatchObject({
      status: "cancelled",
    });
    expect(jobManager.hasTransientAudioReferences()).toBe(false);

    rejectTranscription?.(new Error("cancelled"));
    await expect(running).resolves.toMatchObject({ status: "cancelled" });
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it("does not create an automatic chat submission path", async () => {
    const result: TranscriptionResult = {
      status: "completed",
      providerId: "local-whisper-placeholder",
      text: "manual review only",
    };
    const draftManager = new InMemoryVoiceTranscriptDraftManager({
      newId: () => "draft-1",
    });

    await draftManager.createDraft({ result, sourceJobId: "job-1" });

    expect(draftManager.getDraft()).toMatchObject({
      status: "draft",
      text: "manual review only",
    });
  });
});
