# V5 Entry Audit (Runway slice R.1)

**Registry entry:** Roadmap v5.1 §8 Runway slice **R.1 — Repository reality audit** (read-only, one report file).
**Audit basis:** `main` @ `6e270100` (AP-J4 capstone, 2026-07-07), worktree `C:/Users/princ/Documents/jarvis-main`.
**Audited from:** Windows execution node — ASUS ROG Strix G15 (G512LI), i5-10300H, 15.8 GB RAM, Win11 build 26200, GTX 1650 Ti 4 GB, Node v24.14.1, Python 3.11.9. **Primary MacBook Pro M1 Max (32 GB) is ABSENT and has never been bootstrapped** (that is Phase 25D).
**Audit date:** 2026-09-01.
**Method:** read-only parallel probing (permitted by v5 §24 "parallel read-only probing … for testing"). Seven probes: frozen-invariants, numbering-collision, registry/status, subsystem-locator, voice/vision/UI, Section-6 contract-reuse, hardware/env. No files under `src`/`tests`/`config` were modified; this document is the only output.

> **R.1 exit criteria met:** every claim carries a file:line (or doc/commit) citation; the numbering-collision check returns a verdict; no implementation is mixed in.

---

## 0. Verdict summary

| Check (v5 §24 "FIRST MOVE")                 | Result                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Frozen phase list & numbers                 | **1–24 FROZEN**, scopes match v5 §7. Caveat: Phase 22 is landed/COMPLETE but carries **no dated freeze block** like 23/24.     |
| Numbering-collision (25–30)                 | **CLEAR.** No phase 25–30 is opened/built/frozen anywhere. Only stale planning-doc numbering in two 03-Jun EXPANSION_ERA docs. |
| `runtime.runTool` = 2 production call sites | **GREEN.** Exactly 2 (`tool-approvals.ts:399`, `tool-continuation.ts:238`); `resumeApproval` sole executor.                    |
| Six-stage spine byte-frozen                 | **GREEN.** `PIPELINE_STAGE_IDS` unchanged; version marker still `phase21k.pipeline.v1`.                                        |
| MCP import allowlist (GATE-2)               | **GREEN.** Positive default-deny transitive allowlist holds; gateway reaches no mutator tree.                                  |
| Which machine is present                    | **Windows ASUS** (execution node). M1 Max primary **absent**.                                                                  |
| Phase 25 opened anywhere?                   | **No** (correct). "Phase 25" appears only as future/candidate prose.                                                           |
| Next free enhancement id                    | **E-022** (E-001..E-021 exist; E-004 reserved as a name).                                                                      |
| Operationally Validated (v5 DONE bar)       | **Nothing** meets it — nothing has run end-to-end on the real primary Mac.                                                     |

**R.1 PERMITS later slices to proceed** on v5's numbering (25 = Productionization; 26 = Presence/Voice; 27 = Vision/Spatial; 28 = Local Intelligence/Council; 29 = Smart Room; 30 = Mobile/Node Fabric) and on new enhancement ids **starting at E-022**.

**Two non-blocking cleanups this audit records for later:** (a) stamp a dated "Phase 22 FROZEN" block for parity with 23/24; (b) mark `EXPANSION_ERA_V2.md` / `EXPANSION_ERA_REFRESH.md` **SUPERSEDED** so their 24–26 numbering is never mistaken for authority.

---

## 1. Numbering-collision census & verdict

Grepped `Phase 2[2-9]|Phase 30|Phase 25` across `docs/`, `tests/`, `prompts/`, root `*.md`; enumerated `git log --all`; read the registry and both EXPANSION_ERA docs.

