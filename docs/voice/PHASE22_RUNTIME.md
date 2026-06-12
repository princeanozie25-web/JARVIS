# Phase 22 Voice Runtime State

Phase 22 promotes voice from transport to operating mode while preserving the
approval lifecycle and governance substrate.

## Installed Local Runtime

- `faster-whisper`: `1.2.1` (latest observed via `pip index versions faster-whisper`)
- `openwakeword`: `0.6.0` (latest observed via `pip index versions openwakeword`)
- Chatterbox TTS Server: local clone at `C:\Users\princ\.jarvis\runtimes\Chatterbox-TTS-Server`, upstream HEAD `915ae289340e10c6047f27f47e22eae9bf350c32`

## System Voice Stack

Chatterbox is now the primary system-wide TTS provider, not only a Demo
Director narrator:

1. Chatterbox TTS Server at `http://127.0.0.1:8004`
2. Kokoro at `http://127.0.0.1:8880`
3. Existing local runtime fallback

Health checks are required before selection. Provider output does not grant
authority and does not auto-play without the existing playback supervisor.

## Wake Word

Wake phrase: `Hey Jarvis you up`

Provider contract:

- openWakeWord
- ONNX model format
- local only
- no cloud wake detection
- no pre-wake audio storage
- no raw audio persistence
- visible standby and active indicators

## Authority

- T0: read-only voice answers.
- T1: standing-consent actions only.
- T2: voice may initiate; UI/Human Gate confirms.
- T3: manual only; voice cannot perform execution.

Voice may never grant, expand, or revive standing consent.
