# Phase 23 Specification — Vision + Sensing Realization (v1)

- **Date:** 2026-06-12
- **Basis:** PHASE23_ENTRY_AUDIT.md (2026-06-12) + E-001/E-006 landed on main (commits 995f75f6 → 31447262)
- **Status:** APPROVED — owner sign-off 2026-06-12 (caps confirmed; cloud analysis registry-disabled; camera in-phase as 23F)
- **Registry:** resolves E-002 (reframed) and E-003 inside slices 23A/23B; creates no new mutation surface (see Doctrine Deltas)

---

## 0. Doctrine deltas — what Phase 23 does and does not change

| Area            | Phase 23 position                                                                                                                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Mutation paths  | **ZERO new mutation surfaces.** Analysis results are observations (`advisory_only: true`) + Suggestion Inbox items. Any mutating follow-up rides the existing tool-approval path (`ensurePendingToolApproval` → `resumeApproval`). Gap #3 (generic approved-proposal dispatch) is **DEFERRED** — not needed when nothing executes. |
| Pipeline spine  | The six-stage spine (`capture, classify, route, human_gate, execute, audit`) and its forbidden edges stay **byte-frozen**. Vision visibility is a _lane_, not new stages (see 23B).                                                                                                                                                |
| Authority tiers | T4 = **ModelTier only** (capability class), defined in 23A. Action authority remains T0–T3 per the Voice Authority Amendment. The two tier systems are formally disambiguated in code comments + README.                                                                                                                           |
| Raw content     | Raw frames/transcripts may enter **bounded model context** for analysis (Phase 7 context-assembly doctrine) but never telemetry, UI view-models, or persistence outside the artifact folder. The three-gate sanitizer chain (audit §8) is the law for every emitted event.                                                         |
| Capture         | User-initiated only. `background                                                                                                                                                                                                                                                                                                   | periodic | continuous` remain policy-denied. Camera real path is the last slice and is consent-config-gated, indicator-mandatory. |
| Autonomy        | No autonomous vision, no RuView, no identity system. Out of phase, full stop.                                                                                                                                                                                                                                                      |

---

## 23A — Foundations (T4 semantics, config surface, schema extensions)

**Resolves E-003. Pure additive groundwork; no execution capability.**

### YES

1. **T4 ModelTier semantics** (`src/lib/models/types.ts` + `entries.ts` + README):
   - T4 = frontier multimodal reasoning class: native image+audio+text input, long-context cross-modal synthesis.
   - Document that **no production entry instantiates T4 yet** — the tier is a real rung, not a fiction. Registry may instantiate it later without a phase change.
   - `model_tier: z.enum(["T3","T4"])` in analysis packets is a **minimum-capability constraint**: resolver picks the lowest-tier qualifying model ≥ T3 per aux-routing/cost rules.
   - One comment block at `ModelTier` declaration disambiguating ModelTier vs action-authority tiers, cross-referencing `voice-operating-mode/authority.ts`.
2. **`config/vision/`** (loader follows `loadAuxRoutingConfig` pattern — yaml parse + Zod + `DEFAULT_*_CONFIG_PATH`):
   - `standing-consent.yaml` — same shape as `config/voice/standing-consent.yaml` (versioned, owner-controlled, revocable, `metadata_only: true`, per-entry tier/scope/granted). Entries: `video_ingest_url`, `video_ingest_local_file`, `frame_sampling`, `transcript_extraction`, `multimodal_analysis`, `camera_capture` (default `granted: false`).
   - `source-allowlist.yaml` — analog of `SocialExtractionSourcePolicySchema`: platforms `youtube | instagram_reels | tiktok | x_twitter | local_file`, per-platform enabled flag, `max_filesize_mb` (default 512), `max_duration_s` (default 3600).
3. **Vision input kinds — additive:** `video_frame`, `video_segment` appended to `VISION_INPUT_KINDS`. Existing literals untouched.
4. **Telemetry event types — additive:** new literals appended to `TelemetryEventType` union: `video_ingest_requested/completed/failed`, `frame_sampling_completed`, `transcript_extraction_completed`, `multimodal_packet_assembled`, `multimodal_analysis_completed`, `vision_lane_event`. All metadata-only by the existing sanitizer chain.
5. **Python runtime manifest:** `runtimes/requirements-vision.txt` pinning `faster-whisper==1.2.1` (+ future vision deps), referenced from a new `docs/runbooks/phase23-runtime-setup.md` that also documents yt-dlp/ffmpeg install with **minimum-version constants** checked by health checks (Chatterbox pattern).

