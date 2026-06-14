# Phase 22 Extraction Map — a0064efa → main

- **Date:** 2026-06-12
- **Refs:** source `a0064efa` (unreal-gauntlet-lab checkpoint), target `main` (`6fba9990`), worktree `../jarvis-main`
- **Total changed paths in `git diff main a0064efa`:** 409

## GATE VERDICT: AMBIGUOUS bucket is NON-EMPTY (10 paths) — extraction halted per instruction. Nothing checked out, nothing staged.

## Bucket summary

| Bucket                                               | Count   |
| ---------------------------------------------------- | ------- |
| VOICE (Phase 22 — extractable under E-001)           | 16      |
| UNREAL/GAUNTLET (excluded always)                    | 379     |
| EXCLUDED — frozen-phase test files (excluded always) | 4       |
| AMBIGUOUS (requires owner ruling)                    | 10      |
| **Total**                                            | **409** |

## VOICE — 16 paths (verified self-contained: no imports from excluded paths)

| Status | Path                                                  | Note                                                                                                               |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A      | `PHASE22_VOICE_OVERHAUL.md`                           | Phase 22 program doc                                                                                               |
| A      | `config/voice/standing-consent.yaml`                  | `phase22.voice.standing-consent.v1`, T0–T3 consent entries                                                         |
| M      | `docs/voice/CHATTERBOX_SETUP.md`                      | setup + fallback chain docs                                                                                        |
| A      | `docs/voice/PHASE22_RUNTIME.md`                       | runtime doc                                                                                                        |
| A      | `src/lib/tts/chatterbox-provider.ts`                  | Chatterbox/Kokoro HTTP provider incl. health check                                                                 |
| A      | `src/lib/tts/chatterbox-provider.test.ts`             | provider tests                                                                                                     |
| M      | `src/lib/tts/index.ts`                                | additive re-exports only                                                                                           |
| M      | `src/lib/tts/registry.ts`                             | additive registration, both providers registered `enabled: false, status: "unavailable"` — designed extension seam |
| A      | `src/lib/voice-operating-mode/authority.ts`           | T0–T3 voice authority, `isVoiceT3ExecutionForbidden`                                                               |
| A      | `src/lib/voice-operating-mode/conversation-state.ts`  | session lifecycle                                                                                                  |
| A      | `src/lib/voice-operating-mode/index.ts`               | public exports                                                                                                     |
| A      | `src/lib/voice-operating-mode/pipeline-visibility.ts` | voice pipeline event model (metadata-only)                                                                         |
| A      | `src/lib/voice-operating-mode/standing-consent.ts`    | consent YAML parser                                                                                                |
| A      | `src/lib/voice-operating-mode/voice-stack.ts`         | stack state; declares faster-whisper 1.2.1 + openwakeword 0.6.0                                                    |
| A      | `src/lib/voice-operating-mode/wake-word.ts`           | openWakeWord ONNX integration                                                                                      |
| A      | `tests/voice-operating-mode/phase22.test.ts`          | Phase 22 test suite (new file, not a frozen-phase test)                                                            |

**faster-whisper wiring diffs: NONE.** `git diff main a0064efa -- src/lib/voice-runtime src/lib/stt src/lib/voice-streaming scripts/voice` is empty — the STT provider already lives on main; Phase 22 added no diffs there.

## UNREAL/GAUNTLET — 379 paths (excluded always; not listed exhaustively)

