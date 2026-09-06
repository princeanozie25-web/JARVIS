// OpenAI Realtime (gpt-realtime-mini) as a VoiceLiveProvider — the premium
// full-duplex candidate of the voice bake-off. REAL WebSocket client against
// the GA Realtime API (events read from the official docs on 2026-09-06).
//
// Lives in src/lib/voice/ (not voice-runtime/) like the E-040 mlx-audio engine,
// so the frozen Phase 14 no-network scan over voice-runtime/ is untouched.
//
// Credentials: `OPENAI_API_KEY` from env only, read once, never logged, never
// placed in any event/snapshot. Absent key => health false, startSession
// throws `credential_missing` (brief §23: a missing key is a halt, not an
// architectural failure).
//
// Governance: the model's function calls are surfaced as `tool_call` events.
// NOTHING here executes them. JARVIS resolves via the Gate and calls
// `submitToolResult`, which is the only path that sends a result back.
//
// Transport: Node >= 22 global WebSocket (WHATWG) cannot set headers, so we
// use OpenAI's documented subprotocol auth ("realtime",
// "openai-insecure-api-key.<KEY>"). A socket factory is injectable so the
// conformance battery runs with a fake socket — no network, no key.

import {
  addVoiceLiveUsage,
  emptyVoiceLiveUsage,
  type VoiceLiveAudioSink,
  type VoiceLiveErrorClass,
  type VoiceLiveEvent,
  type VoiceLiveProvider,
  type VoiceLiveProviderDescriptor,
  type VoiceLiveProviderHealth,
  type VoiceLiveSession,
  type VoiceLiveSessionOptions,
  type VoiceLiveSessionSnapshot,
  type VoiceLiveStopReason,
  type VoiceLiveToolSpec,
  type VoiceLiveUsage,
} from "./contract";
import { usageFromRealtimeTokens } from "./pricing";

export const OPENAI_REALTIME_PROVIDER_ID = "openai-realtime";
export const OPENAI_REALTIME_DEFAULT_MODEL = "gpt-realtime-mini";
export const OPENAI_REALTIME_DEFAULT_URL = "wss://api.openai.com/v1/realtime";
export const OPENAI_REALTIME_DEFAULT_VOICE = "marin";
export const OPENAI_REALTIME_SAMPLE_RATE_HZ = 24_000;

export const OPENAI_REALTIME_DESCRIPTOR: VoiceLiveProviderDescriptor = {
  provider_id: OPENAI_REALTIME_PROVIDER_ID,
  display_name: "OpenAI Realtime (gpt-realtime-mini)",
  privacy_class: "cloud_audio",
  cost_class: "metered_cloud",
  capabilities: [
    "speech_to_speech",
    "streaming_stt",
    "streaming_tts",
    "barge_in",
    "multilingual",
    "cloud",
    "tool_calling",
  ],
  tool_execution_allowed: false,
  metadata_only: true,
};

// Minimal socket surface so the engine is testable without the network.
export interface RealtimeSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((data: string) => void) | null;
  onerror: ((message: string) => void) | null;
  onclose: ((code: number, reason: string) => void) | null;
}

export type RealtimeSocketFactory = (
  url: string,
  protocols: readonly string[],
) => RealtimeSocket;

export interface OpenAiRealtimeEngineOptions {
  readonly apiKey?: string;
  readonly env?: Record<string, string | undefined>;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly voice?: string;
  readonly turnDetection?: "semantic_vad" | "server_vad" | "none";
  readonly socketFactory?: RealtimeSocketFactory;
  readonly nowMs?: () => number;
  readonly connectTimeoutMs?: number;
}

