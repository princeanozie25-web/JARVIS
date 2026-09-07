// Voice bake-off — WAKE WORD SMOKE (§20): local openWakeWord -> activation ->
// routed session -> spoken answer.
//
//   voice-wake-smoke --force                 # real mic: say "Hey Jarvis", pause, then your request
//   voice-wake-smoke --force --wav <file>    # feed an audio file as the mic (no operator needed)
//   voice-wake-smoke --force --once          # stop after the first session
//   --mode premium                           # route the activated session to OpenAI Realtime (needs key)
//
// `--force` sets JARVIS_WAKE_WORD_ENABLED=true for THIS run only (the config
// default is off; enabling it for real is the operator's explicit act).
// Scripts/ root because it spawns ffmpeg/ffplay.

import { spawn, type ChildProcess } from "node:child_process";

import { loadVoiceLiveConfig } from "../src/lib/voice/live/config";
import type { VoiceLiveAudioSink } from "../src/lib/voice/live/contract";
import { createVoiceLiveProvidersFromConfig } from "../src/lib/voice/live/local-engines";
import { VoiceLiveOrchestrator } from "../src/lib/voice/live/orchestrator";
import type { VoiceLiveMode } from "../src/lib/voice/live/router";
import {
  WakeActivationLoop,
  createFfmpegMicSource,
  createFileMicSource,
} from "../src/lib/voice/live/wake-activation";
import { createOpenWakeWordProvider } from "../src/lib/voice/live/wake-word-openwakeword";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

class FfplaySink implements VoiceLiveAudioSink {
  private proc: ChildProcess | null = null;
  write(pcm16: Uint8Array, sr: number): void {
    if (!this.proc) {
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
      // -autoexit closes the reader when drained; a late write must not crash the loop.
      p.stdin!.on("error", () => {});
      p.on("exit", () => {
        if (this.proc === p) this.proc = null;
      });
      this.proc = p;
    }
    if (this.proc.stdin?.writable) this.proc.stdin.write(Buffer.from(pcm16));
  }
  flush(): void {
    this.proc?.stdin?.end();
    this.proc = null;
  }
  cancel(): void {
    this.proc?.kill("SIGKILL");
    this.proc = null;
  }
}

const log = (kind: string, payload: unknown) =>
  console.log(
    `[${kind}] ${typeof payload === "string" ? payload : JSON.stringify(payload)}`,
  );

async function main(): Promise<void> {
  const env: Record<string, string | undefined> = { ...process.env };
  if (has("--force")) env.JARVIS_WAKE_WORD_ENABLED = "true";
  if (val("--mode"))
    env.JARVIS_VOICE_LIVE_MODE = val("--mode") as VoiceLiveMode;
  const config = loadVoiceLiveConfig(env);
  const providers = createVoiceLiveProvidersFromConfig(config, env);
  const orchestrator = new VoiceLiveOrchestrator({
    config,
    providers,
    telemetry: (e) => log("telemetry", e),
  });
  const wake = createOpenWakeWordProvider({
    pythonCommand: env.JARVIS_STT_MLX_PYTHON_COMMAND ?? ".venv-mlx/bin/python",
    model: config.wake_phrase.replace(/\s+/g, "_"),
    onState: (s) => log("wake", `indicator: ${s}`),
  });
  const wav = val("--wav");
  const mic = wav
    ? createFileMicSource(wav)
    : createFfmpegMicSource(config.mic_device);
  const t0 = Date.now();
  const loop = new WakeActivationLoop({
    config,
    wake,
    orchestrator,
    mic,
    audio_sink: new FfplaySink(),
    // --wav no longer implies --once: the loop stops itself when the file
    // ends, so a clip with trailing silence exercises the re-arm path (the
    // phantom-wake regression) exactly like a live mic would.
    once: has("--once"),
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
    onEvent: (e) => log("loop", { ...e, t_ms: Date.now() - t0 }),
    onSessionEvent: (e) => {
      if (e.type === "transcript" && e.final)
        log("voice", `${e.role === "user" ? "heard" : "JARVIS"}: "${e.text}"`);
      else if (e.type === "assistant_audio_started")
        log("voice", `first audio after ${e.first_audio_latency_ms} ms`);
      else if (e.type === "tool_call")
        log(
          "voice",
          `TOOL CALL ${e.name} -> product path: Action Gateway -> Human Gate`,
        );
      else if (e.type === "error")
        log("voice", `ERROR ${e.error_class}: ${e.message}`);
    },
  });
  log("config", {
    wake_enabled: config.wake_word_enabled,
    phrase: config.wake_phrase,
    mode: config.mode,
    source: wav ?? config.mic_device,
  });
  if (!wav)
    log("wake", 'say "Hey Jarvis", pause briefly, then speak your request');
  // ⌃C once = graceful stop (session, mic, detector). Twice = force exit, so a
  // hung teardown can never trap the operator in the loop.
  let interrupts = 0;
  process.on("SIGINT", () => {
    interrupts += 1;
    if (interrupts >= 2) process.exit(130);
    log("wake", "stopping (press ⌃C again to force)");
    void loop.stop().then(() => process.exit(0));
  });
  await loop.start();
  log("result", {
    ...loop.snapshot(),
    budget: orchestrator.budget.read(),
    total_ms: Date.now() - t0,
  });
}

main().catch((error) => {
  console.error(
    `[wake] FAILED: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
