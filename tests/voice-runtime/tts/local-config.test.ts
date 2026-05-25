import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PIPER_TTS_MAX_INPUT_CHARS,
  DEFAULT_PIPER_TTS_TIMEOUT_MS,
  loadPiperTtsLocalConfig,
  type PiperTtsLocalEnv,
} from "../../../src/lib/voice-runtime";

function validEnv(overrides: PiperTtsLocalEnv = {}): PiperTtsLocalEnv {
  return {
    JARVIS_PIPER_EXECUTABLE: "C:/tools/piper/piper.exe",
    JARVIS_PIPER_MODEL: "C:/voices/jarvis.onnx",
    JARVIS_PIPER_MODEL_CONFIG: "C:/voices/jarvis.onnx.json",
    JARVIS_TTS_OUTPUT_DIR: "C:/tmp/jarvis-tts",
    JARVIS_TTS_PROVIDER_ID: "local-piper",
    JARVIS_TTS_VOICE_ID: "jarvis-local",
    JARVIS_TTS_TIMEOUT_MS: "15000",
    JARVIS_TTS_MAX_INPUT_CHARS: "900",
    ...overrides,
  };
}

describe("Phase 14B.4 Piper TTS local config", () => {
  it("maps env values to a validated Piper provider config", () => {
    expect(loadPiperTtsLocalConfig(validEnv())).toEqual({
      ok: true,
      config: {
        piperExecutablePath: "C:/tools/piper/piper.exe",
        voiceModelPath: "C:/voices/jarvis.onnx",
        voiceConfigPath: "C:/voices/jarvis.onnx.json",
        outputDirectory: "C:/tmp/jarvis-tts",
        providerId: "local-piper",
        voiceId: "jarvis-local",
        timeoutMs: 15000,
        maxInputChars: 900,
        metadata_only: true,
      },
      reasons: [],
    });
  });

  it("uses bounded local defaults for optional numeric values", () => {
    const result = loadPiperTtsLocalConfig(
      validEnv({
        JARVIS_TTS_TIMEOUT_MS: undefined,
        JARVIS_TTS_MAX_INPUT_CHARS: undefined,
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      config: {
        timeoutMs: DEFAULT_PIPER_TTS_TIMEOUT_MS,
        maxInputChars: DEFAULT_PIPER_TTS_MAX_INPUT_CHARS,
      },
    });
  });

  it.each([
    ["JARVIS_PIPER_EXECUTABLE", "missing_executable"],
    ["JARVIS_PIPER_MODEL", "missing_model"],
    ["JARVIS_PIPER_MODEL_CONFIG", "missing_model_config"],
    ["JARVIS_TTS_OUTPUT_DIR", "missing_output_dir"],
    ["JARVIS_TTS_PROVIDER_ID", "missing_provider_id"],
    ["JARVIS_TTS_VOICE_ID", "missing_voice_id"],
  ] as const)("fails closed when %s is missing", (key, reason) => {
    expect(loadPiperTtsLocalConfig(validEnv({ [key]: "" }))).toMatchObject({
      ok: false,
      config: null,
      reasons: expect.arrayContaining([reason]),
    });
  });

  it("enforces timeout and max input bounds", () => {
    expect(
      loadPiperTtsLocalConfig(validEnv({ JARVIS_TTS_TIMEOUT_MS: "abc" })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["invalid_timeout"]),
    });
    expect(
      loadPiperTtsLocalConfig(validEnv({ JARVIS_TTS_TIMEOUT_MS: "99" })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["invalid_timeout"]),
    });
    expect(
      loadPiperTtsLocalConfig(
        validEnv({ JARVIS_TTS_MAX_INPUT_CHARS: "20001" }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["invalid_max_input_chars"]),
    });
  });

  it("does not execute, read files, access network, or wire runtime surfaces", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-runtime/tts/local-config.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/process\.env|from\s+["']node:process["']/i);
    expect(source).not.toMatch(/from\s+["']node:fs["']|existsSync|statSync/i);
    expect(source).not.toMatch(
      /from\s+["']node:child_process["']|child_process|spawn\s*\(|exec\s*\(|execFile\s*\(/i,
    );
    expect(source).not.toMatch(
      /fetch\s*\(|WebSocket|EventSource|XMLHttpRequest|from\s+["'](?:node:http|node:https|openai|@anthropic-ai\/sdk)["']/i,
    );
    expect(source).not.toMatch(
      /createModelRuntime|from\s+["'][^"']*\/models(?:\/index)?["']|router\.|from\s+["'][^"']*\/router/i,
    );
    expect(source).not.toMatch(
      /appendEvent|event-store|sqlite|database|writeFile|appendFile|persistTelemetry|telemetryStore/i,
    );
  });
});
