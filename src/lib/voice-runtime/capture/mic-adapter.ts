import { join } from "node:path";

import type { VoiceCancellationReason } from "../types";
import type { CaptureRuntimeConfig } from "./config";
import type { CaptureSupervisorSnapshot } from "./supervisor";

export type MicCaptureAdapterFailureReason =
  | "capture_already_active"
  | "capture_not_active"
  | "invalid_session"
  | "driver_error"
  | "timeout"
  | "cancelled";

export interface MicCaptureAdapterConfig {
  readonly temp_dir: string;
  readonly sample_rate_hz: number;
  readonly channel_count: number;
  readonly max_capture_ms: number;
  readonly metadata_only: true;
}

export interface MicCaptureDriverStartInput {
  readonly output_ref: string;
  readonly sample_rate_hz: number;
  readonly channel_count: number;
  readonly max_capture_ms: number;
  readonly metadata_only: true;
}

export interface MicCaptureDriverStopResult {
  readonly duration_ms?: number;
  readonly size_bytes: number;
  readonly degraded: boolean;
  readonly metadata_only: true;
}

export interface MicCaptureDriverHealth {
  readonly ok: boolean;
  readonly degraded: boolean;
  readonly error_class?: "unavailable" | "driver_error" | "unknown";
  readonly metadata_only: true;
}

export interface MicCaptureDriver {
  start(input: MicCaptureDriverStartInput): Promise<void>;
  stop(): Promise<MicCaptureDriverStopResult>;
  cancel(reason: VoiceCancellationReason): Promise<void>;
  health(): Promise<MicCaptureDriverHealth>;
}

export interface MicCaptureAdapterSnapshot {
  readonly mic_active: boolean;
  readonly session_id: string | null;
  readonly turn_id: string | null;
  readonly audio_ref: string | null;
  readonly started_at?: string;
  readonly stopped_at?: string;
  readonly cancellation_reason?: VoiceCancellationReason;
  readonly error_class?: MicCaptureAdapterFailureReason;
  readonly metadata_only: true;
}

export interface MicCaptureResultMetadata {
  readonly audio_ref: string;
  readonly duration_ms: number;
  readonly size_bytes: number;
  readonly sample_rate_hz: number;
  readonly channel_count: number;
  readonly degraded: boolean;
  readonly started_at: string;
  readonly stopped_at: string;
  readonly metadata_only: true;
}

export type MicCaptureAdapterResult =
  | {
      readonly ok: true;
      readonly result: MicCaptureResultMetadata;
      readonly snapshot: MicCaptureAdapterSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly result: null;
      readonly snapshot: MicCaptureAdapterSnapshot;
      readonly reasons: readonly MicCaptureAdapterFailureReason[];
      readonly metadata_only: true;
    };

export type MicCaptureAdapterStartResult =
  | {
      readonly ok: true;
      readonly snapshot: MicCaptureAdapterSnapshot;
      readonly reasons: readonly [];
      readonly metadata_only: true;
    }
  | {
      readonly ok: false;
      readonly snapshot: MicCaptureAdapterSnapshot;
      readonly reasons: readonly MicCaptureAdapterFailureReason[];
      readonly metadata_only: true;
    };

export interface MicCaptureAdapter {
  startCapture(
    session: CaptureSupervisorSnapshot,
  ): Promise<MicCaptureAdapterStartResult>;
  stopCapture(): Promise<MicCaptureAdapterResult>;
  cancelCapture(
    reason: VoiceCancellationReason,
  ): Promise<MicCaptureAdapterStartResult>;
  health(): Promise<MicCaptureDriverHealth & { readonly mic_active: boolean }>;
  snapshot(): MicCaptureAdapterSnapshot;
}

export interface LocalMicCaptureAdapterOptions {
  readonly config: MicCaptureAdapterConfig | CaptureRuntimeConfig;
  readonly driver: MicCaptureDriver;
  readonly now_ms?: () => number;
  readonly output_ref_factory?: (input: {
    readonly temp_dir: string;
    readonly session_id: string;
    readonly turn_id: string;
    readonly started_at_ms: number;
  }) => string;
}

interface ActiveCapture {
  readonly session_id: string;
  readonly turn_id: string;
  readonly output_ref: string;
  readonly started_at_ms: number;
}

