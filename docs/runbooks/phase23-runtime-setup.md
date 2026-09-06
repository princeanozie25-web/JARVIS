# Phase 23 Runtime Setup — Vision Lane

Runtime prerequisites for the Phase 23 vision lane (video ingest → frames → transcript → analysis). All tools run locally; nothing here grants execution capability — consent (`config/vision/standing-consent.yaml`) and the source allowlist (`config/vision/source-allowlist.yaml`) both default to denied/disabled.

## Minimum versions

Minimums are pinned to the versions verified on this machine on 2026-06-12. **Source of truth: `src/lib/video-extraction/runtime-requirements.ts`** (`MIN_YTDLP_VERSION`, `MIN_FFMPEG_VERSION`) — this table mirrors it. Health checks enforce the minimums at plan time (slice 23C: `executeVideoIngest` refuses below-minimum or missing tools before any download).

| Constant             | Value               | Source                                                                                                        |
| -------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| `MIN_YTDLP_VERSION`  | `2026.03.17`        | `yt-dlp --version` on this machine                                                                            |
| `MIN_FFMPEG_VERSION` | `8.1.1`             | `ffmpeg -version` on this machine (gyan.dev essentials build; ffprobe ships at the same version)              |
| faster-whisper       | `1.2.1` (exact pin) | `runtimes/requirements-vision.txt`; matches the pin in `src/lib/voice-runtime/stt/faster-whisper-provider.ts` |

If a binary is absent on a new machine, install it and re-verify with the commands below before relying on the vision lane; do not lower the minimums without a registry entry.

## Install steps

### yt-dlp (system binary, not packaged)

```
winget install yt-dlp.yt-dlp
yt-dlp --version   # must be >= 2026.03.17
```

### ffmpeg / ffprobe (system binaries, not packaged)

```
winget install Gyan.FFmpeg
ffmpeg -version    # must be >= 8.1.1
ffprobe -version   # ships with ffmpeg; same version
```

### Python requirements (faster-whisper)

Requires Python 3.10+ (the same interpreter `JARVIS_STT_PYTHON_COMMAND` points at — see `src/lib/voice-runtime/stt/local-config.ts`).

```
pip install -r runtimes/requirements-vision.txt
python -c "from faster_whisper import WhisperModel; print('ok')"
```

## Verification

- `yt-dlp --version`, `ffmpeg -version`, `ffprobe -version` succeed and meet the minimums above.
- The smoke precedent for runtime health checks is `scripts/social-extraction-smoke.ts`; the vision lane's plan-time enforcement of `MIN_YTDLP_VERSION` / `MIN_FFMPEG_VERSION` lands in 23C.

## macOS (Apple Silicon) — added 2026-09-04 (runway R.2, E-023)

> **Superseded 2026-09-06 (E-048, Phase 25D).** The current, complete second-person
> bring-up — Homebrew, both Python venvs with pinned requirements, Ollama + MLX models,
> the mlx-audio voice server as a launchd service, the wake word, the gateway host and
> the verification smokes — is **`docs/runbooks/macos-bringup.md`**. The steps below are
> the R.2 minimum bootstrap exactly as it was first run, kept as history.

First bootstrap on the primary machine (MacBook Pro M1 Max, 32 GB unified memory, macOS 26.6). Minimum bootstrap only: the sidecars (Ollama, Piper, faster-whisper _serving_, Chatterbox) are Phase 25D and are **not** installed here.

### Toolchain (no password required)

Homebrew is **not** installed on the primary Mac and installing it needs an interactive `sudo`. Everything below is user-space:

```
# Node 24 LTS via nvm (no Homebrew, no sudo)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
. ~/.nvm/nvm.sh && nvm install --lts
node -v   # v24.x
npm install
```

Xcode Command Line Tools must be present (`xcode-select -p` → `/Library/Developer/CommandLineTools`); `better-sqlite3` builds natively against them.

### Python requirements (faster-whisper, library only)

The CLT Python is 3.9.6; faster-whisper 1.2.1 installs and imports on it. Use a repo-local venv (gitignored) and point the STT interpreter at it:

```
python3 -m venv .venv
.venv/bin/pip install -r runtimes/requirements-vision.txt
.venv/bin/python -c "from faster_whisper import WhisperModel; print('ok')"
# .env.local
JARVIS_STT_PYTHON_COMMAND=/absolute/path/to/JARVIS/.venv/bin/python
```

### Environment file

```
cp .env.example .env.local     # every value empty/loopback; fail-closed
npm run doctor                 # must no longer report required-env-file-example
```

### yt-dlp / ffmpeg / ffprobe (Homebrew) — verified 2026-09-04

Homebrew was installed by the operator at the keyboard (it needs an interactive `sudo`; no remote session may do it). Use the Homebrew binaries, not static builds; they live in `/opt/homebrew/bin`, which must be on `PATH`.

```
brew install ffmpeg yt-dlp
ffmpeg -version | head -1    # ffmpeg 9.0.1  (>= MIN_FFMPEG_VERSION 8.1.1)
ffprobe -version | head -1   # ffprobe 9.0.1 (ships with ffmpeg)
yt-dlp --version             # 2026.08.19    (>= MIN_YTDLP_VERSION 2026.03.17)
```

Until they exist, the vision lane's plan-time health check refuses ingest (fail-closed by design). **No test spawns a real ffmpeg or yt-dlp** — all runtime-tool tests use injected fakes — so the suite is green either way.

### Audio playback

`afplay` ships with macOS and needs no permission; the local playback driver selects it on `darwin` (E-024). The Windows `powershell.exe` path is unchanged.

### Camera (23F) — VERIFIED 2026-09-04

`scripts/camera-capture-smoke.ts` uses `-f avfoundation` on macOS. **Run it from Terminal.app**: macOS raises the one-time camera permission popup ("Terminal would like to access the camera") only for a real app; a process spawned from the Claude desktop app blocks silently on the capture step with no dialog. If the popup never appears, enable Terminal under System Settings → Privacy & Security → Camera, or `tccutil reset Camera` and rerun.

```
npx tsx scripts/camera-capture-smoke.ts   # expects: PHASE 23F CAMERA SMOKE: OK
```
