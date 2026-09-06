// Local wake-word detection with openWakeWord (the engine Phase 22 specified),
// as the frozen Phase 14 `WakeWordProvider` seam — plus `feed()`, because the
// activation loop owns the microphone and forks frames between the detector
// and the voice session. Detection is LOCAL ONLY (ONNX on this machine),
// never stores pre-wake audio, never touches a provider; it only reports a
// metadata-only detection result. Which engine answers afterwards is not this
// module's concern (§20).
//
// Lives in src/lib/voice/live (outside the frozen voice-runtime scan root),
// spawns `.venv-mlx/bin/python -c <helper>` like the E-039 STT seam does.

import { spawn } from "node:child_process";

import type { WakeWordProvider } from "../../voice-runtime/wake-word/provider";
import type {
  WakeWordConfidenceBand,
  WakeWordProviderDetectionResult,
  WakeWordProviderHealth,
  WakeWordProviderOptions,
} from "../../voice-runtime/wake-word/types";

export const OPENWAKEWORD_PROVIDER_ID = "openwakeword-local-onnx";
export const OPENWAKEWORD_SAMPLE_RATE_HZ = 16_000;
export const OPENWAKEWORD_FRAME_SAMPLES = 1280; // 80 ms @ 16 kHz, openWakeWord's native frame
export const OPENWAKEWORD_DEFAULT_MODEL = "hey_jarvis";

// stdin: raw s16le 16 kHz mono. stdout: one JSON line per event. No audio is
// ever written anywhere. Model name is matched by substring so "hey_jarvis"
// finds "hey_jarvis_v0.1" across openWakeWord releases.
export const OPENWAKEWORD_PYTHON_HELPER = String.raw`
import sys, json, time, os
import numpy as np
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
want = sys.argv[1].lower(); threshold = float(sys.argv[2]); cooldown = float(sys.argv[3])
from openwakeword.model import Model
try:
    model = Model(inference_framework="onnx")
except Exception:
    model = Model()
keys = [k for k in model.models.keys() if want in k.lower()]
if not keys:
    print(json.dumps({"error": "wake model not found", "want": want, "available": sorted(model.models.keys())}), flush=True); sys.exit(2)
key = keys[0]
print(json.dumps({"ready": True, "model": key}), flush=True)
frame_bytes = 1280 * 2
last = 0.0
buf = b""
while True:
    chunk = sys.stdin.buffer.read(frame_bytes)
    if not chunk:
        break
    buf += chunk
    while len(buf) >= frame_bytes:
        frame, buf = buf[:frame_bytes], buf[frame_bytes:]
        t0 = time.perf_counter()
        scores = model.predict(np.frombuffer(frame, dtype=np.int16))
        score = float(scores.get(key, 0.0))
        now = time.time()
        if score >= threshold and (now - last) >= cooldown:
            last = now
            print(json.dumps({"detected": True, "score": round(score, 3), "model": key, "latency_ms": round((time.perf_counter() - t0) * 1000, 1)}), flush=True)
`;

export interface DetectorHandle {
  write(frame: Uint8Array): void;
  onLine(callback: (line: string) => void): void;
  onExit(callback: (code: number | null) => void): void;
  kill(): void;
}

export type DetectorFactory = (args: {
  pythonCommand: string;
  model: string;
  threshold: number;
  cooldownMs: number;
}) => DetectorHandle;

export interface OpenWakeWordProviderOptions {
  readonly pythonCommand?: string;
  readonly model?: string;
  readonly threshold?: number;
  readonly cooldownMs?: number;
  readonly spawnDetector?: DetectorFactory;
  readonly nowMs?: () => number;
  // Visible standby/active indicator hook (Phase 22: visible_standby_indicator).
  readonly onState?: (state: "disarmed" | "standby" | "active") => void;
}

export interface OpenWakeWordProvider extends WakeWordProvider {
  feed(pcm16Mono16k: Uint8Array): void;
  isArmed(): boolean;
}

function defaultDetectorFactory(args: {
  pythonCommand: string;
  model: string;
  threshold: number;
  cooldownMs: number;
}): DetectorHandle {
  const proc = spawn(
    args.pythonCommand,
    [
      "-c",
      OPENWAKEWORD_PYTHON_HELPER,
      args.model,
      String(args.threshold),
      String(args.cooldownMs / 1000),
    ],
    { stdio: ["pipe", "pipe", "ignore"] },
  );
  let lineCb: ((line: string) => void) | null = null;
  let exitCb: ((code: number | null) => void) | null = null;
  let pending = "";
  proc.stdout!.on("data", (chunk: Buffer) => {
    pending += chunk.toString("utf8");
    let idx = pending.indexOf("\n");
    while (idx >= 0) {
      const line = pending.slice(0, idx).trim();
      pending = pending.slice(idx + 1);
      if (line) lineCb?.(line);
      idx = pending.indexOf("\n");
    }
  });
  proc.on("exit", (code) => exitCb?.(code));
  proc.stdin!.on("error", () => {});
  return {
    write: (frame) => {
      if (!proc.killed && proc.stdin && proc.stdin.writable)
        proc.stdin.write(Buffer.from(frame));
    },
    onLine: (cb) => {
      lineCb = cb;
    },
    onExit: (cb) => {
      exitCb = cb;
    },
    kill: () => {
      try {
        proc.stdin?.end();
        proc.kill("SIGKILL");
      } catch {
        // already gone
      }
    },
  };
}

