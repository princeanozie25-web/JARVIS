import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { applyMigrations } from "../../src/lib/db/schema";
import { insertTelemetryEvent } from "../../src/lib/db/telemetry";
import type { TelemetryEvent } from "../../src/lib/telemetry/types";
import {
  createVoiceEngineFailoverTelemetrySink,
  findForbiddenAuditField,
} from "../../src/lib/voice/tts-engine";
import { createPlaybackQueue } from "../../src/lib/voice-runtime/playback";
import { createVoiceRuntimeBridge } from "../../src/lib/voice-runtime/runtime-bridge";
import { createFakeSttProvider } from "../../src/lib/voice-runtime/stt/fake-provider";
import {
  createFakeTtsProvider,
  type FakeTtsProviderMode,
} from "../../src/lib/voice-runtime/tts/fake-provider";

// E-012 (Phase 25C) — the LIVE PTT path gets the real fallback chain and a
// persisted, metadata-only failover audit through the E-011 layer: the same
// health-probe -> next engine -> terminal -> audit pattern the demo-director
// chain has had since 23G-3. Drilled with fakes; persistence proven against an
// in-memory sqlite via the real insertTelemetryEvent.

function tts(id: string, mode: FakeTtsProviderMode) {
  return createFakeTtsProvider({
    mode,
    config: {
      provider_id: id,
      provider_kind: "local",
      voice_id: `${id}-voice`,
      max_input_chars: 500,
      timeout_ms: 1_000,
      metadata_only: true,
    },
  });
}

function harness(
  primaryMode: FakeTtsProviderMode,
  fallbackModes: FakeTtsProviderMode[],
) {
  const db = new Database(":memory:");
  applyMigrations(db);
  const recorded: TelemetryEvent[] = [];
  const sink = createVoiceEngineFailoverTelemetrySink({
    sessionId: "live-1",
    recordEvent: (event) => {
      recorded.push(event);
      insertTelemetryEvent(db, event);
    },
  });
  const fallbacks = fallbackModes.map((mode, i) =>
    tts(`fallback-${i + 1}`, mode),
  );
  const bridge = createVoiceRuntimeBridge({
    stt_provider: createFakeSttProvider(),
    tts_provider: tts("primary", primaryMode),
    fallback_tts_providers: fallbacks,
    failover_telemetry: sink,
    playback_queue: createPlaybackQueue({
      max_queue_depth: 4,
      allow_sensitive_content: false,
      metadata_only: true,
    }),
    now_ms: () => 5_000,
  });
  const speak = () =>
    bridge.createVoicePlaybackRequest({
      request_id: "req-1",
      session_id: "live-1",
      turn_id: "turn-1",
      text: "The build is green.",
      content_class: "assistant_prose",
      metadata_only: true,
    } as Parameters<typeof bridge.createVoicePlaybackRequest>[0]);
  const rows = () =>
    db
      .prepare(
        "SELECT event_type, tool_name, error_class, notes FROM telemetry_events ORDER BY rowid",
      )
      .all() as {
      event_type: string;
      tool_name: string | null;
      error_class: string | null;
      notes: string | null;
    }[];
  return { bridge, speak, recorded, rows };
}

describe("E-012 — live chain fails over to the injected fallback and audits it", () => {
  it("primary unhealthy -> fallback synthesizes; failover + selected events persisted, metadata only", async () => {
    const h = harness("unavailable", ["healthy"]);
    const result = await h.speak();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.provider_id).toBe("fallback-1");
    expect(h.recorded.map((e) => e.event_type)).toEqual([
      "voice_provider_failover",
      "voice_provider_selected",
    ]);
    const [failover, selected] = h.rows();
    expect(failover).toMatchObject({
      event_type: "voice_provider_failover",
      tool_name: "primary",
      error_class: "health_probe_failed",
    });
    expect(failover!.notes).toContain("to=fallback-1");
    expect(failover!.notes).toContain("path=live");
    expect(selected).toMatchObject({
      event_type: "voice_provider_selected",
      tool_name: "fallback-1",
    });
    // I2: nothing content-like rides the audit
    for (const e of h.recorded) {
      expect(
        findForbiddenAuditField(e as unknown as Record<string, unknown>),
      ).toBeNull();
      expect(JSON.stringify(e)).not.toContain("The build is green");
    }
  });

  it("primary healthy -> no failover, one selected event; fallbacks never probed", async () => {
    const h = harness("healthy", ["healthy"]);
    const result = await h.speak();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.provider_id).toBe("primary");
    expect(h.recorded.map((e) => e.event_type)).toEqual([
      "voice_provider_selected",
    ]);
  });

  it("every engine down -> exhausted, tts_unavailable, the audit shows the walk", async () => {
    const h = harness("unavailable", ["unavailable", "unavailable"]);
    const result = await h.speak();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons).toContain("tts_unavailable");
    // Two hops, then the E-011 chain records the TERMINAL engine as selected —
    // a degraded chain still has a designated floor (documented behaviour).
    expect(h.recorded.map((e) => e.event_type)).toEqual([
      "voice_provider_failover",
      "voice_provider_failover",
      "voice_provider_selected",
    ]);
    const rows = h.rows();
    expect(
      rows.slice(0, 2).map((r) => r.notes?.match(/to=(\S+)/)?.[1]),
    ).toEqual(["fallback-1", "fallback-2"]);
    expect(rows[2]).toMatchObject({
      event_type: "voice_provider_selected",
      tool_name: "fallback-2",
    });
  });

  it("no fallbacks and no sink behaves exactly as before (single engine, silent)", async () => {
    const bridge = createVoiceRuntimeBridge({
      stt_provider: createFakeSttProvider(),
      tts_provider: tts("primary", "healthy"),
      playback_queue: createPlaybackQueue({
        max_queue_depth: 4,
        allow_sensitive_content: false,
        metadata_only: true,
      }),
      now_ms: () => 1,
    });
    const result = await bridge.createVoicePlaybackRequest({
      request_id: "r",
      session_id: "s",
      turn_id: "t",
      text: "hello",
      content_class: "assistant_prose",
      metadata_only: true,
    } as Parameters<typeof bridge.createVoicePlaybackRequest>[0]);
    expect(result.ok).toBe(true);
  });
});

describe("E-012 — the audit sink is metadata-only and never fatal", () => {
  it("refuses an event carrying a forbidden field and reports instead of throwing", () => {
    const errors: unknown[] = [];
    const sink = createVoiceEngineFailoverTelemetrySink({
      recordEvent: () => {
        throw new Error("db closed");
      },
      onError: (e) => errors.push(e),
    });
    sink.recordSelected({
      provider_id: "p",
      chain_position: 0,
      occurred_at_ms: 1,
    });
    expect(errors).toHaveLength(1);
    expect(findForbiddenAuditField({ event_type: "x", text: "raw" })).toBe(
      "text",
    );
    expect(
      findForbiddenAuditField({ event_type: "x", tool_name: "p" }),
    ).toBeNull();
  });
});
