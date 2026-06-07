# Universe Foundation

Status captured on 2026-06-07 for the `unreal-gauntlet-lab` branch.

## Visual Concept

`Universe_01` is the first visible JARVIS Gauntlet command-space. It is a dark, cinematic cosmic void rather than a terrain level.

The intended mood is:

- Deep interstellar space.
- Vast scale with long travel distances.
- A central empty origin reserved for a future Human Gate.
- Six distant galaxy-domain anchors arranged around the origin.
- Premium, quiet, JARVIS-like visual language.

This is a visual foundation only. It has no live bridge, no gameplay authority, and no JARVIS runtime calls.

## Scale Model

The scene uses Unreal large-world coordinates with a broad radial layout:

- Origin: reserved Human Gate space.
- Galaxy anchor radius: roughly `72,000` Unreal units from origin.
- Starfield radius: roughly `155,000` Unreal units.
- Overview camera: positioned far outside the origin to read the void and anchor ring.

The central marker is intentionally small and only marks reserved space. The Human Gate actor is not placed in this slice.

## Galaxy Anchor Layout

The six future domains are arranged in a hexagonal orbit around the central origin:

| Domain  |       Angle | Purpose                                                     |
| ------- | ----------: | ----------------------------------------------------------- |
| Space   |   0 degrees | Future Space Tesseract and spatial state visuals.           |
| Time    |  60 degrees | Future timelines, replay, planning, and temporal traces.    |
| Mind    | 120 degrees | Future reasoning, context, and agent-thought visualization. |
| Soul    | 180 degrees | Future user preference, intent, and continuity metaphors.   |
| Reality | 240 degrees | Future environment, tool output, and observed-world state.  |
| Power   | 300 degrees | Future capability, execution, and system-energy metaphors.  |

Anchor labels and actor/component metadata are included so future Codex slices can find the structure safely.

## Camera And Navigation

The map includes:

- `GAUNTLET_Overview_Camera`
- `GAUNTLET_Viewport_PlayerStart`
- `AJarvisUniverseFoundationActor.OverviewCamera`

The level is designed for editor viewport flight and zoom. Future slices may add a dedicated read-only observer pawn, but this slice does not add gameplay controls.

## Future Human Gate Placement

The central origin is reserved for the Human Gate. The current marker exists only as a scale reference.

Future placement should keep the Human Gate read-only and visually central, with approval-state visuals fed only by explicit sanitized metadata if a future bridge is approved.

## Future Space Tesseract Pipeline

The `Space` anchor is the intended first domain for a future Space Tesseract pipeline. That work should remain separate and may add:

- A dedicated Space domain actor.
- Procedural geometry or PCG layout.
- Metadata-only visual state ingestion.
- Offline render validation.

No Space Tesseract runtime bridge exists in this slice.

## Screenshot

Screenshot path:

```text
docs/unreal/screenshots/universe-foundation.png
```

The checked-in PNG is a deterministic layout preview generated from the same six-anchor model documented above. It exists because command-line Unreal screenshot capture can be unreliable on local machines.

For final art review, open `Universe_01`, pilot `GAUNTLET_Overview_Camera`, and replace this file with an in-editor screenshot saved to the same path.
