// Phase 25G (G4, E-055) — node-side wiring for the packaged runtime.
//
// The only file in src/lib/packaging that touches the process: it binds the
// packaged doctor and the mlx-audio supervisor to real fs / fetch / spawn,
// as a process-wide singleton so the health route, the Self Model and the
// launcher share one supervisor (never two children). Dev mode (no
// JARVIS_PACKAGED) yields a "not_packaged" projection and spawns nothing.
import { spawn } from "node:child_process";
import { accessSync, constants, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import type { RuntimeDoctorObservation } from "../self-model/sources/runtime";
import {
  buildBootstrapProjection,
  type BootstrapProjection,
} from "./bootstrap-projection";
import {
  isPackaged,
  runPackagedDoctor,
  type PackagedDoctorReport,
} from "./install-root";
import { MlxAudioSupervisor, type SupervisedChild } from "./supervisor";

export interface PackagedRuntime {
  readonly packaged: boolean;
  readonly dataDir: string;
  readonly supervisor: MlxAudioSupervisor;
  doctor(): Promise<PackagedDoctorReport | null>;
  bootstrap(): Promise<BootstrapProjection>;
  doctorObservation(): Promise<RuntimeDoctorObservation | null>;
}

let singleton: { key: string; runtime: PackagedRuntime } | null = null;

async function reachable(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function createPackagedRuntime(
  options: {
    env?: Record<string, string | undefined>;
    cwd?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): PackagedRuntime {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 1500;
  const packaged = isPackaged(env);
  const dataDir = env.JARVIS_DATA_DIR?.trim()
    ? resolve(env.JARVIS_DATA_DIR.trim())
    : join(cwd, "data");
  const ollama = env.JARVIS_OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
  const mlx = env.JARVIS_MLX_AUDIO_URL?.trim() || "http://127.0.0.1:8004";
  const python =
    env.JARVIS_STT_MLX_PYTHON_COMMAND?.trim() ||
    env.JARVIS_MLX_PYTHON?.trim() ||
    null;
  const mlxPort = (() => {
    try {
      return new URL(mlx).port || "8004";
    } catch {
      return "8004";
    }
  })();

  const supervisor = new MlxAudioSupervisor({
    pythonCommand: packaged && python && existsSync(python) ? python : null,
    adapters: {
      reachable: () => reachable(fetchImpl, `${mlx}/v1/models`, timeoutMs),
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      spawn: (): SupervisedChild => {
        // Same command as scripts/voice/mlx-audio-server.sh (E-040): loopback only.
        const childEnv = {
          ...env,
          JARVIS_BIND_HOST: "127.0.0.1",
        } as unknown as NodeJS.ProcessEnv;
        // Own process group so the whole server (and anything it forks) can
        // be killed as a unit from a synchronous exit handler.
        const child = spawn(
          python as string,
          ["-m", "mlx_audio.server", "--host", "127.0.0.1", "--port", mlxPort],
          { stdio: "ignore", env: childEnv, detached: true },
        );
        const exitCbs: Array<(code: number | null) => void> = [];
        child.on("exit", (code) => exitCbs.forEach((cb) => cb(code)));
        child.on("error", () => exitCbs.forEach((cb) => cb(null)));
        return {
          pid: child.pid ?? null,
          kill: () => {
            // The voice server holds no durable state: SIGKILL the group.
            try {
              if (child.pid) process.kill(-child.pid, "SIGKILL");
              else child.kill("SIGKILL");
            } catch {
              try {
                child.kill("SIGKILL");
              } catch {
                /* already gone */
              }
            }
          },
          onExit: (cb) => exitCbs.push(cb),
        };
      },
    },
  });

  const doctor = async (): Promise<PackagedDoctorReport | null> => {
    if (!packaged) return null;
    return runPackagedDoctor({
      env,
      adapters: {
        fileExists: (rel) => existsSync(resolve(cwd, rel)),
        dataDirWritable: () => {
          try {
            mkdirSync(dataDir, { recursive: true });
            accessSync(dataDir, constants.W_OK);
            return true;
          } catch {
            return false;
          }
        },
        reachable: (url) => reachable(fetchImpl, url, timeoutMs),
        commandExists: (p) => existsSync(p),
      },
    });
  };

  const runtime: PackagedRuntime = {
    packaged,
    dataDir,
    supervisor,
    doctor,
    async bootstrap() {
      const [report, ollamaUp] = await Promise.all([
        doctor(),
        reachable(fetchImpl, `${ollama}/api/tags`, timeoutMs),
      ]);
      return buildBootstrapProjection({
        packaged,
        dataDir,
        doctor: report,
        ollamaReachable: ollamaUp,
        mlxAudio: packaged ? supervisor.snapshot() : null,
        now: new Date(),
      });
    },
    async doctorObservation() {
      const report = await doctor();
      if (!report) return null;
      return {
        verdict: report.verdict,
        blocking_failures: report.blocking_failures,
        warnings: report.warnings,
        skipped: 0,
        pending: 0,
        hardware: null,
      };
    },
  };
  return runtime;
}

let exitHookInstalled = false;

/** Process-wide instance keyed by the env that shapes it. */
export function getPackagedRuntime(
  env: Record<string, string | undefined> = process.env,
): PackagedRuntime {
  const key = [
    env.JARVIS_PACKAGED,
    env.JARVIS_DATA_DIR,
    env.JARVIS_MLX_AUDIO_URL,
    env.JARVIS_STT_MLX_PYTHON_COMMAND,
  ].join("|");
  if (singleton && singleton.key === key) return singleton.runtime;
  singleton = { key, runtime: createPackagedRuntime({ env }) };
  if (!exitHookInstalled) {
    // The managed voice sidecar must not outlive the server: when the shell
    // stops the server (or sidecar.js exits on parent death) the python
    // child is killed synchronously here. Never installed in dev (no spawn).
    exitHookInstalled = true;
    process.on("exit", () => singleton?.runtime.supervisor.stop());
  }
  return singleton.runtime;
}

/** Test seam. */
export function resetPackagedRuntime(): void {
  singleton?.runtime.supervisor.stop();
  singleton = null;
}
