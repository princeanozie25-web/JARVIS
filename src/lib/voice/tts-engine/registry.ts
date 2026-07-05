// E-011 — the canonical TTS engine registry: the real engines, registered
// once, in the ONE drilled chain order (Phase 23G / E-010):
//   p0 chatterbox-tts-server  (local HTTP sidecar)
//   p1 kokoro                 (local HTTP sidecar)
//   p2 existing-local-fallback (Piper — the Phase 23 drilled terminal slot,
//      config/voice/piper-fallback.yaml + JARVIS_PIPER_* env overrides)
//
// The engine IMPLEMENTATIONS live with their runtimes and are shared already:
// the Piper core is src/lib/voice-runtime/tts/piper-provider.ts (consumed by
// both the PTT runtime and the demo chain's terminal adapter); the HTTP
// sidecar adapters live in src/lib/demo-director/chatterbox.ts. What this
// registry owns is the canonical ID set, chain ORDER, and priorities — so no
// subsystem re-declares its own engine list.

export const CANONICAL_TTS_ENGINE_IDS = [
  "chatterbox-tts-server",
  "kokoro",
  "existing-local-fallback",
] as const;

export type CanonicalTtsEngineId = (typeof CANONICAL_TTS_ENGINE_IDS)[number];

export const CANONICAL_TTS_ENGINE_PRIORITIES: Record<
  CanonicalTtsEngineId,
  number
> = {
  "chatterbox-tts-server": 0,
  kokoro: 1,
  "existing-local-fallback": 2,
};

// The drilled terminal slot id (Phase 23 kill-drill target). Kept as a named
// constant so the drill's id is never re-typed per subsystem (the id-trap
// caught in Phase 23: the PTT runtime's provider ids are DIFFERENT terminals).
export const CANONICAL_TERMINAL_ENGINE_ID =
  "existing-local-fallback" satisfies CanonicalTtsEngineId;
