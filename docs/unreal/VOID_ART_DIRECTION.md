# Void Art Direction

Status captured on 2026-06-07 for the `unreal-gauntlet-lab` branch.

## 1. Scene intent (2-3 sentences)

The Gauntlet void is a cinematic Unreal Engine 5 deep-space environment rendered with Lumen, Niagara, Exponential Height Fog, and volumetric emissive materials. It is not a UI diagram, not a web prototype, not a labelled governance map, and not a skybox backdrop; it is a perspective-shot 3D void where light, particles, fog, and camera depth define scale before any domain meshes are placed.

## 2. Reference images

![Reference image 1: pure void](../../../../Downloads/Galaxy%201.png)

Image 1 establishes the perimeter-only nebula structure. The violet left-side arc, cyan right-side arc, and amber upper-right arc should be produced by Niagara ribbon emitters using emissive volumetric materials, with local Point Lights or Rect Lights placed near the densest filament knots; the near-black centre is maintained by excluding emitters, light sources, and mesh silhouettes from the origin volume. Stars are Niagara GPU particles with mixed colour temperature and depth distribution, embedded behind and within the filament layers rather than projected as a uniform texture.

![Reference image 2: deep space wider](../../../../Downloads/Galaxy%202.png)

Image 2 defines the depth stack. The upper-left purple column, upper-right cyan/teal mass, amber bleed, and mid-left spiral scale cue should be assembled with layered Niagara ribbon systems, volumetric cloud/fog contribution, and small emissive particle clusters rendered through the Cine Camera Actor with depth of field; no element should read as a flat billboard sheet. The darkest central region frames the future Gauntlet domains, while cold blue-white and warm amber star particles sit at different distances so parallax, bloom, and Lumen bounce create a 3D read.

## 3. Accepted visual language (the YES list)

- Nebula filament arcs -> Niagara ribbon emitters with volumetric emissive material.
- Volumetric cloud banks -> Volumetric Cloud Actor or Exponential Height Fog with albedo/emissive override, NOT flat sprites.
- Multi-colour temperature lighting -> multiple Rect Lights or Point Lights with distinct colour temperatures placed near nebula clusters.
- Star field -> Niagara GPU particle system, NOT a sphere with a texture map.
- Ambient glow between filaments -> post-process Bloom + Lumen indirect bounce.
- Depth layers -> Camera DOF (Depth of Field) on Cine Camera Actor, Focus Distance set to the central void plane.
- Subtle animation -> Niagara emitter update rate + World Position Offset in material, NOT flipbook animation.

## 4. Rejected visual language (the NO list)

- NO flat star-sphere skybox texture - use Niagara particle field only.
- NO diagram labels, annotation text, or UI overlays in any render.
- NO uniform single-colour star blob - stars must have colour temperature variation.
- NO flat 2D billboard nebula sprites - must be volumetric or Niagara ribbon.
- NO labelled governance pipeline (the web version is separate).
- NO placeholder grey cubes as stone slots - empty space is correct at this stage.
- NO flat orthographic/top-down renders - camera is always cinematic perspective.
- NO random fog fill - fog must respect the central void as darkest region.

## 5. Central void rule

The centre of the scene must remain the darkest region: all nebula, light, and particle density lives at the perimeter, and the six future stone domains will float inside the central void without premature visual fill. The central 30-metre radius from world origin is a no-particle, no-light-source, no-mesh exclusion zone until the stones are placed.

## 6. Future six domains (do not label yet)

The six governance domains - Capture, Classify, Route, Gate, Execute, Observe - will eventually occupy six equidistant positions in the central void. The Gate domain will carry an amber/orange light temperature distinct from the other five blue-white domains, and no labels, text, or UI are placed in the 3D scene because labels live in the HUD overlay only. The six nebula zones in the reference images provide the colour-direction for those future domains: violet and blue/cyan perimeter energy for most domains, with the Gate domain inheriting the warmer amber/orange temperature.

## 7. Camera and render requirements

- Camera type: Cine Camera Actor with filmback set to Super 35.
- Aperture: f/2.8 to f/4.0 (visible DOF, not razor-sharp).
- Focal length: 24-35mm equivalent.
- All validation screenshots must be taken from the Cine Camera - never the editor perspective viewport.
- Lumen must be enabled (Hardware Ray Tracing preferred, Software acceptable).
- Auto Exposure: manual, EV100 between 0 and 2.
- All renders must be cinematic screenshots via High Resolution Screenshot tool (minimum 1920x1080), not viewport grabs.

## 8. Validation checklist

Future Codex prompts working on this scene must pass all items before committing:

- [ ] Does the render look like a real 3D space environment, not a diagram?
- [ ] Is the central region darker than the perimeter?
- [ ] Do nebula elements have visible depth/volume, not flat-sprite look?
- [ ] Are there at least two distinct colour temperatures in the lighting?
- [ ] Is the star field varied in size and colour, not uniform dots?
- [ ] Are there zero text labels, annotations, or UI elements in the render?
- [ ] Was the screenshot taken from the Cine Camera Actor, not the viewport?
- [ ] Does the scene support the future placement of 6 objects in the centre without the perimeter feeling empty or unbalanced?
