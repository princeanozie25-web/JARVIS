// Voice bake-off — LIVE SESSION SMOKE through the real orchestrator:
//   config -> providers (local mlx | OpenAI Realtime) -> router -> session
//   mic (ffmpeg avfoundation) or a cached WAV -> session -> streaming ffplay sink
//
// Usage (repo TS loader, from the repo root, in Terminal.app for mic/speakers):
//   voice-live-session-smoke                       # mic, mode from JARVIS_VOICE_LIVE_MODE (default auto=local)
//   voice-live-session-smoke --mode premium        # OpenAI Realtime (needs OPENAI_API_KEY)
//   voice-live-session-smoke --cached /tmp/jarvis-voice/utt5.wav
//   voice-live-session-smoke --seconds 6
//
// Lives at scripts/ root (spawns ffmpeg/ffplay) like voice-live-smoke.ts.
// Tool calls: this smoke prints them and answers the demo tool `check_build`
// with a clearly-labelled STUB result so the loop can be exercised end to end.
// In the product the answer comes from the Action Gateway -> Human Gate; the
// stub is NOT a governance path and exists only in this script.

import { spawn, type ChildProcess } from "node:child_process";

import { loadVoiceLiveConfig } from "../src/lib/voice/live/config";
import type {
  VoiceLiveAudioSink,
  VoiceLiveEvent,
} from "../src/lib/voice/live/contract";
import { createVoiceLiveProvidersFromConfig } from "../src/lib/voice/live/local-engines";
import { VoiceLiveOrchestrator } from "../src/lib/voice/live/orchestrator";
import type { VoiceLiveMode } from "../src/lib/voice/live/router";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const MODE = flag("--mode") as VoiceLiveMode | undefined;
const CACHED = flag("--cached");
const SECONDS = Number(flag("--seconds") ?? 5);
const RATE = 24_000;

function log(kind: string, payload: unknown): void {
  console.log(
    `[${kind}] ${typeof payload === "string" ? payload : JSON.stringify(payload)}`,
  );
}

// Streaming PCM16 player. cancel() kills playback instantly and discards the
// queue (barge-in); flush() lets the current utterance drain, then exits.
class FfplaySink implements VoiceLiveAudioSink {
  private proc: ChildProcess | null = null;
  private drainPromise: Promise<void> = Promise.resolve();
  write(pcm16: Uint8Array, sampleRateHz: number): void {
    if (!this.proc) this.start(sampleRateHz);
    this.proc!.stdin!.write(Buffer.from(pcm16));
  }
  flush(): void {
    this.proc?.stdin?.end();
    this.proc = null;
  }
  cancel(): void {
    if (this.proc) {
      this.proc.kill("SIGKILL");
      this.proc = null;
    }
  }
  drained(): Promise<void> {
    return this.drainPromise;
  }
  private start(sr: number): void {
    const p = spawn(
      "ffplay",
      [
        "-f",
        "s16le",
        "-ar",
        String(sr),
        "-ac",
        "1",
        "-i",
        "pipe:0",
        "-nodisp",
        "-autoexit",
        "-loglevel",
        "quiet",
      ],
      { stdio: ["pipe", "ignore", "ignore"] },
    );
    // -autoexit closes the reader when drained; a late write must not crash the smoke.
    p.stdin!.on("error", () => {});
    this.proc = p;
    this.drainPromise = new Promise((resolve) =>
      p.on("exit", () => {
        if (this.proc === p) this.proc = null;
        resolve();
      }),
    );
  }
}

function capture(): Promise<Uint8Array> {
  const ffArgs = CACHED
    ? [
        "-loglevel",
        "error",
        "-i",
        CACHED,
        "-f",
        "s16le",
        "-ar",
        String(RATE),
        "-ac",
        "1",
        "pipe:1",
      ]
    : [
        "-loglevel",
        "error",
        "-f",
        "avfoundation",
        "-i",
        ":0",
        "-t",
        String(SECONDS),
        "-f",
        "s16le",
        "-ar",
        String(RATE),
        "-ac",
        "1",
        "pipe:1",
      ];
  if (!CACHED)
    log("voice", `recording ~${SECONDS}s from the mic — speak now...`);
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ffArgs, { stdio: ["ignore", "pipe", "inherit"] });
    const chunks: Buffer[] = [];
    p.stdout!.on("data", (c: Buffer) => chunks.push(c));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve(new Uint8Array(Buffer.concat(chunks)))
        : reject(new Error(`ffmpeg exited ${code}`)),
    );
  });
}

