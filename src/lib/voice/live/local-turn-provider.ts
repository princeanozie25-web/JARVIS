// The EXISTING local stack (parakeet-mlx STT -> local brain -> mlx-audio TTS)
// exposed as a VoiceLiveProvider, so the router, wake word and the
// orchestrator treat "local" and "cloud realtime" through ONE contract.
//
// Honest capability statement: this is the sequential turn loop. It buffers
// microphone PCM while JARVIS speaks, so a user CAN talk over it, but it does
// not DETECT that by itself — `barge_in` is deliberately NOT declared. The
// orchestrator (VAD / wake layer) calls `interrupt()`, which cancels playback
// and abandons the in-flight turn via an epoch guard. Tool calls raised by the
// local brain are surfaced as `tool_call` events and resolved only through the
// Gate (`submitToolResult`), exactly like the cloud engine.
//
// Everything expensive is injected (STT, brain, TTS, WAV I/O) so the
// conformance battery runs with fakes and no models.

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SttProvider } from "../../voice-runtime/stt/provider";
import {
  addVoiceLiveUsage,
  emptyVoiceLiveUsage,
  type VoiceLiveAudioSink,
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

export const LOCAL_TURN_PROVIDER_ID = "local-mlx-turn";
export const LOCAL_TURN_SAMPLE_RATE_HZ = 24_000;

export const LOCAL_TURN_DESCRIPTOR: VoiceLiveProviderDescriptor = {
  provider_id: LOCAL_TURN_PROVIDER_ID,
  display_name: "Local mlx turn loop (parakeet -> local brain -> mlx-audio)",
  privacy_class: "local_audio",
  cost_class: "free_local",
  capabilities: [
    "streaming_stt",
    "streaming_tts",
    "local",
    "offline_capable",
    "tool_calling",
  ],
  tool_execution_allowed: false,
  metadata_only: true,
};

// ---- injectable seams --------------------------------------------------------

export interface VoiceLiveBrainMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  readonly tool_call_id?: string;
}

export interface VoiceLiveBrainToolCall {
  readonly call_id: string;
  readonly name: string;
  readonly arguments_json: string;
}

export interface VoiceLiveBrainTurn {
  readonly text: string;
  readonly tool_calls: readonly VoiceLiveBrainToolCall[];
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cost_usd: number;
}

export interface VoiceLiveBrain {
  generate(
    messages: readonly VoiceLiveBrainMessage[],
    tools: readonly VoiceLiveToolSpec[],
    signal?: AbortSignal,
  ): Promise<VoiceLiveBrainTurn>;
}

// Structural subset of the E-011 VoiceSynthesisEngine (kokoro / vibevoice / …).
export interface VoiceLiveSynthesizer {
  synthesize(line: { id: string; text: string }): Promise<{
    output_ref: string;
    duration_ms: number;
  }>;
}

export interface WavPcm {
  readonly pcm16: Uint8Array;
  readonly sample_rate_hz: number;
}

export interface LocalTurnProviderOptions {
  readonly stt: SttProvider;
  readonly brain: VoiceLiveBrain;
  readonly tts: VoiceLiveSynthesizer;
  readonly systemPrompt?: string;
  readonly tmpDir?: string;
  readonly nowMs?: () => number;
  readonly readWav?: (path: string) => WavPcm;
  readonly writeWav?: (
    path: string,
    pcm16: Uint8Array,
    sampleRateHz: number,
  ) => void;
  readonly health?: () => Promise<VoiceLiveProviderHealth>;
}

export const LOCAL_TURN_DEFAULT_SYSTEM_PROMPT =
  "You are JARVIS, a voice assistant. Answer in ONE short spoken sentence, no lists, no code.";

// ---- WAV helpers (PCM16 LE) ---------------------------------------------------

export function writePcm16Wav(
  path: string,
  pcm16: Uint8Array,
  sampleRateHz: number,
): void {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm16.byteLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRateHz, 24);
  header.writeUInt32LE(sampleRateHz * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm16.byteLength, 40);
  writeFileSync(path, Buffer.concat([header, Buffer.from(pcm16)]));
}