function band(score: number): WakeWordConfidenceBand {
  return score >= 0.8 ? "high" : score >= 0.6 ? "medium" : "low";
}

export function createOpenWakeWordProvider(
  options: OpenWakeWordProviderOptions = {},
): OpenWakeWordProvider {
  const pythonCommand = options.pythonCommand ?? ".venv-mlx/bin/python";
  const model = options.model ?? OPENWAKEWORD_DEFAULT_MODEL;
  const threshold = options.threshold ?? 0.5;
  const cooldownMs = options.cooldownMs ?? 2000;
  const factory = options.spawnDetector ?? defaultDetectorFactory;
  const nowMs = options.nowMs ?? (() => Date.now());
  const setState = options.onState ?? (() => {});

  let detector: DetectorHandle | null = null;
  let ready = false;
  let failed: string | null = null;
  let waiter: {
    resolve: (r: WakeWordProviderDetectionResult) => void;
    reject: (e: Error) => void;
  } | null = null;
  let armedAt = 0;

  const health = (): WakeWordProviderHealth => ({
    provider_id: OPENWAKEWORD_PROVIDER_ID,
    ok: failed === null,
    degraded: detector !== null && !ready,
    checked_at_ms: nowMs(),
    ...(failed ? { error_class: "provider_error" as const } : {}),
    metadata_only: true,
  });

  const handleLine = (line: string): void => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return;
    }
    if (msg.ready === true) {
      ready = true;
      setState("standby");
      return;
    }
    if (typeof msg.error === "string") {
      failed = msg.error;
      waiter?.reject(new Error(`openwakeword: ${msg.error}`));
      waiter = null;
      return;
    }
    if (msg.detected === true) {
      const score = typeof msg.score === "number" ? msg.score : 0;
      const result: WakeWordProviderDetectionResult = {
        provider_id: OPENWAKEWORD_PROVIDER_ID,
        wake_detected: true,
        confidence_band: band(score),
        latency_ms: Math.max(
          0,
          typeof msg.latency_ms === "number" ? Math.round(msg.latency_ms) : 0,
        ),
        degraded: false,
        metadata_only: true,
      };
      if (waiter) {
        const w = waiter;
        waiter = null;
        setState("active");
        w.resolve(result);
      }
    }
  };

  const disarm = async (): Promise<WakeWordProviderHealth> => {
    // Detach first so the detector's exit callback (which fires synchronously
    // on kill) sees `detector !== d` and does not double-handle the waiter.
    const d = detector;
    detector = null;
    ready = false;
    waiter?.reject(new Error("wake word disarmed"));
    waiter = null;
    d?.kill();
    setState("disarmed");
    return health();
  };

  return {
    id: OPENWAKEWORD_PROVIDER_ID,
    kind: "local",
    metadata_only: true,
    isArmed: () => detector !== null,
    feed: (frame) => {
      if (detector && frame.byteLength > 0) detector.write(frame);
    },
    arm: async () => {
      if (detector) return health();
      failed = null;
      armedAt = nowMs();
      const d = factory({ pythonCommand, model, threshold, cooldownMs });
      detector = d;
      d.onLine(handleLine);
      d.onExit((code) => {
        if (detector === d) {
          detector = null;
          ready = false;
          if (code !== 0 && code !== null) failed = `detector exited ${code}`;
          waiter?.reject(new Error(failed ?? "detector exited"));
          waiter = null;
          setState("disarmed");
        }
      });
      return health();
    },
    disarm,
    detect: (opts?: WakeWordProviderOptions) =>
      new Promise<WakeWordProviderDetectionResult>((resolve, reject) => {
        if (!detector) {
          reject(new Error("wake word not armed"));
          return;
        }
        if (waiter) {
          reject(new Error("a detect() is already pending"));
          return;
        }
        waiter = { resolve, reject };
        const o = opts as
          | { abort_signal?: AbortSignal; timeout_ms?: number }
          | undefined;
        o?.abort_signal?.addEventListener(
          "abort",
          () => {
            if (waiter?.resolve === resolve) {
              waiter = null;
              reject(new Error("wake detect aborted"));
            }
          },
          { once: true },
        );
        if (o?.timeout_ms && o.timeout_ms > 0) {
          setTimeout(() => {
            if (waiter?.resolve === resolve) {
              waiter = null;
              resolve({
                provider_id: OPENWAKEWORD_PROVIDER_ID,
                wake_detected: false,
                confidence_band: "low",
                latency_ms: Math.max(0, nowMs() - armedAt),
                degraded: false,
                metadata_only: true,
              });
            }
          }, o.timeout_ms);
        }
      }),
    cancel: async () => {
      waiter?.reject(new Error("wake detect cancelled"));
      waiter = null;
    },
    health: async () => health(),
  };
}