### NO

- No model entries created at T4. No provider execution. No capture. No UI changes.
- No edits to existing `VISION_INPUT_KINDS` literals, existing telemetry literals, or any frozen test.

### Invariants

- All new consent entries default deny; absence of config file ⇒ everything denied (fail closed).
- Loader rejects unknown keys (strictObject).

### Tests

- `tests/vision-config/standing-consent.test.ts` — default-deny, revocation, unknown-key rejection, missing-file fail-closed.
- `src/lib/models/tier-semantics.test.ts` — T4 in union, no production T4 entry, min-capability resolution picks T3 when both qualify.
- Telemetry union extension test: new event types pass the three-gate chain with metadata-only payloads; forbidden-field loop (redaction.test.ts pattern) over every new event type.

**IMPLEMENTATION RECORD (2026-06-12):** delivered as specified; consent tiers assigned T2 (ingest/sampling/extraction) and T3 (multimodal_analysis, camera_capture) — ratified by owner. 24 new tests. MIN_YTDLP_VERSION=2026.03.17, MIN_FFMPEG_VERSION=8.1.1.

---

## 23B — Visibility-Lane Registry (E-002, reframed)

**Resolves E-002. Bounded migration of one frozen presentation seam; spine untouched.**

### Architecture

A **lane** is a data-defined, read-only visualization of a capability's journey through the governed pipeline. Lanes render as sections beneath the six-stage spine (the Phase 22 voice section is the precedent and becomes the first migrated consumer).

- `src/lib/pipeline-visualization/lane-registry.ts`:
  - `PipelineLaneSchema` (strictObject): `lane_id`, `label`, `stage_ids: string[]` (lane-local stages, e.g. `["capture","frames","transcript","analysis","result"]`), `stage_labels`, `event_type_mapping` (TelemetryEventType → lane stage), `read_only: literal(true)`, `execute/approve/mutation_affordance_present: literal(false)`.
  - `PIPELINE_LANES` const: `voice` (migrated from `buildVoicePipelineVisibilityModel` data), `vision` (the Phase 23 chain).
  - `buildLaneViewModel(lane, events: TelemetryEvent[])` — pure, metadata-only, mirrors `buildPipelineViewModel` affordance guarantees.
- `PipelineDiagram.tsx`: replace the hardcoded voice-visibility section with a generic lane renderer iterating `PIPELINE_LANES`. **This is the only frozen-file edit in 23B** and it is a refactor of the section E-006 just added — newest code, smallest blast radius.
- Live feed: lanes consume the same metadata-only event stream contract; if no live stream is wired yet, lanes render from the deterministic synthetic fixture exactly as the voice section does today. Wiring live events is in-scope only via existing observability API reads — no new endpoints.

### YES / NO

- YES: lane registry, voice migration, vision lane definition, generic renderer.
- NO: spine tuple/arrays/palette/grid edits. NO new stages in `PIPELINE_STAGE_IDS`. NO `observedTransitions` rework (stays as-is). NO new endpoints.

### Invariants

- Spine files diff: `contracts.ts` stage/transition/boundary const arrays byte-identical (assert in test by importing and snapshotting).
- Every lane view-model passes the existing pipeline affordance test shape (`controls: never[]`, three flags false).
- Voice lane post-migration renders identical stage semantics to the pre-migration section (golden test on the synthetic fixture).

### Tests

- `src/lib/pipeline-visualization/lane-registry.test.ts` — schema rejects payload fields; affordance flags; event-mapping totality (every mapped event type exists in the telemetry union).
- Frozen battery reruns unmodified except `pipeline-diagram` snapshot, whose only permitted diff is the voice-section → lane-renderer refactor.

---

## 23C — Media Ingest Module (`src/lib/video-extraction/`)

