export const PIPER_CONFIG_VALIDATION_REASONS = [
  "malformed_config",
  "missing_executable_path",
  "missing_voice_model_path",
  "missing_voice_config_path",
  "missing_output_directory",
  "missing_provider_id",
  "missing_voice_id",
  "timeout_out_of_bounds",
  "max_input_chars_out_of_bounds",
] as const;

export type PiperConfigValidationReason =
  (typeof PIPER_CONFIG_VALIDATION_REASONS)[number];

export interface PiperProviderConfig {
  readonly piperExecutablePath: string;
  readonly voiceModelPath: string;
  readonly voiceConfigPath: string;
  readonly outputDirectory: string;
  readonly maxInputChars: number;
  readonly timeoutMs: number;
  readonly providerId: string;
  readonly voiceId: string;
  readonly metadata_only: true;
}

export type PiperConfigValidationResult =
  | {
      readonly ok: true;
      readonly config: PiperProviderConfig;
      readonly reasons: readonly [];
    }
  | {
      readonly ok: false;
      readonly config: null;
      readonly reasons: readonly PiperConfigValidationReason[];
    };

export const PIPER_CONTRACT_LIMITS = {
  minTimeoutMs: 100,
  maxTimeoutMs: 120_000,
  minInputChars: 1,
  maxInputChars: 20_000,
} as const;

export function validatePiperProviderConfig(
  input: unknown,
): PiperConfigValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail(["malformed_config"]);
  }

  const record = input as Record<string, unknown>;
  const reasons = new Set<PiperConfigValidationReason>();
  if (!isNonemptyString(record.piperExecutablePath)) {
    reasons.add("missing_executable_path");
  }
  if (!isNonemptyString(record.voiceModelPath)) {
    reasons.add("missing_voice_model_path");
  }
  if (!isNonemptyString(record.voiceConfigPath)) {
    reasons.add("missing_voice_config_path");
  }
  if (!isNonemptyString(record.outputDirectory)) {
    reasons.add("missing_output_directory");
  }
  if (!isNonemptyString(record.providerId)) {
    reasons.add("missing_provider_id");
  }
  if (!isNonemptyString(record.voiceId)) {
    reasons.add("missing_voice_id");
  }
  if (record.metadata_only !== true) {
    reasons.add("malformed_config");
  }
  if (!isBoundedNumber(record.timeoutMs, "timeout")) {
    reasons.add("timeout_out_of_bounds");
  }
  if (!isBoundedNumber(record.maxInputChars, "input")) {
    reasons.add("max_input_chars_out_of_bounds");
  }

  if (reasons.size > 0) return fail([...reasons]);
  return {
    ok: true,
    config: {
      piperExecutablePath: record.piperExecutablePath as string,
      voiceModelPath: record.voiceModelPath as string,
      voiceConfigPath: record.voiceConfigPath as string,
      outputDirectory: record.outputDirectory as string,
      maxInputChars: record.maxInputChars as number,
      timeoutMs: record.timeoutMs as number,
      providerId: record.providerId as string,
      voiceId: record.voiceId as string,
      metadata_only: true,
    },
    reasons: [],
  };
}

function fail(
  reasons: readonly PiperConfigValidationReason[],
): PiperConfigValidationResult {
  return {
    ok: false,
    config: null,
    reasons,
  };
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isBoundedNumber(value: unknown, kind: "timeout" | "input"): boolean {
  if (typeof value !== "number" || !Number.isInteger(value)) return false;
  if (kind === "timeout") {
    return (
      value >= PIPER_CONTRACT_LIMITS.minTimeoutMs &&
      value <= PIPER_CONTRACT_LIMITS.maxTimeoutMs
    );
  }
  return (
    value >= PIPER_CONTRACT_LIMITS.minInputChars &&
    value <= PIPER_CONTRACT_LIMITS.maxInputChars
  );
}
