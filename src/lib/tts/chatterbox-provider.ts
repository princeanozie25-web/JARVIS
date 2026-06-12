import { disabledSpeechResult } from "./disabled-provider";
import { evaluateSpeechSafetyPolicy } from "./safety-policy";
import type {
  SpeechAudioResult,
  SpeechProvider,
  SpeechProviderStatus,
  SpeechSynthesisInput,
  SpeechSynthesisResult,
  SpeechSynthesisRunOptions,
} from "./types";

export const SYSTEM_CHATTERBOX_PROVIDER_ID = "chatterbox-tts-server" as const;
export const SYSTEM_KOKORO_PROVIDER_ID = "kokoro" as const;
export const DEFAULT_SYSTEM_CHATTERBOX_URL = "http://127.0.0.1:8004" as const;
export const DEFAULT_SYSTEM_KOKORO_URL = "http://127.0.0.1:8880" as const;

export interface HttpSystemSpeechProviderOptions {
  readonly providerId:
    | typeof SYSTEM_CHATTERBOX_PROVIDER_ID
    | typeof SYSTEM_KOKORO_PROVIDER_ID;
  readonly baseUrl: string;
  readonly synthesizePath: string;
  readonly voiceId: string;
  readonly enabled?: boolean;
  readonly status?: SpeechProviderStatus;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly newId?: () => string;
}

export function createChatterboxSpeechProvider(
  input: Partial<
    Omit<
      HttpSystemSpeechProviderOptions,
      "providerId" | "baseUrl" | "synthesizePath" | "voiceId"
    >
  > & {
    readonly baseUrl?: string;
    readonly voiceId?: string;
  } = {},
): SpeechProvider {
  return createHttpSystemSpeechProvider({
    providerId: SYSTEM_CHATTERBOX_PROVIDER_ID,
    baseUrl: input.baseUrl ?? DEFAULT_SYSTEM_CHATTERBOX_URL,
    synthesizePath: "/tts",
    voiceId: input.voiceId ?? "Emily.wav",
    enabled: input.enabled,
    status: input.status,
    timeoutMs: input.timeoutMs,
    fetchImpl: input.fetchImpl,
    now: input.now,
    newId: input.newId,
  });
}

export function createKokoroSpeechProvider(
  input: Partial<
    Omit<
      HttpSystemSpeechProviderOptions,
      "providerId" | "baseUrl" | "synthesizePath" | "voiceId"
    >
  > & {
    readonly baseUrl?: string;
    readonly voiceId?: string;
  } = {},
): SpeechProvider {
  return createHttpSystemSpeechProvider({
    providerId: SYSTEM_KOKORO_PROVIDER_ID,
    baseUrl: input.baseUrl ?? DEFAULT_SYSTEM_KOKORO_URL,
    synthesizePath: "/v1/audio/speech",
    voiceId: input.voiceId ?? "af_heart",
    enabled: input.enabled,
    status: input.status,
    timeoutMs: input.timeoutMs,
    fetchImpl: input.fetchImpl,
    now: input.now,
    newId: input.newId,
  });
}

export function createHttpSystemSpeechProvider(
  opts: HttpSystemSpeechProviderOptions,
): SpeechProvider {
  const enabled = opts.enabled ?? true;
  const status = opts.status ?? "ready";
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? (() => Date.now());
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID());

  return {
    id: opts.providerId,
    enabled,
    status,
    metadata: {
      runsLocally: true,
      requiresNetwork: false,
      storesAudio: false,
      supportsStreaming: false,
    },
    async synthesize(
      input: SpeechSynthesisInput,
      runOptions: SpeechSynthesisRunOptions = {},
    ): Promise<SpeechSynthesisResult> {
      if (!enabled)
        return disabledSpeechResult("provider_disabled", opts.providerId);
      if (status !== "ready") {
        return disabledSpeechResult("provider_unavailable", opts.providerId);
      }

      const safety = evaluateSpeechSafetyPolicy(input);
      if (!safety.allowed) {
        return {
          status: "blocked",
          providerId: opts.providerId,
          audio: null,
          reason: safety.reason ?? "assistant_prose_required",
        };
      }

      const endpoint = localEndpoint(opts.baseUrl, opts.synthesizePath);
      if (!endpoint) {
        return {
          status: "error",
          providerId: opts.providerId,
          audio: null,
          errorMessage: "non_loopback_tts_endpoint_blocked",
        };
      }

      try {
        const response = await fetchWithTimeout(
          fetchImpl,
          endpoint,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              requestBody(opts.providerId, input, opts.voiceId),
            ),
            signal: runOptions.signal,
          },
          timeoutMs,
        );
        if (!response.ok) {
          return {
            status: "error",
            providerId: opts.providerId,
            audio: null,
            errorMessage: `tts_http_${response.status}`,
          };
        }

        const data = new Uint8Array(await response.arrayBuffer());
        const audio: SpeechAudioResult = {
          id: newId(),
          chunkId: input.chunkId ?? "speech-input",
          mimeType: mimeFor(response),
          byteLength: data.byteLength,
          createdAt: now(),
          source: "local_tts",
          data,
        };

        return {
          status: "completed",
          providerId: opts.providerId,
          audio,
        };
      } catch (error) {
        return {
          status: "error",
          providerId: opts.providerId,
          audio: null,
          errorMessage:
            error instanceof Error ? error.name : "tts_provider_error",
        };
      }
    },
  };
}

function localEndpoint(baseUrl: string, path: string): string | null {
  try {
    const url = new URL(path, baseUrl);
    if (url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function requestBody(
  providerId: HttpSystemSpeechProviderOptions["providerId"],
  input: SpeechSynthesisInput,
  voiceId: string,
) {
  if (providerId === SYSTEM_CHATTERBOX_PROVIDER_ID) {
    return {
      text: input.text,
      voice_mode: "predefined",
      predefined_voice_id: input.voiceId ?? voiceId,
      output_format: "wav",
      split_text: false,
    };
  }

  return {
    model: "kokoro",
    input: input.text,
    voice: input.voiceId ?? voiceId,
    response_format: "wav",
  };
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const timeoutAbort = new AbortController();
  const timeout = setTimeout(() => timeoutAbort.abort(), timeoutMs);
  const signal = mergeSignals(init.signal, timeoutAbort.signal);
  try {
    return await fetchImpl(url, { ...init, signal });
  } finally {
    clearTimeout(timeout);
  }
}

function mergeSignals(
  primary: AbortSignal | null | undefined,
  secondary: AbortSignal,
): AbortSignal {
  if (!primary) return secondary;
  const controller = new AbortController();
  const abort = () => controller.abort();
  primary.addEventListener("abort", abort, { once: true });
  secondary.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

function mimeFor(response: Response): string {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) {
    return "audio/mpeg";
  }
  if (contentType.includes("ogg") || contentType.includes("opus")) {
    return "audio/ogg";
  }
  return "audio/wav";
}
