import type { FasterWhisperProviderConfig } from "./faster-whisper-contract";
import { validateFasterWhisperProviderConfig } from "./faster-whisper-contract";

export const FASTER_WHISPER_STT_ENV_KEYS = [
  "JARVIS_STT_PYTHON_COMMAND",
  "JARVIS_STT_EXECUTABLE",
  "JARVIS_STT_MODEL_NAME",
  "JARVIS_STT_MODEL_PATH",
  "JARVIS_STT_LANGUAGE",
  "JARVIS_STT_BEAM_SIZE",
  "JARVIS_STT_VAD_ENABLED",
  "JARVIS_STT_TIMEOUT_MS",
  "JARVIS_STT_MAX_AUDIO_BYTES",
  "JARVIS_STT_PROVIDER_ID",
] as const;

export const DEFAULT_FASTER_WHISPER_STT_BEAM_SIZE = 5;
export const DEFAULT_FASTER_WHISPER_STT_VAD_ENABLED = true;
export const DEFAULT_FASTER_WHISPER_STT_TIMEOUT_MS = 30_000;
export const DEFAULT_FASTER_WHISPER_STT_MAX_AUDIO_BYTES = 25_000_000;

export type FasterWhisperSttEnvKey =
  (typeof FASTER_WHISPER_STT_ENV_KEYS)[number];
export type FasterWhisperSttLocalEnv = Partial<
  Record<FasterWhisperSttEnvKey, string>
>;

export const FASTER_WHISPER_STT_LOCAL_CONFIG_REASONS = [
  "missing_execution_command",
  "missing_model_name",
  "missing_model_path",
  "missing_provider_id",
  "invalid_timeout",
  "invalid_max_audio_bytes",
  "invalid_beam_size",
  "invalid_vad_enabled",
  "invalid_faster_whisper_config",
] as const;

export type FasterWhisperSttLocalConfigReason =
  (typeof FASTER_WHISPER_STT_LOCAL_CONFIG_REASONS)[number];

export type FasterWhisperSttLocalConfigResult =
  | {
      readonly ok: true;
      readonly config: FasterWhisperProviderConfig;
      readonly reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly config: null;
      readonly reasons: readonly FasterWhisperSttLocalConfigReason[];
    };

export function loadFasterWhisperSttLocalConfig(
  env: FasterWhisperSttLocalEnv,
): FasterWhisperSttLocalConfigResult {
  const reasons = new Set<FasterWhisperSttLocalConfigReason>();
  const pythonCommand = required(env.JARVIS_STT_PYTHON_COMMAND);
  const executablePath = required(env.JARVIS_STT_EXECUTABLE);
  const modelName = required(env.JARVIS_STT_MODEL_NAME);
  const modelPath = required(env.JARVIS_STT_MODEL_PATH);
  const providerId = required(env.JARVIS_STT_PROVIDER_ID);
  const language = optional(env.JARVIS_STT_LANGUAGE);

  if (!pythonCommand && !executablePath)
    reasons.add("missing_execution_command");
  if (!modelName) reasons.add("missing_model_name");
  if (!modelPath) reasons.add("missing_model_path");
  if (!providerId) reasons.add("missing_provider_id");

  const beamSize = parseOptionalPositiveInteger(
    env.JARVIS_STT_BEAM_SIZE,
    DEFAULT_FASTER_WHISPER_STT_BEAM_SIZE,
  );
  const timeoutMs = parseOptionalPositiveInteger(
    env.JARVIS_STT_TIMEOUT_MS,
    DEFAULT_FASTER_WHISPER_STT_TIMEOUT_MS,
  );
  const maxAudioBytes = parseOptionalPositiveInteger(
    env.JARVIS_STT_MAX_AUDIO_BYTES,
    DEFAULT_FASTER_WHISPER_STT_MAX_AUDIO_BYTES,
  );
  const vadEnabled = parseOptionalBoolean(
    env.JARVIS_STT_VAD_ENABLED,
    DEFAULT_FASTER_WHISPER_STT_VAD_ENABLED,
  );

  if (beamSize === null) reasons.add("invalid_beam_size");
  if (timeoutMs === null) reasons.add("invalid_timeout");
  if (maxAudioBytes === null) reasons.add("invalid_max_audio_bytes");
  if (vadEnabled === null) reasons.add("invalid_vad_enabled");
  if (reasons.size > 0) return fail([...reasons]);

  const config = {
    ...(executablePath === null ? {} : { executablePath }),
    ...(pythonCommand === null ? {} : { pythonCommand }),
    modelName: modelName as string,
    modelPath: modelPath as string,
    ...(language === null ? {} : { language }),
    beamSize: beamSize as number,
    vadEnabled: vadEnabled as boolean,
    timeoutMs: timeoutMs as number,
    maxAudioBytes: maxAudioBytes as number,
    providerId: providerId as string,
    metadata_only: true,
  } as const;

  const validation = validateFasterWhisperProviderConfig(config);
  if (!validation.ok) {
    const validationReasons = new Set<FasterWhisperSttLocalConfigReason>();
    if (validation.reasons.includes("timeout_out_of_bounds")) {
      validationReasons.add("invalid_timeout");
    }
    if (validation.reasons.includes("max_audio_bytes_out_of_bounds")) {
      validationReasons.add("invalid_max_audio_bytes");
    }
    if (validation.reasons.includes("beam_size_out_of_bounds")) {
      validationReasons.add("invalid_beam_size");
    }
    if (validationReasons.size === 0) {
      validationReasons.add("invalid_faster_whisper_config");
    }
    return fail([...validationReasons]);
  }

  return {
    ok: true,
    config: validation.config,
    reasons: [],
  };
}

function required(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function optional(value: string | undefined): string | null {
  return required(value);
}

function parseOptionalPositiveInteger(
  value: string | undefined,
  fallback: number,
): number | null {
  if (value === undefined || value.trim().length === 0) return fallback;
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseOptionalBoolean(
  value: string | undefined,
  fallback: boolean,
): boolean | null {
  if (value === undefined || value.trim().length === 0) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return null;
}

function fail(
  reasons: readonly FasterWhisperSttLocalConfigReason[],
): FasterWhisperSttLocalConfigResult {
  return {
    ok: false,
    config: null,
    reasons,
  };
}
