# Bringing JARVIS up on an Apple Silicon Mac (second-person bring-up)

**Verified 2026-09-06** on the primary machine: MacBook Pro M1 Max, 32 GB unified memory, macOS 26.6.2. Roadmap v5.1 §10 slice **25D** exit: _a second person could bring JARVIS up from this document_. Everything below is loopback / local-first; no cloud key is required for any step.

Measured envelope (registry E-035 / E-044): qwen3.5:9b-mlx loads in 2.5 s, 8.4 GB resident, ~45 tok/s; kokoro TTS first-audio ~180 ms; parakeet STT ~49 ms on English; a full local voice turn is 6–10 s, dominated by the brain's prefill.

## 0. What needs a human at the keyboard (and why)

| step                                | why                                                                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Homebrew install                    | needs an interactive `sudo`                                                                                                        |
| first microphone / camera use       | macOS TCC permission popups only appear for a real app — **run the smokes from Terminal.app**, not from an IDE/agent-spawned shell |
| any cloud key (`OPENAI_API_KEY`, …) | optional; you set it in `.env.local` yourself, never in code                                                                       |

## 1. Toolchain

```bash
xcode-select -p || xcode-select --install          # Command Line Tools (better-sqlite3 builds against them)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"   # interactive sudo
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zprofile && source ~/.zprofile
brew install ffmpeg yt-dlp ollama python@3.12        # ffmpeg 9.x (ffplay/ffprobe included), yt-dlp, Ollama 0.33+, Python 3.12
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
. ~/.nvm/nvm.sh && nvm install --lts                 # Node 24 LTS or newer (26.x verified)
```

## 2. Repository

> **Where you clone matters.** macOS TCC blocks background LaunchAgents from reading
> `~/Desktop`, `~/Documents` and `~/Downloads`. A repo cloned there runs fine from a
> terminal, but the voice server _as a service_ (§5) fails with `Operation not permitted`
> (exit 126) — verified 2026-09-06. Clone to a non-protected folder such as `~/JARVIS`
> or `~/dev/JARVIS` if you want the service; if the repo must live on the Desktop, start
> the server from a terminal instead (`bash scripts/voice/mlx-audio-server.sh &`).

```bash
git clone https://github.com/princeanozie25-web/JARVIS.git ~/JARVIS && cd ~/JARVIS
. ~/.nvm/nvm.sh && npm install
cp .env.example .env.local                           # every value empty/loopback = fail-closed
touch node_modules/.metadata_never_index             # keep Spotlight off node_modules (test speed)
```

## 3. Python runtimes (two venvs, both gitignored)

```bash
# faster-whisper (frozen Phase 14 fallback STT) — the CLT Python 3.9 is fine
python3 -m venv .venv && .venv/bin/pip install -r runtimes/requirements-vision.txt

# Apple-native voice stack — Python 3.12
python3.12 -m venv .venv-mlx
.venv-mlx/bin/pip install -r runtimes/requirements-mlx.txt
.venv-mlx/bin/python -m spacy download en_core_web_sm   # kokoro's English G2P
touch .venv/.metadata_never_index .venv-mlx/.metadata_never_index
```

`.env.local`: `JARVIS_STT_PYTHON_COMMAND=<repo>/.venv/bin/python` and `JARVIS_STT_MLX_PYTHON_COMMAND=<repo>/.venv-mlx/bin/python`.

## 4. Models (≈ 44 GB on disk as measured)

```bash
brew services start ollama                            # user LaunchAgent, 127.0.0.1:11434
ollama pull qwen3.5:9b-mlx                            # the default local brain (8.9 GB)
ollama pull qwen3.5:27b-mlx                           # optional: council/code (19 GB)
ollama pull gemma4:12b-mlx                            # optional (7.7 GB)
npx tsx scripts/model-fit-gate.ts qwen3.5:9b-mlx      # measures load / RAM / tok/s / first token

# voice models into the Hugging Face cache (~5 GB)
.venv-mlx/bin/python - <<'PY'
from huggingface_hub import snapshot_download
for r in ["mlx-community/parakeet-tdt-0.6b-v3","mlx-community/whisper-large-v3-turbo",
          "mlx-community/Kokoro-82M-bf16","mlx-community/VibeVoice-Realtime-0.5B-8bit",
          "mlx-community/chatterbox-turbo-4bit","mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit"]:
    print(snapshot_download(r))
PY
.venv-mlx/bin/python -c "from openwakeword import utils; utils.download_models()"   # hey_jarvis (ONNX)
```

## 5. The voice server as a user service

Only for a repo **outside** `~/Desktop` / `~/Documents` / `~/Downloads` (see §2). Otherwise run
`bash scripts/voice/mlx-audio-server.sh &` from a terminal each session.

```bash
sed "s|__REPO__|$PWD|g" config/launchd/com.jarvis.mlx-audio.plist.example > ~/Library/LaunchAgents/com.jarvis.mlx-audio.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.jarvis.mlx-audio.plist
curl -s http://127.0.0.1:8004/v1/models | head -c 300      # kokoro / chatterbox-turbo / qwen3-tts ids
```

## 6. Verify

```bash
npm run doctor                                        # expects "Verdict: ready"
npx vitest run                                        # full suite (~4 min; the pre-commit hook runs it too)
npx tsx scripts/voice-live-session-smoke.ts --cached /tmp/jarvis-voice/utt5.wav   # or omit --cached to speak (Terminal.app)
npx tsx scripts/voice-wake-smoke.ts --force --wav /tmp/jarvis-voice/wake-test.wav  # or --force alone and say "Hey Jarvis"
npx tsx scripts/camera-capture-smoke.ts               # Terminal.app; expects PHASE 23F CAMERA SMOKE: OK
npx tsx scripts/mcp-gateway-host.ts --probe           # gateway host seams
npm run dev                                           # http://localhost:3000/working — the cockpit
```

The two smoke clips (`/tmp/jarvis-voice/*.wav`) are produced by the voice runbooks; without them, run the smokes without `--cached`/`--wav` and speak.

## 7. Configuration you will actually touch

| key                                                   | default                                | meaning                                                                                              |
| ----------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `JARVIS_DEFAULT_CHAT_PROVIDER`                        | `ollama` when `JARVIS_LOCAL_ONLY=true` | the brain                                                                                            |
| `JARVIS_VOICE_LIVE_MODE`                              | `auto` (= local)                       | `premium` routes to OpenAI Realtime (key-gated)                                                      |
| `JARVIS_VOICE_LIVE_LOCAL_TTS` / `JARVIS_TTS_VOICE_ID` | `kokoro` / `bm_lewis`                  | `vibevoice` for the 95 ms-TTFA alternative                                                           |
| `JARVIS_WAKE_WORD_ENABLED`                            | `false`                                | wake word is local-only; enabling it is your explicit act                                            |
| `JARVIS_MCP_CLIENT_REGISTRY`                          | empty (refuse-all)                     | see `docs/runbooks/mcp-gateway-host.md`                                                              |
| `OBSIDIAN_VAULT_PATH`                                 | empty (fail-closed)                    | point at YOUR vault if you have one; the write root `JARVIS_OBSIDIAN_VAULT_ROOT` scaffolds on demand |

## 8. Known machine-specific notes

- Apple unified memory: `os.freemem()` is ≈0 by design; the fit scorer budgets from total minus `reservedRamGb` (E-034).
- The local turn path has no acoustic echo cancellation — use headphones for barge-in trials on the cloud path.
- Spotlight indexing `node_modules`/venvs makes the test suite crawl; the `.metadata_never_index` files above prevent it.
