"use client";

import { Environment, Stars } from "@react-three/drei";

export function CosmicStarfield({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <Stars
        radius={300}
        depth={60}
        count={8000}
        factor={4}
        saturation={0.5}
        fade
        speed={reducedMotion ? 0 : 0.3}
      />
      <Environment files="/assets/cosmic-gauntlet/starfield.hdr" />
    </>
  );
}
