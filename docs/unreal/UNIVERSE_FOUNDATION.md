# Universe Foundation

Status captured on 2026-06-07 for the `unreal-gauntlet-lab` branch.

## Visual authority

The authoritative visual reference for The Gauntlet void is:
docs/unreal/VOID_ART_DIRECTION.md

Any Unreal level work on this scene must pass the validation checklist
in that document before being considered complete.
The web prototype (void.html / rest.html) is a concept reference only -
Unreal is the production visual target.

## Direction Correction

The earlier deterministic PNG layout preview was too flat and diagrammatic. That direction is rejected for the Gauntlet Universe foundation.

`Universe_01` must read as an actual Unreal 3D scene viewed through a camera: deep space, long distances, non-planar depth, dark exposure, bloom, and physically separated future galaxy regions. The main output must not be a 2D map, HUD mockup, slide, or labeled node diagram.

## Visual Concept

`Universe_01` is the first visible JARVIS Gauntlet command-space. It is a cinematic dark void, not a terrain level and not a UI preview.

The intended mood is:

- Interstellar-scale deep space.
- Sprawling starfield depth.
- Subtle nebula-like wisps built from Unreal primitives.
- A central empty origin reserved for the future Human Gate.
- Six distant galaxy-domain regions that are far apart in 3D space.
- Premium, quiet, JARVIS-like contrast and glow.

This is a visual foundation only. It has no live bridge, no gameplay authority, and no JARVIS runtime calls.

## Scale Model

The scene uses Unreal large-world coordinates:

- Origin: empty reserve for the future Human Gate.
- Foreground dust: `50` to `500` Unreal units from the cinematic camera.
- Mid-depth stars: `5,000` to `25,000` Unreal units from the cinematic camera.
- Deep background stars: `100,000` to `500,000` Unreal units from the cinematic camera.
- Nebula wall and far matte: beyond `250,000` Unreal units, with the current far matte at roughly `540,000` Unreal units.
- Perimeter anchor distance: roughly `420,000` Unreal units from origin.
- Cinematic camera: positioned at `0, -520,000, 95,000`, looking into the central void.

The Human Gate is not placed in this slice. Center markers and domain labels are hidden by default so the scene does not become a diagram.

## Galaxy Anchor Layout

The six future domains are distributed in non-planar 3D positions:

| Domain  | Direction                                            | Purpose                                                     |
| ------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| Space   | Far positive X, slight negative Y, positive Z        | Future Space Tesseract and spatial state visuals.           |
| Time    | Positive X/Y, deep negative Z                        | Future timelines, replay, planning, and temporal traces.    |
| Mind    | Negative X, positive Y, high positive Z              | Future reasoning, context, and agent-thought visualization. |
| Soul    | Far negative X, slight negative Y, slight negative Z | Future user preference, intent, and continuity metaphors.   |
| Reality | Negative X/Y, positive Z                             | Future environment, tool output, and observed-world state.  |
| Power   | Positive X, negative Y, deep negative Z              | Future capability, execution, and system-energy metaphors.  |

Actor/component metadata keeps the domain names discoverable for future Codex slices, but visible labels are disabled by default.

## Scene Components

The baseline Unreal-side scaffold includes:

- `GAUNTLET_UniverseFoundation_ReadOnly`
- `AJarvisUniverseFoundationActor`
- `VoidStarfield` instanced sphere field
- `FutureGalaxyAnchors` instanced placeholder galaxies
- `DistantNebulaWisps` stretched primitive wisps around each future region
- `GAUNTLET_Overview_Camera`
- `GAUNTLET_DarkVoid_PostProcess`
- `GAUNTLET_Minimal_SkyLight`
- `GAUNTLET_Viewport_PlayerStart`

All components are visual placeholders. They do not call JARVIS, mutate runtime state, or carry gameplay authority.

## Camera And Navigation

The cinematic overview camera is named:

```text
GAUNTLET_Overview_Camera
```

Recommended manual review flow:

1. Open `unreal/JarvisGauntlet/JarvisGauntlet.uproject`.
2. Open `/Game/Levels/Universe_01`.
3. Select `GAUNTLET_Overview_Camera`.
4. Pilot the camera or lock the viewport to it.
5. Verify the scene reads as a 3D cosmic world with depth, not a flat diagram.

