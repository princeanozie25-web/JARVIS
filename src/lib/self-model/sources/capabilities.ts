// Self Model (E-050) — the CAPABILITY self graph.
//
// Built from the registries that already exist (tools, models, providers,
// the live-voice config, voice feature flags). A registration is a
// CONFIG-class claim: "I am configured to do X". Whether X works right now
// is the runtime source's business; how well it has worked is the
// experience source's. Reconciliation puts the three together.
import { approvalTierOf } from "../../canonical-policy";
import type { ReversibilityClass } from "../../tools/types";
import type { SafetyTag } from "../../router/types";
import type { VoiceRuntimeFeatureFlags } from "../../voice-runtime/feature-flags";
import { claim, evidence, type SelfClaim } from "../contracts";
import { scrubText } from "../redaction";

export interface CapabilityToolSummary {
  id: string;
  name: string;
  description: string;
  requiredSafetyTag: SafetyTag;
  reversibilityClass: ReversibilityClass;
}

export interface CapabilityModelSummary {
  id: string;
  provider: string;
  modelName: string;
  tier: string;
  capabilities: readonly string[];
  enabled: boolean;
}

export interface CapabilityVoiceSummary {
  mode: string;
  privacy_local_only: boolean;
  local_stt: string;
  local_tts: string;
  local_voice_id: string;
  local_brain_model: string;
  openai_realtime_enabled: boolean;
  wake_word_enabled: boolean;
  wake_phrase: string;
  fallback_order: readonly string[];
}

export interface CapabilitySourceInput {
  now: string;
  tools: readonly CapabilityToolSummary[];
  models: readonly CapabilityModelSummary[];
  // Providers actually registered in this process (cloud ones register only
  // when their key is present — so presence here means "configured").
  providerIds: readonly string[];
  voice: CapabilityVoiceSummary | null;
  voiceFeatureFlags: VoiceRuntimeFeatureFlags | null;
}

const CLOUD_PROVIDERS = new Set(["openai", "anthropic"]);

