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

## Poly Haven Kloppenheim 02 Pure Sky HDRI

- Source URL: https://polyhaven.com/a/kloppenheim_02_puresky
- Download URL: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloppenheim_02_puresky_1k.hdr
- License / usage posture: CC0, per Poly Haven asset licensing.
- Local path: `public/assets/cosmic-gauntlet/starfield.hdr`
- Why used: HDR environment lighting for the procedural R3F MeshPhysicalMaterial crystal stones and Human Gate core.
- Transformation: stored as the original 1K HDR download.
