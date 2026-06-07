# Gauntlet Tooling Audit

Status captured on 2026-06-07 for the `unreal-gauntlet-lab` branch and Unreal Engine 5.7.

## Scope

This slice audits built-in Unreal visual tooling for the JarvisGauntlet project and enables only safe built-in plugins that support future visual work.

JARVIS remains authoritative. Unreal remains a read-only visual client.

Not included:

- No live runtime bridge.
- No MCP or editor-control integration.
- No gameplay authority.
- No Marketplace or Fab assets.
- No external plugins.
- No MetaHuman.
- No RealityCapture.
- No JARVIS governance or runtime contract changes.

## Audited Built-In Tools

| Tool                  | Engine availability                    | Project status                                           | Future Gauntlet use                                                                  |
| --------------------- | -------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Niagara               | Built-in plugin: `Niagara`             | Enabled explicitly                                       | Visual particles, chamber ambience, state pulses, domain effects.                    |
| PCG                   | Built-in plugin: `PCG`                 | Enabled explicitly                                       | Procedural chamber layout, domain placement rules, non-runtime visual generation.    |
| MetaSound             | Built-in plugin: `Metasound`           | Enabled explicitly                                       | Local ambience and audio-reactive visual placeholders.                               |
| Control Rig           | Built-in plugin: `ControlRig`          | Enabled explicitly                                       | Future rigged symbolic anchors or animated visual gates.                             |
| Sequencer             | Built into Unreal editor workflows     | Available through editor, no separate core plugin needed | Cinematic camera passes, visual walkthroughs, demo capture setup.                    |
| Movie Render Pipeline | Built-in plugin: `MovieRenderPipeline` | Enabled explicitly                                       | High-quality local renders of Gauntlet visual states.                                |
| Enhanced Input        | Built-in plugin: `EnhancedInput`       | Enabled explicitly                                       | Future local navigation and viewport interaction only, not JARVIS control authority. |

## Enabled Now

The project descriptor now explicitly enables:

```text
Niagara
PCG
Metasound
ControlRig
MovieRenderPipeline
EnhancedInput
```

`ModelingToolsEditorMode` was already enabled for editor modeling workflows.

## Deferred

Deferred tooling:

- `SequencerScripting`: deferred because it is beta/editor automation-adjacent and not needed before manual visual sequencing.
- Niagara Fluids and other Niagara extensions: deferred until a concrete visual requirement exists.
- PCG interop plugins: deferred until the base PCG graph workflow needs integration.
- Control Rig experimental extensions: deferred.
- Movie pipeline render-pass extensions: deferred until render requirements are defined.

## External Asset and Tooling Policy

Fab, Megascans, MetaHuman, and RealityCapture are not installed or imported in this slice.

Reasons:

- They introduce asset licensing and provenance decisions outside this baseline.
- They can significantly increase repository size and binary asset churn.
- They are not required for the first read-only visual scaffold.
- The Gauntlet baseline should remain reproducible with built-in Unreal tooling first.

Any future use of these tools should be handled as a separate explicit asset-adoption slice with licensing, storage, LFS, and review boundaries documented.

## Read-Only Mapping

Enabled tools map to future Gauntlet work as visual affordances only:

- Niagara can show state transitions and environmental feedback.
- PCG can organize visual domains without hardcoding map layout.
- MetaSound can provide local ambience without consuming JARVIS voice/runtime systems.
- Control Rig can animate symbolic anchors.
- Movie Render Pipeline can capture offline renders.
- Enhanced Input can support local camera or viewer controls.

None of these tools may call JARVIS, mutate JARVIS state, trigger tools, bypass approval, route models, write memory, or act as gameplay authority.