| #                 | Scope the repo attaches                                                      | Evidence                                                                                                                                      | Kind                                                |
| ----------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 22                | Voice → operating mode; T0–T3; wake word; standing consent                   | `docs/voice/PHASE22_RUNTIME.md:1-3,49-56`; `docs/audits/PHASE22_EXTRACTION_MAP.md:19-38`; `docs/enhancements/REGISTRY.md:44` (E-001 COMPLETE) | **LANDED/COMPLETE** — no dated freeze block         |
| 23                | Vision+Sensing; I1–I5; six-stage spine                                       | `docs/enhancements/REGISTRY.md:6-9` ("Phase 23: FROZEN 2026-06-14"); commit `95cc2180`                                                        | **OPENED + FROZEN**                                 |
| 24                | **MCP Gateway** (read-server, 12-path drill, FC-1/2/3)                       | `docs/enhancements/REGISTRY.md:11-42` ("FROZEN 2026-06-16"/"FROZEN 2026-06-17"); `docs/security/PHASE24_CLOSEOUT.md`                          | **OPENED + FROZEN, zero residuals**                 |
| 24 (stale)        | "Local T2 Promotion" — **different scope than frozen**                       | `docs/architecture/EXPANSION_ERA_V2.md:115-118`; `EXPANSION_ERA_REFRESH.md:126`                                                               | STALE PLANNING-DOC — numbering already drifted here |
| 25                | Productionization / synthetic→real audit — **agrees with v5**                | `docs/security/MCP_GATEWAY_ARCHITECTURE.md:203`; `docs/capstone/REAL_VS_SYNTHETIC_LEDGER.md:6-7`; `REGISTRY.md:61-62`                         | **NOT opened** — candidate prose only               |
| 25 (stale)        | "Sensing and Security" — **conflicts with v5**                               | `EXPANSION_ERA_V2.md:120-123`; `EXPANSION_ERA_REFRESH.md:127`                                                                                 | STALE PLANNING-DOC                                  |
| 26 (stale)        | "Mobile JARVIS / Tauri iOS" — **conflicts with v5** (v5 26 = Presence/Voice) | `EXPANSION_ERA_V2.md:125-128`; `EXPANSION_ERA_REFRESH.md:128`                                                                                 | STALE PLANNING-DOC                                  |
| 27 / 28 / 29 / 30 | — none —                                                                     | zero matches in docs/tests/prompts/root                                                                                                       | **UNCLAIMED — entirely free**                       |

`git log --all` has **no** phase-25..30 commit; there is **no** `docs/phase-25..30` dir (only `phase-16`, `phase-17` exist); **no** phase-25..30 test suite; **no** registry freeze block. `.dual-graph/` and root `CONTEXT.md` do **not** exist on main (no context-store phase claims to reconcile).

**Registry E-id census (20 rows):** E-001, E-002, E-003, E-005, E-006, E-007, E-008, E-009, E-010, E-011, E-012, E-013, E-014, E-015, E-016, E-017, E-018, E-019, E-020, E-021. **E-004 has no row** but is a reserved name ("E-004 Creative Runtime", `docs/PHASE23_SPEC_v1.md:220`) — treat as taken. **Next free id = E-022.**

> **VERDICT — NUMBERING-COLLISION: CLEAR.** The only mismatch is stale planning-doc numbering in the two 03-Jun EXPANSION_ERA docs, whose sequence was already superseded when real Phase 24 opened as the MCP Gateway; the live security/capstone docs already use 25 = Productionization in agreement with v5. v5's 26–30 collide with nothing built.

---

## 2. Frozen invariants (v5 §3) — all GREEN

