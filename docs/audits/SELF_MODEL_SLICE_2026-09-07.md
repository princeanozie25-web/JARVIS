# JARVIS Self Model / Introspection slice — final report (E-050)

Date: 2026-09-07 · Branch: `phase-25/opener` (base 9bc494f) · Machine: MacBook Pro M1 Max 32 GB, macOS 26.6.2
Status: **BUILT, TESTED, SMOKED LIVE — NOT COMMITTED** (Prince reviews manually; nothing pushed).

## 1. Reality audit (before any code)

`git status --short` showed Astra's in-flight UI work: modified `app/**`, `src/app/**`, `app/globals.css`, 11 UI test files, deleted UI prompt docs; untracked `app/api/experience/`, `app/internal/`, `assets/`, `public/presence/`, `src/app/experience/`, `src/components/{experience,internal}/`, `src/lib/experience/`, `tests/{experience,fixtures}/`, `docs/audits/UI_VISUAL_RECONNAISSANCE_2026-09-07.md`. **None of those paths were touched.** No reset, stash, checkout or cleanup was run. HEAD was 9bc494f (E-049).

## 2. What existed already (composed, not duplicated)

| Truth                   | Existing source reused                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity / owner        | `prompts/jarvis_system.md` identity line (the chat route's own system prompt)                                                                                             |
| Approval constitution   | `canonical-policy.approvalTierOf` (computed live: auto / confirm_once / confirm_always / elevated)                                                                        |
| Authority surfaces (17) | `final-system-status/authority-surface-inventory` (20A.4)                                                                                                                 |
| Disabled features (18)  | `final-system-status/disabled-feature-matrix`                                                                                                                             |
| Voice governance        | `voice-runtime/governance.VOICE_RUNTIME_GOVERNANCE_INVARIANTS`                                                                                                            |
| Tools                   | the live `tools` registry (`src/lib/tools/registry`)                                                                                                                      |
| Models / providers      | `models.ModelRegistry` + `providers/registry` (cloud providers register only when keyed → "credential configured")                                                        |
| Voice config / flags    | `voice/live/config.loadVoiceLiveConfig`, `voice-runtime/feature-flags`                                                                                                    |
| Health                  | `bootstrap-readiness/doctor-runtime.runSafeLocalDoctorRuntime` + `models/hardware-fit.buildHardwareProfile`, loopback probes (Ollama `/api/tags`, mlx-audio `/v1/models`) |
| Experience              | `tool_calls` (Phase 3 audit) and `telemetry_events` via the existing `listToolCalls` / `listTelemetryEvents` helpers                                                      |
| Repository              | `architecture-graph/static-registry` (19A, 95 nodes) + `docs/enhancements/REGISTRY.md` rows                                                                               |
| Persistence             | Phase 11 event store `events` table via `EventStore.appendEvent` (`store/app-event-store.getAppEventStore`)                                                               |

**No second registry was created.** No new database, no new table, no migration.

## 3. Architecture

```
src/lib/self-model/
  contracts.ts      claim schema (status, trust class, provenance, ttl, contradictions) — zod strict
  redaction.ts      leak guard: forbidden keys (graph raw-key ban + credential vocab) + secret-shaped values
  reconcile.ts      precedence merge by subject, freshness, stale→unknown decay
  sources/
    constitutional.ts   identity, tiers, authority surfaces, disabled features, voice invariants, standing limits
    capabilities.ts     tools, models, providers, voice, feature flags   (CONFIG/REGISTRY trust)
    runtime.ts          build, host, Ollama, mlx-audio, db, event store, doctor (CURRENT_VERIFIED_RUNTIME, TTLs)
    experience.ts       tool/model competence from real rows; "unknown" under 5 samples (RECENT_VERIFIED_TEST)
    repository.ts       architecture graph, enhancement rows, test-suite "unknown"  (ARCHITECTURE_DOCS)
  model.ts          SelfModel: isolated sources → reconcile → decay → leak-check → cached snapshot
  context.ts        buildSelfContext (bounded reasoning block) + explainClaim (evidence trail)
  projection.ts     typed frontend projection + schema (for Astra)
  writers.ts        the ONLY writers: record_snapshot / record_observation → typed events
  default.ts        node composition (real registries, probes, files); the only env-aware file
  tools.ts          self.describe / capabilities / limits / status / explain / context / projection
  index.ts          browser-safe public surface
```

## 4. Self-claim schema

`SelfClaim { claim_id, category, subject, statement(≤400), status, trust_class, observed_at, ttl_ms|null, evidence[≥1] {kind, ref, observed_at, detail?}, contradictions[], metadata_only:true, secret_material_included:false }`.
Statuses: operational · degraded · offline · experimental · planned · unsupported · unknown.

## 5. Contradiction precedence (implemented in `reconcile.ts`)

`current_verified_runtime (5) > recent_verified_test (4) > config_registry (3) > architecture_docs (2) > roadmap (1)`; ties → most recent observation. Losers with a different status stay on the winner as `contradictions[]` and `self.explain` reports why they were overruled. Drilled: `tests/self-model/self-model.test.ts` "runtime > test > config/registry > architecture docs > roadmap".

Live example (test, faked probe): registry says `model:ollama/qwen3.5-9b-mlx` operational; Ollama down → claim is **offline** with the registry's "operational" recorded as an overruled contradiction.

## 6. Freshness

Live probes carry TTLs (60 s probes, 2 min db, 5 min doctor); static truths (`ttl_ms: null`). A stale live claim **decays to `unknown`** with its last observed status kept in the statement — never reported as current truth. Snapshot cache 15 s (one probe round per burst of tool calls).

## 7. Operational self (live smoke, 2026-09-07 06:27, this Mac)

153 claims, headline **operational**, snapshot **64–79 ms**, 0 stale, 0 contradictions.
Verified now: JARVIS 0.1.0 phase-25/opener @ 9bc494f · darwin/arm64 Node v24.20.0 32 GB · Ollama 28–43 ms serving qwen3.5:9b-mlx, qwen3.5:27b-mlx **and gemma4:12b-mlx (served but unregistered — the model says so and will not route to it)** · mlx-audio 17 ms · SQLite 45 tables / 25 telemetry events / 0 tool calls · doctor **ready** (0 blocking, 10 by-design skips) · event store open.

## 8. Capability self graph

31 tools (each with derived tier), 6 registry models, 3 providers (ollama registered; openai **credential configured, value withheld**; anthropic none), voice (mode auto, STT auto, TTS kokoro/bm_lewis, brain qwen3.5:9b-mlx, fallback openai-realtime → local-mlx-turn), wake word **offline** (available, off by default), barge-in **planned**, realtime streaming **experimental**, cloud realtime **operational (key-gated)**.

## 9. Experience / competence

From `tool_calls` + `telemetry_events` only. Live machine: 0 tool runs / 4 model calls in 30 days → summary honest, per-model rating **unknown** (< 5 samples). Test: 10 rows at 90 % → operational; 3 rows → unknown; 5/6 → degraded and correctly **overruled** by a fresh runtime probe (kept as contradiction).

## 10. Shadow / Savepoint

No Shadow or Savepoint runtime exists in the codebase (audited: `rollbacks` is the Phase 3 tool-undo ledger; `verification-agent` is a contract). Per the brief, **no fake integration was built**; the experience source is the contract such a runtime would feed (`ExperienceToolCallRow` / `ExperienceTelemetryRow`).

## 11. Controlled writers

`writers.ts`: exactly two operations (`record_snapshot`, `record_observation`), both schema-validated, leak-checked, appended to the existing event store as `self.snapshot_recorded` / `self.observation` with **counts only — no claim text**. Not tools; unreachable by an LLM. Verified on the live store: `events` row `self.snapshot_recorded | self-model | self | {"contract_version":"SM.1","claim_count":153,…}`.

## 12. Authority

No `self.modify`, `self.set`, `self.write`, `self.escalate` (test asserts none registered). All seven tools are `PURE_READ` / `ALLOW`; they still run through `ToolRuntime.runTool` (validation, audit row, telemetry, timeout). The model has **no** general database write access: `default.ts` passes the db handle only to `listToolCalls`/`listTelemetryEvents`/`COUNT(*)`.

## 13. Secrets

`redaction.ts`: forbidden keys (architecture-graph raw-key ban + api_key/token/password/credential/bearer/cookie/env…) and secret-shaped values (OpenAI/Anthropic/GitHub/AWS/Slack/Google keys, JWTs, Bearer, PEM, `key=…`). Applied to every snapshot, tool result, context, explanation, projection and writer payload — **throws** rather than silently redacting. Test: model built with `OPENAI_API_KEY=sk-test…` → the value appears nowhere. Live smoke: env-value scan **none**, leak scan **clean**.

## 14. Repository self-knowledge

Architecture graph (95 nodes, layers) and the Enhancement Registry (48 rows parsed: 46 applied/complete, 2 other) as `architecture_docs` claims. The test suite is reported **unknown** — no machine-readable record of the last run exists (the hook writes no artifact) — rather than quoting the header's counts as live.

## 15. Reasoning self-context

`buildSelfContext(snapshot, {task_kind, max_chars})`: identity → verified-now (inference first) → degraded/offline → track record (tool_use/planning) → voice (voice) → standing limits → freshness footer. Live: **1493 chars** for `chat`. Exposed as `self.context` and as a lib function.

## 16. Frontend projection (for Astra)

`SelfProjection` (`SelfProjectionSchema`): `headline`, `identity {name, role, owner_label}`, `counts {claims, by_status, stale, contradictions}`, six sections (identity, runtime, capabilities, experience, limits, repository) of `{claim_id, subject, label, statement, status, trust_class, freshness, observed_at, evidence_count, contradiction_count}`. Pure data; no UI, no route, no CSS touched. Astra binds it via `selfProjectionTool` or `buildSelfProjection(await model.snapshot(), …)` on the server.

## 17. Tools

`self.describe` · `self.capabilities {category?, status?, subject_prefix?}` · `self.limits` · `self.status` · `self.explain {claim}` · `self.context {task_kind?, max_chars?}` · `self.projection`. Registered in `src/lib/tools/index.ts`; `setSelfModelProvider` is the host seam (tests inject fixtures).

## 18. The 17 questions — status

All answered from evidence in `tests/self-model/self-model.test.ts` (Q1–Q17 mapped in test names) and printed by the smoke. Q6 (nodes): one node, honestly; topology **planned**. Q13 (test suite): **unknown** by design. Q16 (what if Ollama goes offline): every `model:ollama/*` claim flips to offline with the registry contradiction recorded; headline → offline.

## 19. Tests

`tests/self-model/self-model.test.ts` (27) + `tests/self-model/tools.test.ts` (3) + `src/lib/tools/registry.test.ts` updated for the 7 new ids. 37/37 green. Full working-tree suite (Astra's uncommitted UI work included): **678 files / 6118 tests, 0 failed** (first run caught six `runTool` call-site guards tripped by the _prose_ "ToolRuntime.runTool (…)" in a self-limit statement — reworded; guards count text, not calls).

## 20. Live smoke

`npx tsx scripts/self-model-smoke.ts [--json] [--no-persist]` — real registries, real loopback probes, real `data/jarvis.db`, real repository; prints the question answers, an explanation, the context, projection counts, leak scan; exit 1 on any leak. Two runs today: clean.

## 21. Files (all new unless marked)

NEW `src/lib/self-model/**` (13 files), `tests/self-model/{self-model,tools}.test.ts`, `scripts/self-model-smoke.ts`, this report. EDIT `src/lib/tools/index.ts` (+7 registrations), `src/lib/tools/registry.test.ts` (+7 expected ids), `docs/enhancements/REGISTRY.md` (E-050 row). `runtime.runTool` call sites: still exactly 2.

## 22. Not done / honest gaps

- The chat model cannot yet _call_ `self.*` in `/api/chat`: the route's allowlist is `READ_ONLY_PROVIDER_TOOL_IDS` in `src/lib/chat/tool-continuation.ts` (frozen 24C surface). Adding the seven ids is a one-line, registry-noted change left for Prince's decision (see §23).
- No Self Context is injected into the system prompt automatically; `self.context` / `buildSelfContext` are the seam. Wiring it into `app/api/chat/route.ts` is Astra-adjacent (app/) and was not touched.
- mlx-audio liveness uses `/v1/models`; if that route is absent on a future server version the claim reads "degraded" — probe is injectable.
- Experience ignores per-session context (aggregate only); no user-rating signal yet (column exists, unused).

## 23. Decisions for Prince

1. Expose `self.*` to the chat model (add to `READ_ONLY_PROVIDER_TOOL_IDS`)? Recommended: yes — PURE_READ, leak-guarded.
2. Persist snapshots on every `self.status` (current: yes when the event store is enabled; `--no-persist` in the smoke)? Recommended: keep, counts only.
3. Prepend `buildSelfContext(…, {task_kind:"chat"})` to the chat system prompt? Recommended: yes, behind a flag, after Astra's route work lands.

## 24. Registry

E-050 row added (APPLIED — pending Prince's review; uncommitted).

## 25. Suggested commit

`feat(self-model): add evidence-backed JARVIS introspection` (Prince commits; the hook runs the suite; no `--no-verify`).

## 26. Verification record

Full suite: 678 files, 6118 tests, 0 failed, 6 skipped (231 s). `runtime.runTool` production call sites: 2. Tracked edits: `src/lib/tools/index.ts` (+5), `src/lib/tools/registry.test.ts` (+15), `docs/enhancements/REGISTRY.md` (+1). New: `src/lib/self-model/**` (15 files), `tests/self-model/` (2), `scripts/self-model-smoke.ts`, this report. Astra's modified/untracked paths: untouched.
