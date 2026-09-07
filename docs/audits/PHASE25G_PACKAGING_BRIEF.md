# Phase 25G — Packaging brief (opened 2026-09-07)

Roadmap v5.1 §10, slice 25G: _"Bundle Next.js server + Node + Python sidecars + SQLite into one
launchable app (Tauri shell, 127.0.0.1 only, sidecar process management, first-run bootstrap).
Last, by design."_ Exit: _"Cold launch from the packaged artifact on the primary machine reaches
a working cockpit and a voice round-trip; no public network exposure."_

This brief opens the slice the way 25B's Gate-adjacent brief did: audit first, then the plan,
then the registry entry. Nothing in it is built yet.

## 1. What exists (audited on the M1 Max, 2026-09-07)

| Piece               | State                                                                                                                                                                                | Evidence                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Tauri shell         | Phase 12A.1 skeleton: one window at `http://127.0.0.1:3000`, **no IPC, no permissions, `bundle.active: false`, `targets: []`**, no plugins. `main.rs` is 7 lines.                    | `src-tauri/`, `tests/tauri/binding.test.ts` (frozen posture) |
| Rust toolchain      | **Absent.** `cargo`/`rustc` not on PATH; Xcode CLT present; `@tauri-apps/cli` 2.11.2 installed.                                                                                      | shell probe                                                  |
| Next.js server      | `next dev --hostname 127.0.0.1` only. `next.config.ts` has no `output: "standalone"`; `better-sqlite3` is a native module marked server-external.                                    | `next.config.ts`, `package.json`                             |
| SQLite              | `data/jarvis.db` + `data/event-store.db` under `process.cwd()/data` (hard-coded in `db/client-node.ts`; event store path env-overridable).                                           | `src/lib/db/client-node.ts`, `.env.example`                  |
| Ollama              | Homebrew LaunchAgent (`homebrew.mxcl.ollama`), started, loopback :11434. Not ours to bundle.                                                                                         | `brew services list`                                         |
| mlx-audio (TTS/STT) | `.venv-mlx` (1.7 GB + HF model cache ≈ 9.6 GB), started from a terminal (`scripts/voice/mlx-audio-server.sh`) or the E-048 launchd plist; TCC blocks LaunchAgents under `~/Desktop`. | E-040/E-048                                                  |
| Wake word / STT     | openWakeWord + parakeet-mlx inside the same venv; spawned per run by the voice loop.                                                                                                 | E-042/E-049                                                  |
| First-run bootstrap | `npm run doctor` (20B safe runtime: read-only, `installation_enabled: false`); runbook `docs/runbooks/macos-bringup.md` is the human procedure.                                      | E-048                                                        |
| Self-knowledge      | E-050 `self.status` already probes Ollama, mlx-audio, db, doctor — the packaged app's health screen can be this projection.                                                          | E-050                                                        |

## 2. Hard prerequisites (need Prince)

1. **Install Rust** (`curl https://sh.rustup.rs -sSf | sh`, stable, then `rustup target list --installed`). Without it `tauri build` cannot run at all. Nothing else in 25G is blocked on you.
2. Code-signing identity: **not required** for a local `.app` (ad-hoc signing); Gatekeeper warns on first open. Notarisation is out of scope for a private daily-driver build; record the decision.
3. Decide the install root for the packaged data dir: proposal `~/Library/Application Support/JARVIS/` (db, event store, logs), because a `.app` bundle is read-only and `~/Desktop` is TCC-protected for background processes.

## 3. Design decisions proposed

