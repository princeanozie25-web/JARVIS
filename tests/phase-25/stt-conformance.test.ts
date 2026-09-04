import { describe, expect, it, vi } from "vitest";

import {
  MLX_WHISPER_PYTHON_HELPER,
  PARAKEET_PYTHON_HELPER,
  createFakeSttProvider,
  createFasterWhisperSttProvider,
  createMlxSttProviderFromEnv,
  createMlxWhisperSttProvider,
  createParakeetMlxSttProvider,
  parseFinalJson,
  resolveSttProviderId,
  type PythonSttSpawnedProcess,
  type SttProvider,
} from "@/lib/voice-runtime";

// E-039 — ONE conformance contract over four STT providers on the frozen
// SttProvider seam: fake, faster-whisper (frozen Phase 14 fallback),
// parakeet-mlx (default), mlx-whisper. Same contract, same events, no raw
// audio anywhere in a result or diagnostic (I2).

const request = {
  request_id: "req-1",
  session_id: "s1",
  turn_id: "t1",
  audio: {
    audio_ref: "/tmp/jarvis-voice/utt5.wav",
    mime_type: "audio/wav",
    duration_ms: 4545,
    size_bytes: 145510,
    sample_rate_hz: 16000,
    metadata_only: true as const,
  },
  metadata_only: true as const,
};
const AUDIO_LEAK = /RIFF|pcm|base64|audio_bytes|waveform/i;

/** A fake python: emits `lines` on stdout then exits with `code`. */
function fakePython(lines: string[], code = 0, delayMs = 0) {
  return () => {
    const out: ((c: Buffer | string) => void)[] = [];
    const err: ((c: Buffer | string) => void)[] = [];
    const close: ((code: number | null, signal: string | null) => void)[] = [];
    const proc: PythonSttSpawnedProcess = {
      stdout: {
        on: (_e: "data", l: (c: Buffer | string) => void) => out.push(l),
      },
      stderr: {
        on: (_e: "data", l: (c: Buffer | string) => void) => err.push(l),
      },
      on: (event: string, listener: (...args: never[]) => void) => {
        if (event === "close") close.push(listener as (typeof close)[number]);
      },
      kill: vi.fn(() => {
        setTimeout(() => close.forEach((l) => l(null, "SIGTERM")), 0);
        return true;
      }),
    };
    setTimeout(() => {
      for (const line of lines) out.forEach((l) => l(`${line}\n`));
      close.forEach((l) => l(code, null));
    }, delayMs);
    return proc;
  };
}

const FINAL = JSON.stringify({
  transcript: "Jarvis, read the room temperature.",
  language: "en",
  latency_ms: 120,
  confidence_band: "unknown",
  degraded: false,
});

interface Variant {
  readonly name: string;
  readonly make: (
    spawn: ReturnType<typeof fakePython>,
    onPartial?: (p: string) => void,
  ) => SttProvider;
  readonly helper: string | null;
}

const VARIANTS: readonly Variant[] = [
  {
    name: "fake",
    make: () => createFakeSttProvider({ mode: "healthy" }),
    helper: null,
  },
  {
    name: "faster-whisper (frozen fallback)",
    make: (spawn) =>
      createFasterWhisperSttProvider({
        config: {
          pythonCommand: "/venv/bin/python",
          modelName: "base.en",
          modelPath: "/models/faster-whisper-base.en",
          language: "en",
          beamSize: 5,
          vadEnabled: true,
          timeoutMs: 5000,
          maxAudioBytes: 25_000_000,
          providerId: "faster-whisper",
          metadata_only: true,
        },
        runner: { spawn: spawn as never },
      }),
    helper: null,
  },
  {
    name: "parakeet-mlx (default)",
    make: (spawn, onPartial) =>
      createParakeetMlxSttProvider({
        pythonCommand: "/venv-mlx/bin/python",
        runner: { spawn },
        onPartial,
      }),
    helper: PARAKEET_PYTHON_HELPER,
  },
  {
    name: "mlx-whisper (multilingual)",
    make: (spawn) =>
      createMlxWhisperSttProvider({
        pythonCommand: "/venv-mlx/bin/python",
        language: "en",
        runner: { spawn },
      }),
    helper: MLX_WHISPER_PYTHON_HELPER,
  },
];

