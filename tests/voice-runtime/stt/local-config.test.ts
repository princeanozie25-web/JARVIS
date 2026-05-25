import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_FASTER_WHISPER_STT_BEAM_SIZE,
  DEFAULT_FASTER_WHISPER_STT_MAX_AUDIO_BYTES,
  DEFAULT_FASTER_WHISPER_STT_TIMEOUT_MS,
  DEFAULT_FASTER_WHISPER_STT_VAD_ENABLED,
  loadFasterWhisperSttLocalConfig,
  type FasterWhisperSttLocalEnv,
} from "../../../src/lib/voice-runtime";

function validEnv(
  overrides: FasterWhisperSttLocalEnv = {},
): FasterWhisperSttLocalEnv {
  return {
    JARVIS_STT_PYTHON_COMMAND: "python",
    JARVIS_STT_EXECUTABLE: undefined,
    JARVIS_STT_MODEL_NAME: "base.en",
    JARVIS_STT_MODEL_PATH: "C:/models/faster-whisper",
    JARVIS_STT_LANGUAGE: "en",
    JARVIS_STT_BEAM_SIZE: "3",
    JARVIS_STT_VAD_ENABLED: "true",
    JARVIS_STT_TIMEOUT_MS: "20000",
    JARVIS_STT_MAX_AUDIO_BYTES: "5000000",
    JARVIS_STT_PROVIDER_ID: "local-faster-whisper",
    ...overrides,
  };
}

describe("Phase 14C.4 faster-whisper STT local config", () => {
  it("maps env values to a validated faster-whisper provider config", () => {
    expect(loadFasterWhisperSttLocalConfig(validEnv())).toEqual({
      ok: true,
      config: {
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
      },
      reasons: [],
    });
  });

  it("accepts an executable path instead of a python command", () => {
    expect(
      loadFasterWhisperSttLocalConfig(
        validEnv({
          JARVIS_STT_PYTHON_COMMAND: undefined,
          JARVIS_STT_EXECUTABLE: "C:/tools/faster-whisper.exe",
        }),
      ),
    ).toMatchObject({
      ok: true,
      config: {
        executablePath: "C:/tools/faster-whisper.exe",
      },
    });
  });

  it("uses bounded local defaults for optional values", () => {
    const result = loadFasterWhisperSttLocalConfig(
      validEnv({
        JARVIS_STT_LANGUAGE: undefined,
        JARVIS_STT_BEAM_SIZE: undefined,
        JARVIS_STT_VAD_ENABLED: undefined,
        JARVIS_STT_TIMEOUT_MS: undefined,
        JARVIS_STT_MAX_AUDIO_BYTES: undefined,
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      config: {
        beamSize: DEFAULT_FASTER_WHISPER_STT_BEAM_SIZE,
        vadEnabled: DEFAULT_FASTER_WHISPER_STT_VAD_ENABLED,
        timeoutMs: DEFAULT_FASTER_WHISPER_STT_TIMEOUT_MS,
        maxAudioBytes: DEFAULT_FASTER_WHISPER_STT_MAX_AUDIO_BYTES,
      },
    });
  });

  it.each([
    ["JARVIS_STT_PYTHON_COMMAND", "missing_execution_command"],
    ["JARVIS_STT_MODEL_NAME", "missing_model_name"],
    ["JARVIS_STT_MODEL_PATH", "missing_model_path"],
    ["JARVIS_STT_PROVIDER_ID", "missing_provider_id"],
  ] as const)("fails closed when %s is missing", (key, reason) => {
    const env = validEnv({
      [key]: "",
      ...(key === "JARVIS_STT_PYTHON_COMMAND"
        ? { JARVIS_STT_EXECUTABLE: "" }
        : {}),
    });

    expect(loadFasterWhisperSttLocalConfig(env)).toMatchObject({
      ok: false,
      config: null,
      reasons: expect.arrayContaining([reason]),
    });
  });

  it("enforces timeout, max audio, beam size, and VAD bounds", () => {
    expect(
      loadFasterWhisperSttLocalConfig(
        validEnv({ JARVIS_STT_TIMEOUT_MS: "abc" }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["invalid_timeout"]),
    });
    expect(
      loadFasterWhisperSttLocalConfig(
        validEnv({ JARVIS_STT_MAX_AUDIO_BYTES: "0" }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["invalid_max_audio_bytes"]),
    });
    expect(
      loadFasterWhisperSttLocalConfig(validEnv({ JARVIS_STT_BEAM_SIZE: "11" })),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["invalid_beam_size"]),
    });
    expect(
      loadFasterWhisperSttLocalConfig(
        validEnv({ JARVIS_STT_VAD_ENABLED: "maybe" }),
      ),
    ).toMatchObject({
      ok: false,
      reasons: expect.arrayContaining(["invalid_vad_enabled"]),
    });
  });

  it("does not execute, read files, access network, or wire runtime surfaces", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/voice-runtime/stt/local-config.ts"),
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
