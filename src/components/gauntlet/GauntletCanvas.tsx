"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";

import { ConnectionPulse } from "./ConnectionPulse";
import { CosmicStarfield } from "./CosmicStarfield";
import { HumanGateMesh } from "./HumanGate";
import { GauntletPostProcessing } from "./PostProcessing";
import { MindZoneMesh } from "./zones/MindZone";
import { PowerZoneMesh } from "./zones/PowerZone";
import { RealityZoneMesh } from "./zones/RealityZone";
import { SoulZoneMesh } from "./zones/SoulZone";
import { SpaceZoneMesh } from "./zones/SpaceZone";
import { TimeZoneMesh } from "./zones/TimeZone";

type ZoneId = "space" | "time" | "mind" | "soul" | "reality" | "power";

const ZONE_POINTS: Readonly<
  Record<ZoneId, { position: readonly [number, number, number]; color: string }>
> = {
  space: { position: [-18, 2, -4], color: "#38bdf8" },
  time: { position: [-6, 14, -2], color: "#4ade80" },
  mind: { position: [16, 12, -3], color: "#c084fc" },
  soul: { position: [-8, -13, -2], color: "#fb923c" },
  reality: { position: [18, -8, -3], color: "#22d3ee" },
  power: { position: [8, -14, -4], color: "#f43f5e" },
};

export function GauntletCanvas() {
  const reducedMotion = useReducedMotionPreference();

  return (
    <div
      aria-hidden="true"
      data-gauntlet-cosmic-canvas-layer="r3f-presentational"
      data-gauntlet-canvas-owns-metadata="false"
      data-gauntlet-canvas-owns-routing="false"
      data-gauntlet-canvas-owns-approval="false"
      className="jarvis-gauntlet-canvas-layer pointer-events-none absolute"
    >
      <Canvas
        aria-hidden="true"
        data-gauntlet-canvas="react-three-fiber"
        className="pointer-events-none h-full w-full"
        camera={{ position: [0, 0, 34], fov: 44 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#020617"]} />
        <ambientLight intensity={0.22} />
        <CosmicStarfield reducedMotion={reducedMotion} />
        <HumanGateMesh />
        <SpaceZoneMesh />
        <TimeZoneMesh />
        <MindZoneMesh />
        <SoulZoneMesh />
        <RealityZoneMesh />
        <PowerZoneMesh />
        {Object.entries(ZONE_POINTS).map(
          ([zone, { position, color }], index) => (
            <ConnectionPulse
              key={zone}
              from={position}
              to={[0, 0, 0]}
              color={color}
              index={index}
              reducedMotion={reducedMotion}
            />
          ),
        )}
        <OrbitControls
          enablePan
          enableZoom
          enableRotate={false}
          minDistance={5}
          maxDistance={80}
          target={[0, 0, 0]}
        />
        <GauntletPostProcessing />
      </Canvas>
    </div>
  );
}

function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
}
