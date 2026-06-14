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

export const DEMO_NARRATION_PROVIDER_IDS = [
  "chatterbox-tts-server",
  "kokoro",
  "existing-local-fallback",
] as const;

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

export async function selectNarrationProvider(
  providers: readonly DemoNarrationProvider[] = defaultDemoNarrationProviders(),
  options: NarrationTelemetryOptions = {},
): Promise<{
  provider: DemoNarrationProvider;
  health: DemoNarrationProviderHealth[];
}> {
  const now = options.now ?? (() => Date.now());
  const ordered = [...providers].sort(
    (left, right) => left.priority - right.priority,
  );
  const health: DemoNarrationProviderHealth[] = [];
  let position = 0;
  for (const provider of ordered) {
    const checked = await provider.health();
    health.push(checked);
    if (checked.ok) {
      options.telemetry?.recordSelected({
        provider_id: provider.provider_id,
        chain_position: position,
        occurred_at_ms: now(),
      });
      return { provider, health };
    }
    const next = ordered[position + 1];
    if (next) {
      options.telemetry?.recordFailover({
        from_provider_id: provider.provider_id,
        to_provider_id: next.provider_id,
        reason: "health_probe_failed",
        chain_position: position,
        occurred_at_ms: now(),
      });
    }
    position += 1;
  }

  const fallback = ordered[ordered.length - 1];
  if (!fallback) {
    throw new Error("No narration providers configured.");
  }
  options.telemetry?.recordSelected({
    provider_id: fallback.provider_id,
    chain_position: ordered.length - 1,
    occurred_at_ms: now(),
  });
  return { provider: fallback, health };
}

export async function prepareDemoNarration(input: {
  script: DemoScript;
  providers?: readonly DemoNarrationProvider[];
  telemetry?: NarrationTelemetrySink;
  now?: () => number;
}): Promise<DemoNarrationTrack> {
  const providers = input.providers ?? defaultDemoNarrationProviders();
  const now = input.now ?? (() => Date.now());
  const lines = buildNarrationLines(input.script);
  const ordered = [...providers].sort(
    (left, right) => left.priority - right.priority,
  );
  const provider_health: DemoNarrationProviderHealth[] = [];

  const recordFailover = (
    fromProvider: DemoNarrationProvider,
    position: number,
    reason: "health_probe_failed" | "synth_error",
  ): void => {
    const next = ordered[position + 1];
    if (next) {
      input.telemetry?.recordFailover({
        from_provider_id: fromProvider.provider_id,
        to_provider_id: next.provider_id,
        reason,
        chain_position: position,
        occurred_at_ms: now(),
      });
    }
  };

  let position = 0;
  for (const provider of ordered) {
    const checked = await provider.health();
    provider_health.push(checked);
    if (!checked.ok) {
      recordFailover(provider, position, "health_probe_failed");
      position += 1;
      continue;
    }

    try {
      const audio_cues: DemoNarrationAudioCue[] = [];
      if (provider.synthesize) {
        for (const lineItem of lines) {
          audio_cues.push(await provider.synthesize(lineItem));
        }
      }
      input.telemetry?.recordSelected({
        provider_id: provider.provider_id,
        chain_position: position,
        occurred_at_ms: now(),
      });
      return narrationTrack({
        script: input.script,
        provider,
        provider_health,
        lines,
        audio_cues,
      });
    } catch {
      recordFailover(provider, position, "synth_error");
      position += 1;
      continue;
    }
  }

  const fallback = ordered[ordered.length - 1];
  if (!fallback) {
    throw new Error("No narration providers configured.");
  }
  input.telemetry?.recordSelected({
    provider_id: fallback.provider_id,
    chain_position: ordered.length - 1,
    occurred_at_ms: now(),
  });
  return narrationTrack({
    script: input.script,
    provider: fallback,
    provider_health,
    lines,
    audio_cues: [],
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
    unavailableProvider("chatterbox-tts-server", 0, now),
    unavailableProvider("kokoro", 1, now),
    createExistingLocalFallbackNarrationProvider({ now }),
  ];
}

export function createExistingLocalFallbackNarrationProvider(
  input: { now?: () => number } = {},
): DemoNarrationProvider {
  const now = input.now ?? (() => Date.now());
  return {
    provider_id: "existing-local-fallback",
    priority: 2,
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
