# Expansion Era Refresh

> **SUPERSEDED (2026-09-01)** by the JARVIS Master Architecture & Delivery Roadmap v5.1.
> This 03-Jun-2026 status-normalization doc predates the Phase 22/23/24 execution and its
> forward numbering (24 = "local T2 model promotion", 25 = "RuView sensing / Real CAI",
> 26 = "mobile JARVIS via Tauri iOS") was superseded when Phase 24 opened and froze as the
> MCP Gateway. Retained for history only; do NOT use its phase numbering. Authoritative v5
> numbering: 25 = Productionization, 26 = Presence/Voice, 27 = Vision/Spatial,
> 28 = Local Intelligence/Council, 29 = Smart Room, 30 = Mobile/Node Fabric.
> See docs/audits/V5_ENTRY_AUDIT.md §1.

Status: complete after Phase 21 closeout  
Date: 03 June 2026  
Scope: documentation and status normalization only

## 1. Executive Summary

Phase 21 closed successfully. The repository moved beyond the original Expansion Era foundation plan and now contains several governed execution-enabled workflows, one operationally validated runtime workflow, and read-only realization surfaces that preserve the Phase 1-20 governance substrate.

This refresh reconciles the original Expansion Era roadmap with the actual repository state. Public git history remains intact. The refresh does not start Phase 22, does not start UI implementation, does not install UI dependencies, and does not change runtime behavior beyond status truth in the Phase 21 realization report.

The strongest current classification is:

- Phase 21E Social Media Extraction is operationally validated.
- 21B, 21C, 21F, 21G, 21H, and 21I are execution enabled through governed boundaries.
- 21A, 21D, 21J, and 21K are realized through inspectable or user-visible workflow/data surfaces.
- MacBook-dependent work remains deferred.
- UI refurbishment is now the correct next program before Phase 22.

## 2. Phase 21 Final Verdict

Verdict: PASS.

Phase 21 may close because all 21A-21K areas have an implemented closeout reality and no remaining avoidable scaffold-only blocker. The final audit-discovered gap was 21E Social Media Extraction. It is now implemented and operationally validated through a real smoke path:

```text
public YouTube URL
-> yt-dlp download
-> ffmpeg audio/frame extraction
-> faster-whisper transcript
-> multimodal packet
-> deterministic analysis
-> temp workspace cleanup
```

Governance still holds:

- no silent writes
- no auto-execution
- no approval bypass
- no raw payload telemetry
- no hidden cloud escalation
- no background sync
- no graph-driven execution

## 3. Capability Classification Table

| Area                        | Strongest true classification | Reason                                                                                                                                                                                                                                       |
| --------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21A Verification Agent      | Realized                      | Advisory verification contract, planner, injected executor, live diagnostic path, confidence/caveat/risk metadata, and UI confidence surface exist. It cannot rewrite answers or approve actions.                                            |
| 21B Google Stack            | Execution Enabled             | Gmail/Calendar/Drive T0 reads exist; Gmail draft/send and Calendar create exist through injected action adapters and approval or consent gates. Drive writes remain forbidden.                                                               |
| 21C Morning Brief           | Execution Enabled             | Supplied Google metadata can be composed into deterministic brief previews, Suggestion Inbox payloads, and scheduler invocation metadata. No daemon, auto-send, live adapter call inside composer, or approval finalization exists.          |
| 21D Telegram                | Realized                      | Single-user text transport, inbound parser, router envelope, conversation state, dry-run reply plan, and injected sender boundary exist. It is transport-only.                                                                               |
| 21E Social Media Extraction | Operationally Validated       | Real local smoke passed with yt-dlp, ffmpeg/ffprobe, faster-whisper, packet assembly, deterministic analysis, metadata-only telemetry, and temp cleanup.                                                                                     |
| 21F Live Council            | Execution Enabled             | Opt-in cost-gated provider planning, injected runner dispatch, independent answers, anonymous peer review, chairman synthesis, and advisory final answer exist. No tool or approval authority exists.                                        |
| 21G Knowledge Compounding   | Execution Enabled             | Vault metadata candidate selection, vault-sourced draft generation, approval-gated write planning, injected approved writer execution, path validation, and bounded re-index metadata exist. No scheduler mutation or gateway bypass exists. |
| 21H Agent Suite             | Execution Enabled             | Eight preview agents can produce scheduled Suggestion Inbox delivery items through supplied metadata and injected boundaries. No live reads, model calls, direct side effects, or approval finalization exists.                              |
| 21I Job Scout               | Execution Enabled             | Feed ingestion, normalization, ranking, digest generation, tracking, cover-letter planning, acquisition policy gates, form-fill previews, final confirmation, and fakeable submission adapters exist. No auto-apply exists.                  |
| 21J Graphify                | Realized                      | Supplied Graphify-compatible graph data can be normalized and overlaid against designed architecture metadata. It is read-only and not governance truth.                                                                                     |
| 21K Pipeline Visualization  | Realized                      | Read-only pipeline/governance visualization model with authority surfaces, approval boundary visibility, Graphify overlay, and discrepancy metadata exists. It cannot execute or approve.                                                    |

## 4. Roadmap vs Implementation Reconciliation

