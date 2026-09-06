// The §20 wake-word ACTIVATION LOOP:
//
//   local mic ─► local wake detector ─► activation ─► orchestrator.activate()
//                                                        ─► the routed session
//
// The loop owns ONE microphone stream (16 kHz s16le mono) and forks it: while
// armed the frames feed the detector only; after a wake they feed the session
// (upsampled to 24 kHz) until the turn ends; then the detector is re-armed.
// The detector never learns which engine answered, and cloud audio can only
// start AFTER a local wake + routing approval (§6). Fail-closed: refuses to
// start unless `wake_word_enabled` is set in the live config.
//
// Honest limits (§8): the local turn provider has no acoustic echo
// cancellation, so the loop does NOT feed the mic to the session while JARVIS
// is speaking locally and does not attempt VAD barge-in there — the speaker
// output would re-trigger it. Cloud sessions stream continuously and rely on
// the provider's server VAD (use headphones until AEC exists).

import { spawn } from "node:child_process";

import type { VoiceLiveConfig } from "./config";
import type {
  VoiceLiveAudioSink,
  VoiceLiveEvent,
  VoiceLiveToolSpec,
} from "./contract";
import type {
  VoiceLiveActivation,
  VoiceLiveOrchestrator,
} from "./orchestrator";
import {
  OPENWAKEWORD_SAMPLE_RATE_HZ,
  type OpenWakeWordProvider,
} from "./wake-word-openwakeword";

export interface WakeMicSource {
  frames(): AsyncIterable<Uint8Array>; // s16le mono @16 kHz, any chunking
  stop(): void;
}

