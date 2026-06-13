import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "yaml";
import { z } from "zod";

import {
  createPiperTtsProvider,
  DEFAULT_PIPER_TTS_TIMEOUT_MS,
  type PiperProcessRunner,
  type PiperProviderConfig,
} from "@/lib/voice-runtime";

import type {
  DemoNarrationAudioCue,
  DemoNarrationLine,
  DemoNarrationProvider,
  DemoNarrationProviderHealth,
} from "./narration";

// Phase 23G-2 — terminal narration fallback backed by the Piper runtime
// commissioned in 23G-1. When Chatterbox (p0) and Kokoro (p1) are unreachable,
// the demo-director chain falls to this p2 provider, which now synthesizes REAL
// local audio through the voice-runtime Piper provider instead of the prior
// stub that emitted nothing (the E-010 zero-audio gap).
//
// Fail-closed: health is "ok" only when the resolved Piper executable + model +
// config all exist on disk; otherwise the provider reports unavailable so
// selectNarrationProvider never hands work to a floor that cannot synthesize.
//
// Paths are sourced from config/voice/piper-fallback.yaml (documented defaults
// for this machine) with per-field environment overrides — nothing is hardcoded
// as the sole source. The failover EVENT and telemetry sink are out of scope
// here (slice 23G-3); this slice only makes the terminal provider speak.

export const PIPER_FALLBACK_PROVIDER_ID = "existing-local-fallback" as const;

export const DEFAULT_PIPER_FALLBACK_CONFIG_PATH = resolve(
  process.cwd(),
  "config/voice/piper-fallback.yaml",
);

// Generous ceiling so multi-sentence narration lines are not rejected as
// "input_too_long" by the Piper request validator (contract max is 20_000).
const DEFAULT_PIPER_FALLBACK_MAX_INPUT_CHARS = 4_000;

export interface PiperFallbackResolvedConfig {
  readonly executable: string;
  readonly model: string;
  readonly config: string;
  readonly outputDir: string;
  readonly voiceId: string;
}

export type PiperFallbackConfigResult =
  | { readonly ok: true; readonly config: PiperFallbackResolvedConfig }
  | {
      readonly ok: false;
      readonly reason: "missing_or_unreadable_file" | "incomplete_config";
    };

const PiperFallbackFileSchema = z.object({
  piper: z.object({
    executable: z.string(),
    model: z.string(),
    config: z.string(),
    output_dir: z.string(),
    voice_id: z.string(),
  }),
});

function readFileValues(configPath: string):
  | { readonly readable: false }
  | {
      readonly readable: true;
      readonly values: Partial<PiperFallbackResolvedConfig>;
    } {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    return { readable: false };
  }
  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch {
    return { readable: true, values: {} };
  }
  const checked = PiperFallbackFileSchema.safeParse(parsed);
  if (!checked.success) {
    return { readable: true, values: {} };
  }
  return {
    readable: true,
    values: {
      executable: checked.data.piper.executable,
      model: checked.data.piper.model,
      config: checked.data.piper.config,
      outputDir: checked.data.piper.output_dir,
      voiceId: checked.data.piper.voice_id,
    },
  };
}