The original Expansion Era plan was explicitly "real over scaffold." In practice, early Phase 21 slices still began as contracts, planners, previews, and closeout guards. Later passes corrected this by adding realization layers and execution gates where a capability needed real value.

Important reconciliation points:

- 21B, 21G, and 21I were bundled into a late realization pass because Google actions, Knowledge Compounding vault writes, and Job Scout submission planning were all still at the workflow boundary.
- 21E was discovered by the final closeout audit as missing. It was implemented and then operationally validated before this refresh.
- Council Mode moved from workflow-complete advisory fixtures to an opt-in live provider reasoning workflow through injected provider runners and cost gates.
- Telegram became a realized inbound transport, not Telegram automation.
- Graphify became a read-only architecture data source, not governance truth.
- Public git history was not rewritten. The out-of-order realization sequence is documented here instead of hidden.

## 5. Out-of-Order Realization Explanation

Phase 21 did not land in the neat sequence described by the original roadmap. That is acceptable because the core governance rule was preserved: close only when the strongest required capability is actually true.

The main deviations were:

1. 21B/21G/21I were completed together as an execution-gate realization pass.
2. 21E was identified by closeout audit after other workflow areas had already landed.
3. 21F-R was realized before the final 21E closeout fix.
4. UI polish foundation work happened before the dedicated UI Polish Program, but no UI implementation was started.
5. MacBook-only phases remained deferred despite some adjacent foundations being ready.

## 6. Current Operational Capability List

Current operational or execution-enabled capability areas:

- DeepSeek V4 local-dev live testing through governed override.
- Obsidian pull-only indexing and local semantic retrieval.
- Approval-gated Knowledge Compounding vault write path through injected writer.
- Google T0 reads plus approval/consent-gated Gmail and Calendar actions.
- Morning Brief Suggestion Inbox delivery workflow.
- Agent Suite scheduled suggestion delivery workflow.
- Job Scout supervised acquisition and application workflow through human approval boundary.
- Council Mode opt-in live provider reasoning workflow through injected runner and cost gate.
- Social Extraction local smoke with yt-dlp, ffmpeg, faster-whisper, packet assembly, analysis, and cleanup.

Current realized read-only or advisory surfaces:

- Verification Agent advisory metadata and UI confidence surface.
- Telegram text inbound transport.
- Graphify architecture overlay.
- Pipeline visualization governance surface.

## 7. Remaining Setup and Machine-Dependent Capabilities

Operational setup that remains machine-dependent:

- `yt-dlp`, `ffmpeg`, `ffprobe`, Python, and `faster-whisper` for 21E.
- Deno may be needed for future YouTube extraction if yt-dlp's JavaScript runtime warning becomes blocking.
- `DEEPSEEK_API_KEY` and `JARVIS_ENABLE_DEEPSEEK_LIVE=true` for local DeepSeek live tests.
- Obsidian vault path and local embedding runtime for vault indexing/semantic retrieval.
- Google OAuth credentials and local token handling for live Google reads/actions.
- Local model and voice calibration once the MacBook arrives.

## 8. Deferred MacBook-Dependent Work

These remain deferred until the MacBook phase opens:

- Phase 22 voice overhaul: local wake word, conversation mode, standing consent, voice authority tier enforcement.
- Phase 23 video vision and real camera path.
- Phase 24 local T2 model promotion and Apple Silicon calibration.
- Phase 25 RuView sensing, identity gating, and Real CAI Execution if explicitly opened.
- Phase 26 mobile JARVIS through Tauri iOS.

## 9. UI Polish Readiness Decision

UI Polish should happen next, before Phase 22.

The repo contains `DESIGN.md`, `PRODUCT.md`, and the Impeccable design foundation prompt. It does not contain a separate JARVIS UI Polish Plan document under docs. Therefore:

- `DESIGN.md` is the current repo-owned design foundation.
- The externally supplied JARVIS UI Polish Plan should be added to docs before UI implementation begins.
- No UI dependency should be installed during this refresh.
- No UI route or component should be redesigned during this refresh.

Minimum UI program sequence:

1. UI.1 interface-design readiness and installation decision.
2. UI.2 design tokens.
3. UI.3 typography.
4. UI.4 remove the generic chatbot composition.
5. UI.5 motion system.
6. UI.6 orb state machine.
7. UI.8 cockpit layout.

## 10. Expansion Era v2 Roadmap

The v2 roadmap is:

1. Close this refresh.
2. Start the UI Polish Program as a separate governed implementation program.
3. Run visual QA on the redesigned surfaces.
4. Only then open Phase 22 voice overhaul.
5. Keep MacBook-dependent work behind MacBook readiness.
6. Keep Real CAI Execution behind a separate explicit phase opening.

See [EXPANSION_ERA_V2.md](EXPANSION_ERA_V2.md) for the post-refresh roadmap.

## 11. Next Recommended Sequence

Recommended next prompt:

```text
Implement UI.1 - interface-design readiness and design token inventory.
Audit existing UI tokens, confirm whether interface-design should be installed, add no broad redesign, and prepare the UI Polish Program foundation.
```

Do not start Phase 22 until UI Polish closeout is complete.
