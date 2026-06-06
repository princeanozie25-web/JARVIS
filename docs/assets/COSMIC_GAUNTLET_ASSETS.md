# Cosmic Gauntlet Assets

This document records permissive visual assets used by the `/audit/gauntlet`
cosmic command-system surface.

## NASA Webb Carina Cosmic Cliffs

- Source URL: https://science.nasa.gov/asset/webb/cosmic-cliffs-in-the-carina-nebula-nircam-compass-image/
- Download URL: https://assets.science.nasa.gov/content/dam/science/missions/webb/science/2022/07/STScI-01GA6KX212MXZGNEBJ55KXK9VQ.png/jcr:content/renditions/2000x1541.png
- License / usage posture: NASA / STScI public mission imagery. NASA imagery is generally not copyrighted unless otherwise noted; this asset is used as public science imagery with attribution and without endorsement.
- Local path: `public/assets/cosmic-gauntlet/nasa-webb-carina-cosmic-cliffs.webp`
- Why used: deep-space nebula atmosphere for the original JARVIS cosmic command-system background.
- Transformation: converted from NASA PNG rendition to WebP with `ffmpeg` for smaller frontend payload size.

No copyrighted Marvel, MCU, Infinity War, logo, screenshot, or proprietary texture
asset is used by this pass.

## Supplied Cosmic Gauntlet Reference Image

- Source: user-supplied local reference file, `C:\Users\princ\Downloads\COSMIC.png`.
- License / usage posture: provided by the project owner for this local prototype pass.
- Local path: `public/assets/cosmic-gauntlet/cosmic-gauntlet-reference.png`
- Files used by `/cosmic-gauntlet-prototype`:
  - `public/assets/cosmic-gauntlet/cosmic-gauntlet-reference.png`
- Why used: visual authority for the standalone cinematic prototype, preserving the exact six-world galaxy layout, golden Human Gate core, and blue tesseract pipeline composition requested for this route.
- Transformation: copied as supplied, no format conversion.

## Supplied Time Stone Galaxy Reference Image

- Source: user-supplied local reference file, `C:\Users\princ\Downloads\Time stone.png`.
- License / usage posture: provided by the project owner as the visual authority for this local prototype pass.
- Local path: `public/assets/cosmic-gauntlet/prototype/time-stone-galaxy-reference.png`
- Resolution: 1536 x 1024.
- Compression format: PNG as supplied.
- Files used by `/cosmic-gauntlet-prototype`:
  - `public/assets/cosmic-gauntlet/prototype/time-stone-galaxy-reference.png`
- Why used: minimum visual bar for every galaxy realm: cloudy field, molten central artifact, orbiting resource nodes, HUD labels, and cinematic scale.
- Transformation: copied as supplied, no format conversion.

## NASA Hubble M83 Galaxy Cloud Texture

- Source URL: https://science.nasa.gov/asset/hubble/spiral-galaxy-m83/
- Download URL: https://assets.science.nasa.gov/content/dam/science/missions/hubble/releases/2014/01/STScI-01EVT37XAM3KAF51GHW3744Z3D.tif/jcr:content/renditions/6000x3903.jpg
- License / usage posture: NASA / ESA / Hubble Heritage Team public mission imagery. NASA imagery is generally not copyrighted unless otherwise noted; this asset is used as public science imagery with attribution and without endorsement.
- Local path: `public/assets/cosmic-gauntlet/prototype/nasa-m83-galaxy-cloud.jpg`
- Resolution: 6000 x 3903.
- Compression format: JPEG rendition from NASA.
- Files used by `/cosmic-gauntlet-prototype`:
  - `public/assets/cosmic-gauntlet/prototype/nasa-m83-galaxy-cloud.jpg`
- Why used: high-resolution cloudy spiral-galaxy texture mixed into procedural realm fields so each stone system has nebular depth without relying on a low-resolution full-screen static base.
- Transformation: downloaded as NASA's 6000 x 3903 JPEG rendition and color-tinted in CSS per realm.

## Poly Haven Kloppenheim 02 Pure Sky HDRI

- Source URL: https://polyhaven.com/a/kloppenheim_02_puresky
- Download URL: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloppenheim_02_puresky_1k.hdr
- License / usage posture: CC0, per Poly Haven asset licensing.
- Local path: `public/assets/cosmic-gauntlet/starfield.hdr`
- Why used: HDR environment lighting for the procedural R3F MeshPhysicalMaterial crystal stones and Human Gate core.
- Transformation: stored as the original 1K HDR download.

## Kenney UI Pack - Sci-Fi

- Source URL: https://kenney.nl/assets/ui-pack-sci-fi
- Download URL: https://kenney.nl/media/pages/assets/ui-pack-sci-fi/b67c2acd31-1724181109/kenney_ui-pack-space-expansion.zip
- License / usage posture: Creative Commons Zero (CC0), per Kenney asset page and bundled `License.txt`.
- Local zip path: `public/assets/cosmic-gauntlet/kenney-ui-pack-sci-fi.zip`
- Local extracted path: `public/assets/cosmic-gauntlet/kenney-ui-pack-sci-fi/`
- Local license path: `public/assets/cosmic-gauntlet/kenney-ui-pack-sci-fi/License.txt`
- Files used by `/audit/gauntlet`:
  - `public/assets/cosmic-gauntlet/kenney-ui-pack-sci-fi/PNG/Extra/Default/button_square.png`
  - `public/assets/cosmic-gauntlet/kenney-ui-pack-sci-fi/PNG/Extra/Default/crosshair_a.png`
- Why used: permissive sci-fi node icon sprites for orbiting attribute nodes and the Space tesseract routing spine.
- Transformation: extracted from the original Kenney zip; PNG files are used as supplied.