describe("E-039 STT conformance", () => {
  for (const variant of VARIANTS) {
    describe(variant.name, () => {
      it("transcribes to the same result contract, metadata only", async () => {
        const provider = variant.make(fakePython([FINAL]));
        expect(provider.kind).toBe("local");
        expect(provider.config.metadata_only).toBe(true);
        const result = await provider.transcribe(request, {
          metadata_only: true,
        });
        expect(result).toMatchObject({
          request_id: "req-1",
          provider_id: provider.id,
          metadata_only: true,
        });
        expect(result.transcript.length).toBeGreaterThan(0);
        expect(typeof result.latency_ms).toBe("number");
        expect(JSON.stringify(result)).not.toMatch(AUDIO_LEAK);
        const health = await provider.health();
        expect(health).toMatchObject({
          provider_id: provider.id,
          provider_kind: "local",
          metadata_only: true,
        });
      });

      if (variant.helper) {
        it("KILL-DRILL: interpreter exits non-zero -> fails closed with bounded, traceback-free diagnostics", async () => {
          const provider = variant.make(
            fakePython(
              [
                "Traceback (most recent call last):",
                '  File "x.py", line 1',
                "RuntimeError: FFmpeg is not installed",
              ],
              1,
            ),
          );
          await expect(
            provider.transcribe(request, { metadata_only: true }),
          ).rejects.toMatchObject({
            reason: "provider_error",
            metadata_only: true,
          });
          const health = await provider.health();
          expect(health.last_error_class).toBe("provider_error");
          expect(JSON.stringify(health)).not.toMatch(AUDIO_LEAK);
        });

        it("cancel() kills the in-flight interpreter and reports the reason", async () => {
          const provider = variant.make(fakePython([FINAL], 0, 500));
          const pending = provider.transcribe(request, { metadata_only: true });
          await provider.cancel("user_cancelled");
          await expect(pending).rejects.toMatchObject({
            reason: expect.stringMatching(/user_cancelled|provider_error/),
          });
        });

        it("the helper prints exactly one final JSON line and never writes audio", () => {
          expect(variant.helper).toContain("json.dumps({'transcript'");
          expect(variant.helper).not.toMatch(/open\(|write\(|save|\.wav'/);
        });
      }
    });
  }

  it("parakeet emits per-sentence partials before the final transcript", async () => {
    const partials: string[] = [];
    const provider = createParakeetMlxSttProvider({
      pythonCommand: "/venv-mlx/bin/python",
      runner: {
        spawn: fakePython([
          JSON.stringify({ partial: "Jarvis," }),
          JSON.stringify({ partial: "read the room temperature." }),
          FINAL,
        ]),
      },
      onPartial: (p: string) => partials.push(p),
    });
    const result = await provider.transcribe(request, { metadata_only: true });
    expect(partials).toEqual(["Jarvis,", "read the room temperature."]);
    expect(result.transcript).toBe("Jarvis, read the room temperature.");
  });

  it("selection: parakeet-mlx is the default, faster-whisper stays selectable, unknown ids fail to the default", () => {
    expect(resolveSttProviderId({})).toBe("parakeet-mlx");
    expect(
      resolveSttProviderId({ JARVIS_STT_PROVIDER_ID: "mlx-whisper" }),
    ).toBe("mlx-whisper");
    expect(
      resolveSttProviderId({ JARVIS_STT_PROVIDER_ID: "faster-whisper" }),
    ).toBe("faster-whisper");
    expect(resolveSttProviderId({ JARVIS_STT_PROVIDER_ID: "cloud-stt" })).toBe(
      "parakeet-mlx",
    );
    expect(createMlxSttProviderFromEnv({})).toBeNull(); // no interpreter -> nothing, never a guess
    expect(
      createMlxSttProviderFromEnv({
        JARVIS_STT_MLX_PYTHON_COMMAND: "/venv-mlx/bin/python",
      })?.id,
    ).toBe("parakeet-mlx");
    expect(
      createMlxSttProviderFromEnv({
        JARVIS_STT_PYTHON_COMMAND: "/venv-mlx/bin/python",
        JARVIS_STT_PROVIDER_ID: "mlx-whisper",
      })?.id,
    ).toBe("mlx-whisper");
    expect(
      createMlxSttProviderFromEnv({
        JARVIS_STT_PYTHON_COMMAND: "/venv/bin/python",
        JARVIS_STT_PROVIDER_ID: "faster-whisper",
      }),
    ).toBeNull();
  });

  it("parseFinalJson takes the LAST json line and rejects malformed output", () => {
    expect(parseFinalJson(`{"partial":"a"}\n${FINAL}\n`).ok).toBe(true);
    expect(parseFinalJson("not json").ok).toBe(false);
    expect(
      parseFinalJson(
        JSON.stringify({
          transcript: "x",
          language: "en",
          confidence_band: "bogus",
          degraded: false,
        }),
      ).ok,
    ).toBe(false);
  });
});