export class OpenAiRealtimeError extends Error {
  readonly error_class: VoiceLiveErrorClass;
  constructor(error_class: VoiceLiveErrorClass, message: string) {
    super(message);
    this.name = "OpenAiRealtimeError";
    this.error_class = error_class;
  }
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function defaultSocketFactory(
  url: string,
  protocols: readonly string[],
): RealtimeSocket {
  const WebSocketCtor = (
    globalThis as { WebSocket?: new (u: string, p?: string[]) => WebSocket }
  ).WebSocket;
  if (!WebSocketCtor) {
    throw new OpenAiRealtimeError(
      "unavailable",
      "global WebSocket is not available in this runtime",
    );
  }
  const ws = new WebSocketCtor(url, [...protocols]);
  const wrapper: RealtimeSocket = {
    send: (data) => ws.send(data),
    close: (code, reason) => ws.close(code, reason),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  };
  ws.onopen = () => wrapper.onopen?.();
  ws.onmessage = (ev: MessageEvent) => {
    const data = typeof ev.data === "string" ? ev.data : "";
    wrapper.onmessage?.(data);
  };
  ws.onerror = () => wrapper.onerror?.("websocket error");
  ws.onclose = (ev: CloseEvent) => wrapper.onclose?.(ev.code, ev.reason);
  return wrapper;
}

type ServerEvent = { type: string } & Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Bounded, secret-free error text for events.
function bounded(message: string): string {
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 200);
}

export function createOpenAiRealtimeProvider(
  options: OpenAiRealtimeEngineOptions = {},
): VoiceLiveProvider {
  const env = options.env ?? process.env;
  const apiKey = clean(options.apiKey) ?? clean(env.OPENAI_API_KEY);
  const enabled = clean(env.JARVIS_OPENAI_REALTIME_ENABLED) !== "false";
  const model =
    clean(options.model) ??
    clean(env.JARVIS_OPENAI_REALTIME_MODEL) ??
    OPENAI_REALTIME_DEFAULT_MODEL;
  const baseUrl =
    clean(options.baseUrl) ??
    clean(env.JARVIS_OPENAI_REALTIME_URL) ??
    OPENAI_REALTIME_DEFAULT_URL;
  const voice =
    clean(options.voice) ??
    clean(env.JARVIS_OPENAI_REALTIME_VOICE) ??
    OPENAI_REALTIME_DEFAULT_VOICE;
  const turnDetection = options.turnDetection ?? "semantic_vad";
  const socketFactory = options.socketFactory ?? defaultSocketFactory;
  const nowMs = options.nowMs ?? (() => Date.now());
  const connectTimeoutMs = options.connectTimeoutMs ?? 10_000;

  const health = async (): Promise<VoiceLiveProviderHealth> => {
    if (!enabled) {
      return {
        ok: false,
        degraded: false,
        error_class: "disabled",
        metadata_only: true,
      };
    }
    if (!apiKey) {
      return {
        ok: false,
        degraded: false,
        error_class: "credential_missing",
        metadata_only: true,
      };
    }
    return { ok: true, degraded: false, metadata_only: true };
  };

  const startSession = async (
    sessionOptions: VoiceLiveSessionOptions,
  ): Promise<VoiceLiveSession> => {
    const h = await health();
    if (!h.ok) {
      throw new OpenAiRealtimeError(
        h.error_class ?? "unavailable",
        h.error_class === "credential_missing"
          ? "OPENAI_API_KEY is not set"
          : `openai realtime ${h.error_class}`,
      );
    }
    const key = apiKey!;
    const url = `${baseUrl}?model=${encodeURIComponent(model)}`;
    // Documented browser-style auth; the key travels only in the handshake.
    const protocols = ["realtime", `openai-insecure-api-key.${key}`];

    const session = new OpenAiRealtimeSession({
      socket: socketFactory(url, protocols),
      model,
      voice,
      turnDetection,
      nowMs,
      connectTimeoutMs,
      sessionOptions,
    });
    await session.open();
    return session;
  };

  return {
    descriptor: OPENAI_REALTIME_DESCRIPTOR,
    health,
    startSession,
  };
}

interface SessionDeps {
  readonly socket: RealtimeSocket;
  readonly model: string;
  readonly voice: string;
  readonly turnDetection: "semantic_vad" | "server_vad" | "none";
  readonly nowMs: () => number;
  readonly connectTimeoutMs: number;
  readonly sessionOptions: VoiceLiveSessionOptions;
}

class OpenAiRealtimeSession implements VoiceLiveSession {
  readonly session_id: string;
  readonly provider_id = OPENAI_REALTIME_PROVIDER_ID;