- **Node server as a Tauri sidecar.** `next build` with `output: "standalone"` → `.next/standalone` copied into the bundle with the `node` binary of the build machine; `better-sqlite3` rebuilt for that node. The shell launches it on a free loopback port, waits for `/api/health`, then opens the window. This is the one place the frozen shell grows: **a `shell:sidecar`-scoped permission for exactly one binary**, no generic `shell` plugin. The 12A.1 binding test freezes `bundle.active:false` and `permissions:[]`; 25G amends both **by registry row, with the test updated to pin the new minimal posture** (one sidecar, no IPC commands, still no camera/mic/fs/global-hotkey permissions — mic access stays with the sidecar processes that already hold it).
- **Python sidecars are managed, not bundled.** The MLX stack is machine-specific (Metal wheels, ~10 GB of models). The app ships a **supervisor** in the Node server (start/stop/health/restart-with-backoff for mlx-audio, using the configured venv; Ollama observed only, since brew owns it) and a **first-run bootstrap screen** driven by the doctor + `self.status`: it names what is missing and shows the exact runbook step, never installs silently. Deviation from the roadmap's literal "bundle Python" recorded here; the exit criterion (cold launch → cockpit + voice round-trip) is still met on the primary machine because the venv exists there.
- **Loopback only, enforced twice**: the sidecar binds `127.0.0.1` with `JARVIS_BIND_HOST` pinned; the shell's CSP stays `127.0.0.1`. The existing `JARVIS_REMOTE_DASHBOARD_ENABLED=false` posture is unchanged.
- **Data dir** resolved from `JARVIS_DATA_DIR` (new, defaults to cwd/data so nothing changes for dev) — one additive seam in `db/client-node.ts` and `app-event-store.ts`.
- **No updater, no telemetry egress, no crash reporter.** (12A.1 posture kept.)

## 4. Work breakdown (registry rows to follow)

| Step | Deliverable                                                                                                                                                                                     | Verification                                          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| G1   | `next.config.ts` standalone output; `JARVIS_DATA_DIR` seam; a loopback `/api/health` (none exists today — `app/api/` has no health route; the E-050 `self.status` snapshot is the natural body) | build once; suite green                               |
| G2   | `scripts/package/` : build standalone, rebuild native modules, stage sidecar binary, write `tauri.conf.json` bundle stanza (macOS `app` target only)                                            | artifact produced; size recorded                      |
| G3   | Shell: spawn sidecar, port handoff, wait-for-health, graceful shutdown; binding test amended (registry)                                                                                         | `tauri dev` then `tauri build` on the Mac             |
| G4   | Sidecar supervisor for mlx-audio + Ollama observation + first-run bootstrap screen (typed projection; UI binding is Astra's — expose data only, like E-050)                                     | drills: sidecar down → degraded, restart with backoff |
| G5   | Cold-launch proof: quit everything, open the `.app`, reach cockpit, one voice round-trip, `lsof -i` shows loopback only                                                                         | recorded in the registry as 25G exit                  |

## 5. Risks

- Rust install and first `cargo` build are slow (tens of minutes) — do G1/G2 while it installs.
- `next start` standalone with `server-only` modules and native `better-sqlite3` inside a `.app`: path assumptions (`process.cwd()`) are the likely breakage; G1's data-dir seam is the fix.
- Astra's UI is in flight in `app/`; 25G touches no page. The bootstrap screen ships as a projection, not a route, until Astra binds it.

## 6. Status

OPEN. §2.1 closed 2026-09-07 (rustup, user-space, `~/.cargo`). **G1 APPLIED (E-053)**: standalone build proven on loopback with a packaged data dir and the health route; shell crate builds. **G2+G3 APPLIED (E-054)**: `scripts/package/build-mac.ts --install` produces and installs `~/Applications/JARVIS Command Center.app` (186 MB); cold launch → sidecar on 127.0.0.1:3117 → health 200 → window. Four live findings (TCC under ~/Desktop, JIT entitlement, missing turbo route runtime, symlinked native-addon alias) are fixed in the script/overlay and pinned by `tests/phase-25/packaging-g2.test.ts`. **G4+G5 APPLIED (E-055)**: packaged doctor (7 checks with runbook steps), mlx-audio supervisor (spawns from the operator's venv copy under Application Support, backoff-restart, killed on exit), typed bootstrap projection in `/api/health`. **25G EXIT MET 2026-09-07**: cold launch of `~/Applications/JARVIS Command Center.app` → bootstrap verdict ready → cockpit pages → speak/transcribe round-trip returned the sentence verbatim; loopback only. Chaos: managed voice server killed → restarted in 3 s. Left for the operator: look at the window (no screen access from this session) and decide whether the venv copy becomes the runbook's default location. §2.2 decided: ad-hoc signing, no notarisation. §2.3 decided: `~/Library/Application Support/JARVIS` via `JARVIS_DATA_DIR`.