| Invariant                                                                                                    | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1 single mutation path — `resumeApproval` sole executor; `runtime.runTool` = **exactly 2** production sites | GREEN  | `src/lib/chat/tool-approvals.ts:245` (`resumeApproval`), runTool at `:399`; `src/lib/chat/tool-continuation.ts:238`; runtime defined once `src/lib/tools/runtime.ts:75`. Pinned by `tool-approvals-revalidation.test.ts:397-420` (I-24C2b-5) and `tests/mcp-gateway/phase-24e-nonbypass-drill.test.ts:741-763` (DRILL-12, walks all of `src/lib`, both sites under `src/lib/chat/`, zero in gateway). |
| Six-stage spine byte-frozen                                                                                  | GREEN  | `src/lib/pipeline-visualization/contracts.ts:5-12` `PIPELINE_STAGE_IDS = [capture,classify,route,human_gate,execute,audit]`; version `phase21k.pipeline.v1` (`:3`); asserted `pipeline-visualization.test.ts:18-54` incl. forbidden route→execute edge.                                                                                                                                               |
| I2 no raw frames/OCR/transcripts in telemetry/view-model                                                     | GREEN  | sanitize+allowlist chain `src/lib/vision-runtime/redaction.ts:11-172`, `voice-streaming/telemetry-hygiene.ts:136-220`, `voice-runtime/telemetry.ts:12-177`, `command-center/observability-redaction.ts:32-134`.                                                                                                                                                                                       |
| I3 vision execution gated by default                                                                         | GREEN  | `src/lib/vision-runtime/policy.ts:155-156` `real_camera_enabled:false`, `cloud_vision_enabled:false`. (Nuance: `screenshot_ocr_enabled:true` but `screenshot_requires_user_trigger:true`, `:152-153` — user-triggered by design.)                                                                                                                                                                     |
| I4 no background/autonomous capture                                                                          | GREEN  | `policy.ts:157-159` background/periodic/continuous all false; denied above the consent branch `:203-205`.                                                                                                                                                                                                                                                                                             |
| I5 pipeline/audit surfaces carry no execute/approve/mutate affordances                                       | GREEN  | `src/components/audit/types.ts:12-20`; `contracts.ts:222-224` execute/approve/mutation affordance flags all false.                                                                                                                                                                                                                                                                                    |
| FC-1/FC-2/FC-3, GATE-1..5                                                                                    | GREEN  | canonical defs `docs/security/MCP_GATEWAY_ARCHITECTURE.md:141-149`; pure leaf `src/lib/canonical-policy/index.ts:1-13`; server FC-3 `src/lib/mcp-gateway/server.ts:51-53`; GATE-5 enqueue `mcp-gateway/enqueue.ts:53,140`; GATE-3 `mcp-gateway/canonicalize.ts:154`.                                                                                                                                  |
| GATE-2 positive (default-deny) transitive import allowlist                                                   | GREEN  | `src/lib/mcp-gateway/transitive-import-allowlist.test.ts:42-79` (ALLOW_PREFIXES / DENY_TREES), transitive walk `:191-256`, "reaches NO mutator tree" `:337-342`, non-literal dynamic import fails closed `:116-120`.                                                                                                                                                                                  |
| 12-path non-bypass drill exists                                                                              | GREEN  | `tests/mcp-gateway/phase-24e-nonbypass-drill.test.ts` DRILL-1..12 (each elevation path fails closed).                                                                                                                                                                                                                                                                                                 |
| Registry-is-only-entry + single-agent-for-building conventions                                               | GREEN  | `docs/enhancements/REGISTRY.md:3,9`; `docs/security/MCP_GATEWAY_ARCHITECTURE.md:194-196`; `docs/security/PHASE24C1_PROMPT.md:15`; `# SINGLE AGENT ONLY` header across ~30 phase-21\* build-prompts.                                                                                                                                                                                                   |

**Doc-line drift (non-blocking):** `docs/audits/PHASE23_CLOSEOUT_VERIFICATION.md:14` cites `resumeApproval` at `:243` and runTool at `:350`; current tree is `:245` / `:399`. Invariant intact; only the closeout doc's line numbers are stale (drifted through the AP-J\* capstone commits). Trust the live file:line.

---

## 3. Enhancement Registry state + capability classification

**Genuinely OPEN (PROPOSED, unbuilt):** **E-005** (CRLF-fragile frontmatter regex in `typography-tokens.test.ts` — breaks fresh Windows/CRLF checkouts), **E-009** (fixture-ize resolver tests), **E-012** (real voice fallback in the LIVE operating-mode runtime, distinct from the drilled demo-director chain). `REGISTRY.md:47,51,54`.
**PENDING-HARDWARE:** **23F-CAMERA-PROOF** — camera path unit-verified (`tests/video-extraction/camera.test.ts`, 13 tests) but the real single-shot smoke HALTed (zero dshow video devices on this machine). `REGISTRY.md:67-77`.
**Everything else landed:** E-001/E-002/E-003/E-006 COMPLETE; E-007 RESOLVED-NO-CHANGE; E-008 APPROVED; E-010 CLOSED-PROVEN-BY-DRILL; E-011/E-013/E-014/E-015/E-018/E-019/E-020/E-021 APPLIED; E-016/E-017 CLOSED. Phase 24 has **zero open residuals** (`REGISTRY.md:58-59`).

