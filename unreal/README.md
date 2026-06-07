# Unreal Gauntlet Lab

`unreal-gauntlet-lab` is a dedicated experimental branch for exploring Unreal Engine as a visual client for JARVIS.

## Purpose

The branch exists to prepare Unreal Engine tooling, repository conventions, and documentation without altering stable JARVIS runtime behavior. It is not part of the authoritative `main` roadmap until explicitly promoted through the normal review process.

## Current Project Status

The manually-created C++ project has been imported into the repository:

```text
unreal\JarvisGauntlet
```

It was created with Unreal Engine association `5.7`, and the local engine was detected at:

```text
D:\UE_5.7
```

The repository tracks only source project inputs: `JarvisGauntlet.uproject`, `Config`, `Content`, and `Source`. Generated Unreal outputs remain ignored.

Run the verification script from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/unreal/verify-unreal.ps1
```

## Read-Only Visualization Rule

Unreal is a read-only visualization layer. It may render JARVIS state, timelines, traces, and event metadata, but it must not mutate or control JARVIS systems.

Do not modify:

- Governance contracts.
- Approval lifecycle contracts.
- Router behavior.
- Model runtime behavior.
- Memory systems.
- Voice runtime behavior.
- Tool contracts.
- Council or agent contracts.
- Google or Telegram integrations.
- Phase 21 or Phase 22 capabilities.
- UI Polish implementation.

## Gauntlet Architecture Concept

The Gauntlet concept treats Unreal as a high-fidelity cockpit for observing JARVIS. Future scenes can represent system status, project state, verification flows, command traces, or agent activity as visual artifacts.

The Unreal layer should consume only curated, sanitized, metadata-only events. It should not receive secrets, raw prompts, private memory content, approval bypass data, or executable tool payloads.

## Universe Scaffold

`Universe_01` is the first level for the lab. The initial C++ scaffold adds `AJarvisHumanGateAnchor`, a placeholder visual actor for the Human Gate authority metaphor.

The actor is not gameplay authority and does not connect to JARVIS. It is available for future placement in the level when a dedicated editor slice is ready to modify map assets.

## Future Event-Stream Bridge

Expected direction:

```text
JARVIS runtime events -> sanitized read-only bridge -> Unreal subscriber -> visualization scene
```

Bridge expectations:

- Additive visualization contract.
- Explicit event allowlist.
- Metadata-only payloads by default.
- No control plane calls from Unreal back into JARVIS.
- No runtime dependency from JARVIS core systems on Unreal assets.

## Branch Isolation Rules

- Work only on `unreal-gauntlet-lab`.
- Do not modify `main`.
- Do not merge this branch into `main` without a separate review decision.
- Keep Unreal experiments under `unreal/` and related documentation under `docs/unreal/`.
- Do not commit generated Unreal folders such as `Binaries/`, `DerivedDataCache/`, `Intermediate/`, or `Saved/`.
