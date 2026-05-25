import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  STT_SMOKE_AUDIO_REF_ENV,
  STT_SMOKE_DURATION_MS_ENV,
  STT_SMOKE_TRANSCRIPT_PREVIEW_LIMIT,
  runSttSmoke,
  type SttSmokeReport,
} from "../../../scripts/voice/stt-smoke";
import type {
  FasterWhisperProviderConfig,
  SttProvider,
  SttTranscriptionResult,
} from "../../../src/lib/voice-runtime";

function fasterWhisperConfig(): FasterWhisperProviderConfig {
  return {
    pythonCommand: "python",
    modelName: "base.en",
    modelPath: "C:/models/faster-whisper",
    language: "en",
    beamSize: 3,
    vadEnabled: true,
    timeoutMs: 20000,
    maxAudioBytes: 5000000,
    providerId: "local-faster-whisper",
    metadata_only: true,
  };
}

function transcriptionResult(
  transcript = "Good evening. All systems are operational.",
): SttTranscriptionResult {
  return {
    request_id: "voice-stt-smoke",
    provider_id: "local-faster-whisper",
    transcript,
    language: "en",
    latency_ms: 42,
    degraded: false,
    confidence_band: "high",
    metadata_only: true,
  };
}

function providerWithResult(result: SttTranscriptionResult): SttProvider {
  return {
    id: "local-faster-whisper",
    kind: "local",
    config: {
      provider_id: "local-faster-whisper",
      provider_kind: "local",
      model_id: "base.en",
      language: "en",
      max_audio_bytes: 5000000,
      timeout_ms: 20000,
      metadata_only: true,
    },
    metadata_only: true,
    transcribe: vi.fn(async () => result),
    cancel: vi.fn(async () => undefined),
    health: vi.fn(
      async () =>
        ({
          provider_id: "local-faster-whisper",
          ok: true,
          provider_kind: "local",
          checked_at_ms: 0,
          degraded: false,
          metadata_only: true,
        }) as const,
    ),
  };
}

