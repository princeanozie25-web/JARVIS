import {
  createPythonSttProvider,
  type PythonSttProcessRunner,
} from "./python-stt-provider";
import type { SttProvider } from "./provider";

// Phase 25D part 2 (E-039) — the two Apple-native STT engines behind the
// frozen SttProvider seam, on the shared Python mechanism:
//   parakeet-mlx  (NVIDIA Parakeet TDT 0.6B v3 via MLX) — DEFAULT, English,
//                 emits per-sentence PARTIALS then the final line.
//   mlx-whisper   (Whisper large-v3-turbo via MLX) — multilingual, non-default.
// Both run in the repo's MLX venv (Python ≥ 3.10) and need ffmpeg on PATH for
// audio decoding. Models live in the local HF cache after one explicit pull;
// nothing here downloads at request time when the cache is warm. faster-
// whisper (Phase 14, frozen) stays the fallback with its own provider.

export const PARAKEET_MLX_PROVIDER_ID = "parakeet-mlx" as const;
export const MLX_WHISPER_PROVIDER_ID = "mlx-whisper" as const;
export const DEFAULT_PARAKEET_MODEL = "mlx-community/parakeet-tdt-0.6b-v3";
export const DEFAULT_MLX_WHISPER_MODEL = "mlx-community/whisper-large-v3-turbo";
export const MLX_STT_DEFAULT_TIMEOUT_MS = 60_000;
export const MLX_STT_DEFAULT_MAX_AUDIO_BYTES = 25_000_000;

export const PARAKEET_PYTHON_HELPER = [
  "import argparse,json,time",
  "from parakeet_mlx import from_pretrained",
  "p=argparse.ArgumentParser()",
  "p.add_argument('--audio-ref',dest='audio_ref',required=True)",
  "p.add_argument('--model-name',dest='model_name',required=True)",
  "p.add_argument('--language')",
  "a=p.parse_args()",
  "t=time.perf_counter()",
  "m=from_pretrained(a.model_name)",
  "r=m.transcribe(a.audio_ref)",
  "for s in r.sentences: print(json.dumps({'partial':s.text.strip()}),flush=True)",
  "text=r.text.strip()",
  "print(json.dumps({'transcript':text,'language':a.language or 'en','latency_ms':int((time.perf_counter()-t)*1000),'confidence_band':'unknown','degraded':False}),flush=True)",
].join("\n");

export const MLX_WHISPER_PYTHON_HELPER = [
  "import argparse,json,time",
  "import mlx_whisper",
  "p=argparse.ArgumentParser()",
  "p.add_argument('--audio-ref',dest='audio_ref',required=True)",
  "p.add_argument('--model-name',dest='model_name',required=True)",
  "p.add_argument('--language')",
  "a=p.parse_args()",
  "t=time.perf_counter()",
  "r=mlx_whisper.transcribe(a.audio_ref,path_or_hf_repo=a.model_name,language=a.language or None)",
  "text=(r.get('text') or '').strip()",
  "lang=r.get('language') or a.language or 'unknown'",
  "print(json.dumps({'transcript':text,'language':lang,'latency_ms':int((time.perf_counter()-t)*1000),'confidence_band':'unknown','degraded':False}),flush=True)",
].join("\n");

export interface MlxSttProviderOptions {
  readonly pythonCommand: string;
  readonly modelName?: string;
  readonly language?: string;
  readonly timeoutMs?: number;
  readonly maxAudioBytes?: number;
  readonly runner?: Partial<PythonSttProcessRunner>;
  readonly onPartial?: (partial: string) => void;
}

export function createParakeetMlxSttProvider(
  options: MlxSttProviderOptions,
): SttProvider {
  const modelName = options.modelName ?? DEFAULT_PARAKEET_MODEL;
  return createPythonSttProvider({
    config: {
      providerId: PARAKEET_MLX_PROVIDER_ID,
      modelId: modelName,
      pythonCommand: options.pythonCommand,
      helperScript: PARAKEET_PYTHON_HELPER,
      extraArgs: ["--model-name", modelName],
      language: options.language ?? "en",
      timeoutMs: options.timeoutMs ?? MLX_STT_DEFAULT_TIMEOUT_MS,
      maxAudioBytes: options.maxAudioBytes ?? MLX_STT_DEFAULT_MAX_AUDIO_BYTES,
    },
    runner: options.runner,
    onPartial: options.onPartial,
  });
}

export function createMlxWhisperSttProvider(
  options: MlxSttProviderOptions,
): SttProvider {
  const modelName = options.modelName ?? DEFAULT_MLX_WHISPER_MODEL;
  return createPythonSttProvider({
    config: {
      providerId: MLX_WHISPER_PROVIDER_ID,
      modelId: modelName,
      pythonCommand: options.pythonCommand,
      helperScript: MLX_WHISPER_PYTHON_HELPER,
      extraArgs: ["--model-name", modelName],
      language: options.language,
      timeoutMs: options.timeoutMs ?? MLX_STT_DEFAULT_TIMEOUT_MS,
      maxAudioBytes: options.maxAudioBytes ?? MLX_STT_DEFAULT_MAX_AUDIO_BYTES,
    },
    runner: options.runner,
    onPartial: options.onPartial,
  });
}

/** Env-driven selection behind ONE variable: JARVIS_STT_PROVIDER_ID. */
export const STT_PROVIDER_IDS = [
  "faster-whisper",
  "parakeet-mlx",
  "mlx-whisper",
] as const;
export type SttProviderId = (typeof STT_PROVIDER_IDS)[number];

export function resolveSttProviderId(
  env: Record<string, string | undefined>,
): SttProviderId {
  const raw = env.JARVIS_STT_PROVIDER_ID?.trim().toLowerCase();
  return (STT_PROVIDER_IDS as readonly string[]).includes(raw ?? "")
    ? (raw as SttProviderId)
    : "parakeet-mlx";
}

/** Builds the configured MLX provider from env; null for the faster-whisper
 *  id (its own loader owns that) or when no interpreter is configured. */
export function createMlxSttProviderFromEnv(
  env: Record<string, string | undefined>,
  extras: Pick<MlxSttProviderOptions, "runner" | "onPartial"> = {},
): SttProvider | null {
  const id = resolveSttProviderId(env);
  const pythonCommand =
    env.JARVIS_STT_MLX_PYTHON_COMMAND?.trim() ||
    env.JARVIS_STT_PYTHON_COMMAND?.trim() ||
    "";
  if (!pythonCommand) return null;
  const common = {
    pythonCommand,
    modelName: env.JARVIS_STT_MODEL_NAME?.trim() || undefined,
    language: env.JARVIS_STT_LANGUAGE?.trim() || undefined,
    timeoutMs: positiveInt(env.JARVIS_STT_TIMEOUT_MS),
    maxAudioBytes: positiveInt(env.JARVIS_STT_MAX_AUDIO_BYTES),
    ...extras,
  };
  if (id === "parakeet-mlx") return createParakeetMlxSttProvider(common);
  if (id === "mlx-whisper") return createMlxWhisperSttProvider(common);
  return null;
}

function positiveInt(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