  private readonly socket: RealtimeSocket;
  private readonly model: string;
  private readonly voice: string;
  private readonly turnDetection: SessionDeps["turnDetection"];
  private readonly nowMs: () => number;
  private readonly connectTimeoutMs: number;
  private readonly sink: VoiceLiveAudioSink;
  private readonly emit: (event: VoiceLiveEvent) => void;
  private readonly instructions: string | undefined;
  private readonly tools: readonly VoiceLiveToolSpec[];
  private readonly abortSignal: AbortSignal | undefined;

  private state: VoiceLiveSessionSnapshot["state"] = "connecting";
  private muted = false;
  private interruptions = 0;
  private toolCalls = 0;
  private responses = 0;
  private readonly startedAtMs: number;
  private endedAtMs: number | null = null;
  private usage: VoiceLiveUsage = emptyVoiceLiveUsage();

  // Per-response tracking for TTFA and barge-in truncation.
  private activeResponseId: string | null = null;
  private activeItemId: string | null = null;
  private responseRequestedAtMs: number | null = null;
  private userSpeechStoppedAtMs: number | null = null;
  private firstAudioSeen = false;
  private audioBytesThisResponse = 0;
  private stopReason: VoiceLiveStopReason | null = null;

  constructor(deps: SessionDeps) {
    this.session_id = deps.sessionOptions.session_id;
    this.socket = deps.socket;
    this.model = deps.model;
    this.voice = deps.voice;
    this.turnDetection = deps.turnDetection;
    this.nowMs = deps.nowMs;
    this.connectTimeoutMs = deps.connectTimeoutMs;
    this.sink = deps.sessionOptions.audio_sink;
    this.emit = deps.sessionOptions.on_event;
    this.instructions = deps.sessionOptions.instructions;
    this.tools = deps.sessionOptions.tools ?? [];
    this.abortSignal = deps.sessionOptions.abort_signal;
    this.startedAtMs = this.nowMs();
    if (deps.sessionOptions.voice) this.voice = deps.sessionOptions.voice;
  }

