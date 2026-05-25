import type { PiperProviderConfig } from "./piper-contract";
import { validatePiperProviderConfig } from "./piper-contract";

export const PIPER_TTS_ENV_KEYS = [
  "JARVIS_PIPER_EXECUTABLE",
  "JARVIS_PIPER_MODEL",
  "JARVIS_PIPER_MODEL_CONFIG",
  "JARVIS_TTS_OUTPUT_DIR",
  "JARVIS_TTS_PROVIDER_ID",
  "JARVIS_TTS_VOICE_ID",
  "JARVIS_TTS_TIMEOUT_MS",
  "JARVIS_TTS_MAX_INPUT_CHARS",
] as const;

export const DEFAULT_PIPER_TTS_TIMEOUT_MS = 30_000;
export const DEFAULT_PIPER_TTS_MAX_INPUT_CHARS = 500;

export type PiperTtsEnvKey = (typeof PIPER_TTS_ENV_KEYS)[number];
export type PiperTtsLocalEnv = Partial<Record<PiperTtsEnvKey, string>>;

export const PIPER_TTS_LOCAL_CONFIG_REASONS = [
  "missing_executable",
  "missing_model",
  "missing_model_config",
  "missing_output_dir",
  "missing_provider_id",
  "missing_voice_id",
  "invalid_timeout",
  "invalid_max_input_chars",
  "invalid_piper_config",
] as const;

export type PiperTtsLocalConfigReason =
  (typeof PIPER_TTS_LOCAL_CONFIG_REASONS)[number];

export type PiperTtsLocalConfigResult =
  | {
      readonly ok: true;
      readonly config: PiperProviderConfig;
      readonly reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly config: null;
      readonly reasons: readonly PiperTtsLocalConfigReason[];
    };

export function loadPiperTtsLocalConfig(
  env: PiperTtsLocalEnv,
): PiperTtsLocalConfigResult {
  const reasons = new Set<PiperTtsLocalConfigReason>();
  const piperExecutablePath = required(env.JARVIS_PIPER_EXECUTABLE);
  const voiceModelPath = required(env.JARVIS_PIPER_MODEL);
  const voiceConfigPath = required(env.JARVIS_PIPER_MODEL_CONFIG);
  const outputDirectory = required(env.JARVIS_TTS_OUTPUT_DIR);
  const providerId = required(env.JARVIS_TTS_PROVIDER_ID);
  const voiceId = required(env.JARVIS_TTS_VOICE_ID);

  if (!piperExecutablePath) reasons.add("missing_executable");
  if (!voiceModelPath) reasons.add("missing_model");
  if (!voiceConfigPath) reasons.add("missing_model_config");
  if (!outputDirectory) reasons.add("missing_output_dir");
  if (!providerId) reasons.add("missing_provider_id");
  if (!voiceId) reasons.add("missing_voice_id");

  const timeoutMs = parseOptionalPositiveInteger(
    env.JARVIS_TTS_TIMEOUT_MS,
    DEFAULT_PIPER_TTS_TIMEOUT_MS,
  );
  const maxInputChars = parseOptionalPositiveInteger(
    env.JARVIS_TTS_MAX_INPUT_CHARS,
    DEFAULT_PIPER_TTS_MAX_INPUT_CHARS,
  );
  if (timeoutMs === null) reasons.add("invalid_timeout");
  if (maxInputChars === null) reasons.add("invalid_max_input_chars");
  if (reasons.size > 0) return fail([...reasons]);

  const config = {
    piperExecutablePath: piperExecutablePath as string,
    voiceModelPath: voiceModelPath as string,
    voiceConfigPath: voiceConfigPath as string,
    outputDirectory: outputDirectory as string,
    providerId: providerId as string,
    voiceId: voiceId as string,
    timeoutMs: timeoutMs as number,
    maxInputChars: maxInputChars as number,
    metadata_only: true,
  } as const;
  const validation = validatePiperProviderConfig(config);
  if (!validation.ok) {
    const validationReasons = new Set<PiperTtsLocalConfigReason>();
    if (validation.reasons.includes("timeout_out_of_bounds")) {
      validationReasons.add("invalid_timeout");
    }
    if (validation.reasons.includes("max_input_chars_out_of_bounds")) {
      validationReasons.add("invalid_max_input_chars");
    }
    if (validationReasons.size === 0) {
      validationReasons.add("invalid_piper_config");
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

function parseOptionalPositiveInteger(
  value: string | undefined,
  fallback: number,
): number | null {
  if (value === undefined || value.trim().length === 0) return fallback;
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function fail(
  reasons: readonly PiperTtsLocalConfigReason[],
): PiperTtsLocalConfigResult {
  return {
    ok: false,
    config: null,
    reasons,
  };
}
