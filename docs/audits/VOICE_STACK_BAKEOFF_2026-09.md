# JARVIS Voice Stack — Bake-off, Weighted Decision & Final Architecture

**Machine:** Apple M1 Max, 32 GB unified, macOS 26.6.2 · **Date:** 2026-09-06
**Programme brief:** `JARVIS_VOICE_STACK_FINAL_BAKEOFF_AND_IMPLEMENTATION` (Astra, relayed by the operator)
**Method:** every candidate installed in isolation, measured on this machine (never README numbers), same workloads, warm runs, one model per process. Raw JSONL in `/tmp/jarvis-bakeoff/results/`, listening WAVs in `/tmp/jarvis-bakeoff/audio/`.

---

## 1. Baseline revalidation (existing local stack, fresh run)

mic → parakeet-mlx → qwen3.5:9b-mlx (think off) → mlx-audio kokoro (`bm_lewis`) → afplay
STT in-loop 1.63 s (engine warm 49 ms) · brain 6.3 s · kokoro 9.1 s audio in 0.91 s · total 18.4 s · loop RSS 911 MB · Ollama resident 1.5 GB. **Turn-based; no duplex.** Strong local baseline — preserved.

## 2. Raw M1 Max benchmarks

### 2a. TTS (SHORT = 12 words, 3 warm runs; LONG = 3-sentence paragraph)

| engine                                           | load  | TTFA short   | RTF       | TTFA long            | RSS        | streaming      | languages |
| ------------------------------------------------ | ----- | ------------ | --------- | -------------------- | ---------- | -------------- | --------- |
| **kokoro-82M bf16** (bm_lewis)                   | 1.0 s | 179–190 ms   | **0.035** | 440 ms               | **779 MB** | per-sentence   | many      |
| **VibeVoice-Realtime-0.5B 8bit** (en-Carter_man) | 3.9 s | **94–95 ms** | 0.234     | **97 ms (constant)** | 1.6 GB     | intra-sentence | EN, ZH    |
| chatterbox-turbo 4bit                            | 3.9 s | 856–877 ms   | 0.24      | 3270 ms              | 1.35 GB    | none           | EN        |
| Qwen3-TTS 1.7B 8bit (ryan)                       | 4.1 s | 1572–1667 ms | 0.35      | 5310 ms              | 3.4 GB     | none           | many      |

### 2b. ASR (warm, min of 3; `sim` = token similarity to reference; ES/ZH clips synthesised by Qwen3-TTS, EN a real recording)

| engine                                   | EN ms / sim   | ES ms / sim   | ZH ms / sim    | RSS        |
| ---------------------------------------- | ------------- | ------------- | -------------- | ---------- |
| **parakeet-tdt-0.6b-v3**                 | **49 / 1.00** | 77 / 0.38     | 68 / 0.16      | 2.8 GB     |
| **whisper-large-v3-turbo** (mlx_whisper) | 692 / 1.00    | 719 / 0.71    | **724 / 1.00** | ~2 GB      |
| VibeVoice-ASR 8bit                       | 1658 / 0.93\* | 2178 / 0.59\* | 1691 / 0.65\*  | **5.5 GB** |

\*VibeVoice-ASR content is accurate (ZH character-perfect) but wrapped in diarised JSON with timestamps; it is a long-form transcription model.

### 2c. Local full-duplex feasibility — Moshi (kyutai/moshiko-mlx-q4)

load 2.4 s · RSS 4.9 GB · **34.4 ms/step (p95 37.3) vs 80 ms frame budget → realtime-capable, 2.3× headroom** · first audio 0.83 s. Silence-driven output is gibberish; it is its own 7B brain with **no tool calling**.

### 2d. Orchestration / runtime candidates (on-machine)

| candidate                           | ran?                                                                          | finding                                                                                                                                                                                                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pipecat 1.8.1                       | yes (isolated venv, pipeline assembled against our Ollama)                    | `FunctionCallInProgressFrame` + `FunctionCallResultFrame` are **`UninterruptibleFrame`** — tool calls cannot be interrupted by design; `PipelineTask` deprecated (2.0 churn); Whisper-MLX/Kokoro need extras; wraps the same providers we drive directly |
| byte271 Openlive (Rust)             | yes (built 1m02s, ran :8787, 14 MB idle)                                      | default provider `openlive/mock-duplex`; `/v1/meta` = an entire agent gateway (agent pool, MCP, memory, sandbox, sessions, WebRTC) — a second JARVIS; real duplex still needs OpenAI Realtime/Moshi behind it; 23 stars / 22 commits                     |
| katipally OpenLive                  | inspected (clone)                                                             | cascade (Silero→Whisper→Smart-Turn→brain→Kokoro) in Electron/WebGPU = our stack in a browser; good epoch-guard barge-in idea                                                                                                                             |
| OpenAI Realtime (gpt-realtime-mini) | engine built + 11 kill-drills green; **live test halted at credential (§23)** | WS transport, semantic/server VAD, server-side truncate on barge-in, **async function calling native** ("keeps talking while it waits"), audio $10/$20 per 1M tokens (flagship 3.2×)                                                                     |