function clean(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

// Resolves the Piper fallback paths from the config file, with each field
// overridable by its environment variable (env wins). Fail-closed when any
// field is unresolved.
export function loadPiperFallbackConfig(
  configPath: string = DEFAULT_PIPER_FALLBACK_CONFIG_PATH,
  env: Record<string, string | undefined> = process.env,
): PiperFallbackConfigResult {
  const file = readFileValues(configPath);
  const fromFile = file.readable ? file.values : {};

  const executable =
    clean(env.JARVIS_PIPER_EXECUTABLE) ?? clean(fromFile.executable);
  const model = clean(env.JARVIS_PIPER_MODEL) ?? clean(fromFile.model);
  const config = clean(env.JARVIS_PIPER_MODEL_CONFIG) ?? clean(fromFile.config);
  const outputDir =
    clean(env.JARVIS_TTS_OUTPUT_DIR) ?? clean(fromFile.outputDir);
  const voiceId = clean(env.JARVIS_TTS_VOICE_ID) ?? clean(fromFile.voiceId);

  if (!executable || !model || !config || !outputDir || !voiceId) {
    return {
      ok: false,
      reason: file.readable
        ? "incomplete_config"
        : "missing_or_unreadable_file",
    };
  }
  return {
    ok: true,
    config: { executable, model, config, outputDir, voiceId },
  };
}

export interface PiperNarrationFallbackOptions {
  readonly configPath?: string;
  readonly env?: Record<string, string | undefined>;
  // Where synthesized WAVs are written. The chain passes its demo audio dir so
  // the export package stays coherent; absent, the config output_dir is used.
  readonly outputDir?: string;
  readonly timeoutMs?: number;
  readonly maxInputChars?: number;
  // Injection seams for tests (faked Piper spawn / filesystem existence).
  readonly runner?: Partial<PiperProcessRunner>;
  readonly existsImpl?: (path: string) => boolean;
  readonly now?: () => number;
}

export function createPiperNarrationFallbackProvider(
  options: PiperNarrationFallbackOptions = {},
): DemoNarrationProvider {
  const now = options.now ?? (() => Date.now());
  const existsImpl = options.existsImpl ?? existsSync;

  function resolveProviderConfig(): PiperProviderConfig | null {
    const loaded = loadPiperFallbackConfig(options.configPath, options.env);
    if (!loaded.ok) return null;
    return {
      piperExecutablePath: loaded.config.executable,
      voiceModelPath: loaded.config.model,
      voiceConfigPath: loaded.config.config,
      outputDirectory: options.outputDir ?? loaded.config.outputDir,
      providerId: PIPER_FALLBACK_PROVIDER_ID,
      voiceId: loaded.config.voiceId,
      timeoutMs: options.timeoutMs ?? DEFAULT_PIPER_TTS_TIMEOUT_MS,
      maxInputChars:
        options.maxInputChars ?? DEFAULT_PIPER_FALLBACK_MAX_INPUT_CHARS,
      metadata_only: true,
    };
  }

  return {
    provider_id: PIPER_FALLBACK_PROVIDER_ID,
    priority: 2,
    async health(): Promise<DemoNarrationProviderHealth> {
      const config = resolveProviderConfig();
      const reachable =
        config !== null &&
        existsImpl(config.piperExecutablePath) &&
        existsImpl(config.voiceModelPath) &&
        existsImpl(config.voiceConfigPath);
      return {
        provider_id: PIPER_FALLBACK_PROVIDER_ID,
        ok: reachable,
        degraded: !reachable,
        checked_at_ms: now(),
        metadata_only: true,
      };
    },
    async synthesize(line: DemoNarrationLine): Promise<DemoNarrationAudioCue> {
      const config = resolveProviderConfig();
      if (!config) {
        throw new Error(
          "Piper terminal fallback is not configured: set config/voice/piper-fallback.yaml or the JARVIS_PIPER_* environment variables.",
        );
      }
      const provider = createPiperTtsProvider({
        config,
        runner: options.runner,
      });
      const result = await provider.synthesize(
        {
          request_id: `demo-narration:${line.line_id}`,
          text: line.text,
          content_class: "assistant_prose",
          turn_id: line.cue_id ?? line.segment_id,
          session_id: line.script_id,
          requested_voice_id: config.voiceId,
          allow_sensitive_content: false,
          metadata_only: true,
        },
        { timeout_ms: config.timeoutMs, metadata_only: true },
      );
      return {
        audio_id: `demo-audio:${line.line_id}`,
        line_id: line.line_id,
        provider_id: PIPER_FALLBACK_PROVIDER_ID,
        duration_ms: result.chunk.duration_ms,
        mime_type: "audio/wav",
        byte_length: result.chunk.size_bytes,
        local_ref: result.chunk.output_ref,
        metadata_only: true,
        no_auto_play: true,
        no_voice_authority: true,
      };
    },
  };
}
