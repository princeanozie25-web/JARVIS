# V5 Real-vs-Synthetic Check (Runway slice R.4, light)

**Registry entry:** Roadmap v5.1 §8 Runway slice **R.4 — Real-vs-synthetic check (light)**.
**Audit basis:** `main` @ `6e270100` (AP-J4 capstone, 2026-07-07). Read-only; no code touched.
**Audited from:** Windows execution node (M1 Max primary absent). **Audit date:** 2026-09-01.
**Supersedes for capstone purposes:** the July pass `docs/capstone/REAL_VS_SYNTHETIC_LEDGER.md` (2026-07-05 @ `2075feeb`), which predates E-019/E-020/E-021 and now mis-states four fields as unfixed. This slice refreshes it in v5's trichotomy and records what Program U (the Command Center capstone) **may express**.

> **Purpose (v5 §8):** tell the capstone what it may render as real. The full synthetic→real realization is **Phase 25A/25B** (Mac). This slice only classifies and labels; it changes no runtime value.

## Classification (v5 trichotomy)

| Class                           | Meaning                                                                                    | Capstone rule                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| **LIVE**                        | Real runtime state (real rows/probes/store), or DERIVED from it                            | May render as real; show provenance                          |
| **DELIBERATELY-SYNTHETIC (DS)** | Static/fixture behind a recorded reason — a fail-closed boundary or a by-design demo shape | Keep; must carry an honest inline label; never dress as live |
| **SHOULD-BE-LIVE (SBL)**        | Static today with no principled reason it must be — a Phase-25 make-live gap               | Do NOT render as live; note as a gap                         |

**Frame (unchanged, honest):** the whole Next.js command center self-declares synthetic — header `SYNTHETIC - METADATA-ONLY` (`src/components/working/WorkingCockpit.tsx:178`) and every model carries `SYNTHETIC_OBSERVABILITY_MARKER` (`src/lib/command-center/liquid-command-center-data.ts:324`; `src/lib/observability/synthetic-data.ts:13`). This check is about **field-level** honesty inside that frame, and about live machinery that exists but is not rendered.

---

## The four July "capstone-lie" risks — CLOSED by E-021 (verified on `6e270100`)

| July SI risk           | Was                                                                        | Now (verified)                                                                                                                                                             | Class                                                                |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Statusbar test count   | `TESTS 4,930 PASS` (stale, live-shaped)                                    | `testCount: "full suite gated in-hook"` — non-staling property label                                                                                                       | `liquid-command-center-data.ts:353,706` — **DS, labelled**           |
| Phase label            | `Phase 21 active` (stale post-24)                                          | `phase: "Expansion Era - post-Phase-24"` — monotonic truth                                                                                                                 | `:352,705` — **DS, labelled**                                        |
| Gate resolution copy   | "audit recorded" / "approval lifecycle recorded" (false persistence claim) | `"Approved (demo) - execution blocked pending real service - no audit row written"`; `"demo lifecycle simulated - not persisted"`; `"Denied (demo) - … nothing persisted"` | `WorkingCockpit.tsx:198,204,210` — **DS, honest**                    |
| COST local/cloud split | hardcoded `LOCAL 76%` with zero provider data                              | `"no cost data"` for both LOCAL and CLOUD when providerCount 0                                                                                                             | `liquid-command-center-data.ts:500-501` — **DS/CONDITIONAL, honest** |

All four are now honest. E-021 also added **per-panel provenance** (`OBSERVABILITY - LIVE/SYNTHETIC` + `data-panel-provenance`) so live and synthetic panels are distinguishable rather than sharing one global marker.

---

## Current classification by surface

### Surface 1 — Human Gate / approval lifecycle

| Field                                                                                            | Source                                                                                                               | Class                 | Capstone may express                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------ |
| Demo proposal card (`PROP-ROOM-1842`, tier, dry-run diff, expiry), Approve/Deny, GATE pill/count | `liquid-command-center-data.ts:334-346`; `WorkingCockpit.tsx:250-284` (`resolveGate` mutates local React state only) | **DS**                | The Phase-18 lifecycle _shape_, labelled simulated           |
| Real Phase 18 machinery + sole executor                                                          | `src/lib/approval-runtime/*`; executor `src/lib/chat/tool-approvals.ts:399`                                          | **LIVE (unrendered)** | May CITE it; must not imply a rendered live gate             |
| `ApprovalCard.tsx` / `HumanReviewQueuePanel.tsx`                                                 | `src/components/` — imported by **no** route (Grep: self+tests only)                                                 | **SBL**               | The natural Phase-25 real-gate seam; do not present as wired |

### Surface 2 — WorkflowBox (lane + mind-map) — MADE LIVE by E-019

| Field                                             | Source                                                                                                                                                                                                                 | Class                                                                             | Capstone may express                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Lane projects/nodes/sub-items, node %/rollup, map | route loads real projects via `src/app/working/workflowbox-live.ts` (`loadCockpitWorkflowbox`), mutates through `src/app/working/workflowbox-actions.ts`; honest `WORKFLOWBOX - LIVE/SAMPLE` + `data-panel-provenance` | **LIVE** (real store rows) / **DS** fallback (labelled `SAMPLE` when store empty) | Real project state with LIVE/SAMPLE provenance; the sample fixture stays display-only |
| Store (single source of truth)                    | `src/lib/workflowbox/store.ts`                                                                                                                                                                                         | LIVE                                                                              | —                                                                                     |

### Surface 3 — MCP gateway reads

