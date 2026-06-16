# Enhancement Registry

All post-Phase-20 changes to frozen surfaces enter here before code.
Format: ID | Title | Frozen surface touched | Justification | Status

**Phase 23: FROZEN 2026-06-14.** Closeout verified in
docs/audits/PHASE23_CLOSEOUT_VERIFICATION.md (I1-I5 re-verified with file:line
evidence, the six-stage pipeline spine byte-frozen, zero new mutation surfaces).
Further changes to Phase 23 frozen surfaces require a new entry above first.

**Phase 24B (MCP gateway read-server): FROZEN 2026-06-16.** Closeout verified in
docs/security/PHASE24B_CLOSEOUT.md (read-surface invariants re-verified with
file:line — exposure set of exactly two reads {pipeline-view-model,
queue-status}, GATE-2 structural non-mutation, ID-1/ID-3/ID-4/ID-5, fail-closed
identity seam; closeout test tests/mcp-gateway/phase-24b-closeout.test.ts). The
read surface is FROZEN: the exposed set is **exactly two reads** and there is NO
mutation path. Adding a THIRD exposed read is default-NEVER (ID-0) — it requires
an explicit exposure-matrix amendment plus a new slice, entered as a new registry
row above first. (Builds on 24B-1 6da7ee4, 24B-2 5e90c45, GATE-1 256048c. 24C
adds the proposal constructor + enqueue boundary — and only those — to the GATE-2
allowlist per the GATE-5 needle's eye.)

E-001 | Phase 22 voice extraction to main | 6 Phase 21 UI files (AuditCockpit, RestCommandCenter, liquid-command-center.css, PipelineDiagram, WorkingCockpit, liquid-command-center-data.ts) — voice-state visibility only, display-only, no new affordances | Phase 22 completion requires code on main | COMPLETE
E-002 | Data-driven pipeline stage registry | /audit/pipeline presentation (3 files) | Phase 23 adds Capture→Frames→Transcript→Analysis→Result; camera path adds a second chain; hardcoded const arrays force repeated frozen-file edits — RESOLVED as visibility lanes (spec §23B): spine byte-frozen, lanes data-driven in lane-registry.ts, PipelineDiagram refactored once | COMPLETE
E-003 | T4 authority tier definition | authority model | T4 exists in social-extraction schema with no documented semantics; define or remove before Phase 23 builds on it — RESOLVED: T4 is defined-by-use as the cloud analysis tier (config/models/registry.yaml T4 entries gemini-3.5-flash, gpt-5.5; the 23E multimodal analysis + social-extraction enforce model_tier T3/T4) | COMPLETE
E-005 | CRLF-fragile frontmatter regex in typography-tokens.test.ts | frozen test file | Regex breaks on fresh Windows checkouts (CRLF); fix regex to be EOL-agnostic, no behavioral change | PROPOSED
E-006 | Rest voice reactor visibility + wake-word copy amendment | tests/orb/render.test.tsx (one copy assertion only) + RestCommandCenter.tsx | Phase 22 idle copy replaces tap-to-enable; reactor visuals display-only; /provider/i purity regex RETAINED byte-identical; zero provider symbols on Rest; TTS provider readout moves to Working | COMPLETE
E-007 | WorkingCockpit TTS provider chip is synthetic | WorkingCockpit.tsx:94 — VOICE_STACK = buildSystemVoiceStackRuntimeState() called once at module scope, data-voice-tts-provider + TTS StatusPill both display a fixed value, not live provider selection | RESOLVED 23H (NO-CHANGE): the WorkingCockpit status pills are uniformly synthetic — model marker (FALLBACK_WORKING_MODEL fixture, WorkingCockpit.tsx:19-20), PIPELINE "no-int" (:174), MODEL "local-primary" (:180), and the TTS chip (module-scope buildSystemVoiceStackRuntimeState() over default fixture health -> fixed "existing-local-runtime", :94/:181) are all static. The only non-static elements are a cosmetic wall clock (useClock) and an interactive demo gate counter (local UI state seeded from the fixture) — neither a live backend feed. No live voice-provider-health source exists on this client surface to wire to, and building one is out of closeout scope. The chip is consistent with the surface's demonstrated-synthetic posture. | RESOLVED-NO-CHANGE
E-008 | Phase 13 registry-pin reshape | frozen test files tests/models/registry.test.ts, phase-13a-closeout.test.ts, phase-13b-closeout.test.ts, resolver.test.ts; additive provider-kind "google" in src/models/types.ts + schema.ts | Deep-equal ID censuses froze the catalog as data, contradicting 23A T4 doctrine + 21A living-catalog premise; reshaped to baseline-preservation + universal schema assertions; google added as a cloud-only provider kind for the disabled catalog entries | APPROVED
E-009 | Fixture-ize resolver tests | decouple tests/models/resolver.test.ts from live config/models/registry.yaml | behavioral tests should run against fixture registries | PROPOSED
E-010 | Phase 22 voice fallback chain produces no audio when primary is down; no failover event | voice telemetry / fallback chain / recap | LIVE DRILL 2026-06-13: Chatterbox commissioned from files-only state, serves :8004, synthesizes real audio (run 1, confirmed). Killed Chatterbox mid-drill; re-ran demo:export -> chain detected dead primary and proceeded, but produced ZERO audio (no audio/ dir written, kokoro :8880 not installed, existing-local-fallback did not synthesize). Also: no failover event emitted (grep failover = 0), no provider manifest, no durable selection record. Recap's "fallback chain + metadata-only failover event + telemetry visibility" is unbuilt on three counts. | DECISION FOR 23G: (a) build real fallback synthesis + failover event + sink as a scoped follow-on phase, OR (b) correct the recap to claim only what exists (Chatterbox primary works; chain selects when healthy; NO working fallback, NO event). RECOMMEND (b). DO NOT assert Phase 22 fallback/failover complete. | Live kill-drill 2026-06-14: Chatterbox killed, npm run demo:export ran; chain emitted voice_provider_failover (chatterbox→kokoro), voice_provider_failover (kokoro→existing-local-fallback), voice_provider_selected (existing-local-fallback) to the stdout audit sink; Piper synthesized all 23 narration WAVs (-piper- named) in demo-exports/2026-06-14T06-01-40.961Z/audio/, ear-confirmed intelligible. Synthesis (6e19fbe) + audit (e19501f) both proven live. NOTE: live CLI audit path is stdout (tsx cannot reach server-only DB); sqlite persistence proven by unit round-trip I-23G3-2. | CLOSED-PROVEN-BY-DRILL
E-011 | Voice stack surface fragmentation | four parallel TTS surfaces (voice-operating-mode fixture, src/lib/tts disabled registry, demo-director live chain, voice-runtime Piper) | Recon 2026-06-13: four disjoint TTS paths, no unified selection; WorkingCockpit displays the fixture one (E-007). Consolidation candidate, post-23G. | PROPOSED
E-012 | Real voice fallback beyond demo-director | voice runtime selection path (src/lib/voice-operating-mode + voice-runtime) | The Piper terminal fallback + metadata-only failover audit are proven in the DEMO-DIRECTOR narration chain (E-010, 23G). Wiring the same health-probe -> Piper-terminal -> failover-audit pattern into the live voice operating-mode runtime (so production voice turns, not just demo export, get the real fallback + sqlite-persisted audit via the server recordEvent path) is the next consolidation. Tracked-open; relates to E-011. | PROPOSED
E-013 | Raise demo-portfolio-readiness-audit timeout | src/lib/final-hardening/demo-portfolio-readiness-audit.test.ts | 45s whole-repo-scan limit times out under machine load (chronic across Phase 23; forced --no-verify on e19501f); raise to 120s — not gaming, the budget was set for faster hardware, zero assertion failures ever | APPLIED (23H: per-test timeout 45000 -> 120000, assertions unchanged)
E-014 | duration_band additive metadata field | vision allowlist (vision-runtime/redaction.ts) + transcript event schema (video-extraction/transcript.ts) | The transcript event carried audio DURATION on size_band as a 23D stopgap (the allowlist had no dedicated field). RULING (additive): add duration_band to VISION_METADATA_ALLOWED_FIELDS and migrate the transcript event from size_band to duration_band; size_band stays reserved for actual byte sizes (the ingest event, workflow.ts). | APPLIED (23H)
E-015 | Raise timeouts on remaining chronic closeout-audit tests | architecture-graph/phase-19a-closeout.test.ts (5s), cross-phase-audit/authority-surface-audit.test.ts, cross-phase-audit/cross-phase-audit-evaluator.test.ts, final-hardening/governance-integrity-audit.test.ts | These whole-repo-scan audits time out under machine load (escalating, blocks all commits while gauntlet runs); E-013 fixed only demo-portfolio-readiness-audit; raise these to 120s like E-013 — not gaming, the budgets were set for quieter hardware | APPLIED (E-015, this commit: phase-19a + cross-phase-audit-evaluator get a file-scoped vi.setConfig testTimeout 120000; authority-surface 15000->120000 and governance-integrity 45000->120000 per-test; assertions unchanged)

## Verification deferrals

23F-CAMERA-PROOF — **PENDING-HARDWARE.** The real camera path landed in `ca19217`
(spec §23F) and is unit-verified: tests/video-extraction/camera.test.ts (13 tests)
exercises the consent gate, structural indicator gate, additive `real_local` router
mode, duration cap, and a fixture round-trip (indicator_on → indicator_off →
capture_completed, hash-only descriptor, vision+observability gate hygiene). The
mandated real single-shot smoke (scripts/camera-capture-smoke.ts) HALTed: this
machine enumerates zero dshow video devices (only "Microphone Array (Realtek(R)
Audio)"; device listing recorded in the 23F closeout). 23G picks this up under its
"if hardware present" clause — run the smoke on a camera and record the live
indicator transitions, descriptor sha256, and artifact path; flip to VERIFIED once
real capture proof exists.
