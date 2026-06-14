# Chatterbox Setup For System Voice

Chatterbox is the primary system-wide local TTS provider for JARVIS voice
output. Demo Director narration uses the same provider chain, but Chatterbox is
not limited to Demo Director.

Chatterbox is still not wake word detection, standing-consent authority, or an
approval path. It speaks approved/speakable output selected by the voice stack;
it never grants authority, auto-approves, or changes T0-T3 voice policy.

## Local Runtime

- Source: https://github.com/devnen/Chatterbox-TTS-Server
- Local path used on this machine: `C:\Users\princ\.jarvis\runtimes\Chatterbox-TTS-Server`
- Current cloned commit during setup: `915ae28`
- Default local URL: `http://127.0.0.1:8004`
- Health/status endpoint: `GET http://127.0.0.1:8004/api/ui/initial-data`
- Primary synthesis endpoint used by JARVIS: `POST http://127.0.0.1:8004/tts`

## Installation Steps

```powershell
$root = "$env:USERPROFILE\.jarvis\runtimes"
New-Item -ItemType Directory -Force -Path $root
git clone --depth 1 https://github.com/devnen/Chatterbox-TTS-Server.git "$root\Chatterbox-TTS-Server"
cd "$root\Chatterbox-TTS-Server"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
python start.py --cpu --portable --verbose
```

The UTF-8 environment variables are required on this Windows shell because the upstream launcher prints Unicode status symbols.

If the portable launcher finishes dependency installation but the `chatterbox`
package is missing, complete the embedded environment with:

```powershell
.\python_embedded\python.exe -m pip install --no-deps git+https://github.com/devnen/chatterbox-v2.git@master s3tokenizer==0.3.0 onnx==1.16.0
.\python_embedded\python.exe -m pip install protobuf==3.20.3
```

On this machine the embedded runtime validated with Python 3.10.11 and the
Chatterbox import check:

```powershell
.\python_embedded\python.exe -c "from chatterbox.tts import ChatterboxTTS; print('ok')"
```

## Runtime Requirements

- Python 3.10 is the upstream preferred runtime. The Windows portable launcher installs an embedded Python 3.10 environment.
- CPU mode works but can be slow. GPU acceleration is supported upstream via NVIDIA, AMD ROCm, and Apple MPS options.
- First run may download dependencies and model files.
- Chatterbox should bind locally only for JARVIS demo narration.

## Health Check

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:8004/api/ui/initial-data -UseBasicParsing
```

A healthy server returns HTTP 200. JARVIS treats any non-200 response, timeout, or connection failure as unavailable and falls back automatically.

The server health endpoint only proves the local service is reachable. JARVIS
also treats synthesis failures, including `POST /tts` returning 503 while a
model is not loaded, as unavailable for that cue and continues down the
fallback chain. During setup, both the default `chatterbox-turbo` and
`chatterbox` model profiles reached server health but failed synthesis in this
Windows portable environment at the upstream watermarker initialization step;
the Demo Director therefore fell back automatically to the existing local
narration provider while preserving the Chatterbox-first runtime order.

## System-Wide Fallback Order

1. Chatterbox TTS Server at `JARVIS_CHATTERBOX_URL` or `http://127.0.0.1:8004`
   — primary; commissioned and serving (proven by live drill 2026-06-14).
2. Kokoro at `JARVIS_KOKORO_URL` or `http://127.0.0.1:8880` — REGISTERED but NOT
   INSTALLED on this machine (health probe refuses); a forward slot.
3. Existing local runtime fallback.

Health checks are required before selecting Chatterbox or Kokoro. If Chatterbox
is reachable but synthesis fails, JARVIS falls back for that utterance without
changing authority or retrying through a cloud provider.

In the demo-director narration chain this fallback is REAL end-to-end: when
Chatterbox and Kokoro are unreachable the chain falls to a Piper terminal
provider that synthesizes local audio, emitting a metadata-only
`voice_provider_failover`/`selected` audit on every advance (proven by live
kill-drill, 2026-06-14). Carrying that into the live voice runtime is tracked
as E-012.

The same provider IDs are registered in the system `tts` registry:

- `chatterbox-tts-server`
- `kokoro`
- `local-tts-placeholder`

The registry instances are loopback-only and safety-policy gated. They are
available to the whole voice system, while the disabled provider remains the
default until the runtime health selector chooses an available local provider.

## Demo Export

Start the JARVIS dev server:

```powershell
npm run dev:local
```

Then export a demo:

```powershell
$env:JARVIS_DEMO_BASE_URL = "http://127.0.0.1:3000"
npm run demo:export -- recruiter
```

The export lands under `demo-exports/<timestamp>/` with:

- `demo.mp4`
- `screenshots/reactor.png`
- `screenshots/pipeline.png`
- `screenshots/working.png`
- `screenshots/audit.png`
- `transcript.md`
- `architecture-summary.md`
- `linkedin-post.md`
- `release-notes.md`

Nothing auto-posts, auto-uploads, or grants execution authority.