**Capability status (v5 vocabulary — mapping applied by this audit, not read off registry labels):**

| Capability                                      | v5 status                                       | Why                                                                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 21 cockpit surfaces / pipeline visibility | **Workflow Complete**, FROZEN                   | display-only no-affordance contracts; `REGISTRY.md:44,45,48`                                                                                                     |
| Phase 22 voice                                  | **Realized (demo path only)**                   | STT + TTS fallback chain drilled (E-010 CLOSED-PROVEN-BY-DRILL) but LIVE-runtime fallback (E-012) still PROPOSED                                                 |
| Phase 23 vision/sensing                         | **Realized**, FROZEN                            | I1–I5 re-verified; 23F live-capture PENDING-HARDWARE                                                                                                             |
| Phase 24 MCP gateway                            | **Execution Enabled / drill-validated**, FROZEN | proven by external-client drill, not by a real Mac run                                                                                                           |
| WorkflowBox v1a–v1c                             | **Foundation Complete / display-only**          | store-backed live via E-019; amber-door AI-execution path is a reserved type seam                                                                                |
| Capstone AP-J1..AP-J4                           | **Applied / display-only**                      | design language + polished surfaces; no behavioral/provenance change                                                                                             |
| **Anything, on the real primary Mac**           | **NOT Operationally Validated**                 | README `:160` "Not productionized"; `REAL_VS_SYNTHETIC_LEDGER.md:19-26` command-center surface self-declares synthetic; nothing has run end-to-end on the M1 Max |