  async open(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.socket.close();
        reject(new OpenAiRealtimeError("network_error", "connect timeout"));
      }, this.connectTimeoutMs);

      this.socket.onopen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.state = "open";
        this.sendSessionUpdate();
        this.emit({ type: "session_started", at_ms: this.nowMs() });
        resolve();
      };
      this.socket.onerror = (message) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new OpenAiRealtimeError("network_error", bounded(message)));
          return;
        }
        this.emit({
          type: "error",
          error_class: "network_error",
          message: bounded(message),
        });
      };
      this.socket.onclose = (code, reason) => {
        const wasOpen = this.state === "open";
        this.state = "closed";
        this.endedAtMs = this.nowMs();
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(
            new OpenAiRealtimeError(
              "network_error",
              `closed before open: ${code} ${bounded(reason)}`,
            ),
          );
          return;
        }
        if (wasOpen) {
          this.sink.cancel();
          this.emit({
            type: "session_ended",
            reason: this.stopReason ?? "network_error",
            at_ms: this.endedAtMs,
          });
        }
      };
      this.socket.onmessage = (data) => this.handleMessage(data);

      this.abortSignal?.addEventListener(
        "abort",
        () => {
          void this.stop("abort_signal");
        },
        { once: true },
      );
    });
  }

  inputSampleRateHz(): number {
    return OPENAI_REALTIME_SAMPLE_RATE_HZ;
  }

  ingestAudio(pcm16: Uint8Array): void {
    if (this.state !== "open" || this.muted || pcm16.byteLength === 0) return;
    this.send({
      type: "input_audio_buffer.append",
      audio: Buffer.from(
        pcm16.buffer,
        pcm16.byteOffset,
        pcm16.byteLength,
      ).toString("base64"),
    });
  }

  commitAudio(): void {
    if (this.state !== "open") return;
    if (this.turnDetection === "none") {
      this.send({ type: "input_audio_buffer.commit" });
      this.requestResponse();
    }
  }

  async interrupt(): Promise<void> {
    if (this.state !== "open") return;
    this.doInterrupt("orchestrator");
  }

  submitToolResult(callId: string, outputJson: string): void {
    if (this.state !== "open") return;
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: outputJson,
      },
    });
    this.requestResponse();
  }

  mute(): void {
    this.muted = true;
  }

  unmute(): void {
    this.muted = false;
  }

  async stop(reason: VoiceLiveStopReason): Promise<void> {
    if (this.state === "closed") return;
    this.stopReason = reason;
    this.sink.cancel();
    this.state = "closed";
    this.endedAtMs = this.nowMs();
    try {
      this.socket.close(1000, reason);
    } catch {
      // closing an already-dead socket is fine
    }
    this.emit({ type: "session_ended", reason, at_ms: this.endedAtMs });
  }

  snapshot(): VoiceLiveSessionSnapshot {
    return {
      session_id: this.session_id,
      provider_id: this.provider_id,
      state: this.state,
      assistant_speaking: this.activeResponseId !== null && this.firstAudioSeen,
      muted: this.muted,
      interruptions: this.interruptions,
      tool_calls: this.toolCalls,
      responses: this.responses,
      started_at_ms: this.startedAtMs,
      ended_at_ms: this.endedAtMs,
      usage: this.usage,
      metadata_only: true,
    };
  }

  // ---- wire ---------------------------------------------------------------

  private send(event: Record<string, unknown>): void {
    try {
      this.socket.send(JSON.stringify(event));
    } catch (error) {
      this.emit({
        type: "error",
        error_class: "network_error",
        message: bounded(
          error instanceof Error ? error.message : String(error),
        ),
      });
    }
  }

  private sendSessionUpdate(): void {
    const turn_detection =
      this.turnDetection === "none"
        ? null
        : this.turnDetection === "server_vad"
          ? {
              type: "server_vad",
              create_response: true,
              interrupt_response: true,
            }
          : {
              type: "semantic_vad",
              create_response: true,
              interrupt_response: true,
            };
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        ...(this.instructions ? { instructions: this.instructions } : {}),
        output_modalities: ["audio"],
        audio: {
          input: {
            format: { type: "audio/pcm", rate: OPENAI_REALTIME_SAMPLE_RATE_HZ },
            turn_detection,
            transcription: { model: "gpt-4o-mini-transcribe" },
          },
          output: { format: { type: "audio/pcm" }, voice: this.voice },
        },
        tools: this.tools.map((t) => ({
          type: "function",
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
      },
    });
  }

  private requestResponse(): void {
    this.responseRequestedAtMs = this.nowMs();
    this.send({ type: "response.create" });
  }

  private doInterrupt(source: "user_barge_in" | "orchestrator"): void {
    const playedMs = this.audioPlayedMs();
    if (source === "orchestrator" && this.activeResponseId) {
      this.send({ type: "response.cancel" });
      if (this.activeItemId) {
        this.send({
          type: "conversation.item.truncate",
          item_id: this.activeItemId,
          content_index: 0,
          audio_end_ms: playedMs,
        });
      }
    }
    this.sink.cancel();
    this.interruptions += 1;
    this.emit({
      type: "interrupted",
      response_id: this.activeResponseId,
      audio_played_ms: playedMs,
      source,
    });
    this.resetResponseTracking();
  }

  private audioPlayedMs(): number {
    // PCM16 mono @24 kHz => 48 000 bytes per second.
    return Math.round(
      (this.audioBytesThisResponse / (OPENAI_REALTIME_SAMPLE_RATE_HZ * 2)) *
        1000,
    );
  }

  private resetResponseTracking(): void {
    this.activeResponseId = null;
    this.activeItemId = null;
    this.firstAudioSeen = false;
    this.audioBytesThisResponse = 0;
    this.responseRequestedAtMs = null;
  }

  private handleMessage(data: string): void {
    let event: ServerEvent;
    try {
      event = JSON.parse(data) as ServerEvent;
    } catch {
      this.emit({
        type: "error",
        error_class: "protocol_error",
        message: "non-json server event",
      });
      return;
    }
    switch (event.type) {
      case "session.created":
      case "session.updated":
        return;
      case "input_audio_buffer.speech_started": {
        this.emit({ type: "user_speech_started", at_ms: this.nowMs() });
        // With VAD on, the server truncates the in-flight response itself; we
        // only need to stop local playback and record the barge-in.
        if (this.activeResponseId) this.doInterrupt("user_barge_in");
        return;
      }
      case "input_audio_buffer.speech_stopped": {
        this.userSpeechStoppedAtMs = this.nowMs();
        this.emit({
          type: "user_speech_stopped",
          at_ms: this.userSpeechStoppedAtMs,
        });
        return;
      }
      case "conversation.item.input_audio_transcription.completed": {
        this.emit({
          type: "transcript",
          role: "user",
          text: str(event.transcript),
          final: true,
        });
        return;
      }
      case "response.created": {
        const response = asRecord(event.response);
        this.activeResponseId = str(response.id) || null;
        this.firstAudioSeen = false;
        this.audioBytesThisResponse = 0;
        this.responses += 1;
        return;
      }
      case "response.output_item.added": {
        const item = asRecord(event.item);
        if (str(item.type) === "message")
          this.activeItemId = str(item.id) || null;
        return;
      }
      case "response.output_audio.delta":
      case "response.audio.delta": {
        const b64 = str(event.delta);
        if (!b64) return;
        const bytes = Buffer.from(b64, "base64");
        if (!this.firstAudioSeen) {
          this.firstAudioSeen = true;
          const anchor =
            this.userSpeechStoppedAtMs ?? this.responseRequestedAtMs;
          const latency =
            anchor === null ? 0 : Math.max(0, this.nowMs() - anchor);
          this.emit({
            type: "assistant_audio_started",
            response_id: this.activeResponseId ?? str(event.response_id),
            first_audio_latency_ms: latency,
          });
        }
        this.audioBytesThisResponse += bytes.byteLength;
        this.sink.write(
          new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
          OPENAI_REALTIME_SAMPLE_RATE_HZ,
        );
        return;
      }
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta": {
        this.emit({
          type: "transcript",
          role: "assistant",
          text: str(event.delta),
          final: false,
        });
        return;
      }
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        this.emit({
          type: "transcript",
          role: "assistant",
          text: str(event.transcript),
          final: true,
        });
        return;
      }
      case "response.function_call_arguments.done": {
        this.toolCalls += 1;
        this.emit({
          type: "tool_call",
          call_id: str(event.call_id),
          name: str(event.name),
          arguments_json: str(event.arguments) || "{}",
        });
        return;
      }
      case "response.done": {
        const response = asRecord(event.response);
        const responseId = str(response.id) || this.activeResponseId || "";
        // Function calls may only appear in output[] on some paths; do not
        // double-emit when the arguments.done event already fired.
        const usage = asRecord(response.usage);
        if (Object.keys(usage).length > 0) this.recordUsage(usage);
        if (this.firstAudioSeen) {
          this.sink.flush();
          this.emit({
            type: "assistant_audio_done",
            response_id: responseId,
            audio_ms: this.audioPlayedMs(),
          });
        }
        this.resetResponseTracking();
        return;
      }
      case "error": {
        const err = asRecord(event.error);
        this.emit({
          type: "error",
          error_class: "provider_error",
          message: bounded(
            `${str(err.type)} ${str(err.code)} ${str(err.message)}`.trim(),
          ),
        });
        return;
      }
      default:
        return;
    }
  }

  private recordUsage(usage: Record<string, unknown>): void {
    const inDetails = asRecord(usage.input_token_details);
    const cached = asRecord(inDetails.cached_tokens_details);
    const outDetails = asRecord(usage.output_token_details);
    const delta = usageFromRealtimeTokens(
      {
        input_text_tokens: num(inDetails.text_tokens),
        input_audio_tokens: num(inDetails.audio_tokens),
        cached_text_tokens: num(cached.text_tokens),
        cached_audio_tokens: num(cached.audio_tokens),
        output_text_tokens: num(outDetails.text_tokens),
        output_audio_tokens: num(outDetails.audio_tokens),
      },
      this.model,
    );
    this.usage = addVoiceLiveUsage(this.usage, delta);
    this.emit({ type: "usage", usage: delta });
  }
}