export function createFfmpegMicSource(device = ":0"): WakeMicSource {
  let proc: ReturnType<typeof spawn> | null = null;
  return {
    frames: async function* () {
      proc = spawn(
        "ffmpeg",
        [
          "-loglevel",
          "error",
          "-f",
          "avfoundation",
          "-i",
          device,
          "-f",
          "s16le",
          "-ar",
          String(OPENWAKEWORD_SAMPLE_RATE_HZ),
          "-ac",
          "1",
          "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "inherit"] },
      );
      const stdout = proc.stdout!;
      for await (const chunk of stdout as AsyncIterable<Buffer>) {
        yield new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      }
    },
    stop: () => {
      proc?.kill("SIGKILL");
      proc = null;
    },
  };
}

// A WAV/any-audio file played as if it were the microphone (smoke/test path).
export function createFileMicSource(path: string): WakeMicSource {
  let proc: ReturnType<typeof spawn> | null = null;
  return {
    frames: async function* () {
      proc = spawn(
        "ffmpeg",
        [
          "-loglevel",
          "error",
          "-re",
          "-i",
          path,
          "-f",
          "s16le",
          "-ar",
          String(OPENWAKEWORD_SAMPLE_RATE_HZ),
          "-ac",
          "1",
          "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "inherit"] },
      );
      for await (const chunk of proc.stdout! as AsyncIterable<Buffer>) {
        yield new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      }
    },
    stop: () => {
      proc?.kill("SIGKILL");
      proc = null;
    },
  };
}

// 16 kHz -> 24 kHz, linear interpolation (speech-adequate, dependency-free).
export function upsample16kTo24k(pcm16: Uint8Array): Uint8Array {
  const inView = new DataView(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  const inSamples = Math.floor(pcm16.byteLength / 2);
  const outSamples = Math.floor(inSamples * 1.5);
  const out = new Uint8Array(outSamples * 2);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < outSamples; i += 1) {
    const pos = i / 1.5;
    const i0 = Math.floor(pos);
    const i1 = Math.min(inSamples - 1, i0 + 1);
    const frac = pos - i0;
    const a = inView.getInt16(i0 * 2, true);
    const b = inView.getInt16(i1 * 2, true);
    outView.setInt16(i * 2, Math.round(a + (b - a) * frac), true);
  }
  return out;
}

export function rmsPcm16(pcm16: Uint8Array): number {
  const view = new DataView(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  const n = Math.floor(pcm16.byteLength / 2);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i += 1) {
    const s = view.getInt16(i * 2, true);
    sum += s * s;
  }
  return Math.sqrt(sum / n);
}

export interface EndOfTurnConfig {
  readonly rmsThreshold: number; // speech if RMS above this (int16 scale)
  readonly minSpeechMs: number;
  readonly silenceMs: number;
  readonly maxTurnMs: number;
}

export const DEFAULT_END_OF_TURN: EndOfTurnConfig = {
  rmsThreshold: 600,
  minSpeechMs: 250,
  silenceMs: 800,
  maxTurnMs: 12_000,
};

export type WakeLoopEvent =
  | { readonly type: "standby" }
  | {
      readonly type: "wake";
      readonly confidence_band: string;
      readonly latency_ms: number;
    }
  | {
      readonly type: "activated";
      readonly provider_id: string;
      readonly reason: string;
    }
  | { readonly type: "turn_committed"; readonly speech_ms: number }
  | { readonly type: "session_ended"; readonly reason: string }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "stopped" };

export interface WakeActivationLoopOptions {
  readonly config: VoiceLiveConfig;
  readonly wake: OpenWakeWordProvider;
  readonly orchestrator: VoiceLiveOrchestrator;
  readonly mic: WakeMicSource;
  readonly audio_sink: VoiceLiveAudioSink;
  readonly tools?: readonly VoiceLiveToolSpec[];
  readonly instructions?: string;
  readonly onEvent?: (event: WakeLoopEvent) => void;
  readonly onSessionEvent?: (event: VoiceLiveEvent) => void;
  readonly endOfTurn?: EndOfTurnConfig;
  readonly followUpWindowMs?: number; // after an answer, speak again without the wake word
  readonly cloudIdleMs?: number; // end a streaming (cloud) session after this much quiet
  readonly nowMs?: () => number;
  readonly once?: boolean; // stop after the first session (smoke)
}

type Phase = "standby" | "listening" | "answering" | "followup";

export class WakeActivationLoop {
  private phase: Phase = "standby";
  private running = false;
  private activation: VoiceLiveActivation | null = null;
  private cloudSession = false;
  private assistantSpeaking = false;
  private speechMs = 0;
  private silenceMs = 0;
  private turnMs = 0;
  private lastActivityMs = 0;
  private turnDone: (() => void) | null = null;
  private readonly eot: EndOfTurnConfig;
  private readonly nowMs: () => number;
  private readonly emit: (e: WakeLoopEvent) => void;

  constructor(private readonly o: WakeActivationLoopOptions) {
    this.eot = o.endOfTurn ?? DEFAULT_END_OF_TURN;
    this.nowMs = o.nowMs ?? (() => Date.now());
    this.emit = o.onEvent ?? (() => {});
  }

  async start(): Promise<void> {
    if (!this.o.config.wake_word_enabled) {
      throw new Error(
        "wake word is disabled (JARVIS_WAKE_WORD_ENABLED=false) — refusing to open the microphone",
      );
    }
    this.running = true;
    await this.o.wake.arm();
    this.phase = "standby";
    this.emit({ type: "standby" });
    const pump = this.pumpMic();
    try {
      while (this.running) {
        let detection;
        try {
          detection = await this.o.wake.detect();
        } catch (error) {
          // stop()/cancel() reject the pending detect on purpose; anything
          // else is a detector failure — report it and fail closed.
          if (!this.running) break;
          this.emit({
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
          break;
        }
        if (!this.running) break;
        if (!detection.wake_detected) continue;
        this.emit({
          type: "wake",
          confidence_band: detection.confidence_band,
          latency_ms: detection.latency_ms,
        });
        await this.runSession();
        if (this.o.once) break;
        if (this.running) {
          await this.o.wake.arm();
          this.phase = "standby";
          this.emit({ type: "standby" });
        }
      }
    } finally {
      this.running = false;
      this.o.mic.stop();
      await this.o.wake.disarm();
      await pump.catch(() => {});
      this.emit({ type: "stopped" });
    }
  }

  // Emergency stop / sleep: ends any session, closes the mic, disarms.
  async stop(): Promise<void> {
    this.running = false;
    this.turnDone?.();
    await this.activation?.session.stop("user_stopped");
    this.activation = null;
    this.o.mic.stop();
    await this.o.wake.cancel("stopped");
  }

  private async pumpMic(): Promise<void> {
    for await (const frame of this.o.mic.frames()) {
      if (!this.running) break;
      this.route(frame);
    }
  }

  private route(frame: Uint8Array): void {
    const frameMs = (frame.byteLength / 2 / OPENWAKEWORD_SAMPLE_RATE_HZ) * 1000;
    switch (this.phase) {
      case "standby":
        this.o.wake.feed(frame);
        return;
      case "answering":
        // Local: no AEC — do not feed our own voice back in. Cloud: keep streaming (server VAD).
        if (this.cloudSession)
          this.activation?.session.ingestAudio(upsample16kTo24k(frame));
        return;
      case "listening":
      case "followup": {
        const session = this.activation?.session;
        if (!session) return;
        const loud = rmsPcm16(frame) >= this.eot.rmsThreshold;
        if (this.cloudSession) {
          session.ingestAudio(upsample16kTo24k(frame));
          if (loud) this.lastActivityMs = this.nowMs();
          return;
        }
        // Local turn: energy end-of-turn.
        if (loud) {
          this.speechMs += frameMs;
          this.silenceMs = 0;
          if (this.phase === "followup") this.phase = "listening";
        } else if (this.speechMs > 0) {
          this.silenceMs += frameMs;
        }
        if (this.phase === "listening") {
          session.ingestAudio(upsample16kTo24k(frame));
          this.turnMs += frameMs;
          const enough = this.speechMs >= this.eot.minSpeechMs;
          if (
            (enough && this.silenceMs >= this.eot.silenceMs) ||
            this.turnMs >= this.eot.maxTurnMs
          ) {
            if (enough) {
              this.emit({
                type: "turn_committed",
                speech_ms: Math.round(this.speechMs),
              });
              this.phase = "answering";
              session.commitAudio();
            } else {
              this.turnDone?.(); // nothing said: end the activation
            }
          }
        }
        return;
      }
      default:
        return;
    }
  }

  private async runSession(): Promise<void> {
    const sessionId = `wake-${this.nowMs()}`;
    let activation: VoiceLiveActivation;
    try {
      activation = await this.o.orchestrator.activate({
        session_id: sessionId,
        audio_sink: this.o.audio_sink,
        tools: this.o.tools,
        instructions: this.o.instructions,
        on_event: (e) => this.onSessionEvent(e),
      });
    } catch (error) {
      this.emit({
        type: "error",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    this.activation = activation;
    this.cloudSession =
      this.o.orchestrator
        .provider(activation.provider_id)
        ?.descriptor.capabilities.includes("speech_to_speech") ?? false;
    this.emit({
      type: "activated",
      provider_id: activation.provider_id,
      reason: activation.decision.reason,
    });
    this.resetTurn();
    this.phase = "listening";
    this.lastActivityMs = this.nowMs();

    await new Promise<void>((resolve) => {
      this.turnDone = resolve;
      // Cloud sessions end after quiet; local ones end via the turn/follow-up logic.
      const tick = setInterval(() => {
        if (!this.running || !this.activation) {
          clearInterval(tick);
          resolve();
          return;
        }
        const idle = this.nowMs() - this.lastActivityMs;
        if (this.cloudSession && idle >= (this.o.cloudIdleMs ?? 10_000)) {
          clearInterval(tick);
          resolve();
        } else if (
          !this.cloudSession &&
          this.phase === "followup" &&
          idle >= (this.o.followUpWindowMs ?? 6_000)
        ) {
          clearInterval(tick);
          resolve();
        }
      }, 100);
    });
    this.turnDone = null;
    const reason = this.running ? "wake_sleep" : "user_stopped";
    await activation.session.stop(reason);
    this.activation = null;
    this.phase = "standby";
    this.emit({ type: "session_ended", reason });
  }

  private onSessionEvent(e: VoiceLiveEvent): void {
    this.o.onSessionEvent?.(e);
    switch (e.type) {
      case "assistant_audio_started":
        this.assistantSpeaking = true;
        this.phase = "answering";
        break;
      case "assistant_audio_done":
        this.assistantSpeaking = false;
        this.lastActivityMs = this.nowMs();
        if (!this.cloudSession) {
          this.resetTurn();
          this.phase = "followup";
        }
        break;
      case "user_speech_started":
      case "user_speech_stopped":
      case "transcript":
        this.lastActivityMs = this.nowMs();
        break;
      case "error":
        if (e.error_class !== "provider_error" || this.phase !== "answering")
          break;
        this.turnDone?.();
        break;
      case "session_ended":
        if (e.reason !== "fallback") this.turnDone?.();
        break;
      default:
        break;
    }
  }

  private resetTurn(): void {
    this.speechMs = 0;
    this.silenceMs = 0;
    this.turnMs = 0;
  }

  snapshot() {
    return {
      phase: this.phase,
      running: this.running,
      provider_id: this.activation?.provider_id ?? null,
      cloud_session: this.cloudSession,
      assistant_speaking: this.assistantSpeaking,
      metadata_only: true as const,
    };
  }
}