export function createLocalMicCaptureAdapter(
  options: LocalMicCaptureAdapterOptions,
): MicCaptureAdapter {
  const nowMs = options.now_ms ?? (() => Date.now());
  const adapterConfig = normalizeAdapterConfig(options.config);
  let active: ActiveCapture | null = null;
  let snapshot: MicCaptureAdapterSnapshot = inactiveSnapshot();

  const copySnapshot = (): MicCaptureAdapterSnapshot => ({ ...snapshot });

  return {
    startCapture: async (session) => {
      if (active) return startFail(["capture_already_active"]);
      if (!isStartableSession(session)) return startFail(["invalid_session"]);

      const startedAtMs = nowMs();
      const outputRef = (options.output_ref_factory ?? defaultOutputRefFactory)(
        {
          temp_dir: adapterConfig.temp_dir,
          session_id: session.session_id,
          turn_id: session.turn_id,
          started_at_ms: startedAtMs,
        },
      );

      try {
        await options.driver.start({
          output_ref: outputRef,
          sample_rate_hz: adapterConfig.sample_rate_hz,
          channel_count: adapterConfig.channel_count,
          max_capture_ms: adapterConfig.max_capture_ms,
          metadata_only: true,
        });
      } catch {
        snapshot = {
          ...inactiveSnapshot(),
          error_class: "driver_error",
        };
        return startFail(["driver_error"]);
      }

      active = {
        session_id: session.session_id,
        turn_id: session.turn_id,
        output_ref: outputRef,
        started_at_ms: startedAtMs,
      };
      snapshot = {
        mic_active: true,
        session_id: active.session_id,
        turn_id: active.turn_id,
        audio_ref: active.output_ref,
        started_at: timestamp(startedAtMs),
        metadata_only: true,
      };
      return {
        ok: true,
        snapshot: copySnapshot(),
        reasons: [],
        metadata_only: true,
      };
    },
    stopCapture: async () => {
      if (!active) return resultFail(["capture_not_active"]);
      const capture = active;
      try {
        const stopResult = await options.driver.stop();
        const stoppedAtMs = nowMs();
        const durationMs =
          stopResult.duration_ms ??
          Math.max(0, stoppedAtMs - capture.started_at_ms);
        active = null;
        snapshot = {
          mic_active: false,
          session_id: capture.session_id,
          turn_id: capture.turn_id,
          audio_ref: capture.output_ref,
          started_at: timestamp(capture.started_at_ms),
          stopped_at: timestamp(stoppedAtMs),
          metadata_only: true,
        };
        return {
          ok: true,
          result: {
            audio_ref: capture.output_ref,
            duration_ms: durationMs,
            size_bytes: stopResult.size_bytes,
            sample_rate_hz: adapterConfig.sample_rate_hz,
            channel_count: adapterConfig.channel_count,
            degraded: stopResult.degraded,
            started_at: timestamp(capture.started_at_ms),
            stopped_at: timestamp(stoppedAtMs),
            metadata_only: true,
          },
          snapshot: copySnapshot(),
          reasons: [],
          metadata_only: true,
        };
      } catch {
        active = null;
        snapshot = {
          ...inactiveSnapshot(),
          error_class: "driver_error",
        };
        return resultFail(["driver_error"]);
      }
    },
    cancelCapture: async (reason) => {
      if (!active) return startFail(["capture_not_active"]);
      const capture = active;
      try {
        await options.driver.cancel(reason);
      } finally {
        active = null;
        snapshot = {
          mic_active: false,
          session_id: capture.session_id,
          turn_id: capture.turn_id,
          audio_ref: capture.output_ref,
          started_at: timestamp(capture.started_at_ms),
          stopped_at: timestamp(nowMs()),
          cancellation_reason: reason,
          error_class: reason === "timeout" ? "timeout" : "cancelled",
          metadata_only: true,
        };
      }
      return {
        ok: true,
        snapshot: copySnapshot(),
        reasons: [],
        metadata_only: true,
      };
    },
    health: async () => ({
      ...(await options.driver.health()),
      mic_active: active !== null,
    }),
    snapshot: copySnapshot,
  };

  function startFail(
    reasons: readonly MicCaptureAdapterFailureReason[],
  ): MicCaptureAdapterStartResult {
    return {
      ok: false,
      snapshot: copySnapshot(),
      reasons,
      metadata_only: true,
    };
  }

  function resultFail(
    reasons: readonly MicCaptureAdapterFailureReason[],
  ): MicCaptureAdapterResult {
    return {
      ok: false,
      result: null,
      snapshot: copySnapshot(),
      reasons,
      metadata_only: true,
    };
  }
}

function normalizeAdapterConfig(
  config: MicCaptureAdapterConfig | CaptureRuntimeConfig,
): MicCaptureAdapterConfig {
  return {
    temp_dir: "temp_dir" in config ? config.temp_dir : ".",
    sample_rate_hz: config.sample_rate_hz,
    channel_count: config.channel_count,
    max_capture_ms: config.max_capture_ms,
    metadata_only: true,
  };
}

function isStartableSession(
  session: CaptureSupervisorSnapshot,
): session is CaptureSupervisorSnapshot & {
  readonly session_id: string;
  readonly turn_id: string;
} {
  return (
    session.state === "capturing" &&
    typeof session.session_id === "string" &&
    session.session_id.length > 0 &&
    typeof session.turn_id === "string" &&
    session.turn_id.length > 0
  );
}

function inactiveSnapshot(): MicCaptureAdapterSnapshot {
  return {
    mic_active: false,
    session_id: null,
    turn_id: null,
    audio_ref: null,
    metadata_only: true,
  };
}

function defaultOutputRefFactory(input: {
  readonly temp_dir: string;
  readonly session_id: string;
  readonly turn_id: string;
  readonly started_at_ms: number;
}): string {
  return join(
    input.temp_dir,
    `${safeSegment(input.session_id)}-${safeSegment(input.turn_id)}-${input.started_at_ms}.wav`,
  );
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function timestamp(ms: number): string {
  return new Date(ms).toISOString();
}
