import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FASTER_WHISPER_CONTRACT_LIMITS,
  validateFasterWhisperProviderConfig,
  type FasterWhisperProviderConfig,
} from "../../../src/lib/voice-runtime";

function validConfig(
  overrides: Partial<FasterWhisperProviderConfig> = {},
): FasterWhisperProviderConfig {
  return {
    pythonCommand: "python",
    modelName: "base.en",
    modelPath: "C:/models/faster-whisper/base.en",
    language: "en",
    beamSize: 5,
    vadEnabled: true,
    timeoutMs: 30_000,
    maxAudioBytes: 10_000_000,
    providerId: "local-faster-whisper",
    metadata_only: true,
    ...overrides,
  };
}

describe("Phase 14C.1 faster-whisper contract", () => {
  it("validates complete faster-whisper config as text-only metadata", () => {
    expect(validateFasterWhisperProviderConfig(validConfig())).toEqual({
      ok: true,
      config: validConfig(),
      reasons: [],
    });
  });

  it("accepts executablePath architecture instead of pythonCommand", () => {
    expect(
      validateFasterWhisperProviderConfig({
        ...validConfig({ pythonCommand: undefined }),
        executablePath: "C:/tools/faster-whisper/faster-whisper.exe",
      }),
    ).toMatchObject({
      ok: true,
      config: {
        executablePath: "C:/tools/faster-whisper/faster-whisper.exe",
      },
    });
  });

  it.each([
    ["modelName", "missing_model_name"],
    ["modelPath", "missing_model_path"],
    ["providerId", "missing_provider_id"],
  ] as const)("fails closed for missing %s", (field, reason) => {
    expect(
      validateFasterWhisperProviderConfig(validConfig({ [field]: "" })),
    ).toMatchObject({
      ok: false,
      config: null,
      reasons: expect.arrayContaining([reason]),
    });
  });

  it("requires executablePath or pythonCommand", () => {
    expect(
      validateFasterWhisperProviderConfig(
        validConfig({ executablePath: undefined, pythonCommand: undefined }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["missing_executable_or_python"]),
    });
  });

  it("bounds timeout, max audio bytes, and beam size", () => {
    expect(FASTER_WHISPER_CONTRACT_LIMITS).toEqual({
      minTimeoutMs: 100,
      maxTimeoutMs: 300_000,
      minAudioBytes: 1,
      maxAudioBytes: 250_000_000,
      minBeamSize: 1,
      maxBeamSize: 10,
    });
    expect(
      validateFasterWhisperProviderConfig(validConfig({ timeoutMs: 99 })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["timeout_out_of_bounds"]),
    });
    expect(
      validateFasterWhisperProviderConfig(validConfig({ maxAudioBytes: 0 })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["max_audio_bytes_out_of_bounds"]),
    });
    expect(
      validateFasterWhisperProviderConfig(validConfig({ beamSize: 11 })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["beam_size_out_of_bounds"]),
    });
  });

  it("fails closed for malformed configs without probing files or executing", () => {
    expect(validateFasterWhisperProviderConfig(null)).toEqual({
      ok: false,
      config: null,
      reasons: ["malformed_config"],
    });
    expect(
      validateFasterWhisperProviderConfig({
        ...validConfig(),
        metadata_only: false,
      }),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["malformed_config"]),
    });
  });

  it("does not import subprocess, fs probing, mic, runtime, persistence, cloud, UI, or Tauri wiring", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/lib/voice-runtime/stt/faster-whisper-contract.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["']node:fs["']|existsSync|statSync/i);
    expect(source).not.toMatch(
      /from\s+["']node:child_process["']|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(/i,
    );
    expect(source).not.toMatch(
      /faster-whisper\s+--|python\s+-m\s+faster_whisper|from\s+["']faster_whisper/i,
    );
    expect(source).not.toMatch(
      /getUserMedia|mediaDevices|MediaRecorder|AudioContext|navigator\.mediaDevices|microphone/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry|telemetryStore/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /tsx|jsx|React|useEffect|useState|tauri|invoke\(/i,
    );
  });
});
