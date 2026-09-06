// The live-voice ORCHESTRATOR: the one place a wake detector (or a push-to-talk
// key, or a UI button) asks for a voice session. It routes (router.ts), starts
// the chosen provider, books usage into a persisted budget window, emits
// frozen-contract telemetry for every decision / latency / interruption /
// failure, and falls back cloud -> local automatically without the caller
// noticing (the returned session is a facade over whichever engine is live).
//
// The detector never learns which engine answered — that is the §20 wake-word
// boundary: `activate()` is provider-agnostic by construction.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  assertVoiceTelemetrySafe,
  type VoiceTelemetryEvent,
} from "../../voice-runtime/telemetry";
import { loadVoiceLiveConfig, type VoiceLiveConfig } from "./config";
import type {
  VoiceLiveAudioSink,
  VoiceLiveEvent,
  VoiceLiveProvider,
  VoiceLiveSession,
  VoiceLiveSessionSnapshot,
  VoiceLiveStopReason,
  VoiceLiveToolSpec,
} from "./contract";
import {
  routeVoiceLive,
  voiceLiveRouteTelemetry,
  type VoiceLiveMode,
  type VoiceLiveRouteCandidate,
  type VoiceLiveRouteDecision,
} from "./router";

// ---- budget (metadata-only, per calendar month, survives restarts) ----------

export interface VoiceLiveBudgetRecord {
  readonly window: string;
  readonly usd: number;
  readonly sessions: number;
  readonly updated_at: string;
}

export class VoiceLiveBudgetTracker {
  private memory: VoiceLiveBudgetRecord | null = null;

  constructor(
    private readonly path: string | null,
    private readonly now: () => Date = () => new Date(),
  ) {}

  windowKey(): string {
    const d = this.now();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  read(): VoiceLiveBudgetRecord {
    const window = this.windowKey();
    let record = this.memory;
    if (!record && this.path && existsSync(this.path)) {
      try {
        const parsed = JSON.parse(
          readFileSync(this.path, "utf8"),
        ) as Partial<VoiceLiveBudgetRecord>;
        if (
          typeof parsed.window === "string" &&
          typeof parsed.usd === "number"
        ) {
          record = {
            window: parsed.window,
            usd: parsed.usd,
            sessions: typeof parsed.sessions === "number" ? parsed.sessions : 0,
            updated_at:
              typeof parsed.updated_at === "string" ? parsed.updated_at : "",
          };
        }
      } catch {
        record = null; // unreadable file => start a fresh window, never crash voice
      }
    }
    if (!record || record.window !== window) {
      record = {
        window,
        usd: 0,
        sessions: 0,
        updated_at: this.now().toISOString(),
      };
    }
    this.memory = record;
    return record;
  }

  add(usd: number, sessions = 0): VoiceLiveBudgetRecord {
    const current = this.read();
    const next: VoiceLiveBudgetRecord = {
      window: current.window,
      usd: Math.round((current.usd + Math.max(0, usd)) * 1e6) / 1e6,
      sessions: current.sessions + sessions,
      updated_at: this.now().toISOString(),
    };
    this.memory = next;
    if (this.path) {
      try {
        mkdirSync(dirname(this.path), { recursive: true });
        writeFileSync(this.path, JSON.stringify(next));
      } catch {
        // persistence is best-effort; the in-memory window still enforces the cap
      }
    }
    return next;
  }
}

// ---- orchestrator ---------------------------------------------------------------

export interface VoiceLiveOrchestratorOptions {
  readonly config?: VoiceLiveConfig;
  readonly providers: readonly VoiceLiveProvider[];
  readonly telemetry?: (event: VoiceTelemetryEvent) => void;
  // null => in-memory budget only (tests). Default: data/voice-live-budget.json
  readonly budgetPath?: string | null;
  readonly networkProbe?: () => Promise<boolean>;
  readonly now?: () => Date;
}

export interface VoiceLiveActivateOptions {
  readonly session_id: string;
  readonly audio_sink: VoiceLiveAudioSink;
  readonly on_event: (event: VoiceLiveEvent) => void;
  readonly tools?: readonly VoiceLiveToolSpec[];
  readonly instructions?: string;
  readonly mode?: VoiceLiveMode;
  readonly abort_signal?: AbortSignal;
}

export interface VoiceLiveActivation {
  readonly session: VoiceLiveSession;
  readonly decision: VoiceLiveRouteDecision;
  readonly provider_id: string;
}

export class VoiceLiveOrchestrator {
  readonly config: VoiceLiveConfig;
  readonly budget: VoiceLiveBudgetTracker;
  private readonly providers: readonly VoiceLiveProvider[];
  private readonly telemetry: (event: VoiceTelemetryEvent) => void;
  private readonly networkProbe: () => Promise<boolean>;
  private readonly now: () => Date;

