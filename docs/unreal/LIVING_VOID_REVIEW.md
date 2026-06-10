# Living Void Review

Status captured on 2026-06-07 for the `unreal-gauntlet-lab` branch.

## Screenshot Paths

Before MCP/editor rebuild:

```text
docs/unreal/screenshots/living-void-before.png
```

After live level update:

```text
docs/unreal/screenshots/living-void-after.png
```

Final 8K render:

```text
docs/unreal/screenshots/living-void-final-8k.png
```

The final image is `7680x4320`.

## Before Review

The before screenshot still read as a flat reference plate inside the editor viewport. It had a visible right-side plate cutoff, editor grid/axis overlays, and a center helper/cube read that broke the empty-void rule. It did not provide enough 3D depth when zooming because the dominant visual layer was a single surface.

## Final Reference Comparison

Compared with `docs/unreal/reference/reference_01.png` and `docs/unreal/reference/reference_02.png`, the final render now preserves the accepted direction:

- Deep black central region remains the darkest area.
- Nebula energy lives around the perimeter instead of filling the middle.
- Cyan/blue, violet, and amber/warm star temperatures are present.
- Star density varies by layer instead of reading as a uniform wallpaper.
- Foreground/mid/far particles and fog-sheet actors create parallax during editor movement.
- No text labels, UI maps, stones, Human Gate, or governance pipeline objects were added.

Compared with the latest `Void.png` direction, the current pass adds the required perceived-scale increase:

- Foreground dust is pushed into a tiny, close camera layer instead of readable sphere pellets.
- Mid-depth stars occupy the `5k-25k` range and create parallax during camera movement.
- Deep stars and nebula wall detail sit in the `100k-500k+` range.
- The center stays dark and empty while peripheral streaks and nebula contours subtly lead the eye toward it.
- The frame reads closer to a VR headset view into endless space: the camera has a clear forward path into the central void.

## Implementation Notes

The far cosmic complexity uses `GAUNTLET_Void_Distant_Nebula_Matte`, a distant Unreal mesh matte using the approved void reference image. The 3D behavior is supplied by Unreal-native layers in front of that matte:

- `GAUNTLET_LivingVoid_ReadOnly`
- `GAUNTLET_Void_Cinematic_Camera`
- `GAUNTLET_Volumetric_Void_Fog`
- `GAUNTLET_DarkVoid_PostProcess`
- `GAUNTLET_Void_Nebula_Edge_A/B/C_Light`
- `GAUNTLET_Void_Nebula_Edge_A/B/C_Sheet_##`

The C++ actor ticks in editor viewports for subtle visual drift only. It does not call JARVIS runtime APIs and does not create gameplay authority.

The 2026-06-07 scale pass did not add new actor categories. It retuned existing layers:

- `GAUNTLET_Void_Dust_Near`: foreground dust at `50-500` Unreal units.
- `GAUNTLET_Void_Starfield_Mid`: mid-depth stars at `5,000-25,000` Unreal units.
- `GAUNTLET_Void_Starfield_Far` and `GAUNTLET_Void_Starfield_Far_Warm`: deep stars at `100,000-500,000` Unreal units.
- `GAUNTLET_Void_Bright_Flares`: subtle radial streaks aimed toward the central vanishing void.
- `GAUNTLET_Void_Nebula_Edge_*`: perimeter nebula walls held beyond the central exclusion zone.

## Remaining Visual Gaps

The far nebula detail is matte-assisted rather than fully procedural Niagara volume. A later art pass should replace or augment the matte with Niagara ribbon emitters and volumetric material systems once the visual language is locked and stable.

The current frame intentionally does not place Human Gate, stones, six domains, labels, HUD overlays, pipelines, or any live bridge.
