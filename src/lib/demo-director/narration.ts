import {
  CANONICAL_TTS_ENGINE_IDS,
  CANONICAL_TTS_ENGINE_PRIORITIES,
  selectVoiceEngine,
  synthesizeOverEngineChain,
} from "@/lib/voice/tts-engine";

import type {
  DemoAudience,
  DemoCue,
  DemoScript,
  DemoSegment,
} from "./contracts";
import type { NarrationTelemetrySink } from "./failover-telemetry";

// 23G-3: optional metadata-only audit of chain advances + final selection.
// Absent (default) = pure, no side effects; present = every advance emits.
export interface NarrationTelemetryOptions {
  readonly telemetry?: NarrationTelemetrySink;
  readonly now?: () => number;
}

// E-011: the id set and chain order are owned by the canonical engine
// registry (@/lib/voice/tts-engine); this alias keeps the demo-director's
// public surface unchanged.
export const DEMO_NARRATION_PROVIDER_IDS = CANONICAL_TTS_ENGINE_IDS;

export type DemoNarrationProviderId =
  (typeof DEMO_NARRATION_PROVIDER_IDS)[number];

export interface DemoNarrationProviderHealth {
  provider_id: DemoNarrationProviderId;
  ok: boolean;
  degraded: boolean;
  checked_at_ms: number;
  metadata_only: true;
}

export interface DemoNarrationAudioCue {
  audio_id: string;
  line_id: string;
  provider_id: DemoNarrationProviderId;
  duration_ms: number;
  mime_type: "audio/wav" | "audio/mpeg" | "audio/ogg";
  byte_length: number;
  local_ref: string;
  metadata_only: true;
  no_auto_play: true;
  no_voice_authority: true;
}

export interface DemoNarrationProvider {
  provider_id: DemoNarrationProviderId;
  priority: number;
  health(): Promise<DemoNarrationProviderHealth>;
  synthesize?(line: DemoNarrationLine): Promise<DemoNarrationAudioCue>;
}

export interface DemoNarrationLine {
  line_id: string;
  script_id: string;
  audience: DemoAudience;
  segment_id: string;
  cue_id: string | null;
  at_ms: number;
  text: string;
  content_class: "assistant_prose";
  metadata_only: true;
  read_only: true;
  no_voice_control: true;
}

export interface DemoNarrationTrack {
  track_id: string;
  script_id: string;
  audience: DemoAudience;
  provider_id: DemoNarrationProviderId;
  fallback_chain: DemoNarrationProviderId[];
  provider_health: DemoNarrationProviderHealth[];
  lines: DemoNarrationLine[];
  audio_cues: DemoNarrationAudioCue[];
  metadata_only: true;
  read_only: true;
  no_wake_word: true;
  no_conversation_mode: true;
  no_voice_authority: true;
  auto_play_enabled: false;
}

const AUDIENCE_OPENERS: Record<DemoAudience, string> = {
  recruiter:
    "JARVIS is creating a recruiter-ready proof: one command center, one governed pipeline, and one visible approval boundary.",
  technical:
    "This technical pass follows routing, auxiliary model slots, council synthesis, telemetry, and the approval lifecycle.",
  security:
    "This security pass shows the approval gate, governance boundaries, forbidden-edge detection, and the audit trail.",
  general:
    "A simple request enters JARVIS, travels through the pipeline, pauses for approval, and returns a visible result.",
};

export function buildNarrationLines(script: DemoScript): DemoNarrationLine[] {
  const lines: DemoNarrationLine[] = [
    line({
      script,
      segment: script.segments[0]!,
      cue: null,
      at_ms: 0,
      text: AUDIENCE_OPENERS[script.audience],
      suffix: "opener",
    }),
  ];

  let segmentStart = 0;
  for (const segment of script.segments) {
    lines.push(
      line({
        script,
        segment,
        cue: null,
        at_ms: segmentStart,
        text: segment.description,
        suffix: "segment",
      }),
    );
    for (const cueItem of segment.cues) {
      if (!cueItem.note) continue;
      lines.push(
        line({
          script,
          segment,
          cue: cueItem,
          at_ms: segmentStart + cueItem.at_ms,
          text: cueItem.note,
          suffix: cueItem.cue_id,
        }),
      );
    }
    segmentStart += segment.duration_ms;
  }

  return lines.sort((left, right) => left.at_ms - right.at_ms);
}

