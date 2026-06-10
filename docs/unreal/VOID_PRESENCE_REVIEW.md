# Void Presence Review

Status captured on 2026-06-07 for the `unreal-gauntlet-lab` branch.

## Before Observations

Before screenshot:

```text
docs/unreal/screenshots/void-presence-before.png
```

Ten strongest aspects:

1. The central region is finally dark and empty.
2. The composition no longer reads as a labeled diagram.
3. The perimeter carries blue, violet, and amber color temperature variation.
4. The center has a clear vanishing-point role.
5. Existing star fields create a first layer of parallax during editor movement.
6. The view is cinematic enough to support 8K framing.
7. No Human Gate, stones, domains, grids, or pipelines are present.
8. The dark exposure supports the approved reference direction.
9. The edges imply nebula mass without filling the center.
10. The scene can be navigated through the editor camera without gameplay authority.

Ten weaknesses:

1. The star layers were not separated enough by perceived distance.
2. There were too few depth bands between the camera and the nebula wall.
3. The far field still compressed into a rendered backdrop from some angles.
4. Motion existed but was too uniform to feel like cosmic current.
5. Foreground particles were too sparse to sell headset-scale movement.
6. Ultra-far stars were missing as a separate population.
7. Warm ancient-star color was present but not distinct enough by depth.
8. The nebula wall was rich in 8K but too quiet in the MCP viewport buffer.
9. The void had atmosphere, but not yet enough "place" behavior.
10. The visual system still depends on a distant matte for high-frequency nebula detail.

Why it still felt artificial:

The before pass had a strong composition but not enough independent depth behavior. It looked like a beautiful cosmic frame because the viewer could read the background as one far surface. A real place needs more contradictory scale cues: near dust moving differently from near stars, mid stars moving differently from deep stars, ultra-far stars barely moving at all, and a center that feels like a spatial volume instead of only a black shape.

## Changes Made

Presence pass changes:

- Added `GAUNTLET_Void_Starfield_Near` inside `AJarvisUniverseFoundationActor`.
- Added `GAUNTLET_Void_Starfield_UltraFar` inside `AJarvisUniverseFoundationActor`.
- Retuned foreground dust to `25-500` Unreal units from the cinematic camera.
- Retuned near stars to `500-5,000` Unreal units.
- Retuned mid stars to `5,000-50,000` Unreal units.
- Retuned deep stars to `50,000-500,000` Unreal units.
- Added ultra-far stars at `500,000-2,000,000` Unreal units.
- Moved the hidden perimeter anchor distance to roughly `900,000` Unreal units.
- Moved the far nebula matte to roughly `1,050,000` Unreal units.
- Rebuilt the far matte material as emissive with a controlled multiplier so the nebula wall remains visible at greater distance.

The pass does not add domains, stones, labels, diagrams, central geometry, grids, rings, architecture, pipelines, gameplay elements, Marketplace assets, Fab assets, or JARVIS runtime integration.

## Scale Improvements

The perceived scale increased because the camera now sees more independent spatial layers before the far wall. The center remains empty, but there are now visible star populations on both sides of the central void that imply travel distance rather than a flat screen.

The final 8K frame:

```text
docs/unreal/screenshots/void-presence-final-8k.png
```

It preserves the same dark central destination while the peripheral nebula wall and star field suggest a much larger surrounding volume.

## Motion Improvements

Motion remains intentionally subtle. The actor ticks in editor viewports and separates movement rates by depth:

- Foreground dust has tiny camera-relative drift.
- Near stars drift more slowly than dust.
- Mid stars rotate almost imperceptibly.
- Deep cool and warm star populations have different motion directions.
- Ultra-far stars barely move.
- Nebula and fog-sheet components drift at low rates to create ancient cosmic current rather than visible animation loops.

The goal is not obvious animation. The goal is a living void that feels unstable only after watching it.

## Atmosphere Improvements

The atmosphere is colder and older:

- Center exposure stays dark.
- Warm amber stars live mostly in distant populations.
- Blue/cyan nebula structures remain dominant but less uniform.
- Edge activity is stronger than center activity.
- The far matte is emissive enough to survive the increased distance without pulling the wall forward.

## Before After Comparison

After screenshot:

```text
docs/unreal/screenshots/void-presence-after.png
```

The MCP viewport after shot is darker than the final HighResShot, but it confirms the live editor scene has a cleaner dark center, visible star depth, and restored edge atmosphere. Compared with the before screenshot, the after pass increases perceived scale by giving the camera more depth bands to fly through before reaching the nebula wall.

The final 8K render is the visual authority for this slice because Unreal's HighResShot path captures the cinematic composition more accurately than the direct viewport read.

## Remaining Weaknesses

The strongest remaining limitation is that high-frequency nebula complexity still depends on the distant matte. The Unreal-side layers now provide depth, parallax, motion, and star populations, but a future pass should replace more of the matte with Niagara ribbon emitters, GPU particle fields, and volumetric material stacks.

The MCP viewport capture still reads darker and less cinematic than HighResShot. Future visual iteration should either drive a Cine Camera screenshot path directly or improve viewport capture parity before using the MCP frame as the only judgment source.