export function buildCapabilityClaims(
  input: CapabilitySourceInput,
): SelfClaim[] {
  const now = input.now;
  const claims: SelfClaim[] = [];

  claims.push(
    claim({
      claim_id: "self:capability.tools",
      category: "capability",
      subject: "capability.tools",
      statement: `${input.tools.length} tools are registered. Each carries a required safety tag and a reversibility class; the approval tier is derived, never declared.`,
      status: input.tools.length > 0 ? "operational" : "unknown",
      trust_class: "config_registry",
      observed_at: now,
      ttl_ms: null,
      evidence: [evidence("registry", "src/lib/tools/index.ts", now)],
    }),
  );
  for (const t of input.tools) {
    const tier = approvalTierOf(t.reversibilityClass, t.requiredSafetyTag);
    claims.push(
      claim({
        claim_id: `self:tool.${t.id}`,
        category: "capability",
        subject: `tool:${t.id}`,
        statement: `${t.name}: ${scrubText(t.description)} [${t.reversibilityClass}, tag ${t.requiredSafetyTag}, tier ${tier}]`,
        status: "operational",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: [
          evidence(
            "registry",
            `tool:${t.id}`,
            now,
            "registered in the tool registry",
          ),
        ],
      }),
    );
  }

  const providers = new Set(input.providerIds);
  for (const p of ["ollama", "openai", "anthropic"]) {
    const configured = providers.has(p);
    const cloud = CLOUD_PROVIDERS.has(p);
    claims.push(
      claim({
        claim_id: `self:provider.${p}`,
        category: "capability",
        subject: `provider:${p}`,
        statement: cloud
          ? configured
            ? `${p}: credential configured (value withheld); cloud provider available, key-gated, never the default.`
            : `${p}: no credential configured; cloud provider unavailable by choice (local-first).`
          : configured
            ? `${p}: local provider registered (default).`
            : `${p}: local provider not registered.`,
        status: configured ? "operational" : "offline",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: [
          evidence(
            "registry",
            "src/lib/providers/registry.ts",
            now,
            cloud ? "registered only when its API key is present" : undefined,
          ),
        ],
      }),
    );
  }

  for (const m of input.models) {
    const providerUp = providers.has(m.provider);
    const status = !m.enabled
      ? "unsupported"
      : providerUp
        ? "operational"
        : "offline";
    claims.push(
      claim({
        claim_id: `self:model.${m.id.replace(/[^a-z0-9._-]/gi, "-").toLowerCase()}`,
        category: "capability",
        subject: `model:${m.id}`,
        statement: `${m.id} (${m.provider} ${m.modelName}, tier ${m.tier}; ${m.capabilities.join("/")}) — ${!m.enabled ? "disabled in the registry" : providerUp ? "enabled, provider registered" : "enabled but its provider is not configured"}.`,
        status,
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: [evidence("registry", "src/lib/models/entries.ts", now)],
      }),
    );
  }

  const v = input.voice;
  if (v) {
    const ev = [evidence("config", "src/lib/voice/live/config.ts", now)];
    claims.push(
      claim({
        claim_id: "self:voice.live",
        category: "capability",
        subject: "voice:live",
        statement: `Live voice loop configured: mode ${v.mode}${v.privacy_local_only ? " (privacy: local only)" : ""}; local STT ${v.local_stt}, local TTS ${v.local_tts} voice ${v.local_voice_id}, brain ${v.local_brain_model}; fallback order ${v.fallback_order.join(" → ")}.`,
        status: "operational",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: ev,
      }),
      claim({
        claim_id: "self:voice.wake-word",
        category: "capability",
        subject: "voice:wake-word",
        statement: v.wake_word_enabled
          ? `Wake word "${v.wake_phrase}" is enabled for this process (local openWakeWord).`
          : `Wake word "${v.wake_phrase}" is available (local openWakeWord) but off: the operator enables it explicitly per run.`,
        status: v.wake_word_enabled ? "operational" : "offline",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: ev,
      }),
      claim({
        claim_id: "self:voice.cloud-realtime",
        category: "capability",
        subject: "voice:cloud-realtime",
        statement: v.openai_realtime_enabled
          ? "OpenAI Realtime voice is available (credential configured, value withheld); routed only when policy allows, with cloud→local fallback."
          : "OpenAI Realtime voice is not available (no credential); the local engines carry every session.",
        status: v.openai_realtime_enabled ? "operational" : "offline",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: ev,
      }),
    );
  } else {
    claims.push(
      claim({
        claim_id: "self:voice.live",
        category: "capability",
        subject: "voice:live",
        statement: "Live voice configuration could not be loaded.",
        status: "unknown",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: [
          evidence("unavailable", "src/lib/voice/live/config.ts", now),
        ],
      }),
    );
  }

  const f = input.voiceFeatureFlags;
  if (f) {
    claims.push(
      claim({
        claim_id: "self:voice.barge-in",
        category: "capability",
        subject: "voice:barge-in",
        statement: f.barge_in
          ? "Barge-in (interrupting me mid-sentence) is enabled in the voice runtime flags."
          : "Barge-in (interrupting me mid-sentence) is not enabled; full-duplex interruption is a roadmap goal, not a present capability.",
        status: f.barge_in ? "operational" : "planned",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: [
          evidence("config", "src/lib/voice-runtime/feature-flags.ts", now),
        ],
      }),
      claim({
        claim_id: "self:voice.realtime-streaming",
        category: "capability",
        subject: "voice:realtime-streaming",
        statement: f.realtime_streaming
          ? "Realtime streaming voice is enabled in the runtime flags."
          : "Realtime streaming is off in the Phase 14 runtime flags; the Phase 25 live loop streams per turn instead.",
        status: f.realtime_streaming ? "operational" : "experimental",
        trust_class: "config_registry",
        observed_at: now,
        ttl_ms: null,
        evidence: [
          evidence("config", "src/lib/voice-runtime/feature-flags.ts", now),
        ],
      }),
    );
  }

  return claims;
}