  constructor(options: VoiceLiveOrchestratorOptions) {
    this.config = options.config ?? loadVoiceLiveConfig();
    this.providers = options.providers;
    this.telemetry = options.telemetry ?? (() => {});
    this.networkProbe = options.networkProbe ?? (async () => true);
    this.now = options.now ?? (() => new Date());
    this.budget = new VoiceLiveBudgetTracker(
      options.budgetPath === undefined
        ? "data/voice-live-budget.json"
        : options.budgetPath,
      this.now,
    );
  }

  provider(id: string): VoiceLiveProvider | undefined {
    return this.providers.find((p) => p.descriptor.provider_id === id);
  }

  async candidates(): Promise<VoiceLiveRouteCandidate[]> {
    return Promise.all(
      this.providers.map(async (p) => ({
        descriptor: p.descriptor,
        health: await p.health().catch(() => ({
          ok: false,
          degraded: false,
          error_class: "unavailable" as const,
          metadata_only: true as const,
        })),
      })),
    );
  }

  async route(
    sessionId: string,
    modeOverride?: VoiceLiveMode,
  ): Promise<VoiceLiveRouteDecision> {
    const [candidates, networkOk] = await Promise.all([
      this.candidates(),
      this.networkProbe(),
    ]);
    const budget = this.budget.read();
    const [premiumId, localId] = this.resolveRoles();
    const decision = routeVoiceLive({
      mode: modeOverride ?? this.config.mode,
      privacy_local_only: this.config.privacy_local_only,
      network_ok: networkOk,
      budget: {
        window_usd: budget.usd,
        warn_usd: this.config.budget_warn_usd,
        hard_usd: this.config.budget_hard_usd,
      },
      local_provider_id: localId,
      premium_provider_id: premiumId,
      candidates,
    });
    this.log(
      voiceLiveRouteTelemetry(decision, sessionId, this.now().toISOString()),
    );
    return decision;
  }

  // THE wake-word boundary.
  async activate(
    options: VoiceLiveActivateOptions,
  ): Promise<VoiceLiveActivation> {
    const decision = await this.route(options.session_id, options.mode);
    if (!decision.provider_id) {
      throw new Error(`no voice provider available (${decision.reason})`);
    }
    const facade = new SwitchableSession(options.session_id);
    const started = await this.startOn(
      decision.provider_id,
      options,
      facade,
      decision.reason !== "premium_selected",
    );
    facade.attach(started.session, started.provider_id);
    return { session: facade, decision, provider_id: started.provider_id };
  }

  private async startOn(
    providerId: string,
    options: VoiceLiveActivateOptions,
    facade: SwitchableSession,
    isLocal: boolean,
  ): Promise<{ session: VoiceLiveSession; provider_id: string }> {
    const provider = this.provider(providerId);
    if (!provider) throw new Error(`provider ${providerId} not registered`);
    const sessionId = options.session_id;
    const startedAt = this.now().getTime();
    let fellBack = false;

    const onEvent = (event: VoiceLiveEvent): void => {
      // The caller sees every event first, in order, from whichever engine is
      // live — bookkeeping and any fallback happen after the forward.
      options.on_event(event);
      const ts = this.now().toISOString();
      switch (event.type) {
        case "session_started":
          this.budget.add(0, 1);
          this.log({
            event_type: "voice_live.session_started",
            session_id: sessionId,
            provider_id: providerId,
            redaction_status: "metadata_only",
            timestamp: ts,
          });
          break;
        case "assistant_audio_started":
          this.log({
            event_type: "voice_live.first_audio",
            session_id: sessionId,
            provider_id: providerId,
            latency_ms: event.first_audio_latency_ms,
            redaction_status: "metadata_only",
            timestamp: ts,
          });
          break;
        case "interrupted":
          this.log({
            event_type: "voice_live.interrupted",
            session_id: sessionId,
            provider_id: providerId,
            cancellation_reason: "barge_in",
            duration_ms: event.audio_played_ms,
            redaction_status: "metadata_only",
            timestamp: ts,
          });
          break;
        case "tool_call":
          this.log({
            event_type: "voice_live.tool_call",
            session_id: sessionId,
            provider_id: providerId,
            redaction_status: "metadata_only",
            timestamp: ts,
          });
          break;
        case "usage":
          this.budget.add(event.usage.estimated_usd);
          break;
        case "error": {
          this.log({
            event_type: "voice_live.error",
            session_id: sessionId,
            provider_id: providerId,
            error_class: event.error_class,
            degraded: true,
            redaction_status: "metadata_only",
            timestamp: ts,
          });
          const transport =
            event.error_class === "network_error" ||
            event.error_class === "provider_error";
          if (!isLocal && transport && !fellBack) {
            fellBack = true;
            void this.fallbackToLocal(options, facade, providerId);
          }
          break;
        }
        case "session_ended":
          this.log({
            event_type: "voice_live.session_ended",
            session_id: sessionId,
            provider_id: providerId,
            duration_ms: Math.max(0, this.now().getTime() - startedAt),
            cancellation_reason:
              event.reason === "fallback" ? "provider_unavailable" : undefined,
            redaction_status: "metadata_only",
            timestamp: ts,
          });
          break;
        default:
          break;
      }
    };

    const session = await provider.startSession({
      session_id: sessionId,
      instructions: options.instructions,
      tools: options.tools,
      audio_sink: options.audio_sink,
      on_event: onEvent,
      abort_signal: options.abort_signal,
    });
    return { session, provider_id: providerId };
  }