describe("Phase 14C.4 manual faster-whisper STT smoke harness", () => {
  it("requires explicit audio_ref and prints metadata-safe output", async () => {
    const lines: string[] = [];
    const provider = providerWithResult(transcriptionResult());

    const report = await runSttSmoke({
      env: {
        [STT_SMOKE_AUDIO_REF_ENV]: "C:/audio/jarvis-smoke.wav",
        [STT_SMOKE_DURATION_MS_ENV]: "2100",
      },
      loadConfig: () => ({
        ok: true,
        config: fasterWhisperConfig(),
        reasons: [],
      }),
      createProvider: () => provider,
      statAudio: vi.fn(async () => ({ size: 32000 })),
      writeLine: (line) => lines.push(line),
    });

    expect(provider.transcribe).toHaveBeenCalledWith(
      {
        request_id: "voice-stt-smoke",
        session_id: "stt-smoke-session",
        turn_id: "stt-smoke-turn",
        audio: {
          audio_ref: "C:/audio/jarvis-smoke.wav",
          mime_type: "audio/wav",
          duration_ms: 2100,
          size_bytes: 32000,
          metadata_only: true,
        },
        metadata_only: true,
      },
      {
        timeout_ms: 20000,
        metadata_only: true,
      },
    );
    expect(report).toEqual({
      provider_id: "local-faster-whisper",
      language: "en",
      confidence_band: "high",
      latency_ms: 42,
      degraded: false,
      transcript_preview: "Good evening. All systems are operational.",
      result: transcriptionResult(),
    } satisfies SttSmokeReport);
    expect(lines).toEqual([
      "JARVIS faster-whisper STT smoke",
      "status: ok",
      "provider_id: local-faster-whisper",
      "language: en",
      "confidence_band: high",
      "latency_ms: 42",
      "degraded: false",
      "transcript_preview: Good evening. All systems are operational.",
    ]);
    expect(lines.join("\n")).not.toMatch(/audio_bytes|raw_audio|pcm|waveform/i);
  });

  it("fails closed when local config is invalid", async () => {
    await expect(
      runSttSmoke({
        env: {},
        loadConfig: () => ({
          ok: false,
          config: null,
          reasons: ["missing_execution_command"],
        }),
        createProvider: vi.fn(),
        statAudio: vi.fn(),
        writeLine: vi.fn(),
      }),
    ).rejects.toMatchObject({
      name: "SttSmokeError",
      message: expect.stringContaining("missing_execution_command"),
    });
  });

  it("prints bounded provider diagnostics on fail-closed provider errors", async () => {
    const lines: string[] = [];
    const provider = providerWithResult(transcriptionResult());
    vi.mocked(provider.transcribe).mockRejectedValueOnce({
      reason: "provider_error",
      diagnostics: {
        error_class: "provider_error",
        stderr_preview: [
          "Traceback (most recent call last):",
          '  File "C:/secret/transcribe.py", line 1, in <module>',
          "ModuleNotFoundError: No module named 'faster_whisper'",
          "x".repeat(900),
        ].join("\n"),
        exit_code: 1,
        signal: null,
        truncated: true,
        metadata_only: true,
      },
      metadata_only: true,
    });

    await expect(
      runSttSmoke({
        env: {
          [STT_SMOKE_AUDIO_REF_ENV]: "C:/audio/jarvis-smoke.wav",
          [STT_SMOKE_DURATION_MS_ENV]: "2100",
        },
        loadConfig: () => ({
          ok: true,
          config: fasterWhisperConfig(),
          reasons: [],
        }),
        createProvider: () => provider,
        statAudio: vi.fn(async () => ({ size: 32000 })),
        writeLine: (line) => lines.push(line),
      }),
    ).rejects.toMatchObject({
      name: "SttSmokeError",
      error_class: "provider_error",
      exit_code: 1,
      stderr_preview: expect.stringContaining(
        "ModuleNotFoundError: No module named 'faster_whisper'",
      ),
    });

    const output = lines.join("\n");
    expect(output).toContain("status: failed");
    expect(output).toContain("provider_id: local-faster-whisper");
    expect(output).toContain("error_class: provider_error");
    expect(output).toContain("exit_code: 1");
    expect(output).toContain("stderr_preview: ModuleNotFoundError");
    expect(output).not.toContain("Traceback (most recent call last):");
    expect(output).not.toContain("C:/secret/transcribe.py");
    expect(output).not.toMatch(/audio_bytes|raw_audio|pcm|waveform/i);
    const stderrLine = lines.find((line) => line.startsWith("stderr_preview:"));
    expect(stderrLine?.length ?? 0).toBeLessThanOrEqual(
      "stderr_preview: ".length + 512,
    );
  });

  it("requires explicit audio_ref and duration metadata before execution", async () => {
    const createProvider = vi.fn();
    await expect(
      runSttSmoke({
        env: { [STT_SMOKE_DURATION_MS_ENV]: "2100" },
        loadConfig: () => ({
          ok: true,
          config: fasterWhisperConfig(),
          reasons: [],
        }),
        createProvider,
        statAudio: vi.fn(),
        writeLine: vi.fn(),
      }),
    ).rejects.toMatchObject({
      name: "SttSmokeError",
      message: expect.stringContaining("JARVIS_STT_SMOKE_AUDIO_REF"),
    });
    expect(createProvider).not.toHaveBeenCalled();

    await expect(
      runSttSmoke({
        env: { [STT_SMOKE_AUDIO_REF_ENV]: "C:/audio/jarvis-smoke.wav" },
        loadConfig: () => ({
          ok: true,
          config: fasterWhisperConfig(),
          reasons: [],
        }),
        createProvider,
        statAudio: vi.fn(),
        writeLine: vi.fn(),
      }),
    ).rejects.toMatchObject({
      name: "SttSmokeError",
      message: expect.stringContaining("JARVIS_STT_SMOKE_DURATION_MS"),
    });
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("bounds transcript preview to 80 characters", async () => {
    const longTranscript = "a".repeat(STT_SMOKE_TRANSCRIPT_PREVIEW_LIMIT + 25);
    const lines: string[] = [];
    const report = await runSttSmoke({
      env: {
        [STT_SMOKE_AUDIO_REF_ENV]: "C:/audio/jarvis-smoke.mp3",
        [STT_SMOKE_DURATION_MS_ENV]: "1000",
      },
      loadConfig: () => ({
        ok: true,
        config: fasterWhisperConfig(),
        reasons: [],
      }),
      createProvider: () =>
        providerWithResult(transcriptionResult(longTranscript)),
      statAudio: vi.fn(async () => ({ size: 12000 })),
      writeLine: (line) => lines.push(line),
    });

    expect(report.transcript_preview).toHaveLength(
      STT_SMOKE_TRANSCRIPT_PREVIEW_LIMIT,
    );
    expect(lines.join("\n")).toContain(
      `transcript_preview: ${"a".repeat(STT_SMOKE_TRANSCRIPT_PREVIEW_LIMIT)}`,
    );
    expect(lines.join("\n")).not.toContain(longTranscript);
  });

  it("does not execute on import or wire lifecycle scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { readonly scripts: Record<string, string> };

    expect(packageJson.scripts["voice:stt:smoke"]).toBe(
      "tsx scripts/voice/stt-smoke.ts",
    );
    for (const [name, command] of Object.entries(packageJson.scripts)) {
      if (name === "voice:stt:smoke") continue;
      expect(command).not.toContain("scripts/voice/stt-smoke.ts");
    }
  });

  it("does not introduce mic, streaming, runtime, persistence, cloud, or UI wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/voice/stt-smoke.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|microphone|micCapture/i,
    );
    expect(source).not.toMatch(
      /AsyncIterable|partial_transcript|streamingTranscription|stream\s*\(/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry\s*\(|telemetryStore/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(/jsx|React|useEffect|useState|tauri|invoke\(/i);
  });
});
