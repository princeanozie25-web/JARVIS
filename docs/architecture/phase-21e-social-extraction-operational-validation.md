# Phase 21E Social Extraction Operational Validation

Phase 21E is a user-triggered social video extraction workflow. It uses injected runner boundaries for `yt-dlp`, `ffmpeg`, local transcription, analysis, and temp workspace cleanup.

This document covers local operational setup. It does not enable background URL watching, bulk downloads, persistent raw media storage, or raw transcript/frame telemetry.

## Required Local Tools

Verify:

```bash
yt-dlp --version
ffmpeg -version
ffprobe -version
python --version
python -c "import faster_whisper; print('faster-whisper ok')"
```

Install or update on Windows:

```bash
python -m pip install -U yt-dlp
winget install --id Gyan.FFmpeg -e
python -m pip install -U faster-whisper
```

If YouTube extraction warns that no JavaScript runtime is available, install Deno for yt-dlp's YouTube player handling:

```bash
winget install --id DenoLand.Deno -e
```

## STT Environment

The smoke path uses the existing faster-whisper STT provider from `src/lib/voice-runtime`.

Set these in `.env.local` or in the shell before running the smoke:

```bash
JARVIS_STT_PYTHON_COMMAND=python
JARVIS_STT_MODEL_NAME=tiny
JARVIS_STT_MODEL_PATH=tiny
JARVIS_STT_PROVIDER_ID=faster-whisper-local
JARVIS_STT_TIMEOUT_MS=300000
```

`tiny` is recommended for smoke validation because it keeps first-run model download and transcription time bounded. Larger models can be used later through the same governed provider config.

## Operational Smoke

Run:

```bash
npm run social:smoke
```

The default public smoke URL is:

```text
https://www.youtube.com/watch?v=jNQXAC9IVRw
```

Override it for a user-initiated test only:

```bash
JARVIS_SOCIAL_SMOKE_URL=https://www.youtube.com/watch?v=jNQXAC9IVRw npm run social:smoke
```

The smoke verifies:

- URL classification and extraction plan creation.
- Real `yt-dlp` download into a temp workspace.
- Real `ffmpeg` audio extraction and adaptive frame extraction.
- Local faster-whisper transcription with timestamped segment metadata.
- Multimodal packet assembly through the Phase 21E workflow.
- Deterministic injected analysis result.
- Temp workspace cleanup on success or failure.

## Telemetry Safety

The smoke report may print the smoke URL for operator visibility, but Phase 21E workflow telemetry remains metadata-only:

- URL hash, not raw URL.
- Platform, duration, frame count, transcript segment count, model tier, cost estimate, status.
- No raw transcript.
- No raw frame data.
- No raw audio/video body.
- No raw media path after cleanup.

## Troubleshooting

- `yt-dlp` unavailable: run `python -m pip install -U yt-dlp`, then reopen the terminal if PATH changed.
- `ffmpeg` or `ffprobe` unavailable: install `Gyan.FFmpeg` with winget and reopen the terminal.
- YouTube extraction JS warning: install `DenoLand.Deno` with winget.
- `faster-whisper` unavailable: run `python -m pip install -U faster-whisper`.
- First STT smoke is slow: the model may be downloading into the local Hugging Face cache.
- STT timeout: increase `JARVIS_STT_TIMEOUT_MS` for the smoke only, up to the governed faster-whisper contract maximum of `300000`. First-run model download and CPU initialization can be slow on a fresh machine.
