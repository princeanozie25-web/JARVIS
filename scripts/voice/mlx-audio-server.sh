#!/usr/bin/env bash
# E-040 — start the mlx-audio OpenAI-compatible TTS/STT server as a user
# service on 127.0.0.1:8004 (the E-011 sidecar port; the never-installed
# Kokoro :8880 stanza is retired — one server now serves kokoro, chatterbox-
# turbo and qwen3-tts by request model). Loopback only; no public exposure.
set -euo pipefail
PORT="${JARVIS_MLX_AUDIO_PORT:-8004}"
VENV="${JARVIS_MLX_VENV:-.venv-mlx}"
exec "${VENV}/bin/python" -m mlx_audio.server --host 127.0.0.1 --port "${PORT}"