**Recap surrogate:** there is no `recap.md` or `CONTEXT.md`; the current-state recap is `README.md` §"What is verified" (`:53`) + §"Honest status" (`:155-178`). (README documents 644 test files / 5,741 tests; the roadmap's "~5,900" is approximate — actual count **not** re-run this session, that is R.2.)

---

## 4. Subsystem locator (all PRESENT on main)

| Subsystem                                       | Location                                                   | Key entry (file:line)                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approval lifecycle / Human Gate executor        | `src/lib/chat/` + `src/lib/approval-runtime/`              | `resumeApproval` `tool-approvals.ts:245`; `createPendingApproval` `db/approvals.ts:231`; FC-2 guard `approval-revalidation.ts` called at `tool-approvals.ts:354`; lifecycle pkg `approval-runtime/{lifecycle,contracts,execution-authority-token,proposal-registry,review-session}.ts` |
| Scheduler (Phase 8, suggestion-only)            | `src/lib/routines/`                                        | `foreground-scheduler.ts:40-49` (reason `scheduler_execution_not_implemented`); cannot execute/approve — `disabled-feature-guard.ts:3-24,42-50` pins actuate/call-tools/auto_approval to `z.literal(false)`                                                                            |
| Router (intent→safety→capability→cost)          | `src/lib/router/`                                          | `routeMessages` `router/index.ts:13-25`; leaves `intent.ts`/`safety.ts`/`capability.ts`/`selection.ts`; **no** `router/router.ts` file                                                                                                                                                 |
| Event store (Phase 11, the ONE log)             | `src/store/` + `src/lib/db/`                               | append-only `EventStore` `src/store/event-store.ts:58` (schema `db/migrations/0001_init.sql`, `events` + projections); operational telemetry `db/schema.ts:47` via `insertTelemetryEvent` `db/telemetry.ts:26`; tool-call ledger `db/schema.ts:72`                                     |
| Plugin/adapter registries                       | `src/lib/{tools,providers,models}/`                        | `ToolRegistry` `tools/registry.ts:3` (singleton `tools:30`); `ProviderRegistry` `providers/registry.ts:5` (OpenAI + Anthropic only, `:29-32`); `ModelRegistry` `models/registry.ts:4`                                                                                                  |
| Council (Phase 21 Council Mode)                 | `src/lib/council/`                                         | `runLiveCouncil` `council/index.ts:90`; `LIVE_COUNCIL_REALIZATION_VERSION :55`                                                                                                                                                                                                         |
| Telegram inbound (Phase 21)                     | `src/lib/telegram/`                                        | `parseTelegramBotUpdate`/`routeTelegramUpdateToEnvelope` `inbound-adapter.ts` (re-export `index.ts:60-72`); closeout `phase-21d-realization-closeout.ts`                                                                                                                               |
| Google adapters + MCP gateway server            | `src/lib/google-adapters/`, `src/lib/mcp-gateway/`         | read adapters `{calendar,drive,gmail}-read.ts` + authority map `index.ts:7`; stdio-only server `mcp-gateway/server.ts:1-17,44` (no HTTP/SSE); enqueue stops at `pending` `enqueue.ts:14`                                                                                               |
| Disabled-feature guards / capability-off matrix | `src/lib/routines/`, `red-team-sandbox/`, `demo-director/` | Phase-17 matrix `routines/phase-17-disabled-guards.ts:41-44`; CAI blocked-only `red-team-sandbox/cai-localhost-execution-gate.ts:15`; demo proposals `read_only:true` `demo-director/proposal.ts:27`                                                                                   |

---

## 5. Voice / Vision / UI

**Voice** — canonical E-011 TTS engine+failover layer confirmed at `src/lib/voice/tts-engine/{types,failover,registry,index,health-snapshot}.ts`, dual-consumed: demo-director (recording-only) `narration.ts:159,174` and PTT (live) `runtime-bridge.ts:340` via adapter `tts/engine-adapter.ts:20`. Wake word **wired but NOT listening** — `DEFAULT_WAKE_WORD_POLICY.enabled=false` (`voice-runtime/wake-word/policy.ts:13-14`), state machine boots `disabled` (`state-machine.ts:68`), feasibility layer "does not implement detection" (`wake-word-feasibility.ts:257`); model wired at `voice-operating-mode/wake-word.ts:42` (`hey-jarvis-you-up.onnx`, v0.6.0). T0–T3 in `voice-operating-mode/authority.ts:4,55`; standing consent `config/voice/standing-consent.yaml` (3 T1 grants, `voice_may_grant_consent:false`).

**Vision** — packet schema rejects payloads via `z.strictObject` (`video-extraction/packet.ts:19,24-31`, `raw_payload_included:false`); I3/I4 defaults false (`vision-runtime/policy.ts:150-172,203-205`); 23F real-camera is the DENY branch requiring consent+user-trigger+single-shot (`policy.ts:228-244`), mandatory indicator `mock-camera-provider.ts:62-63`; redaction allowlist + `duration_band` at `vision-runtime/redaction.ts:11-151,150`.

**UI** — routes `/` `/rest` `/working` `/showcase` `/audit/*` (5 sub-cockpits: architecture-graph, governance-boundaries, pipeline, red-team-sandbox, telemetry-cockpit), all display-only per I5 (`/audit/*` carry `data-audit-authority="none"`; `working/page.tsx:20` "display-only"). Cockpit grammar per `docs/capstone/JARVIS_DESIGN_LANGUAGE.md` + tokens `src/lib/design-tokens/tokens.css:37-52` (AMBER = Gate-touching only). AP-J1..AP-J4 landed (`PipelineDiagram.tsx:15` = AP-J4).

**Voice/Vision/UI flags for a returning dev:**

- **Orphaned live-capable real-gate:** `src/components/ApprovalCard.tsx` + `HumanReviewQueuePanel.tsx` are tested but wired into **no** route (Grep: referenced only by themselves + their tests). The real approval seam is dark — this is the natural Phase-25/Program-U wiring point.
- **id-trap in voice provider mapping:** canonical terminal id `existing-local-fallback` (`tts-engine/registry.ts:35`) vs display id `existing-local-runtime` (`voice-operating-mode/voice-stack.ts:4`); one Piper floor, two ids (mapped one-way by E-020).
- **Two stale details in the roadmap brief itself:** (1) the demo chain has **no Edge-TTS** — it is Chatterbox→Kokoro→Piper(`existing-local-fallback`), captions on exhaustion (no `edge-tts` anywhere in `src`); (2) the display/body font is **Fraunces** (Quincy stand-in) + JetBrains Mono, **not Syne** (`tokens.css:106-124`; no `Syne` in the tree). U.1/U.2 should use the real font, and any "Syne" reference is outdated.

---

## 6. Section-6 canonical-contract REUSE map

No v5 contract name exists verbatim in `src`. The question is which existing shape each must EXTEND vs. what is genuinely NET-NEW.

| Contract              | Decision                             | Existing target (file:line)                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WorkerProfile v1      | **EXTEND**                           | `src/lib/agent-runtime/contract.ts:164` (`AgentRuntimeContractSchema` — identity/owner/authority/risk_class; `execution_authority` hard-false at `:148`)                                                                                                          |
| TaskEnvelope v1       | **EXTEND**                           | append-only `events` log via `src/store/event-store.ts:58` (`aggregate_id` = correlation key); reserved projection `runtime_executions` (`0001_init.sql`) has **no typed writer** — the natural envelope projection. Scheduled origin reuses `src/lib/routines/`. |
| IntentContract v1     | **NET-NEW (thin)**                   | precursor only `src/lib/router/types.ts:14` (`IntentResult` = routing class, not a proposable intent)                                                                                                                                                             |
| WorkerMessage v1      | **NET-NEW**                          | no inter-worker bus; agent outputs one-way to suggestion inbox (`contract.ts:158,216`). **Must ride the `events` log, not a new queue.**                                                                                                                          |
| StructuredResult v1   | **EXTEND**                           | `src/lib/agent-runtime/contract.ts:205` (`AgentOutputSchema`) + builder `output-factory.ts`                                                                                                                                                                       |
| NodeCapability v1     | **NET-NEW**                          | node fabric absent; mirror room capability+trust-class pattern `src/room/schema.ts:72-79` (not the model hardware-fit)                                                                                                                                            |
| ExecutionLease v1     | **EXTEND**                           | `src/lib/routines/run-lease.ts:101` (`RoutineRunLeaseSchema` — id/states/concurrency_cap:1/expiry; non-executing today `:119`)                                                                                                                                    |
| **ActionProposal v1** | **EXTEND (NOT net-new)**             | `src/lib/mcp-gateway/proposal.ts:70` (`CanonicalProposal`): FC-1 `canonical_effect :74`, FC-2 `canonical_effect_hash :77`, scope `scope_snapshot_ref_hash :78`, `expires_at_ms :80`; persisted `db/approvals.ts:19-41`. **Extend this ONE row shape.**            |
| MandateGrant v1       | **NET-NEW (confirmed)**              | nothing grants standing authority; all grants single-action/TTL-bounded (`execution-authority-token.ts:88-91`; agent `execution_authority:false`)                                                                                                                 |
| TransitionRecord v1   | **EXTEND**                           | `approval_lifecycle` projection (`0001_init.sql`) + `approval-runtime/approval-decision-record.ts:11`; `events` log is the transition spine                                                                                                                       |
| SpatialObservation v1 | **NET-NEW**                          | reuse freshness+provenance envelope from `src/room/schema.ts:45,65` (`SensorStateSchema`), which is a sensor reading, not spatial                                                                                                                                 |
| WorldState v1         | **NET-NEW**                          | `src/room/schema.ts:137` (`RoomProfileSchema`) is one-room `substrate_only`/`persistence_enabled:false`                                                                                                                                                           |
| Procedure v1          | **NET-NEW (route through existing)** | knowledge-compounding candidates `obsidian/knowledge-compounding-contract.ts:15` are `proposal_only`; WorkflowBox nodes `effect_class:'display'` (`db/schema.ts:589`). Proposals must route through suggestion inbox + approval.                                  |
| PromotionDecision v1  | **EXTEND**                           | `db/schema.ts:193` (`memory_candidates`) + `:285` (`human_review_queue`); reviewer = human-session marker already encoded (`curator_audit_records … created_by='user'` `:276`; `actor_kind:'local_user_reviewer'`)                                                |
| Receipt v1            | **EXTEND**                           | telemetry/audit event (`db/telemetry.ts:26`) joined to a TransitionRecord ref — Receipt is the join contract, not new storage                                                                                                                                     |

**Stores that MUST be reused (no-second-store rule):** the append-only `events` log (`src/store/event-store.ts:58`, `EVENT_STORE_SCHEMA_VERSION=1`); the approval/proposal row (`db/schema.ts:100` + `mcp-gateway/proposal.ts:128`); telemetry/audit sink (`db/telemetry.ts:26`); model registry (`src/models/registry.ts:55`, YAML-backed); the Enhancement Registry decision-ledger (`docs/enhancements/REGISTRY.md`).

**Absent subsystems (net-new, unbuilt) — confirmed none exist:** worker runtime (`agent-runtime` is metadata-only, `execution_authority:false`); durable task engine; node/mobile fabric (`room/schema.ts:150-153` all adapters false); mandate/standing authority; spatial world model.

**Reuse-rule risk flags (a naive build would create a forbidden parallel):**

1. **A third event/telemetry sink** — two `telemetry_events` tables already coexist (operational `db/schema.ts:47` + append-only projection) across two SQLite DBs. New TaskEnvelope/Receipt/WorkerMessage data must be a **projection** on the `events` log, never a new base table.
2. **A second proposal/approval store** — ActionProposal must EXTEND `CanonicalProposal` + `approvals`; a separate table would bypass the FC-2 hash + 24C-2b/24D-4 revalidation guard (`tool-approvals.ts:354-389`). Add nullable columns (established additive pattern `db/schema.ts:708-731`).
3. **A second policy/authority engine** — MandateGrant must extend the pure `src/lib/canonical-policy/index.ts` leaf (both gateway and executor depend down onto it) + the approvals decision path, not re-implement `riskClassOf`/`clientGrantStillAuthorizes`.
4. **A second scheduler/lease manager** — reuse `RoutineRunLease` + `RoutineConcurrencyPolicy` (`run-lease.ts:67`); no background daemon.
5. **A second review inbox** — PromotionDecision/Procedure reuse `human_review_queue` + `suggestion-inbox`.
6. **A third model registry** — consolidate onto `src/models/registry.ts`; a legacy second `ModelRegistry` already exists at `src/lib/models/registry.ts:46`.
7. **A message bus** — WorkerMessage is highest risk: route as typed events on the append-only `events` log with an `aggregate_id`, not a new queue.

---

## 7. Hardware & environment reality (Phase 25D input)

**Run/bootstrap:** dev server `next dev --hostname 127.0.0.1` (`package.json:6,8`, loopback). Nine scripts require `--env-file=.env.local` (`package.json:16-31`) — `.env.local` is uncommitted and has no committed `.env.example`. `npm run doctor` (`scripts/doctor.ts`) is a read-only environment inspector (os/disk/pm probes, executes nothing; check catalog `src/lib/bootstrap-readiness/doctor-checks.ts:26-42`). `tsx` is a devDependency, so `npm install` precedes any script.

**GPU/CUDA — nothing to translate:** no CUDA/cuDNN/GPU code path exists in `src`; GPU is modeled only as an optional RAM/VRAM budget (`config/hardware.yaml` `vramGb:null`, `reservedRamGb:6`). On the M1 Max, `metal`/`unifiedMemory` budgeting turns on automatically (`src/models/hardware-fit.ts:123`). The GTX 1650 Ti is unused by source.

**Windows→Mac translations required at 25D (ranked):**

| #   | Item                                                                                                                  | file:line                                                                                                                                               | Translate to                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | **Audio playback driver** — hard `powershell.exe` + `System.Media.SoundPlayer` (only sidecar with no env indirection) | `src/lib/voice-runtime/playback/local-driver.ts:6,9-22,144-153`                                                                                         | macOS `afplay`/CoreAudio driver                                                                               |
| 2   | Piper defaults — `C:\Users\princ\.jarvis\...\piper.exe` + model paths                                                 | `config/voice/piper-fallback.yaml:14-18`                                                                                                                | `~/.jarvis/...` POSIX, or set `JARVIS_PIPER_*` env                                                            |
| 3   | STT interpreter                                                                                                       | `src/lib/voice-runtime/stt/local-config.ts:5-14`                                                                                                        | `JARVIS_STT_PYTHON_COMMAND=python3`; `pip install -r runtimes/requirements-vision.txt` (faster-whisper 1.2.1) |
| 4   | Camera capture — ffmpeg `-f dshow`                                                                                    | `scripts/camera-capture-smoke.ts:69,211`                                                                                                                | `-f avfoundation` (mac side of 23F)                                                                           |
| 5   | Launch config — `python`                                                                                              | `.claude/launch.json:7`                                                                                                                                 | `python3`                                                                                                     |
| 6   | System binaries yt-dlp/ffmpeg/ffprobe (winget-documented)                                                             | `src/lib/video-extraction/runtime-requirements.ts:4-7`; runbook `docs/runbooks/phase23-runtime-setup.md:22,29`                                          | Homebrew; re-verify `MIN_YTDLP_VERSION`/`MIN_FFMPEG_VERSION`                                                  |
| 7   | HTTP sidecars (portable URLs, separate installs)                                                                      | Ollama `:11434` (`ollama-client.ts:604`), Chatterbox `:8004` (`tts/chatterbox-provider.ts:14`), Kokoro `:8880` (`:15`, not installed on either machine) | stand up daemons on Mac; loopback URLs + env overrides already portable                                       |
| 8   | One test literal hard-codes the Windows primary-checkout path                                                         | `src/lib/red-team-sandbox/red-team-sandbox-queries-safety.test.ts:221`                                                                                  | fixture only; note it                                                                                         |

**Portable (no translation):** SQLite `data/jarvis.db` (`src/lib/db/client-node.ts:8-22`, WAL), LanceDB `data/lancedb` (`memory/vector-config.ts:24-38`, disabled by default), vision artifacts `data/vision-artifacts` — all under `process.cwd()`.
**Keys/vault env:** `OBSIDIAN_VAULT_PATH` (read, fail-closed, `obsidian/pull-indexer.ts:14`) and `JARVIS_OBSIDIAN_VAULT_ROOT` (write, default `~/jarvis-vault`, `memory/vault.ts:28-35`) are **two distinct vars**; optional `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`; **no** Google `client_id`/secret/token in source (scope-readiness only, `google-adapters/google-account-runtime.ts:30`).

---

## 8. What R.1 hands forward

**Runway status after R.1:**

| Slice                                                | State                                                                                  | Blocked on                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **R.1 Repository reality audit**                     | **this document**                                                                      | — (done, read-only)                                                                    |
| R.2 Stabilize (green baseline, 3 clean in-hook runs) | not started                                                                            | **Primary Mac** ("green baseline on the primary machine") + full-suite hook            |
| R.3 E-011 voice consolidation                        | **already APPLIED** (commit `2075feeb`, layer at `src/lib/voice/tts-engine/`)          | — re-verify only; no new build needed                                                  |
| R.4 Real-vs-synthetic check (light)                  | **partially exists** — `docs/capstone/REAL_VS_SYNTHETIC_LEDGER.md` (commit `c5f4821d`) | not Mac-blocked; a light refresh/relocation under `docs/audits` is doable on this node |
| R.5 23F camera proof                                 | PENDING-HARDWARE                                                                       | a webcam (this machine has none)                                                       |

**Non-blocking cleanups this audit recommends** (each is a registry-tracked slice, not a freeze reopen): stamp a dated **Phase 22 FROZEN** block for parity; mark **EXPANSION_ERA_V2 / EXPANSION_ERA_REFRESH SUPERSEDED**; fix the two roadmap-brief staleness items in Program U's inputs (**Fraunces not Syne**, **no Edge-TTS in the demo chain**); land the three open test-hygiene/voice PROPOSED rows (**E-005**, **E-009**, **E-012**) — E-005 is the CRLF gotcha that bites fresh Windows checkouts.

---

## Closeout status

- **Status:** R.1 report produced; read-only; no `src`/`tests`/`config` modified. This is the sole artifact.
- **Numbering-collision:** CLEAR — later slices may proceed on v5 numbering; next enhancement id E-022.
- **`runtime.runTool`:** exactly 2 production call sites (verified). Spine byte-frozen. GATE-2 allowlist green.
- **Not committed yet:** the Delivery Law (gates 13–15) requires the closeout to land on `main` with the full in-hook suite green — that green baseline is **R.2 on the primary Mac**. Running the full ~5,900-test hook on this memory-starved Windows node risks the E-013/E-015/E-018 load-induced flake tail; this document is therefore written and left for commit alongside R.2 stabilization.