export function readPcm16Wav(path: string): WavPcm {
  const buf = readFileSync(path);
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("not a RIFF wav");
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 1;
  let bits = 16;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bits = buf.readUInt16LE(offset + 22);
    } else if (id === "data") {
      const end = Math.min(buf.length, offset + 8 + size);
      let pcm: Uint8Array = new Uint8Array(buf.subarray(offset + 8, end));
      if (bits !== 16) throw new Error(`unsupported wav bits: ${bits}`);
      if (channels === 2) pcm = downmixStereo16(pcm);
      return { pcm16: pcm, sample_rate_hz: sampleRate };
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("wav has no data chunk");
}

function downmixStereo16(pcm: Uint8Array): Uint8Array {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const frames = Math.floor(pcm.byteLength / 4);
  const out = new Uint8Array(frames * 2);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < frames; i += 1) {
    const l = view.getInt16(i * 4, true);
    const r = view.getInt16(i * 4 + 2, true);
    outView.setInt16(i * 2, Math.round((l + r) / 2), true);
  }
  return out;
}

// ---- provider -----------------------------------------------------------------

export function createLocalTurnProvider(
  options: LocalTurnProviderOptions,
): VoiceLiveProvider {
  const nowMs = options.nowMs ?? (() => Date.now());
  const health =
    options.health ??
    (async () => {
      const stt = await options.stt.health();
      return {
        ok: stt.ok,
        degraded: stt.degraded,
        ...(stt.ok ? {} : { error_class: "unavailable" as const }),
        metadata_only: true as const,
      };
    });
  return {
    descriptor: LOCAL_TURN_DESCRIPTOR,
    health,
    startSession: async (sessionOptions) => {
      const h = await health();
      if (!h.ok)
        throw new Error(
          `local turn provider ${h.error_class ?? "unavailable"}`,
        );
      const session = new LocalTurnSession(options, sessionOptions, nowMs);
      session.emitStarted();
      return session;
    },
  };
}

class LocalTurnSession implements VoiceLiveSession {
  readonly session_id: string;
  readonly provider_id = LOCAL_TURN_PROVIDER_ID;

  private readonly stt: SttProvider;
  private readonly brain: VoiceLiveBrain;
  private readonly tts: VoiceLiveSynthesizer;
  private readonly sink: VoiceLiveAudioSink;
  private readonly emit: (event: VoiceLiveEvent) => void;
  private readonly tools: readonly VoiceLiveToolSpec[];
  private readonly systemPrompt: string;
  private readonly nowMs: () => number;
  private readonly readWav: (path: string) => WavPcm;
  private readonly writeWav: (
    path: string,
    pcm16: Uint8Array,
    sr: number,
  ) => void;
  private readonly dir: string;
  private readonly abortSignal: AbortSignal | undefined;

  private state: VoiceLiveSessionSnapshot["state"] = "open";
  private muted = false;
  private epoch = 0;
  private turnInFlight = false;
  private speaking = false;
  private interruptions = 0;
  private toolCalls = 0;
  private responses = 0;
  private turnCounter = 0;
  private readonly startedAtMs: number;
  private endedAtMs: number | null = null;
  private usage: VoiceLiveUsage = emptyVoiceLiveUsage();
  private buffer: Uint8Array[] = [];
  private bufferedBytes = 0;
  private readonly history: VoiceLiveBrainMessage[] = [];
  private readonly pendingTools = new Map<string, (output: string) => void>();
  private currentResponseId: string | null = null;
  private audioBytesThisResponse = 0;

  constructor(
    options: LocalTurnProviderOptions,
    sessionOptions: VoiceLiveSessionOptions,
    nowMs: () => number,
  ) {
    this.session_id = sessionOptions.session_id;
    this.stt = options.stt;
    this.brain = options.brain;
    this.tts = options.tts;
    this.sink = sessionOptions.audio_sink;
    this.emit = sessionOptions.on_event;
    this.tools = sessionOptions.tools ?? [];
    this.systemPrompt =
      sessionOptions.instructions ??
      options.systemPrompt ??
      LOCAL_TURN_DEFAULT_SYSTEM_PROMPT;
    this.nowMs = nowMs;
    this.readWav = options.readWav ?? readPcm16Wav;
    this.writeWav = options.writeWav ?? writePcm16Wav;
    this.dir =
      options.tmpDir ?? mkdtempSync(join(tmpdir(), "jarvis-voice-live-local-"));
    this.abortSignal = sessionOptions.abort_signal;
    this.startedAtMs = nowMs();
    this.history.push({ role: "system", content: this.systemPrompt });
    this.abortSignal?.addEventListener(
      "abort",
      () => void this.stop("abort_signal"),
      { once: true },
    );
  }