| Group                                       | Count | Note                                                                                                                                                                                                          |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/**`                                  | 286   | unreal-mcp + mcp-unreal-remiphilippe imports                                                                                                                                                                  |
| `unreal/**`                                 | 60    | JarvisGauntlet project files                                                                                                                                                                                  |
| `docs/unreal/**`                            | 24    | gauntlet pipeline docs/screenshots                                                                                                                                                                            |
| `scripts/unreal/**`                         | 6     | build/verify/capture scripts                                                                                                                                                                                  |
| `.agents/skills/unreal-screenshot/SKILL.md` | 1     | unreal skill                                                                                                                                                                                                  |
| `.gitignore` (M)                            | 1     | delta is exclusively Unreal/MCP-tool ignore rules                                                                                                                                                             |
| `.gitattributes` (A)                        | 1     | **WARNING:** lab-only LFS rules covering `*.uasset/*.umap/*.fbx` AND repo-wide `*.wav/*.mp4/*.png/*.jpg`. Merging this to main would LFS-convert every future image/audio commit. Keep out of any extraction. |

## EXCLUDED — frozen-phase test files — 4 paths (excluded always per instruction)

| Status | Path                              | Lab delta                               |
| ------ | --------------------------------- | --------------------------------------- |
| M      | `tests/audit/shell.test.tsx`      | +4 (asserts new voice section)          |
| M      | `tests/orb/render.test.tsx`       | +13 (reactor-state assertions)          |
| M      | `tests/pipeline-diagram.test.tsx` | +13 (voice-activity section assertions) |
| M      | `tests/working/shell.test.tsx`    | +1                                      |

## AMBIGUOUS — 10 paths (gate-tripping; owner ruling required)

| Status | Path                                                      | Why ambiguous                                                                                                                                                                                                                                                                    |
| ------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M      | `src/components/audit/AuditCockpit.tsx`                   | Adds read-only VOICE ACTIVITY section. Voice intent, but modifies a frozen Phase 21 surface — outside E-001's "none (new modules)" scope; its assertion updates live in excluded `tests/audit/shell.test.tsx`.                                                                   |
| M      | `src/components/command-center/RestCommandCenter.tsx`     | Changes wake mode `explicit_local_visual_wake` → `openwakeword_local_onnx`, adds 7-state voice reactor machine, changes visible copy ("TAP ONCE TO ENABLE VOICE" → "HEY JARVIS YOU UP"). Behavioral change to a frozen surface; paired test deltas excluded.                     |
| M      | `src/components/command-center/liquid-command-center.css` | +105 lines styling for the voice reactor/sections; meaningless without the two components above.                                                                                                                                                                                 |
| M      | `src/components/pipeline/PipelineDiagram.tsx`             | Adds voice-activity section importing `voice-operating-mode/pipeline-visibility`. This is exactly the /audit/pipeline presentation surface named by **E-002 (PROPOSED, not approved)**.                                                                                          |
| M      | `src/components/working/WorkingCockpit.tsx`               | Imports voice visibility model into frozen Working surface; test delta excluded.                                                                                                                                                                                                 |
| M      | `src/lib/command-center/liquid-command-center-data.ts`    | Changes the existing view-model **type contract** (`wakeMode` literal, new `VOICE` tag in a closed union, new required fields). Extracting components without this breaks compile; extracting it without components leaves type drift. All-or-nothing with the five files above. |
| A      | `tmp/pipeline-command-center/audit.png`                   | Git-LFS pointer artifact (screenshot) under `tmp/`; depends on excluded `.gitattributes`; neither voice module nor unreal. Recommend exclude.                                                                                                                                    |
| A      | `tmp/pipeline-command-center/pipeline.png`                | same                                                                                                                                                                                                                                                                             |
| A      | `tmp/pipeline-command-center/rest.png`                    | same                                                                                                                                                                                                                                                                             |
| A      | `tmp/pipeline-command-center/working.png`                 | same                                                                                                                                                                                                                                                                             |

**Why the six UI files cannot silently ride along:** extracting them without their (excluded) test updates risks failing main's existing frozen-phase tests against changed copy/contracts; extracting the tests violates the exclusion rule; and E-001 explicitly declares no frozen surface is touched. They form a coherent second tranche — "Phase 22 UI visibility integration" — that needs its own registry entry (or an E-001 scope amendment) before staging.

## Per-file hunk verdicts (E-001 as amended 2026-06-12 — rulings received)

Method: every hunk of `git diff main a0064efa` per file classified VOICE-VISIBILITY or OTHER; frozen-test compatibility predicted from the lab-side diffs of the four excluded frozen test files (additive-only lab test diff ⇒ main's unmodified assertions pass against the lab component).

| File                                                      | Hunks                                                                                                                                                                                                                                                                                         | Verdict         | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/components/audit/AuditCockpit.tsx`                   | 1/1 VOICE-VISIBILITY (read-only VOICE ACTIVITY section; attrs avoid forbidden words; no handlers)                                                                                                                                                                                             | ALL VOICE       | EXTRACT WHOLE                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/components/working/WorkingCockpit.tsx`               | 3/3 VOICE-VISIBILITY (import, fallback VOICE activity line, fallback voiceActivity field)                                                                                                                                                                                                     | ALL VOICE       | EXTRACT WHOLE                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/components/pipeline/PipelineDiagram.tsx`             | 3/3 VOICE-VISIBILITY (import, optional voiceModel prop, display-only voice-activity section — `<ul>/<li>`, no controls)                                                                                                                                                                       | ALL VOICE       | EXTRACT WHOLE                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/components/command-center/liquid-command-center.css` | 3/3 VOICE-VISIBILITY (reactor-state orb styling, reactor chips, `.jcc-voice-row`). Reactor selectors are dormant until Rest lands — harmless unused CSS                                                                                                                                       | ALL VOICE       | EXTRACT WHOLE                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/command-center/liquid-command-center-data.ts`    | 15 hunks, all VOICE-VISIBILITY by content; 5 are Rest-coupled (RestVoiceReactorState type, Rest model interface change incl. `wakeMode` literal + 4 new required fields, PHASE22_REACTOR_STATES const, both Rest model constructions) and would type-break main's untouched RestCommandCenter | MIXED IN EFFECT | FILTERED: apply 10 hunks (Working/Audit voiceActivity fields + constructions, VOICE activity tag, audit disabled-features wording, voice imports trimmed to the 2 used names); DEFER 5 Rest-coupled hunks with the Rest halt                                                                                                                                                                                                                                                   |
| `src/components/command-center/RestCommandCenter.tsx`     | All hunks voice-state visibility by content (wake mode, 7-state reactor display, wake-phrase copy, stack readout)                                                                                                                                                                             | **HALT**        | NOT EXTRACTED. Main's frozen `tests/orb/render.test.tsx` asserts the literal copy "TAP ONCE TO ENABLE VOICE" (lab replaces it) and a source-purity regex forbidding `/provider/i` over RestCommandCenter source (lab adds `selected_provider`). The lab branch itself had to MODIFY those frozen assertions — that test amendment is excluded by rule. Rest extraction needs its own registry entry (suggest E-006: amend tests/orb/render.test.tsx + Rest reactor visibility) |

Deferred with the Rest halt (re-apply when E-006 lands): data-file hunks H2/H3/H7/H8/H12 (Rest type + interface + const + two constructions).

## E-006 execution record (2026-06-12)

Rulings: orb-test copy assertion amended (ONLY change in that file); `/provider/i` purity regex RETAINED byte-identical; Rest carries ZERO provider symbols.

| Item                         | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/orb/render.test.tsx`  | One line amended: `"TAP ONCE TO ENABLE VOICE"` → `"HEY JARVIS YOU UP"`. Purity regexes, titles, and every other assertion untouched.                                                                                                                                                                                                                                                                                                                                                                                       |
| Data file deferred hunks (5) | Re-applied REWORKED: `RestVoiceReactorState` type, Rest model interface (`wakeMode: "openwakeword_local_onnx"`, `reactorState`, `reactorStates`, `pipelineEvents`), `PHASE22_REACTOR_STATES`, both Rest constructions. **`stack: SystemVoiceStackRuntimeState` stripped everywhere** (provider-derived).                                                                                                                                                                                                                   |
| `RestCommandCenter.tsx`      | Lab changes applied MINUS provider symbols: kept wake attrs (`openwakeword-local-onnx`, wake phrase, `data-pre-wake-audio-storage="false"`), reactor state machine + chips (display-only spans on the existing orb tap target — no new affordances), `HEY JARVIS YOU UP` copy, `REACTOR_COPY`/`nextReactorState` helpers. **Stripped:** voice-stack import, `stack` field, `data-voice-stack-selected`, footer `VOICE <b>…</b>` readout, `voiceStackLabel()` (carried provider IDs). Zero `/provider/i` matches in source. |
| Working TTS readout (new)    | Working voiceActivity did not show the active TTS provider → added display-only `StatusPill label="TTS"` + `data-voice-tts-provider` attr on WorkingCockpit root, fed by `buildSystemVoiceStackRuntimeState().selected_provider` (deterministic synthetic default: `existing-local-runtime`). WorkingCockpit is outside the Working shell test's `/provider/i` source scope; rendered value trips no HTML ban.                                                                                                             |

## Phase 22 closeout checks (report-only findings, 2026-06-12)

**(a) Kokoro runtime presence: REGISTERED, NOT INSTALLED.**

- Health probe `http://127.0.0.1:8880` (DEFAULT_SYSTEM_KOKORO_URL): connection refused.
- No `JARVIS_KOKORO_URL` env override set; no install path referenced anywhere in repo/config — only the URL constant (`src/lib/tts/chatterbox-provider.ts:15`) and the setup doc mention (`docs/voice/CHATTERBOX_SETUP.md:76`).
- Registry registration already `enabled: false, status: "unavailable"`; marking comment added at the registration site (`src/lib/tts/registry.ts`).

**(b) Failover drill: DONE — proven live 2026-06-14 (was SKIPPED on 2026-06-12).**

- Chatterbox was commissioned (serves `http://127.0.0.1:8004`) and the kill-mid-drill executed: killed Chatterbox, re-ran `npm run demo:export`; the demo-director narration chain emitted `voice_provider_failover` (chatterbox→kokoro), `voice_provider_failover` (kokoro→existing-local-fallback), and `voice_provider_selected` (existing-local-fallback), and a Piper terminal provider synthesized all 23 narration WAVs (ear-confirmed intelligible). Commits: synthesis `6e19fbe` (23G-2), audit `e19501f` (23G-3); registry E-010 → CLOSED-PROVEN-BY-DRILL.
- The live CLI audit path logs these metadata-only events to stdout (the tsx CLI cannot reach the `server-only` sqlite DB); sqlite persistence via `recordEvent` is covered by the server path and the I-23G3-2 unit round-trip. NOTE: this is the demo-director chain; the system voice-stack (`voice-stack.ts`) selection logic is still fixture-based — wiring the real fallback into the live voice runtime is tracked as E-012.

## Ready-to-run extraction (after owner rules on AMBIGUOUS)

```
git checkout a0064efa -- PHASE22_VOICE_OVERHAUL.md config/voice/standing-consent.yaml docs/voice/CHATTERBOX_SETUP.md docs/voice/PHASE22_RUNTIME.md src/lib/tts/chatterbox-provider.ts src/lib/tts/chatterbox-provider.test.ts src/lib/tts/index.ts src/lib/tts/registry.ts src/lib/voice-operating-mode tests/voice-operating-mode/phase22.test.ts
```

(Run inside `../jarvis-main` only.)