// E-011: selection + failover are delegated to the ONE canonical engine layer
// (@/lib/voice/tts-engine). The demo-director keeps only its policy wrapper:
// recording-only narration lines/cues/track flags. Behaviour (chain order,
// telemetry events, terminal-with-zero-cues on exhaustion) is the Phase 23
// drilled behaviour, unchanged — the mechanism merely moved.
export async function selectNarrationProvider(
  providers: readonly DemoNarrationProvider[] = defaultDemoNarrationProviders(),
  options: NarrationTelemetryOptions = {},
): Promise<{
  provider: DemoNarrationProvider;
  health: DemoNarrationProviderHealth[];
}> {
  if (providers.length === 0) {
    throw new Error("No narration providers configured.");
  }
  const selection = await selectVoiceEngine(providers, options);
  return { provider: selection.engine, health: selection.health };
}

export async function prepareDemoNarration(input: {
  script: DemoScript;
  providers?: readonly DemoNarrationProvider[];
  telemetry?: NarrationTelemetrySink;
  now?: () => number;
}): Promise<DemoNarrationTrack> {
  const providers = input.providers ?? defaultDemoNarrationProviders();
  if (providers.length === 0) {
    throw new Error("No narration providers configured.");
  }
  const lines = buildNarrationLines(input.script);
  const outcome = await synthesizeOverEngineChain<
    DemoNarrationLine,
    DemoNarrationAudioCue,
    DemoNarrationProvider
  >(providers, lines, { telemetry: input.telemetry, now: input.now });
  return narrationTrack({
    script: input.script,
    provider: outcome.engine,
    provider_health: outcome.health,
    lines,
    audio_cues: [...outcome.cues],
  });
}

function narrationTrack(input: {
  script: DemoScript;
  provider: DemoNarrationProvider;
  provider_health: DemoNarrationProviderHealth[];
  lines: DemoNarrationLine[];
  audio_cues: DemoNarrationAudioCue[];
}): DemoNarrationTrack {
  return {
    track_id: `demo-narration:${input.script.script_id}:${input.provider.provider_id}`,
    script_id: input.script.script_id,
    audience: input.script.audience,
    provider_id: input.provider.provider_id,
    fallback_chain: [...DEMO_NARRATION_PROVIDER_IDS],
    provider_health: input.provider_health,
    lines: input.lines,
    audio_cues: input.audio_cues,
    metadata_only: true,
    read_only: true,
    no_wake_word: true,
    no_conversation_mode: true,
    no_voice_authority: true,
    auto_play_enabled: false,
  };
}

export function defaultDemoNarrationProviders(
  now: () => number = () => Date.now(),
): DemoNarrationProvider[] {
  return [
    unavailableProvider(
      "chatterbox-tts-server",
      CANONICAL_TTS_ENGINE_PRIORITIES["chatterbox-tts-server"],
      now,
    ),
    unavailableProvider("kokoro", CANONICAL_TTS_ENGINE_PRIORITIES.kokoro, now),
    createExistingLocalFallbackNarrationProvider({ now }),
  ];
}

export function createExistingLocalFallbackNarrationProvider(
  input: { now?: () => number } = {},
): DemoNarrationProvider {
  const now = input.now ?? (() => Date.now());
  return {
    provider_id: "existing-local-fallback",
    priority: CANONICAL_TTS_ENGINE_PRIORITIES["existing-local-fallback"],
    async health() {
      return {
        provider_id: "existing-local-fallback",
        ok: true,
        degraded: true,
        checked_at_ms: now(),
        metadata_only: true,
      };
    },
    async synthesize(lineItem) {
      return {
        audio_id: `demo-audio:${lineItem.line_id}`,
        line_id: lineItem.line_id,
        provider_id: "existing-local-fallback",
        duration_ms: Math.max(900, lineItem.text.length * 42),
        mime_type: "audio/wav",
        byte_length: Math.max(128, lineItem.text.length * 8),
        local_ref: `memory:${lineItem.line_id}`,
        metadata_only: true,
        no_auto_play: true,
        no_voice_authority: true,
      };
    },
  };
}

function unavailableProvider(
  provider_id: DemoNarrationProviderId,
  priority: number,
  now: () => number,
): DemoNarrationProvider {
  return {
    provider_id,
    priority,
    async health() {
      return {
        provider_id,
        ok: false,
        degraded: true,
        checked_at_ms: now(),
        metadata_only: true,
      };
    },
  };
}

function line(input: {
  script: DemoScript;
  segment: DemoSegment;
  cue: DemoCue | null;
  at_ms: number;
  text: string;
  suffix: string;
}): DemoNarrationLine {
  return {
    line_id: `demo-narration-line:${input.script.audience}:${slug(input.suffix)}`,
    script_id: input.script.script_id,
    audience: input.script.audience,
    segment_id: input.segment.segment_id,
    cue_id: input.cue?.cue_id ?? null,
    at_ms: input.at_ms,
    text: input.text,
    content_class: "assistant_prose",
    metadata_only: true,
    read_only: true,
    no_voice_control: true,
  };
}

function slug(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