**Social-extraction is the template; this is its product-grade generalization.**

### YES

1. Module skeleton mirroring `social-extraction/workflow.ts`: plan schema with `ytdlp_runner_required` / `ffmpeg_runner_required`, **injected runner interfaces** (callers provide spawn wrappers — no direct child_process in the module).
2. Sources: the five allowlisted platforms + local file path (path-boundary-checked via existing safe-path utilities).
3. Hard caps from `source-allowlist.yaml` enforced **pre-download** (`--max-filesize` to yt-dlp) and post-download (ffprobe duration check; over-cap ⇒ delete artifact, emit `video_ingest_failed`, fail closed).
4. Health checks at plan time: `yt-dlp --version`, `ffmpeg -version`, `ffprobe -version` against minimum-version constants. Unavailable or below-min ⇒ plan refuses (fail closed), telemetry records tool + version-string hash only.
5. Artifact layout: `data/vision-artifacts/<date>-<source-hash>/` containing `source.{ext}`, `manifest.json` (URL hash — never raw URL in telemetry — duration, filesize, tool versions, consent entry consumed). `data/` is gitignored already.
6. Consent gate: every ingest requires the matching `config/vision/standing-consent.yaml` entry granted; URL ingest additionally requires the platform enabled in the allowlist. Deny ⇒ no spawn occurs.
7. Smoke script `scripts/video-extraction-smoke.ts` (real execution proof, social-extraction-smoke pattern).

### NO

- No autoplay/auto-ingest, no watch-later queues, no scheduled ingestion. One user-initiated ingest per request.
- No raw URLs, titles, or file paths in telemetry (hashes only). Paths live in the manifest on disk.
- No cookies/credentials/login-gated retrieval. Public or local content only.

### Invariants

- Consent absent ⇒ runner never spawned (assert spawn-mock uncalled).
- Caps breached ⇒ artifact removed + failure event (no partial artifacts survive).

### Tests

- Runner-injection unit tests (no real spawns); consent-deny test; cap-breach cleanup test; allowlist platform-disabled test; health-check below-min refusal test.
- Real execution: smoke script run recorded in closeout (one short CC-licensed/own video).

---

## 23D — Frames + Transcript + Multimodal Packet

### YES

1. **Frame sampling:** ffmpeg (injected runner) extracts frames at configured interval (default 1 fps, max 120 frames/video — config in `source-allowlist.yaml`). Each frame → `VisionFrameDescriptor` via `ingestVisionFrameDescriptor` (sha256 hash identity, `raw_payload_stored: false` in the descriptor; pixel files live only in the artifact folder).
2. **Transcript:** ffmpeg audio extraction → `createFasterWhisperSttProvider().transcribe({audio_ref: <path>})`. Transcript text written to `transcript.md` in the artifact folder; **never** into telemetry (only duration, segment count, model name).
3. **Packet assembly:** generalize `SocialMultimodalAnalysisPacketSchema` → `MultimodalAnalysisPacketSchema` in `src/lib/video-extraction/packet.ts`: frame refs (paths + hashes), transcript ref, source manifest ref, `model_tier: z.enum(["T3","T4"])`, `metadata_only_telemetry: literal(true)`. Social-extraction packet stays untouched; a follow-up enhancement entry may converge them later — not in this phase.
4. Vision session envelope: the whole 23C→23D run executes inside one `requestVisionSession` lifecycle (single-occupancy enforced, expiry honored).

### NO

- No OCR/object-detection provider activation here (YOLO/Tesseract stubs stay disabled).
- No frame thumbnails in any UI surface. No transcript text in any event.

### Invariants

- Every emitted event passes the three-gate sanitizer chain; forbidden-field loop covers `transcript`, `ocr_text`, `base64`, `raw_image`, frame-path leakage.
- Session expiry mid-run ⇒ pipeline halts, artifacts retained, `failed/expired` lifecycle event emitted.

### Tests

- Descriptor hash-format test; packet schema strictness (rejects payload fields); transcript-leak test (event stream grepped for transcript content with a sentinel string); session single-occupancy test under concurrent ingest attempts.

---

## 23E — Analysis (T3/T4)

### YES

