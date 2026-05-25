export const FASTER_WHISPER_CONFIG_VALIDATION_REASONS = [
  "malformed_config",
  "missing_executable_or_python",
  "missing_model_name",
  "missing_model_path",
  "missing_provider_id",
  "timeout_out_of_bounds",
  "max_audio_bytes_out_of_bounds",
  "beam_size_out_of_bounds",
] as const;

export type FasterWhisperConfigValidationReason =
  (typeof FASTER_WHISPER_CONFIG_VALIDATION_REASONS)[number];

export interface FasterWhisperProviderConfig {
  readonly executablePath?: string;
  readonly pythonCommand?: string;
  readonly modelName: string;
  readonly modelPath: string;
  readonly language?: string;
  readonly beamSize: number;
  readonly vadEnabled: boolean;
  readonly timeoutMs: number;
  readonly maxAudioBytes: number;
  readonly providerId: string;
  readonly metadata_only: true;
}

export type FasterWhisperConfigValidationResult =
  | {
      readonly ok: true;
      readonly config: FasterWhisperProviderConfig;
      readonly reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly config: null;
      readonly reasons: readonly FasterWhisperConfigValidationReason[];
    };

export const FASTER_WHISPER_CONTRACT_LIMITS = {
  minTimeoutMs: 100,
  maxTimeoutMs: 300_000,
  minAudioBytes: 1,
  maxAudioBytes: 250_000_000,
  minBeamSize: 1,
  maxBeamSize: 10,
} as const;

export function validateFasterWhisperProviderConfig(
  input: unknown,
): FasterWhisperConfigValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail(["malformed_config"]);
  }

  const record = input as Record<string, unknown>;
  const reasons = new Set<FasterWhisperConfigValidationReason>();
  const executablePath = optionalString(record.executablePath);
  const pythonCommand = optionalString(record.pythonCommand);
  if (!executablePath && !pythonCommand) {
    reasons.add("missing_executable_or_python");
  }
  if (!isNonemptyString(record.modelName)) reasons.add("missing_model_name");
  if (!isNonemptyString(record.modelPath)) reasons.add("missing_model_path");
  if (!isNonemptyString(record.providerId)) reasons.add("missing_provider_id");
  if (record.metadata_only !== true) reasons.add("malformed_config");
  if (record.language !== undefined && !isNonemptyString(record.language)) {
    reasons.add("malformed_config");
  }
  if (typeof record.vadEnabled !== "boolean") reasons.add("malformed_config");
  if (!isBoundedInteger(record.timeoutMs, "timeout")) {
    reasons.add("timeout_out_of_bounds");
  }
  if (!isBoundedInteger(record.maxAudioBytes, "audio")) {
    reasons.add("max_audio_bytes_out_of_bounds");
  }
  if (!isBoundedInteger(record.beamSize, "beam")) {
    reasons.add("beam_size_out_of_bounds");
  }

  if (reasons.size > 0) return fail([...reasons]);
  return {
    ok: true,
    config: {
      ...(executablePath === null ? {} : { executablePath }),
      ...(pythonCommand === null ? {} : { pythonCommand }),
      modelName: record.modelName as string,
      modelPath: record.modelPath as string,
      ...(record.language === undefined
        ? {}
        : { language: record.language as string }),
      beamSize: record.beamSize as number,
      vadEnabled: record.vadEnabled as boolean,
      timeoutMs: record.timeoutMs as number,
      maxAudioBytes: record.maxAudioBytes as number,
      providerId: record.providerId as string,
      metadata_only: true,
    },
    reasons: [],
  };
}

function fail(
  reasons: readonly FasterWhisperConfigValidationReason[],
): FasterWhisperConfigValidationResult {
  return {
    ok: false,
    config: null,
    reasons,
  };
}

function optionalString(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isBoundedInteger(
  value: unknown,
  kind: "timeout" | "audio" | "beam",
): boolean {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  if (kind === "timeout") {
    return (
      value >= FASTER_WHISPER_CONTRACT_LIMITS.minTimeoutMs &&
      value <= FASTER_WHISPER_CONTRACT_LIMITS.maxTimeoutMs
    );
  }
  if (kind === "audio") {
    return (
      value >= FASTER_WHISPER_CONTRACT_LIMITS.minAudioBytes &&
      value <= FASTER_WHISPER_CONTRACT_LIMITS.maxAudioBytes
    );
  }
  return (
    value >= FASTER_WHISPER_CONTRACT_LIMITS.minBeamSize &&
    value <= FASTER_WHISPER_CONTRACT_LIMITS.maxBeamSize
  );
}