  private async fallbackToLocal(
    options: VoiceLiveActivateOptions,
    facade: SwitchableSession,
    fromProviderId: string,
  ): Promise<void> {
    const [, localId] = this.resolveRoles();
    const ts = this.now().toISOString();
    try {
      await facade.current?.stop("fallback");
      const started = await this.startOn(localId, options, facade, true);
      facade.attach(started.session, started.provider_id);
      this.log({
        event_type: "voice_live.fallback",
        session_id: options.session_id,
        provider_id: localId,
        degraded: true,
        redaction_status: "metadata_only",
        timestamp: ts,
      });
    } catch {
      this.log({
        event_type: "voice_live.fallback_failed",
        session_id: options.session_id,
        provider_id: fromProviderId,
        degraded: true,
        error_class: "unavailable",
        redaction_status: "metadata_only",
        timestamp: ts,
      });
    }
  }

  private resolveRoles(): [premium: string, local: string] {
    const order = this.config.fallback_order;
    const cloud = this.providers.find(
      (p) => p.descriptor.privacy_class === "cloud_audio",
    );
    const local = this.providers.find(
      (p) => p.descriptor.privacy_class === "local_audio",
    );
    const premiumId =
      order.find((id) => id === cloud?.descriptor.provider_id) ??
      cloud?.descriptor.provider_id ??
      "";
    const localId =
      order.find((id) => id === local?.descriptor.provider_id) ??
      local?.descriptor.provider_id ??
      "";
    return [premiumId, localId];
  }

  private log(event: VoiceTelemetryEvent): void {
    try {
      this.telemetry(assertVoiceTelemetrySafe(event));
    } catch {
      // a malformed telemetry event must never break a voice session
    }
  }
}

// A session handle whose engine can change underneath (cloud -> local
// fallback) while the caller keeps one object. Metadata-only like the rest.
class SwitchableSession implements VoiceLiveSession {
  readonly session_id: string;
  current: VoiceLiveSession | null = null;
  private providerId = "";
  private switches = 0;

  constructor(sessionId: string) {
    this.session_id = sessionId;
  }

  get provider_id(): string {
    return this.providerId;
  }

  attach(session: VoiceLiveSession, providerId: string): void {
    if (this.current) this.switches += 1;
    this.current = session;
    this.providerId = providerId;
  }

  inputSampleRateHz(): number {
    return this.current?.inputSampleRateHz() ?? 24_000;
  }
  ingestAudio(pcm16: Uint8Array): void {
    this.current?.ingestAudio(pcm16);
  }
  commitAudio(): void {
    this.current?.commitAudio();
  }
  async interrupt(): Promise<void> {
    await this.current?.interrupt();
  }
  submitToolResult(callId: string, outputJson: string): void {
    this.current?.submitToolResult(callId, outputJson);
  }
  mute(): void {
    this.current?.mute();
  }
  unmute(): void {
    this.current?.unmute();
  }
  async stop(reason: VoiceLiveStopReason): Promise<void> {
    await this.current?.stop(reason);
  }
  snapshot(): VoiceLiveSessionSnapshot {
    const inner = this.current?.snapshot();
    if (!inner) {
      return {
        session_id: this.session_id,
        provider_id: this.providerId,
        state: "closed",
        assistant_speaking: false,
        muted: false,
        interruptions: 0,
        tool_calls: 0,
        responses: 0,
        started_at_ms: 0,
        ended_at_ms: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          input_text_tokens: 0,
          input_audio_tokens: 0,
          cached_input_tokens: 0,
          output_text_tokens: 0,
          output_audio_tokens: 0,
          estimated_usd: 0,
        },
        metadata_only: true,
      };
    }
    return { ...inner, provider_id: this.providerId };
  }
  get fallbacks(): number {
    return this.switches;
  }
}
