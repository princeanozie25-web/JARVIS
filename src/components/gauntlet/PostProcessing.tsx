"use client";

import { Bloom, EffectComposer } from "@react-three/postprocessing";

export function GauntletPostProcessing() {
  return (
    <EffectComposer>
      <Bloom
        intensity={1.5}
        luminanceThreshold={0.3}
        luminanceSmoothing={0.9}
        radius={0.8}
      />
    </EffectComposer>
  );
}
