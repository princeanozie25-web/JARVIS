"use client";

import { Float } from "@react-three/drei";

import { StoneMaterial } from "./stone-material";

export function SpaceZoneMesh() {
  return (
    <Float speed={0.42} rotationIntensity={0.26} floatIntensity={0.14}>
      <group data-gauntlet-canvas-zone="space" position={[-18, 2, -4]}>
        <pointLight color="#38bdf8" intensity={3.6} distance={24} />
        <mesh rotation={[0.35, 0.78, 0.22]}>
          <boxGeometry args={[3.5, 3.5, 3.5, 2, 2, 2]} />
          <StoneMaterial color="#38bdf8" opacity={0.78} />
        </mesh>
        <mesh rotation={[0.35, 0.78, 0.22]} scale={1.45}>
          <boxGeometry args={[3.5, 3.5, 3.5, 1, 1, 1]} />
          <meshBasicMaterial
            transparent
            wireframe
            color="#7dd3fc"
            opacity={0.28}
            depthWrite={false}
          />
        </mesh>
      </group>
    </Float>
  );
}
