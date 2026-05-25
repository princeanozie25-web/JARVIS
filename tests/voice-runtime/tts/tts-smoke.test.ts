import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  TTS_SMOKE_TEXT,
  runTtsSmoke,
  type TtsSmokeReport,
} from "../../../scripts/voice/tts-smoke";
import type {
  PiperProviderConfig,
  TtsProvider,
  TtsSynthesisResult,
} from "../../../src/lib/voice-runtime";

function piperConfig(): PiperProviderConfig {
  return {
    piperExecutablePath: "C:/tools/piper/piper.exe",
    voiceModelPath: "C:/voices/jarvis.onnx",
    voiceConfigPath: "C:/voices/jarvis.onnx.json",
    outputDirectory: "C:/tmp/jarvis-tts",
    providerId: "local-piper",
    voiceId: "jarvis-local",
    timeoutMs: 15000,
    maxInputChars: 900,
    metadata_only: true,
  };
}

function synthesisResult(): TtsSynthesisResult {
  return {
    request_id: "voice-tts-smoke",
    chunk: {
      chunk_id: "chunk-1",
      provider_id: "local-piper",
      voice_id: "jarvis-local",
      duration_ms: 1200,
      size_bytes: 4096,
      degraded: false,
      output_ref: "C:/tmp/jarvis-tts/smoke.wav",
      metadata_only: true,
    },
    latency_ms: 10,
    degraded: false,
    metadata_only: true,
  };
}

describe("Phase 14B.4 manual Piper TTS smoke harness", () => {
  it("uses fixed safe assistant prose text and prints metadata only", async () => {
    const lines: string[] = [];
    const synthesize = vi.fn(async () => synthesisResult());
    const provider: TtsProvider = {
      id: "local-piper",
      kind: "local",
      config: {
        provider_id: "local-piper",
        provider_kind: "local",
        voice_id: "jarvis-local",
        max_input_chars: 900,
        timeout_ms: 15000,
        metadata_only: true,
      },
      metadata_only: true,
      synthesize,
      cancel: vi.fn(async () => undefined),
      health: vi.fn(
        async () =>
          ({
            provider_id: "local-piper",
            ok: true,
            provider_kind: "local",
            checked_at_ms: 0,
            degraded: false,
            metadata_only: true,
          }) as const,
      ),
    };

    const report = await runTtsSmoke({
      env: {},
      loadConfig: () => ({ ok: true, config: piperConfig(), reasons: [] }),
      createProvider: () => provider,
      writeLine: (line) => lines.push(line),
    });

    expect(synthesize).toHaveBeenCalledWith(
      {
        request_id: "voice-tts-smoke",
        text: TTS_SMOKE_TEXT,
        content_class: "assistant_prose",
        turn_id: "tts-smoke-turn",
        session_id: "tts-smoke-session",
        requested_voice_id: "jarvis-local",
        allow_sensitive_content: false,
        metadata_only: true,
      },
      {
        timeout_ms: 15000,
        metadata_only: true,
      },
    );
    expect(report).toEqual({
      provider_id: "local-piper",
      voice_id: "jarvis-local",
      output_ref: "C:/tmp/jarvis-tts/smoke.wav",
      duration_ms: 1200,
      size_bytes: 4096,
      degraded: false,
      result: synthesisResult(),
    } satisfies TtsSmokeReport);
    expect(lines).toEqual([
      "JARVIS Piper TTS smoke",
      "status: ok",
      "provider_id: local-piper",
      "voice_id: jarvis-local",
      "output_ref: C:/tmp/jarvis-tts/smoke.wav",
      "duration_ms: 1200",
      "size_bytes: 4096",
      "degraded: false",
    ]);
    expect(lines.join("\n")).not.toContain(TTS_SMOKE_TEXT);
    expect(lines.join("\n")).not.toMatch(/audio_bytes|raw_audio|transcript/i);
  });

  it("fails closed when local config is invalid", async () => {
    await expect(
      runTtsSmoke({
        env: {},
        loadConfig: () => ({
          ok: false,
          config: null,
          reasons: ["missing_executable"],
        }),
        createProvider: vi.fn(),
        writeLine: vi.fn(),
      }),
    ).rejects.toMatchObject({
      name: "TtsSmokeError",
      message: expect.stringContaining("missing_executable"),
    });
  });

  it("does not execute on import or wire lifecycle scripts", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { readonly scripts: Record<string, string> };

    expect(TTS_SMOKE_TEXT).toBe("Good evening. All systems are operational.");
    expect(packageJson.scripts["voice:tts:smoke"]).toBe(
      "tsx scripts/voice/tts-smoke.ts",
    );
    for (const [name, command] of Object.entries(packageJson.scripts)) {
      if (name === "voice:tts:smoke") continue;
      expect(command).not.toContain("scripts/voice/tts-smoke.ts");
    }
  });

  it("does not introduce playback, runtime, persistence, cloud, or UI wiring", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/voice/tts-smoke.ts"),
      "utf8",
    );

    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(/i,
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
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\(/i,
    );
  });
});
