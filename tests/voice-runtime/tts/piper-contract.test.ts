import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PIPER_CONTRACT_LIMITS,
  validatePiperProviderConfig,
  type PiperProviderConfig,
} from "../../../src/lib/voice-runtime";

function validPiperConfig(
  overrides: Partial<PiperProviderConfig> = {},
): PiperProviderConfig {
  return {
    piperExecutablePath: "C:/tools/piper/piper.exe",
    voiceModelPath: "C:/voices/jarvis.onnx",
    voiceConfigPath: "C:/voices/jarvis.onnx.json",
    outputDirectory: "C:/tmp/jarvis-voice",
    maxInputChars: 500,
    timeoutMs: 10_000,
    providerId: "local-piper",
    voiceId: "jarvis-local",
    metadata_only: true,
    ...overrides,
  };
}

describe("Phase 14B.1 Piper adapter contract", () => {
  it("validates complete Piper config as text-only metadata", () => {
    expect(validatePiperProviderConfig(validPiperConfig())).toEqual({
      ok: true,
      config: validPiperConfig(),
      reasons: [],
    });
  });

  it.each([
    ["piperExecutablePath", "missing_executable_path"],
    ["voiceModelPath", "missing_voice_model_path"],
    ["voiceConfigPath", "missing_voice_config_path"],
    ["outputDirectory", "missing_output_directory"],
    ["providerId", "missing_provider_id"],
    ["voiceId", "missing_voice_id"],
  ] as const)("fails closed for missing %s", (field, reason) => {
    expect(
      validatePiperProviderConfig(validPiperConfig({ [field]: "" })),
    ).toMatchObject({
      ok: false,
      config: null,
      reasons: expect.arrayContaining([reason]),
    });
  });

  it("bounds timeout and max input chars", () => {
    expect(PIPER_CONTRACT_LIMITS).toEqual({
      minTimeoutMs: 100,
      maxTimeoutMs: 120_000,
      minInputChars: 1,
      maxInputChars: 20_000,
    });
    expect(
      validatePiperProviderConfig(validPiperConfig({ timeoutMs: 99 })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["timeout_out_of_bounds"]),
    });
    expect(
      validatePiperProviderConfig(validPiperConfig({ timeoutMs: 120_001 })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["timeout_out_of_bounds"]),
    });
    expect(
      validatePiperProviderConfig(validPiperConfig({ maxInputChars: 0 })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["max_input_chars_out_of_bounds"]),
    });
    expect(
      validatePiperProviderConfig(validPiperConfig({ maxInputChars: 20_001 })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["max_input_chars_out_of_bounds"]),
    });
  });

  it("fails closed for malformed configs without probing files", () => {
    expect(validatePiperProviderConfig(null)).toEqual({
      ok: false,
      config: null,
      reasons: ["malformed_config"],
    });
    expect(
      validatePiperProviderConfig({
        ...validPiperConfig(),
        metadata_only: false,
      }),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["malformed_config"]),
    });
  });

  it("does not execute Piper, probe files, import subprocess APIs, or wire playback/runtime", () => {
    const source = [
      "src/lib/voice-runtime/tts/piper-contract.ts",
      "src/lib/voice-runtime/tts/provider.ts",
      "src/lib/voice-runtime/tts/types.ts",
    ]
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/from\s+["']node:fs["']|existsSync|statSync/i);
    expect(source).not.toMatch(
      /from\s+["']node:child_process["']|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(/i,
    );
    expect(source).not.toMatch(/piper\s+(?:--|["'])|ffmpeg|faster-whisper/i);
    expect(source).not.toMatch(
      /HTMLAudioElement|speechSynthesis|AudioBufferSourceNode|new\s+Audio\s*\(|\.play\s*\(/i,
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
  });
});