| Field                                    | Source                                                                                            | Class                                                                 | Capstone may express                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pipeline-view-model` (static topology)  | `src/lib/mcp-gateway/resources.ts:67-69` → `pipeline-visualization/contracts.ts`                  | **DS** (ID-4 static governance map, drilled GREEN)                    | "the map of the rules" — never runtime traffic               |
| `queue-status.pending_count` / `_bucket` | `src/lib/mcp-gateway/queue-status.ts:52,58-62` (injected count reader, wired `server.ts:115-124`) | **LIVE when a host wires the source** / else CONDITIONAL uniform-deny | The one genuinely live Gate number, when a gateway host runs |
| `cadence_seconds`                        | `queue-status.ts:28`                                                                              | **DS** (disclosed anti-poll constant ID-3)                            | config disclosure                                            |

### Surface 4 — Voice state + TTS pill — MADE LIVE by E-020

| Field                                      | Source                                                                                                                                                                                                                                  | Class                                               | Capstone may express                                                                                 |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| TTS StatusPill                             | reads real canonical health via `src/lib/voice/tts-engine/health-snapshot.ts` through `src/app/working/voice-health.ts`; labelled `TTS - LIVE`/`TTS - SYNTHETIC`, `(failover)`/`(down)` markers; starts synthetic, upgrades after mount | **LIVE** (real probes) / honest synthetic default   | Real engine health with the LIVE/SYNTHETIC label; never a fake all-healthy                           |
| Voice activity feed (wake/T0/T1/T2 script) | `src/lib/voice-operating-mode/pipeline-visibility.ts:39-100`                                                                                                                                                                            | **DS** (Phase-22 visibility contract, illustrative) | labelled illustrative lifecycle, not a live voice log                                                |
| Real voice health/failover machinery       | `src/lib/voice/tts-engine/` + demo/PTT probes                                                                                                                                                                                           | LIVE                                                | id-trap: display id `existing-local-runtime` vs engine id `existing-local-fallback` — never conflate |

### Surface 5 — Pipeline map + system state

| Field                                           | Source                                                                                                                                                                                                           | Class                                                    | Capstone may express                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Live Pipeline Map (stages/edges/lanes)          | `src/components/pipeline/PipelineDiagram.tsx`; route `src/app/audit/pipeline/page.tsx`                                                                                                                           | **DS** (static Phase-21K topology, read-only)            | governance topology, never runtime traffic       |
| PIPELINE/MODEL pills, statusbar posture strings | `WorkingCockpit.tsx:182,188,301,310`                                                                                                                                                                             | **DS** (E-007 uniformly-synthetic pills)                 | labelled synthetic                               |
| CLOCK                                           | `WorkingCockpit.tsx` `useClock` (real `Date`)                                                                                                                                                                    | **LIVE**                                                 | render as-is                                     |
| ROOM / COST / ACTIVITY panels                   | `liquid-command-center-data.ts:410-465` — real observability projections IF `JARVIS_OBSERVABILITY_DB_PATH`/`JARVIS_EVENT_DB_PATH` names an existing sqlite; else synthetic readers; per-panel provenance (E-021) | **CONDITIONAL** (LIVE with DB, honest-synthetic without) | show per-panel provenance; honestly-empty in dev |

---

## What the capstone (Program U) may render as real

- **WorkflowBox lane/map** — real store rows (LIVE) with a `SAMPLE` fallback label (E-019).
- **TTS engine health pill** — real probes (LIVE/SYNTHETIC label) (E-020).
- **Gateway `queue-status.pending_count`** — the one live Gate number, _when a gateway host process is running_ (else honest uniform-deny; no host script exists in `scripts/` yet).
- **CLOCK**, and **ROOM/COST/ACTIVITY** _when_ an observability DB is configured.
- It may **cite** the real Phase-18 approval machinery and the drilled gateway, but must not imply a rendered live gate.

## SHOULD-BE-LIVE gaps (Phase 25 make-live; not Program U's to fabricate)

1. **Real approval gate UI** — `ApprovalCard.tsx` + `HumanReviewQueuePanel.tsx` exist, tested, wired into no route. The make-live seam for a real Human-Gate panel (Phase 25 / a wiring slice).
2. **E-012 live voice fallback** — the drilled Piper fallback + failover audit is demo-director-only; production voice turns don't yet get it. Closes at Phase 25C through the E-011 layer.
3. **Gateway host script** — no `scripts/` entry runs the stdio gateway, so `queue-status` is uniform-deny in dev; standing one up makes `pending_count` live.
4. **Observability feeds** — ROOM/COST/ACTIVITY need a real observability/event DB (Phase 25A/25B) to leave the honest-synthetic fallback.

## Deliberately-synthetic list (governance, not debt — keep and label)

The demo proposal card + gate interaction (local-state demo of the Phase-18 shape), the pipeline topology (ID-4 static governance map), the voice-activity event script (Phase-22 visibility contract), the E-007 uniformly-synthetic status pills, the gateway cadence constant (ID-3), and the whole-cockpit `SYNTHETIC - METADATA-ONLY` frame. Each is correct to stay synthetic; the capstone labels it, never fixes it.

## Scope note

Refreshes the five capstone surfaces of the July ledger against current main + the E-019/E-020/E-021 deltas. Not re-audited (scope discipline, Phase-25 territory): the Rest orb/home surface, the audit sub-cockpits beyond the pipeline map (telemetry, red-team, architecture-graph, governance-boundaries), the `/showcase` cinematic surface (display-only by I-SHOW-1), and the demo-director export UI.

## Closeout status

- **Status:** R.4 light check produced; read-only; additive doc only.
- **Delta since July ledger:** four SI capstone-lie risks CLOSED by E-021 (verified file:line); WorkflowBox lane and TTS pill moved SBD → LIVE by E-019/E-020.
- **Not committed yet:** same gate-13/15 reason as R.1 — the closeout belongs with the R.2 green-baseline on the primary Mac; not run through the full hook on this Windows node.