  emitStarted(): void {
    this.emit({ type: "session_started", at_ms: this.startedAtMs });
  }

  inputSampleRateHz(): number {
    return LOCAL_TURN_SAMPLE_RATE_HZ;
  }

  ingestAudio(pcm16: Uint8Array): void {
    if (this.state !== "open" || this.muted || pcm16.byteLength === 0) return;
    this.buffer.push(new Uint8Array(pcm16));
    this.bufferedBytes += pcm16.byteLength;
  }

  commitAudio(): void {
    if (this.state !== "open" || this.turnInFlight || this.bufferedBytes === 0)
      return;
    const pcm = concat(this.buffer, this.bufferedBytes);
    this.buffer = [];
    this.bufferedBytes = 0;
    void this.runTurn(pcm);
  }

  async interrupt(): Promise<void> {
    if (this.state !== "open") return;
    this.doInterrupt("orchestrator");
  }

  submitToolResult(callId: string, outputJson: string): void {
    const resolve = this.pendingTools.get(callId);
    if (!resolve) return;
    this.pendingTools.delete(callId);
    resolve(outputJson);
  }

  mute(): void {
    this.muted = true;
  }

  unmute(): void {
    this.muted = false;
  }

  async stop(reason: VoiceLiveStopReason): Promise<void> {
    if (this.state === "closed") return;
    this.epoch += 1;
    this.state = "closed";
    this.endedAtMs = this.nowMs();
    this.sink.cancel();
    this.failPendingTools();
    this.emit({ type: "session_ended", reason, at_ms: this.endedAtMs });
  }

