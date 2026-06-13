import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  DemoNarrationAudioCue,
  DemoNarrationLine,
  DemoNarrationProvider,
  DemoNarrationProviderHealth,
  DemoNarrationProviderId,
} from "./narration";
import { createPiperNarrationFallbackProvider } from "./piper-fallback";

export const DEFAULT_CHATTERBOX_URL = "http://127.0.0.1:8004" as const;
export const DEFAULT_KOKORO_URL = "http://127.0.0.1:8880" as const;

export interface HttpNarrationProviderOptions {
  provider_id: Exclude<DemoNarrationProviderId, "existing-local-fallback">;
  priority: number;
  base_url: string;
  health_path: string;
  synthesize_path: string;
  output_dir: string;
  voice_id?: string;
  timeout_ms?: number;
  fetch_impl?: typeof fetch;
  now?: () => number;
}

export function createChatterboxNarrationProvider(
  input: Partial<
    Omit<
      HttpNarrationProviderOptions,
      "provider_id" | "priority" | "health_path" | "synthesize_path"
    >
  > = {},
): DemoNarrationProvider {
  return createHttpNarrationProvider({
    provider_id: "chatterbox-tts-server",
    priority: 0,
    base_url: input.base_url ?? DEFAULT_CHATTERBOX_URL,
    health_path: "/api/ui/initial-data",
    synthesize_path: "/tts",
    output_dir: input.output_dir ?? path.join("demo-exports", "audio"),
    voice_id: input.voice_id ?? "Emily.wav",
    timeout_ms: input.timeout_ms,
    fetch_impl: input.fetch_impl,
    now: input.now,
  });
}

export function createKokoroNarrationProvider(
  input: Partial<
    Omit<
      HttpNarrationProviderOptions,
      "provider_id" | "priority" | "health_path" | "synthesize_path"
    >
  > = {},
): DemoNarrationProvider {
  return createHttpNarrationProvider({
    provider_id: "kokoro",
    priority: 1,
    base_url: input.base_url ?? DEFAULT_KOKORO_URL,
    health_path: "/health",
    synthesize_path: "/v1/audio/speech",
    output_dir: input.output_dir ?? path.join("demo-exports", "audio"),
    voice_id: input.voice_id ?? "af_heart",
    timeout_ms: input.timeout_ms,
    fetch_impl: input.fetch_impl,
    now: input.now,
  });
}

export function createRuntimeNarrationProviders(
  input: {
    chatterbox_url?: string;
    kokoro_url?: string;
    output_dir?: string;
    timeout_ms?: number;
    fetch_impl?: typeof fetch;
    now?: () => number;
  } = {},
): DemoNarrationProvider[] {
  return [
    createChatterboxNarrationProvider({
      base_url: input.chatterbox_url,
      output_dir: input.output_dir,
      timeout_ms: input.timeout_ms,
      fetch_impl: input.fetch_impl,
      now: input.now,
    }),
    createKokoroNarrationProvider({
      base_url: input.kokoro_url,
      output_dir: input.output_dir,
      timeout_ms: input.timeout_ms,
      fetch_impl: input.fetch_impl,
      now: input.now,
    }),
    // 23G-2: terminal fallback now synthesizes real audio via the commissioned
    // Piper runtime (was a no-audio stub). WAVs land in the chain's output_dir
    // so the export package stays coherent; exe/model/config come from
    // config/voice/piper-fallback.yaml (+ JARVIS_PIPER_* env overrides).
    createPiperNarrationFallbackProvider({
      outputDir: input.output_dir,
      now: input.now,
    }),
  ];
}

export function createHttpNarrationProvider(
  opts: HttpNarrationProviderOptions,
): DemoNarrationProvider {
  const fetchImpl = opts.fetch_impl ?? fetch;
  const timeoutMs = opts.timeout_ms ?? 1_200;
  const now = opts.now ?? (() => Date.now());

  return {
    provider_id: opts.provider_id,
    priority: opts.priority,
    async health(): Promise<DemoNarrationProviderHealth> {
      try {
        const response = await fetchWithTimeout(
          fetchImpl,
          new URL(opts.health_path, opts.base_url).toString(),
          { method: "GET" },
          timeoutMs,
        );
        return {
          provider_id: opts.provider_id,
          ok: response.ok,
          degraded: !response.ok,
          checked_at_ms: now(),
          metadata_only: true,
        };
      } catch {
        return {
          provider_id: opts.provider_id,
          ok: false,
          degraded: true,
          checked_at_ms: now(),
          metadata_only: true,
        };
      }
    },
    async synthesize(line: DemoNarrationLine): Promise<DemoNarrationAudioCue> {
      const body =
        opts.provider_id === "chatterbox-tts-server"
          ? chatterboxRequestBody(line, opts.voice_id)
          : kokoroRequestBody(line, opts.voice_id);
      const response = await fetchWithTimeout(
        fetchImpl,
        new URL(opts.synthesize_path, opts.base_url).toString(),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        Math.max(timeoutMs, 30_000),
      );
      if (!response.ok) {
        throw new Error(
          `${opts.provider_id} synthesis failed with HTTP ${response.status}`,
        );
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      await mkdir(opts.output_dir, { recursive: true });
      const outputPath = path.join(
        opts.output_dir,
        `${safeFilePart(line.line_id)}.${extensionFor(response)}`,
      );
      await writeFile(outputPath, bytes);

      return {
        audio_id: `demo-audio:${line.line_id}`,
        line_id: line.line_id,
        provider_id: opts.provider_id,
        duration_ms: Math.max(900, line.text.length * 42),
        mime_type: mimeFor(response),
        byte_length: bytes.byteLength,
        local_ref: outputPath,
        metadata_only: true,
        no_auto_play: true,
        no_voice_authority: true,
      };
    },
  };
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function chatterboxRequestBody(line: DemoNarrationLine, voiceId?: string) {
  return {
    text: line.text,
    voice_mode: "predefined",
    predefined_voice_id: voiceId ?? "Emily.wav",
    output_format: "wav",
    split_text: false,
  };
}

function kokoroRequestBody(line: DemoNarrationLine, voiceId?: string) {
  return {
    model: "kokoro",
    input: line.text,
    voice: voiceId ?? "af_heart",
    response_format: "wav",
  };
}

function mimeFor(response: Response): DemoNarrationAudioCue["mime_type"] {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) {
    return "audio/mpeg";
  }
  if (contentType.includes("ogg") || contentType.includes("opus")) {
    return "audio/ogg";
  }
  return "audio/wav";
}

function extensionFor(response: Response): "wav" | "mp3" | "ogg" {
  const mime = mimeFor(response);
  if (mime === "audio/mpeg") return "mp3";
  if (mime === "audio/ogg") return "ogg";
  return "wav";
}

function safeFilePart(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
