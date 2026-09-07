// Phase 25G (G4, E-055) — sidecar supervisor for the packaged app.
//
// Owns ONE optional child: the mlx-audio TTS/STT server, started from the
// operator-configured venv python when its loopback port is not answering.
// Ollama is observed only (Homebrew owns it). Restart with backoff, bounded;
// after the cap the supervisor stops trying and reports "exhausted" so the
// bootstrap projection can tell the operator what to do. Loopback only; the
// child's stdio is discarded; nothing is installed.
import { z } from "zod";

export const SUPERVISOR_STATES = [
  "idle",
  "external",
  "starting",
  "running",
  "backoff",
  "exhausted",
  "disabled",
] as const;
export type SupervisorState = (typeof SUPERVISOR_STATES)[number];

export const SidecarSupervisorSnapshotSchema = z.strictObject({
  sidecar_id: z.literal("mlx-audio"),
  state: z.enum(SUPERVISOR_STATES),
  managed: z.boolean(),
  restarts: z.number().int().nonnegative(),
  last_error: z.string().max(240).nullable(),
  observed_at: z.string(),
  metadata_only: z.literal(true),
});
export type SidecarSupervisorSnapshot = z.infer<
  typeof SidecarSupervisorSnapshotSchema
>;

export interface SupervisedChild {
  readonly pid: number | null;
  kill(): void;
  onExit(cb: (code: number | null) => void): void;
}

export interface SupervisorAdapters {
  reachable(): Promise<boolean>;
  spawn(): SupervisedChild;
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface SupervisorOptions {
  adapters: SupervisorAdapters;
  // null = not configured → "disabled" (operator starts it by hand).
  pythonCommand: string | null;
  maxRestarts?: number;
  baseBackoffMs?: number;
  startupTimeoutMs?: number;
}

export class MlxAudioSupervisor {
  private state: SupervisorState = "idle";
  private child: SupervisedChild | null = null;
  private restarts = 0;
  private lastError: string | null = null;
  private stopping = false;
  private ensuring: Promise<SidecarSupervisorSnapshot> | null = null;
  private readonly maxRestarts: number;
  private readonly baseBackoffMs: number;
  private readonly startupTimeoutMs: number;

  constructor(private readonly options: SupervisorOptions) {
    this.maxRestarts = options.maxRestarts ?? 5;
    this.baseBackoffMs = options.baseBackoffMs ?? 2000;
    this.startupTimeoutMs = options.startupTimeoutMs ?? 30_000;
    if (!options.pythonCommand) this.state = "disabled";
  }

  snapshot(): SidecarSupervisorSnapshot {
    return SidecarSupervisorSnapshotSchema.parse({
      sidecar_id: "mlx-audio",
      state: this.state,
      managed: this.child !== null,
      restarts: this.restarts,
      last_error: this.lastError,
      observed_at: new Date(this.options.adapters.now()).toISOString(),
      metadata_only: true,
    });
  }

  /** Idempotent: make the sidecar reachable if we are allowed to. */
  ensure(): Promise<SidecarSupervisorSnapshot> {
    if (this.ensuring) return this.ensuring;
    this.ensuring = this.ensureOnce().finally(() => {
      this.ensuring = null;
    });
    return this.ensuring;
  }

  private async ensureOnce(): Promise<SidecarSupervisorSnapshot> {
    const a = this.options.adapters;
    if (await a.reachable()) {
      if (this.child === null) this.state = "external";
      else this.state = "running";
      return this.snapshot();
    }
    if (
      this.state === "disabled" ||
      this.state === "exhausted" ||
      this.stopping
    )
      return this.snapshot();
    if (this.restarts >= this.maxRestarts) {
      this.state = "exhausted";
      this.lastError = `gave up after ${this.restarts} restarts`;
      return this.snapshot();
    }
    if (this.child !== null) {
      // We spawned it and it is not answering (yet): wait, do not double-spawn.
      return this.snapshot();
    }
    this.state = "starting";
    try {
      const child = a.spawn();
      this.child = child;
      child.onExit((code) => {
        if (this.child !== child) return;
        this.child = null;
        if (this.stopping) return;
        this.restarts += 1;
        this.lastError = `exited with code ${code ?? "null"}`;
        this.state =
          this.restarts >= this.maxRestarts ? "exhausted" : "backoff";
        if (this.state === "backoff") {
          const delay = this.baseBackoffMs * 2 ** (this.restarts - 1);
          void a.sleep(delay).then(() => this.ensure());
        }
      });
    } catch (error) {
      this.child = null;
      this.restarts += 1;
      this.lastError =
        error instanceof Error ? error.message.slice(0, 240) : String(error);
      this.state = this.restarts >= this.maxRestarts ? "exhausted" : "backoff";
      return this.snapshot();
    }
    const deadline = a.now() + this.startupTimeoutMs;
    while (a.now() < deadline) {
      if (await a.reachable()) {
        this.state = "running";
        return this.snapshot();
      }
      if (this.child === null) break; // exited during startup; onExit scheduled a retry
      await a.sleep(500);
    }
    if (this.child !== null && this.state === "starting") {
      this.lastError = "started but not answering within the startup timeout";
      this.state = "backoff";
    }
    return this.snapshot();
  }

  stop(): void {
    this.stopping = true;
    this.child?.kill();
    this.child = null;
    this.state = "idle";
  }
}