The level is designed for editor viewport flight and zoom. Future slices may add a dedicated read-only observer pawn, but this slice does not add gameplay controls.

## Screenshot

Required screenshot target:

```text
docs/unreal/screenshots/universe-foundation-3d.png
```

The screenshot must come from the actual Unreal viewport or `GAUNTLET_Overview_Camera`. Do not replace it with a generated 2D diagram.

If command-line screenshot automation fails on a local machine:

1. Open `Universe_01` in Unreal Editor.
2. Pilot or lock to `GAUNTLET_Overview_Camera`.
3. Use the viewport screenshot tool or console command `HighResShot 1280x720`.
4. Copy the resulting viewport capture to `docs/unreal/screenshots/universe-foundation-3d.png`.

## Future Human Gate Placement

The central origin is reserved for the Human Gate. The current slice intentionally keeps it empty.

Future placement should keep the Human Gate read-only and visually central, with approval-state visuals fed only by explicit sanitized metadata if a future bridge is approved.

## Future Space Tesseract Pipeline

The `Space` anchor is the intended first domain for a future Space Tesseract pipeline. That work should remain separate and may add:

- A dedicated Space domain actor.
- Procedural geometry or PCG layout.
- Metadata-only visual state ingestion.
- Offline render validation.

No Space Tesseract runtime bridge exists in this slice.

## Living Void Implementation

`Universe_01` now uses a living cinematic void composition instead of the earlier flat reference-plate-only scene. The current implementation keeps the center visually dark and uses layered Unreal-side depth:

- `GAUNTLET_Void_Distant_Nebula_Matte`: a distant high-resolution nebula matte using the approved void reference as the far cosmic layer.
- `GAUNTLET_LivingVoid_ReadOnly`: the C++ visual actor that generates far/mid star fields, near dust, micro-filaments, and slow editor-viewport drift.
- `GAUNTLET_Void_Cinematic_Camera`: the review camera for zoom/fly inspection and high-resolution screenshots.
- `GAUNTLET_Volumetric_Void_Fog`: low-density Exponential Height Fog for depth without filling the central void.
- `GAUNTLET_DarkVoid_PostProcess`: manual dark exposure, bloom, contrast, and vignette for cinematic output.
- `GAUNTLET_Void_Nebula_Edge_A/B/C_Light`: violet, cyan, and amber perimeter lighting zones.
- `GAUNTLET_Void_Nebula_Edge_A/B/C_Sheet_##`: built-in Unreal fog-sheet meshes used as perimeter depth cards.

The image plate is not used as a UI diagram or flat map output. It is treated as a distant matte layer behind actual Unreal star, dust, fog, light, and mesh layers so editor zoom/fly movement reads with parallax instead of as a single pasted image.

## Zoom And Detail Behavior

The living void supports slow cinematic drift and fast editor navigation. The C++ actor now ticks in editor viewports and moves only visual components: nebula systems drift subtly, near dust breathes slightly, and the star/dust fields sit at different distances so zooming through the scene exposes foreground, mid-field, and distant layers.

The current scale pass treats the central void as the VR-style vanishing point. Peripheral stars and subtle radial streaks point inward, while the center remains empty and dark. The result should feel like a camera could fly forward for hours through open cosmic distance before ever reaching the nebula wall.

The central composition remains dark and intentionally empty. Human Gate, stones, six domains, governance pipelines, gameplay, and any JARVIS runtime bridge are deferred.

## Living Void Screenshots

Current validation artifacts:

```text
docs/unreal/screenshots/living-void-before.png
docs/unreal/screenshots/living-void-after.png
docs/unreal/screenshots/living-void-final-8k.png
docs/unreal/screenshots/void-presence-before.png
docs/unreal/screenshots/void-presence-after.png
docs/unreal/screenshots/void-presence-final-8k.png
```

`void-presence-final-8k.png` is the current visual authority for this slice. It is a 7680x4320 high-resolution Unreal render with the strongest perceived-scale and atmosphere pass.
