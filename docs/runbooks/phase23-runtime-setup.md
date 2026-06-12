# Phase 23 Runtime Setup — Vision Lane

Runtime prerequisites for the Phase 23 vision lane (video ingest → frames → transcript → analysis). All tools run locally; nothing here grants execution capability — consent (`config/vision/standing-consent.yaml`) and the source allowlist (`config/vision/source-allowlist.yaml`) both default to denied/disabled.

## Minimum versions

Minimums are pinned to the versions verified on this machine on 2026-06-12. Health checks enforce them at plan time (implemented in slice 23C, not 23A).

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
