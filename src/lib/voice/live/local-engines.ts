// Real-engine wiring from the centralised config: the accepted local stack
// (parakeet-mlx | mlx-whisper -> Ollama local brain -> mlx-audio kokoro |
// vibevoice) as a VoiceLiveProvider, plus the OpenAI Realtime premium
// provider. This is the only file that knows concrete engines; everything
// above it works on the contract.

import { OllamaProvider } from "../../providers/ollama";
import {
  createMlxWhisperSttProvider,
  createParakeetMlxSttProvider,
} from "../../voice-runtime/stt/mlx-stt-providers";
import {
  MLX_AUDIO_ENGINE_MODELS,
  createMlxAudioSynthesisEngine,
} from "../tts-engine";
import { createChatProviderBrain } from "./chat-brain";
import type { VoiceLiveConfig } from "./config";
import type { VoiceLiveProvider } from "./contract";
import {
  LOCAL_TURN_DEFAULT_SYSTEM_PROMPT,
  createLocalTurnProvider,
} from "./local-turn-provider";
import { createOpenAiRealtimeProvider } from "./openai-realtime-engine";

export const VIBEVOICE_DEFAULT_VOICE = "en-Carter_man";
// Bake-off 2026-09-06: lowest/constant TTFA on the M1 Max (95 ms). Kept here,
// not in the E-040 engine's model map, so no frozen voice file changes.
export const VIBEVOICE_REALTIME_MODEL =
  "mlx-community/VibeVoice-Realtime-0.5B-8bit";
export const DEFAULT_MLX_PYTHON = ".venv-mlx/bin/python";

type Env = Record<string, string | undefined>;

function clean(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

export function createLocalTurnProviderFromConfig(
  config: VoiceLiveConfig,
  env: Env = process.env,
): VoiceLiveProvider {
  const pythonCommand =
    clean(env.JARVIS_STT_MLX_PYTHON_COMMAND) ?? DEFAULT_MLX_PYTHON;
  // "auto" resolves to parakeet (English default, 49 ms); mlx-whisper is the
  // multilingual route. Language-driven auto-switching is a follow-up.
  const stt =
    config.local_stt === "mlx-whisper"
      ? createMlxWhisperSttProvider({ pythonCommand })
      : createParakeetMlxSttProvider({ pythonCommand });

  const brain = createChatProviderBrain(new OllamaProvider({ think: false }), {
    model: config.local_brain_model,
  });

  const ttsKey =
    config.local_tts === "vibevoice"
      ? "vibevoice"
      : config.local_tts === "chatterbox-turbo"
        ? "chatterbox-turbo"
        : "kokoro";
  const voiceId =
    ttsKey === "vibevoice"
      ? (clean(env.JARVIS_VIBEVOICE_VOICE) ?? VIBEVOICE_DEFAULT_VOICE)
      : config.local_voice_id;
  const model =
    ttsKey === "vibevoice"
      ? VIBEVOICE_REALTIME_MODEL
      : MLX_AUDIO_ENGINE_MODELS[ttsKey];
  const engine = createMlxAudioSynthesisEngine({
    providerId: ttsKey,
    priority: 0,
    model,
    voiceId,
    ...(clean(env.JARVIS_MLX_AUDIO_URL)
      ? { baseUrl: clean(env.JARVIS_MLX_AUDIO_URL) }
      : {}),
    ...(clean(env.JARVIS_TTS_OUTPUT_DIR)
      ? { outputDir: clean(env.JARVIS_TTS_OUTPUT_DIR) }
      : {}),
  });
  if (!engine.synthesize)
    throw new Error(`mlx-audio engine ${ttsKey} cannot synthesize`);
  const synthesize = engine.synthesize.bind(engine);

  return createLocalTurnProvider({
    stt,
    brain,
    tts: {
      synthesize: async (line) => {
        const cue = await synthesize({ id: line.id, text: line.text });
        return { output_ref: cue.output_ref, duration_ms: cue.duration_ms };
      },
    },
    systemPrompt: LOCAL_TURN_DEFAULT_SYSTEM_PROMPT,
  });
}

export function createVoiceLiveProvidersFromConfig(
  config: VoiceLiveConfig,
  env: Env = process.env,
): VoiceLiveProvider[] {
  return [
    createLocalTurnProviderFromConfig(config, env),
    createOpenAiRealtimeProvider({
      env,
      model: config.openai_realtime_model,
      voice: config.openai_realtime_voice,
    }),
  ];
}