  snapshot(): VoiceLiveSessionSnapshot {
    return {
      session_id: this.session_id,
      provider_id: this.provider_id,
      state: this.state,
      assistant_speaking: this.speaking,
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

  // ---- the turn ----------------------------------------------------------------

  private doInterrupt(source: "user_barge_in" | "orchestrator"): void {
    const playedMs = Math.round(
      (this.audioBytesThisResponse / (LOCAL_TURN_SAMPLE_RATE_HZ * 2)) * 1000,
    );
    this.epoch += 1; // abandons whatever stage the in-flight turn is in
    this.sink.cancel();
    this.failPendingTools();
    this.interruptions += 1;
    this.speaking = false;
    this.turnInFlight = false;
    this.emit({
      type: "interrupted",
      response_id: this.currentResponseId,
      audio_played_ms: playedMs,
      source,
    });
    this.currentResponseId = null;
    this.audioBytesThisResponse = 0;
  }

  private failPendingTools(): void {
    for (const resolve of this.pendingTools.values())
      resolve('{"error":"cancelled"}');
    this.pendingTools.clear();
  }

  private async runTurn(pcm: Uint8Array): Promise<void> {
    const epoch = this.epoch;
    const live = () => this.state === "open" && this.epoch === epoch;
    this.turnInFlight = true;
    this.turnCounter += 1;
    const turnId = `t${this.turnCounter}`;
    const committedAt = this.nowMs();
    try {
      // 1 — STT
      const capturePath = join(this.dir, `${turnId}-capture.wav`);
      this.writeWav(capturePath, pcm, LOCAL_TURN_SAMPLE_RATE_HZ);
      const durationMs = Math.max(
        1,
        Math.round((pcm.byteLength / (LOCAL_TURN_SAMPLE_RATE_HZ * 2)) * 1000),
      );
      const stt = await this.stt.transcribe(
        {
          request_id: `${this.session_id}-${turnId}`,
          session_id: this.session_id,
          turn_id: turnId,
          audio: {
            audio_ref: capturePath,
            mime_type: "audio/wav",
            duration_ms: durationMs,
            size_bytes: pcm.byteLength + 44,
            sample_rate_hz: LOCAL_TURN_SAMPLE_RATE_HZ,
            metadata_only: true,
          },
          metadata_only: true,
        },
        { metadata_only: true },
      );
      if (!live()) return;
      const transcript = stt.transcript.trim();
      if (!transcript) {
        this.turnInFlight = false;
        return;
      }
      this.emit({ type: "user_speech_stopped", at_ms: committedAt });
      this.emit({
        type: "transcript",
        role: "user",
        text: transcript,
        final: true,
      });
      this.history.push({ role: "user", content: transcript });

      // 2 — brain, with tool calls resolved ONLY through the Gate
      let turn = await this.brain.generate(
        this.history,
        this.tools,
        this.abortSignal,
      );
      if (!live()) return;
      this.bookUsage(turn);
      for (
        let round = 0;
        round < 3 && turn.tool_calls.length > 0 && live();
        round += 1
      ) {
        const results = await Promise.all(
          turn.tool_calls.map((call) => {
            this.toolCalls += 1;
            this.emit({
              type: "tool_call",
              call_id: call.call_id,
              name: call.name,
              arguments_json: call.arguments_json,
            });
            return new Promise<string>((resolve) =>
              this.pendingTools.set(call.call_id, resolve),
            );
          }),
        );
        if (!live()) return;
        this.history.push({
          role: "assistant",
          content:
            turn.text ||
            `[calling ${turn.tool_calls.map((c) => c.name).join(", ")}]`,
        });
        turn.tool_calls.forEach((call, i) => {
          this.history.push({
            role: "tool",
            content: results[i] ?? "",
            tool_call_id: call.call_id,
          });
        });
        turn = await this.brain.generate(
          this.history,
          this.tools,
          this.abortSignal,
        );
        if (!live()) return;
        this.bookUsage(turn);
      }
      const reply = (
        turn.text.trim() || "Sorry, I did not catch a response."
      ).replace(/\bJARVIS\b/g, "Jarvis");
      this.history.push({ role: "assistant", content: reply });
      this.emit({
        type: "transcript",
        role: "assistant",
        text: reply,
        final: true,
      });

      // 3 — TTS -> sink
      this.responses += 1;
      const responseId = `${this.session_id}-${turnId}`;
      this.currentResponseId = responseId;
      const cue = await this.tts.synthesize({ id: responseId, text: reply });
      if (!live()) return;
      const wav = this.readWav(cue.output_ref);
      if (!live()) return;
      this.speaking = true;
      this.audioBytesThisResponse = wav.pcm16.byteLength;
      this.emit({
        type: "assistant_audio_started",
        response_id: responseId,
        first_audio_latency_ms: Math.max(0, this.nowMs() - committedAt),
      });
      this.sink.write(wav.pcm16, wav.sample_rate_hz);
      this.sink.flush();
      this.emit({
        type: "assistant_audio_done",
        response_id: responseId,
        audio_ms: cue.duration_ms,
      });
      this.speaking = false;
      this.currentResponseId = null;
      this.audioBytesThisResponse = 0;
      this.turnInFlight = false;
    } catch (error) {
      if (!live()) return;
      this.turnInFlight = false;
      this.speaking = false;
      this.emit({
        type: "error",
        error_class: "provider_error",
        message: (error instanceof Error ? error.message : String(error)).slice(
          0,
          200,
        ),
      });
    }
  }

  private bookUsage(turn: VoiceLiveBrainTurn): void {
    const delta: VoiceLiveUsage = {
      input_tokens: turn.input_tokens,
      output_tokens: turn.output_tokens,
      input_text_tokens: turn.input_tokens,
      input_audio_tokens: 0,
      cached_input_tokens: 0,
      output_text_tokens: turn.output_tokens,
      output_audio_tokens: 0,
      estimated_usd: turn.cost_usd,
    };
    this.usage = addVoiceLiveUsage(this.usage, delta);
    this.emit({ type: "usage", usage: delta });
  }
}

function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