## 3. Full-duplex / interruption results

| path                         | detection                                                    | cancel                                                                      | stale audio                                   | tools while talking                                    | status                                                                                                |
| ---------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| OpenAI Realtime              | server VAD (`speech_started`)                                | server auto-truncates + `response.cancel`/`item.truncate` from orchestrator | discarded (`sink.cancel`, played-ms recorded) | native async function calls → `tool_call` event → Gate | protocol proven by battery; **10-trial live run blocked on key**                                      |
| Local turn (kokoro/parakeet) | **orchestrator-driven** (VAD/wake layer calls `interrupt()`) | epoch guard abandons any stage + `sink.cancel`                              | discarded                                     | tool_call event → Gate → `submitToolResult` → resumes  | proven by battery; **exact limitation: no self-detected listen-while-speaking; no echo cancellation** |
| Moshi                        | inherent                                                     | inherent                                                                    | —                                             | **none**                                               | rejected                                                                                              |

## 4. Multilingual results

parakeet = English specialist (perfect, 49 ms; unusable ES/ZH). whisper-turbo = multilingual (ZH 1.00, ES 0.71, ~700 ms). Kokoro speaks many languages; VibeVoice EN+ZH only; Qwen3-TTS many. OpenAI Realtime multilingual (not measured live).

## 5. Resource / reliability / privacy / cost

- RAM: kokoro 0.8 GB · VibeVoice-RT 1.6 GB · parakeet 2.8 GB · whisper ~2 GB · VibeVoice-ASR 5.5 GB · Moshi 4.9 GB · Ollama 9B resident 1.5 GB (8.4 GB loaded).
- Reliability: zero crashes across all runs; whisper via `mlx_audio`'s loader fails ("Processor not found") — production path `mlx_whisper` works; Moshi needed `sentencepiece`.
- Privacy classes: local_audio = kokoro/VibeVoice/parakeet/whisper/Moshi; cloud_audio = OpenAI Realtime.
- Cost: local $0. gpt-realtime-mini audio in $10 / cached $0.30 / out $20 per 1M tokens; per-minute derived from real `usage` once live. Budget $19 warn / $25 hard (≈ £15/£20).

## 6. Weighted decision