async function main(): Promise<void> {
  const t0 = performance.now();
  const config = loadVoiceLiveConfig();
  const providers = createVoiceLiveProvidersFromConfig(config);
  const orchestrator = new VoiceLiveOrchestrator({
    config,
    providers,
    telemetry: (e) => log("telemetry", e),
  });
  log("config", {
    mode: MODE ?? config.mode,
    local_stt: config.local_stt,
    local_tts: config.local_tts,
    voice: config.local_voice_id,
    premium: config.openai_realtime_model,
    budget: orchestrator.budget.read(),
  });

  const sink = new FfplaySink();
  let done: (() => void) | null = null;
  const finished = new Promise<void>((r) => (done = r));
  let firstAudioAt: number | null = null;

  const onEvent = (e: VoiceLiveEvent): void => {
    switch (e.type) {
      case "transcript":
        if (e.final)
          log(
            "voice",
            `${e.role === "user" ? "heard" : "JARVIS"}: "${e.text}"`,
          );
        break;
      case "assistant_audio_started":
        firstAudioAt = performance.now();
        log("voice", `first audio after ${e.first_audio_latency_ms} ms`);
        break;
      case "tool_call": {
        log(
          "voice",
          `TOOL CALL ${e.name}(${e.arguments_json}) -> in the product: Action Gateway -> Human Gate`,
        );
        if (e.name === "check_build") {
          activation.session.submitToolResult(
            e.call_id,
            JSON.stringify({
              status: "green",
              files: 664,
              source: "smoke_stub_not_the_gate",
            }),
          );
        }
        break;
      }
      case "assistant_audio_done":
        log("voice", `audio done (${e.audio_ms} ms)`);
        done?.();
        break;
      case "interrupted":
        log("voice", `INTERRUPTED after ${e.audio_played_ms} ms (${e.source})`);
        break;
      case "error":
        log("voice", `ERROR ${e.error_class}: ${e.message}`);
        if (e.error_class === "credential_missing") done?.();
        break;
      case "usage":
        log("usage", e.usage);
        break;
      default:
        log("event", e.type);
    }
  };

  const activation = await orchestrator.activate({
    session_id: `smoke-${Date.now()}`,
    audio_sink: sink,
    on_event: onEvent,
    tools: [
      {
        name: "check_build",
        description: "Check whether the JARVIS build is green.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    ],
    ...(MODE ? { mode: MODE } : {}),
  });
  log("route", {
    provider: activation.provider_id,
    reason: activation.decision.reason,
    considered: activation.decision.considered,
  });

  const pcm = await capture();
  log(
    "voice",
    `captured ${(pcm.byteLength / (RATE * 2)).toFixed(2)} s of audio`,
  );
  const chunk = RATE * 2 * 0.1; // 100 ms frames, as a live mic would deliver
  for (let i = 0; i < pcm.byteLength; i += chunk)
    activation.session.ingestAudio(pcm.subarray(i, i + chunk));
  activation.session.commitAudio();

  const timeout = new Promise<void>((r) => setTimeout(r, 90_000));
  await Promise.race([finished, timeout]);
  await sink.drained();
  const snap = activation.session.snapshot();
  await activation.session.stop("user_stopped");
  log("result", {
    ok: snap.responses > 0,
    provider: activation.provider_id,
    responses: snap.responses,
    tool_calls: snap.tool_calls,
    interruptions: snap.interruptions,
    usage: snap.usage,
    first_audio_wall_ms:
      firstAudioAt === null ? null : Math.round(firstAudioAt - t0),
    total_ms: Math.round(performance.now() - t0),
    budget: orchestrator.budget.read(),
  });
}

main().catch((error) => {
  console.error(
    `[voice] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