1. `analyzeMultimodalPacket(packet)` in `src/lib/video-extraction/analysis.ts`:
   - Resolves model via registry honoring the packet's tier constraint (min T3) + aux-routing + cost guard. Cloud models only if registry-enabled + budget-capped (existing Phase 13 doctrine). **Owner ruling: cloud stays registry-disabled in this phase.**
   - **Bounded context assembly:** frames (as model-input images, capped count) + transcript + manifest metadata enter the model call. This is model context, not telemetry — the Phase 7 context-assembly boundary, stated explicitly in code comment.
   - Output lands as `createVisionObservation(...)` — `advisory_only: true`, `current_truth: false` — plus an analysis summary file in the artifact folder.
2. Optional suggestions: if analysis proposes actions, they become Suggestion Inbox items via `buildSuggestionInboxItem` (inbox cannot finalize approvals — existing literal). Acting on one rides the existing tool-approval path. **No new proposal kind, no new executor.**
3. Aux routing (21C): slug/tag/summary admin work goes to aux models; the T3/T4 model does only the reasoning pass.

### NO

- No new `vision_analysis` proposal kind (deferred with gap #3).
- No auto-summarize-on-ingest. Analysis is a distinct user-initiated step, even within a session.
- No memory writes from analysis (observations are not memory; promoting an insight to memory is a user action through existing paths).

### Invariants

- Cost guard precedes any cloud call; cloud disabled ⇒ local T3 or fail closed with a clear "no qualifying model" error.
- Observation literals (`advisory_only` etc.) asserted on every analysis output.

### Tests

- Tier-resolution test (T3 picked when qualifying; no-model fail-closed); cost-cap breach test; observation-literal test; suggestion path test (inbox item created, `approval_finalization_supported: false` intact).

---

## 23F — Real Camera Path (last; consent-gated)

### YES

1. **Additive router mode** `real_local` in the mode union (`"fake" | "dry_run_disabled" | "real_local"`) — existing literals untouched. Admission requires: consent entry `camera_capture: granted`, user-initiated trigger, policy pass.
2. **Registry admission:** `real_camera` provider kind accepted at registration **only** when the consent loader confirms grant at registration time; otherwise registration rejects exactly as today (deny-by-default preserved).
3. Capture: single-shot or bounded clip (max duration from config, default 30 s), **active indicator mandatory** — the capture API requires an `indicator_ack` callback from the UI layer and refuses without it; indicator state is a lane event.
4. Frames flow into the same 23D descriptor path. No special camera analysis route.

### NO

- No background/periodic/continuous capture (policy denials stay).
- No streaming preview surfaces, no retention beyond the artifact folder, no cloud vision.
- No identity/face recognition of any kind.

### Invariants

- Consent revoked ⇒ next registration/capture attempt fails closed.
- Indicator-absent capture structurally impossible (API shape, asserted by test).

### Tests

- Mode-union additivity test (fake/dry-run behavior byte-identical); consent-revocation test; indicator-required test; background-mode still-denied regression.

---

## 23G — Closeout

- `tests/video-extraction/phase-23-closeout.test.ts` following the closeout naming convention, **structured as many small `it` blocks — the whole-repo-scan-in-one-`it` shape is banned** (chronic-timeout mitigation).
- Closeout asserts: all 23A–23F invariants, all five audit invariants (I1–I5) re-verified, spine byte-freeze, zero new mutation surfaces (no new call sites of `runtime.runTool`; `resumeApproval` still sole executor).
- Real-execution evidence recorded with **captured output lines, not exit-code-derived counts**: one full ingest→frames→transcript→analysis run on a local file + one URL source; camera single-shot if hardware present.
- README + recap updated; registry flips E-002/E-003 to COMPLETE; Phase 23 freeze.

---

## Sequencing & dependencies

23A → (23B ∥ 23C) → 23D → 23E → 23F → 23G

## Out of scope (named so nobody "helpfully" adds them)

RuView; identity systems; autonomous vision; scheduled/background ingest; YOLO/Tesseract real activation (separate enhancement entry when wanted); generic approved-proposal dispatch; social-extraction/packet convergence; fast-check tooling; E-004 Creative Runtime; Enterprise Brain anything.