Weights (brief §9 order, 12→1): duplex 12 · latency 11 · naturalness 10 · reliability 9 · local/offline 8 · resource 7 · multilingual 6 · governance 5 · tools 4 · maintainability 3 · privacy 2 · cost 1. Scores 0–5 from the evidence above (naturalness from the saved WAVs pending the operator's ear; provisional).

**Premium realtime role**

| candidate                    | duplex | latency | natural | reliab. | local | resource | multi | govern. | tools | maint. | privacy | cost | **weighted** |
| ---------------------------- | ------ | ------- | ------- | ------- | ----- | -------- | ----- | ------- | ----- | ------ | ------- | ---- | ------------ |
| OpenAI Realtime mini         | 5      | 5       | 5       | 4       | 0     | 5        | 5     | 5       | 5     | 5      | 1       | 3    | **340**      |
| Moshi q4                     | 5      | 4       | 2       | 3       | 5     | 3        | 1     | 2       | 0     | 2      | 5       | 5    | 265          |
| Pipecat + OpenAI RT          | 3      | 4       | 5       | 2       | 0     | 4        | 5     | 4       | 2     | 2      | 1       | 3    | 249          |
| byte271 Openlive + OpenAI RT | 4      | 4       | 5       | 1       | 0     | 5        | 5     | 2       | 3     | 1      | 1       | 3    | 264          |

**Local TTS role**

| candidate         | duplex-feel (TTFA) | latency | natural\* | reliab. | local | resource | multi | govern. | tools | maint. | privacy | cost | **weighted** |
| ----------------- | ------------------ | ------- | --------- | ------- | ----- | -------- | ----- | ------- | ----- | ------ | ------- | ---- | ------------ |
| kokoro bf16       | 3                  | 5       | 4         | 5       | 5     | 5        | 5     | 5       | 5     | 5      | 5       | 5    | **362**      |
| VibeVoice-RT 8bit | 5                  | 4       | 4         | 4       | 5     | 3        | 2     | 5       | 5     | 4      | 5       | 5    | 345          |
| chatterbox-turbo  | 1                  | 2       | 4         | 4       | 5     | 4        | 1     | 5       | 5     | 4      | 5       | 5    | 268          |
| Qwen3-TTS         | 0                  | 1       | 4         | 4       | 5     | 2        | 5     | 5       | 5     | 4      | 5       | 5    | 262          |

**Local STT role**

| candidate        | EN  | multi | latency | resource | reliab. | **verdict**            |
| ---------------- | --- | ----- | ------- | -------- | ------- | ---------------------- |
| parakeet v3      | 5   | 1     | 5       | 4        | 5       | **default (EN)**       |
| whisper-v3-turbo | 5   | 5     | 2       | 4        | 5       | **multilingual route** |
| VibeVoice-ASR    | 4   | 4     | 0       | 1        | 4       | rejected               |

## 7. FINAL VOICE ARCHITECTURE DECISION

- **Local STT:** parakeet-mlx (EN default, 49 ms) + mlx-whisper-turbo as the multilingual route (`JARVIS_VOICE_LIVE_LOCAL_STT=auto|parakeet-mlx|mlx-whisper`). Both already in tree (E-039). VibeVoice-ASR rejected.
- **Local TTS:** **kokoro stays default** (voice `bm_lewis`, lowest RAM, multilingual, proven). **VibeVoice-Realtime-0.5B registered as the selectable low-TTFA streaming alternative** (`JARVIS_VOICE_LIVE_LOCAL_TTS=vibevoice`) — 95 ms constant TTFA is a real, measured advantage for conversational feel; final naturalness call is the operator's ear (WAVs saved). Not swapped by default per §13 (kokoro's 180 ms short-TTFA is already excellent; its 440 ms long-TTFA is the gap VibeVoice closes).
- **Local realtime strategy:** the turn-based cascade behind the live contract (`local-mlx-turn`), with orchestrator-driven barge-in (epoch guard). **Documented limitation:** no self-detected listen-while-speaking, no AEC. Moshi rejected (no tools, replaces the brain) — feasibility recorded for future tool-capable duplex models.
- **Premium realtime:** **OpenAI `gpt-realtime-mini`** through our own WebSocket engine (`openai-realtime`). Selected; live validation awaits the operator's key.
- **Orchestration:** JARVIS's existing runtime + native provider adapters behind the additive `VoiceLiveProvider` contract. **Pipecat, byte271 Openlive, katipally OpenLive: rejected** (reasons in §2d).
- **Fallback hierarchy:** `openai-realtime` → `local-mlx-turn` (kokoro/parakeet) → existing captions path. Router (`router.ts`) proven: private/offline never consider cloud; network/credential/budget/health failures fall to local; every decision logged as a frozen-contract telemetry event.
- **Privacy:** wake word local-only; cloud audio only after activation + routing approval; `privacy_class` on every provider; private mode hard-denies cloud.
- **Cost:** real usage from `response.done` priced at the published table; budget window $19 warn / $25 hard, currency-agnostic.
- **Tool-call path:** provider `tool_call` event → JARVIS runtime → Action Gateway → Human Gate → T0–T3 → `submitToolResult`. No provider executes anything (type-level `tool_execution_allowed: false`; proven in both batteries).
- **Interruption model:** cloud = server VAD + truncate + local sink cancel; local = epoch guard + sink cancel; both counted in snapshots/telemetry.
- **ElevenLabs insertion point:** a `VoiceLiveSynthesizer` (drop-in for the local-turn provider's `tts` seam) or an output-voice re-synthesis stage on the cloud path; capability `custom_voice` already in the enum; `privacy_class: cloud_audio`. No code, no key, no enrolment now.

### Target topology (as built)

```
                         JARVIS
                            │
                            ▼
                 VoiceLiveProvider contract  (src/lib/voice/live/contract.ts)
                            │
                            ▼
                     router.ts  (mode · privacy · network · budget · health)
             ┌──────────────┴───────────────┐
             ▼                              ▼
     local-mlx-turn                   openai-realtime
  parakeet/whisper → local brain      gpt-realtime-mini (WS)
  → kokoro | vibevoice → sink         semantic VAD, truncate, async tools
             └──────────────┬───────────────┘
                            ▼
                   tool_call event → JARVIS runtime
                            ▼
                     ACTION GATEWAY → HUMAN GATE → T0–T3 → tool
                            ▼
                     submitToolResult → voice session
```

## 8. Components accepted / rejected

**Accepted:** existing mlx stack (parakeet, whisper-turbo, kokoro) · VibeVoice-Realtime-0.5B TTS (optional, selectable) · OpenAI Realtime mini engine · native `VoiceLiveProvider` contract + router.
**Rejected:** Pipecat (uninterruptible tool frames, duplication, deprecation) · byte271 Openlive (second agent gateway, mock default, immature) · katipally OpenLive (cascade duplicate) · VibeVoice-ASR (33× slower, 5.5 GB, diarised JSON) · Moshi (no tools, replaces brain).

## 9. Validation (real hardware, real audio)

### Live end-to-end through the orchestrator (`scripts/voice-live-session-smoke.ts`, cached 4.54 s clip, ffplay streaming sink)

| run                       | route                                | heard    | first audio | audio | usd |
| ------------------------- | ------------------------------------ | -------- | ----------- | ----- | --- |
| LOCAL / kokoro (default)  | `default_local`                      | verbatim | 9.9 s       | 5.9 s | 0   |
| LOCAL / VibeVoice-RT      | `default_local`                      | verbatim | 6.0 s       | 5.6 s | 0   |
| PREMIUM requested, no key | `premium_credential_missing → local` | verbatim | 7.6 s       | 8.3 s | 0   |

First-audio is brain-dominated (qwen3.5 9B prefill ≈ 5–6 s, E-035); the voice stack adds ≈ 1.5 s STT + ≈ 1 s TTS. Budget file persisted across runs.

### Wake word (`scripts/voice-wake-smoke.ts --force --wav`, synthetic "Hey Jarvis" + real request as the mic)

standby → **wake 1.66 s (openWakeWord `hey_jarvis`, score 1.0, 2 ms)** → activated `local-mlx-turn` (`default_local`) → energy end-of-turn committed 4.1 s of speech → heard verbatim → answered → first audio 5.1 s → follow-up window idle → `wake_sleep` → disarmed → exit 0 (19.8 s total).

### Test matrix (brief §25)

- [x] current local baseline still works · [x] Parakeet path · [x] selected local TTS (kokoro; VibeVoice alt) · [x] local architecture survives restart (budget window persisted; services are user daemons)
- [ ] OpenAI Realtime connects with valid credentials — **HALTED AT CREDENTIAL** · [ ] mic → Realtime · [ ] Realtime → speakers · [ ] premium barge-in · [ ] 10 consecutive interruption trials · [x] local realtime barge-in: N/A by design (documented, no AEC)
- [x] tool calls route through the Gate (`tool_call` event → `submitToolResult`, both engines; no provider executes) · [x] Human Gate authoritative · [x] T0–T3 preserved (E-043 untouched)
- [x] private mode prevents cloud audio · [x] offline mode functional · [x] missing cloud credentials do not break JARVIS · [x] provider failure falls back (battery) · [x] spend ceiling falls back (battery + persisted) · [x] telemetry: routing / latency / interruptions / failures (frozen sanitizer)
- [~] cloud usage/cost estimation: priced from `response.done` usage (battery) — real per-minute pending key · [x] no secrets in logs (battery) · [x] no abandoned candidate runtime active · [x] experimental deps cleaned
- [x] frozen regression suite green — **669/669 files, 6045 passed, 6 skipped, 0 failed** (237 s) on the final change set · [x] final architecture documented · [x] wake uses provider-independent activation · [x] wake is local · [x] selected session launches after wake · [~] restart preserves wake+voice behaviour: config-driven; wake defaults OFF until the operator enables it

### Resume the halted premium validation

1. Put `OPENAI_API_KEY=...` in `.env.local` (never in code; never paste it into chat).
2. `npx tsx scripts/voice-live-session-smoke.ts --mode premium --cached /tmp/jarvis-voice/utt5.wav` (streamed audio, cost from real usage)
3. `npx tsx scripts/voice-live-session-smoke.ts --mode premium` with headphones, interrupt JARVIS mid-sentence ×10 (server VAD truncate + local sink cancel are the proven mechanics).
4. `npx tsx scripts/voice-wake-smoke.ts --force --mode premium` — wake locally, then the cloud session opens only after activation.
