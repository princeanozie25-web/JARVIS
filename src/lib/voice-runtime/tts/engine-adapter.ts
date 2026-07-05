import type {
  VoiceEngineHealth,
  VoiceSynthesisEngine,
} from "@/lib/voice/tts-engine";

import type { TtsProvider } from "./provider";
import type {
  TtsSynthesisOptions,
  TtsSynthesisRequest,
  TtsSynthesisResult,
} from "./types";

// E-011 — adapts the PTT runtime's local TtsProvider to the canonical shared
// engine layer (@/lib/voice/tts-engine), so the runtime-bridge obtains
// synthesis through the SAME failover mechanism as the demo-director chain
// instead of its own inline health-gate. This adapter is pure shape mapping:
// all live-voice policy (consent, autoplay blocking, barge-in) stays in the
// voice runtime, and no policy rides into the engine layer.

export function ttsProviderAsSynthesisEngine(
  provider: TtsProvider,
  options: TtsSynthesisOptions,
): VoiceSynthesisEngine<TtsSynthesisRequest, TtsSynthesisResult> {
  return {
    provider_id: provider.id,
    priority: 0,
    async health(): Promise<VoiceEngineHealth> {
      const checked = await provider.health();
      return {
        provider_id: provider.id,
        ok: checked.ok,
        degraded: checked.degraded,
        checked_at_ms: checked.checked_at_ms,
        metadata_only: true,
      };
    },
    synthesize(request: TtsSynthesisRequest): Promise<TtsSynthesisResult> {
      return provider.synthesize(request, options);
    },
  };
}
