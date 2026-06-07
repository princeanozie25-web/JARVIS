# Universe Scaffold

Status captured on 2026-06-07 for the `unreal-gauntlet-lab` branch.

## Scope

This slice creates the first repo-local Unreal Universe Scaffold baseline for JarvisGauntlet. It is Unreal-side visual scaffolding only.

JARVIS remains authoritative. Unreal remains a read-only visual client.

Not included:

- No live runtime bridge.
- No MCP or editor-control integration.
- No gameplay authority.
- No JARVIS runtime calls.
- No JARVIS governance, approval, router, model, memory, tools, voice, agents, council, Google, Telegram, UI Polish, or runtime contract changes.

## Universe_01

`Universe_01` is the first level for the Gauntlet lab. It is the initial visual environment for exploring how JARVIS state could be represented in Unreal without allowing Unreal to control JARVIS.

The level should remain a visual workspace. Any future connection to live JARVIS data must be additive, metadata-only, and read-only.

## Gauntlet Chamber Concept

The Gauntlet Chamber is the central observation space for the Unreal client. It can eventually hold visual anchors for JARVIS concepts such as approvals, planning state, verification, command traces, and system health.

The chamber is not a control surface. It should not execute tools, route model requests, alter memory, change approvals, or mutate runtime state.

## Human Gate

The Human Gate is the central visual authority metaphor for JARVIS approval boundaries.

The initial C++ scaffold is `AJarvisHumanGateAnchor`. It is a placeholder actor with editable metadata:

- `DomainName`: defaults to `Human Gate`.
- `GovernanceRole`: defaults to `Approval lifecycle visual anchor`.
- `bReadOnlyVisual`: defaults to `true`.

The actor has tick disabled by default and contains no gameplay authority or JARVIS runtime integration.

## Future Six-Domain Layout

Future Gauntlet Chamber work can organize read-only visuals around six domains:

- Space
- Time
- Mind
- Soul
- Reality
- Power

These names are visual planning labels only. They are not runtime contracts and do not imply gameplay authority.

## Read-Only Rule

Unreal may visualize approved, sanitized, metadata-only JARVIS state in a future bridge. Unreal must not become an authority over JARVIS runtime behavior.

All future bridge work must preserve:

- Explicit event allowlists.
- Metadata-only payloads by default.
- No secrets, raw prompts, private memory content, approval bypass state, or executable tool payloads.
- No control-plane calls from Unreal back into JARVIS.

## Current Implementation

Current repo-local scaffold:

```text
unreal/JarvisGauntlet/Source/JarvisGauntlet/Public/JarvisHumanGateAnchor.h
unreal/JarvisGauntlet/Source/JarvisGauntlet/Private/JarvisHumanGateAnchor.cpp
```

The actor is intentionally not placed into `Universe_01` in this slice. Placement would modify binary map assets and should be handled in a separate, explicit Unreal editor slice.
